import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { albumsDb } from './albumDb'
import { worldPixel } from '../shared/mapGeo'
import { cleanTag } from '../shared/tags'
import type { MapAccuracy, MapAlbumHit, MapCellPage, MapCellQuery, MapCluster, MapFilter, MapView, MapViewQuery } from '../shared/types'

// The Photo Map (3.10): every photo with a location, kept in memory as plain numbers and grouped into dots and numbered circles for
// whatever part of the world is on screen. Nothing here is fetched from Flickr and nothing is written: it reads the local library list.

export interface MapPoint {
  id: string; lat: number; lon: number
  taken: number       // YYYYMMDD, 0 when unknown
  posted: number      // YYYYMMDD the photo was uploaded, 0 when unknown
  privacy: number     // 0 public, 1 friends, 2 family, 3 friends and family, 4 private
  video: boolean
  acc: number         // Flickr's precision of the location, 1 (world) to 16 (street); 0 when not recorded
}

const CELL_PX = 56          // a circle stands for the photos inside one square of this many pixels
export { worldPixel }

const ymd = (d: Date): number => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()

// The photos that have a usable location. A location at exactly 0, 0 is a failed lookup (Health Check has its own check for it), so it is left off.
export function loadPoints(db: Database.Database): { points: MapPoint[]; photos: number } {
  const photos = (db.prepare('SELECT COUNT(*) AS n FROM photo_meta').get() as { n: number }).n
  const rows = db.prepare('SELECT photo_id, latitude, longitude, date_taken, privacy, media, date_upload, geo_accuracy FROM photo_meta WHERE latitude IS NOT NULL AND longitude IS NOT NULL')
    .all() as { photo_id: string; latitude: number; longitude: number; date_taken: string; privacy: number; media: string; date_upload: number | null; geo_accuracy: number | null }[]
  const points: MapPoint[] = []
  for (const r of rows) {
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude) || (r.latitude === 0 && r.longitude === 0)) continue
    if (Math.abs(r.latitude) > 90 || Math.abs(r.longitude) > 180) continue
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(r.date_taken ?? '')
    const taken = m && Number(m[1]) >= 1900 ? Number(m[1] + m[2] + m[3]) : 0
    const up = typeof r.date_upload === 'number' && r.date_upload > 0 ? new Date(r.date_upload * 1000) : null
    const posted = up && up.getUTCFullYear() >= 1990 ? ymd(up) : 0
    points.push({ id: r.photo_id, lat: r.latitude, lon: r.longitude, taken, posted, privacy: r.privacy ?? 0, video: r.media === 'video', acc: Math.max(0, Math.min(16, r.geo_accuracy ?? 0)) })
  }
  return { points, photos }
}

const accuracyOk = (acc: number, want: MapAccuracy): boolean => (want === 'street' ? acc >= 15 : want === 'town' ? acc >= 11 : acc >= 1 && acc <= 10)

// Every filter has to pass (an album or tag filter arrives as `allow`, the set of photo ids those choices cover)
export const passes = (p: MapPoint, f: MapFilter, allow?: Set<string>): boolean => {
  if (f.media && (f.media === 'video') !== p.video) return false
  if (f.privacy !== undefined && p.privacy !== f.privacy) return false
  if (f.dateFrom !== undefined || f.dateTo !== undefined) {
    const d = f.dateField === 'posted' ? p.posted : p.taken
    if (d === 0 || (f.dateFrom !== undefined && d < f.dateFrom) || (f.dateTo !== undefined && d > f.dateTo)) return false
  }
  if (f.accuracy && !accuracyOk(p.acc, f.accuracy)) return false
  if (allow && !allow.has(p.id)) return false
  return true
}

