import test from 'node:test'
import assert from 'node:assert/strict'
import { detectPlurals } from '../src/main/pluralTags'
import { detectPossessives } from '../src/main/possessiveTags'
import { detectMissingTags } from '../src/main/missingTags'
import { CLEANUP_RULES, fineReasonsFor, logicOf } from '../src/shared/cleanupRules'
import { addAlbum, addPhotos, addTag, memoryDb } from './helpers'

const ids = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${prefix}${i}`)

// ---- singular and plural
test('a rare plural beside a common singular is flagged, pointing to the singular', () => {
  const db = memoryDb()
  const common = ids('c', 100), rare = ids('r', 3), companions = [...common, ...rare]
  addTag(db, 'alley', common); addTag(db, 'alleys', rare)
  addTag(db, 'street', companions); addTag(db, 'urban', companions)
  const found = detectPlurals(db)
  assert.equal(found.length, 1)
  assert.equal(found[0].display, 'alleys'); assert.equal(found[0].replacement, 'alley')
})
test('a pair used together on one photo is deliberate, not flagged', () => {
  const db = memoryDb()
  const common = ids('c', 100)
  addTag(db, 'cemetery', common); addTag(db, 'cemeteries', ['c0', 'c1', 'c2'])
  addTag(db, 'grave', common)
  assert.equal(detectPlurals(db).length, 0)
})
test('two different words are not flagged when their company differs', () => {
  const db = memoryDb()
  const common = ids('c', 100), rare = ids('r', 3)
  addTag(db, 'queen', common); addTag(db, 'queens', rare)
  addTag(db, 'band', common); addTag(db, 'borough', rare)
  assert.equal(detectPlurals(db).length, 0)
})
test('a plural that is not rare is left alone', () => {
  const db = memoryDb()
  const common = ids('c', 100), other = ids('r', 30)
  addTag(db, 'alley', common); addTag(db, 'alleys', other)
  addTag(db, 'street', [...common, ...other])
  assert.equal(detectPlurals(db).length, 0)
})

// ---- possessives on their own
test('a one-word possessive that is not a venue is flagged, with the plain name suggested', () => {
  const db = memoryDb()
  addTag(db, 'Cliff', ids('a', 20)); addTag(db, "Cliff's", ids('b', 12))
  const found = detectPossessives(db)
  assert.equal(found.length, 1)
  assert.equal(found[0].display, "Cliff's"); assert.equal(found[0].replacement, 'Cliff'); assert.equal(found[0].confidence, 'high')
})
test('a possessive on photos of a restaurant is the name of a place, so not flagged', () => {
  const db = memoryDb()
  const photos = ids('j', 10)
  addTag(db, "Joe's", photos); addTag(db, 'restaurant', photos)
  assert.equal(detectPossessives(db).length, 0)
})
test('a possessive of two or more words is not flagged', () => {
  const db = memoryDb()
  addTag(db, "Del Frisco's", ids('d', 10))
  assert.equal(detectPossessives(db).length, 0)
})
test('1980’s is suggested as 1980s', () => {
  const db = memoryDb()
  addTag(db, "1980's", ids('e', 10))
  const found = detectPossessives(db)
  assert.equal(found.length, 1); assert.equal(found[0].replacement, '1980s')
})

// ---- missing tags
// 49 of 50 photos in an album carry both "paris" and "france"; the fiftieth has "paris" only. Two clues point to "france": the tag habit
// (paris nearly always comes with france) and the album (nearly every photo has it).
function parisFrance(): ReturnType<typeof memoryDb> {
  const db = memoryDb()
  const all = ids('p', 50)
  addPhotos(db, all.map(id => ({ id })))
  addTag(db, 'Paris', all); addTag(db, 'France', all.slice(1))
  addAlbum(db, 'A', 'Paris trip', all)
  return db
}
test('a photo is suggested a tag when two clues agree', () => {
  const r = detectMissingTags(parisFrance())
  assert.equal(r.suggestions, 1)
  assert.deepEqual(r.photoIds.get('france'), ['p0'])
})
test('one clue alone is not enough at the standard setting', () => {
  const db = parisFrance()
  db.exec('DELETE FROM album_photo; DELETE FROM album')      // only the tag habit is left
  assert.equal(detectMissingTags(db).suggestions, 0)
})

// ---- the list of checks
test('every check has a plain description, its full logic and reasons for "fine"', () => {
  for (const r of CLEANUP_RULES) {
    assert.ok(r.name.trim().length > 0 && r.blurb.trim().length > 0, `${r.id} has no name or description`)
    assert.ok((logicOf(r.id) ?? '').trim().length > 20, `${r.id} has no full logic text`)
    const reasons = fineReasonsFor(r.id)
    assert.ok(reasons.length > 0 && reasons.every(x => x.trim().length > 0), `${r.id} has no reasons for "fine"`)
  }
})
test('check ids are unique', () => {
  const seen = new Set<string>()
  for (const r of CLEANUP_RULES) { assert.ok(!seen.has(r.id), `${r.id} is listed twice`); seen.add(r.id) }
})
