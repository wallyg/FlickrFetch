import type { LibraryStats, Named } from './types'

// The sentences under the dashboard's cards (the "insights") and the sizes of its Top 5 / Top 10 / Top 25 control. All of them are worked out from the
// numbers, so they stay true when the library changes, and each one says nothing when there is nothing worth saying.

const fmt = (n: number): string => n.toLocaleString('en-US')

/** "46%", "99.9%", "under 1%": whole numbers, a decimal near the ends, never 100% while something is left. */
export function percent(part: number, whole: number): string {
  if (whole <= 0) return '0%'
  const p = (part / whole) * 100
  if (part > 0 && p < 1) return p < 0.1 ? 'under 0.1%' : `${p.toFixed(1)}%`
  if (p < 10) { const r = Math.round(p * 10) / 10; return `${Number.isInteger(r) ? r : r.toFixed(1)}%` }   // 1.6%, 5.9%: a small share needs its decimal
  if (p >= 99 && p < 100) { const r = Math.round(p * 10) / 10; return r >= 100 ? '99.9%' : `${r}%` }   // 99.88 is 99.9%, but never 100% while something is left
  if (part < whole && Math.round(p) === 100) return '99.9%'
  return `${Math.round(p)}%`
}

type Year = { year: string; count: number }
const yearsOf = (stats: LibraryStats, series: 'taken' | 'uploaded'): Year[] => stats.years.map(y => ({ year: y.year, count: y[series] })).filter(y => y.count > 0)

// ── Over time ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The run of `len` calendar years that holds the most, with its share of the whole. */
export function busiestRun(years: Year[], len = 6): { from: string; to: string; share: number } | null {
  if (years.length === 0) return null
  const total = years.reduce((n, y) => n + y.count, 0)
  const by = new Map(years.map(y => [Number(y.year), y.count]))
  const first = Math.min(...by.keys()), last = Math.max(...by.keys())
  let best: { from: number; sum: number } | null = null
  for (let start = first; start + len - 1 <= Math.max(last, first + len - 1); start++) {
    let sum = 0
    for (let y = start; y < start + len; y++) sum += by.get(y) ?? 0
    if (!best || sum > best.sum) best = { from: start, sum }
  }
  return best ? { from: String(best.from), to: String(best.from + len - 1), share: best.sum / total } : null
}

export function yearInsight(stats: LibraryStats, series: 'taken' | 'uploaded', thisYear: number): string {
  const years = yearsOf(stats, series)
  if (years.length < 3) return ''
  if (series === 'uploaded') {
    const top = [...years].sort((a, b) => b.count - a.count).slice(0, 3)
    const names = top.map(t => t.year)
    return `Your biggest upload years were ${names[0]}, ${names[1]} and ${names[2]}.`
  }
  const parts: string[] = []
  const run = busiestRun(years)
  if (run && run.share >= 0.3) parts.push(`${run.from} to ${run.to} hold ${percent(run.share * 100, 100)} of everything you have taken.`)
  else { const top = [...years].sort((a, b) => b.count - a.count)[0]; parts.push(`Your busiest year is ${top.year}, with ${fmt(top.count)} items.`) }
  // The last full year, when it is the biggest in a good while after a real low
  const full = years.find(y => Number(y.year) === thisYear - 1)
  if (full) {
    const earlier = years.filter(y => Number(y.year) < thisYear - 1 && y.count >= full.count).map(y => Number(y.year))
    const since = earlier.length ? Math.max(...earlier) : null
    if (since !== null && thisYear - 1 - since >= 3) {
      const between = years.filter(y => Number(y.year) > since && Number(y.year) < thisYear - 1)
      const low = between.sort((a, b) => a.count - b.count)[0]
      if (low && low.count < full.count * 0.6) parts.push(`${full.year}, with ${fmt(full.count)} items, is your biggest year since ${since}, after a low of ${fmt(low.count)} in ${low.year}.`)
    }
  }
  return parts.join(' ')
}

export function decadesOf(stats: LibraryStats, series: 'taken' | 'uploaded'): { decade: string; count: number }[] {
  const out = new Map<string, number>()
  for (const y of stats.years) {
    const d = `${y.year.slice(0, 3)}0s`
    out.set(d, (out.get(d) ?? 0) + y[series])
  }
  return [...out.entries()].map(([decade, count]) => ({ decade, count })).sort((a, b) => a.decade.localeCompare(b.decade))
}

