import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, getDb } from '../src/main/database'
import { albumsDb } from '../src/main/albumDb'
import { fitKinds } from '../src/main/albumFit'
import { addAlbum, addPhotos, addTag, farDate, tagTables, type PhotoRow } from './helpers'

// The album settings list (Settings > Albums) gives each album the app's pick and the reason. For a subject album the reason names the tag;
// it used to read "a clear subject tag: ." because the tag names had not been read yet.
before(() => {
  openDatabase()
  const db = getDb()!
  tagTables(db)
  albumsDb()
  const album: PhotoRow[] = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, taken: `${farDate(i)} 00:00:00` }))
  const others: PhotoRow[] = Array.from({ length: 400 }, (_, i) => ({ id: `o${i}`, taken: `${farDate(100 + i)} 00:00:00` }))
  addPhotos(db, [...album, ...others])
  addAlbum(db, 'S', 'Arenas', album.map(r => r.id))
  addTag(db, 'Arena', album.slice(0, 30).map(r => r.id))
})

test('the reason for a subject album names its tag', () => {
  const row = fitKinds().find(r => r.albumId === 'S')!
  assert.equal(row.pick, 'tag')
  assert.equal(row.why, 'a clear subject tag: arena')
})
