// Flickr license numbers, their names and their license pages (used for embedded metadata and credit lines).
export const LICENSE_MAP: Record<string, { name: string; url: string }> = {
  '0':  { name: 'All Rights Reserved', url: '' },
  '1':  { name: 'CC BY-NC-SA 2.0', url: 'https://creativecommons.org/licenses/by-nc-sa/2.0/' },
  '2':  { name: 'CC BY-NC 2.0',    url: 'https://creativecommons.org/licenses/by-nc/2.0/' },
  '3':  { name: 'CC BY-NC-ND 2.0', url: 'https://creativecommons.org/licenses/by-nc-nd/2.0/' },
  '4':  { name: 'CC BY 2.0',       url: 'https://creativecommons.org/licenses/by/2.0/' },
  '5':  { name: 'CC BY-SA 2.0',    url: 'https://creativecommons.org/licenses/by-sa/2.0/' },
  '6':  { name: 'CC BY-ND 2.0',    url: 'https://creativecommons.org/licenses/by-nd/2.0/' },
  '7':  { name: 'No known copyright restrictions', url: 'https://www.flickr.com/commons/usage/' },
  '8':  { name: 'United States Government Work',   url: 'http://www.usa.gov/copyright.shtml' },
  '9':  { name: 'CC0 1.0',         url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  '10': { name: 'Public Domain Mark 1.0', url: 'https://creativecommons.org/publicdomain/mark/1.0/' },
  '11': { name: 'CC BY 4.0',       url: 'https://creativecommons.org/licenses/by/4.0/' },
  '12': { name: 'CC BY-SA 4.0',    url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  '13': { name: 'CC BY-ND 4.0',    url: 'https://creativecommons.org/licenses/by-nd/4.0/' },
  '14': { name: 'CC BY-NC 4.0',    url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  '15': { name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  '16': { name: 'CC BY-NC-ND 4.0', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/' },
}

// Licenses where a credit line is required (Creative Commons with attribution)
const CC_BY_IDS = new Set(['1', '2', '3', '4', '5', '6', '11', '12', '13', '14', '15', '16'])
// Licenses that need no credit but where a link back is polite
const NO_CREDIT_IDS = new Set(['7', '8', '9', '10'])

export function canCopyAttribution(license: string): boolean {
  return CC_BY_IDS.has(license) || NO_CREDIT_IDS.has(license)
}

// One-line credit for a Creative Commons photo, in the usual "title, author, source, license" order.
export function buildAttribution(license: string, title: string, owner: string, photoUrl: string): string {
  const lic = LICENSE_MAP[license]
  if (!lic || !canCopyAttribution(license)) return ''   // All Rights Reserved and unknown licenses get no credit line
  const who = owner || 'the photographer'
  const name = title ? `\u201c${title}\u201d` : 'Photo'
  if (NO_CREDIT_IDS.has(license)) {
    return `${name} by ${who} (${photoUrl}). ${lic.name}: no credit required, link given as a courtesy.`
  }
  return `${name} by ${who}, ${lic.name}${lic.url ? ` (${lic.url})` : ''}. Source: ${photoUrl}`
}
