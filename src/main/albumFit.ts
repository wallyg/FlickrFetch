import type Database from 'better-sqlite3'
import { albumsDb } from './albumDb'
import { clearFineReason } from './fineReasons'
import { ownerNsid } from './owner'
import { foldAccents } from '../shared/tags'
import { loadSettings } from './settings'
import type { AlbumExportQuery, AlbumFitPhoto, AlbumFitSettings, AlbumFitStats, AlbumItem, AlbumKind, AlbumKindRow, AlbumListPage, AlbumSetRequest } from '../shared/types'

// Album fit (3.8): which photos may not belong in their album, and which albums may be missing photos. Worked out on this computer from the
// library list and the album list (dates, places, tags). Suggestions only: nothing here changes Flickr.
//
// Each album gets a profile from its own photos, and an "organised by" kind (guessed, or chosen by you): date (an event or an age
// album), place (a place album), tag (an album of one subject) or anything (left alone).

// The numbers behind the judging: defaults, and what Tune checks may change (anything missing or out of range uses its default)
export const FIT_DEFAULTS: AlbumFitSettings = { share: 95, gapDays: 45, isolated: 2, farTimes: 2.5, farKm: 0.5, titleShare: 75, titleMin: 5, nearShare: 80, nearMin: 3, nearMinutes: 30, nearMeters: 300, bothOnly: 0, titleMode: 1, titleAutoMin: 30, wrongOn: 1, doubleOn: 1, vouchShare: 50 }
export interface Level {
  share: number; gap: number; isolated: number; farTimes: number; farAdd: number
  titleShare: number; titleMin: number; nearShare: number; nearMin: number; nearSeconds: number; nearKm: number; bothOnly: boolean; titleMode: number; titleAuto: number; wrongOn: boolean; doubleOn: boolean; vouch: number
}
// The settings turned into working numbers: anything missing or out of range falls back to its default or the nearest allowed value
export function levelFrom(set: Partial<AlbumFitSettings>): Level {
  const num = (v: unknown, def: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def)
  const D = FIT_DEFAULTS
  return {
    share: num(set.share, D.share, 70, 100) / 100, gap: Math.round(num(set.gapDays, D.gapDays, 3, 365)),
    isolated: Math.round(num(set.isolated, D.isolated, 0, 20)), farTimes: num(set.farTimes, D.farTimes, 1, 10), farAdd: num(set.farKm, D.farKm, 0, 20),
    titleShare: num(set.titleShare, D.titleShare, 50, 100) / 100, titleMin: Math.round(num(set.titleMin, D.titleMin, 2, 50)),
    nearShare: num(set.nearShare, D.nearShare, 50, 100) / 100, nearMin: Math.round(num(set.nearMin, D.nearMin, 1, 20)),
    nearSeconds: Math.round(num(set.nearMinutes, D.nearMinutes, 1, 240)) * 60, nearKm: num(set.nearMeters, D.nearMeters, 20, 2000) / 1000,
    bothOnly: num(set.bothOnly, D.bothOnly, 0, 1) >= 1, titleMode: num(set.titleMode, D.titleMode, 0, 1) >= 1 ? 1 : 0, titleAuto: num(set.titleAutoMin, D.titleAutoMin, 0, 100) / 100, wrongOn: num(set.wrongOn, D.wrongOn, 0, 1) >= 1, doubleOn: num(set.doubleOn, D.doubleOn, 0, 1) >= 1, vouch: num(set.vouchShare, D.vouchShare, 0, 100) / 100
  }
}
export const levelFromSettings = (): Level => levelFrom(loadSettings().albumFit ?? {})

// Everything below is judged against the album's own cluster, never against fixed distances or dates alone:
//   dates: a few dense visits (runs of photos at most GAP_DAYS apart); an outlier is a photo on its own, away from every visit
//   place: the album's own spread (its 95th-percentile distance from the middle); an outlier is a clear multiple of that spread
//   tags: the album's distinctive tags (common in the album, rare elsewhere); an outlier carries none of them
const VISIT_MIN = 5             // a visit is a run of at least this many photos
const MAX_VISITS = 4            // a date album has at most this many visits
const VISIT_PAD_DAYS = 14       // a photo this close to a visit may belong to it
const FAMILY_SHARE = 0.1        // a tag belongs to an album's family when this share of its photos carry it...
const FAMILY_LIFT = 5           // ...and it is this many times more common there than in the whole library
const STRONG_SHARE = 0.5        // a clear subject tag: on at least half the album
const STRONG_LIFT = 8
const MIN_MEMBERS = 30          // an album needs this many photos before it is judged on a guess (10 when you chose its kind)
const MIN_CHOSEN = 10
const PLACE_SPREAD_KM = 25      // an album is a place album only if most of its photos sit within this distance of its middle
const DEFINING_SHARE = 0.9      // a tag is "defining" when this share of an album's photos carry it
// Words too common in album names to say anything about a photo
const NAME_STOPWORDS = new Set(['the', 'and', 'around', 'album', 'photos', 'trip', 'with', 'from', 'north', 'south', 'east', 'west', 'near'])
const AWAY_KM = 50              // an album centred this far from where most of the library was taken counts as away from home
const FAR_FACTOR = 3            // a photo is far from its album when it is this many album-radiuses from the centre
const TITLE_OFTEN_SHARE = 0.25  // a title place that goes with this album at least this often is never called a misfile
const VOUCH_FAR_KM = 25         // a photo this far (and 10 times the album's "far" distance) from its album is flagged even when nearby photos are in the album

