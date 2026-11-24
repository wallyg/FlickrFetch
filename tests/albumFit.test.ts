import test from 'node:test'
import assert from 'node:assert/strict'
import { compute, levelFrom, loadPhotoInfos, nearbyPhotos, titleRulesOn, type Info } from '../src/main/albumFit'
import { addAlbum, addPhotos, farDate, memoryDb, type PhotoRow } from './helpers'

const info = (o: Partial<Info>): Info => ({ date: '2020-05-01', ts: 1000, lat: 48.85, lon: 2.35, title: '', thumb: '', ...o })

// ---- the settings turned into working numbers
test('with nothing set, the standard numbers are used', () => {
  const l = levelFrom({})
  assert.equal(l.share, 0.95); assert.equal(l.gap, 45); assert.equal(l.nearSeconds, 30 * 60); assert.equal(l.nearKm, 0.3)
  assert.equal(l.titleMode, 1); assert.equal(l.titleAuto, 0.3); assert.equal(l.vouch, 0.5); assert.equal(l.bothOnly, false)
})
test('numbers outside the allowed range are pulled back into it', () => {
  const l = levelFrom({ nearMinutes: 9999, nearMeters: 1, share: 5, vouchShare: 500 })
  assert.equal(l.nearSeconds, 240 * 60); assert.equal(l.nearKm, 0.02); assert.equal(l.share, 0.7); assert.equal(l.vouch, 1)
})
test('values that are not numbers fall back to the standard', () => {
  const l = levelFrom({ nearMinutes: 'soon' as unknown as number, titleMin: NaN })
  assert.equal(l.nearSeconds, 30 * 60); assert.equal(l.titleMin, 5)
})

// ---- reading dates and times
test('a date taken at exactly midnight has a date but no time', () => {
  const db = memoryDb()
  addPhotos(db, [{ id: 'a', taken: '2020-05-01 00:00:00' }, { id: 'b', taken: '2020-05-01 12:30:00' }, { id: 'c', taken: '1985-01-01 10:00:00' }, { id: 'd', taken: '' }])
  const i = loadPhotoInfos(db)
  assert.equal(i.get('a')!.date, '2020-05-01'); assert.equal(i.get('a')!.ts, null)
  assert.equal(i.get('b')!.ts, Date.parse('2020-05-01T12:30:00Z') / 1000)
  assert.equal(i.get('c')!.date, '')      // before 1990: a camera clock that was never set
  assert.equal(i.get('d')!.ts, null)
})

// ---- photos taken close together in time and place
test('photos within the time and distance are neighbours, both ways', () => {
  const m = new Map<string, Info>([['a', info({ ts: 1000 })], ['b', info({ ts: 1000 + 600, lon: 2.3501 })]])
  const n = nearbyPhotos(m, 1800, 0.3)
  assert.deepEqual(n.get('a'), ['b']); assert.deepEqual(n.get('b'), ['a'])
})
test('too far apart in time, or in distance, they are not neighbours', () => {
  const m = new Map<string, Info>([['a', info({ ts: 1000 })], ['late', info({ ts: 1000 + 3600 })], ['far', info({ ts: 1100, lat: 48.86 })]])
  assert.equal(nearbyPhotos(m, 1800, 0.3).size, 0)
})
test('photos without a time or a place have no neighbours', () => {
  const m = new Map<string, Info>([['a', info({})], ['notime', info({ ts: null })], ['noplace', info({ lat: null, lon: null })]])
  assert.equal(nearbyPhotos(m, 1800, 0.3).size, 0)
})
test('the same time on different days is not nearby', () => {
  const m = new Map<string, Info>([['a', info({ date: '2020-05-01' })], ['b', info({ date: '2020-05-02' })]])
  assert.equal(nearbyPhotos(m, 1800, 0.3).size, 0)
})

// ---- when the title rules switch on
test('the title rules switch on when enough titles start with a place', () => {
  const m = new Map<string, Info>([['a', info({ title: 'Paris: Louvre' })], ['b', info({ title: 'Paris: Seine' })], ['c', info({ title: 'IMG_0001' })]])
  assert.equal(titleRulesOn(m, levelFrom({})), true)
  assert.equal(titleRulesOn(m, levelFrom({ titleAutoMin: 90 })), false)   // 2 of 3 is under 90%
  assert.equal(titleRulesOn(m, levelFrom({ titleMode: 0 })), false)       // switched off
  assert.equal(titleRulesOn(new Map(), levelFrom({})), false)
})

