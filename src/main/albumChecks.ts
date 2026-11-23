import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { getDb } from './database'
import { ownerNsid } from './owner'
import { csvCell, saveCsvFile } from './csv'
import { foldAccents } from '../shared/tags'
import { PHOTO_META_DDL, addPhotoMetaColumns } from './tagIndex'
import { ALBUMS_DDL } from './albumSync'
import { ALBUM_CONDITIONS } from '../shared/healthChecks'
import type {
  AlbumCondition, AlbumExportQuery, AlbumItem, AlbumListPage, AlbumListQuery, AlbumSetRequest, AlbumSort, AlbumSummary
} from '../shared/types'

// Album checks (3.7): albums and photos that look wrong, from the local album list the scan keeps. Read-only; nothing here changes Flickr.
//   Photos in no album is a list of photos; every other check is a list of albums.

let ready: Database.Database | null = null
function albumsDb(): Database.Database {
  const db = getDb()
  if (!db) throw new Error('Database is not open')
  if (ready !== db) {
    db.exec(PHOTO_META_DDL)
    addPhotoMetaColumns(db)
    db.exec(ALBUMS_DDL)
    db.function('ff_fold', { deterministic: true }, (t: unknown) => (typeof t === 'string' ? foldAccents(t).toLowerCase() : ''))
    ready = db
  }
  return db
}

const NO_ALBUM = 'noAlbum' as const

// The SQL test for each album check, on an album row aliased a
const ALBUM_WHERE: Record<Exclude<AlbumCondition, 'noAlbum'>, string> = {
  empty: 'a.photo_count = 0',
  oneItem: 'a.photo_count = 1',
  noDesc: "trim(a.description) = ''",
  noCollection: 'a.in_collection = 0',
  dupTitle: "lower(trim(a.title)) IN (SELECT lower(trim(title)) FROM album GROUP BY lower(trim(title)) HAVING COUNT(*) > 1)"
}
const PHOTO_WHERE = 'p.photo_id NOT IN (SELECT photo_id FROM album_photo)'

const ALBUM_ORDER: Record<AlbumSort, string> = {
  newest: 'a.date_create DESC, a.id DESC',
  oldest: 'a.date_create ASC, a.id ASC',
  title: 'ff_fold(a.title), a.id',
  titleDesc: 'ff_fold(a.title) DESC, a.id DESC'
}
// Photos with no title or no date go last
const PHOTO_ORDER: Record<AlbumSort, string> = {
  newest: 'p.date_taken DESC, p.photo_id DESC',
  oldest: "(p.date_taken = ''), p.date_taken ASC, p.photo_id ASC",
  title: "(p.title = ''), ff_fold(p.title), p.photo_id DESC",
  titleDesc: "(p.title = ''), ff_fold(p.title) DESC, p.photo_id DESC"
}

function hasData(db: Database.Database): boolean {
  return (db.prepare("SELECT value FROM tag_index_meta WHERE key = 'has_albums_37'").get() as { value: string } | undefined)?.value === '1'
}

export function albumSummary(): AlbumSummary {
  const db = albumsDb()
  if (!hasData(db)) return { hasData: false, albums: 0, photos: 0, scannedAt: null, rows: [] }
  const one = (sql: string, ...params: string[]): number => (db.prepare(sql).get(...params) as { n: number }).n
  const rows = ALBUM_CONDITIONS.map(condition => {
    if (condition === NO_ALBUM) {
      const base = `FROM photo_meta p LEFT JOIN photo_health_state s ON s.photo_id = p.photo_id AND s.condition = ? WHERE ${PHOTO_WHERE}`
      return { condition, open: one(`SELECT COUNT(*) AS n ${base} AND s.status IS NULL`, condition), fine: one(`SELECT COUNT(*) AS n ${base} AND s.status = 'fine'`, condition) }
    }
    const base = `FROM album a LEFT JOIN album_health_state s ON s.album_id = a.id AND s.condition = ? WHERE ${ALBUM_WHERE[condition]}`
    return { condition, open: one(`SELECT COUNT(*) AS n ${base} AND s.status IS NULL`, condition), fine: one(`SELECT COUNT(*) AS n ${base} AND s.status = 'fine'`, condition) }
  })
  const scanned = (db.prepare("SELECT value FROM tag_index_meta WHERE key = 'albums_scanned_at'").get() as { value: string } | undefined)?.value
  return { hasData: true, albums: one('SELECT COUNT(*) AS n FROM album'), photos: one('SELECT COUNT(*) AS n FROM photo_meta'), scannedAt: scanned ? Number(scanned) : null, rows }
}

