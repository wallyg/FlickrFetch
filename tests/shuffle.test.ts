import test from 'node:test'
import assert from 'node:assert/strict'
import { canShuffle, defaultCount, oldestFirst, pickSpread, planPicks, shufflePicks, spreadList, SHUFFLE_MAX } from '../src/renderer/ui/shuffle'
import type { DayPhoto } from '../src/shared/types'

// Which photos the collage maker starts with, and Shuffle (#271): spread evenly across the years, always oldest first.
const photo = (id: string, year: number, time = '10:00:00'): DayPhoto => ({ id, title: id, thumbUrl: '', dateTaken: `${year}-11-26 ${time}`, privacy: 0, media: 'photo' })
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const ids = (l: DayPhoto[]): string => l.map(p => p.id).join(',')
const years = (l: DayPhoto[]): string[] => l.map(p => p.dateTaken.slice(0, 4))
const isOldestFirst = (l: DayPhoto[]): boolean => l.every((p, i) => i === 0 || l[i - 1].dateTaken <= p.dateTaken)

// seven years, the way a real day looks: some years with one photo, some with several
const pool = [
  photo('a1', 2025, '09:00:00'), photo('a2', 2025, '12:00:00'), photo('a3', 2025, '18:00:00'), photo('b1', 2023), photo('c1', 2021, '08:00:00'), photo('c2', 2021, '17:00:00'),
  photo('d1', 2018), photo('e1', 2015, '07:00:00'), photo('e2', 2015, '20:00:00'), photo('f1', 2014), photo('g1', 2013)
]

test('spreadList: evenly spaced, the first and the last always in, a list no longer than asked for comes back whole', () => {
  assert.deepEqual(spreadList([1, 2, 3, 4, 5, 6, 7], 4), [1, 3, 5, 7])
  assert.deepEqual(spreadList([1, 2, 3, 4, 5, 6, 7], 3), [1, 4, 7])
  assert.deepEqual(spreadList([1, 2, 3, 4, 5, 6, 7], 2), [1, 7])
  assert.deepEqual(spreadList([1, 2, 3], 3), [1, 2, 3])
  assert.deepEqual(spreadList([1, 2, 3], 9), [1, 2, 3])
  assert.deepEqual(spreadList([1, 2, 3, 4], 1), [4])   // one: the newest
  assert.deepEqual(spreadList([], 3), [])
})

test('one photo from each year: the years are spread evenly across the range, newest and oldest always in', () => {
  const four = planPicks('years', pool, 4)
  assert.deepEqual(years(four), ['2013', '2015', '2021', '2025'])   // 7 years, 4 wanted: first, two between, last
  const three = planPicks('years', pool, 3)
  assert.deepEqual(years(three), ['2013', '2018', '2025'])
  for (let n = 2; n <= 7; n++) {
    const picks = planPicks('years', pool, n)
    assert.equal(picks.length, n)
    assert.equal(new Set(years(picks)).size, n, `n=${n}: one photo a year`)
    assert.equal(years(picks)[0], '2013'); assert.equal(years(picks)[n - 1], '2025')
  }
})

test('every collage comes out oldest first, and photos from the same year sit together', () => {
  for (let n = 1; n <= SHUFFLE_MAX; n++) {
    for (const mode of ['years', 'year', 'ticked'] as const) {
      const picks = planPicks(mode, pool, n)
      assert.ok(isOldestFirst(picks), `${mode} n=${n}: ${ids(picks)}`)
      const ys = years(picks)
      for (const y of new Set(ys)) assert.ok(ys.lastIndexOf(y) - ys.indexOf(y) === ys.filter(x => x === y).length - 1, `${mode} n=${n}: ${y} is split up`)
    }
  }
  for (let seed = 1; seed <= 50; seed++) assert.ok(isOldestFirst(shufflePicks('years', pool, planPicks('years', pool, 8), 8, rng(seed))))
})

test('more photos than years: one from every year first, then extras from the busiest years, still oldest first', () => {
  const nine = planPicks('years', pool, 8)
  assert.equal(nine.length, 8)
  assert.deepEqual([...new Set(years(nine))].sort(), ['2013', '2014', '2015', '2018', '2021', '2023', '2025'])   // every year is in
  assert.ok(years(nine).filter(y => y === '2025').length >= 2)   // 2025 has the most, so it gives the extra
  assert.ok(isOldestFirst(nine))
})