export interface Info { date: string; ts: number | null; lat: number | null; lon: number | null; title: string; thumb: string }   // ts: seconds since 1970 (null without a date)
interface Loc { lat: number; lon: number; rad: number; far: number; p80: number }   // rad: the album's area; far: beyond this a photo is out of place
export interface Profile {
  id: string; title: string; thumb: string; created: number | null
  members: string[]; kind: AlbumKind; pick: AlbumKind; guessed: boolean; eligible: boolean   // pick: what the app would choose; kind: what is used (yours when you chose one)
  lo: string; hi: string; span: number; loc: Loc | null; defining: number[]
  visits: { from: string; to: string }[]; isolated: Set<string> | null   // isolated: dates of photos on their own (null: judge by the album's overall window)
  family: number[]; strong: number[]
}
export interface Misfit { photoId: string; albumId: string; why: string; types: ('date' | 'place' | 'tag' | 'wrong' | 'double')[] }
export interface Missing { albumId: string; photoIds: string[]; why: string; both: number }
export interface Fit { titledPercent: number; titlesOn: boolean; profiles: Map<string, Profile>; infos: Map<string, Info>; tagNames: Map<number, string>; misfits: Misfit[]; missing: Missing[] }

let cache: { key: string; fit: Fit } | null = null
let kindVersion = 0

const km = (aLat: number, aLon: number, bLat: number, bLon: number): number => {
  const r = Math.PI / 180
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)))
}
const days = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const addDays = (iso: string, n: number): string => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10)
const month = (iso: string): string => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const pct = <T,>(sorted: T[], p: number): T => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
const list = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

// The distinctive words of an album's name (accents and case ignored): "Wimbledon" and "london" in "London: Wimbledon and Around"
const nameWords = (title: string): string[] =>
  foldAccents(title.toLowerCase()).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !NAME_STOPWORDS.has(w) && !/^\d+$/.test(w))

// The place a title starts with: "City - Neighbourhood: Subject" gives [city, neighbourhood]; "City: Subject" gives [city]. Accents and case ignored.
import { titlePlace, plain } from '../shared/titlePlace'
export { titlePlace, plain }
// Photos taken close together in time and place ("nearby"), found day by day. Only geotagged photos with a time can have neighbours.
export function nearbyPhotos(infos: Map<string, Info>, seconds: number, maxKm: number): Map<string, string[]> {
  const byDay = new Map<string, { ts: number; id: string }[]>()
  for (const [id, i] of infos) {
    if (i.ts === null || i.lat === null || i.lon === null || !i.date) continue
    const day = byDay.get(i.date); if (day) day.push({ ts: i.ts, id }); else byDay.set(i.date, [{ ts: i.ts, id }])
  }
  const out = new Map<string, string[]>()
  const add = (a: string, b: string): void => { const l = out.get(a); if (l) l.push(b); else out.set(a, [b]) }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.ts - b.ts)
    let from = 0
    for (let i = 0; i < list.length; i++) {
      while (list[from].ts < list[i].ts - seconds) from++
      const a = infos.get(list[i].id)!
      for (let k = from; k < i; k++) {
        const b = infos.get(list[k].id)!
        if (km(a.lat as number, a.lon as number, b.lat as number, b.lon as number) <= maxKm) { add(list[i].id, list[k].id); add(list[k].id, list[i].id) }
      }
    }
  }
  return out
}

// "Nested": one album's area lies inside the other's (a museum inside a district). "Apart": the two areas do not touch.
const nestedAreas = (a: Profile, b: Profile): boolean => {
  if (!a.loc || !b.loc) return false
  const d = km(a.loc.lat, a.loc.lon, b.loc.lat, b.loc.lon)
  return d + Math.min(a.loc.rad, b.loc.rad) <= Math.max(a.loc.rad, b.loc.rad) * 1.1
}
const apartAreas = (a: Profile, b: Profile): boolean => !!a.loc && !!b.loc && km(a.loc.lat, a.loc.lon, b.loc.lat, b.loc.lon) > a.loc.rad + b.loc.rad
// Two albums named "City: Part", with different parts that are not a longer form of each other ("La Boca" and "La Boca - Bombonera" are one inside the other)
function siblingNames(a: string, b: string): boolean {
  const ta = plain(a), tb = plain(b)
  if (!ta.includes(':') || !tb.includes(':')) return false
  const [pa, ra] = [ta.slice(0, ta.indexOf(':')).trim(), ta.slice(ta.indexOf(':') + 1).trim()]
  const [pb, rb] = [tb.slice(0, tb.indexOf(':')).trim(), tb.slice(tb.indexOf(':') + 1).trim()]
  return pa === pb && !(ra.startsWith(rb) || rb.startsWith(ra))
}

// Whether the title rules are in use: not switched off, and enough titles start with a place
export function titleRulesOn(infos: Map<string, Info>, level: Level): boolean {
  if (level.titleMode === 0) return false
  let titled = 0
  for (const i of infos.values()) if (titlePlace(i.title)) titled++
  return infos.size > 0 && titled / infos.size >= level.titleAuto
}

