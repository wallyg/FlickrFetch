import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, getDb } from '../src/main/database'
import { computeLibraryStats, topTagsWithGroups } from '../src/main/libraryStats'
import { makeLookup, type Topo } from '../src/main/placeLookup'
import countriesTopo from '../src/renderer/assets/countries-50m.json'
import statesTopo from '../src/renderer/assets/states-us.json'
import { addPhotos, addTag, addAlbum, libraryTables } from './helpers'

// The library dashboard's numbers (#220): what counts, what is left out, and the country and state lookup.
const countries = makeLookup(countriesTopo as unknown as Topo, 'countries')
const states = makeLookup(statesTopo as unknown as Topo, 'states')

test('a point is placed in its country and its US state, from the outlines on this computer', () => {
  assert.equal(countries.find(-104.99, 39.74), 'United States of America')     // Denver
  assert.equal(states.find(-104.99, 39.74), 'Colorado')
  assert.equal(states.locate(-73.9855, 40.758, 0.25), 'New York')              // Times Square: on a coast, so the nearest outline within a little
  assert.equal(states.locate(-74.0445, 40.7178, 0.25), 'New Jersey')           // Jersey City
  assert.equal(countries.locate(-73.9855, 40.758, 1), 'United States of America')
  assert.equal(countries.find(2.3522, 48.8566), 'France')
  assert.equal(countries.find(139.69, 35.69), 'Japan')
})

test('a sea point inside a big country\'s bounding box is not counted as that country', () => {
  assert.equal(countries.locate(-90, 25, 1), null)        // the middle of the Gulf of Mexico: inside the United States mainland box, far from its coast
  assert.equal(countries.locate(-70, 30, 1), null)        // the Atlantic off the Carolinas, again inside the box
  assert.equal(countries.locate(-73.97, 40.4, 1), 'United States of America')   // a little off the New Jersey coast is still near it
})

test('a point at sea or in the wrong place belongs to no country, and a point just off a coast takes the nearest one', () => {
  assert.equal(countries.locate(-30, 0, 1), null)          // the middle of the Atlantic
  assert.equal(countries.locate(-21.9, -81.1, 1), null)    // a geotag in Antarctica's sea ice (not a country)
  assert.equal(countries.locate(-73.97, 40.4, 1), 'United States of America')   // a little out to sea off New Jersey
})

before(() => {
  openDatabase('library@N00')
  const db = getDb()!
  libraryTables(db)
  const day = (d: string, t = '12:00:00'): string => `${d} ${t}`
  addPhotos(db, [
    { id: 'a1', taken: day('2020-01-01', '09:10:00'), uploaded: 1580000000, lat: 40.758, lon: -73.9855, accuracy: 16 },
    { id: 'a2', taken: day('2020-01-02', '09:20:00'), uploaded: 1580000000, lat: 40.758, lon: -73.9855, accuracy: 16 },
    { id: 'a3', taken: day('2020-01-03', '09:30:00'), uploaded: 1580000000, lat: 48.8566, lon: 2.3522, accuracy: 12 },
    { id: 'a4', taken: day('2020-01-10', '00:00:00'), uploaded: 1580000000, privacy: 3 },                      // a date with no time of day
    { id: 'a5', taken: day('2021-05-05', '10:00:00'), privacy: 1, media: 'video' },
    { id: 'a6', taken: day('2021-05-06', '10:05:00'), privacy: 2 },
    { id: 'a7', taken: day('2021-05-07', '10:10:00'), privacy: 4 },
    { id: 'g1', taken: day('1970-01-01'), privacy: 0 },                                                         // a placeholder day
    { id: 'g2', taken: day('2020-06-06'), privacy: 0 }                                                          // marked as a guess by Flickr
  ])
  db.prepare("UPDATE photo_meta SET date_unknown = 1 WHERE photo_id = 'g2'").run()
  db.prepare("UPDATE photo_meta SET has_description = 1, has_tags = 1 WHERE photo_id IN ('a1', 'a2')").run()
  // twenty photos at one spot that is in no country
  addPhotos(db, Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, taken: day('2022-02-02', `10:${String(i).padStart(2, '0')}:00`), lat: -81.1, lon: -21.9, accuracy: 3 })))
  addTag(db, 'Paris', ['a3']); addTag(db, 'New York', ['a1', 'a2'])
  addAlbum(db, 'al1', 'Trip', ['a1', 'a2', 'a3']); addAlbum(db, 'al2', 'Small', ['a4'])
})

test('totals count photos and videos apart, and the library as a whole', () => {
  const s = computeLibraryStats(getDb()!)
  assert.equal(s.items, 29); assert.equal(s.videos, 1); assert.equal(s.photos, 28)
  assert.equal(s.albums, 2); assert.equal(s.tags, 2); assert.equal(s.smallAlbums, 2)   // both albums hold fewer than 10
})

