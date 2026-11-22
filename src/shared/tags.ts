// Flickr's own tag form: lower case with spaces and punctuation removed (accents are kept).
// "New York" and "newyork" both become "newyork"; "Québec" becomes "québec".
export function cleanTag(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

// Removes accents from Latin letters ("Québec" becomes "Quebec"). Letters of other scripts are untouched.
export function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')
}
