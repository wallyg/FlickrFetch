import { clearFineReason } from './fineReasons'
import { hintFor, hintStats, titleFarIds, titleFarKey } from './locationHints'
import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { getDb } from './database'
import { ownerNsid } from './owner'
import { csvCell, saveCsvFile } from './csv'
import { PHOTO_META_DDL, addPhotoMetaColumns } from './tagIndex'
import { foldAccents } from '../shared/tags'
import { isCameraTitle } from '../shared/cameraNames'
import { loadSettings } from './settings'
import { ruleState, ruleById } from '../shared/cleanupRules'
import { HEALTH_CONDITIONS } from '../shared/healthChecks'
import { includesVideos, normalizeScope, scopeSql } from '../shared/healthScope'
import { DESC_ONLY_LINK, DESC_COPIES_TITLE, DESC_ONLY_MARKUP, DESC_LOOKS_LIKE_TAGS } from '../shared/descriptionFlags'
import type { DuplicateGroup, DuplicatePhoto, DuplicateQuery, DuplicatePage, DuplicateStats,
  HealthCondition, HealthExportQuery, HealthListPage, HealthListQuery, HealthOverview, HealthPhoto, HealthSetRequest, HealthSort, HealthSummary
} from '../shared/types'

// Metadata health: photos with missing or doubtful metadata (no title, a date in the future, a description that is only
// a link, a location at 0, 0 ...). Each check is one "condition". Read-only report built from the local copy the scan
// keeps. Nothing here changes Flickr.

export { HEALTH_CONDITIONS }

export { isCameraTitle }

let ready: Database.Database | null = null
function healthDb(): Database.Database {
  const db = getDb()
  if (!db) throw new Error('Database is not open')
  if (ready !== db) {
    farKey = ''   // the temporary far-photos table belongs to the old connection, so it must be rebuilt
    db.exec(`
      ${PHOTO_META_DDL}
      CREATE TABLE IF NOT EXISTS photo_health_state (
        photo_id TEXT NOT NULL,
        condition TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (photo_id, condition)
      );
      CREATE TEMP TABLE IF NOT EXISTS health_far (photo_id TEXT PRIMARY KEY);
      CREATE TEMP TABLE IF NOT EXISTS health_titlefar (photo_id TEXT PRIMARY KEY);
    `)
    // Lower-case and accent-free, so the title filter finds "Québec" when you type "quebec" (SQLite's own LIKE only ignores case for plain English letters)
    db.function('ff_fold', { deterministic: true }, (t: unknown) => (typeof t === 'string' ? foldAccents(t).toLowerCase() : ''))
    db.function('ff_camera_title', { deterministic: true }, (t: unknown) => (typeof t === 'string' && isCameraTitle(t) ? 1 : 0))
    addPhotoMetaColumns(db)
    farKey = ''; titleFarStamp = ''   // the temporary tables above start empty on a new connection
    ready = db
  }
  return db
}

// The days devices fall back to when their clock is not set (Unix 1970, Mac 1904, DOS 1980, Y2K 2000, 1900)
const PLACEHOLDER_DAYS = "'1970-01-01', '1904-01-01', '1980-01-01', '2000-01-01', '1900-01-01'"

// Photos with this many tags or more are flagged by "Too many tags" (Flickr stops at 75)
function tagLimit(): number {
  const n = Number(loadSettings().healthTagLimit)
  return Number.isInteger(n) && n >= 2 && n <= 75 ? n : 65
}