export function decadeInsight(stats: LibraryStats, series: 'taken' | 'uploaded', thisYear: number): string {
  const decades = decadesOf(stats, series).filter(d => d.count > 0)
  const total = decades.reduce((n, d) => n + d.count, 0)
  if (decades.length < 2 || total === 0) return ''
  const thisDecade = `${String(thisYear).slice(0, 3)}0s`
  const current = decades.find(d => d.decade === thisDecade)
  const top = [...decades].sort((a, b) => b.count - a.count)[0]
  const parts: string[] = []
  if (current) {
    const passed = decades.filter(d => d.decade < thisDecade && d.count < current.count).sort((a, b) => b.count - a.count)[0]
    const left = Number(thisDecade.slice(0, 4)) + 9 - thisYear
    if (passed && left > 0) parts.push(`The ${thisDecade} have already passed the ${passed.decade}, ${fmt(current.count)} items to ${fmt(passed.count)}, with ${left} ${left === 1 ? 'year' : 'years'} still to go.`)
  }
  if (series === 'taken') parts.push(`The ${top.decade} hold ${percent(top.count, total)} of your library.`)
  else parts.push(`The ${top.decade} took in ${percent(top.count, total)} of your uploads.`)
  return parts.join(' ')
}

// ── Who can see them, what is filled in ─────────────────────────────────────────────────────────────────────────

export function visibilityInsight(stats: LibraryStats): string {
  const v = stats.visibility, n = stats.items
  if (n === 0) return ''
  const seen = percent(n - v.private, n)
  const shared = percent(v.friendsFamily + v.onlyOne, n)
  const priv = v.private === 0 ? 'None are private' : `Only ${fmt(v.private)} ${v.private === 1 ? 'is' : 'are'} private`
  const tail = v.friendsFamily + v.onlyOne > 0 ? `, and ${shared} are shared with friends or family but not the public` : ''
  return `${seen} of your items can be seen by someone besides you. ${priv}${tail}.`
}

export type FilledField = 'title' | 'tags' | 'description' | 'location'
const FILLED_NAMES: Record<FilledField, string> = { title: 'Titles', tags: 'Tags', description: 'Descriptions', location: 'Locations' }

/** The sentence for "What is filled in" and which field it is about (it matches a Photos check of the same name). */
export function filledInsight(stats: LibraryStats): { text: string; field: FilledField } | null {
  const n = stats.items
  if (n === 0) return null
  const fields = (Object.keys(FILLED_NAMES) as FilledField[]).map(f => ({ field: f, have: stats.filled[f] })).sort((a, b) => a.have - b.have)
  const weakest = fields[0]
  const missing = n - weakest.have
  if (missing === 0) return { text: 'Every item has a title, tags, a description and a location.', field: weakest.field }
  if (weakest.have / n >= 0.98) return { text: `Nearly everything is filled in. The weakest is ${FILLED_NAMES[weakest.field].toLowerCase()}, at ${percent(weakest.have, n)}.`, field: weakest.field }
  return { text: `${FILLED_NAMES[weakest.field]} are the gap: ${fmt(missing)} ${missing === 1 ? 'item has' : 'items have'} none.`, field: weakest.field }
}

// ── Where ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** "the United States", "the United Kingdom", "France". */
const withThe = (name: string): string => (/^United /.test(name) ? `the ${name}` : name)

export function placesInsight(stats: LibraryStats, view: 'countries' | 'states'): string {
  const p = stats.places
  if (view === 'countries') {
    if (p.countries.length === 0) return ''
    const placed = p.countries.reduce((n, c) => n + c.items, 0)
    const top = p.countries[0]
    const lead = p.countries.length === 1 ? `All of your located items are in ${withThe(top.name)}.` : `${percent(top.items, placed)} of your located items are in ${withThe(top.name)}. ${p.countries.length} countries in all.`
    return `${lead} The percentages are shares of your ${fmt(stats.located)} located items.`
  }
  if (p.states.length === 0) return ''
  const placed = p.states.reduce((n, c) => n + c.items, 0)
  const [a, b] = p.states
  const lead = b ? `${a.name} and ${b.name} hold ${percent(a.items + b.items, placed)} of your US photos.` : `All of your US items are in ${a.name}.`
  return `${lead} ${p.states.length} states and districts in all. The percentages are shares of your ${fmt(placed)} US items. Near a state line the count can be off by a block or two.`
}

/** The footer of "How exact the locations are": one spot where many photos sit in no country, and the year least often located. */
export function exactInsight(stats: LibraryStats): { text: string; stray: boolean } | null {
  const parts: string[] = []
  const s = stats.places.strayAt
  if (s) {
    const where = s.lat < -60 ? 'in Antarctica' : `at ${Math.abs(s.lat).toFixed(1)}° ${s.lat < 0 ? 'S' : 'N'}, ${Math.abs(s.lon).toFixed(1)}° ${s.lon < 0 ? 'W' : 'E'}, in no country`
    parts.push(`${fmt(s.items)} items share one spot ${where}, almost certainly a wrong geotag.`)
  }
  const least = stats.leastLocatedYear
  if (least && least.percent < 90) parts.push(`${least.year} is your least-located year: ${Math.round(least.percent)}% have a location.`)
  return parts.length ? { text: parts.join(' '), stray: !!s } : null
}