test('guessed and placeholder dates are counted apart and left out of every date chart and record', () => {
  const s = computeLibraryStats(getDb()!)
  assert.equal(s.guessed.items, 2)
  assert.equal(s.years.find(y => y.year === '1970'), undefined)
  assert.equal(s.years.find(y => y.year === '2020')?.taken, 4)               // not the guessed 2020-06-06
  assert.equal(s.months.reduce((a, b) => a + b, 0), 27)                       // 29 items, 2 guessed
  assert.equal(s.records.oldest, '2020-01-01')
})

test('hours leave out a date with no time of day, and the burst is the busiest clock hour', () => {
  const s = computeLibraryStats(getDb()!)
  assert.equal(s.hours[0], 0)                                                 // a4 has 00:00:00: no time recorded
  assert.equal(s.hours[10], 23)                                               // a5 to a7 and the twenty at 10:00 to 10:19
  assert.deepEqual(s.records.burst, { hour: '2022-02-02 10', items: 20 })
})

test('the streak is the most days in a row, and the quiet spell the longest gap since the library became busy', () => {
  const s = computeLibraryStats(getDb()!)
  assert.deepEqual(s.records.streak, { days: 3, from: '2020-01-01' })
  assert.equal(s.records.quiet?.since, '2020')
  assert.equal(s.records.quiet?.days, 480)                                    // 11 Jan 2020 to 4 May 2021, both ends included
  assert.equal(s.records.quiet?.from, '2020-01-11')
  assert.equal(s.records.quiet?.to, '2021-05-04')
})

test('who can see them: friends only and family only are one group', () => {
  const s = computeLibraryStats(getDb()!)
  assert.deepEqual(s.visibility, { public: 25, friendsFamily: 1, onlyOne: 2, private: 1 })
})

test('where: countries, US states, and one spot in no country', () => {
  const s = computeLibraryStats(getDb()!)
  assert.deepEqual(s.places.countries.map(c => [c.name, c.items]), [['United States', 2], ['France', 1]])
  assert.deepEqual([s.places.countries[0].lat, s.places.countries[0].lon], [40.76, -73.99])   // the busiest spot, for the Map
  assert.deepEqual(s.places.states.map(c => [c.name, c.items]), [['New York', 2]])
  assert.equal(s.places.usItems, 2)
  assert.deepEqual(s.places.strayAt, { lat: -81.1, lon: -21.9, items: 20 })
  assert.equal(s.precision.street, 2); assert.equal(s.precision.town, 1); assert.equal(s.precision.vague, 20)
})

test('what is filled in, and the most-used tags and albums', () => {
  const s = computeLibraryStats(getDb()!)
  assert.equal(s.filled.description, 2)
  assert.deepEqual(s.topTags.map(t => [t.name, t.items]), [['New York', 2], ['Paris', 1]])
  assert.deepEqual(s.topAlbums.map(t => [t.name, t.items]), [['Trip', 3], ['Small', 1]])
  assert.deepEqual(s.topAlbums.map(t => t.id), ['al1', 'al2'])
})

test('tags on nearly the same photos share a group; a tag on a few of the same photos does not', () => {
  const db = getDb()!
  const ids = (p: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${p}${i}`)
  addTag(db, 'Big Apple', ids('g', 100)); addTag(db, 'The Big Apple', [...ids('g', 96), 'h1'])     // nearly the same photos
  addTag(db, 'Borough', ids('g', 30))                                                      // some of them: a part of a place, not the same thing
  addPhotos(db, ids('g', 100).map(id => ({ id, taken: '2023-03-03 10:00:00' })))   // a library of a few hundred, so these tags are a fair share of it
  addPhotos(db, ids('z', 300).map(id => ({ id, taken: '2023-04-04 10:00:00' })))
  const items = (db.prepare('SELECT COUNT(*) AS n FROM photo_meta').get() as { n: number }).n
  const top = topTagsWithGroups(db, items)
  const group = (name: string): number | undefined => top.find(t => t.name === name)?.group
  assert.ok(group('Big Apple') !== undefined && group('Big Apple') === group('The Big Apple'))
  assert.equal(group('Borough'), undefined)
})

test('the safeguards: a tag on nearly every photo, and a very small tag, are left out of the same-photos comparison', () => {
  const db = getDb()!
  const ids = (p: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${p}${i}`)
  const items = (db.prepare('SELECT COUNT(*) AS n FROM photo_meta').get() as { n: number }).n
  const everything = Array.from({ length: items }, (_, i) => (db.prepare('SELECT photo_id FROM photo_meta LIMIT 1 OFFSET ?').get(i) as { photo_id: string }).photo_id)
  addTag(db, 'Everywhere', everything); addTag(db, 'On Every One', everything.slice(0, everything.length - 2))   // two tags on nearly every photo
  addTag(db, 'Tiny One', ids('q', 5)); addTag(db, 'Tiny Two', ids('q', 5))                                       // two small tags on the same few photos
  const top = topTagsWithGroups(db, items)
  const group = (name: string): number | undefined => top.find(t => t.name === name)?.group
  assert.equal(group('Everywhere'), undefined); assert.equal(group('On Every One'), undefined)
  assert.equal(group('Tiny One'), undefined); assert.equal(group('Tiny Two'), undefined)
})