// ── Possible duplicates (#157) ───────────────────────────────────────────────
// A group is photos with the same real date taken (to the second) uploaded at least a number of minutes apart. A burst is uploaded together,
// so it is not a group; a re-upload of one file is. Photos timed exactly at midnight carry a made-up time, so they are left out.
function dupGapSeconds(): number {
  const m = Number(loadSettings().duplicates?.gapMinutes)
  return (Number.isFinite(m) ? Math.min(10080, Math.max(1, Math.round(m))) : 10) * 60
}
// Which photos the checks look at (Tune checks, #246): videos can be left out of every check, and No location has its own privacy and video choice
function scopeNow(): ReturnType<typeof normalizeScope> { return normalizeScope(loadSettings().healthScope) }
function catalogSaved(db: Database.Database): boolean {
  return (db.prepare("SELECT value FROM tag_index_meta WHERE key = 'has_catalog_v2'").get() as { value: string } | undefined)?.value === '1'
}
const dupReal = (): string => `length(p.date_taken) >= 19 AND substr(p.date_taken, 12, 8) <> '00:00:00' AND p.date_upload IS NOT NULL${scopeSql('duplicates', scopeNow(), true)}`
const dupGroupsSql = (): string => `(SELECT p.date_taken FROM photo_meta p WHERE ${dupReal()} GROUP BY p.date_taken HAVING COUNT(*) > 1 AND MAX(p.date_upload) - MIN(p.date_upload) >= ${dupGapSeconds()})`

interface DupRow { taken: string; n: number; gap: number; fine: number }
function dupGroupRows(db: Database.Database, search: string): DupRow[] {
  const pattern = search ? `%${foldAccents(search).toLowerCase().replace(/[\\%_]/g, m => '\\' + m)}%` : null
  const sql = `SELECT p.date_taken AS taken, COUNT(*) AS n, MAX(p.date_upload) - MIN(p.date_upload) AS gap,
      SUM(CASE WHEN s.status = 'fine' THEN 1 ELSE 0 END) AS fine${pattern ? ", MAX(CASE WHEN ff_fold(p.title) LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END) AS hit" : ''}
    FROM photo_meta p LEFT JOIN photo_health_state s ON s.photo_id = p.photo_id AND s.condition = 'duplicates'
    WHERE ${dupReal()} GROUP BY p.date_taken HAVING COUNT(*) > 1 AND gap >= ${dupGapSeconds()}${pattern ? ' AND hit = 1' : ''}`
  return (pattern ? db.prepare(sql).all(pattern) : db.prepare(sql).all()) as DupRow[]
}

export function duplicateStats(): DuplicateStats {
  const rows = dupGroupRows(healthDb(), '')
  return { groups: rows.length, photos: rows.reduce((n, r) => n + r.n, 0) }
}

export function duplicateGroups(q: DuplicateQuery): DuplicatePage {
  const db = healthDb()
  const wantFine = q.status === 'fine'
  const rows = dupGroupRows(db, (q.search ?? '').trim()).filter(r => (r.fine === r.n) === wantFine)
  const sort = q.sort ?? 'gap'
  rows.sort(sort === 'oldest' ? (a, b) => (a.taken < b.taken ? -1 : 1) : sort === 'newest' ? (a, b) => (a.taken < b.taken ? 1 : -1) : (a, b) => b.gap - a.gap || (a.taken < b.taken ? 1 : -1))
  const page = rows.slice(Math.max(q.offset, 0), Math.max(q.offset, 0) + Math.min(Math.max(q.limit, 1), 100))
  const out: DuplicateGroup[] = []
  if (page.length) {
    const marks = page.map(() => '?').join(',')
    const photos = db.prepare(`SELECT p.photo_id, p.title, p.thumb_url, p.date_taken, p.date_upload, p.privacy, s.status,
        (SELECT COUNT(*) FROM tag_photo t WHERE t.photo_id = p.photo_id) AS tags
      FROM photo_meta p LEFT JOIN photo_health_state s ON s.photo_id = p.photo_id AND s.condition = 'duplicates'
      WHERE ${dupReal()} AND p.date_taken IN (${marks}) ORDER BY p.date_taken, p.date_upload, p.photo_id`).all(...page.map(r => r.taken)) as { photo_id: string; title: string; thumb_url: string; date_taken: string; date_upload: number; privacy: number; status: string | null; tags: number }[]
    // How many albums each photo is in (null until the album list has been read)
    const albumCount = new Map<string, number>()
    let albumsKnown = true
    try {
      for (let i = 0; i < photos.length; i += 500) {
        const chunk = photos.slice(i, i + 500).map(p => p.photo_id)
        for (const r of db.prepare(`SELECT photo_id, COUNT(*) AS n FROM album_photo WHERE photo_id IN (${chunk.map(() => '?').join(',')}) GROUP BY photo_id`).all(...chunk) as { photo_id: string; n: number }[]) albumCount.set(r.photo_id, r.n)
      }
    } catch { albumsKnown = false }
    const owner = ownerNsid()
    const byTaken = new Map<string, DuplicatePhoto[]>()
    for (const p of photos) {
      const list = byTaken.get(p.date_taken) ?? []
      list.push({
        photoId: p.photo_id, title: p.title, thumbUrl: p.thumb_url, uploadedAt: p.date_upload, tags: p.tags,
        albums: albumsKnown ? (albumCount.get(p.photo_id) ?? 0) : null, privacy: p.privacy,
        flickrUrl: owner ? `https://www.flickr.com/photos/${owner}/${p.photo_id}` : `https://www.flickr.com/photo.gne?id=${p.photo_id}`,
        status: p.status === 'fine' ? 'fine' : 'open'
      })
      byTaken.set(p.date_taken, list)
    }
    for (const r of page) out.push({ taken: r.taken, gapSeconds: r.gap, photos: byTaken.get(r.taken) ?? [] })
  }
  return { groups: out, total: rows.length, photos: rows.reduce((n, r) => n + r.n, 0) }
}

