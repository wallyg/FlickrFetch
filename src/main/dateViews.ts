import { ipcMain, app, Notification } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import type Database from 'better-sqlite3'
import { getDb, dbGeneration } from './database'
import { loadSettings } from './settings'
import { addPhotoMetaColumns } from './tagIndex'
import { itemsLabel } from '../shared/counts'
import type {
  DayPhoto, DayYearGroup, DayInsights, DayView, DayQuery, DayPhotosQuery, DatePhotoIdsQuery, PrivacyScope, DateExtra,
  TimelineMonths, TimelineDays, TodaySummary, CameraRollQuery, CameraRollView, CameraRollDay
} from '../shared/types'

// On This Day and the Timeline: read-only views over the local photo list (the dates, titles, thumbnails,
// privacy and tags the scan keeps). Nothing here talks to Flickr or changes anything.

const MIN_YEAR = '1900'   // photos with no real date taken are left out

let migrated: Database.Database | null = null
function readyDb(): Database.Database | null {
  const db = getDb()
  if (!db) return null
  const has = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'photo_meta'").get()
  if (!has) return null
  // The card can ask before the Tags tab has ever been opened this session, so make sure the 3.5 columns exist
  if (migrated !== db) { addPhotoMetaColumns(db); migrated = db }
  return db
}

function hasCatalog(db: Database.Database): boolean {
  const row = db.prepare("SELECT value FROM tag_index_meta WHERE key = 'has_catalog_v2'").get() as { value: string } | undefined
  return row?.value === '1'
}

// SQL piece for the public / not public choice; without privacy saved yet, everything counts
function scopeSql(scope: PrivacyScope, catalog: boolean): string {
  if (!catalog || scope === 'all') return ''
  return scope === 'public' ? ' AND p.privacy = 0' : ' AND p.privacy > 0'
}

// Only photos carrying one tag (by its saved name); nothing when no tag is chosen. The name is a bound parameter.
function tagSql(tag?: string): { sql: string; params: string[] } {
  if (typeof tag !== 'string' || tag === '' || tag.length > 300) return { sql: '', params: [] }
  return { sql: ' AND p.photo_id IN (SELECT tp.photo_id FROM tag_photo tp JOIN tag_names n ON n.id = tp.tag_id WHERE n.name = ?)', params: [tag] }
}

// The Photos / Videos switch, the album choice and the privacy level, the same for every date view. Album ids and the level are bound parameters;
// the media column reads 'photo' until a Rebuild has read the media type, so "not a video" counts as a photo. Without privacy saved yet
// (no Rebuild since 3.5) the level is ignored, as the old Public / Not public choice was.
function extraSql(x: DateExtra | undefined, catalog: boolean): { sql: string; params: (string | number)[] } {
  let sql = ''
  const params: (string | number)[] = []
  if (catalog && typeof x?.privacy === 'number' && Number.isInteger(x.privacy) && x.privacy >= 0 && x.privacy <= 4) { sql += ' AND p.privacy = ?'; params.push(x.privacy) }
  if (x?.media === 'video') sql += " AND p.media = 'video'"
  else if (x?.media === 'photo') sql += " AND COALESCE(p.media, 'photo') <> 'video'"
  const ids = Array.isArray(x?.albumIds) ? x.albumIds.filter((a): a is string => typeof a === 'string' && a.length > 0 && a.length <= 40).slice(0, 100) : []
  if (ids.length > 0) {
    sql += ` AND p.photo_id IN (SELECT photo_id FROM album_photo WHERE album_id IN (${ids.map(() => '?').join(',')}))`
    params.push(...ids)
  }
  return { sql, params }
}

// How many photos sit at each privacy level, for the counts beside the privacy choices ('where' leaves the privacy choice itself out)
function levelCounts(db: Database.Database, where: string, params: (string | number)[]): number[] {
  const out = [0, 0, 0, 0, 0]
  const rows = db.prepare(`SELECT p.privacy AS lvl, COUNT(*) AS n FROM photo_meta p WHERE ${where} GROUP BY p.privacy`).all(...params) as { lvl: number; n: number }[]
  for (const r of rows) if (r.lvl >= 0 && r.lvl <= 4) out[r.lvl] += r.n
  return out
}

const pad = (n: number): string => String(n).padStart(2, '0')

