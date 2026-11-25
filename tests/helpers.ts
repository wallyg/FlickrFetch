import Database from 'better-sqlite3'
import { PHOTO_META_DDL, addPhotoMetaColumns } from '../src/main/tagIndex'
import { ALBUMS_DDL } from '../src/main/albumSync'

// An empty in-memory copy of the tables the checks read, built from the app's own table definitions so a test can never drift from the real schema
export function memoryDb(): Database.Database {
  const db = new Database(':memory:')
  libraryTables(db)
  return db
}
// Every table the checks read: tags, photos and albums
export function libraryTables(db: Database.Database): void {
  tagTables(db)
  db.exec(PHOTO_META_DDL)
  addPhotoMetaColumns(db)
  db.exec(ALBUMS_DDL)
}

// The tag tables the tag checks read (the app creates these itself when it scans your tags)
export function tagTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tag_index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tag_names (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, display TEXT, photo_count INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS tag_raw (tag_id INTEGER NOT NULL, raw TEXT NOT NULL, raw_lower TEXT NOT NULL DEFAULT '', PRIMARY KEY (tag_id, raw)) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS tag_photo (photo_id TEXT NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (photo_id, tag_id)) WITHOUT ROWID;
  `)
}

let nextTag = 1
// Adds a tag (its count worked out from the photos) and puts it on those photos
export function addTag(db: Database.Database, display: string, photos: string[]): number {
  const id = nextTag++
  const name = display.toLowerCase().replace(/[^a-z0-9]/g, '')
  db.prepare('INSERT INTO tag_names (id, name, display, photo_count) VALUES (?, ?, ?, ?)').run(id, name, display, photos.length)
  const put = db.prepare('INSERT OR IGNORE INTO tag_photo (photo_id, tag_id) VALUES (?, ?)')
  for (const p of photos) put.run(p, id)
  return id
}

export interface PhotoRow { id: string; title?: string; taken?: string; lat?: number | null; lon?: number | null; uploaded?: number | null; privacy?: number; media?: string; accuracy?: number }
export function addPhotos(db: Database.Database, rows: PhotoRow[]): void {
  const put = db.prepare('INSERT OR REPLACE INTO photo_meta (photo_id, title, date_taken, latitude, longitude, has_location, date_upload, privacy, media, geo_accuracy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  for (const r of rows) put.run(r.id, r.title ?? '', r.taken ?? '', r.lat ?? null, r.lon ?? null, r.lat != null && r.lon != null ? 1 : 0, r.uploaded ?? null, r.privacy ?? 0, r.media ?? 'photo', r.accuracy ?? 0)
}

export function addAlbum(db: Database.Database, id: string, title: string, photos: string[], kind?: string): void {
  db.prepare('INSERT INTO album (id, title, photo_count) VALUES (?, ?, ?)').run(id, title, photos.length)
  const put = db.prepare('INSERT OR IGNORE INTO album_photo (album_id, photo_id) VALUES (?, ?)')
  for (const p of photos) put.run(id, p)
  if (kind) db.prepare('INSERT INTO album_kind (album_id, kind) VALUES (?, ?)').run(id, kind)
}

// A date 'n' steps of 60 days after 1 Jan 2010: far enough apart that no two photos form a "visit"
export const farDate = (n: number): string => new Date(Date.UTC(2010, 0, 1) + n * 60 * 86400000).toISOString().slice(0, 10)