// ── What is in it ─────────────────────────────────────────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<number, string> = { 5: 'five', 10: 'ten' }
const countWord = (n: number): string => NUMBER_WORDS[n] ?? String(n)
const sum = (list: Named[], n: number): number => list.slice(0, n).reduce((a, b) => a + b.items, 0)

export function tagsInsight(stats: LibraryStats, n: number): string {
  const tags = stats.topTags
  if (tags.length < 2 || stats.items === 0 || stats.tagUses === 0) return ''
  const k = Math.min(n, tags.length)
  return `The most-used tag, ${tags[0].name}, is on ${percent(tags[0].items, stats.items)} of your items. Your top ${countWord(k)} tags make up ${percent(sum(tags, k), stats.tagUses)} of every tag you have used.`
}

export function albumsInsight(stats: LibraryStats, n: number): string {
  const albums = stats.topAlbums
  if (albums.length < 2 || stats.items === 0) return ''
  const k = Math.min(n, albums.length)
  const lead = `The ${countWord(k)} biggest albums hold ${percent(sum(albums, k), stats.items)} of your items.`
  const more = k >= 10 && stats.albums >= 20 ? ` The typical album has ${fmt(stats.medianAlbum)}, and only ${fmt(stats.smallAlbums)} ${stats.smallAlbums === 1 ? 'has' : 'have'} fewer than 10.` : ''
  return lead + more
}

// ── The Top 5 / Top 10 / Top 25 control ────────────────────────────────────────────────────────────────────────

export const TOP_SIZES = [5, 10, 25] as const

/** The buttons for a list of `total` things: only sizes that exist, the last one "All N" when it shows everything. No buttons at 5 or fewer. */
export function sizeChoices(total: number): { n: number; label: string }[] {
  if (total <= TOP_SIZES[0]) return []
  const out: { n: number; label: string }[] = []
  for (const size of TOP_SIZES) {
    const n = Math.min(size, total)
    if (out.some(o => o.n === n)) continue
    out.push({ n, label: n === total && total < TOP_SIZES[TOP_SIZES.length - 1] ? `All ${n}` : `Top ${n}` })
  }
  return out
}

/** How many rows a card shows for the chosen size: never more than it has. */
export const shownCount = (chosen: number, have: number): number => Math.min(chosen, have)

// ── Dates and small captions ───────────────────────────────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const LONG_MONTH_NAMES = LONG_MONTHS
export const SHORT_MONTH_NAMES = SHORT_MONTHS
export const DAY_NAME_LIST = DAY_NAMES

/** "2010-05-15" to "May 15, 2010". */
export function formatDay(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return `${SHORT_MONTHS[m - 1]} ${day}, ${y}`
}
/** "2025-04" to "April 2025". */
export const formatMonth = (m: string): string => `${LONG_MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
/** 16 to "4 pm". */
export const formatHour = (h: number): string => (h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`)
/** Two days as a range, saying the year once when it is the same: "Feb 10 to Mar 16, 2013". */
export function formatRange(from: string, to: string): string {
  if (from === to) return formatDay(from)
  return from.slice(0, 4) === to.slice(0, 4) ? `${formatDay(from).replace(/, \d+$/, '')} to ${formatDay(to)}` : `${formatDay(from)} to ${formatDay(to)}`
}
export const addDays = (d: string, n: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
export const lastDayOfMonth = (m: string): string => `${m}-${String(new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`
const ordinalSecond = (vals: number[]): number => [...vals].sort((a, b) => b - a)[1] ?? 0

/** The one-line captions under the month, day and time-of-day charts. */
export function partsCaptions(stats: LibraryStats): { month: string; day: string; hour: string } {
  const top = (vals: number[]): number => vals.indexOf(Math.max(...vals))
  const out = { month: '', day: '', hour: '' }
  const m = stats.months, d = stats.weekdays, h = stats.hours
  if (m.some(n => n > 0)) {
    const first = top(m); const second = m.indexOf(ordinalSecond(m))
    out.month = `${LONG_MONTHS[first]} is your busiest month, then ${LONG_MONTHS[second === first ? (first + 1) % 12 : second]}.`
  }
  if (d.some(n => n > 0)) {
    const first = top(d)
    out.day = Math.max(...d) >= ordinalSecond(d) * 1.5 ? `${DAY_NAMES[first]} is your day, by a long way.` : `${DAY_NAMES[first]} is your busiest day.`
  }
  if (h.some(n => n > 0)) out.hour = `Most are taken around ${formatHour(top(h))}.`
  return out
}
