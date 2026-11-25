import test from 'node:test'
import assert from 'node:assert/strict'
import { clusterPoints, cellPhotos, cleanFilter, findAlbums, loadPoints, makeAllowCache, passes, resolveAllow, worldPixel, type MapPoint } from '../src/main/mapPoints'
import { addAlbum, addPhotos, addTag, memoryDb } from './helpers'

const pt = (id: string, lat: number, lon: number, o: Partial<MapPoint> = {}): MapPoint => ({ id, lat, lon, taken: 20200101, posted: 20200201, privacy: 0, video: false, acc: 16, ...o })
const WORLD = { west: -180, south: -85, east: 180, north: 85 }

test('the middle of the world sits in the middle of the map at zoom 0', () => {
  const c = worldPixel(0, 0, 0)
  assert.ok(Math.abs(c.x - 128) < 1e-6 && Math.abs(c.y - 128) < 1e-6)
})
test('each zoom level doubles the map', () => {
  const a = worldPixel(40, -74, 3), b = worldPixel(40, -74, 4)
  assert.ok(Math.abs(b.x - 2 * a.x) < 1e-6 && Math.abs(b.y - 2 * a.y) < 1e-6)
})

test('photos taken in the same spot become one numbered circle, far apart ones stay separate', () => {
  const pts = [pt('a', 48.8566, 2.3522), pt('b', 48.8567, 2.3523), pt('c', 48.8568, 2.3521), pt('ny', 40.71, -74.0)]
  const r = clusterPoints(pts, { ...WORLD, zoom: 3 })
  assert.equal(r.clusters.length, 2)
  assert.deepEqual(r.clusters.map(c => c.count).sort(), [1, 3])
  assert.equal(r.inView, 4)
})
test('a single photo is a dot that carries its id; a circle does not', () => {
  const r = clusterPoints([pt('a', 48.8566, 2.3522), pt('b', 48.8567, 2.3523), pt('ny', 40.71, -74.0)], { ...WORLD, zoom: 3 })
  assert.equal(r.clusters.find(c => c.count === 1)!.id, 'ny')
  assert.equal(r.clusters.find(c => c.count === 2)!.id, undefined)
})
test('zooming in splits a circle into its photos', () => {
  const pts = [pt('a', 48.8566, 2.3522), pt('b', 48.8600, 2.3600)]
  assert.equal(clusterPoints(pts, { ...WORLD, zoom: 3 }).clusters.length, 1)
  assert.equal(clusterPoints(pts, { west: 2.3, south: 48.8, east: 2.4, north: 48.9, zoom: 16 }).clusters.length, 2)
})
test('photos outside the window are left out and not counted', () => {
  const pts = [pt('paris', 48.8566, 2.3522), pt('ny', 40.71, -74.0)]
  const r = clusterPoints(pts, { west: -10, south: 35, east: 20, north: 60, zoom: 4 })
  assert.equal(r.inView, 1); assert.deepEqual(r.clusters.map(c => c.id), ['paris'])
})
test('a window across the date line still finds photos on both sides', () => {
  const pts = [pt('east', 0, 179.5), pt('west', 0, -179.5), pt('mid', 0, 0)]
  const r = clusterPoints(pts, { west: 170, south: -10, east: -170, north: 10, zoom: 3 })
  assert.equal(r.inView, 2)
})


const Q = { ...WORLD, zoom: 3 }
const count = (pts: MapPoint[], f: object, allow?: Set<string>): number => clusterPoints(pts, { ...Q, ...f }, allow).inView