function profileOf(id: string, title: string, thumb: string, created: number | null, members: string[], infos: Map<string, Info>, tags: Map<string, number[]>, libCount: Map<number, number>, total: number, level: Level, chosen: AlbumKind | undefined): Profile {
  const base: Profile = { id, title, thumb, created, members, kind: chosen ?? 'anything', pick: 'anything', guessed: !chosen, eligible: false, lo: '', hi: '', span: 0, loc: null, defining: [], visits: [], isolated: null, family: [], strong: [] }
  const known = members.filter(p => infos.has(p))
  const dates = known.map(p => infos.get(p)!.date).filter(d => d).sort()
  if (known.length < (chosen ? MIN_CHOSEN : MIN_MEMBERS) || dates.length === 0) return base
  const lo = dates[Math.floor(dates.length * 0.05)], hi = pct(dates, 0.95)
  const span = days(lo, hi)

  // Dates: runs of photos at most GAP_DAYS apart. A date album has a few big runs (visits) holding nearly everything.
  const runs: { from: string; to: string; size: number }[] = [{ from: dates[0], to: dates[0], size: 1 }]
  for (const d of dates.slice(1)) {
    const last = runs[runs.length - 1]
    if (days(last.to, d) <= level.gap) { last.to = d; last.size++ } else runs.push({ from: d, to: d, size: 1 })
  }
  const big = runs.filter(r => r.size >= VISIT_MIN)
  const clustered = big.length >= 1 && big.length <= MAX_VISITS && big.reduce((n, r) => n + r.size, 0) >= level.share * dates.length
  const isolated = clustered ? new Set<string>() : null
  if (isolated) for (const r of runs) if (r.size <= level.isolated) { isolated.add(r.from); isolated.add(r.to) }
  const visits = clustered ? big.map(r => ({ from: r.from, to: r.to })) : [{ from: lo, to: hi }]

  // Place: the album's own spread
  const located = known.map(p => infos.get(p)!).filter(i => i.lat !== null && i.lon !== null)
  let loc: Loc | null = null
  if (located.length >= 0.8 * known.length) {
    const cLat = median(located.map(i => i.lat as number)), cLon = median(located.map(i => i.lon as number))
    const d = located.map(i => km(cLat, cLon, i.lat as number, i.lon as number)).sort((a, b) => a - b)
    const p95 = pct(d, 0.95)
    loc = { lat: cLat, lon: cLon, rad: Math.max(p95 * 1.5, 0.3), far: Math.max(p95 * level.farTimes, p95 + level.farAdd, 0.3), p80: pct(d, 0.8) }
  }

  // Tags: shared by nearly all of the album (defining), and the album's family of distinctive tags
  const counts = new Map<number, number>()
  for (const p of known) for (const t of tags.get(p) ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
  const lift = (t: number, c: number): number => (c / known.length) / ((libCount.get(t) ?? 1) / total)
  const defining = [...counts.entries()].filter(([, c]) => c >= DEFINING_SHARE * known.length).map(([t]) => t)
  const family = [...counts.entries()].filter(([t, c]) => c >= FAMILY_SHARE * known.length && lift(t, c) >= FAMILY_LIFT).map(([t]) => t)
  const strong = [...counts.entries()].filter(([t, c]) => c >= STRONG_SHARE * known.length && lift(t, c) >= STRONG_LIFT).map(([t]) => t)

  const guess: AlbumKind = clustered ? 'date' : loc && loc.p80 <= PLACE_SPREAD_KM ? 'place' : strong.length > 0 ? 'tag' : 'anything'
  return { ...base, kind: chosen ?? guess, pick: guess, eligible: true, lo, hi, span, loc, defining, visits, isolated, family, strong }
}

export function loadPhotoInfos(db: Database.Database): Map<string, Info> {
  const infos = new Map<string, Info>()
  for (const r of db.prepare('SELECT photo_id, title, thumb_url, date_taken, latitude, longitude FROM photo_meta').iterate() as IterableIterator<{ photo_id: string; title: string; thumb_url: string; date_taken: string; latitude: number | null; longitude: number | null }>) {
    const date = r.date_taken.slice(0, 10)
    const ok = date >= '1990-01-01' && date.length === 10
    // A date taken at exactly midnight has no real time (scans, date-only photos), so it is never "taken minutes apart" from anything
    const realTime = r.date_taken.length >= 19 && r.date_taken.slice(11, 19) !== '00:00:00'
    const ts = ok && realTime ? Date.parse(`${date}T${r.date_taken.length >= 19 ? r.date_taken.slice(11, 19) : '00:00:00'}Z`) / 1000 : NaN
    infos.set(r.photo_id, { date: ok ? date : '', ts: Number.isFinite(ts) ? ts : null, lat: r.latitude, lon: r.longitude, title: r.title, thumb: r.thumb_url })
  }
  return infos
}

export function compute(db: Database.Database, level: Level): Fit {
  const infos = loadPhotoInfos(db)
  const tags = new Map<string, number[]>()
  for (const r of db.prepare('SELECT photo_id, tag_id FROM tag_photo').iterate() as IterableIterator<{ photo_id: string; tag_id: number }>) {
    const a = tags.get(r.photo_id); if (a) a.push(r.tag_id); else tags.set(r.photo_id, [r.tag_id])
  }
  const memberOf = new Map<string, string[]>()
  for (const r of db.prepare('SELECT album_id, photo_id FROM album_photo').iterate() as IterableIterator<{ album_id: string; photo_id: string }>) {
    const a = memberOf.get(r.album_id); if (a) a.push(r.photo_id); else memberOf.set(r.album_id, [r.photo_id])
  }
  const libCount = new Map((db.prepare('SELECT tag_id, COUNT(*) AS n FROM tag_photo GROUP BY tag_id').all() as { tag_id: number; n: number }[]).map(r => [r.tag_id, r.n]))
  const chosen = new Map((db.prepare('SELECT album_id, kind FROM album_kind').all() as { album_id: string; kind: AlbumKind }[]).map(r => [r.album_id, r.kind]))
  const profiles = new Map<string, Profile>()
  for (const a of db.prepare('SELECT id, title, thumb_url, date_create FROM album').all() as { id: string; title: string; thumb_url: string; date_create: number | null }[]) {
    profiles.set(a.id, profileOf(a.id, a.title, a.thumb_url, a.date_create, memberOf.get(a.id) ?? [], infos, tags, libCount, infos.size, level, chosen.get(a.id)))
  }

  // Where most of the library was taken (the middle of all geotagged photos): an album centred far from it is an "away" album
  const located = [...infos.values()].filter(i => i.lat !== null && i.lon !== null)
  const home = located.length ? { lat: median(located.map(i => i.lat as number)), lon: median(located.map(i => i.lon as number)) } : null

  // Which albums each photo is in, the photos taken right beside each photo, and the place each title starts with
  const photoAlbums = new Map<string, string[]>()
  for (const [albumId, ids] of memberOf) for (const id of ids) { const l = photoAlbums.get(id); if (l) l.push(albumId); else photoAlbums.set(id, [albumId]) }
  const nearby = nearbyPhotos(infos, level.nearSeconds, level.nearKm)
  const placeCache = new Map<string, string[] | null>()
  // How many titles start with a place. When too few do (someone who names photos another way), the title rules switch themselves off
  let titled = 0
  for (const i of infos.values()) if (titlePlace(i.title)) titled++
  const titledShare = infos.size ? titled / infos.size : 0
  const titlesOn = level.titleMode !== 0 && titledShare >= level.titleAuto
  const placeOf = (id: string): string[] | null => {
    if (!titlesOn) return null
    let p = placeCache.get(id)
    if (p === undefined) { p = titlePlace(infos.get(id)?.title ?? ''); placeCache.set(id, p) }
    return p
  }
  // A place album: at least half its photos start their title with a place, and those mostly name one city. Trip, family and theme albums are not place albums.
  const placeAlbums = new Set<string>()
  for (const [albumId, ids] of memberOf) {
    if (ids.length < 10) continue
    const places = ids.map(placeOf).filter((p): p is string[] => !!p)
    if (places.length < ids.length * 0.5) continue
    const cities = new Map<string, number>()
    for (const p of places) cities.set(p[0], (cities.get(p[0]) ?? 0) + 1)
    if (Math.max(...cities.values()) >= 0.8 * places.length) placeAlbums.add(albumId)
  }

  const tagNames = new Map<number, string>()
  let tagFold: Map<number, string> | null = null   // every tag with accents removed, read only when an album's name needs matching
  const foldedTag = (id: number): string => {
    if (!tagFold) { tagFold = new Map(); for (const r of db.prepare('SELECT id, name FROM tag_names').iterate() as IterableIterator<{ id: number; name: string }>) tagFold.set(r.id, foldAccents(r.name)) }
    return tagFold.get(id) ?? ''
  }
  const nameOf = (ids: number[]): string[] => {
    const need = ids.filter(i => !tagNames.has(i))
    if (need.length) for (const r of db.prepare(`SELECT id, name FROM tag_names WHERE id IN (${need.map(() => '?').join(',')})`).all(...need) as { id: number; name: string }[]) tagNames.set(r.id, r.name)
    return ids.map(i => tagNames.get(i) ?? '').filter(Boolean)
  }

  const misfits: Misfit[] = []
  const missing: Missing[] = []
  const isIn = (pid: string, albumId: string): boolean => (photoAlbums.get(pid) ?? []).includes(albumId)

  // Photos grouped by the place their title starts with, which albums hold each group, and the one album that holds most of a group
  const groups = new Map<string, string[]>()
  for (const id of infos.keys()) {
    const p = placeOf(id); if (!p) continue
    const k = p.join('|'); const g = groups.get(k); if (g) g.push(id); else groups.set(k, [id])
  }
  const titleVotes = new Map<string, Map<string, number>>()
  const titleHome = new Map<string, string>()
  for (const [k, ids] of groups) {
    const votes = new Map<string, number>()
    for (const id of ids) for (const a of photoAlbums.get(id) ?? []) votes.set(a, (votes.get(a) ?? 0) + 1)
    titleVotes.set(k, votes)
    if (ids.length < level.titleMin) continue
    let best = '', c = 0
    for (const [a, v] of votes) if (v > c) { best = a; c = v }
    if (best && c / ids.length >= level.titleShare) titleHome.set(k, best)
  }
  // A photo filed in the wrong place's album (#180), or in two albums for different places (#181). Only between place albums whose areas
  // do not overlap (or that are sibling districts by name), never when one lies inside the other, and the title wins: if it supports this
  // album, nothing overrules it. Only a neighbourhood-level title ("City - Neighbourhood") is specific enough to call a misfile.
  const mins = Math.round(level.nearSeconds / 60)
  const judgeWrong = (prof: Profile, pid: string, info: Info): { type: 'wrong' | 'double'; text: string } | null => {
    if (!(level.wrongOn || level.doubleOn) || !placeAlbums.has(prof.id)) return null
    const place = placeOf(pid)
    const key = place ? place.join('|') : ''
    const detailed = !!place && place.length === 2
    if (detailed && titleHome.get(key) === prof.id) return null
    if (detailed && (titleVotes.get(key)?.get(prof.id) ?? 0) / (groups.get(key)?.length ?? 1) >= TITLE_OFTEN_SHARE) return null   // this title often goes with this album
    let other = detailed ? titleHome.get(key) : undefined
    let how = other ? `Its title starts "${info.title.split(/[:\uFF1A|]/)[0].trim()}", and most photos with that start are in "${profiles.get(other)?.title ?? ''}".` : ''
    if (!other) {
      const ns = nearby.get(pid) ?? []
      if (ns.length >= level.nearMin && ns.filter(n => isIn(n, prof.id)).length / ns.length <= 0.1) {
        const votes = new Map<string, number>()
        for (const n of ns) for (const a of photoAlbums.get(n) ?? []) if (a !== prof.id) votes.set(a, (votes.get(a) ?? 0) + 1)
        let best = '', c = 0
        for (const [a, v] of votes) if (v > c) { best = a; c = v }
        if (best && c / ns.length >= 0.9) { other = best; how = `The photos taken within ${mins} minutes beside it are in "${profiles.get(best)?.title ?? ''}".` }
      }
    }
    if (!other || !placeAlbums.has(other)) return null
    const b = profiles.get(other)
    if (!b || nestedAreas(prof, b) || !(apartAreas(prof, b) || siblingNames(prof.title, b.title))) return null
    if (isIn(pid, other)) return level.doubleOn ? { type: 'double', text: `${how} It is in both "${prof.title}" and "${b.title}", albums for different places, so one of them may be wrong.` } : null
    return level.wrongOn ? { type: 'wrong', text: `${how} "${prof.title}" is a different place, so it may be filed in the wrong album.` } : null
  }
  const visitText = (prof: Profile): string => list(prof.visits.slice(0, 3).map(v => (month(v.from) === month(v.to) ? month(v.from) : `${month(v.from)} to ${month(v.to)}`)))

  for (const prof of profiles.values()) {
    if (!prof.eligible || prof.kind === 'anything') continue
    const memberSet = new Set(prof.members)
    // An album that is not made of a few visits is judged on its overall window instead (only when you chose Date for it)
    const margin = Math.max(60, Math.round(prof.span * 0.5))
    const [fromD, toD] = [addDays(prof.lo, -margin), addDays(prof.hi, margin)]
    const awayAlbum = !!(prof.loc && home && km(home.lat, home.lon, prof.loc.lat, prof.loc.lon) > AWAY_KM)
    const tagSet = prof.family.length ? prof.family : prof.defining
    const lacking = new Set(prof.kind === 'tag' && tagSet.length ? prof.members.filter(pid => !tagSet.some(t => (tags.get(pid) ?? []).includes(t))) : [])
    const tagJudged = lacking.size > 0 && lacking.size <= (1 - level.share) * prof.members.length   // only when nearly the whole album shares the tags

    // Members that may not belong
    for (const pid of prof.members) {
      const info = infos.get(pid)
      if (!info) continue
      const why: string[] = []
      const types: Misfit['types'] = []
      // A later visit to a place that is away from home, taken inside the album's own area, is just the album growing
      const returnVisit = !!(awayAlbum && prof.loc && info.lat !== null && info.lon !== null && km(prof.loc.lat, prof.loc.lon, info.lat, info.lon) <= prof.loc.rad)
      const stray = !!info.date && (prof.isolated ? prof.isolated.has(info.date) : info.date < fromD || info.date > toD)
      if (prof.kind === 'date' && stray && !returnVisit) {
        types.push('date')
        // A photo with no geotag cannot be shown to be a later visit to the same place, so it is flagged and says why
        why.push(`Taken ${month(info.date)}. This album is mostly ${visitText(prof)}.${awayAlbum && (info.lat === null || info.lon === null) ? ' This photo has no geotag, so it cannot be told apart from a later visit to the same place; add a location to clear it.' : ''}`)
      }
      if ((prof.kind === 'date' || prof.kind === 'place') && prof.loc && info.lat !== null && info.lon !== null) {
        const d = km(prof.loc.lat, prof.loc.lon, info.lat, info.lon)
        if (d > prof.loc.far) types.push('place')
        if (d > prof.loc.far) why.push(`${d >= 10 ? Math.round(d).toLocaleString('en-US') : d.toFixed(1)} km from the middle of this album, whose own photos are within ${(prof.loc.rad / 1.5).toFixed(1)} km.`)
      }
      if (tagJudged && lacking.has(pid)) types.push('tag')
      if (tagJudged && lacking.has(pid)) why.push(`None of this album's usual tags (${nameOf(tagSet.slice(0, 3)).join(', ')}).`)
      // Photos taken right beside this one are mostly in this album: they vouch for it. Unless it is far outside the album's area,
      // which would let a whole outing filed in the wrong album clear itself.
      if (why.length && level.vouch > 0) {
        const ns = nearby.get(pid)
        if (ns && ns.length >= level.nearMin && ns.filter(n => memberSet.has(n)).length / ns.length >= level.vouch) {
          const far = !!prof.loc && info.lat !== null && info.lon !== null && km(prof.loc.lat, prof.loc.lon, info.lat, info.lon) > Math.max(10 * prof.loc.far, VOUCH_FAR_KM)
          if (!far) { why.length = 0; types.length = 0 }
        }
      }
      const wrong = judgeWrong(prof, pid, info)
      if (wrong) { why.push(wrong.text); types.push(wrong.type) }
      if (why.length) misfits.push({ photoId: pid, albumId: prof.id, why: why.join(' '), types })
    }
  }

  // Photos that may belong: a photo is suggested for an album when the place its title starts with, or the photos taken right beside it,
  // are mostly in that album. Guards keep the suggestions to real gaps: not a photo that already sits in a separate place album, a date
  // album only for photos taken during its visits, and the photo must carry the tags nearly every photo in the album has.
  interface Hit { title: boolean; near: boolean }
  const candidates = new Map<string, Map<string, Hit>>()   // album -> photo -> which signals suggest it
  const suggest = (albumId: string, pid: string, signal: 'title' | 'near'): void => {
    let m = candidates.get(albumId); if (!m) { m = new Map(); candidates.set(albumId, m) }
    const h = m.get(pid) ?? { title: false, near: false }
    h[signal] = true
    m.set(pid, h)
  }
  for (const [k, ids] of groups) {
    if (ids.length < level.titleMin) continue
    for (const [a, c] of titleVotes.get(k) ?? []) if (c / ids.length >= level.titleShare) for (const id of ids) if (!isIn(id, a)) suggest(a, id, 'title')
  }
  for (const [id, ns] of nearby) {
    if (ns.length < level.nearMin) continue
    const votes = new Map<string, number>()
    for (const n of ns) for (const a of photoAlbums.get(n) ?? []) votes.set(a, (votes.get(a) ?? 0) + 1)
    for (const [a, c] of votes) if (c / ns.length >= level.nearShare && !isIn(id, a)) suggest(a, id, 'near')
  }

  for (const [albumId, hits] of candidates) {
    const prof = profiles.get(albumId)
    if (!prof || !prof.eligible || prof.kind === 'anything') continue
    const usual = prof.kind === 'tag' ? (prof.family.length ? prof.family : prof.defining) : prof.defining
    const pad = prof.isolated ? VISIT_PAD_DAYS : 0
    // A word from the album's name in a photo's tag or title makes a suggestion more likely to be right. It is only a hint, never a requirement:
    // names are free text and often several words ("Gold Coast"), so a miss proves nothing.
    const words = prof.kind === 'tag' ? [] : nameWords(prof.title)
    const mentions = (pid: string, info: Info): boolean => {
      const title = foldAccents(info.title.toLowerCase())
      return words.some(w => title.includes(w) || (tags.get(pid) ?? []).some(t => foldedTag(t).includes(w)))
    }
    const found: string[] = []
    let byTitle = 0, byNear = 0, both = 0, named = 0
    for (const [pid, h] of hits) {
      if (level.bothOnly && !(h.title && h.near)) continue
      const info = infos.get(pid)
      if (!info) continue
      // 1. Already in a separate place album (areas apart, or sibling districts by name): that is a wrong-album question, not a missing one
      const inOtherPlace = placeAlbums.has(albumId) && (photoAlbums.get(pid) ?? []).some(a => {
        if (a === albumId || !placeAlbums.has(a)) return false
        const pa = profiles.get(a)
        return !(pa && nestedAreas(pa, prof)) && ((!!pa && apartAreas(pa, prof)) || siblingNames(profiles.get(a)?.title ?? '', prof.title))
      })
      if (inOtherPlace) continue
      // 2. A date album only for photos taken during one of its visits
      if (prof.kind === 'date' && !(info.date && prof.visits.some(v => info.date >= addDays(v.from, -pad) && info.date <= addDays(v.to, pad)))) continue
      // 3. The tags nearly every photo in the album has (for a subject album, any one of its subject tags)
      const mine = tags.get(pid) ?? []
      if (usual.length && !(prof.kind === 'tag' ? usual.some(t => mine.includes(t)) : usual.every(t => mine.includes(t)))) continue
      found.push(pid)
      if (h.title) byTitle++
      if (h.near) byNear++
      if (h.title && h.near) both++
      if (words.length && mentions(pid, info)) named++
    }
    if (found.length === 0) continue
    const n = (x: number): string => x.toLocaleString('en-US')
    const how = [byTitle ? `${n(byTitle)} by the place their title starts with` : '', byNear ? `${n(byNear)} by photos taken within ${Math.round(level.nearSeconds / 60)} minutes nearby` : ''].filter(Boolean)
    const tagText = usual.length ? ` They carry ${list(nameOf(usual.slice(0, 3)))}.` : ''
    const hint = words.length ? ` ${n(named)} of ${n(found.length)} also mention ${words.slice(0, 3).join(' or ')}.` : ''
    missing.push({ albumId, photoIds: found, why: `${list(how)}${both ? `; ${n(both)} by both` : ''}.${tagText}${hint}`.replace(/^./, c => c.toUpperCase()), both })
  }
  return { titledPercent: Math.round(titledShare * 100), titlesOn, profiles, infos, tagNames, misfits, missing }
}

function fit(): Fit {
  const db = albumsDb()
  const row = (k: string): string => (db.prepare('SELECT value FROM tag_index_meta WHERE key = ?').get(k) as { value: string } | undefined)?.value ?? ''
  const key = `${row('last_scan_at')}|${row('albums_scanned_at')}|${kindVersion}|${JSON.stringify(levelFromSettings())}`
  if (!cache || cache.key !== key) cache = { key, fit: compute(db, levelFromSettings()) }
  return cache.fit
}

const fineKeys = (db: Database.Database, condition: string): Set<string> =>
  new Set((db.prepare("SELECT key FROM album_fit_state WHERE condition = ? AND status = 'fine'").all(condition) as { key: string }[]).map(r => r.key))

// What the current numbers find, so they can be calibrated
export function fitStats(): AlbumFitStats {
  const f = fit()
  const db = albumsDb()
  const mfMarked = fineKeys(db, 'misfit'), msMarked = fineKeys(db, 'missing')
  const judged = [...f.profiles.values()].filter(p => p.eligible)
  const byKind: Record<AlbumKind, number> = { date: 0, place: 0, tag: 0, anything: 0 }
  for (const p of judged) byKind[p.kind]++
  const byReason = { date: 0, place: 0, tag: 0, wrong: 0, double: 0 }
  for (const m of f.misfits) for (const t of m.types) byReason[t]++
  return {
    judged: judged.length, byKind,
    misfitPhotos: new Set(f.misfits.map(m => m.photoId)).size, misfitAlbums: new Set(f.misfits.map(m => m.albumId)).size, byReason,
    missingAlbums: f.missing.length, missingPhotos: f.missing.reduce((n, m) => n + m.photoIds.length, 0), missingBoth: f.missing.reduce((n, m) => n + m.both, 0),
    misfitMarked: mfMarked.size, misfitMarkedStill: f.misfits.filter(m => mfMarked.has(`${m.photoId}|${m.albumId}`)).length,
    missingMarked: msMarked.size, missingMarkedStill: f.missing.filter(m => msMarked.has(m.albumId)).length,
    titledPercent: f.titledPercent, titlesOn: f.titlesOn
  }
}

// What is still open in the two fit checks: the distinct photos and albums (a photo can fit two albums badly, so rows and photos differ),
// and for each album how many photos are flagged
export function fitOpen(): {
  misfitPhotos: Set<string>; missingPhotos: Set<string>; misfitAlbums: Set<string>; missingAlbums: Set<string>
  byAlbum: { condition: 'misfit' | 'missing'; albumId: string; title: string; photos: number }[]
} {
  const db = albumsDb()
  const f = fit()
  const mf = fineKeys(db, 'misfit'), ms = fineKeys(db, 'missing')
  const openMisfits = f.misfits.filter(m => !mf.has(`${m.photoId}|${m.albumId}`))
  const openMissing = f.missing.filter(m => !ms.has(m.albumId))
  const per = new Map<string, Set<string>>()
  for (const m of openMisfits) { if (!per.has(m.albumId)) per.set(m.albumId, new Set()); per.get(m.albumId)!.add(m.photoId) }
  const titleOf = (id: string): string => f.profiles.get(id)?.title ?? ''
  return {
    misfitPhotos: new Set(openMisfits.map(m => m.photoId)), misfitAlbums: new Set(openMisfits.map(m => m.albumId)),
    missingPhotos: new Set(openMissing.flatMap(m => m.photoIds)), missingAlbums: new Set(openMissing.map(m => m.albumId)),
    byAlbum: [
      ...[...per].map(([albumId, s]) => ({ condition: 'misfit' as const, albumId, title: titleOf(albumId), photos: s.size })),
      ...openMissing.map(m => ({ condition: 'missing' as const, albumId: m.albumId, title: titleOf(m.albumId), photos: m.photoIds.length }))
    ]
  }
}

export function fitCounts(): { misfit: { open: number; fine: number; photos: number; albums: number }; missing: { open: number; fine: number; photos: number; albums: number } } {
  const db = albumsDb()
  const f = fit()
  const mf = fineKeys(db, 'misfit'), ms = fineKeys(db, 'missing')
  const mfFine = f.misfits.filter(m => mf.has(`${m.photoId}|${m.albumId}`)).length
  const msFine = f.missing.filter(m => ms.has(m.albumId)).length
  const o = fitOpen()
  return {
    misfit: { open: f.misfits.length - mfFine, fine: mfFine, photos: o.misfitPhotos.size, albums: o.misfitAlbums.size },
    missing: { open: f.missing.length - msFine, fine: msFine, photos: o.missingPhotos.size, albums: o.missingAlbums.size }
  }
}

const albumUrl = (owner: string | null, id: string): string => `https://www.flickr.com/photos/${owner ?? 'me'}/albums/${id}`
const photoUrl = (owner: string | null, id: string): string => (owner ? `https://www.flickr.com/photos/${owner}/${id}` : `https://www.flickr.com/photo.gne?id=${id}`)

export function fitQuery(q: AlbumExportQuery, limit: number, offset: number): AlbumListPage {
  const db = albumsDb()
  const f = fit()
  const owner = ownerNsid()
  const search = (q.search ?? '').trim().toLowerCase()
  const fine = fineKeys(db, q.condition)
  const sort = q.sort ?? 'newest'
  const wantFine = q.status === 'fine'
  const kindOf = (id: string): { kind: AlbumKind; kindGuessed: boolean } => { const p = f.profiles.get(id); return { kind: p?.kind ?? 'anything', kindGuessed: p?.guessed ?? true } }
  type Row = AlbumItem & { sortDate: string; sortTitle: string }
  let rows: Row[]
  let reasons: AlbumListPage['reasons']
  const descriptions = new Map((db.prepare('SELECT id, description FROM album').all() as { id: string; description: string }[]).map(r => [r.id, r.description.trim()]))

  if (q.condition === 'misfit') {
    const pool = f.misfits.filter(m => fine.has(`${m.photoId}|${m.albumId}`) === wantFine)
    reasons = { all: pool.length, date: 0, place: 0, tag: 0, wrong: 0, double: 0 }
    for (const m of pool) for (const t of new Set(m.types)) reasons[t]++
    rows = (q.reason ? pool.filter(m => m.types.includes(q.reason!)) : pool).map((m): Row => {
      const info = f.infos.get(m.photoId)!, prof = f.profiles.get(m.albumId)!
      return {
        id: `${m.photoId}|${m.albumId}`, title: info.title, thumbUrl: info.thumb, isPhoto: true, status: wantFine ? 'fine' as const : 'open' as const,
        detail: `In ${prof.title}${info.date ? ` · Taken ${info.date}` : ''}`, why: m.why, flickrUrl: photoUrl(owner, m.photoId),
        albumId: m.albumId, albumUrl: albumUrl(owner, m.albumId), ...kindOf(m.albumId), sortDate: info.date, sortTitle: info.title.toLowerCase()
      }
    })
    if (search) rows = rows.filter(r => r.title.toLowerCase().includes(search) || r.detail.toLowerCase().includes(search))
  } else {
    rows = f.missing.filter(m => fine.has(m.albumId) === wantFine).map((m): Row => {
      const prof = f.profiles.get(m.albumId)!
      return {
        id: m.albumId, title: prof.title, thumbUrl: prof.thumb, isPhoto: false, status: wantFine ? 'fine' as const : 'open' as const,
        detail: `${m.photoIds.length.toLocaleString('en-US')} photo${m.photoIds.length === 1 ? '' : 's'} may belong here`, why: m.why,
        flickrUrl: albumUrl(owner, m.albumId), albumId: m.albumId, albumUrl: albumUrl(owner, m.albumId), ...kindOf(m.albumId), description: descriptions.get(m.albumId) ?? '', count: m.photoIds.length,
        sortDate: String(prof.created ?? 0).padStart(12, '0'), sortTitle: prof.title.toLowerCase()
      }
    })
    if (search) rows = rows.filter(r => r.title.toLowerCase().includes(search))
  }
  if (sort === 'title') rows.sort((a, b) => (a.sortTitle < b.sortTitle ? -1 : 1))
  else if (sort === 'titleDesc') rows.sort((a, b) => (a.sortTitle < b.sortTitle ? 1 : -1))
  else { const dir = sort === 'oldest' ? 1 : -1; rows.sort((a, b) => (a.sortDate < b.sortDate ? -dir : a.sortDate > b.sortDate ? dir : 0)) }
  return { total: rows.length, rows: rows.slice(offset, offset + limit).map(({ sortDate: _d, sortTitle: _t, ...r }) => r), ...(reasons ? { reasons } : {}) }
}

// The photos suggested for one album, for the batch editor
export function fitPhotos(albumId: string): AlbumFitPhoto[] {
  const f = fit()
  const owner = ownerNsid()
  const m = f.missing.find(x => x.albumId === albumId)
  if (!m) return []
  return m.photoIds.map(pid => { const info = f.infos.get(pid); return { photoId: pid, title: info?.title ?? '', thumbUrl: info?.thumb ?? '', flickrUrl: photoUrl(owner, pid) } })
}

// Every album with the kind the app picked and the kind in use, for the album settings list
export function fitKinds(): AlbumKindRow[] {
  const f = fit()
  const s = (n: number, one: string, many: string): string => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
  const why = (p: Profile): string => {
    if (p.pick === 'date') return `its photos sit in ${s(p.visits.length, 'visit', 'visits')}`
    if (p.pick === 'place') return `most photos are within ${Math.max(1, Math.round(p.loc?.p80 ?? 1))} km of its middle`
    if (p.pick === 'tag') return `a clear subject tag: ${p.strong.slice(0, 3).map(id => f.tagNames.get(id) ?? '').filter(Boolean).join(', ')}`
    return p.eligible ? 'no clear pattern' : `fewer than ${MIN_MEMBERS} photos`
  }
  return [...f.profiles.values()]
    .map(p => ({ albumId: p.id, title: p.title, photos: p.members.length, kind: p.kind, pick: p.pick, overridden: !p.guessed, why: why(p) }))
    .sort((a, b) => a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1)
}

export function fitPhotoIds(albumId: string): string[] {
  return fit().missing.find(m => m.albumId === albumId)?.photoIds ?? []
}

export function fitSetFine(req: AlbumSetRequest): void {
  const db = albumsDb()
  if (req.status === 'open') { db.prepare('DELETE FROM album_fit_state WHERE key = ? AND condition = ?').run(req.id, req.condition); clearFineReason(`albums:${req.condition}`, req.id) }
  else db.prepare(`INSERT INTO album_fit_state (key, condition, status, updated_at) VALUES (?, ?, 'fine', ?)
    ON CONFLICT(key, condition) DO UPDATE SET status = 'fine', updated_at = excluded.updated_at`).run(req.id, req.condition, Date.now())
}

// 'auto' goes back to the guess
export function fitSetKind(albumId: string, kind: AlbumKind | 'auto'): void {
  const db = albumsDb()
  if (kind === 'auto') db.prepare('DELETE FROM album_kind WHERE album_id = ?').run(albumId)
  else db.prepare('INSERT INTO album_kind (album_id, kind) VALUES (?, ?) ON CONFLICT(album_id) DO UPDATE SET kind = excluded.kind').run(albumId, kind)
  kindVersion++
  cache = null
}
