import type Database from 'better-sqlite3'
import { loadSettings } from './settings'
import { titlePlace, cityText, placeText } from '../shared/titlePlace'
import { isCameraTitle } from '../shared/cameraNames'
import type { LocationHintSettings, LocationHintStats } from '../shared/types'

// Hints for the Photos checks, worked out on this computer from the library list. Suggestions only: nothing here changes Flickr.
//   No location (#186): a spot, from the photos taken within a few minutes of it that agree with each other.
//   No title or a camera-file title (#187): how the title could start, from the photos taken minutes beside it.
//   Far from the place its title names (#188): a geotag that is far from where the rest of that city's photos are.

export const HINT_DEFAULTS: LocationHintSettings = { minutes: 10, meters: 300 }
const MIN_NEIGHBOURS = 2        // photos beside it needed before a hint is made
const TITLE_AGREE = 0.8         // share of those that must start their title the same way
const MIN_CITY_PHOTOS = 10      // a city needs this many geotagged photos before a geotag can be called far from it
const FAR_TIMES = 5             // far = this many times the city's usual spread (90th percentile)...
const FAR_MIN_KM = 100          // ...and at least this far (a region such as a state or the Poconos spreads over tens of km on its own)

function hintSettings(): LocationHintSettings {
  const set = loadSettings().locationHints ?? {}
  const num = (v: unknown, def: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def)
  return { minutes: Math.round(num(set.minutes, HINT_DEFAULTS.minutes, 1, 120)), meters: Math.round(num(set.meters, HINT_DEFAULTS.meters, 20, 2000)) }
}

const km = (aLat: number, aLon: number, bLat: number, bLon: number): number => {
  const r = Math.PI / 180
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)))
}
const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

// Seconds since 1970 for a date taken, or null when it has no real time (a photo timed exactly at midnight, such as a scan of a print, carries a made-up time)
function timeOf(dateTaken: string): number | null {
  if (dateTaken.length < 19 || dateTaken < '1990-01-01' || dateTaken.slice(11, 19) === '00:00:00') return null
  const t = Date.parse(`${dateTaken.slice(0, 10)}T${dateTaken.slice(11, 19)}Z`) / 1000
  return Number.isFinite(t) ? t : null
}

interface Located { ts: number; lat: number; lon: number }
interface Titled { ts: number; id: string; key: string; text: string }
interface Index {
  key: string
  located: Located[]                                   // geotagged photos with a real time, by time
  titled: Titled[]                                     // photos whose title starts "City - Neighbourhood", by time
  far: Map<string, { km: number; city: string }>       // geotags far from the city their title names
  noLocation: { id: string; ts: number }[]             // photos with no location and a real time
  noLocationAll: number                                // every photo with no location, with or without a real time
  needTitle: { id: string; ts: number }[]              // photos with no title or a camera-file title, and a real time
}

let cached: Index | null = null
function index(db: Database.Database): Index {
  const meta = (k: string): string => (db.prepare('SELECT value FROM tag_index_meta WHERE key = ?').get(k) as { value: string } | undefined)?.value ?? ''
  const albumFit = loadSettings().albumFit ?? {}
  const key = `${meta('last_scan_at')}|${JSON.stringify(hintSettings())}|${albumFit.titleMode ?? ''}|${albumFit.titleAutoMin ?? ''}`
  if (cached && cached.key === key) return cached
  const rows = db.prepare('SELECT photo_id, title, date_taken, latitude, longitude, has_location FROM photo_meta').all() as { photo_id: string; title: string; date_taken: string; latitude: number | null; longitude: number | null; has_location: number }[]
  // Titles that start with a place are used only when switched on and enough titles have one (the same switch as the album checks)
  const titledShare = rows.length ? rows.filter(r => titlePlace(r.title)).length / rows.length : 0
  const titlesOn = (typeof albumFit.titleMode === 'number' ? albumFit.titleMode : 1) >= 1 && titledShare >= (typeof albumFit.titleAutoMin === 'number' ? albumFit.titleAutoMin : 30) / 100
  const located: Located[] = [], titled: Titled[] = [], noLocation: { id: string; ts: number }[] = [], needTitle: { id: string; ts: number }[] = []
  const cities = new Map<string, { id: string; lat: number; lon: number; title: string }[]>()
  let noLocationAll = 0
  for (const r of rows) {
    if (r.has_location === 0) noLocationAll++
    const ts = timeOf(r.date_taken)
    const geo = r.has_location === 1 && r.latitude !== null && r.longitude !== null
    if (ts !== null) {
      if (geo) located.push({ ts, lat: r.latitude as number, lon: r.longitude as number })
      else if (r.has_location === 0) noLocation.push({ id: r.photo_id, ts })
      if (r.title.trim() === '' || isCameraTitle(r.title)) needTitle.push({ id: r.photo_id, ts })
    }
    if (!titlesOn) continue
    const place = titlePlace(r.title)
    if (!place) continue
    if (ts !== null && place.length === 2) titled.push({ ts, id: r.photo_id, key: place.join('|'), text: placeText(r.title) })
    if (geo) { const l = cities.get(place[0]); const e = { id: r.photo_id, lat: r.latitude as number, lon: r.longitude as number, title: r.title }; if (l) l.push(e); else cities.set(place[0], [e]) }
  }
  located.sort((a, b) => a.ts - b.ts); titled.sort((a, b) => a.ts - b.ts)
  const far = new Map<string, { km: number; city: string }>()
  for (const list of cities.values()) {
    if (list.length < MIN_CITY_PHOTOS) continue
    const cLat = median(list.map(e => e.lat)), cLon = median(list.map(e => e.lon))
    const d = list.map(e => km(cLat, cLon, e.lat, e.lon))
    const p90 = [...d].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * 0.9))]
    list.forEach((e, i) => { if (d[i] > Math.max(FAR_TIMES * p90, FAR_MIN_KM)) far.set(e.id, { km: d[i], city: cityText(e.title) }) })
  }
  cached = { key, located, titled, far, noLocation, noLocationAll, needTitle }
  return cached
}

