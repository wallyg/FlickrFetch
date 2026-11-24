import type Database from 'better-sqlite3'
import type { AuditConfidence } from '../shared/types'

// Singular and plural (#185, the strict version): a tag that is the rare form of a pair you mostly use the other way (alleys beside alley).
// A pair is flagged only when all of these hold, because many pairs are deliberate (cemetery and cemeteries typed together on purpose) or
// two different words (queen and queens):
//   the rare form is on at most 5% as many photos as the common form,
//   the two forms are never on the same photo,
//   at least half of the rare form's most common companion tags also go with the common form.
// Suggestions only: the fix is made on Flickr.

const MAX_SHARE = 0.05       // the rare form is on at most this share of the common form's photos
const COMPANIONS = 8         // how many of the rare form's most common companion tags are looked at
const COMPANION_SHARE = 0.5  // ...and at least this share of them must also go with the common form

export interface PluralDraft {
  category: 'plural'; tag: string; display: string; count: number; confidence: AuditConfidence
  replacement: string; evidence: string; spellings: string[]
}

// The plural spellings a tag name may have: berry to berries, church to churches, alley to alleys
function pluralsOf(n: string): string[] {
  const out: string[] = []
  if (n.endsWith('y') && n.length > 3 && !'aeiou'.includes(n[n.length - 2])) out.push(`${n.slice(0, -1)}ies`)
  if (/(s|x|z|ch|sh)$/.test(n)) out.push(`${n}es`)
  out.push(`${n}s`)
  return out
}

export function detectPlurals(db: Database.Database): PluralDraft[] {
  const tags = new Map<string, { id: number; display: string; count: number }>()
  for (const r of db.prepare('SELECT id, name, display, photo_count FROM tag_names WHERE photo_count > 0').all() as { id: number; name: string; display: string | null; photo_count: number }[]) {
    if (!r.name.includes(':') && r.name.length >= 4) tags.set(r.name, { id: r.id, display: r.display ?? r.name, count: r.photo_count })
  }
  // Pairs where both forms exist and one is rare
  const pairs: { rare: string; common: string }[] = []
  for (const [name, t] of tags) {
    const plural = pluralsOf(name).find(p => tags.has(p))
    if (!plural) continue
    const p = tags.get(plural)!
    const [rare, common] = t.count <= p.count ? [name, plural] : [plural, name]
    const small = Math.min(t.count, p.count), big = Math.max(t.count, p.count)
    if (small / big <= MAX_SHARE) pairs.push({ rare, common })
  }
  if (pairs.length === 0) return []

  // Which photos carry each of these tags, and what else those photos carry
  const need = new Set<number>()
  for (const p of pairs) { need.add(tags.get(p.rare)!.id); need.add(tags.get(p.common)!.id) }
  const photosOf = new Map<number, Set<string>>()
  const union = new Set<string>()
  for (const r of db.prepare('SELECT photo_id, tag_id FROM tag_photo').iterate() as IterableIterator<{ photo_id: string; tag_id: number }>) {
    if (!need.has(r.tag_id)) continue
    let s = photosOf.get(r.tag_id); if (!s) { s = new Set(); photosOf.set(r.tag_id, s) }
    s.add(r.photo_id); union.add(r.photo_id)
  }
  const tagsOf = new Map<string, number[]>()
  for (const r of db.prepare('SELECT photo_id, tag_id FROM tag_photo').iterate() as IterableIterator<{ photo_id: string; tag_id: number }>) {
    if (!union.has(r.photo_id)) continue
    const l = tagsOf.get(r.photo_id); if (l) l.push(r.tag_id); else tagsOf.set(r.photo_id, [r.tag_id])
  }
  const companions = (id: number): Map<number, number> => {
    const c = new Map<number, number>()
    for (const pid of photosOf.get(id) ?? []) for (const t of tagsOf.get(pid) ?? []) if (t !== id) c.set(t, (c.get(t) ?? 0) + 1)
    return c
  }

  const out: PluralDraft[] = []
  for (const { rare, common } of pairs) {
    const r = tags.get(rare)!, c = tags.get(common)!
    if (/['\u2019]/.test(r.display) || /['\u2019]/.test(c.display)) continue    // Wally's and Wally: a possessive, handled by the Possessive on its own check
    const rarePhotos = photosOf.get(r.id) ?? new Set<string>(), commonPhotos = photosOf.get(c.id) ?? new Set<string>()
    if ([...rarePhotos].some(p => commonPhotos.has(p))) continue                 // typed together on a photo: deliberate
    const mine = [...companions(r.id)].sort((a, b) => b[1] - a[1]).slice(0, COMPANIONS).map(([t]) => t)
    if (mine.length === 0) continue
    const theirs = companions(c.id)
    const shared = mine.filter(t => theirs.has(t)).length / mine.length
    if (shared < COMPANION_SHARE) continue                                        // different company: probably a different word
    out.push({
      category: 'plural', tag: rare, display: r.display, count: r.count,
      confidence: r.count === 1 && c.count >= 30 ? 'high' : 'medium',
      replacement: c.display,
      evidence: `on ${c.count.toLocaleString('en-US')} photo${c.count === 1 ? '' : 's'}`,
      spellings: []
    })
  }
  out.sort((a, b) => (a.confidence === b.confidence ? b.count - a.count : a.confidence === 'high' ? -1 : 1))
  return out
}
