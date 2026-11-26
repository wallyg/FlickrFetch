import test from 'node:test'
import assert from 'node:assert/strict'
import { DATE_EXAMPLE_TAKEN, DATE_QUICK_PICKS, DATE_TOKENS, DEFAULT_DATE_PATTERN, checkDatePattern, formatDateStamp, migrateDatePattern, usesTwelveHour } from '../src/shared/dateStamp'

// The date stamp pattern (#266). The sample date is Friday 15 March 2024, 14:22:05.
const f = (p: string, when = DATE_EXAMPLE_TAKEN): string => formatDateStamp(p, when)

test('the four old formats give exactly the text they gave before', () => {
  assert.equal(f('yyyy-MM-dd'), '2024-03-15')
  assert.equal(f('yyyy-MM-dd HH-mm-ss'), '2024-03-15 14-22-05')
  assert.equal(f('yyyy.MM.dd'), '2024.03.15')
  assert.equal(f('yyyy.MM.dd HH.mm.ss'), '2024.03.15 14.22.05')
})

test('every part gives its example, and the buttons list exactly the parts that work', () => {
  for (const t of DATE_TOKENS) assert.equal(f(t.token), t.example, t.token)
  assert.equal(DATE_TOKENS.length, 17)
})

test('MM is the month and mm is the minutes, whatever the order', () => {
  assert.equal(f('MM'), '03')
  assert.equal(f('mm'), '22')
  assert.equal(f('HH-mm MM'), '14-22 03')
})

test('the 12-hour clock: midnight and noon are 12, and a gives AM or PM', () => {
  assert.equal(f('h a', '2024-03-15 00:05:00'), '12 AM')
  assert.equal(f('hh a', '2024-03-15 12:05:00'), '12 PM')
  assert.equal(f('hh a', '2024-03-15 09:05:00'), '09 AM')
  assert.equal(f('HH', '2024-03-15 00:05:00'), '00')
})

test('weekday and month names, including a leap day and the year 99', () => {
  assert.equal(f('EEEE, MMMM d', '2024-02-29 08:00:00'), 'Thursday, February 29')
  assert.equal(f('EEE MMM yy', '1999-12-31 23:59:59'), 'Fri Dec 99')
})

test('words go in quotes, and two quotes write one', () => {
  assert.equal(f("yyyy 'at' HH-mm"), '2024 at 14-22')
  assert.equal(f("'It''s' yyyy"), "It's 2024")
  assert.equal(f("'yyyy' yyyy"), 'yyyy 2024')
})

test('a letter that is not a part is a problem, with a hint about quotes', () => {
  const c = checkDatePattern('yyyy at HH')
  assert.equal(c.ok, false)
  assert.match(c.problem ?? '', /put it in quotes/)
  assert.equal(checkDatePattern('yyy').ok, false)       // three y: not a part
  assert.match(checkDatePattern('yyy').problem ?? '', /not one of the parts/)
  assert.equal(checkDatePattern("yyyy 'at").ok, false)  // quote not closed
  assert.equal(checkDatePattern('   ').ok, false)
  assert.equal(checkDatePattern('').ok, false)
})

test('/ and : are refused, and cannot get into a name', () => {
  assert.equal(checkDatePattern('yyyy/MM/dd').ok, false)
  assert.equal(checkDatePattern('HH:mm').ok, false)
  assert.equal(checkDatePattern("'a/b'").ok, false)
  assert.equal(f('yyyy/MM'), '2024-03-15')              // a pattern that does not work gives the default stamp
  assert.equal(f('nonsense'), '2024-03-15')
})

test('a pattern that does not work, an empty result or a missing time still gives a stamp', () => {
  assert.equal(f('yyyy', '2024-03-15'), '2024')
  assert.equal(f('HH-mm-ss', '2024-03-15'), '00-00-00')
  assert.equal(f("''"), "'")
  assert.equal(f('yyyy', 'garbage'), '0000')
})

test('a long result is cut at 60 characters', () => {
  assert.equal(f("'" + 'x'.repeat(100) + "'").length, 60)
})

test('old saved formats are migrated, new ones kept, and nothing saved means the default', () => {
  assert.equal(migrateDatePattern('YYYY-MM-DD HH-MM-SS'), 'yyyy-MM-dd HH-mm-ss')
  assert.equal(migrateDatePattern('YYYY.MM.DD HH.MM.SS'), 'yyyy.MM.dd HH.mm.ss')
  assert.equal(migrateDatePattern('yyyyMMdd'), 'yyyyMMdd')
  assert.equal(migrateDatePattern(undefined), DEFAULT_DATE_PATTERN)
  assert.equal(migrateDatePattern('  '), DEFAULT_DATE_PATTERN)
  for (const p of DATE_QUICK_PICKS) assert.equal(checkDatePattern(p).ok, true)
})

test('only a 12-hour stamp is flagged for sorting badly', () => {
  assert.equal(usesTwelveHour('yyyy-MM-dd hh-mm a'), true)
  assert.equal(usesTwelveHour('yyyy-MM-dd HH-mm'), false)
  assert.equal(usesTwelveHour("'at' yyyy"), false)
})

test('the editor shows the everyday parts first, and every part is still one click further', async () => {
  const { DATE_MAIN_TOKENS, DATE_TOKENS } = await import('../src/shared/dateStamp')
  const all = DATE_TOKENS.map(t => t.token)
  for (const t of DATE_MAIN_TOKENS) assert.ok(all.includes(t), `${t} is not a part`)
  assert.ok(DATE_MAIN_TOKENS.length <= 10 && DATE_MAIN_TOKENS.length < all.length)
  for (const g of ['Year', 'Month', 'Day', 'Weekday', 'Time']) assert.ok(DATE_TOKENS.some(t => t.group === g && (DATE_MAIN_TOKENS as readonly string[]).includes(t.token)), `no everyday part in ${g}`)
  assert.ok(['hh', 'h', 'a', 'H', 'M', 'd', 'EEE'].every(t => all.includes(t) && !(DATE_MAIN_TOKENS as readonly string[]).includes(t)))
})
