// What is wrong with a photo's description, worked out once at scan time and saved as flags (so the Health Check can
// list them without reading every description again). A description with nothing in it is not flagged here: that is
// the plain "No description" check.

import { decodeEntities } from './description'

export const DESC_ONLY_LINK = 1       // nothing but a web address
export const DESC_COPIES_TITLE = 2    // the same words as the title
export const DESC_HAS_HTML = 4        // contains HTML markup
export const DESC_LOOKS_LIKE_TAGS = 8 // a list of words that are mostly the photo's own tags
export const DESC_ONLY_MARKUP = 16    // HTML code with nothing readable in it (empty line breaks, empty paragraphs)

const norm = (t: string): string => t.toLowerCase().replace(/\s+/g, ' ').replace(/[\s.!?:;,-]+$/g, '').trim()

export function descriptionFlags(description: string, title: string, tags: Iterable<string>): number {
  const text = description.trim()
  if (!text) return 0
  let flags = 0
  if (/<\/?[a-z][^>]*>/i.test(text)) flags |= DESC_HAS_HTML
  // Tags come out first, then entities become letters (&amp; is &), so "Tom &amp; Jerry" matches the title "Tom & Jerry"
  const plain = decodeEntities(text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')).replace(/\s+/g, ' ').trim()
  // Markup and nothing to read (a picture on its own is real content, so it does not count)
  if (!plain && flags & DESC_HAS_HTML && !/<img\b/i.test(text)) flags |= DESC_ONLY_MARKUP
  if (/^(https?:\/\/|www\.)\S+$/i.test(plain)) flags |= DESC_ONLY_LINK
  const t = norm(title)
  if (t && norm(plain) === t) flags |= DESC_COPIES_TITLE
  // A list of tags: at least three short words, no sentences, and most of them are tags the photo already has
  const words = plain.toLowerCase().split(/[\s,;]+/).filter(Boolean)
  if (words.length >= 3 && !/[.!?]/.test(plain) && words.every(w => w.length <= 25)) {
    const own = new Set(tags)
    if (words.filter(w => own.has(w)).length / words.length >= 0.7) flags |= DESC_LOOKS_LIKE_TAGS
  }
  return flags
}
