// Flickr's own tag form: lower case with spaces and punctuation removed (accents are kept).
// "New York" and "newyork" both become "newyork"; "Québec" becomes "québec".
export function cleanTag(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

/** The tags typed in a filter box: separated by commas, each in Flickr's own form, so "New York, Paris" is two tags, "newyork" and "paris". */
export function parseTagInput(input: string): string[] {
  return input.split(',').map(cleanTag).filter(Boolean)
}

/** Whether a photo carries the wanted tags (from parseTagInput): all of them, or at least one. No tags typed means every photo matches. */
export function hasTags(photoTags: readonly string[] | undefined, wanted: readonly string[], mode: 'any' | 'all'): boolean {
  if (wanted.length === 0) return true
  const have = (photoTags ?? []).map(cleanTag)
  return mode === 'all' ? wanted.every(t => have.includes(t)) : wanted.some(t => have.includes(t))
}

// The Unicode block of combining accent marks (U+0300 to U+036F), written with code points so it stays readable
const COMBINING_ACCENTS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g')

// Removes accents from Latin letters ("Québec" becomes "Quebec"). Letters of other scripts are untouched.
export function foldAccents(s: string): string {
  return s.normalize('NFD').replace(COMBINING_ACCENTS, '').normalize('NFC')
}

// Like foldAccents, but only for Latin letters: Cyrillic, Greek, kana and other scripts keep their marks.
export function foldLatinAccents(s: string): string {
  const out: string[] = []
  let baseIsLatin = false
  for (const ch of s.normalize('NFD')) {
    if (/\p{M}/u.test(ch)) {
      if (baseIsLatin) continue
    } else {
      baseIsLatin = /^[A-Za-z]$/.test(ch)
    }
    out.push(ch)
  }
  return out.join('').normalize('NFC')
}

// Where a lower-case letter runs straight into a capital with no gap ("SunsetBeach"): a zero-width match
// between the two. Shared so the audit's detection and the red join marks on screen always agree.
export const GLUE_BOUNDARY_SOURCE = '(?<=[a-zß-ÿā-ſ])(?=[A-ZÀ-Þ])'
