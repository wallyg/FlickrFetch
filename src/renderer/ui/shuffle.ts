import type { DayPhoto } from '../../shared/types'

// Shuffle in the collage maker (#271): pick a fresh set of photos for the same day, without choosing them one by one.
//   - One photo from each year: a different photo for each year that has more than one that day; the years stay the same.
//   - Photos you ticked: if more were ticked than are shown, a different few of them; if all are shown, the same ones in a different order.
//   - One year only (#164): a different few of that year's photos.
// Pressing it again never gives back the set that is on screen when there is anything else to give. `rand` is passed in so a test can fix the dice.

export type ShuffleMode = 'years' | 'ticked' | 'year'
export const SHUFFLE_MAX = 8   // the most photos a collage holds

const yearOf = (p: DayPhoto): string => p.dateTaken.slice(0, 4)
const pickOne = <T,>(list: T[], rand: () => number): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]
function permute<T>(list: T[], rand: () => number): T[] {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const yearsNewestFirst = (pool: DayPhoto[]): string[] => [...new Set(pool.map(yearOf))].sort((a, b) => (a < b ? 1 : -1)).slice(0, SHUFFLE_MAX)

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

/** Is there anything else to show? Only the photos that are on screen count: the `count` newest years, or the ticked photos. */
export function canShuffle(mode: ShuffleMode, pool: DayPhoto[], ticked: DayPhoto[], count: number): boolean {
  if (mode === 'ticked') return ticked.length >= 2
  if (mode === 'year') return pool.length > Math.max(1, count)
  return yearsNewestFirst(pool).slice(0, Math.max(1, count)).some(y => pool.filter(p => yearOf(p) === y).length > 1)
}

/** The new list of photos, in the order the collage uses them (its first `count` are the ones shown). */
export function shufflePicks(mode: ShuffleMode, pool: DayPhoto[], ticked: DayPhoto[], current: DayPhoto[], count: number, rand: () => number = Math.random): DayPhoto[] {
  if (mode === 'year') {
    const same = (l: DayPhoto[]): string => l.slice(0, count).map(p => p.id).join(',')
    if (pool.length < 2) return pool.slice()
    for (let i = 0; i < 40; i++) {
      const next = permute(pool, rand).slice(0, SHUFFLE_MAX)
      if (pool.length <= count || same(next) !== same(current)) return next
    }
    return [...pool.slice(1), pool[0]].slice(0, SHUFFLE_MAX)
  }
  if (mode === 'years') {
    const firsts = yearsNewestFirst(pool).map(y => {
      const options = pool.filter(p => yearOf(p) === y)
      const now = current.find(p => yearOf(p) === y)
      const others = options.length > 1 && now ? options.filter(p => p.id !== now.id) : options
      return pickOne(others, rand)
    })
    return withExtras(firsts, pool, SHUFFLE_MAX, rand)
  }
  const list = ticked.slice()
  if (list.length < 2) return list.slice(0, SHUFFLE_MAX)
  const shown = (l: DayPhoto[]): string => l.slice(0, count).map(p => p.id).join(',')
  const before = shown(current)
  for (let i = 0; i < 40; i++) {
    const next = permute(list, rand).slice(0, SHUFFLE_MAX)
    if (shown(next) !== before) return next
  }
  const turned = [...list.slice(1), list[0]].slice(0, SHUFFLE_MAX)   // the dice kept giving the same set: turn the list one place
  return turned
}
