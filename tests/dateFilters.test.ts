import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, getDb } from '../src/main/database'
import { albumsDb } from '../src/main/albumDb'
import { cameraRoll, datePhotoIds, dayPhotos, dayView, timelineDays, timelineMonths } from '../src/main/dateViews'
import { addAlbum, addPhotos, tagTables } from './helpers'

// On This Day and the Timeline with the Photos / Videos switch and the album choice, on the app's own database in an empty temporary folder.
// The library (all on 15 June unless noted):
//   p1 2019 photo, public, album A          p2 2018 video, public, album A
//   p3 2017 photo, private, album B         p4 2016 video, public, in no album
//   p5 2019-07-01 photo, public, albums A and B
//   v14 2015-06-14 video (the day before)   n16 2015-06-16 photo (the day after)
before(() => {
  openDatabase('test@N00')
  const db = getDb()!
  tagTables(db)
  albumsDb()
  addPhotos(db, [
    { id: 'p1', taken: '2019-06-15 10:00:00', media: 'photo', privacy: 0 },
    { id: 'p2', taken: '2018-06-15 10:00:00', media: 'video', privacy: 0 },
    { id: 'p3', taken: '2017-06-15 10:00:00', media: 'photo', privacy: 4 },
    { id: 'p4', taken: '2016-06-15 10:00:00', media: 'video', privacy: 0 },
    { id: 'p5', taken: '2019-07-01 10:00:00', media: 'photo', privacy: 0 },
    { id: 'v14', taken: '2015-06-14 10:00:00', media: 'video', privacy: 0 },
    { id: 'n16', taken: '2015-06-16 10:00:00', media: 'photo', privacy: 0 }
  ])
  addAlbum(db, 'A', 'Album A', ['p1', 'p2', 'p5'])
  addAlbum(db, 'B', 'Album B', ['p3', 'p5'])
  db.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('has_catalog_v2', '1')").run()
})

const DAY = { month: 6, day: 15, scope: 'all' as const }

test('with no switches, On This Day counts every photo and video of the day', () => {
  const v = dayView(DAY)
  assert.equal(v.total, 4)
  assert.equal(v.videos, 2)
})

test('the Photos / Videos switch keeps only photos, or only videos, in every count', () => {
  const videos = dayView({ ...DAY, media: 'video' })
  assert.equal(videos.total, 2); assert.equal(videos.videos, 2)
  assert.deepEqual(videos.years.map(y => y.year), ['2018', '2016'])
  assert.equal(videos.counts.all, 2)
  const photos = dayView({ ...DAY, media: 'photo' })
  assert.equal(photos.total, 2); assert.equal(photos.videos, 0)
  assert.deepEqual(photos.years.map(y => y.year), ['2019', '2017'])
})

test('the album choice keeps photos in any of the chosen albums, and an unknown album matches nothing', () => {
  assert.equal(dayView({ ...DAY, albumIds: ['A'] }).total, 2)          // p1, p2
  assert.equal(dayView({ ...DAY, albumIds: ['B'] }).total, 1)          // p3
  assert.equal(dayView({ ...DAY, albumIds: ['A', 'B'] }).total, 3)     // any of them: p1, p2, p3
  assert.equal(dayView({ ...DAY, albumIds: ['nope'] }).total, 0)
})

test('the switches combine with each other, with the privacy scope, and the scope counts follow them', () => {
  assert.equal(dayView({ ...DAY, media: 'video', albumIds: ['A'] }).total, 1)        // p2
  assert.equal(dayView({ ...DAY, scope: 'public', albumIds: ['B'] }).total, 0)       // p3 is private
  const c = dayView({ ...DAY, albumIds: ['A', 'B'] }).counts
  assert.deepEqual(c, { all: 3, public: 2, notPublic: 1 })
  const cv = dayView({ ...DAY, media: 'video' }).counts
  assert.deepEqual(cv, { all: 2, public: 2, notPublic: 0 })
})

test('the arrow counts for the day before and after follow the switches', () => {
  assert.equal(dayView(DAY).prev.count, 1)
  assert.equal(dayView(DAY).next.count, 1)
  const v = dayView({ ...DAY, media: 'video' })
  assert.equal(v.prev.count, 1)         // the video on the 14th
  assert.equal(v.next.count, 0)         // the 16th has only a photo
  assert.equal(dayView({ ...DAY, albumIds: ['A'] }).prev.count, 0)
})

test('"Show all" for a year and the download list follow the switches', () => {
  const q = { month: 6, day: 15, scope: 'all' as const }
  assert.deepEqual(dayPhotos({ ...q, year: '2018', offset: 0, limit: 10, media: 'photo' }).map(p => p.id), [])
  assert.deepEqual(dayPhotos({ ...q, year: '2018', offset: 0, limit: 10, media: 'video' }).map(p => p.id), ['p2'])
  assert.deepEqual(dayPhotos({ ...q, year: '2019', offset: 0, limit: 10, albumIds: ['B'] }).map(p => p.id), [])
  const day = datePhotoIds({ kind: 'day', ...q, media: 'video' }).map(r => r.id).sort()
  assert.deepEqual(day, ['p2', 'p4'])
  const range = datePhotoIds({ kind: 'range', from: '2015-01-01', to: '2019-12-31', scope: 'all', albumIds: ['A'] }).map(r => r.id).sort()
  assert.deepEqual(range, ['p1', 'p2', 'p5'])
  assert.deepEqual(datePhotoIds({ kind: 'range', from: '2015-01-01', to: '2019-12-31', scope: 'all', media: 'video' }).map(r => r.id).sort(), ['p2', 'p4', 'v14'])
})

