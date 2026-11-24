import type Database from 'better-sqlite3'
import type { AuditConfidence } from '../shared/types'

// Possessive tags (3.8): a one-word possessive on its own (Cliff's, Deno's) is usually a mistake. It should be the plain name (Cliff), or it
// is missing the second word (Cliff's Amusement Park). Not flagged: possessives of two or more words (Del Frisco's, St. John's), and any
// possessive whose photos mostly carry a restaurant, bar or shop tag, because that is the name of a place (McDonald's, Joe's).
// Suggestions only: the fix is made on Flickr.

const POSSESSIVE = /['’]s$/i
const VENUE_SHARE = 0.3   // a tag is the name of a place when at least this share of its photos carry a venue-type tag
const VENUE_WORDS = new Set(`restaurant restaurants bar bars pub pubs cafe cafes coffee coffeeshop diner diners deli delis bakery bakeries pizzeria pizza steakhouse steak grill grille tavern bbq barbecue brewery breweries store stores shop shops market markets mall hotel hotels inn motel hostel theater theatre cinema museum nightclub club lounge burger burgers hamburger fastfood food foodporn dining eatery bistro brasserie gallery bookstore bookshop shopping departmentstore supermarket retail bodega cocktail cocktails wine winebar brunch lunch dinner breakfast sandwich sandwiches sushi ramen noodles icecream dessert candy chocolate donut donuts bagel bagels cheesecake dive divebar sportsbar`.split(/\s+/))

export interface PossessiveDraft {
  category: 'possessive'; tag: string; display: string; count: number; confidence: AuditConfidence
  replacement: string; evidence: string; spellings: string[]
}

export function detectPossessives(db: Database.Database): PossessiveDraft[] {
  const rows = db.prepare('SELECT id, name, display, photo_count FROM tag_names WHERE photo_count > 0').all() as { id: number; name: string; display: string | null; photo_count: number }[]
  const byName = new Map(rows.map(r => [r.name, r]))
  const venueIds = new Set(rows.filter(r => VENUE_WORDS.has(r.name)).map(r => r.id))
  const cands = rows.filter(r => !r.name.includes(':') && r.display && POSSESSIVE.test(r.display.trim()) && !/\s/.test(r.display.trim()) && r.name.length >= 3)
  if (cands.length === 0) return []

  // How many of each candidate's photos also carry a venue-type tag
  const candIds = new Set(cands.map(r => r.id))
  const photosOf = new Map<number, Set<string>>()
  const union = new Set<string>()
  for (const r of db.prepare('SELECT photo_id, tag_id FROM tag_photo').iterate() as IterableIterator<{ photo_id: string; tag_id: number }>) {
    if (!candIds.has(r.tag_id)) continue
    let s = photosOf.get(r.tag_id); if (!s) { s = new Set(); photosOf.set(r.tag_id, s) }
    s.add(r.photo_id); union.add(r.photo_id)
  }
  const atVenue = new Set<string>()
  if (venueIds.size) for (const r of db.prepare('SELECT photo_id, tag_id FROM tag_photo').iterate() as IterableIterator<{ photo_id: string; tag_id: number }>) {
    if (venueIds.has(r.tag_id) && union.has(r.photo_id)) atVenue.add(r.photo_id)
  }

  const out: PossessiveDraft[] = []
  for (const r of cands) {
    const photos = photosOf.get(r.id) ?? new Set<string>()
    if (photos.size === 0) continue
    let venue = 0
    for (const p of photos) if (atVenue.has(p)) venue++
    if (venue / photos.size >= VENUE_SHARE) continue                            // the name of a place
    const shown = r.display!.trim()
    const plainName = r.name.slice(0, -1)
    const plain = byName.get(plainName)
    // 1980's is 1980s; otherwise the plain name is the starting point, to be edited if a second word is missing
    const replacement = /^\d+['’]s$/i.test(shown) ? `${shown.slice(0, -2)}s` : (plain?.display ?? shown.replace(POSSESSIVE, ''))
    out.push({
      category: 'possessive', tag: r.name, display: shown, count: r.photo_count,
      confidence: plain ? 'high' : 'medium',
      replacement,
      evidence: `"${shown}" is on ${r.photo_count.toLocaleString('en-US')} photo${r.photo_count === 1 ? '' : 's'} and does not look like the name of a restaurant, bar or shop (under ${Math.round(VENUE_SHARE * 100)}% of its photos have a venue-type tag). On its own it is usually either the plain name${plain ? ` ("${plain.display}", on ${plain.photo_count.toLocaleString('en-US')})` : ''} or missing the second word (such as "${shown} Pizza").`,
      spellings: []
    })
  }
  out.sort((a, b) => (a.confidence === b.confidence ? b.count - a.count : a.confidence === 'high' ? -1 : 1))
  return out
}
