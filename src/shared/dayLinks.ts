import { itemsLabel } from './counts'

// The words that go with a shared collage (#267): one line per year of the day, each a link to that day on Flickr. A year with a single photo
// links to the photo itself, so nobody lands on a day page with one picture on it. Written as plain text so any share sheet, message or
// email shows it, and the links are clickable wherever the text is.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const part = (v: string): string => encodeURIComponent(v).replace(/%40/g, '@')   // an account id is like 12345678@N01: the @ stays


export interface DayLinkYear { year: string; count: number; videos: number; photoId?: string }   // photoId: the one photo, when the year has only one

/**
 * The address of a Flickr search for everything one account took on one date. It opens for anyone, signed in or not (they see the photos they are
 * allowed to see). Flickr's own "archive" day pages are not used: they need a Flickr sign-in, and for the owner they redirect to the Camera Roll.
 * The day runs from midnight to 23:59:59 on the date taken, as Flickr stores it. `nsid` must be the account id (12345678@N01), not a screen name.
 */
export function dayPageUrl(nsid: string, year: string, month: number, day: number): string {
  const start = Math.floor(Date.UTC(Number(year), month - 1, day) / 1000)
  return `https://www.flickr.com/search/?user_id=${encodeURIComponent(nsid)}&min_taken_date=${start}&max_taken_date=${start + 86399}&view_all=1`
}
export const photoPageUrl = (nsid: string, photoId: string): string => `https://www.flickr.com/photos/${part(nsid)}/${part(photoId)}/`

/** The line a year gets: where it goes. A single photo, or a year with a photo to open, goes to that photo. */
export function yearLinkUrl(nsid: string, y: DayLinkYear, month: number, day: number): string {
  return y.count === 1 && y.photoId ? photoPageUrl(nsid, y.photoId) : dayPageUrl(nsid, y.year, month, day)
}

/**
 * The text that goes with the picture, oldest year first like the picture. With `onlyYear` (a collage of one year) it is a single line under a dated headline.
 * `everyone` is false when some of the photos are not public: the closing sentence then says who can open them.
 */
export function dayLinkText(nsid: string, years: DayLinkYear[], month: number, day: number, opts: { onlyYear?: string; everyone?: boolean } = {}): string {
  const date = `${MONTH_NAMES[month - 1]} ${day}`
  const list = (opts.onlyYear ? years.filter(y => y.year === opts.onlyYear) : years).slice().sort((a, b) => (a.year < b.year ? -1 : a.year > b.year ? 1 : 0))
  if (!nsid || list.length === 0) return ''
  const lines = list.map(y => `${opts.onlyYear ? itemsLabel(y.count, y.videos) : `${y.year} · ${itemsLabel(y.count, y.videos)}`}\n${yearLinkUrl(nsid, y, month, day)}`)
  const head = opts.onlyYear ? `On this day, ${date}, ${opts.onlyYear}, in my photos:` : `On this day, ${date}, in my photos:`
  const tail = opts.everyone ? '' : '\n\nPublic photos open for anyone. Friends and family photos open when you are signed in to Flickr as my contact.'
  return `${head}\n\n${lines.join('\n')}${tail}`
}
