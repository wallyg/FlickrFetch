import type Database from 'better-sqlite3'
import { getDb } from './database'
import { foldAccents } from '../shared/tags'
import { PHOTO_META_DDL, addPhotoMetaColumns } from './tagIndex'
import { ALBUMS_DDL } from './albumSync'

// The library database with the album tables ready, shared by the album checks and album fit
let ready: Database.Database | null = null
export function albumsDb(): Database.Database {
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
