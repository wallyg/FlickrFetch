import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { getDb, dbGeneration } from './database'
import { GUESSED_DATE_SQL } from './photoHealth'
import { makeLookup, type Lookup, type Topo } from './placeLookup'
import countriesTopo from '../renderer/assets/countries-50m.json'
import statesTopo from '../renderer/assets/states-us.json'
import type { LibraryStats, Named, Ranked } from '../shared/types'

// The numbers behind the Health Check dashboard: totals, patterns over time, who can see the photos, what is filled in, where they were taken,
// the most-used tags and albums, and a few records. Everything is worked out from the local library list, with no request to Flickr.
// Dates that are guessed or placeholders are left out of every chart and record that depends on when a photo was taken (they are counted apart).

const NONE: LibraryStats = {
  hasData: false, items: 0, photos: 0, videos: 0, albums: 0, tags: 0, tagUses: 0, addedLast12Months: 0, daysWithPhotos: 0, avgTagsPerItem: 0,
  avgItemsPerAlbum: 0, medianAlbum: 0, smallAlbums: 0, visibility: { public: 0, friendsFamily: 0, onlyOne: 0, private: 0 },
  filled: { title: 0, tags: 0, description: 0, location: 0 }, precision: { street: 0, town: 0, vague: 0, none: 0 }, located: 0, years: [],
  guessed: { items: 0, biggestDay: null }, months: [], weekdays: [], hours: [],
  records: { days: [], months: [], streak: null, quiet: null, uploadDay: null, burst: null, oldest: '', newest: '' },
  topTags: [], topAlbums: [], places: { countries: [], states: [], usItems: 0, strayAt: null }, leastLocatedYear: null
}

const GOOD = `p.date_taken <> '' AND NOT ${GUESSED_DATE_SQL}`   // a real date taken
const HAS_TIME = "substr(p.date_taken, 12, 8) <> '' AND substr(p.date_taken, 12, 8) <> '00:00:00'"
const ONE_DAY = 86400000
const dayMs = (d: string): number => Date.parse(`${d}T00:00:00Z`)
const dayStr = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

let countryLookup: Lookup | null = null
let stateLookup: Lookup | null = null
const SHORT_NAMES: Record<string, string> = { 'United States of America': 'United States' }

interface Cache { key: string; stats: LibraryStats }
let cache: Cache | null = null