test('the media filter keeps photos or videos', () => {
  const pts = [pt('p', 10, 10), pt('v', 20, 20, { video: true })]
  assert.equal(count(pts, {}), 2)
  assert.equal(count(pts, { media: 'photo' }), 1)
  assert.equal(count(pts, { media: 'video' }), 1)
  assert.ok(passes(pts[1], { media: 'video' }) && !passes(pts[0], { media: 'video' }))
})
test('the privacy filter keeps exactly one level', () => {
  const pts = [0, 1, 2, 3, 4].map(n => pt('p' + n, 10 + n * 5, 10, { privacy: n }))
  for (const n of [0, 1, 2, 3, 4] as const) assert.deepEqual(pts.filter(p => passes(p, { privacy: n })).map(p => p.id), ['p' + n])
  assert.equal(count(pts, {}), 5)
})
test('a date range is inclusive, works from one end only, and leaves out photos with no date', () => {
  const pts = [pt('a', 10, 10, { taken: 20190101 }), pt('b', 20, 20, { taken: 20190615 }), pt('c', 30, 30, { taken: 20191231 }), pt('d', 40, 40, { taken: 20200101 }), pt('none', 50, 50, { taken: 0 })]
  assert.equal(count(pts, { dateFrom: 20190101, dateTo: 20191231 }), 3)
  assert.equal(count(pts, { dateFrom: 20190102, dateTo: 20191230 }), 1)
  assert.equal(count(pts, { dateFrom: 20190615 }), 3)     // b, c, d: from the 15th on, undated left out
  assert.equal(count(pts, { dateTo: 20190615 }), 2)       // a and b
  assert.equal(count(pts, {}), 5)
})
test('the date range can apply to the day a photo was posted instead of taken', () => {
  const pts = [pt('a', 10, 10, { taken: 20100101, posted: 20230505 }), pt('b', 20, 20, { taken: 20230505, posted: 0 })]
  assert.deepEqual(pts.filter(p => passes(p, { dateFrom: 20230101, dateTo: 20231231, dateField: 'taken' })).map(p => p.id), ['b'])
  assert.deepEqual(pts.filter(p => passes(p, { dateFrom: 20230101, dateTo: 20231231, dateField: 'posted' })).map(p => p.id), ['a'])
})
test('location accuracy: street is 15 or 16, town or better is 11 or more, vague is 1 to 10, and unrecorded matches none of them', () => {
  const at = (n: number): MapPoint => pt('a' + n, 10, 10, { acc: n })
  const yes = (acc: 'street' | 'town' | 'vague') => [0, 1, 4, 10, 11, 14, 15, 16].filter(n => passes(at(n), { accuracy: acc }))
  assert.deepEqual(yes('street'), [15, 16])
  assert.deepEqual(yes('town'), [11, 14, 15, 16])
  assert.deepEqual(yes('vague'), [1, 4, 10])
  assert.ok(passes(at(0), {}))                              // no accuracy filter: still shown
})
test('every filter has to match at once', () => {
  const pts = [
    pt('hit', 10, 10, { video: true, privacy: 0, taken: 20200601, acc: 16 }),
    pt('wrongMedia', 20, 20, { video: false, privacy: 0, taken: 20200601, acc: 16 }),
    pt('wrongPrivacy', 30, 30, { video: true, privacy: 4, taken: 20200601, acc: 16 }),
    pt('wrongDate', 40, 40, { video: true, privacy: 0, taken: 20150601, acc: 16 }),
    pt('wrongAcc', 50, 50, { video: true, privacy: 0, taken: 20200601, acc: 4 })
  ]
  const f = { media: 'video' as const, privacy: 0 as const, dateFrom: 20200101, dateTo: 20201231, accuracy: 'street' as const }
  assert.deepEqual(pts.filter(p => passes(p, f)).map(p => p.id), ['hit'])
})
test('"matching" counts the whole map and "in view" only the window', () => {
  const pts = [pt('paris', 48.8566, 2.3522), pt('ny', 40.71, -74.0, { video: true })]
  const r = clusterPoints(pts, { west: -10, south: 35, east: 20, north: 60, zoom: 4, media: 'photo' })
  assert.equal(r.matching, 1); assert.equal(r.inView, 1)
  const r2 = clusterPoints(pts, { west: -10, south: 35, east: 20, north: 60, zoom: 4 })
  assert.equal(r2.matching, 2); assert.equal(r2.inView, 1)
})
test('an album or tag choice (the allowed ids) narrows both the dots and the cell lookup', () => {
  const pts = [pt('a', 48.8566, 2.3522), pt('b', 48.8567, 2.3523), pt('c', 48.8568, 2.3521)]
  const allow = new Set(['a', 'c'])
  assert.equal(count(pts, {}, allow), 2)
  const circle = clusterPoints(pts, Q, allow).clusters[0]
  assert.deepEqual(cellPhotos(pts, { zoom: 3, cx: circle.cx, cy: circle.cy, offset: 0, limit: 10 }, allow).ids.sort(), ['a', 'c'])
  assert.equal(count(pts, {}, new Set()), 0)
})
test('the photos behind a circle are the ones it counted, newest first, and can be paged', () => {
  const pts = [pt('old', 48.8566, 2.3522, { taken: 20100101 }), pt('mid', 48.8567, 2.3523, { taken: 20150101 }), pt('new', 48.8568, 2.3521, { taken: 20220101 }), pt('ny', 40.71, -74.0)]
  const circle = clusterPoints(pts, { ...WORLD, zoom: 3 }).clusters.find(c => c.count === 3)!
  const first = cellPhotos(pts, { zoom: 3, cx: circle.cx, cy: circle.cy, offset: 0, limit: 2 })
  assert.equal(first.total, 3); assert.deepEqual(first.ids, ['new', 'mid'])
  assert.deepEqual(cellPhotos(pts, { zoom: 3, cx: circle.cx, cy: circle.cy, offset: 2, limit: 2 }).ids, ['old'])
})
test('the cell lookup follows the same filters as the dots', () => {
  const pts = [pt('a', 48.8566, 2.3522), pt('b', 48.8567, 2.3523, { privacy: 2 })]
  const circle = clusterPoints(pts, { ...WORLD, zoom: 3 }).clusters[0]
  assert.equal(cellPhotos(pts, { zoom: 3, cx: circle.cx, cy: circle.cy, offset: 0, limit: 10, privacy: 0 }).total, 1)
})