// The SQL test for one check, on a photo_meta row aliased p
function whereFor(db: Database.Database, c: HealthCondition): string {
  return `((${conditionSql(db, c)})${scopeSql(c, scopeNow(), catalogSaved(db))})`
}
function conditionSql(db: Database.Database, c: HealthCondition): string {
  switch (c) {
    case 'title': return "(p.title = '' OR ff_camera_title(p.title) = 1)"
    case 'description': return 'p.has_description = 0'
    case 'tags': return 'p.has_tags = 0'
    case 'tagsOne': return '(p.has_tags = 1 AND (SELECT COUNT(*) FROM tag_photo tp WHERE tp.photo_id = p.photo_id) = 1)'
    case 'location': return 'p.has_location = 0'
    case 'dateFuture': return "(p.date_taken <> '' AND substr(p.date_taken, 1, 10) > date('now', 'localtime'))"
    // Compared by day, so time zones cannot cause a false alarm
    case 'dateAfterUpload': return "(p.date_upload IS NOT NULL AND p.date_taken <> '' AND substr(p.date_taken, 1, 10) > date(p.date_upload, 'unixepoch', 'localtime'))"
    case 'datePlaceholder': return `(p.date_unknown = 1 OR (p.date_taken <> '' AND (substr(p.date_taken, 1, 10) IN (${PLACEHOLDER_DAYS}) OR substr(p.date_taken, 1, 4) < '1900')))`
    case 'descLink': return `(p.desc_flags & ${DESC_ONLY_LINK}) <> 0`
    case 'descCopy': return `(p.desc_flags & ${DESC_COPIES_TITLE}) <> 0`
    case 'descMarkup': return `(p.desc_flags & ${DESC_ONLY_MARKUP}) <> 0`
    case 'descTags': return `(p.desc_flags & ${DESC_LOOKS_LIKE_TAGS}) <> 0`
    // Flickr sends 0, 0 for "no location", so a real geotag at 0, 0 is told apart by its accuracy (set only when a place was chosen)
    case 'locNull': return '(p.has_location = 0 AND p.geo_accuracy > 0)'
    // Flickr's precision runs from 1 (the whole world) to 16 (a street): 10 or less is a region, a country or worse. Unrecorded (0) is not counted
    case 'locVague': return '(p.has_location = 1 AND p.geo_accuracy BETWEEN 1 AND 10)'
    case 'locFar': refreshFar(db); return 'p.photo_id IN (SELECT photo_id FROM health_far)'
    case 'locTitle': refreshTitleFar(db); return 'p.photo_id IN (SELECT photo_id FROM health_titlefar)'
    case 'duplicates': return `(p.date_upload IS NOT NULL AND p.date_taken IN ${dupGroupsSql()})`
    case 'tagsMany': return `(SELECT COUNT(*) FROM tag_photo tp WHERE tp.photo_id = p.photo_id) >= ${tagLimit()}`
  }
}