// A photo taken today is not a memory, so On This Day for today leaves out the current year
function yearRange(month: number, day: number): string {
  const d = new Date()
  const isToday = d.getMonth() + 1 === month && d.getDate() === day
  return `substr(p.date_taken, 1, 4) >= '${MIN_YEAR}'` + (isToday ? ` AND substr(p.date_taken, 1, 4) <> '${d.getFullYear()}'` : '')
}
const mmdd = (month: number, day: number): string => `${pad(month)}-${pad(day)}`

function neighbour(month: number, day: number, step: number): { month: number; day: number } {
  const d = new Date(2024, month - 1, day + step)   // 2024 is a leap year, so Feb 29 has a place
  return { month: d.getMonth() + 1, day: d.getDate() }
}

function dayCount(db: Database.Database, month: number, day: number, scope: PrivacyScope, catalog: boolean, tag?: string, extra?: DateExtra): number {
  const t = tagSql(tag), x = extraSql(extra, catalog)
  return (db.prepare(`SELECT COUNT(*) AS n FROM photo_meta p WHERE substr(p.date_taken, 6, 5) = ? AND ${yearRange(month, day)}${scopeSql(scope, catalog)}${t.sql}${x.sql}`).get(mmdd(month, day), ...t.params, ...x.params) as { n: number }).n
}

const toPhoto = (r: { photo_id: string; title: string; thumb_url: string; date_taken: string; privacy: number; media: string }): DayPhoto =>
  ({ id: r.photo_id, title: r.title, thumbUrl: r.thumb_url, dateTaken: r.date_taken, privacy: r.privacy, media: r.media === 'video' ? 'video' : 'photo' })
// How many of a group of items are videos (the column is 'photo' until a Rebuild has read the media type)
const VIDEOS = "COALESCE(SUM(p.media = 'video'), 0)"

function insightsFor(db: Database.Database, month: number, day: number, scope: PrivacyScope, catalog: boolean, tag?: string, extra?: DateExtra): DayInsights {
  const md = mmdd(month, day)
  const tg = tagSql(tag), x = extraSql(extra, catalog)
  const where = `substr(p.date_taken, 6, 5) = ? AND ${yearRange(month, day)}${scopeSql(scope, catalog)}${tg.sql}${x.sql}`
  // Most-used tags: tags that sit on exactly the same photos (New York, NY, NYC) count once
  const rows = db.prepare(`
    SELECT n.display AS display, n.name AS name, group_concat(tp.photo_id) AS ids
    FROM photo_meta p JOIN tag_photo tp ON tp.photo_id = p.photo_id JOIN tag_names n ON n.id = tp.tag_id
    WHERE ${where} GROUP BY n.id ORDER BY COUNT(*) DESC LIMIT 24
  `).all(md, ...tg.params, ...x.params) as { display: string | null; name: string; ids: string }[]
  const seen: Set<string>[] = []
  const topTags: { name: string; count: number; key: string }[] = []
  for (const r of rows) {
    const set = new Set(r.ids.split(','))
    if (seen.some(s => s.size === set.size && [...set].every(x => s.has(x)))) continue
    seen.push(set)
    topTags.push({ name: r.display ?? r.name, count: set.size, key: r.name })
    if (topTags.length === 8) break
  }
  const hours = db.prepare(`SELECT CAST(substr(p.date_taken, 12, 2) AS INTEGER) AS hour, COUNT(*) AS n FROM photo_meta p WHERE ${where} AND length(p.date_taken) >= 13 GROUP BY hour ORDER BY n DESC, hour`).all(md, ...tg.params, ...x.params) as { hour: number; n: number }[]
  const loc = db.prepare(`SELECT COALESCE(SUM(p.has_location), 0) AS n FROM photo_meta p WHERE ${where}`).get(md, ...tg.params, ...x.params) as { n: number }
  const hourCounts = Array.from({ length: 24 }, () => 0)
  for (const h of hours) if (h.hour >= 0 && h.hour < 24) hourCounts[h.hour] = h.n
  return { topTags, hourCounts, busiestHours: hours.slice(0, 2).map(h => ({ hour: h.hour, count: h.n })), earliestHour: hours.length ? Math.min(...hours.map(h => h.hour)) : null, latestHour: hours.length ? Math.max(...hours.map(h => h.hour)) : null, withLocation: loc.n }
}

