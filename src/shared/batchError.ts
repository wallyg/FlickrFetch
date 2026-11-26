// What a download that could not start says on the download bar: the reason Flickr or the network gave, tidied (no "Error:" in front, one line,
// not longer than a sentence), and a plain line when there is none.
export function batchErrorText(error?: string): string {
  const t = (error ?? '').replace(/^(?:[A-Za-z]*Error:\s*)+/, '').replace(/\s+/g, ' ').trim()
  if (!t) return 'Something went wrong. Try again in a minute.'
  return t.length > 160 ? `${t.slice(0, 157)}…` : t
}