// The dots and circles for the window: photos are dropped into square cells of CELL_PX pixels at this zoom, and each cell becomes one circle
// (or one dot, when it holds a single photo). A little beyond the window is included so circles at the edge keep their full count.
export function clusterPoints(points: MapPoint[], q: MapViewQuery, allow?: Set<string>): { clusters: MapCluster[]; inView: number; matching: number } {
  const lo = worldPixel(q.north, q.west, q.zoom), hi = worldPixel(q.south, q.east, q.zoom)
  const pad = CELL_PX
  const wraps = q.west > q.east    // the window crosses the date line
  const cells = new Map<string, { n: number; lat: number; lon: number; id: string; cx: number; cy: number }>()
  let inView = 0, matching = 0
  for (const p of points) {
    if (!passes(p, q, allow)) continue
    matching++
    const { x, y } = worldPixel(p.lat, p.lon, q.zoom)
    if (y < lo.y - pad || y > hi.y + pad) continue
    const inX = wraps ? (x >= lo.x - pad || x <= hi.x + pad) : (x >= lo.x - pad && x <= hi.x + pad)
    if (!inX) continue
    if (y >= lo.y && y <= hi.y && (wraps ? (x >= lo.x || x <= hi.x) : (x >= lo.x && x <= hi.x))) inView++
    const cx = Math.floor(x / CELL_PX), cy = Math.floor(y / CELL_PX)
    const key = `${cx}|${cy}`
    const c = cells.get(key)
    if (c) { c.n++; c.lat += p.lat; c.lon += p.lon } else cells.set(key, { n: 1, lat: p.lat, lon: p.lon, id: p.id, cx, cy })
  }
  const clusters: MapCluster[] = []
  for (const c of cells.values()) {
    clusters.push({ lat: c.lat / c.n, lon: c.lon / c.n, count: c.n, cx: c.cx, cy: c.cy, ...(c.n === 1 ? { id: c.id } : {}) })
  }
  return { clusters, inView, matching }
}

// The photos behind one circle, newest first: the same cell the circle was made from
export function cellPhotos(points: MapPoint[], q: MapCellQuery, allow?: Set<string>): MapCellPage {
  const hits: MapPoint[] = []
  for (const p of points) {
    if (!passes(p, q, allow)) continue
    const { x, y } = worldPixel(p.lat, p.lon, q.zoom)
    if (Math.floor(x / CELL_PX) === q.cx && Math.floor(y / CELL_PX) === q.cy) hits.push(p)
  }
  hits.sort((a, b) => b.taken - a.taken || (a.id < b.id ? 1 : -1))
  const offset = Math.max(0, q.offset)
  return { ids: hits.slice(offset, offset + Math.max(1, Math.min(q.limit, 500))).map(p => p.id), total: hits.length }
}

// ── In the app: the points are read once per library update and kept ──
let cache: { stamp: string; points: MapPoint[]; photos: number } | null = null
function current(): { points: MapPoint[]; photos: number; stamp: string } {
  const db = albumsDb()   // makes sure the photo list table exists
  const stamp = (db.prepare("SELECT value FROM tag_index_meta WHERE key = 'last_scan_at'").get() as { value: string } | undefined)?.value ?? ''
  if (!cache || cache.stamp !== stamp) cache = { stamp, ...loadPoints(db) }
  return cache
}

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const date = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v >= 19000101 && v <= 99991231 ? v : undefined)
const strings = (v: unknown, max: number, len: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= len).slice(0, max) : [])

/** Only what the Map understands, in the shape it expects: anything else sent along is dropped. */
export function cleanFilter(f: MapFilter | undefined): MapFilter {
  const g = f ?? {}
  const tags = strings(g.tags, 20, 100), albumIds = strings(g.albumIds, 100, 40)
  const from = date(g.dateFrom), to = date(g.dateTo)
  return {
    ...(g.media === 'photo' || g.media === 'video' ? { media: g.media } : {}),
    ...(g.privacy !== undefined && [0, 1, 2, 3, 4].includes(g.privacy) ? { privacy: g.privacy } : {}),
    ...(from !== undefined || to !== undefined ? { dateField: g.dateField === 'posted' ? 'posted' as const : 'taken' as const } : {}),
    ...(from !== undefined ? { dateFrom: from } : {}), ...(to !== undefined ? { dateTo: to } : {}),
    ...(tags.length ? { tags, tagMode: g.tagMode === 'all' ? 'all' as const : 'any' as const } : {}),
    ...(albumIds.length ? { albumIds } : {}),
    ...(g.accuracy === 'street' || g.accuracy === 'town' || g.accuracy === 'vague' ? { accuracy: g.accuracy } : {})
  }
}

/** The photo ids the album and tag choices cover: albums add up, tags add up (any) or must all be present (all), and the two groups both have to match.
 *  Nothing to restrict by gives undefined, and a choice that matches nothing gives an empty set. */