test('how many photos it opens with: the number of years (at most 6), one year\'s photos (at most 6), every ticked photo (at most 8)', () => {
  assert.equal(defaultCount('years', 7, 26), 6)
  assert.equal(defaultCount('years', 3, 26), 3)
  assert.equal(defaultCount('years', 1, 4), 1)
  assert.equal(defaultCount('year', 7, 7), 6)
  assert.equal(defaultCount('year', 2, 2), 2)
  assert.equal(defaultCount('ticked', 7, 5), 5)
  assert.equal(defaultCount('ticked', 7, 12), 8)
  assert.equal(defaultCount('years', 0, 0), 1)
})

test('one year only and ticked photos: N photos spread through them, oldest first; asking for all of them gives all of them', () => {
  const day = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => photo(`p${i}`, 2021, `0${i === 10 ? 9 : i}:${i === 10 ? '59' : '00'}:00`))
  const some = planPicks('year', day, 4)
  assert.equal(some.length, 4)
  assert.equal(some[0].id, oldestFirst(day)[0].id)
  assert.equal(some[3].id, oldestFirst(day)[9].id)
  assert.equal(planPicks('ticked', day, 10).length, 10)
  assert.equal(planPicks('ticked', day, 99).length, 10)
})

test('Shuffle in One photo from each year: still the newest and oldest year, a different set each time, always the count asked for', () => {
  let current = planPicks('years', pool, 4)
  for (let seed = 1; seed <= 200; seed++) {
    const next = shufflePicks('years', pool, current, 4, rng(seed))
    assert.equal(next.length, 4)
    assert.equal(new Set(years(next)).size, 4)
    assert.equal(years(next)[0], '2013'); assert.equal(years(next)[3], '2025')
    assert.notEqual(ids(next), ids(current))
    current = next
  }
})

test('Shuffle in One year only and Photos you ticked: a different few each time, none from outside the pool', () => {
  const ticked = ['t1', 't2', 't3', 't4', 't5', 't6'].map((id, i) => photo(id, 2022 - i))
  let current = planPicks('ticked', ticked, 3)
  for (let seed = 1; seed <= 100; seed++) {
    const next = shufflePicks('ticked', ticked, current, 3, rng(seed))
    assert.equal(next.length, 3)
    assert.notEqual(ids(next), ids(current))
    assert.equal(new Set(next.map(p => p.id)).size, 3)
    assert.ok(next.every(p => ticked.some(t => t.id === p.id)))
    assert.ok(isOldestFirst(next))
    current = next
  }
})

test('even a run of unlucky dice cannot hand back the same set', () => {
  const two = [photo('t1', 2022), photo('t2', 2021), photo('t3', 2020)]
  const current = planPicks('ticked', two, 2)
  const next = shufflePicks('ticked', two, current, 2, () => 0.999)
  assert.notEqual(ids(next), ids(current))
})

test('it is switched off when there is nothing else to show', () => {
  assert.equal(canShuffle('years', [photo('a', 2022), photo('b', 2021)], 2), false)                       // one photo a year, both shown
  assert.equal(canShuffle('years', pool, 4), true)
  assert.equal(canShuffle('years', [photo('a', 2022), photo('a2', 2022), photo('b', 2021)], 2), true)       // 2022 has a choice
  assert.equal(canShuffle('years', [photo('a', 2022), photo('b', 2021), photo('b2', 2021)], 1), false)      // one photo: the newest year, which has one
  assert.equal(canShuffle('ticked', [photo('t', 2022)], 1), false)
  assert.equal(canShuffle('ticked', [photo('t', 2022), photo('u', 2021)], 2), false)                         // all of them are shown
  assert.equal(canShuffle('ticked', [photo('t', 2022), photo('u', 2021)], 1), true)
  assert.equal(canShuffle('year', [photo('a', 2022), photo('b', 2022)], 2), false)
  assert.equal(canShuffle('year', [photo('a', 2022), photo('b', 2022), photo('c', 2022)], 2), true)
})

test('pickSpread gives the first photo of each year when the dice are not passed in', () => {
  const picks = pickSpread(pool, 7)
  assert.deepEqual(ids(picks).split(','), ['g1', 'f1', 'e1', 'd1', 'c1', 'b1', 'a1'])
})
