import type Database from 'better-sqlite3'
import { loadSettings } from './settings'
import { foldAccents } from '../shared/tags'
import { levelFromSettings, loadPhotoInfos, nearbyPhotos, titlePlace, titleRulesOn } from './albumFit'
import type { AuditClue, AuditConfidence, MissingTagSettings } from '../shared/types'

// Photos probably missing a tag (#184, #150). A tag is suggested for a photo when at least two of five independent clues agree:
//   a tag it carries nearly always comes with this one (brooklyn -> nyc),
//   an album it is in is nearly all tagged this way,
//   the place its title starts with is nearly all tagged this way,
//   every photo taken right beside it (same minutes, same spot) carries it,
//   its title contains the tag's name (two or more words, such as "eiffel tower").
// Suggestions only. Nothing here changes Flickr.

export const MISSING_DEFAULTS: MissingTagSettings = { agree: 2, implication: 98, albumShare: 95, titleShare: 95 }
const MIN_TAG_PHOTOS = 20      // a tag must be on this many photos to be guessed from or to be suggested by tag habits
const MIN_ALBUM = 30           // an album needs this many photos before its habits count
const MIN_TITLE_GROUP = 10     // a title place needs this many photos
const SIGNAL = { implication: 1, album: 2, title: 4, nearby: 8, titleName: 16 } as const
const CLUES = 5
const MIN_NAME_LETTERS = 5     // a tag name must be at least this long, and two or more words, to be looked for in titles

export function missingSettings(): MissingTagSettings & { key: string } {
  const set = loadSettings().missingTags ?? {}
  const num = (v: unknown, def: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def)
  const d = MISSING_DEFAULTS
  const out = { agree: Math.round(num(set.agree, d.agree, 1, CLUES)), implication: num(set.implication, d.implication, 80, 100), albumShare: num(set.albumShare, d.albumShare, 80, 100), titleShare: num(set.titleShare, d.titleShare, 80, 100) }
  return { ...out, key: JSON.stringify(out) }
}

export interface MissingDraft {
  category: 'missing'; tag: string; display: string; count: number; confidence: AuditConfidence
  replacement: string; evidence: string; spellings: string[]; clues: AuditClue[]
}
export interface MissingResult { drafts: MissingDraft[]; photoIds: Map<string, string[]>; suggestions: number }   // photoIds: clean tag name -> photos missing it

const n = (x: number): string => x.toLocaleString('en-US')