export function dayView(q: DayQuery): DayView {
  const db = readyDb()
  const empty: DayView = {
    hasData: false, hasCatalog: false, month: q.month, day: q.day, scope: q.scope, total: 0, videos: 0,
    counts: { all: 0, public: 0, notPublic: 0 }, levels: [0, 0, 0, 0, 0], years: [],
    insights: { topTags: [], hourCounts: Array.from({ length: 24 }, () => 0), busiestHours: [], earliestHour: null, latestHour: null, withLocation: 0 },
    prev: { month: q.month, day: q.day, count: 0 }, next: { month: q.month, day: q.day, count: 0 }
  }
  if (!db) return empty
  const catalog = hasCatalog(db)
  const scope: PrivacyScope = catalog ? q.scope : 'all'
  const md = mmdd(q.month, q.day)
  const tg = tagSql(q.tag), x = extraSql(q, catalog)
  const where = `substr(p.date_taken, 6, 5) = ? AND ${yearRange(q.month, q.day)}${scopeSql(scope, catalog)}${tg.sql}${x.sql}`
  const perYear = Math.max(1, q.perYear ?? 12)

  const counts = {
    all: dayCount(db, q.month, q.day, 'all', catalog, q.tag, q),
    public: catalog ? dayCount(db, q.month, q.day, 'public', catalog, q.tag, q) : 0,
    notPublic: catalog ? dayCount(db, q.month, q.day, 'notpublic', catalog, q.tag, q) : 0
  }
  const yearRows = db.prepare(`SELECT substr(p.date_taken, 1, 4) AS year, COUNT(*) AS n, ${VIDEOS} AS v FROM photo_meta p WHERE ${where} GROUP BY year ORDER BY year DESC`).all(md, ...tg.params, ...x.params) as { year: string; n: number; v: number }[]
  const pick = db.prepare(`SELECT p.photo_id, p.title, p.thumb_url, p.date_taken, p.privacy, p.media FROM photo_meta p WHERE ${where} AND substr(p.date_taken, 1, 4) = ? ORDER BY p.date_taken, p.photo_id LIMIT ?`)
  const years: DayYearGroup[] = yearRows.map(y => ({
    year: y.year, count: y.n, videos: y.v,
    photos: (pick.all(md, ...tg.params, ...x.params, y.year, perYear) as Parameters<typeof toPhoto>[0][]).map(toPhoto)
  }))
  const prev = neighbour(q.month, q.day, -1), next = neighbour(q.month, q.day, 1)
  return {
    hasData: db.prepare('SELECT 1 FROM photo_meta LIMIT 1').get() !== undefined,
    hasCatalog: catalog, month: q.month, day: q.day, scope, total: yearRows.reduce((n, y) => n + y.n, 0), videos: yearRows.reduce((n, y) => n + y.v, 0),
    counts, levels: catalog ? levelCounts(db, `substr(p.date_taken, 6, 5) = ? AND ${yearRange(q.month, q.day)}${tg.sql}${extraSql({ ...q, privacy: undefined }, catalog).sql}`, [md, ...tg.params, ...extraSql({ ...q, privacy: undefined }, catalog).params]) : [0, 0, 0, 0, 0],
    years, insights: insightsFor(db, q.month, q.day, scope, catalog, q.tag, q),
    prev: { ...prev, count: dayCount(db, prev.month, prev.day, scope, catalog, undefined, q) },   // the arrow counts follow the switches (privacy, Photos / Videos, album), not the tag
    next: { ...next, count: dayCount(db, next.month, next.day, scope, catalog, undefined, q) }
  }
}

// More photos of one year of a day (for "Show all")
export function dayPhotos(q: DayPhotosQuery): DayPhoto[] {
  const db = readyDb()
  if (!db) return []
  const catalog = hasCatalog(db)
  const tg = tagSql(q.tag), x = extraSql(q, catalog)
  return (db.prepare(`
    SELECT p.photo_id, p.title, p.thumb_url, p.date_taken, p.privacy, p.media FROM photo_meta p
    WHERE substr(p.date_taken, 6, 5) = ? AND substr(p.date_taken, 1, 4) = ?${scopeSql(q.scope, catalog)}${tg.sql}${x.sql}
    ORDER BY p.date_taken, p.photo_id LIMIT ? OFFSET ?
  `).all(mmdd(q.month, q.day), q.year, ...tg.params, ...x.params, Math.min(Math.max(q.limit, 1), 1000), Math.max(q.offset, 0)) as Parameters<typeof toPhoto>[0][]).map(toPhoto)
}