export function resolveAllow(db: Database.Database, f: MapFilter): Set<string> | undefined {
  const groups: Set<string>[] = []
  if (f.albumIds?.length) {
    const marks = f.albumIds.map(() => '?').join(',')
    groups.push(new Set((db.prepare(`SELECT DISTINCT photo_id FROM album_photo WHERE album_id IN (${marks})`).all(...f.albumIds) as { photo_id: string }[]).map(r => r.photo_id)))
  }
  if (f.tags?.length) {
    const names = [...new Set(f.tags.map(cleanTag).filter(n => n !== ''))]
    if (names.length === 0) groups.push(new Set())
    else {
      const marks = names.map(() => '?').join(',')
      const ids = (db.prepare(`SELECT id FROM tag_names WHERE name IN (${marks})`).all(...names) as { id: number }[]).map(r => r.id)
      if (f.tagMode === 'all' && ids.length < names.length) groups.push(new Set())   // one of the tags does not exist, so nothing carries all of them
      else if (ids.length === 0) groups.push(new Set())
      else {
        const m2 = ids.map(() => '?').join(',')
        const sql = f.tagMode === 'all'
          ? `SELECT photo_id FROM tag_photo WHERE tag_id IN (${m2}) GROUP BY photo_id HAVING COUNT(DISTINCT tag_id) = ${ids.length}`
          : `SELECT DISTINCT photo_id FROM tag_photo WHERE tag_id IN (${m2})`
        groups.push(new Set((db.prepare(sql).all(...ids) as { photo_id: string }[]).map(r => r.photo_id)))
      }
    }
  }
  if (groups.length === 0) return undefined
  const [first, ...rest] = groups
  return new Set([...first].filter(id => rest.every(g => g.has(id))))
}

// The same album and tag choice is asked for again with every move of the map, so the last few answers are kept for this library update
export function makeAllowCache(getDb: () => Database.Database): (f: MapFilter, stamp: string) => Set<string> | undefined {
  let cache: { stamp: string; key: string; set: Set<string> | undefined }[] = []
  return (f, stamp) => {
    if (!f.albumIds?.length && !f.tags?.length) return undefined
    const key = JSON.stringify([[...(f.albumIds ?? [])].sort(), [...(f.tags ?? [])].map(cleanTag).sort(), f.tagMode ?? 'any'])
    const hit = cache.find(c => c.stamp === stamp && c.key === key)
    if (hit) return hit.set
    const set = resolveAllow(getDb(), f)
    cache = [{ stamp, key, set }, ...cache.filter(c => c.stamp === stamp)].slice(0, 8)   // an answer from before the last library update is dropped
    return set
  }
}
const allowFor = makeAllowCache(albumsDb)

export function mapView(q: MapViewQuery): MapView {
  const { points, photos, stamp } = current()
  const f = cleanFilter(q)
  const zoom = Math.max(0, Math.min(20, num(q.zoom, 2)))
  const r = clusterPoints(points, { ...f, west: num(q.west, -180), south: num(q.south, -85), east: num(q.east, 180), north: num(q.north, 85), zoom }, allowFor(f, stamp))
  return { clusters: r.clusters, inView: r.inView, matching: r.matching, located: points.length, photos }
}

export function mapCell(q: MapCellQuery): MapCellPage {
  const { points, stamp } = current()
  const f = cleanFilter(q)
  return cellPhotos(points, { ...f, zoom: Math.max(0, Math.min(20, num(q.zoom, 2))), cx: num(q.cx, 0), cy: num(q.cy, 0), offset: num(q.offset, 0), limit: num(q.limit, 100) }, allowFor(f, stamp))
}

/** Albums whose title contains what was typed (the ones that start with it first), for the album box. */
export function findAlbums(db: Database.Database, text: string): MapAlbumHit[] {
  const t = typeof text === 'string' ? text.trim().slice(0, 80) : ''
  const esc = t.replace(/[\\%_]/g, m => '\\' + m)
  const rows = db.prepare("SELECT id, title, photo_count FROM album WHERE title LIKE ? ESCAPE '\\' ORDER BY (title LIKE ? ESCAPE '\\') DESC, photo_count DESC, title LIMIT 12")
    .all(`%${esc}%`, `${esc}%`) as { id: string; title: string; photo_count: number }[]
  return rows.map(r => ({ id: r.id, title: r.title, count: r.photo_count }))
}

export function registerMapIpc(): void {
  ipcMain.handle('map:view', (_event, q: MapViewQuery) => mapView(q ?? ({} as MapViewQuery)))
  ipcMain.handle('map:cell', (_event, q: MapCellQuery) => mapCell(q ?? ({} as MapCellQuery)))
  ipcMain.handle('map:albums', (_event, text: string) => findAlbums(albumsDb(), text))
}
