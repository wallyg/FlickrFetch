import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, getDb } from '../src/main/database'
import { healthIds, healthList, healthSet, healthSummary } from '../src/main/photoHealth'
import { CLEANUP_RULES, ruleById } from '../src/shared/cleanupRules'
import { addPhotos, tagTables } from './helpers'

// "Vague location" (Health Check > Photos > Locations): photos with a location whose Flickr precision is 10 or less (1 is the whole world, 16 a street).
before(() => {
  openDatabase()
  const db = getDb()!
  tagTables(db)
  healthSummary()    // the first look makes the photo list table (the app does the same when a health list is first opened)
  db.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('has_photo_meta', '1')").run()
  addPhotos(db, [
    { id: 'street', lat: 48.85, lon: 2.35, accuracy: 16 },
    { id: 'near', lat: 48.85, lon: 2.35, accuracy: 15 },
    { id: 'town', lat: 48.85, lon: 2.35, accuracy: 11 },
    { id: 'region', lat: 45.0, lon: 11.0, accuracy: 10 },
    { id: 'country', lat: 42.0, lon: 12.0, accuracy: 4 },
    { id: 'world', lat: 0.5, lon: 0.5, accuracy: 1 },
    { id: 'unrecorded', lat: 48.85, lon: 2.35, accuracy: 0 },
    { id: 'nolocation', accuracy: 4 },           // a precision but no location: another check's business
    { id: 'tolerated', lat: 41.0, lon: 12.5, accuracy: 6 }
  ])
})
const ids = (status: 'open' | 'fine' = 'open'): string[] => healthIds({ condition: 'locVague', status }).sort()

test('it is a listed Photos check, warning by default, in the Locations group of the list', () => {
  const rule = ruleById('photos:locVague')!
  assert.equal(rule.report, 'photos'); assert.equal(rule.defaultState, 'optional'); assert.equal(rule.needsRebuild, true)
  assert.equal(CLEANUP_RULES.filter(r => r.id === 'photos:locVague').length, 1)
  assert.ok(healthSummary().rows.some(r => r.condition === 'locVague'))
})
test('only precisions 1 to 10 are flagged: not 11 and up, not unrecorded, not photos with no location', () => {
  assert.deepEqual(ids(), ['country', 'region', 'tolerated', 'world'])
  const row = healthSummary().rows.find(r => r.condition === 'locVague')!
  assert.deepEqual({ open: row.open, fine: row.fine }, { open: 4, fine: 0 })
})
test('marking one fine moves it out of the open list and Undo brings it back', () => {
  healthSet({ photoId: 'country', condition: 'locVague', status: 'fine' })
  assert.deepEqual(ids(), ['region', 'tolerated', 'world'])
  assert.deepEqual(ids('fine'), ['country'])
  healthSet({ photoId: 'country', condition: 'locVague', status: 'open' })
  assert.deepEqual(ids(), ['country', 'region', 'tolerated', 'world'])
})
test('the list says what is wrong with each photo', () => {
  const page = healthList({ condition: 'locVague', status: 'open', offset: 0, limit: 10 })
  assert.equal(page.total, 4)
  assert.ok(page.rows.every(r => r.kind === 'Vague location'))
})