// ---- the album rules, run on a small made-up library
const PARIS = { lat: 48.8566, lon: 2.3522 }
const jitter = (i: number): { lat: number; lon: number } => ({ lat: PARIS.lat + (i % 10) * 0.0001, lon: PARIS.lon + Math.floor(i / 10) * 0.0001 })

// 100 photos of a Paris album, each on its own far-apart date, no times. Extra rows can be added and put in the album.
function parisAlbum(extra: PhotoRow[] = [], kind = 'place'): ReturnType<typeof memoryDb> {
  const db = memoryDb()
  const rows: PhotoRow[] = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, taken: `${farDate(i)} 00:00:00`, ...jitter(i) }))
  addPhotos(db, [...rows, ...extra])
  addAlbum(db, 'A', 'Paris', [...rows, ...extra].map(r => r.id), kind)
  return db
}
const flagged = (db: ReturnType<typeof memoryDb>, level = levelFrom({})): Map<string, string[]> => {
  const m = new Map<string, string[]>()
  for (const f of compute(db, level).misfits) m.set(f.photoId, f.types)
  return m
}

test('a photo far from the rest of a place album may not fit', () => {
  const db = parisAlbum([{ id: 'ny', taken: `${farDate(200)} 00:00:00`, lat: 40.71, lon: -74.0 }])
  const f = flagged(db)
  assert.deepEqual([...f.keys()], ['ny']); assert.ok(f.get('ny')!.includes('place'))
})
test('an album with no stray photos flags nothing', () => {
  assert.equal(flagged(parisAlbum()).size, 0)
})
test('a small album is left alone', () => {
  const db = memoryDb()
  const rows: PhotoRow[] = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, taken: `${farDate(i)} 00:00:00`, ...jitter(i) }))
  addPhotos(db, [...rows, { id: 'ny', taken: `${farDate(40)} 00:00:00`, lat: 40.71, lon: -74.0 }])
  addAlbum(db, 'A', 'Paris', [...rows.map(r => r.id), 'ny'])      // 13 photos and no chosen kind: too few to judge
  assert.equal(flagged(db).size, 0)
})
test('an album you mark "anything" is never judged', () => {
  assert.equal(flagged(parisAlbum([{ id: 'ny', taken: `${farDate(200)} 00:00:00`, lat: 40.71, lon: -74.0 }], 'anything')).size, 0)
})

// Four photos taken a minute apart in one spot, away from the rest of the album: an outing. Beside each other, they vouch for each other.
const outing = (lat: number, lon: number): PhotoRow[] =>
  [0, 1, 2, 3].map(i => ({ id: `o${i}`, taken: `2015-06-01 12:0${i}:00`, lat, lon: lon + i * 0.00005 }))
test('photos taken beside each other, mostly in the album, vouch for each other', () => {
  const near = outing(PARIS.lat + 0.008, PARIS.lon)      // under a kilometre from the album's middle
  assert.equal(flagged(parisAlbum(near)).size, 0)
  assert.equal(flagged(parisAlbum(near), levelFrom({ vouchShare: 0 })).size, 4)   // with vouching off they are all flagged
})
test('vouching never clears a photo far outside the album’s area', () => {
  const faraway = outing(PARIS.lat + 1.0, PARIS.lon)     // about 110 km away
  assert.equal(flagged(parisAlbum(faraway)).size, 4)
})

