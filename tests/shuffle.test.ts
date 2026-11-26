import test from 'node:test'
import assert from 'node:assert/strict'
import { canShuffle, shufflePicks, SHUFFLE_MAX } from '../src/renderer/ui/shuffle'
import type { DayPhoto } from '../src/shared/types'

// Shuffle in the collage maker (#271)
const photo = (id: string, year: number): DayPhoto => ({ id, title: id, thumbUrl: '', dateTaken: `${year}-11-26 10:00:00`, privacy: 0, media: 'photo' })
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const ids = (l: DayPhoto[]): string => l.map(p => p.id).join(',')

const pool = [photo('a1', 2022), photo('a2', 2022), photo('a3', 2022), photo('b1', 2021), photo('c1', 2020), photo('c2', 2020), photo('d1', 2019)]
const first = (): DayPhoto[] => [pool[0], pool[3], pool[4], pool[6]]   // one per year, as the maker starts

test('one photo from each year: the years stay, a year with a choice gets a different photo, a year with one photo keeps it', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const next = shufflePicks('years', pool, [], first(), 4, rng(seed))
    assert.deepEqual(next.map(p => p.dateTaken.slice(0, 4)), ['2022', '2021', '2020', '2019'])
    assert.notEqual(next[0].id, 'a1')            // 2022 had three to choose from
    assert.equal(next[1].id, 'b1')               // 2021 had one
    assert.notEqual(next[2].id, 'c1')            // 2020 had two
    assert.equal(next[3].id, 'd1')
  }
})

test('pressing it again never gives back the photos on screen, while any year has a choice', () => {
  const dice = rng(7)
  let current = first()
  for (let i = 0; i < 200; i++) {
    const next = shufflePicks('years', pool, [], current, 4, dice)
    assert.notEqual(ids(next.slice(0, 4)), ids(current.slice(0, 4)))
    current = next
  }
})

test('ticked photos, more ticked than shown: a different few of them, each photo once, none from outside the ticks', () => {
  const ticked = ['t1', 't2', 't3', 't4', 't5', 't6'].map((id, i) => photo(id, 2022 - i))
  let current = ticked.slice(0, 3)
  for (let seed = 1; seed <= 100; seed++) {
    const next = shufflePicks('ticked', [], ticked, current, 3, rng(seed))
    assert.notEqual(ids(next.slice(0, 3)), ids(current.slice(0, 3)))
    assert.equal(new Set(next.map(p => p.id)).size, next.length)
    assert.ok(next.every(p => ticked.some(t => t.id === p.id)))
    assert.ok(next.length <= SHUFFLE_MAX)
    current = next
  }
})

test('ticked photos, all of them shown: the same photos in a different order', () => {
  const ticked = ['t1', 't2', 't3'].map((id, i) => photo(id, 2022 - i))
  let current = ticked
  for (let seed = 1; seed <= 100; seed++) {      // each press must change the order, whatever the dice say
    const next = shufflePicks('ticked', [], ticked, current, 3, rng(seed))
    assert.deepEqual(next.map(p => p.id).sort(), ['t1', 't2', 't3'])
    assert.notEqual(ids(next), ids(current))
    current = next
  }
})

test('even a run of unlucky dice cannot hand back the same set', () => {
  const ticked = ['t1', 't2'].map((id, i) => photo(id, 2022 - i))
  const next = shufflePicks('ticked', [], ticked, ticked, 2, () => 0.999)   // the dice always say "keep it as it is" (no swap at all)
  assert.notEqual(ids(next), ids(ticked))
})

test('it is switched off when there is nothing else to show', () => {
  assert.equal(canShuffle('years', [photo('a', 2022), photo('b', 2021)], [], 2), false)       // one photo a year
  assert.equal(canShuffle('years', pool, [], 4), true)
  assert.equal(canShuffle('years', [photo('a', 2022), photo('a2', 2022), photo('b', 2021)], [], 1), true)
  assert.equal(canShuffle('years', [photo('a', 2022), photo('b', 2021), photo('b2', 2021)], [], 1), false)   // only the newest year is on screen, and it has one
  assert.equal(canShuffle('ticked', [], [photo('t', 2022)], 1), false)
  assert.equal(canShuffle('ticked', [], [photo('t', 2022), photo('u', 2021)], 2), true)
})

test('the collage window has the Shuffle button, switched off when canShuffle says there is nothing else', async () => {
  const { readFileSync } = await import('node:fs')
  const code = readFileSync('src/renderer/components/ShareDialog.tsx', 'utf8')
  assert.match(code, /disabled=\{!canShuffle\(mode, poolPhotos, tickedPhotos, shownCount\)\}/)
  assert.match(code, /shufflePicks\(mode, poolPhotos, tickedPhotos, chosen, shownCount\)/)
  assert.match(code, /shuffled\.key === pickMode/)   // changing the source or public-only goes back to the first set
})
