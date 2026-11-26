import test, { before, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { openDatabase, getDb } from '../src/main/database'
import { duplicateStats, healthIds, healthOverview, healthSummary } from '../src/main/photoHealth'
import { DEFAULT_SCOPE, includesVideos, normalizeScope, scopeSql } from '../src/shared/healthScope'
import { addPhotos, tagTables } from './helpers'

// Which photos the Photos checks look at (#246): the "Include videos" switch and the No location check's own privacy and video choice.
// The library:  ph1 photo, public     ph2 photo, private     v1 video, public     v2 video, private     (none has a location)
//               pg  photo with a location (never "no location")
//               d1 / d2  two videos taken at the same second, uploaded two hours apart (a duplicate pair)
const file = (): string => join(app.getPath('userData'), 'settings.json')
const scope = (s: object | null): void => writeFileSync(file(), JSON.stringify(s === null ? {} : { healthScope: s }))
before(() => {
  openDatabase('test@N00')
  const db = getDb()!
  tagTables(db)
  healthSummary()
  db.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('has_photo_meta', '1')").run()
  db.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('has_catalog_v2', '1')").run()
  addPhotos(db, [
    { id: 'ph1', taken: '2020-01-01 10:00:00', privacy: 0 },
    { id: 'ph2', taken: '2020-01-02 10:00:00', privacy: 4 },
    { id: 'v1', taken: '2020-01-03 10:00:00', privacy: 0, media: 'video' },
    { id: 'v2', taken: '2020-01-04 10:00:00', privacy: 4, media: 'video' },
    { id: 'pg', taken: '2020-01-05 10:00:00', lat: 10, lon: 20, accuracy: 16 },
    { id: 'd1', taken: '2021-03-03 03:03:03', uploaded: 1_000_000_000, lat: 1, lon: 1, accuracy: 16, media: 'video' },
    { id: 'd2', taken: '2021-03-03 03:03:03', uploaded: 1_000_000_000 + 7200, lat: 1, lon: 1, accuracy: 16, media: 'video' }
  ])
})
afterEach(() => scope(null))

const open = (condition: 'location' | 'description'): string[] => healthIds({ condition, status: 'open' }).sort()

test('with nothing chosen every check looks at photos and videos alike', () => {
  scope(null)
  assert.deepEqual(open('location'), ['ph1', 'ph2', 'v1', 'v2'])
  assert.deepEqual(open('description'), ['d1', 'd2', 'pg', 'ph1', 'ph2', 'v1', 'v2'])
  assert.equal(duplicateStats().groups, 1)
})

test('"Include videos" off leaves videos out of every list, count and total', () => {
  scope({ videos: false })
  assert.deepEqual(open('location'), ['ph1', 'ph2'])
  assert.deepEqual(open('description'), ['pg', 'ph1', 'ph2'])
  assert.equal(duplicateStats().groups, 0)                                   // the duplicate pair is two videos
  assert.equal(healthSummary().photos, 3)                                    // ph1, ph2, pg
  assert.equal(healthSummary().rows.find(r => r.condition === 'location')!.open, 2)
  assert.equal(healthOverview().photos, 3)
})

test('No location can include videos while the switch leaves them out of the other checks', () => {
  scope({ videos: false, locVideos: 'include' })
  assert.deepEqual(open('location'), ['ph1', 'ph2', 'v1', 'v2'])
  assert.deepEqual(open('description'), ['pg', 'ph1', 'ph2'])
})

test('No location can leave videos out while the switch keeps them in the other checks', () => {
  scope({ videos: true, locVideos: 'leave' })
  assert.deepEqual(open('location'), ['ph1', 'ph2'])
  assert.deepEqual(open('description'), ['d1', 'd2', 'pg', 'ph1', 'ph2', 'v1', 'v2'])
})

test('the No location privacy choice keeps only public, or only not public, photos and videos', () => {
  scope({ locPrivacy: 'public' })
  assert.deepEqual(open('location'), ['ph1', 'v1'])
  scope({ locPrivacy: 'notPublic' })
  assert.deepEqual(open('location'), ['ph2', 'v2'])
  scope({ locPrivacy: 'notPublic', videos: false })
  assert.deepEqual(open('location'), ['ph2'])                                // the two choices combine
  scope({ locPrivacy: 'public' })
  assert.deepEqual(open('description'), ['d1', 'd2', 'pg', 'ph1', 'ph2', 'v1', 'v2'])   // and it belongs to No location only
})

test('overview totals: videos count only while some check that is on looks at them', () => {
  scope({ videos: false })
  const o = healthOverview()
  assert.equal(o.photos, 3)
  scope({ videos: false, locVideos: 'include' })
  assert.equal(healthSummary().photos, 7)                                    // the summary and the Overview use one rule, so they agree
  assert.equal(healthOverview().photos, 7)                                   // No location (a Warning by default, so not Off) still looks at videos
})

test('before the library list has saved privacy, the privacy choice is ignored', () => {
  const db = getDb()!
  db.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('has_catalog_v2', '0')").run()
  try {
    scope({ locPrivacy: 'public' })
    assert.deepEqual(open('location'), ['ph1', 'ph2', 'v1', 'v2'])
  } finally { db.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('has_catalog_v2', '1')").run() }
})

test('the choices read back safely: anything unknown is the default, and the SQL comes only from fixed choices', () => {
  assert.deepEqual(normalizeScope(undefined), DEFAULT_SCOPE)
  assert.deepEqual(normalizeScope({ videos: 'no', locVideos: "x'; DROP TABLE photo_meta; --", locPrivacy: 7 }), DEFAULT_SCOPE)
  assert.deepEqual(normalizeScope({ videos: false, locVideos: 'leave', locPrivacy: 'public' }), { videos: false, locVideos: 'leave', locPrivacy: 'public' })
  assert.equal(scopeSql('location', normalizeScope({ locPrivacy: "0 OR 1=1" }), true), '')
  assert.equal(includesVideos('location', { videos: false, locVideos: 'same', locPrivacy: 'all' }), false)
  assert.equal(includesVideos('title', { videos: true, locVideos: 'leave', locPrivacy: 'all' }), true)
})
