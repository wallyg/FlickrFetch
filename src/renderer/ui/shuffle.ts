import type { DayPhoto } from '../../shared/types'

// Which photos the collage maker starts with, and Shuffle (#271). The photos always come out oldest first, so photos from the same year sit together.
//   - One photo from each year: the years are spread evenly across the range (the newest and the oldest always in); one photo from each. With more
//     photos than years, the busiest years give a second, third and so on.
//   - One year only (#164): the photos spread evenly through that year's day.
//   - Photos you ticked: all of them, or when fewer are wanted, spread evenly through them.
// Shuffle gives a different set for the same choices. Pressing it again never gives back the set on screen when there is anything else to give.
// `rand` is passed in so a test can fix the dice.

export type ShuffleMode = 'years' | 'ticked' | 'year'
export const SHUFFLE_MAX = 8   // the most photos a collage holds
export const START_MAX = 6     // a collage opens with at most this many photos

const yearOf = (p: DayPhoto): string => p.dateTaken.slice(0, 4)
const pickOne = <T,>(list: T[], rand: () => number): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]
function permute<T>(list: T[], rand: () => number): T[] {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const ids = (l: DayPhoto[]): string => l.map(p => p.id).join(',')

/** Oldest first; photos taken in the same year stay together, in the order they were taken (a tie keeps the id order). */
export const oldestFirst = (list: DayPhoto[]): DayPhoto[] => list.slice().sort((a, b) => (a.dateTaken < b.dateTaken ? -1 : a.dateTaken > b.dateTaken ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** `k` items evenly spread through the list, the first and the last always in (a list that is not longer than `k` comes back whole). */
export function spreadList<T>(list: T[], k: number): T[] {
  const m = list.length
  if (k >= m) return list.slice()
  if (k <= 0) return []
  if (k === 1) return [list[m - 1]]   // one photo: the newest
  const out: T[] = []
  const seen = new Set<number>()
  for (let i = 0; i < k; i++) { const at = Math.round((i * (m - 1)) / (k - 1)); if (!seen.has(at)) { seen.add(at); out.push(list[at]) } }
  return out
}

/** The same, with the middle ones moved a place or so at random (the first and the last stay), so Shuffle can give other years too. */
function jitterSpread<T>(list: T[], k: number, rand: () => number): T[] {
  const m = list.length
  if (k >= m || k <= 2) return spreadList(list, k)
  const picked = [0]
  for (let i = 1; i < k - 1; i++) {
    const target = (i * (m - 1)) / (k - 1)
    const lo = Math.max(picked[picked.length - 1] + 1, Math.round(target) - 1)
    const hi = Math.min(m - 1 - (k - 1 - i), Math.round(target) + 1)
    picked.push(lo >= hi ? Math.max(lo, picked[picked.length - 1] + 1) : lo + Math.floor(rand() * (hi - lo + 1)))
  }
  picked.push(m - 1)
  return picked.map(i => list[i])
}

/**
 * One photo per year, then, while there is room, extra photos from the years with the most (so a collage of more photos than years still fills).
 * The extras come after the year photos, busiest year first and, within a year, in the pool's order.
 */
export function withExtras(list: DayPhoto[], pool: DayPhoto[], max: number = SHUFFLE_MAX, rand?: () => number): DayPhoto[] {
  if (list.length >= max) return list.slice(0, max)
  const taken = new Set(list.map(p => p.id))
  const perYear = new Map<string, DayPhoto[]>()
  for (const p of pool) if (!taken.has(p.id)) { const y = yearOf(p); perYear.set(y, [...(perYear.get(y) ?? []), p]) }
  const years = [...perYear.keys()].sort((a, b) => (perYear.get(b)!.length - perYear.get(a)!.length) || (a < b ? 1 : -1))
  const out = list.slice()
  // take one extra from each year in turn, busiest first, until the room is used
  for (let round = 0; out.length < max; round++) {
    let added = false
    for (const y of years) {
      const more = perYear.get(y)!
      if (round < more.length && out.length < max) { out.push(rand ? more[Math.min(more.length - 1, Math.floor(rand() * more.length))] : more[round]); added = true }
    }
    if (!added) break
  }
  return out
}

const yearsOldestFirst = (pool: DayPhoto[]): string[] => [...new Set(pool.map(yearOf))].sort()

/** The photos for `n`: one from each of `n` years spread evenly (more than the years there are: extras from the busiest), oldest first. */
export function pickSpread(pool: DayPhoto[], n: number, rand?: () => number, jitter = false): DayPhoto[] {
  const years = yearsOldestFirst(pool)
  const use = jitter && rand ? jitterSpread(years, Math.min(n, years.length), rand) : spreadList(years, Math.min(n, years.length))
  const firsts = use.map(y => { const options = pool.filter(p => yearOf(p) === y); return rand ? pickOne(options, rand) : options[0] })
  return oldestFirst(withExtras(firsts, pool, n, rand))
}

/** The photos a collage of `n` opens with for this source: the same every time. */
export function planPicks(mode: ShuffleMode, pool: DayPhoto[], n: number): DayPhoto[] {
  if (n <= 0 || pool.length === 0) return []
  if (mode === 'years') return pickSpread(pool, n)
  return spreadList(oldestFirst(pool), Math.min(n, pool.length))
}

/** How many photos a collage opens with: the number of years (at most 6), or that year's photos (at most 6), or all the ticked ones. */
export function defaultCount(mode: ShuffleMode, yearCount: number, poolSize: number): number {
  const n = mode === 'years' ? Math.min(yearCount, START_MAX) : mode === 'year' ? Math.min(poolSize, START_MAX) : Math.min(poolSize, SHUFFLE_MAX)
  return Math.max(1, n)
}

/** Is there anything else to show? */
export function canShuffle(mode: ShuffleMode, pool: DayPhoto[], count: number): boolean {
  if (mode !== 'years') return pool.length > Math.max(1, count)
  const years = yearsOldestFirst(pool)
  const k = Math.min(Math.max(1, count), years.length)
  if (count > years.length && pool.length > count) return true                                  // extras to choose between
  if (k >= 3 && years.length > k) return true                                                    // other years in the middle
  return spreadList(years, k).some(y => pool.filter(p => yearOf(p) === y).length > 1)           // a year with a choice of photos
}

/** A different set of `count` photos, oldest first, for the same choices. */
export function shufflePicks(mode: ShuffleMode, pool: DayPhoto[], current: DayPhoto[], count: number, rand: () => number = Math.random): DayPhoto[] {
  const n = Math.max(1, Math.min(count, SHUFFLE_MAX))
  if (pool.length === 0) return []
  const before = ids(current.slice(0, n))
  for (let i = 0; i < 60; i++) {
    const next = mode === 'years'
      ? pickSpread(pool, n, rand, true)
      : oldestFirst(permute(pool, rand).slice(0, Math.min(n, pool.length)))
    if (ids(next) !== before || !canShuffle(mode, pool, n)) return next
  }
  // the dice kept giving the same set: take the next photos along, or the same ones turned over by one
  const turned = oldestFirst([...pool.slice(1), pool[0]].slice(0, Math.min(n, pool.length)))
  return turned
}