// ── Locations far from the photos taken around them ─────────────────────────
// A photo is "far" when the photos taken just before and just after it (within an hour) agree with each other
// (within 5 km) but it sits more than 50 km from both. Photos dated at midnight are left out: scans of old prints carry
// a made-up time, so their "neighbours" are not really taken around the same moment. Worked out in code, kept in a temporary table.
const FAR_KM = 50, AGREE_KM = 5, FAR_WINDOW_S = 3600
function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)))
}
let farKey = ''
function refreshFar(db: Database.Database): void {
  const meta = db.prepare("SELECT value FROM tag_index_meta WHERE key = 'last_scan_at'").get() as { value: string } | undefined
  const key = `${meta?.value ?? ''}`
  if (key === farKey) return
  const rows = db.prepare("SELECT photo_id AS id, date_taken AS d, latitude AS lat, longitude AS lon FROM photo_meta WHERE has_location = 1 AND latitude IS NOT NULL AND length(date_taken) >= 19 AND substr(date_taken, 12, 5) <> '00:00' ORDER BY date_taken, photo_id").all() as { id: string; d: string; lat: number; lon: number }[]
  const at = (d: string): number => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), Number(d.slice(11, 13)), Number(d.slice(14, 16)), Number(d.slice(17, 19))).getTime() / 1000
  const times = rows.map(r => at(r.d))
  const far: string[] = []
  for (let i = 1; i < rows.length - 1; i++) {
    const a = rows[i - 1], m = rows[i], b = rows[i + 1]
    if (times[i] - times[i - 1] > FAR_WINDOW_S || times[i + 1] - times[i] > FAR_WINDOW_S) continue
    if (km(a.lat, a.lon, b.lat, b.lon) > AGREE_KM) continue
    if (km(m.lat, m.lon, a.lat, a.lon) > FAR_KM && km(m.lat, m.lon, b.lat, b.lon) > FAR_KM) far.push(m.id)
  }
  const insert = db.prepare('INSERT OR IGNORE INTO health_far (photo_id) VALUES (?)')
  db.transaction(() => { db.exec('DELETE FROM health_far'); for (const id of far) insert.run(id) })()
  farKey = key
}

// Geotags far from the place their title names, worked out in locationHints.ts and kept in a temporary table
let titleFarStamp = ''
function refreshTitleFar(db: Database.Database): void {
  const key = titleFarKey(db)
  if (key === titleFarStamp) return
  const insert = db.prepare('INSERT OR IGNORE INTO health_titlefar (photo_id) VALUES (?)')
  const ids = titleFarIds(db)
  db.transaction(() => { db.exec('DELETE FROM health_titlefar'); for (const id of ids) insert.run(id) })()
  titleFarStamp = key
}

function hasData(db: Database.Database): boolean {
  const row = db.prepare("SELECT value FROM tag_index_meta WHERE key = 'has_photo_meta'").get() as { value: string } | undefined
  return row?.value === '1'
}

// The checks about where a photo's own geotag is: their rows can open the Map on that geotag ("Show on the map"). A photo with no geotag has no place to show.
const OWN_PLACE = new Set<string>(['locNull', 'locVague', 'locFar'])
export function ownPlace(condition: string, lat: number | null, lon: number | null): { lat: number; lon: number } | undefined {
  return OWN_PLACE.has(condition) && lat !== null && lon !== null ? { lat, lon } : undefined
}

