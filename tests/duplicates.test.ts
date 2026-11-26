import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { openDatabase, getDb } from '../src/main/database'
import { duplicateGroups, duplicateStats, healthSet } from '../src/main/photoHealth'
import { addPhotos, tagTables } from './helpers'

// The app's own database code, opened in an empty temporary folder (see tests/stubs/electron.ts)
const HOUR = 3600
before(() => {
  openDatabase('test@N00')
  const db = getDb()!
  // The tables the check reads: the tag tables are made when the app first scans your tags, the others the first time a health list is opened
  tagTables(db)
  duplicateStats()
  addPhotos(db, [
    // A re-upload: same second taken, uploaded three hours apart
    { id: 'a1', title: 'Louvre', taken: '2010-05-05 10:00:00', uploaded: 1_300_000_000 },
    { id: 'a2', title: 'Louvre again', taken: '2010-05-05 10:00:00', uploaded: 1_300_000_000 + 3 * HOUR },
    // A burst: same second taken, uploaded 30 seconds apart
    { id: 'b1', taken: '2011-06-06 11:00:00', uploaded: 1_310_000_000 },
    { id: 'b2', taken: '2011-06-06 11:00:00', uploaded: 1_310_000_030 },
    // Midnight is a made-up time: never a duplicate
    { id: 'm1', taken: '2012-07-07 00:00:00', uploaded: 1_320_000_000 },
    { id: 'm2', taken: '2012-07-07 00:00:00', uploaded: 1_320_000_000 + 5 * HOUR },
    // Different seconds: not the same moment
    { id: 'd1', taken: '2013-08-08 12:00:00', uploaded: 1_330_000_000 },
    { id: 'd2', taken: '2013-08-08 12:00:01', uploaded: 1_330_000_000 + 5 * HOUR },
    // A group of three, uploaded a day apart, with an accented title for the search test
    { id: 'c1', title: 'Québec', taken: '2014-09-09 09:09:09', uploaded: 1_340_000_000 },
    { id: 'c2', title: 'Québec', taken: '2014-09-09 09:09:09', uploaded: 1_340_000_000 + 24 * HOUR },
    { id: 'c3', title: 'Québec', taken: '2014-09-09 09:09:09', uploaded: 1_340_000_000 + 25 * HOUR },
    // A photo with no upload time cannot be judged
    { id: 'n1', taken: '2015-01-01 01:01:01' }, { id: 'n2', taken: '2015-01-01 01:01:01' }
  ])
})
const list = (o: Partial<Parameters<typeof duplicateGroups>[0]> = {}): ReturnType<typeof duplicateGroups> => duplicateGroups({ status: 'open', search: '', sort: 'gap', offset: 0, limit: 30, ...o })

test('only real re-uploads form groups', () => {
  const page = list()
  assert.deepEqual(page.groups.map(g => g.taken).sort(), ['2010-05-05 10:00:00', '2014-09-09 09:09:09'])
  assert.equal(page.total, 2); assert.equal(page.photos, 5)
  assert.deepEqual(duplicateStats(), { groups: 2, photos: 5 })
})
test('a group lists its photos in upload order, with the first upload first', () => {
  const g = list().groups.find(x => x.taken === '2014-09-09 09:09:09')!
  assert.deepEqual(g.photos.map(p => p.photoId), ['c1', 'c2', 'c3'])
  assert.equal(g.gapSeconds, 25 * HOUR)
})
test('groups sort by the biggest gap, or by date taken', () => {
  assert.equal(list().groups[0].taken, '2014-09-09 09:09:09')                              // 25 hours beats 3 hours
  assert.equal(list({ sort: 'oldest' }).groups[0].taken, '2010-05-05 10:00:00')
  assert.equal(list({ sort: 'newest' }).groups[0].taken, '2014-09-09 09:09:09')
})
test('the title search ignores accents and capitals', () => {
  assert.deepEqual(list({ search: 'quebec' }).groups.map(g => g.taken), ['2014-09-09 09:09:09'])
  assert.equal(list({ search: 'nothing like it' }).total, 0)
})
test('paging gives a slice but the totals cover every group', () => {
  const p = list({ limit: 1, offset: 1 })
  assert.equal(p.groups.length, 1); assert.equal(p.total, 2)
})
test('a group moves to Marked fine only when every photo in it is marked', () => {
  healthSet({ photoId: 'a1', condition: 'duplicates', status: 'fine' })
  assert.equal(list({ status: 'fine' }).total, 0)         // one of two is not enough
  assert.equal(list().total, 2)
  healthSet({ photoId: 'a2', condition: 'duplicates', status: 'fine' })
  assert.equal(list({ status: 'fine' }).total, 1)
  assert.equal(list().total, 1)
  healthSet({ photoId: 'a2', condition: 'duplicates', status: 'open' })   // undo
  assert.equal(list({ status: 'fine' }).total, 0)
  assert.equal(list().total, 2)
})
test('the gap can be changed in the settings', () => {
  const file = join(app.getPath('userData'), 'settings.json')
  writeFileSync(file, JSON.stringify({ duplicates: { gapMinutes: 1 } }))   // at 1 minute the 30-second burst is still too close
  assert.equal(duplicateStats().groups, 2)
  addPhotos(getDb()!, [{ id: 'e1', taken: '2016-01-01 01:01:01', uploaded: 1_350_000_000 }, { id: 'e2', taken: '2016-01-01 01:01:01', uploaded: 1_350_000_000 + 300 }])
  assert.equal(duplicateStats().groups, 3)                 // ...but five minutes apart counts at 1 minute
  writeFileSync(file, JSON.stringify({ duplicates: { gapMinutes: 10 } }))
  assert.equal(duplicateStats().groups, 2)                 // and not at the standard 10
})
