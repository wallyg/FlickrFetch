import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { getDb } from './database'
import { ownerNsid } from './owner'
import { csvCell, saveCsvFile } from './csv'
import { PHOTO_META_DDL } from './tagIndex'
import { foldAccents } from '../shared/tags'
import type {
  HealthCondition, HealthExportQuery, HealthListPage, HealthListQuery, HealthOverview, HealthPhoto, HealthSetRequest, HealthSummary
} from '../shared/types'

// Metadata health: photos with missing or weak metadata (no title, no description, no tags, no location).
// Read-only report built from the local copy the tag scan keeps. Nothing here changes Flickr.

export const HEALTH_CONDITIONS: HealthCondition[] = ['title', 'description', 'tags', 'location']

// Titles a camera or phone leaves behind: IMG_1234, DSC_0042, P1000234, 20240315_101500, "Photo on 3-15-24 at 10.15 AM".
// The WHOLE title has to look like that (a copy number or file ending is allowed), so "IMG_1234 sunset at the
// beach" or "Image 2013 recap", which someone typed, are left alone.
const COPY_BITS = String.raw`(?:[ _-]?(?:\(\d+\)|\d{1,3}|copy|edit(?:ed)?|hdr|pano|burst\d*))*`
const CAMERA_TITLES = [
  new RegExp(String.raw`^(?:img|dsc|dscn|dscf|dsci|pict|mvi|mov|vid|gopr|gp|pxl|sam|cimg|dcp|image|p)[_-]?\d{3,}` + COPY_BITS + String.raw`(?:\.[a-z0-9]{2,4})?$`, 'i'),
  new RegExp(String.raw`^\d{8}[_ -]\d{4,9}` + COPY_BITS + '$', 'i'),
  /^\d{4}-\d{2}-\d{2}[ _-]\d{2}[.:]\d{2}(?:[.:]\d{2})?$/,
  /^photo on \d[\d/.-]*(?: at \d{1,2}[.:]\d{2}(?:[.:]\d{2})?(?: ?[ap]m)?)?$/i,
  /^screenshot[ _-]\d{4}-\d{2}-\d{2}(?: at \d{1,2}[.:]\d{2}[.:]\d{2}(?: ?[ap]m)?)?$/i
]
export function isCameraTitle(title: string): boolean {
  const t = title.trim()
  return t !== '' && CAMERA_TITLES.some(re => re.test(t))
}

let ready: Database.Database | null = null
function healthDb(): Database.Database {
  const db = getDb()
  if (!db) throw new Error('Database is not open')
  if (ready !== db) {
    db.exec(`
      ${PHOTO_META_DDL}
      CREATE TABLE IF NOT EXISTS photo_health_state (
        photo_id TEXT NOT NULL,
        condition TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (photo_id, condition)
      );
    `)
    // Lower-case and accent-free, so the title filter finds "Québec" when you type "quebec" (SQLite's own LIKE only ignores case for plain English letters)
    db.function('ff_fold', { deterministic: true }, (t: unknown) => (typeof t === 'string' ? foldAccents(t).toLowerCase() : ''))
    db.function('ff_camera_title', { deterministic: true }, (t: unknown) => (typeof t === 'string' && isCameraTitle(t) ? 1 : 0))
    ready = db
  }
  return db
}

const WHERE: Record<HealthCondition, string> = {
  title: "(p.title = '' OR ff_camera_title(p.title) = 1)",
  description: 'p.has_description = 0',
  tags: 'p.has_tags = 0',
  location: 'p.has_location = 0'
}

function hasData(db: Database.Database): boolean {
  const row = db.prepare("SELECT value FROM tag_index_meta WHERE key = 'has_photo_meta'").get() as { value: string } | undefined
  return row?.value === '1'
}

export function healthSummary(): HealthSummary {
  const db = healthDb()
  if (!hasData(db)) return { hasData: false, photos: 0, rows: [] }
  const photos = (db.prepare('SELECT COUNT(*) AS n FROM photo_meta').get() as { n: number }).n
  const rows = HEALTH_CONDITIONS.map(condition => {
    const count = (fine: boolean): number => (db.prepare(`
      SELECT COUNT(*) AS n FROM photo_meta p
      LEFT JOIN photo_health_state s ON s.photo_id = p.photo_id AND s.condition = ?
      WHERE ${WHERE[condition]} AND ${fine ? "s.status = 'fine'" : 's.status IS NULL'}
    `).get(condition) as { n: number }).n
    return { condition, open: count(false), fine: count(true) }
  })
  return { hasData: true, photos, rows }
}

interface Row { photo_id: string; title: string; thumb_url: string; date_taken: string; status: string | null }

