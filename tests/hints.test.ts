import test from 'node:test'
import assert from 'node:assert/strict'
import { hintFor, titleFarIds } from '../src/main/locationHints'
import { addPhotos, memoryDb, type PhotoRow } from './helpers'

// Each test starts a fresh library with its own "last scanned" stamp, because the hints are remembered until the library changes
let stamp = 0
function library(rows: PhotoRow[]): ReturnType<typeof memoryDb> {
  const db = memoryDb()
  addPhotos(db, rows)
  db.prepare("INSERT INTO tag_index_meta (key, value) VALUES ('last_scan_at', ?)").run(String(++stamp))
  return db
}
const PARIS = { lat: 48.8566, lon: 2.3522 }
const at = (id: string, time: string, extra: Partial<PhotoRow> = {}): PhotoRow => ({ id, taken: `2019-04-04 ${time}`, ...PARIS, ...extra })

// ---- a suggested location for a photo with none
test('a photo with no location gets a hint when the photos around it agree', () => {
  const db = library([at('g1', '12:00:00'), at('g2', '12:02:00'), at('g3', '12:04:00'), { id: 'x', taken: '2019-04-04 12:03:00' }])
  const h = hintFor(db, 'location', 'x', '2019-04-04 12:03:00')
  assert.ok(h && /3 photos taken within 10 minutes/.test(h.text), h?.text)
  assert.ok(h!.mapUrl?.includes('openstreetmap.org'))
})
test('no hint with fewer than two photos beside it', () => {
  const db = library([at('g1', '12:00:00'), { id: 'x', taken: '2019-04-04 12:03:00' }])
  assert.equal(hintFor(db, 'location', 'x', '2019-04-04 12:03:00'), null)
})
test('no hint when the photos beside it are in different places', () => {
  const db = library([at('g1', '12:00:00'), at('g2', '12:02:00', { lat: 51.5, lon: -0.12 }), { id: 'x', taken: '2019-04-04 12:03:00' }])
  assert.equal(hintFor(db, 'location', 'x', '2019-04-04 12:03:00'), null)
})
test('no hint when the photos beside it were taken too long before or after', () => {
  const db = library([at('g1', '10:00:00'), at('g2', '10:01:00'), { id: 'x', taken: '2019-04-04 12:03:00' }])
  assert.equal(hintFor(db, 'location', 'x', '2019-04-04 12:03:00'), null)
})
test('a photo timed exactly at midnight gets no hint, because its time is made up', () => {
  const db = library([at('g1', '00:00:30'), at('g2', '00:01:00'), { id: 'x', taken: '2019-04-04 00:00:00' }])
  assert.equal(hintFor(db, 'location', 'x', '2019-04-04 00:00:00'), null)
})

// ---- a suggested start for a title
const titled = (id: string, time: string, title: string): PhotoRow => at(id, time, { title })
test('a photo with no title gets the start its neighbours share', () => {
  const db = library([titled('t1', '12:00:00', 'Paris - Louvre: Gallery'), titled('t2', '12:02:00', 'Paris - Louvre: Pyramid'), titled('t3', '12:04:00', 'Paris - Louvre: Cafe'), { id: 'x', title: '', taken: '2019-04-04 12:03:00' }])
  const h = hintFor(db, 'title', 'x', '2019-04-04 12:03:00')
  assert.ok(h && h.text.includes('"Paris - Louvre: "'), h?.text)
})
test('no title hint when the neighbours start their titles differently', () => {
  const db = library([titled('t1', '12:00:00', 'Paris - Louvre: A'), titled('t2', '12:02:00', 'Paris - Marais: B'), titled('t3', '12:04:00', 'Paris - Bastille: C'), { id: 'x', title: '', taken: '2019-04-04 12:03:00' }])
  assert.equal(hintFor(db, 'title', 'x', '2019-04-04 12:03:00'), null)
})

// ---- a geotag far from the place the title names
test('a photo geotagged far from the city its title names is called out', () => {
  const bostonPhotos: PhotoRow[] = Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, title: `Boston: Walk ${i}`, taken: '2018-01-01 09:00:00', lat: 42.36 + i * 0.001, lon: -71.06 }))
  const db = library([...bostonPhotos, { id: 'lost', title: 'Boston: Tea', taken: '2018-01-01 09:00:00', lat: 51.5, lon: -0.12 }])
  assert.deepEqual(titleFarIds(db), ['lost'])
  const h = hintFor(db, 'locTitle', 'lost', '2018-01-01 09:00:00', { lat: 51.5, lon: -0.12 })
  assert.ok(h && h.text.includes('Boston'), h?.text)
})
test('a small city is never judged: it needs ten geotagged photos first', () => {
  const few: PhotoRow[] = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, title: `Lyon: Walk ${i}`, taken: '2018-01-01 09:00:00', lat: 45.76, lon: 4.83 }))
  const db = library([...few, { id: 'lost', title: 'Lyon: Tea', taken: '2018-01-01 09:00:00', lat: 51.5, lon: -0.12 }])
  assert.deepEqual(titleFarIds(db), [])
})

// The map link also travels as numbers, so the app's own Map can open on the place (#227)
test('a suggested location carries its place as numbers for the in-app Map', () => {
  const db = library([at('g1', '12:00:00'), at('g2', '12:02:00'), at('g3', '12:04:00'), { id: 'x', taken: '2019-04-04 12:03:00' }])
  const h = hintFor(db, 'location', 'x', '2019-04-04 12:03:00')!
  assert.ok(h.geo && Math.abs(h.geo.lat - PARIS.lat) < 1e-9 && Math.abs(h.geo.lon - PARIS.lon) < 1e-9)
})
test('a geotag far from its title place carries that geotag, and none when the photo has no geotag to show', () => {
  const boston: PhotoRow[] = Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, title: `Boston: Walk ${i}`, taken: '2018-01-01 09:00:00', lat: 42.36 + i * 0.001, lon: -71.06 }))
  const db = library([...boston, { id: 'lost', title: 'Boston: Tea', taken: '2018-01-01 09:00:00', lat: 51.5, lon: -0.12 }])
  const h = hintFor(db, 'locTitle', 'lost', '2018-01-01 09:00:00', { lat: 51.5, lon: -0.12 })
  assert.ok(h, 'a hint is given')
  assert.deepEqual(h.geo, { lat: 51.5, lon: -0.12 })
  assert.equal(hintFor(db, 'locTitle', 'lost', '2018-01-01 09:00:00', null)?.geo, undefined)
})
