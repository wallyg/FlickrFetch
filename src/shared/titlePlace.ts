import { foldAccents } from './tags'

// The place a title starts with: "City - Neighbourhood: Subject" gives [city, neighbourhood]; "City: Subject" gives [city]. Accents and case
// ignored. The place ends at a colon (also the wide one) or a pipe; the city and neighbourhood are split by a hyphen or a dash.
const PLACE_END = '[:\\uFF1A|]'                       // what ends the place: a colon (also the wide one) or a pipe
const PATH_RE = new RegExp(`^\\s*([^:\\uFF1A|]+?)\\s+[-\\u2013\\u2014]\\s+([^:\\uFF1A|]+?)\\s*${PLACE_END}`)   // "City - Neighbourhood: ..." (hyphen or dash)
const CITY_RE = new RegExp(`^\\s*([^:\\uFF1A|]+?)\\s*${PLACE_END}`)                                        // "City: ..." (a single place, no neighbourhood)
export const plain = (s: string): string => foldAccents(s.toLowerCase()).trim()
export function titlePlace(title: string): string[] | null {
  const m = PATH_RE.exec(title)
  if (m) return [plain(m[1]), plain(m[2])]
  const c = CITY_RE.exec(title)
  if (c && !/\s[-\u2013\u2014]\s/.test(c[1])) return [plain(c[1])]
  return null
}


// The place as the title itself spells it ("NYC - Chelsea"), for showing to people
export const placeText = (title: string): string => title.split(/[:\uFF1A|]/)[0].trim()
// The city part as the title spells it ("NYC")
export const cityText = (title: string): string => placeText(title).split(/\s+[-\u2013\u2014]\s+/)[0].trim()