// Ids and titles for downloading a day (one year or all years) or a range of dates
export function datePhotoIds(q: DatePhotoIdsQuery): { id: string; title: string }[] {
  const db = readyDb()
  if (!db) return []
  const catalog = hasCatalog(db)
  const scope = scopeSql(q.scope, catalog)
  const tg = tagSql(q.kind === 'day' ? q.tag : undefined), x = extraSql(q, catalog)
  const rows = q.kind === 'day'
    ? db.prepare(`SELECT p.photo_id AS id, p.title FROM photo_meta p WHERE substr(p.date_taken, 6, 5) = ? AND ${q.year ? 'substr(p.date_taken, 1, 4) = ?' : yearRange(q.month, q.day)}${scope}${tg.sql}${x.sql} ORDER BY p.date_taken`)
        .all(...(q.year ? [mmdd(q.month, q.day), q.year] : [mmdd(q.month, q.day)]), ...tg.params, ...x.params)
    : db.prepare(`SELECT p.photo_id AS id, p.title FROM photo_meta p WHERE substr(p.date_taken, 1, 10) >= ? AND substr(p.date_taken, 1, 10) <= ?${scope}${x.sql} ORDER BY p.date_taken`)
        .all(q.from, q.to, ...x.params)
  return rows as { id: string; title: string }[]
}

export function timelineMonths(scope: PrivacyScope, extra?: DateExtra): TimelineMonths {
  const db = readyDb()
  if (!db) return { hasData: false, hasCatalog: false, scope, total: 0, cells: [], counts: { all: 0, public: 0, notPublic: 0 }, levels: [0, 0, 0, 0, 0] }
  const catalog = hasCatalog(db)
  const eff: PrivacyScope = catalog ? scope : 'all'
  const x = extraSql(extra, catalog)
  const cells = db.prepare(`SELECT CAST(substr(p.date_taken, 1, 4) AS INTEGER) AS year, CAST(substr(p.date_taken, 6, 2) AS INTEGER) AS month, COUNT(*) AS n, ${VIDEOS} AS v
    FROM photo_meta p WHERE substr(p.date_taken, 1, 4) >= '${MIN_YEAR}'${scopeSql(eff, catalog)}${x.sql} GROUP BY year, month`).all(...x.params) as { year: number; month: number; n: number; v: number }[]
  const one = (s: string): number => (db.prepare(`SELECT COUNT(*) AS n FROM photo_meta p WHERE substr(p.date_taken, 1, 4) >= '${MIN_YEAR}'${s}${x.sql}`).get(...x.params) as { n: number }).n
  return {
    hasData: cells.length > 0, hasCatalog: catalog, scope: eff, total: cells.reduce((n, c) => n + c.n, 0),
    cells: cells.map(c => ({ year: c.year, month: c.month, count: c.n, videos: c.v })),
    counts: { all: one(''), public: catalog ? one(scopeSql('public', true)) : 0, notPublic: catalog ? one(scopeSql('notpublic', true)) : 0 },
    levels: catalog ? levelCounts(db, `substr(p.date_taken, 1, 4) >= '${MIN_YEAR}'${extraSql({ ...extra, privacy: undefined }, catalog).sql}`, extraSql({ ...extra, privacy: undefined }, catalog).params) : [0, 0, 0, 0, 0]
  }
}

export function timelineDays(year: number, month: number, scope: PrivacyScope, extra?: DateExtra): TimelineDays {
  const db = readyDb()
  if (!db) return { year, month, days: [] }
  const catalog = hasCatalog(db)
  const x = extraSql(extra, catalog)
  const days = db.prepare(`SELECT CAST(substr(p.date_taken, 9, 2) AS INTEGER) AS day, COUNT(*) AS n, ${VIDEOS} AS v FROM photo_meta p
    WHERE substr(p.date_taken, 1, 7) = ?${scopeSql(scope, catalog)}${x.sql} GROUP BY day ORDER BY day`).all(`${year}-${pad(month)}`, ...x.params) as { day: number; n: number; v: number }[]
  return { year, month, days: days.map(d => ({ day: d.day, count: d.n, videos: d.v })) }
}

