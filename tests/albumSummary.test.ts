import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, getDb } from '../src/main/database'
import { albumsDb } from '../src/main/albumDb'
import { albumSummary } from '../src/main/albumChecks'
import { fitQuery } from '../src/main/albumFit'
import { photoCards } from '../src/main/photoCards'
import { addAlbum, addPhotos, farDate, tagTables, type PhotoRow } from './helpers'

// The album summary on the app's own database, opened in an empty temporary folder (see tests/stubs/electron.ts).
// The library: two Paris albums of 100 photos each, with one stray photo (in New York) filed in BOTH of them,
// an empty album, and two photos that are in no album.
const PARIS = { lat: 48.8566, lon: 2.3522 }
const jitter = (i: number): { lat: number; lon: number } => ({ lat: PARIS.lat + (i % 10) * 0.0001, lon: PARIS.lon + Math.floor(i / 10) * 0.0001 })
before(() => {
  openDatabase()
  const db = getDb()!
  tagTables(db)
  albumsDb()   // makes the album tables
  const mk = (prefix: string): PhotoRow[] => Array.from({ length: 100 }, (_, i) => ({ id: `${prefix}${i}`, title: `Paris ${i}`, taken: `${farDate(i)} 00:00:00`, ...jitter(i) }))
  const a = mk('p'), b = mk('q')
  addPhotos(db, [...a, ...b, { id: 'ny', title: 'Stray', taken: `${farDate(300)} 00:00:00`, lat: 40.71, lon: -74.0 }, { id: 'lonely1' }, { id: 'lonely2' }])
  addAlbum(db, 'A', 'Paris', [...a.map(r => r.id), 'ny'], 'place')
  addAlbum(db, 'B', 'Paris again', [...b.map(r => r.id), 'ny'], 'place')
  addAlbum(db, 'E', 'Empty', [])
  db.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('has_albums_37', '1')").run()
})

test('a photo flagged in two albums is two rows but one photo', () => {
  const row = albumSummary().rows.find(r => r.condition === 'misfit')!
  assert.equal(row.open, 2)        // the stray photo in album A and in album B
  assert.equal(row.photos, 1)      // one photo
  assert.equal(row.albums, 2)
})

test('the two groups count each album or photo once, Issues before Warnings', () => {
  const s = albumSummary()
  assert.equal(s.groups.albums.total, 3)
  assert.equal(s.groups.albums.issue, 1)       // the empty album (an Issue by default)
  assert.equal(s.groups.albums.warning, 2)     // the two others have no description or collection, but each counts once
  assert.equal(s.groups.photos.total, 203)
  assert.equal(s.groups.photos.issue, 2)       // the two photos in no album
  assert.equal(s.groups.photos.warning, 1)     // the stray photo, once, although two albums flag it
})

test('the Reason menu counts each kind and filters the list', () => {
  const q = { condition: 'misfit' as const, status: 'open' as const, sort: 'newest' as const }
  const all = fitQuery(q, 50, 0)
  assert.equal(all.total, 2); assert.equal(all.reasons!.all, 2); assert.equal(all.reasons!.place, 2)
  const place = fitQuery({ ...q, reason: 'place' }, 50, 0)
  assert.equal(place.total, 2)
  const tag = fitQuery({ ...q, reason: 'tag' }, 50, 0)
  assert.equal(tag.total, 0); assert.equal(tag.reasons!.all, 2)     // the menu still shows the full counts
})

test('photo cards come back in the order asked, with a blank card for an unknown photo', () => {
  const cards = photoCards(['ny', 'p3', 'nope'])
  assert.deepEqual(cards.map(c => c.photoId), ['ny', 'p3', 'nope'])
  assert.equal(cards[0].title, 'Stray'); assert.equal(cards[2].title, '')
  assert.ok(cards[1].flickrUrl.includes('p3'))
})