export function detectMissingTags(db: Database.Database): MissingResult {
  const set = missingSettings()
  const level = levelFromSettings()
  const names = new Map<number, { name: string; display: string; count: number }>()
  for (const r of db.prepare('SELECT id, name, display, photo_count FROM tag_names WHERE photo_count > 0').all() as { id: number; name: string; display: string | null; photo_count: number }[]) {
    if (!r.name.includes(':')) names.set(r.id, { name: r.name, display: r.display ?? r.name, count: r.photo_count })   // machine tags are not suggested
  }
  const tagsOf = new Map<string, number[]>()
  for (const r of db.prepare('SELECT photo_id, tag_id FROM tag_photo').iterate() as IterableIterator<{ photo_id: string; tag_id: number }>) {
    if (!names.has(r.tag_id)) continue
    const a = tagsOf.get(r.photo_id); if (a) a.push(r.tag_id); else tagsOf.set(r.photo_id, [r.tag_id])
  }
  const has = (pid: string, t: number): boolean => (tagsOf.get(pid) ?? []).includes(t)
  const hints = new Map<string, Map<number, number>>()     // photo -> tag -> which clues agree (bit flags)
  const because = new Map<number, Map<number, number>>()   // tag -> the tag it usually comes with -> photos (for the evidence line)
  const mark = (pid: string, t: number, bit: number): void => {
    let m = hints.get(pid); if (!m) { m = new Map(); hints.set(pid, m) }
    m.set(t, (m.get(t) ?? 0) | bit)
  }

  // 1. Tag habits: photos with tag A carry tag B nearly always
  const photosWith = new Map<number, string[]>()
  for (const [pid, ts] of tagsOf) for (const t of ts) if ((names.get(t)?.count ?? 0) >= MIN_TAG_PHOTOS) { const l = photosWith.get(t); if (l) l.push(pid); else photosWith.set(t, [pid]) }
  for (const [a, pids] of photosWith) {
    const together = new Map<number, number>()
    for (const pid of pids) for (const b of tagsOf.get(pid) ?? []) if (b !== a && (names.get(b)?.count ?? 0) >= MIN_TAG_PHOTOS) together.set(b, (together.get(b) ?? 0) + 1)
    for (const [b, c] of together) {
      if (c / pids.length < set.implication / 100) continue
      for (const pid of pids) if (!has(pid, b)) {
        mark(pid, b, SIGNAL.implication)
        let m = because.get(b); if (!m) { m = new Map(); because.set(b, m) }
        m.set(a, (m.get(a) ?? 0) + 1)
      }
    }
  }

  // 2. Albums: a tag on nearly every photo of an album
  const albumPhotos = new Map<string, string[]>()
  // The album tables only exist once albums have been read; without them this clue is simply skipped
  try {
    for (const r of db.prepare('SELECT album_id, photo_id FROM album_photo').iterate() as IterableIterator<{ album_id: string; photo_id: string }>) {
      const l = albumPhotos.get(r.album_id); if (l) l.push(r.photo_id); else albumPhotos.set(r.album_id, [r.photo_id])
    }
  } catch { /* no album list yet */ }
  const byShare = (pids: string[], share: number): number[] => {
    const c = new Map<number, number>()
    for (const pid of pids) for (const t of tagsOf.get(pid) ?? []) c.set(t, (c.get(t) ?? 0) + 1)
    return [...c].filter(([, k]) => k >= share * pids.length).map(([t]) => t)
  }
  for (const pids of albumPhotos.values()) {
    if (pids.length < MIN_ALBUM) continue
    for (const t of byShare(pids, set.albumShare / 100)) for (const pid of pids) if (!has(pid, t)) mark(pid, t, SIGNAL.album)
  }

  // 3. Title place, and 4. photos taken right beside it
  const infos = loadPhotoInfos(db)
  if (titleRulesOn(infos, level)) {
    const groups = new Map<string, string[]>()
    for (const [pid, i] of infos) {
      const p = titlePlace(i.title); if (!p) continue
      const k = p.join('|'); const g = groups.get(k); if (g) g.push(pid); else groups.set(k, [pid])
    }
    for (const pids of groups.values()) {
      if (pids.length < MIN_TITLE_GROUP) continue
      for (const t of byShare(pids, set.titleShare / 100)) for (const pid of pids) if (!has(pid, t)) mark(pid, t, SIGNAL.title)
    }
  }
  for (const [pid, ns] of nearbyPhotos(infos, level.nearSeconds, level.nearKm)) {
    if (ns.length < level.nearMin) continue
    for (const t of byShare(ns, 1)) if (!has(pid, t)) mark(pid, t, SIGNAL.nearby)
  }

  // 5. A title that contains the name of a tag (two or more words): "Eiffel Tower at night" and the tag "Eiffel Tower"
  const norm = (x: string): string => foldAccents(x.toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim()
  const phrases = new Map<string, number[]>()
  for (const [id, t] of names) {
    if (t.count < MIN_TAG_PHOTOS) continue
    const ph = norm(t.display)
    if (ph.length >= MIN_NAME_LETTERS && ph.includes(' ')) { const l = phrases.get(ph); if (l) l.push(id); else phrases.set(ph, [id]) }
  }
  for (const [pid, i] of infos) {
    const words = norm(i.title).split(' ').filter(Boolean)
    for (let len = 2; len <= 5; len++) for (let k = 0; k + len <= words.length; k++) {
      const ids = phrases.get(words.slice(k, k + len).join(' '))
      if (ids) for (const t of ids) if (!has(pid, t)) mark(pid, t, SIGNAL.titleName)
    }
  }

  // Keep the pairs where enough clues agree, and group them by tag
  const bits = (x: number): number => { let c = 0; for (let b = 0; b < CLUES; b++) c += (x >> b) & 1; return c }
  const byTag = new Map<number, { pids: string[]; clues: number[]; strong: number }>()
  for (const [pid, m] of hints) for (const [t, flags] of m) {
    const k = bits(flags)
    if (k < set.agree) continue
    let g = byTag.get(t); if (!g) { g = { pids: [], clues: [0, 0, 0, 0, 0], strong: 0 }; byTag.set(t, g) }
    g.pids.push(pid)
    for (let b = 0; b < CLUES; b++) if ((flags >> b) & 1) g.clues[b]++
    if (k >= 3) g.strong++
  }
  const drafts: MissingDraft[] = []
  const photoIds = new Map<string, string[]>()
  let suggestions = 0
  for (const [t, g] of byTag) {
    const info = names.get(t)!
    suggestions += g.pids.length
    const why = [
      g.clues[0] ? `tag habit ${n(g.clues[0])}${topBecause(because.get(t), names)}` : '',
      g.clues[1] ? `album ${n(g.clues[1])}` : '',
      g.clues[2] ? `title place ${n(g.clues[2])}` : '',
      g.clues[3] ? `nearby photos ${n(g.clues[3])}` : '',
      g.clues[4] ? `title names it ${n(g.clues[4])}` : ''
    ].filter(Boolean)
    drafts.push({
      category: 'missing', tag: info.name, display: info.display, count: g.pids.length,
      confidence: g.strong >= g.pids.length / 2 ? 'high' : 'medium',
      replacement: '', evidence: `On ${n(info.count)} photos. Clues: ${why.join(' · ')}`, spellings: [],
      clues: ([['habit', g.clues[0]], ['album', g.clues[1]], ['titlePlace', g.clues[2]], ['near', g.clues[3]], ['titleName', g.clues[4]]] as const)
        .filter(([, c]) => c).map(([key, c]) => ({ key, n: c, ...(key === 'habit' ? { top: topName(because.get(t), names) } : {}) }))
    })
    photoIds.set(info.name, g.pids)
  }
  drafts.sort((a, b) => (a.confidence === b.confidence ? b.count - a.count : a.confidence === 'high' ? -1 : 1))
  return { drafts, photoIds, suggestions }
}

// ", most often with "brooklyn"" for the tag that most often predicts this one
function topName(m: Map<number, number> | undefined, names: Map<number, { display: string }>): string {
  if (!m) return ''
  let best = -1, count = 0
  for (const [a, c] of m) if (c > count) { best = a; count = c }
  return best >= 0 ? names.get(best)?.display ?? '' : ''
}
function topBecause(m: Map<number, number> | undefined, names: Map<number, { display: string }>): string {
  const top = topName(m, names)
  return top ? ` (${top})` : ''
}