// The photos between two dates in calendar order, grouped by day. Days are paged (offset and limit count days),
// so a long range loads a screenful at a time.
export function cameraRoll(q: CameraRollQuery): CameraRollView {
  const empty: CameraRollView = { hasData: false, hasCatalog: false, scope: q.scope, totalDays: 0, totalPhotos: 0, totalVideos: 0, days: [] }
  const db = readyDb()
  if (!db) return empty
  const catalog = hasCatalog(db)
  const x = extraSql(q, catalog)
  const scope = scopeSql(q.scope, catalog) + x.sql   // the privacy scope and the Photos / Videos and album choices, as one piece of SQL
  const dir = q.order === 'asc' ? 'ASC' : 'DESC'
  const range = `substr(p.date_taken, 1, 4) >= '${MIN_YEAR}' AND substr(p.date_taken, 1, 10) >= ? AND substr(p.date_taken, 1, 10) <= ?${scope}`
  const totals = db.prepare(`SELECT COUNT(DISTINCT substr(p.date_taken, 1, 10)) AS d, COUNT(*) AS n, ${VIDEOS} AS v FROM photo_meta p WHERE ${range}`).get(q.from, q.to, ...x.params) as { d: number; n: number; v: number }
  const dayRows = db.prepare(`SELECT substr(p.date_taken, 1, 10) AS d, COUNT(*) AS n, ${VIDEOS} AS v FROM photo_meta p WHERE ${range} GROUP BY d ORDER BY d ${dir} LIMIT ? OFFSET ?`)
    .all(q.from, q.to, ...x.params, Math.min(Math.max(q.limit, 1), 62), Math.max(q.offset, 0)) as { d: string; n: number; v: number }[]
  const days: CameraRollDay[] = []
  if (dayRows.length > 0) {
    const lo = dayRows.reduce((a, r) => (r.d < a ? r.d : a), dayRows[0].d), hi = dayRows.reduce((a, r) => (r.d > a ? r.d : a), dayRows[0].d)
    // At most 600 photos per day come out of SQLite (a day with thousands would otherwise all be loaded for every page)
    const rows = db.prepare(`SELECT photo_id, title, thumb_url, date_taken, privacy, media FROM (
        SELECT p.photo_id, p.title, p.thumb_url, p.date_taken, p.privacy, p.media,
          ROW_NUMBER() OVER (PARTITION BY substr(p.date_taken, 1, 10) ORDER BY p.date_taken ${dir}, p.photo_id ${dir}) AS rn
        FROM photo_meta p WHERE substr(p.date_taken, 1, 4) >= '${MIN_YEAR}' AND substr(p.date_taken, 1, 10) >= ? AND substr(p.date_taken, 1, 10) <= ?${scope}
      ) WHERE rn <= 600 ORDER BY date_taken ${dir}, photo_id ${dir}`)
      .all(lo, hi, ...x.params) as Parameters<typeof toPhoto>[0][]
    const byDay = new Map<string, DayPhoto[]>()
    for (const r of rows) { const d = r.date_taken.slice(0, 10); const a = byDay.get(d) ?? []; a.push(toPhoto(r)); byDay.set(d, a) }
    for (const r of dayRows) days.push({ date: r.d, count: r.n, videos: r.v, photos: byDay.get(r.d) ?? [] })
  }
  return { hasData: totals.n > 0, hasCatalog: catalog, scope: catalog ? q.scope : 'all', totalDays: totals.d, totalPhotos: totals.n, totalVideos: totals.v, days }
}

// ── Today's summary, the card and the daily notification ─────────────────────