// Photos that may belong: five members and a non-member photographed within minutes in one spot
function withBeside(): ReturnType<typeof memoryDb> {
  const db = memoryDb()
  const members: PhotoRow[] = [0, 1, 2, 3, 4].map(i => ({ id: `m${i}`, taken: `2018-03-03 10:0${i}:00`, lat: PARIS.lat, lon: PARIS.lon }))
  const rest: PhotoRow[] = Array.from({ length: 35 }, (_, i) => ({ id: `r${i}`, taken: `${farDate(i)} 00:00:00`, ...jitter(i) }))
  addPhotos(db, [...members, ...rest, { id: 'x', taken: '2018-03-03 10:02:30', lat: PARIS.lat, lon: PARIS.lon }])
  addAlbum(db, 'A', 'Paris', [...members, ...rest].map(r => r.id), 'place')
  return db
}
test('a photo taken right beside the album’s photos may belong to it', () => {
  const miss = compute(withBeside(), levelFrom({})).missing
  assert.equal(miss.length, 1); assert.deepEqual(miss[0].photoIds, ['x'])
})
test('"both signals only" holds back a photo only one signal suggests', () => {
  assert.equal(compute(withBeside(), levelFrom({ bothOnly: 1 })).missing.length, 0)
})

// Titles name the place: a photo titled for one place, filed in the album of another
function twoPlaces(strayTitle: string, alsoIn: boolean): ReturnType<typeof memoryDb> {
  const db = memoryDb()
  const LOUVRE = { lat: 48.8606, lon: 2.3376 }, EIFFEL = { lat: 48.8584, lon: 2.2945 }
  const mk = (prefix: string, title: string, at: { lat: number; lon: number }): PhotoRow[] =>
    Array.from({ length: 30 }, (_, i) => ({ id: `${prefix}${i}`, title: `${title} ${i}`, taken: `${farDate(i + (prefix === 'e' ? 40 : 0))} 00:00:00`, lat: at.lat + i * 0.00002, lon: at.lon }))
  const louvre = mk('l', 'Paris - Louvre: Gallery', LOUVRE), eiffel = mk('e', 'Paris - Eiffel: Tower', EIFFEL)
  const stray: PhotoRow = { id: 'stray', title: strayTitle, taken: `${farDate(90)} 00:00:00`, lat: EIFFEL.lat, lon: EIFFEL.lon }
  addPhotos(db, [...louvre, ...eiffel, stray])
  addAlbum(db, 'L', 'Paris: Louvre', [...louvre.map(r => r.id), 'stray'], 'place')
  addAlbum(db, 'E', 'Paris: Eiffel', [...eiffel.map(r => r.id), ...(alsoIn ? ['stray'] : [])], 'place')
  return db
}
const strayFlag = (db: ReturnType<typeof memoryDb>, level = levelFrom({})): string[] => compute(db, level).misfits.filter(m => m.photoId === 'stray' && m.albumId === 'L').flatMap(m => m.types)
test('a photo whose title names another place may be in the wrong album', () => {
  assert.ok(strayFlag(twoPlaces('Paris - Eiffel: Selfie', false)).includes('wrong'))
})
test('a photo in two albums for different places is called out', () => {
  assert.ok(strayFlag(twoPlaces('Paris - Eiffel: Selfie', true)).includes('double'))
})
test('when the title supports the album, it is not called a wrong album', () => {
  assert.ok(!strayFlag(twoPlaces('Paris - Louvre: Selfie', false)).includes('wrong'))
})
test('the wrong-album rule can be switched off', () => {
  assert.ok(!strayFlag(twoPlaces('Paris - Eiffel: Selfie', false), levelFrom({ wrongOn: 0 })).includes('wrong'))
})
test('with titles switched off there is no wrong-album call from them', () => {
  assert.ok(!strayFlag(twoPlaces('Paris - Eiffel: Selfie', false), levelFrom({ titleMode: 0 })).includes('wrong'))
})

// ---- what the app would pick versus what you chose (the album settings list shows both)
test('an album you chose keeps the app\'s own pick, so the list can offer Reset', () => {
  const stray = [{ id: 'ny', taken: `${farDate(200)} 00:00:00`, lat: 40.71, lon: -74.0 }]
  const chosen = compute(parisAlbum(stray, 'anything'), levelFrom({})).profiles.get('A')!
  assert.equal(chosen.kind, 'anything'); assert.equal(chosen.pick, 'place'); assert.equal(chosen.guessed, false)
  const left = compute(parisAlbum(stray, ''), levelFrom({})).profiles.get('A')!
  assert.equal(left.kind, 'place'); assert.equal(left.pick, 'place'); assert.equal(left.guessed, true)
})
