import { itemsLabel } from './counts'

// The words that go with a shared collage (#267): one line per year of the day, each a link to that day on Flickr. A year with a single photo
// links to the photo itself, so nobody lands on a day page with one picture on it. Written as plain text so any share sheet, message or
// email shows it, and the links are clickable wherever the text is.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (n: number): string => String(n).padStart(2, '0')
const part = (v: string): string => encodeURIComponent(v).replace(/%40/g, '@')   // an account id is like 12345678@N01: the @ stays


export interface DayLinkYear { year: string; count: number; videos: number; photoId?: string }   // photoId: the one photo, when the year has only one

/** The address of Flickr's page of everything taken on one date, for the owner `nsid` (the account's id works where a name would). */
export function dayPageUrl(nsid: string, year: string, month: number, day: number): string {
  return `https://www.flickr.com/photos/${part(nsid)}/archives/date-taken/${year}/${pad(month)}/${pad(day)}/`
}
export const photoPageUrl = (nsid: string, photoId: string): string => `https://www.flickr.com/photos/${part(nsid)}/${part(photoId)}/`

/** The line a year gets: where it goes. A single photo, or a year with a photo to open, goes to that photo. */
export function yearLinkUrl(nsid: string, y: DayLinkYear, month: number, day: number): string {
  return y.count === 1 && y.photoId ? photoPageUrl(nsid, y.photoId) : dayPageUrl(nsid, y.year, month, day)
}

/**
 * The text that goes with the picture. `years` is newest first. With `onlyYear` (a collage of one year) it is a single line under a dated headline.
 * `everyone` is false when some of the photos are not public: the closing sentence then says who can open them.
 */
export function dayLinkText(nsid: string, years: DayLinkYear[], month: number, day: number, opts: { onlyYear?: string; everyone?: boolean } = {}): string {
  const date = `${MONTH_NAMES[month - 1]} ${day}`
  const list = opts.onlyYear ? years.filter(y => y.year === opts.onlyYear) : years
  if (!nsid || list.length === 0) return ''
  const lines = list.map(y => `${opts.onlyYear ? itemsLabel(y.count, y.videos) : `${y.year} · ${itemsLabel(y.count, y.videos)}`}\n${yearLinkUrl(nsid, y, month, day)}`)
  const head = opts.onlyYear ? `On this day, ${date}, ${opts.onlyYear}, in my photos:` : `On this day, ${date}, in my photos:`
  const tail = opts.everyone ? '' : '\n\nPublic photos open for anyone. Friends and family photos open when you are signed in to Flickr as my contact.'
  return `${head}\n\n${lines.join('\n')}${tail}`
}
