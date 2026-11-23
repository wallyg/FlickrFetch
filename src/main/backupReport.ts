import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { getDb } from './database'
import { ownerNsid } from './owner'
import { foldAccents } from '../shared/tags'
import { PHOTO_META_DDL, addPhotoMetaColumns } from './tagIndex'
import type { BackupList, BackupQuery, BackupSort, BackupSummary, HealthListPage, HealthPhoto } from '../shared/types'

// Backup report: how much of the library has been downloaded, from FlickrFetch's own records only (nothing is asked of Flickr).
//   Not downloaded: no download record.
//   New since last download: uploaded after the most recent download, and not downloaded.
//   Changed since download: Flickr's last-update time at the latest scan is newer than it was when the photo was downloaded.
//     A record with no saved update time (older downloads) cannot be judged, so it is counted apart.
//   Saved smaller than the original: the original was asked for and Flickr gave a smaller size (free accounts). Sizes are saved
//     from 3.6 on, so earlier downloads have an unknown size and are counted apart.

let ready: Database.Database | null = null
function backupDb(): Database.Database {
  const db = getDb()
  if (!db) throw new Error('Database is not open')
  if (ready !== db) {
    db.exec(PHOTO_META_DDL)
    addPhotoMetaColumns(db)
    db.function('ff_fold', { deterministic: true }, (t: unknown) => (typeof t === 'string' ? foldAccents(t).toLowerCase() : ''))
    ready = db
  }
  return db
}

const NOT_DOWNLOADED = 'p.photo_id NOT IN (SELECT photo_id FROM photo_download_record)'

function lastDownloadAt(db: Database.Database): number | null {
  const row = db.prepare('SELECT MAX(last_downloaded_at) AS t FROM photo_download_record').get() as { t: number | null }
  return row.t ?? null
}

// The SQL test for one list, on photo_meta rows aliased p (the changed list also joins the download record as d and the scan as t)
function listParts(db: Database.Database, list: BackupList): { from: string; where: string; params: number[] } {
  if (list === 'not') return { from: 'photo_meta p', where: NOT_DOWNLOADED, params: [] }
  if (list === 'new') {
    const last = lastDownloadAt(db)
    return { from: 'photo_meta p', where: `${NOT_DOWNLOADED} AND p.date_upload > ?`, params: [last === null ? Number.MAX_SAFE_INTEGER : Math.floor(last / 1000)] }
  }
  if (list === 'smaller') return { from: 'photo_meta p JOIN photo_download_record d ON d.photo_id = p.photo_id', where: 'd.size_limited = 1', params: [] }
  return {
    from: 'photo_meta p JOIN photo_download_record d ON d.photo_id = p.photo_id JOIN tag_indexed_photo t ON t.photo_id = p.photo_id',
    where: 'd.flickr_last_update > 0 AND t.last_update > d.flickr_last_update', params: []
  }
}

export function backupSummary(): BackupSummary {
  const db = backupDb()
  const count = (sql: string, ...params: number[]): number => (db.prepare(sql).get(...params) as { n: number }).n
  const library = count('SELECT COUNT(*) AS n FROM photo_meta')
  if (library === 0) return { hasData: false, library: 0, downloaded: 0, notDownloaded: 0, lastDownloadAt: null, newSince: 0, changed: 0, unknownUpdate: 0, smaller: 0, sizeUnknown: 0 }
  const parts = (l: BackupList): ReturnType<typeof listParts> => listParts(db, l)
  const n = (l: BackupList): number => { const q = parts(l); return count(`SELECT COUNT(*) AS n FROM ${q.from} WHERE ${q.where}`, ...q.params) }
  const notDownloaded = n('not')
  return {
    hasData: true, library, notDownloaded, downloaded: library - notDownloaded,
    lastDownloadAt: lastDownloadAt(db), newSince: n('new'), changed: n('changed'),
    unknownUpdate: count('SELECT COUNT(*) AS n FROM photo_meta p JOIN photo_download_record d ON d.photo_id = p.photo_id WHERE d.flickr_last_update = 0'),
    smaller: n('smaller'),
    sizeUnknown: count("SELECT COUNT(*) AS n FROM photo_meta p JOIN photo_download_record d ON d.photo_id = p.photo_id WHERE d.size_label = ''")
  }
}

interface Row { photo_id: string; title: string; thumb_url: string; date_taken: string; privacy: number; media: string }

const BACKUP_ORDER: Record<BackupSort, string> = {
  uploaded: 'p.date_upload DESC, p.photo_id DESC',
  uploadedOldest: 'p.date_upload ASC, p.photo_id ASC',
  taken: "p.date_taken DESC, p.photo_id DESC",
  title: "(p.title = ''), ff_fold(p.title), p.photo_id DESC",   // empty titles last
  titleDesc: "(p.title = ''), ff_fold(p.title) DESC, p.photo_id DESC"
}

function query(q: Omit<BackupQuery, 'offset' | 'limit'>, limit: number, offset: number): { rows: Row[]; total: number } {
  const db = backupDb()
  const parts = listParts(db, q.list)
  const search = (q.search ?? '').trim()
  const where = `${parts.where}${search ? " AND ff_fold(p.title) LIKE ? ESCAPE '\\'" : ''}`
  const params: (string | number)[] = [...parts.params]
  if (search) params.push(`%${foldAccents(search).toLowerCase().replace(/[\\%_]/g, m => '\\' + m)}%`)
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM ${parts.from} WHERE ${where}`).get(...params) as { n: number }).n
  const rows = db.prepare(`SELECT p.photo_id, p.title, p.thumb_url, p.date_taken, p.privacy, p.media FROM ${parts.from} WHERE ${where} ORDER BY ${BACKUP_ORDER[q.sort ?? 'uploaded']} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Row[]
  return { rows, total }
}

export function backupList(q: BackupQuery): HealthListPage {
  const { rows, total } = query(q, Math.min(Math.max(q.limit, 1), 500), Math.max(q.offset, 0))
  const owner = ownerNsid()
  return {
    total,
    rows: rows.map((r): HealthPhoto => ({
      photoId: r.photo_id, title: r.title, thumbUrl: r.thumb_url, dateTaken: r.date_taken,
      kind: `${r.media === 'video' ? 'Video · ' : ''}${r.privacy === 0 ? 'Public' : 'Not public'}`,
      flickrUrl: owner ? `https://www.flickr.com/photos/${owner}/${r.photo_id}` : `https://www.flickr.com/photo.gne?id=${r.photo_id}`,
      status: 'open'
    }))
  }
}

// Every photo in a list (ids and titles), for "Download these N" and the batch editor
export function backupPhotos(q: Omit<BackupQuery, 'offset' | 'limit'>): { id: string; title: string }[] {
  return query(q, 10_000_000, 0).rows.map(r => ({ id: r.photo_id, title: r.title }))
}

export function registerBackupIpc(): void {
  ipcMain.handle('backup:summary', () => backupSummary())
  ipcMain.handle('backup:list', (_event, q: BackupQuery) => backupList(q))
  ipcMain.handle('backup:photos', (_event, q: Omit<BackupQuery, 'offset' | 'limit'>) => backupPhotos(q))
}