const month = (seconds: number | null): string => (seconds ? new Date(seconds * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '')
const plural = (n: number, one: string, many: string): string => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

interface PhotoRow { photo_id: string; title: string; thumb_url: string; date_taken: string; status: string | null }
interface AlbumRow { id: string; title: string; thumb_url: string; photo_count: number; date_create: number | null; same: number; status: string | null }

function query(q: AlbumExportQuery, limit: number, offset: number): AlbumListPage {
  const db = albumsDb()
  const owner = ownerNsid()
  const search = (q.search ?? '').trim()
  const like = search ? `%${foldAccents(search).toLowerCase().replace(/[\\%_]/g, m => '\\' + m)}%` : ''
  const statusSql = q.status === 'fine' ? "s.status = 'fine'" : 's.status IS NULL'
  const sort = q.sort ?? 'newest'

  if (q.condition === NO_ALBUM) {
    const base = `FROM photo_meta p LEFT JOIN photo_health_state s ON s.photo_id = p.photo_id AND s.condition = ? WHERE ${PHOTO_WHERE} AND ${statusSql}${search ? " AND ff_fold(p.title) LIKE ? ESCAPE '\\'" : ''}`
    const params: string[] = [q.condition, ...(search ? [like] : [])]
    const total = (db.prepare(`SELECT COUNT(*) AS n ${base}`).get(...params) as { n: number }).n
    const raw = db.prepare(`SELECT p.photo_id, p.title, p.thumb_url, p.date_taken, s.status ${base} ORDER BY ${PHOTO_ORDER[sort]} LIMIT ? OFFSET ?`).all(...params, limit, offset) as PhotoRow[]
    return {
      total,
      rows: raw.map((r): AlbumItem => ({
        id: r.photo_id, title: r.title, thumbUrl: r.thumb_url, isPhoto: true,
        detail: r.date_taken ? `Taken ${r.date_taken.slice(0, 10)}` : 'No date taken',
        flickrUrl: owner ? `https://www.flickr.com/photos/${owner}/${r.photo_id}` : `https://www.flickr.com/photo.gne?id=${r.photo_id}`,
        status: r.status === 'fine' ? 'fine' : 'open'
      }))
    }
  }

  const base = `FROM album a LEFT JOIN album_health_state s ON s.album_id = a.id AND s.condition = ? WHERE ${ALBUM_WHERE[q.condition]} AND ${statusSql}${search ? " AND ff_fold(a.title) LIKE ? ESCAPE '\\'" : ''}`
  const params: string[] = [q.condition, ...(search ? [like] : [])]
  const total = (db.prepare(`SELECT COUNT(*) AS n ${base}`).get(...params) as { n: number }).n
  const raw = db.prepare(`SELECT a.id, a.title, a.thumb_url, a.photo_count, a.date_create,
      (SELECT COUNT(*) FROM album b WHERE lower(trim(b.title)) = lower(trim(a.title))) AS same, s.status ${base} ORDER BY ${ALBUM_ORDER[sort]} LIMIT ? OFFSET ?`).all(...params, limit, offset) as AlbumRow[]
  return {
    total,
    rows: raw.map((r): AlbumItem => {
      const parts = [plural(r.photo_count, 'photo', 'photos')]
      if (r.date_create) parts.push(`created ${month(r.date_create)}`)
      if (q.condition === 'noCollection') parts.push('not in a collection')
      if (q.condition === 'noDesc') parts.push('no description')
      if (q.condition === 'dupTitle') parts.push(`${r.same} albums share this title`)
      return {
        id: r.id, title: r.title || '(no title)', thumbUrl: r.thumb_url, isPhoto: false, detail: parts.join(' · '),
        flickrUrl: owner ? `https://www.flickr.com/photos/${owner}/albums/${r.id}` : `https://www.flickr.com/photos/me/albums/${r.id}`,
        status: r.status === 'fine' ? 'fine' : 'open'
      }
    })
  }
}

export function albumList(q: AlbumListQuery): AlbumListPage {
  return query(q, Math.min(Math.max(q.limit, 1), 500), Math.max(q.offset, 0))
}

// Every photo id in a Photos in no album list (not just the page on screen), for the batch editor
export function albumPhotoIds(q: AlbumExportQuery): string[] {
  if (q.condition !== NO_ALBUM) return []
  const db = albumsDb()
  const search = (q.search ?? '').trim()
  const like = search ? `%${foldAccents(search).toLowerCase().replace(/[\\%_]/g, m => '\\' + m)}%` : ''
  const sql = `SELECT p.photo_id FROM photo_meta p LEFT JOIN photo_health_state s ON s.photo_id = p.photo_id AND s.condition = ?
    WHERE ${PHOTO_WHERE} AND ${q.status === 'fine' ? "s.status = 'fine'" : 's.status IS NULL'}${search ? " AND ff_fold(p.title) LIKE ? ESCAPE '\\'" : ''} ORDER BY ${PHOTO_ORDER[q.sort ?? 'newest']}`
  return (db.prepare(sql).all(q.condition, ...(search ? [like] : [])) as { photo_id: string }[]).map(r => r.photo_id)
}

export function albumSet(req: AlbumSetRequest): void {
  const db = albumsDb()
  const table = req.condition === NO_ALBUM ? 'photo_health_state' : 'album_health_state'
  const key = req.condition === NO_ALBUM ? 'photo_id' : 'album_id'
  if (req.status === 'open') {
    db.prepare(`DELETE FROM ${table} WHERE ${key} = ? AND condition = ?`).run(req.id, req.condition)
  } else {
    db.prepare(`INSERT INTO ${table} (${key}, condition, status, updated_at) VALUES (?, ?, 'fine', ?)
      ON CONFLICT(${key}, condition) DO UPDATE SET status = 'fine', updated_at = excluded.updated_at`).run(req.id, req.condition, Date.now())
  }
}

function csvRows(q: AlbumExportQuery): string[][] {
  return query(q, 1_000_000, 0).rows.map(r => [csvCell(r.title || '(no title)'), r.detail, csvCell(r.flickrUrl)])
}

export function registerAlbumsIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('albums:summary', () => albumSummary())
  ipcMain.handle('albums:list', (_event, q: AlbumListQuery) => albumList(q))
  ipcMain.handle('albums:ids', (_event, q: AlbumExportQuery) => albumPhotoIds(q))
  ipcMain.handle('albums:set', (_event, req: AlbumSetRequest) => albumSet(req))
  ipcMain.handle('albums:saveCsv', (_event, q: AlbumExportQuery) =>
    saveCsvFile(getWindow, `albums-${q.condition}-${q.status}.csv`, ['Title', 'Details', 'Flickr page'], csvRows(q)))
}