// The one rule for "how many photos do the checks speak about": videos are part of the total only while at least one check that is on looks at them.
// The summary and the Overview both use it, so their totals always agree.
function videosCounted(): boolean {
  const cleanupRules = loadSettings().cleanupRules
  const scope = scopeNow()
  return HEALTH_CONDITIONS.some(c => ruleState(cleanupRules, `photos:${c}`) !== 'off' && includesVideos(c, scope))
}
const NOT_VIDEO = "COALESCE(p.media, 'photo') <> 'video'"

export function healthSummary(): HealthSummary {
  const db = healthDb()
  if (!hasData(db)) return { hasData: false, photos: 0, rows: [] }
  const photos = (db.prepare(`SELECT COUNT(*) AS n FROM photo_meta p${videosCounted() ? '' : ` WHERE ${NOT_VIDEO}`}`).get() as { n: number }).n
  const rows = HEALTH_CONDITIONS.map(condition => {
    const where = whereFor(db, condition)
    const count = (fine: boolean): number => (db.prepare(`
      SELECT COUNT(*) AS n FROM photo_meta p
      LEFT JOIN photo_health_state s ON s.photo_id = p.photo_id AND s.condition = ?
      WHERE ${where} AND ${fine ? "s.status = 'fine'" : 's.status IS NULL'}
    `).get(condition) as { n: number }).n
    return { condition, open: count(false), fine: count(true) }
  })
  return { hasData: true, photos, rows }
}

interface Row { photo_id: string; title: string; thumb_url: string; date_taken: string; latitude: number | null; longitude: number | null; status: string | null }

// Empty titles go last when sorting by title
const HEALTH_ORDER: Record<HealthSort, string> = {
  newest: 'p.date_taken DESC, p.photo_id DESC',
  oldest: "(p.date_taken = ''), p.date_taken ASC, p.photo_id ASC",
  title: "(p.title = ''), ff_fold(p.title), p.photo_id DESC",
  titleDesc: "(p.title = ''), ff_fold(p.title) DESC, p.photo_id DESC"
}

// The part of a list query after SELECT: which photos (check, open or fine, title filter, year) and the values to bind
function listBase(db: Database.Database, q: HealthExportQuery): { base: string; params: (string | number)[] } {
  const search = (q.search ?? '').trim()
  const filter = `${whereFor(db, q.condition)} AND ${q.status === 'fine' ? "s.status = 'fine'" : 's.status IS NULL'}${search ? " AND ff_fold(p.title) LIKE ? ESCAPE '\\'" : ''}${q.year ? ' AND substr(p.date_taken, 1, 4) = ?' : ''}${q.condition === 'title' && q.reason === 'none' ? " AND p.title = ''" : q.condition === 'title' && q.reason === 'camera' ? " AND p.title <> ''" : ''}`
  const base = `FROM photo_meta p LEFT JOIN photo_health_state s ON s.photo_id = p.photo_id AND s.condition = ? WHERE ${filter}`
  const params: (string | number)[] = [q.condition]
  if (search) params.push(`%${foldAccents(search).toLowerCase().replace(/[\\%_]/g, m => '\\' + m)}%`)
  if (q.year) params.push(q.year)
  return { base, params }
}