function meta(db: Database.Database, key: string): string {
  return (db.prepare('SELECT value FROM tag_index_meta WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? ''
}

/** Busiest first: [label, items] pairs for the top rows of a GROUP BY. */
function ranked(db: Database.Database, sql: string, limit: number): Ranked[] {
  return (db.prepare(`${sql} LIMIT ${limit}`).all() as { k: string; n: number }[]).map(r => ({ label: r.k, items: r.n }))
}

export function computeLibraryStats(db: Database.Database): LibraryStats {
  const one = (sql: string, ...params: unknown[]): number => (db.prepare(sql).get(...params) as { n: number | null }).n ?? 0
  const items = one('SELECT COUNT(*) AS n FROM photo_meta')
  if (items === 0) return NONE
  const videos = one("SELECT COUNT(*) AS n FROM photo_meta WHERE media = 'video'")
  const albums = one('SELECT COUNT(*) AS n FROM album')
  const tags = one('SELECT COUNT(*) AS n FROM tag_names WHERE photo_count > 0')
  const tagUses = one('SELECT COALESCE(SUM(photo_count), 0) AS n FROM tag_names WHERE photo_count > 0')

  // Albums: how big they are
  const sizes = (db.prepare('SELECT photo_count AS n FROM album WHERE photo_count > 0 ORDER BY photo_count').all() as { n: number }[]).map(r => r.n)
  const avgItemsPerAlbum = sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0
  const medianAlbum = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0

  // Who can see them: 0 public, 1 friends, 2 family, 3 friends and family, 4 private
  const vis = new Map((db.prepare('SELECT privacy AS k, COUNT(*) AS n FROM photo_meta GROUP BY privacy').all() as { k: number; n: number }[]).map(r => [r.k, r.n]))
  const visibility = { public: vis.get(0) ?? 0, friendsFamily: vis.get(3) ?? 0, onlyOne: (vis.get(1) ?? 0) + (vis.get(2) ?? 0), private: vis.get(4) ?? 0 }

  // What is filled in, and how exact the locations are
  const filled = db.prepare("SELECT SUM(title <> '') AS title, SUM(has_tags) AS tags, SUM(has_description) AS description, SUM(has_location) AS location FROM photo_meta").get() as { title: number; tags: number; description: number; location: number }
  const prec = db.prepare(`SELECT
      SUM(CASE WHEN geo_accuracy >= 15 THEN 1 ELSE 0 END) AS street,
      SUM(CASE WHEN geo_accuracy BETWEEN 11 AND 14 THEN 1 ELSE 0 END) AS town,
      SUM(CASE WHEN geo_accuracy BETWEEN 1 AND 10 THEN 1 ELSE 0 END) AS vague,
      SUM(CASE WHEN geo_accuracy = 0 THEN 1 ELSE 0 END) AS none
    FROM photo_meta WHERE has_location = 1`).get() as { street: number | null; town: number | null; vague: number | null; none: number | null }

  // Over time (guessed dates left out of "taken"; every upload date is real)
  const taken = new Map((db.prepare(`SELECT substr(p.date_taken, 1, 4) AS k, COUNT(*) AS n FROM photo_meta p WHERE ${GOOD} GROUP BY k`).all() as { k: string; n: number }[]).map(r => [r.k, r.n]))
  const uploaded = new Map((db.prepare("SELECT strftime('%Y', date_upload, 'unixepoch') AS k, COUNT(*) AS n FROM photo_meta WHERE date_upload > 0 GROUP BY k").all() as { k: string; n: number }[]).map(r => [r.k, r.n]))
  const yearKeys = [...new Set([...taken.keys(), ...uploaded.keys()])].sort()
  const years = yearKeys.map(year => ({ year, taken: taken.get(year) ?? 0, uploaded: uploaded.get(year) ?? 0 }))
  const months = Array<number>(12).fill(0), weekdays = Array<number>(7).fill(0), hours = Array<number>(24).fill(0)
  for (const r of db.prepare(`SELECT CAST(substr(p.date_taken, 6, 2) AS INTEGER) AS k, COUNT(*) AS n FROM photo_meta p WHERE ${GOOD} GROUP BY k`).all() as { k: number; n: number }[]) if (r.k >= 1 && r.k <= 12) months[r.k - 1] = r.n
  for (const r of db.prepare(`SELECT CAST(strftime('%w', substr(p.date_taken, 1, 10)) AS INTEGER) AS k, COUNT(*) AS n FROM photo_meta p WHERE ${GOOD} GROUP BY k`).all() as { k: number; n: number }[]) if (r.k >= 0 && r.k <= 6) weekdays[r.k] = r.n
  for (const r of db.prepare(`SELECT CAST(substr(p.date_taken, 12, 2) AS INTEGER) AS k, COUNT(*) AS n FROM photo_meta p WHERE ${GOOD} AND ${HAS_TIME} GROUP BY k`).all() as { k: number; n: number }[]) if (r.k >= 0 && r.k <= 23) hours[r.k] = r.n
  const guessedItems = one(`SELECT COUNT(*) AS n FROM photo_meta p WHERE ${GUESSED_DATE_SQL}`)
  const guessedDay = db.prepare(`SELECT substr(p.date_taken, 1, 10) AS k, COUNT(*) AS n FROM photo_meta p WHERE ${GUESSED_DATE_SQL} AND p.date_taken <> '' GROUP BY k ORDER BY n DESC LIMIT 1`).get() as { k: string; n: number } | undefined
  const addedLast12Months = one("SELECT COUNT(*) AS n FROM photo_meta WHERE date_upload >= CAST(strftime('%s', 'now', '-12 months') AS INTEGER)")

  // Records
  const days = (db.prepare(`SELECT DISTINCT substr(p.date_taken, 1, 10) AS d FROM photo_meta p WHERE ${GOOD} ORDER BY d`).all() as { d: string }[]).map(r => r.d)
  let streak: LibraryStats['records']['streak'] = null
  let run = 0, runFrom = ''
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && dayMs(days[i]) - dayMs(days[i - 1]) === ONE_DAY) run++
    else { run = 1; runFrom = days[i] }
    if (!streak || run > streak.days) streak = { days: run, from: runFrom }
  }
  // A quiet spell only counts once the library is busy: from the first year that holds at least 4% of the dated photos
  const dated = [...taken.values()].reduce((a, b) => a + b, 0)
  const sinceYear = [...taken.entries()].sort().find(([, n]) => n >= dated * 0.04)?.[0] ?? ''
  let quiet: LibraryStats['records']['quiet'] = null
  const busyDays = days.filter(d => d >= `${sinceYear}-01-01`)
  for (let i = 1; i < busyDays.length; i++) {
    const quietDays = (dayMs(busyDays[i]) - dayMs(busyDays[i - 1])) / ONE_DAY - 1
    if (quietDays > 0 && (!quiet || quietDays > quiet.days)) quiet = { days: quietDays, from: dayStr(dayMs(busyDays[i - 1]) + ONE_DAY), to: dayStr(dayMs(busyDays[i]) - ONE_DAY), since: sinceYear }
  }
  const burstRow = db.prepare(`SELECT substr(p.date_taken, 1, 13) AS k, COUNT(*) AS n FROM photo_meta p WHERE ${GOOD} AND ${HAS_TIME} GROUP BY k ORDER BY n DESC LIMIT 1`).get() as { k: string; n: number } | undefined
  const uploadRow = db.prepare("SELECT date(date_upload, 'unixepoch') AS k, COUNT(*) AS n FROM photo_meta WHERE date_upload > 0 GROUP BY k ORDER BY n DESC LIMIT 1").get() as { k: string; n: number } | undefined
  const bounds = db.prepare(`SELECT MIN(substr(p.date_taken, 1, 10)) AS lo, MAX(substr(p.date_taken, 1, 10)) AS hi FROM photo_meta p WHERE ${GOOD}`).get() as { lo: string | null; hi: string | null }

  // Where: country and state by point-in-outline, once per distinct spot (rounded to about a kilometre)
  countryLookup ??= makeLookup(countriesTopo as unknown as Topo, 'countries')
  stateLookup ??= makeLookup(statesTopo as unknown as Topo, 'states')
  const spots = db.prepare('SELECT ROUND(latitude, 2) AS lat, ROUND(longitude, 2) AS lon, COUNT(*) AS n FROM photo_meta WHERE has_location = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL GROUP BY 1, 2').all() as { lat: number; lon: number; n: number }[]
  interface Tally { n: number; lat: number; lon: number; best: number }
  const byCountry = new Map<string, Tally>(), byState = new Map<string, Tally>(), strays = new Map<string, { lat: number; lon: number; n: number }>()
  const add = (m: Map<string, Tally>, name: string, s: { lat: number; lon: number; n: number }): void => {
    const t = m.get(name) ?? { n: 0, lat: s.lat, lon: s.lon, best: 0 }
    t.n += s.n
    if (s.n > t.best) { t.best = s.n; t.lat = s.lat; t.lon = s.lon }   // the busiest spot stands for the place on the Map
    m.set(name, t)
  }
  let usItems = 0
  for (const s of spots) {
    const country = countryLookup.locate(s.lon, s.lat, 1)
    if (!country) {
      const key = `${s.lat.toFixed(1)},${s.lon.toFixed(1)}`
      const at = strays.get(key) ?? { lat: Math.round(s.lat * 10) / 10, lon: Math.round(s.lon * 10) / 10, n: 0 }
      at.n += s.n; strays.set(key, at)
      continue
    }
    add(byCountry, country, s)
    if (country === 'United States of America') {
      const state = stateLookup.locate(s.lon, s.lat, 0.25)
      usItems += s.n
      if (state) add(byState, state, s)
    }
  }
  const list = (m: Map<string, Tally>): Named[] => [...m.entries()].map(([name, t]) => ({ name: SHORT_NAMES[name] ?? name, items: t.n, lat: t.lat, lon: t.lon })).sort((a, b) => b.items - a.items || a.name.localeCompare(b.name))
  const stray = [...strays.values()].sort((a, b) => b.n - a.n)[0]

  // The year with the smallest share of located photos (years with at least 100 dated photos)
  const locRows = db.prepare(`SELECT substr(p.date_taken, 1, 4) AS k, COUNT(*) AS n, SUM(p.has_location) AS loc FROM photo_meta p WHERE ${GOOD} GROUP BY k HAVING n >= 100`).all() as { k: string; n: number; loc: number }[]
  const least = locRows.map(r => ({ year: r.k, percent: (r.loc / r.n) * 100 })).sort((a, b) => a.percent - b.percent)[0]

  return {
    hasData: true, items, photos: items - videos, videos, albums, tags, tagUses, addedLast12Months, daysWithPhotos: days.length,
    avgTagsPerItem: items > 0 ? Math.round((tagUses / items) * 10) / 10 : 0, avgItemsPerAlbum, medianAlbum, smallAlbums: sizes.filter(n => n < 10).length,
    visibility, filled: { title: filled.title ?? 0, tags: filled.tags ?? 0, description: filled.description ?? 0, location: filled.location ?? 0 },
    precision: { street: prec.street ?? 0, town: prec.town ?? 0, vague: prec.vague ?? 0, none: prec.none ?? 0 }, located: filled.location ?? 0,
    years, guessed: { items: guessedItems, biggestDay: guessedDay && guessedDay.n >= 20 ? { day: guessedDay.k, items: guessedDay.n } : null },
    months, weekdays, hours,
    records: {
      days: ranked(db, `SELECT substr(p.date_taken, 1, 10) AS k, COUNT(*) AS n FROM photo_meta p WHERE ${GOOD} GROUP BY k ORDER BY n DESC, k`, 5),
      months: ranked(db, `SELECT substr(p.date_taken, 1, 7) AS k, COUNT(*) AS n FROM photo_meta p WHERE ${GOOD} GROUP BY k ORDER BY n DESC, k`, 5),
      streak: streak && streak.days > 1 ? streak : null, quiet,
      uploadDay: uploadRow ? { day: uploadRow.k, items: uploadRow.n } : null,
      burst: burstRow && burstRow.n > 1 ? { hour: burstRow.k, items: burstRow.n } : null,
      oldest: bounds.lo ?? '', newest: bounds.hi ?? ''
    },
    topTags: (db.prepare('SELECT COALESCE(display, name) AS name, photo_count AS n FROM tag_names WHERE photo_count > 0 ORDER BY photo_count DESC, name LIMIT 25').all() as { name: string; n: number }[]).map(r => ({ name: r.name, items: r.n })),
    topAlbums: (db.prepare('SELECT id, title, photo_count AS n FROM album WHERE photo_count > 0 ORDER BY photo_count DESC, title LIMIT 25').all() as { id: string; title: string; n: number }[]).map(r => ({ name: r.title, items: r.n, id: r.id })),
    places: { countries: list(byCountry), states: list(byState), usItems, strayAt: stray && stray.n >= 20 ? { lat: stray.lat, lon: stray.lon, items: stray.n } : null },
    leastLocatedYear: least ? { year: least.year, percent: Math.round(least.percent * 10) / 10 } : null
  }
}

export function libraryStats(): LibraryStats {
  const db = getDb()
  if (!db) return NONE
  try {
    const key = `${meta(db, 'last_scan_at')}|${meta(db, 'albums_scanned_at')}|${dbGeneration()}`
    if (cache?.key === key) return cache.stats
    const stats = computeLibraryStats(db)
    cache = { key, stats }
    return stats
  } catch {
    return NONE   // the library tables are not there yet (no scan)
  }
}

export function registerLibraryStatsIpc(): void {
  ipcMain.handle('library:stats', () => libraryStats())
}