test('albums add up, tags add up (any) or all have to be there (all), and album and tag both have to match', () => {
  const db = memoryDb()
  addPhotos(db, ['p1', 'p2', 'p3', 'p4', 'p5'].map(id => ({ id, lat: 10, lon: 10 })))
  addAlbum(db, 'A1', 'Dolomites', ['p1', 'p2'])
  addAlbum(db, 'A2', 'Paris', ['p3'])
  addTag(db, 'New York', ['p1', 'p3', 'p4'])
  addTag(db, 'hiking', ['p1', 'p2', 'p5'])
  const ids = (f: object): string[] | undefined => { const s = resolveAllow(db, f); return s ? [...s].sort() : undefined }
  assert.equal(ids({}), undefined)
  assert.deepEqual(ids({ albumIds: ['A1'] }), ['p1', 'p2'])
  assert.deepEqual(ids({ albumIds: ['A1', 'A2'] }), ['p1', 'p2', 'p3'])
  assert.deepEqual(ids({ tags: ['newyork', 'hiking'], tagMode: 'any' }), ['p1', 'p2', 'p3', 'p4', 'p5'])
  assert.deepEqual(ids({ tags: ['newyork', 'hiking'], tagMode: 'all' }), ['p1'])
  assert.deepEqual(ids({ tags: ['New York'] }), ['p1', 'p3', 'p4'])           // typed with a space and capitals: same tag
  assert.deepEqual(ids({ albumIds: ['A1'], tags: ['hiking'] }), ['p1', 'p2'])
  assert.deepEqual(ids({ albumIds: ['A2'], tags: ['hiking'] }), [])           // both have to match
  assert.deepEqual(ids({ tags: ['nosuchtag'] }), [])
  assert.deepEqual(ids({ tags: ['hiking', 'nosuchtag'], tagMode: 'all' }), [])
  assert.deepEqual(ids({ tags: ['hiking', 'nosuchtag'], tagMode: 'any' }), ['p1', 'p2', 'p5'])
  assert.deepEqual(ids({ tags: ['!!!'] }), [])                                  // nothing left once it is cleaned
})

test('only filters the map understands get through, in the right shape', () => {
  assert.deepEqual(cleanFilter(undefined), {})
  for (const bad of [5, -1, 2.5, NaN, '0']) assert.equal(cleanFilter({ privacy: bad as never }).privacy, undefined)
  for (const ok of [0, 1, 2, 3, 4]) assert.equal(cleanFilter({ privacy: ok as never }).privacy, ok)
  assert.deepEqual(cleanFilter({ media: 'audio', privacy: 9, dateFrom: 'x', dateTo: 5, tags: 'a', albumIds: [1, 2], accuracy: 'perfect' } as never), {})
  const f = cleanFilter({ media: 'video', privacy: 4, dateFrom: 20200101, tags: ['a', 7 as never, ''], tagMode: 'all', albumIds: ['x'], accuracy: 'street' })
  assert.deepEqual(f, { media: 'video', privacy: 4, dateField: 'taken', dateFrom: 20200101, tags: ['a'], tagMode: 'all', albumIds: ['x'], accuracy: 'street' })
  assert.equal(cleanFilter({ dateField: 'posted' } as never).dateField, undefined)     // no range, so no date field
  assert.equal(cleanFilter({ dateFrom: 20200101, dateField: 'posted' }).dateField, 'posted')
  assert.equal(cleanFilter({ tags: Array.from({ length: 50 }, (_, i) => 't' + i) }).tags!.length, 20)
  assert.equal(cleanFilter({ albumIds: Array.from({ length: 500 }, (_, i) => 'a' + i) }).albumIds!.length, 100)
})