function today(): { month: number; day: number; key: string } {
  const d = new Date()
  return { month: d.getMonth() + 1, day: d.getDate(), key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
}

// The photo figures change only with a new day or a finished scan, so they are kept; the card is asked for on every
// window focus, and the switches (hidden today, card on or off, notification) are always read fresh.
let summaryCache: { key: string; core: Omit<TodaySummary, 'cardHidden' | 'cardEnabled' | 'notifyEnabled'> } | null = null

export function todaySummary(): TodaySummary {
  const t = today()
  const db = getDb()
  const scanned = db ? (db.prepare("SELECT value FROM tag_index_meta WHERE key = 'last_scan_at'").get() as { value: string } | undefined)?.value ?? '' : ''
  const key = `${t.key}|${scanned}|${dbGeneration()}`
  if (!summaryCache || summaryCache.key !== key) {
    const v = dayView({ month: t.month, day: t.day, scope: 'all', perYear: 1 })
    const top = [...v.years].sort((a, b) => b.count - a.count)[0]
    summaryCache = {
      key,
      core: {
        month: t.month, day: t.day, total: v.total, videos: v.videos, yearCount: v.years.length,
        firstYear: v.years.length ? v.years[v.years.length - 1].year : '',
        lastYear: v.years.length ? v.years[0].year : '',
        topYear: top ? { year: top.year, count: top.count } : null,
        topTags: v.insights.topTags.slice(0, 6),
        years: [...v.years].reverse().map(y => ({ year: y.year, count: y.count })),
        thumbs: [...v.years].sort((a, b) => b.count - a.count).slice(0, 3).map(y => y.photos[0]?.thumbUrl).filter((u): u is string => !!u)
      }
    }
  }
  return {
    ...summaryCache.core,
    cardHidden: readState().cardHiddenFor === t.key,
    cardEnabled: loadSettings().onThisDayCard !== false,
    notifyEnabled: loadSettings().onThisDayNotify === true
  }
}

interface OtdState { lastNotified?: string; cardHiddenFor?: string }
const stateFile = (): string => join(app.getPath('userData'), 'on-this-day.json')
function readState(): OtdState {
  try { return existsSync(stateFile()) ? JSON.parse(readFileSync(stateFile(), 'utf-8')) as OtdState : {} } catch { return {} }
}
function writeState(s: OtdState): void {
  try { writeFileSync(stateFile(), JSON.stringify(s)) } catch { /* not worth stopping for */ }
}

let timer: ReturnType<typeof setInterval> | null = null

// One notification a day at most, only when the switch is on and there are photos for today
export function maybeNotifyToday(getWindow: () => BrowserWindow | null): void {
  if (loadSettings().onThisDayNotify !== true || !Notification.isSupported()) return
  const t = today()
  const state = readState()
  if (state.lastNotified === t.key) return
  const s = todaySummary()
  if (s.total === 0) return
  writeState({ ...state, lastNotified: t.key })
  const range = s.firstYear && s.lastYear && s.firstYear !== s.lastYear ? `${s.firstYear} to ${s.lastYear}` : s.lastYear
  const body = `From ${s.yearCount} year${s.yearCount === 1 ? '' : 's'} of your photostream, ${range}. Click to see them.`
  const n = new Notification({ title: `On this day: ${itemsLabel(s.total, s.videos)}`, body })
  n.on('click', () => {
    const win = getWindow()
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); win.webContents.send('otd:open') }
  })
  n.show()
}

export function registerDatesIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('dates:day', (_e, q: DayQuery) => dayView(q))
  ipcMain.handle('dates:dayPhotos', (_e, q: DayPhotosQuery) => dayPhotos(q))
  ipcMain.handle('dates:photoIds', (_e, q: DatePhotoIdsQuery) => datePhotoIds(q))
  ipcMain.handle('dates:months', (_e, scope: PrivacyScope, extra?: DateExtra) => timelineMonths(scope, extra))
  ipcMain.handle('dates:days', (_e, year: number, month: number, scope: PrivacyScope, extra?: DateExtra) => timelineDays(year, month, scope, extra))
  ipcMain.handle('dates:camera', (_e, q: CameraRollQuery) => cameraRoll(q))
  ipcMain.handle('dates:today', () => todaySummary())
  ipcMain.handle('dates:hideCardToday', () => { writeState({ ...readState(), cardHiddenFor: today().key }) })
  // Check shortly after launch, then every half hour (so an app left running past midnight still notices a new day)
  setTimeout(() => maybeNotifyToday(getWindow), 8000)
  if (!timer) timer = setInterval(() => maybeNotifyToday(getWindow), 30 * 60 * 1000)
}