function queryRows(q: HealthExportQuery, limit: number, offset: number): { rows: HealthPhoto[]; total: number } {
  const db = healthDb()
  const search = (q.search ?? '').trim()
  const filter = `${WHERE[q.condition]} AND ${q.status === 'fine' ? "s.status = 'fine'" : 's.status IS NULL'}${search ? " AND ff_fold(p.title) LIKE ? ESCAPE '\\'" : ''}${q.year ? ' AND substr(p.date_taken, 1, 4) = ?' : ''}`
  const base = `FROM photo_meta p LEFT JOIN photo_health_state s ON s.photo_id = p.photo_id AND s.condition = ? WHERE ${filter}`
  const params: (string | number)[] = [q.condition]
  if (search) params.push(`%${foldAccents(search).toLowerCase().replace(/[\\%_]/g, m => '\\' + m)}%`)
  if (q.year) params.push(q.year)
  const total = (db.prepare(`SELECT COUNT(*) AS n ${base}`).get(...params) as { n: number }).n
  const raw = db.prepare(`SELECT p.photo_id, p.title, p.thumb_url, p.date_taken, s.status ${base} ORDER BY p.date_taken DESC, p.photo_id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Row[]
  const owner = ownerNsid()
  return {
    total,
    rows: raw.map(r => ({
      photoId: r.photo_id,
      title: r.title,
      thumbUrl: r.thumb_url,
      dateTaken: r.date_taken,
      kind: q.condition === 'title' ? (r.title.trim() === '' ? 'No title' : 'Camera-file title') : '',
      flickrUrl: owner ? `https://www.flickr.com/photos/${owner}/${r.photo_id}` : `https://www.flickr.com/photo.gne?id=${r.photo_id}`,
      status: r.status === 'fine' ? 'fine' : 'open'
    }))
  }
}

export function healthList(q: HealthListQuery): HealthListPage {
  return queryRows(q, Math.min(Math.max(q.limit, 1), 500), Math.max(q.offset, 0))
}

export function healthSet(req: HealthSetRequest): void {
  const db = healthDb()
  if (req.status === 'open') {
    db.prepare('DELETE FROM photo_health_state WHERE photo_id = ? AND condition = ?').run(req.photoId, req.condition)
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
  if (!hasData(db)) return { hasData: false, photos: 0, complete: 0, withGap: 0, twoOrMore: 0, byType: [], byYear: [], clusters: [] }
  // One pass over every photo, counting only gaps that have not been marked fine
  const rows = db.prepare(`
    SELECT substr(p.date_taken, 1, 4) AS y,
      CASE WHEN ${WHERE.title} AND st.status IS NULL THEN 1 ELSE 0 END AS t,
      CASE WHEN ${WHERE.description} AND sd.status IS NULL THEN 1 ELSE 0 END AS d,
      CASE WHEN ${WHERE.tags} AND sg.status IS NULL THEN 1 ELSE 0 END AS g,
      CASE WHEN ${WHERE.location} AND sl.status IS NULL THEN 1 ELSE 0 END AS l
    FROM photo_meta p
    LEFT JOIN photo_health_state st ON st.photo_id = p.photo_id AND st.condition = 'title'
    LEFT JOIN photo_health_state sd ON sd.photo_id = p.photo_id AND sd.condition = 'description'
    LEFT JOIN photo_health_state sg ON sg.photo_id = p.photo_id AND sg.condition = 'tags'
    LEFT JOIN photo_health_state sl ON sl.photo_id = p.photo_id AND sl.condition = 'location'
  `).all() as { y: string; t: number; d: number; g: number; l: number }[]
  const years = new Map<string, { year: string; total: number; anyGap: number; title: number; description: number; tags: number; location: number }>()
  const totals = { title: 0, description: 0, tags: 0, location: 0 }
  let withGap = 0, twoOrMore = 0
  for (const r of rows) {
    const y = r.y || 'Unknown'
    const e = years.get(y) ?? { year: y, total: 0, anyGap: 0, title: 0, description: 0, tags: 0, location: 0 }
    const gaps = r.t + r.d + r.g + r.l
    e.total++; e.title += r.t; e.description += r.d; e.tags += r.g; e.location += r.l
    if (gaps > 0) { e.anyGap++; withGap++ }
    if (gaps > 1) twoOrMore++
    totals.title += r.t; totals.description += r.d; totals.tags += r.g; totals.location += r.l
    years.set(y, e)
  }
  const photos = rows.length
  const byYear = [...years.values()].filter(e => e.year !== 'Unknown').sort((a, b) => a.year.localeCompare(b.year))
  // A cluster is a year where a gap is at least twice as common as in the library overall; the biggest excesses come first
  const clusters: HealthOverview['clusters'] = []
  for (const condition of HEALTH_CONDITIONS) {
    const rate = totals[condition] / Math.max(photos, 1)
    for (const e of byYear) {
      const count = e[condition]
      if (e.total >= 100 && count >= 50 && count / e.total >= 2 * rate) clusters.push({ condition, year: e.year, count, total: e.total })
    }
  }
  const excess = (c: HealthOverview['clusters'][number]): number => c.count - (totals[c.condition] / Math.max(photos, 1)) * c.total
  clusters.sort((a, b) => excess(b) - excess(a))
  return {
    hasData: true, photos, complete: photos - withGap, withGap, twoOrMore,
    byType: HEALTH_CONDITIONS.map(condition => ({ condition, open: totals[condition] })),
    byYear, clusters: clusters.slice(0, 6)
  }
}

export function healthCsvRows(q: HealthExportQuery): string[][] {
  return queryRows(q, 1_000_000, 0).rows.map(r => [csvCell(r.title || '(no title)'), r.dateTaken, r.kind || '', csvCell(r.flickrUrl)])
}

export function registerHealthIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('health:summary', () => healthSummary())
  ipcMain.handle('health:overview', () => healthOverview())
  ipcMain.handle('health:list', (_event, q: HealthListQuery) => healthList(q))
  ipcMain.handle('health:set', (_event, req: HealthSetRequest) => healthSet(req))
  ipcMain.handle('health:saveCsv', (_event, q: HealthExportQuery) =>
    saveCsvFile(getWindow, `photo-health-${q.condition}-${q.status}.csv`, ['Title', 'Date taken', 'Kind', 'Flickr page'], healthCsvRows(q)))
}