test('the Timeline months and days follow the switches', () => {
  assert.equal(timelineMonths('all').total, 7)
  const v = timelineMonths('all', { media: 'video' })
  assert.equal(v.total, 3); assert.deepEqual(v.counts, { all: 3, public: 3, notPublic: 0 })
  assert.equal(timelineMonths('all', { albumIds: ['B'] }).total, 2)          // p3 and p5
  const june2019 = timelineMonths('all', { albumIds: ['A'] }).cells.find(c => c.year === 2019 && c.month === 6)
  assert.equal(june2019?.count, 1)
  assert.deepEqual(timelineDays(2015, 6, 'all', { media: 'video' }).days.map(d => d.day), [14])
  assert.deepEqual(timelineDays(2015, 6, 'all').days.map(d => d.day), [14, 16])
})

test('the camera roll totals and photos follow the switches', () => {
  const base = { from: '2015-01-01', to: '2019-12-31', scope: 'all' as const, order: 'asc' as const, offset: 0, limit: 62 }
  assert.equal(cameraRoll(base).totalPhotos, 7)
  const v = cameraRoll({ ...base, media: 'video' })
  assert.equal(v.totalPhotos, 3); assert.equal(v.totalVideos, 3)
  assert.deepEqual(v.days.flatMap(d => d.photos.map(p => p.id)).sort(), ['p2', 'p4', 'v14'])
  const a = cameraRoll({ ...base, albumIds: ['A'] })
  assert.equal(a.totalPhotos, 3)
  assert.deepEqual(a.days.flatMap(d => d.photos.map(p => p.id)).sort(), ['p1', 'p2', 'p5'])
})

test('anything that is not a real choice is ignored, and album ids can never become SQL', () => {
  assert.equal(dayView({ ...DAY, media: 'audio' as never }).total, 4)
  assert.equal(dayView({ ...DAY, albumIds: [42, '', null] as never }).total, 4)
  assert.equal(dayView({ ...DAY, albumIds: ["x') OR 1=1 --"] }).total, 0)   // would match every photo if it were ever written into the SQL
  assert.equal(dayView({ ...DAY, albumIds: 'A' as never }).total, 4)
})

// The privacy level: one of the six choices (public, friends, family, friends and family, private), the same on every tab
test('a privacy level keeps exactly that level in every view', () => {
  assert.equal(dayView({ ...DAY, privacy: 4 }).total, 1)               // p3 is private
  assert.equal(dayView({ ...DAY, privacy: 0 }).total, 3)               // p1, p2, p4 are public
  assert.equal(dayView({ ...DAY, privacy: 1 }).total, 0)
  assert.deepEqual(dayPhotos({ month: 6, day: 15, scope: 'all', year: '2017', offset: 0, limit: 10, privacy: 4 }).map(p => p.id), ['p3'])
  assert.deepEqual(dayPhotos({ month: 6, day: 15, scope: 'all', year: '2017', offset: 0, limit: 10, privacy: 0 }).map(p => p.id), [])
  assert.deepEqual(datePhotoIds({ kind: 'day', ...DAY, privacy: 0 }).map(r => r.id).sort(), ['p1', 'p2', 'p4'])
  assert.deepEqual(datePhotoIds({ kind: 'range', from: '2015-01-01', to: '2019-12-31', scope: 'all', privacy: 4 }).map(r => r.id), ['p3'])
  assert.equal(timelineMonths('all', { privacy: 4 }).total, 1)
  assert.deepEqual(timelineDays(2017, 6, 'all', { privacy: 4 }).days.map(d => d.day), [15])
  assert.deepEqual(timelineDays(2017, 6, 'all', { privacy: 0 }).days.map(d => d.day), [])
  const roll = cameraRoll({ from: '2015-01-01', to: '2019-12-31', scope: 'all', order: 'asc', offset: 0, limit: 62, privacy: 4 })
  assert.equal(roll.totalPhotos, 1)
})

test('the count beside each privacy level follows the other choices but not the privacy choice itself', () => {
  assert.deepEqual(dayView(DAY).levels, [3, 0, 0, 0, 1])
  assert.deepEqual(dayView({ ...DAY, media: 'video' }).levels, [2, 0, 0, 0, 0])
  assert.deepEqual(dayView({ ...DAY, albumIds: ['A', 'B'] }).levels, [2, 0, 0, 0, 1])
  assert.deepEqual(dayView({ ...DAY, privacy: 4 }).levels, [3, 0, 0, 0, 1])    // choosing a level does not change the counts of the others
  assert.deepEqual(timelineMonths('all').levels, [6, 0, 0, 0, 1])
  assert.deepEqual(timelineMonths('all', { media: 'video' }).levels, [3, 0, 0, 0, 0])
  assert.deepEqual(timelineMonths('all', { privacy: 4 }).levels, [6, 0, 0, 0, 1])
})

test('before privacy has been saved (no Rebuild since 3.5) the level is ignored and the counts are empty', () => {
  const db = getDb()!
  db.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('has_catalog_v2', '0')").run()
  try {
    assert.equal(dayView({ ...DAY, privacy: 4 }).total, 4)
    assert.deepEqual(dayView(DAY).levels, [0, 0, 0, 0, 0])
    assert.deepEqual(timelineMonths('all', { privacy: 4 }).levels, [0, 0, 0, 0, 0])
  } finally {
    db.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('has_catalog_v2', '1')").run()
  }
})

test('a privacy level that is not one of the five is ignored', () => {
  for (const bad of [9, -1, 1.5, '4', null] as never[]) assert.equal(dayView({ ...DAY, privacy: bad }).total, 4)
})