const lowerBound = <T extends { ts: number }>(a: T[], t: number): number => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].ts < t) lo = m + 1; else hi = m } return lo }

export interface Hint { text: string; mapUrl?: string }
const osm = (lat: number, lon: number): string => `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=17/${lat.toFixed(6)}/${lon.toFixed(6)}`

// #186: where a photo with no location probably was taken
function locationHint(idx: Index, ts: number): Hint | null {
  const s = hintSettings(), win = s.minutes * 60
  const near: Located[] = []
  for (let i = lowerBound(idx.located, ts - win); i < idx.located.length && idx.located[i].ts <= ts + win; i++) near.push(idx.located[i])
  if (near.length < MIN_NEIGHBOURS) return null
  const lat = median(near.map(p => p.lat)), lon = median(near.map(p => p.lon))
  if (Math.max(...near.map(p => km(lat, lon, p.lat, p.lon))) > s.meters / 1000) return null   // the photos around it do not agree with each other
  return { text: `${near.length} photos taken within ${s.minutes} minutes of it were taken here, within ${s.meters} m of each other. Add this location in Flickr's batch editor.`, mapUrl: osm(lat, lon) }
}

// #187: how a photo's title could start, when the photos taken beside it all start theirs the same way
function titleHint(idx: Index, id: string, ts: number): Hint | null {
  const win = hintSettings().minutes * 60
  const near: Titled[] = []
  for (let i = lowerBound(idx.titled, ts - win); i < idx.titled.length && idx.titled[i].ts <= ts + win; i++) if (idx.titled[i].id !== id) near.push(idx.titled[i])
  if (near.length < MIN_NEIGHBOURS) return null
  const votes = new Map<string, { n: number; text: string }>()
  for (const p of near) { const v = votes.get(p.key); if (v) v.n++; else votes.set(p.key, { n: 1, text: p.text }) }
  let best: { n: number; text: string } | null = null
  for (const v of votes.values()) if (!best || v.n > best.n) best = v
  if (!best || best.n / near.length < TITLE_AGREE) return null
  return { text: `${best.n} of the ${near.length} photos taken within ${hintSettings().minutes} minutes of it start their title "${best.text}: ". It could start the same way.` }
}

// #188: ids of photos whose geotag is far from the city their title names
export function titleFarIds(db: Database.Database): string[] { return [...index(db).far.keys()] }
export function titleFarKey(db: Database.Database): string { return index(db).key }

// The hint for one photo row, by check; null when there is nothing to say
export function hintFor(db: Database.Database, condition: string, photoId: string, dateTaken: string, geo?: { lat: number; lon: number } | null): Hint | null {
  if (condition !== 'location' && condition !== 'title' && condition !== 'locTitle') return null
  const idx = index(db)
  const ts = timeOf(dateTaken)
  if (condition === 'location') return ts === null ? null : locationHint(idx, ts)
  if (condition === 'title') return ts === null ? null : titleHint(idx, photoId, ts)
  if (condition === 'locTitle') {
    const f = idx.far.get(photoId)
    if (!f) return null
    const d = f.km >= 100 ? Math.round(f.km).toLocaleString('en-US') : f.km.toFixed(0)
    return { text: `Its title names ${f.city}, but it is geotagged ${d} km from where your other ${f.city} photos are.`, mapUrl: geo ? osm(geo.lat, geo.lon) : undefined }
  }
  return null
}

// What the hints find with the current numbers, for the live counts in Tune checks
export function hintStats(db: Database.Database): LocationHintStats {
  const idx = index(db)
  return {
    locations: idx.noLocation.filter(p => locationHint(idx, p.ts)).length, noLocation: idx.noLocationAll,
    titles: idx.needTitle.filter(p => titleHint(idx, p.id, p.ts)).length, farTitles: idx.far.size
  }
}
