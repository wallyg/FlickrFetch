import test from 'node:test'
import assert from 'node:assert/strict'
import { titlePlace, placeText, cityText } from '../src/shared/titlePlace'
import { safeFolderName } from '../src/main/safeName'

test('a title that starts "City - Neighbourhood:" gives both places', () => {
  assert.deepEqual(titlePlace('Boston - Back Bay: Public Garden'), ['boston', 'back bay'])
})
test('a title that starts "City:" gives just the city', () => {
  assert.deepEqual(titlePlace('Boston: Skyline at dusk'), ['boston'])
})
test('the place may end at a pipe or a wide colon', () => {
  assert.deepEqual(titlePlace('Paris | Louvre'), ['paris'])
  assert.deepEqual(titlePlace('Tokyo：Shibuya crossing'), ['tokyo'])
})
test('the city and neighbourhood may be split by an en dash or an em dash', () => {
  assert.deepEqual(titlePlace('Rome – Trastevere: Evening'), ['rome', 'trastevere'])
  assert.deepEqual(titlePlace('Rome — Trastevere: Evening'), ['rome', 'trastevere'])
})
test('accents and capitals are ignored', () => {
  assert.deepEqual(titlePlace('São Paulo - Pinheiros: Mural'), ['sao paulo', 'pinheiros'])
  assert.deepEqual(titlePlace('BOSTON: x'), ['boston'])
})
test('a hyphen inside a name is not a separator', () => {
  assert.deepEqual(titlePlace('Winston-Salem: Old town'), ['winston-salem'])
})
test('a title with no colon or pipe has no place', () => {
  assert.equal(titlePlace('Sunset over the bay'), null)
  assert.equal(titlePlace(''), null)
})
test('a title that starts with a colon has no place', () => {
  assert.equal(titlePlace(': just a subject'), null)
})
test('placeText and cityText give the place as written', () => {
  assert.equal(placeText('NYC - Chelsea: Galleries'), 'NYC - Chelsea')
  assert.equal(cityText('NYC - Chelsea: Galleries'), 'NYC')
  assert.equal(cityText('NYC: Galleries'), 'NYC')
})

test('safeFolderName removes path characters', () => {
  assert.equal(safeFolderName('Trips/2020: Paris?'), 'Trips_2020_ Paris_')
  assert.equal(safeFolderName('a\\b'), 'a_b')
})
test('safeFolderName never gives ".", ".." or a hidden folder', () => {
  assert.equal(safeFolderName('.'), '_')
  assert.equal(safeFolderName('..'), '_')
  const up = safeFolderName('../../etc')
  assert.ok(!/[/\\]/.test(up) && !up.startsWith('.'))
  assert.ok(!safeFolderName('.hidden').startsWith('.'))
})
test('safeFolderName is never empty', () => {
  assert.equal(safeFolderName(''), '_')
  assert.equal(safeFolderName('   '), '_')
})
test('safeFolderName leaves ordinary names alone', () => {
  assert.equal(safeFolderName('Summer 2019 – Lisbon'), 'Summer 2019 – Lisbon')
})