function queryRows(q: HealthExportQuery, limit: number, offset: number): { rows: HealthPhoto[]; total: number; reasons?: HealthListPage['reasons'] } {
  const db = healthDb()
  const { base, params } = listBase(db, q)
  const total = (db.prepare(`SELECT COUNT(*) AS n ${base}`).get(...params) as { n: number }).n
  const raw = db.prepare(`SELECT p.photo_id, p.title, p.thumb_url, p.date_taken, p.latitude, p.longitude, s.status ${base} ORDER BY ${HEALTH_ORDER[q.sort ?? 'newest']} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Row[]
  const owner = ownerNsid()
  const kind = ruleById(`photos:${q.condition}`)?.kind ?? ''
  // No title or camera-file title: how many rows of each kind, so the Reason menu can show them
  let reasons: HealthListPage['reasons']
  if (q.condition === 'title') {
    const b = listBase(db, { ...q, reason: undefined })
    const n = (extra: string): number => (db.prepare(`SELECT COUNT(*) AS n ${b.base}${extra}`).get(...b.params) as { n: number }).n
    reasons = { none: n(" AND p.title = ''"), camera: n(" AND p.title <> ''") }
  }
  return {
    ...(reasons ? { reasons } : {}),
    total,
    rows: raw.map(r => {
      const hint = hintFor(db, q.condition, r.photo_id, r.date_taken, r.latitude !== null && r.longitude !== null ? { lat: r.latitude, lon: r.longitude } : null)
      return {
      hint: hint?.text, hintMapUrl: hint?.mapUrl, hintGeo: hint?.geo ?? ownPlace(q.condition, r.latitude, r.longitude),
      photoId: r.photo_id,
      title: r.title,
      thumbUrl: r.thumb_url,
      dateTaken: r.date_taken,
      kind: q.condition === 'title' ? (r.title.trim() === '' ? 'No title' : 'Camera-file title') : kind,
      flickrUrl: owner ? `https://www.flickr.com/photos/${owner}/${r.photo_id}` : `https://www.flickr.com/photo.gne?id=${r.photo_id}`,
      status: (r.status === 'fine' ? 'fine' : 'open') as 'fine' | 'open'
    } })
  }
}

export function healthList(q: HealthListQuery): HealthListPage {
  return queryRows(q, Math.min(Math.max(q.limit, 1), 500), Math.max(q.offset, 0))
}

// Every photo id in a list (not just the page on screen), newest first, for the batch editor
export function healthIds(q: HealthExportQuery): string[] {
  const db = healthDb()
  const { base, params } = listBase(db, q)
  return (db.prepare(`SELECT p.photo_id ${base} ORDER BY ${HEALTH_ORDER[q.sort ?? 'newest']}`).all(...params) as { photo_id: string }[]).map(r => r.photo_id)
}

export function healthSet(req: HealthSetRequest): void {
  const db = healthDb()
  if (req.status === 'open') {
    db.prepare('DELETE FROM photo_health_state WHERE photo_id = ? AND condition = ?').run(req.photoId, req.condition)
    clearFineReason(`photos:${req.condition}`, req.photoId)
  } else {
    db.prepare(`
      INSERT INTO photo_health_state (photo_id, condition, status, updated_at) VALUES (?, ?, 'fine', ?)
      ON CONFLICT(photo_id, condition) DO UPDATE SET status = 'fine', updated_at = excluded.updated_at
    `).run(req.photoId, req.condition, Date.now())
  }
}

