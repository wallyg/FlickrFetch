// The date stamp in a file name, built from a pattern the user writes (#266). Letters are parts of the date; anything else is copied as it is;
// words go in single quotes ('at'; two quotes in a row, '', write one quote). The letters are case-sensitive, as in most tools:
//   yyyy 2024   yy 24        MMMM March   MMM Mar   MM 03   M 3        dd 05   d 5
//   EEEE Friday EEE Fri      HH 14  H 14 (24-hour)   hh 02  h 2 (12-hour, with a for AM or PM)   mm 22 (minutes)   ss 05
// A file name cannot hold / or : so those are refused. Nothing here ever throws: a pattern that does not work falls back to the default.

export const DEFAULT_DATE_PATTERN = 'yyyy-MM-dd'
/** The four formats the app offered before patterns, kept as quick picks. */
export const DATE_QUICK_PICKS = ['yyyy-MM-dd', 'yyyy-MM-dd HH-mm-ss', 'yyyy.MM.dd', 'yyyy.MM.dd HH.mm.ss'] as const
const OLD_FORMATS: Record<string, string> = {
  'YYYY-MM-DD': 'yyyy-MM-dd', 'YYYY-MM-DD HH-MM-SS': 'yyyy-MM-dd HH-mm-ss', 'YYYY.MM.DD': 'yyyy.MM.dd', 'YYYY.MM.DD HH.MM.SS': 'yyyy.MM.dd HH.mm.ss'
}
export const DATE_EXAMPLE_TAKEN = '2024-03-15 14:22:05'   // a Friday

export interface DateToken { token: string; group: 'Year' | 'Month' | 'Day' | 'Weekday' | 'Time'; example: string }
/** Every part, in the order the editor shows them. */
export const DATE_TOKENS: DateToken[] = [
  { token: 'yyyy', group: 'Year', example: '2024' }, { token: 'yy', group: 'Year', example: '24' },
  { token: 'MMMM', group: 'Month', example: 'March' }, { token: 'MMM', group: 'Month', example: 'Mar' }, { token: 'MM', group: 'Month', example: '03' }, { token: 'M', group: 'Month', example: '3' },
  { token: 'dd', group: 'Day', example: '15' }, { token: 'd', group: 'Day', example: '15' },
  { token: 'EEEE', group: 'Weekday', example: 'Friday' }, { token: 'EEE', group: 'Weekday', example: 'Fri' },
  { token: 'HH', group: 'Time', example: '14' }, { token: 'H', group: 'Time', example: '14' }, { token: 'hh', group: 'Time', example: '02' }, { token: 'h', group: 'Time', example: '2' },
  { token: 'mm', group: 'Time', example: '22' }, { token: 'ss', group: 'Time', example: '05' }, { token: 'a', group: 'Time', example: 'PM' }
]
const TOKENS = new Set(DATE_TOKENS.map(t => t.token))
const ILLEGAL = /[/:\\\u0000-\u001f]/
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MAX_LENGTH = 60

type Part = { kind: 'token' | 'text'; text: string }

/** Saved settings may hold one of the four old formats (written YYYY-MM-DD HH-MM-SS, where MM was also the minutes): turn it into a pattern. */
export function migrateDatePattern(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return DEFAULT_DATE_PATTERN
  return OLD_FORMATS[value] ?? value
}

export function parseDatePattern(pattern: string): { parts: Part[]; problem: string | null } {
  const parts: Part[] = []
  let i = 0
  const fail = (problem: string): { parts: Part[]; problem: string } => ({ parts, problem })
  if (pattern.trim() === '') return fail('Write at least one part, such as yyyy.')
  while (i < pattern.length) {
    const ch = pattern[i]
    if (ch === '\'') {
      if (pattern[i + 1] === '\'') { parts.push({ kind: 'text', text: '\'' }); i += 2; continue }
      let j = i + 1, text = ''
      while (j < pattern.length) {
        if (pattern[j] === '\'') { if (pattern[j + 1] === '\'') { text += '\''; j += 2; continue } break }
        text += pattern[j]; j++
      }
      if (j >= pattern.length) return fail('A quote is not closed.')
      if (ILLEGAL.test(text)) return fail('A file name cannot contain / or :.')
      parts.push({ kind: 'text', text }); i = j + 1; continue
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i
      while (j < pattern.length && pattern[j] === ch) j++
      const run = pattern.slice(i, j)
      if (!TOKENS.has(run)) return fail(TOKENS.has(ch) || 'yMdEHhmsa'.includes(ch) ? `"${run}" is not one of the parts. Use the buttons below for the ones that exist.` : `"${run}" is not a part of a date. To write it as a word, put it in quotes: '${run}'.`)
      parts.push({ kind: 'token', text: run }); i = j; continue
    }
    if (ILLEGAL.test(ch)) return fail('A file name cannot contain / or :.')
    parts.push({ kind: 'text', text: ch }); i++
  }
  return { parts, problem: null }
}

/** Whether the pattern works, and if not, what to tell the person. */
export function checkDatePattern(pattern: string): { ok: boolean; problem: string | null } {
  const { problem } = parseDatePattern(pattern)
  return { ok: problem === null, problem }
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** The stamp for a Flickr date-taken string ("2024-03-15 14:22:05"). A pattern that does not work gives the default stamp. */
export function formatDateStamp(pattern: string, dateTaken: string): string {
  const [datePart = '', timePart = '00:00:00'] = dateTaken.split(' ')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mi, ss] = timePart.split(':').map(Number)
  const year = Number.isFinite(y) ? y : 0, month = Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1, day = Number.isFinite(d) && d >= 1 ? d : 1
  const hour = Number.isFinite(hh) ? hh : 0, minute = Number.isFinite(mi) ? mi : 0, second = Number.isFinite(ss) ? ss : 0
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  const value: Record<string, string> = {
    yyyy: String(year).padStart(4, '0'), yy: String(year % 100).padStart(2, '0'),
    MMMM: MONTHS[month - 1], MMM: MONTHS[month - 1].slice(0, 3), MM: pad2(month), M: String(month),
    dd: pad2(day), d: String(day), EEEE: DAYS[weekday], EEE: DAYS[weekday].slice(0, 3),
    HH: pad2(hour), H: String(hour), hh: pad2(hour12), h: String(hour12), mm: pad2(minute), ss: pad2(second), a: hour < 12 ? 'AM' : 'PM'
  }
  const run = (p: string): string => parseDatePattern(p).parts.map(x => x.kind === 'token' ? value[x.text] : x.text).join('')
  const parsed = parseDatePattern(pattern)
  const out = (parsed.problem ? run(DEFAULT_DATE_PATTERN) : run(pattern)).replace(/[/:\\\u0000-\u001f]/g, '-').slice(0, MAX_LENGTH).trim()
  return out === '' ? run(DEFAULT_DATE_PATTERN) : out
}

/** A 12-hour stamp does not sort in time order in a file list ("02 PM" sorts before "10 AM"). */
export function usesTwelveHour(pattern: string): boolean {
  return parseDatePattern(pattern).parts.some(p => p.kind === 'token' && (p.text === 'hh' || p.text === 'h' || p.text === 'a'))
}