test('the album box finds albums by any part of the title, the ones that start with it first, and treats % and _ as plain letters', () => {
  const db = memoryDb()
  addAlbum(db, '1', 'Summer in Paris', ['a'])
  addAlbum(db, '2', 'Paris 2019', ['a', 'b', 'c'])
  addAlbum(db, '3', 'Rome', ['a'])
  addAlbum(db, '4', '100% Rome', ['a'])
  assert.deepEqual(findAlbums(db, 'paris').map(h => h.id), ['2', '1'])
  assert.deepEqual(findAlbums(db, 'PARIS').map(h => h.title), ['Paris 2019', 'Summer in Paris'])
  assert.deepEqual(findAlbums(db, '100%').map(h => h.id), ['4'])
  assert.deepEqual(findAlbums(db, '%').map(h => h.id), ['4'])        // a plain percent sign, not "everything"
  assert.deepEqual(findAlbums(db, 'rome').map(h => h.count), [1, 1])
  assert.equal(findAlbums(db, 'zzz').length, 0)
  for (let i = 0; i < 20; i++) addAlbum(db, 'x' + i, 'Trip ' + i, ['a'])
  assert.equal(findAlbums(db, 'trip').length, 12)
})

test('loading reads media, posted day and accuracy too', () => {
  const db = memoryDb()
  addPhotos(db, [
    { id: 'v', taken: '2019-05-06 10:00:00', lat: 48.85, lon: 2.35, media: 'video', accuracy: 11, uploaded: Date.UTC(2021, 2, 4, 12) / 1000 },
    { id: 'p', lat: 10, lon: 10, accuracy: 99 }, { id: 'old', taken: '1850-01-01 00:00:00', lat: 11, lon: 11, uploaded: 1 }
  ])
  const { points } = loadPoints(db)
  const v = points.find(p => p.id === 'v')!, p = points.find(x => x.id === 'p')!, old = points.find(x => x.id === 'old')!
  assert.equal(v.video, true); assert.equal(v.acc, 11); assert.equal(v.posted, 20210304); assert.equal(v.taken, 20190506)
  assert.equal(p.video, false); assert.equal(p.acc, 16); assert.equal(p.posted, 0); assert.equal(p.taken, 0)   // 99 is not on the scale: kept to 16
  assert.equal(old.taken, 0); assert.equal(old.posted, 0)    // before 1900 and before 1990: a clock that was never set
})

test('loading skips photos with no location, a location at 0, 0 and impossible places', () => {
  const db = memoryDb()
  addPhotos(db, [
    { id: 'ok', taken: '2019-05-06 10:00:00', lat: 48.85, lon: 2.35 }, { id: 'none' }, { id: 'zero', lat: 0, lon: 0 },
    { id: 'bad', lat: 123, lon: 10 }, { id: 'undated', lat: 10, lon: 10 }, { id: 'old', taken: '1850-01-01 00:00:00', lat: 11, lon: 11 }
  ])
  const { points, photos } = loadPoints(db)
  assert.equal(photos, 6)
  assert.deepEqual(points.map(p => p.id).sort(), ['ok', 'old', 'undated'])
  assert.equal(points.find(p => p.id === 'ok')!.taken, 20190506)
  assert.equal(points.find(p => p.id === 'old')!.taken, 0)    // before 1900: a clock that was never set
})

test('album and tag answers are remembered while the library is unchanged, and dropped after an update', () => {
  const db = memoryDb()
  addPhotos(db, [{ id: 'a', lat: 1, lon: 1 }, { id: 'b', lat: 2, lon: 2 }])
  addAlbum(db, 'A', 'Trip', ['a'])
  const allow = makeAllowCache(() => db)
  assert.equal(allow({}, 's1'), undefined)
  assert.deepEqual([...allow({ albumIds: ['A'] }, 's1')!], ['a'])
  db.prepare("INSERT INTO album_photo (album_id, photo_id) VALUES ('A', 'b')").run()
  assert.deepEqual([...allow({ albumIds: ['A'] }, 's1')!], ['a'])             // same library update: the earlier answer is reused
  assert.deepEqual([...allow({ albumIds: ['A'] }, 's2')!].sort(), ['a', 'b'])  // a new library update: asked again
  assert.deepEqual([...allow({ tags: ['x', 'Y'] }, 's2')!], [])                // different choice, different answer
})