// The numbers behind the dashboard: how complete the library is, by type, by year, and where gaps bunch up
export function healthOverview(): HealthOverview {
  const db = healthDb()
  const none = Object.fromEntries(HEALTH_CONDITIONS.map(c => [c, 0])) as Record<HealthCondition, number>
  if (!hasData(db)) return { hasData: false, photos: 0, complete: 0, withGap: 0, warnOnly: 0, twoOrMore: 0, onlyOne: { ...none }, byType: [], byYear: [], clusters: [] }
  // Checks that are Off are left out entirely; Warnings are listed but do not count towards "complete"
  const cleanupRules = loadSettings().cleanupRules
  const stateOf = (c: HealthCondition): 'off' | 'optional' | 'on' => ruleState(cleanupRules, `photos:${c}`)
  const conds = HEALTH_CONDITIONS.filter(c => stateOf(c) !== 'off')
  // One pass over every photo: a column per check that is switched on
  const select = conds.map((c, i) => `CASE WHEN ${whereFor(db, c)} THEN 1 ELSE 0 END AS c${i}`).join(', ')
  const videoPart = videosCounted() ? '' : ` WHERE ${NOT_VIDEO}`
  const rows = db.prepare(`SELECT p.photo_id AS id, substr(p.date_taken, 1, 4) AS y${select ? ', ' + select : ''} FROM photo_meta p${videoPart}`).all() as Record<string, number | string>[]
  // Gaps marked fine do not count
  const fine = new Set((db.prepare("SELECT photo_id || '|' || condition AS k FROM photo_health_state WHERE status = 'fine'").all() as { k: string }[]).map(r => r.k))
  type YearRow = HealthOverview['byYear'][number]
  const years = new Map<string, YearRow>()
  const totals = { ...none }
  const onlyOne = { ...none }
  let withGap = 0, twoOrMore = 0, warnOnly = 0
  for (const r of rows) {
    const y = String(r.y) || 'Unknown'
    const e = years.get(y) ?? { year: y, total: 0, anyGap: 0, both: 0, warnOnly: 0, by: { ...none } }
    e.total++
    let issues = 0, warns = 0
    let only: HealthCondition | null = null
    conds.forEach((c, i) => {
      if (r[`c${i}`] !== 1 || fine.has(`${r.id}|${c}`)) return
      totals[c]++; e.by[c]++
      if (stateOf(c) === 'on') { issues++; only = issues === 1 ? c : null } else warns++
    })
    // A photo counts once, as an Issue, if it has any Issue gap; warnOnly holds those with only warnings
    if (issues > 0) { e.anyGap++; withGap++; if (warns > 0) e.both++ } else if (warns > 0) { e.warnOnly++; warnOnly++ }
    if (issues > 1) twoOrMore++
    if (issues === 1 && only) onlyOne[only]++
    years.set(y, e)
  }
  const photos = rows.length
  const byYear = [...years.values()].filter(e => e.year !== 'Unknown').sort((a, b) => a.year.localeCompare(b.year))
  // A cluster is a year where a gap is at least twice as common as in the library overall; the biggest excesses come first
  // (only for the checks that are Issues: these are the places to start)
  const clusters: HealthOverview['clusters'] = []
  for (const condition of conds) {
    if (stateOf(condition) !== 'on') continue
    const rate = totals[condition] / Math.max(photos, 1)
    for (const e of byYear) {
      const count = e.by[condition]
      if (e.total >= 100 && count >= 50 && count / e.total >= 2 * rate) clusters.push({ condition, year: e.year, count, total: e.total })
    }
  }
  const excess = (c: HealthOverview['clusters'][number]): number => c.count - (totals[c.condition] / Math.max(photos, 1)) * c.total
  clusters.sort((a, b) => excess(b) - excess(a))
  return {
    hasData: true, photos, complete: photos - withGap, withGap, warnOnly, twoOrMore, onlyOne,
    byType: conds.map(condition => ({ condition, state: stateOf(condition) as 'optional' | 'on', open: totals[condition] })),
    byYear, clusters: clusters.slice(0, 10)
  }
}

export function healthCsvRows(q: HealthExportQuery): string[][] {
  return queryRows(q, 1_000_000, 0).rows.map(r => [csvCell(r.title || '(no title)'), r.dateTaken, r.kind || '', csvCell(r.flickrUrl)])
}

export function registerHealthIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('health:summary', () => healthSummary())
  ipcMain.handle('health:hintStats', () => hintStats(healthDb()))
  ipcMain.handle('health:duplicates', (_event, q: DuplicateQuery) => duplicateGroups(q))
  ipcMain.handle('health:duplicateStats', () => duplicateStats())
  ipcMain.handle('health:overview', () => healthOverview())
  ipcMain.handle('health:list', (_event, q: HealthListQuery) => healthList(q))
  ipcMain.handle('health:ids', (_event, q: HealthExportQuery) => healthIds(q))
  ipcMain.handle('health:set', (_event, req: HealthSetRequest) => healthSet(req))
  ipcMain.handle('health:saveCsv', (_event, q: HealthExportQuery) =>
    saveCsvFile(getWindow, `photo-health-${q.condition}-${q.status}.csv`, ['Title', 'Date taken', 'Kind', 'Flickr page'], healthCsvRows(q)))
}
