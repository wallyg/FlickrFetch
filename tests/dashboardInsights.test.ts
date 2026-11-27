import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDay, formatMonth, formatHour, formatRange, addDays, lastDayOfMonth, partsCaptions, percent, busiestRun, yearInsight, decadeInsight, visibilityInsight, filledInsight, placesInsight, exactInsight, tagsInsight, albumsInsight, sizeChoices, shownCount } from '../src/shared/dashboardInsights'
import type { LibraryStats } from '../src/shared/types'

// The sentences under the dashboard's cards are worked out from the numbers (#220). These use the owner's real shape, so a change that breaks one is seen.
const years = (pairs: [string, number][]): LibraryStats['years'] => pairs.map(([year, taken]) => ({ year, taken, uploaded: taken }))
const REAL = years([['2000', 35], ['2001', 331], ['2002', 121], ['2003', 180], ['2004', 84], ['2005', 479], ['2006', 2277], ['2007', 6704], ['2008', 3298], ['2009', 4448], ['2010', 6471], ['2011', 5588], ['2012', 5880], ['2013', 2744], ['2014', 1752], ['2015', 1538], ['2016', 2433], ['2017', 2713], ['2018', 2564], ['2019', 1621], ['2020', 705], ['2021', 1373], ['2022', 3974], ['2023', 2041], ['2024', 2379], ['2025', 5099], ['2026', 2721]])
const stats = (over: Partial<LibraryStats>): LibraryStats => ({ items: 71155, years: REAL, ...over } as LibraryStats)

test('percentages are whole, with a decimal near the ends, and never 100% while something is left', () => {
  assert.equal(percent(46, 100), '46%'); assert.equal(percent(1121, 71155), '1.6%'); assert.equal(percent(5200, 88829), '5.9%'); assert.equal(percent(5, 100), '5%'); assert.equal(percent(996, 10000), '10%'); assert.equal(percent(999, 1000), '99.9%'); assert.equal(percent(9999, 10000), '99.9%'); assert.equal(percent(9988, 10000), '99.9%'); assert.equal(percent(9951, 10000), '99.5%')
  assert.equal(percent(1, 1000), '0.1%'); assert.equal(percent(1, 100000), 'under 0.1%'); assert.equal(percent(5, 5), '100%'); assert.equal(percent(0, 0), '0%')
})

test('the busiest six years, and the last full year when it is the biggest in a while', () => {
  assert.deepEqual(busiestRun(REAL.map(y => ({ year: y.year, count: y.taken }))), { from: '2007', to: '2012', share: (6704 + 3298 + 4448 + 6471 + 5588 + 5880) / REAL.reduce((n, y) => n + y.taken, 0) })
  assert.match(yearInsight(stats({}), 'taken', 2026), /^2007 to 2012 hold 4\d% of everything you have taken\. 2025, with 5,099 items, is your biggest year since 2012, after a low of 705 in 2020\.$/)
  assert.equal(yearInsight(stats({}), 'uploaded', 2026), 'Your biggest upload years were 2007, 2010 and 2012.')
  assert.equal(yearInsight(stats({ years: years([['2020', 5], ['2021', 6]]) }), 'taken', 2026), '')     // too little to say anything
})

test('the decade sentence says when the current decade has passed an earlier one, and which decade holds the most', () => {
  const t = decadeInsight(stats({}), 'taken', 2026)
  assert.match(t, /^The 2020s have already passed the 2000s, 18,\d{3} items to 17,\d{3}, with 3 years still to go\. The 2010s hold 4\d% of your library\.$/)
  assert.match(decadeInsight(stats({}), 'uploaded', 2026), /^The 2020s have already passed the 2000s.* The 2010s took in \d+% of your uploads\.$/)
})

test('who can see them: the share seen by someone else, and what is private', () => {
  const v = { public: 55253, friendsFamily: 15602, onlyOne: 213, private: 87 }
  assert.equal(visibilityInsight(stats({ visibility: v })), '99.9% of your items can be seen by someone besides you. Only 87 are private, and 22% are shared with friends or family but not the public.')
  assert.match(visibilityInsight(stats({ items: 10, visibility: { public: 10, friendsFamily: 0, onlyOne: 0, private: 0 } })), /^100% of your items can be seen by someone besides you\. None are private\.$/)
})

test('what is filled in names the weakest field, which matches a Photos check', () => {
  const r = filledInsight(stats({ filled: { title: 71074, tags: 70980, description: 59011, location: 69109 } }))
  assert.deepEqual(r, { text: 'Descriptions are the gap: 12,144 items have none.', field: 'description' })
  assert.equal(filledInsight(stats({ filled: { title: 71155, tags: 71155, description: 71155, location: 71155 } }))?.text, 'Every item has a title, tags, a description and a location.')
  assert.match(filledInsight(stats({ filled: { title: 71155, tags: 71000, description: 71100, location: 71100 } }))!.text, /^Nearly everything is filled in\. The weakest is tags, at 99\.8%\.$/)
})

test('places: the leader and the count, for countries and for US states', () => {
  const places = { countries: [{ name: 'United States', items: 54330 }, { name: 'France', items: 3370 }], states: [{ name: 'New York', items: 17990 }, { name: 'New Jersey', items: 10532 }, { name: 'California', items: 4619 }], usItems: 54599, strayAt: null }
  assert.match(placesInsight(stats({ places, located: 69109 }), 'countries'), /^\d+% of your located items are in the United States\. 2 countries in all\. The percentages are shares of your 69,109 located items\.$/)
  assert.match(placesInsight(stats({ places, located: 69109 }), 'states'), /^New York and New Jersey hold 86% of your US photos\. 3 states and districts in all\./)
  assert.equal(placesInsight(stats({ places: { countries: [], states: [], usItems: 0, strayAt: null } }), 'states'), '')
})

test('how exact: a spot in no country is called out, and so is a year that is rarely located', () => {
  const places = { countries: [], states: [], usItems: 0, strayAt: { lat: -81.1, lon: -21.9, items: 591 } }
  assert.equal(exactInsight(stats({ places, leastLocatedYear: { year: '2021', percent: 73.8 } }))?.text, '591 items share one spot in Antarctica, almost certainly a wrong geotag. 2021 is your least-located year: 74% have a location.')
  assert.match(exactInsight(stats({ places: { ...places, strayAt: { lat: 12.3, lon: -40.5, items: 30 } }, leastLocatedYear: { year: '2021', percent: 97 } }))!.text, /^30 items share one spot at 12\.3° N, 40\.5° W, in no country, almost certainly a wrong geotag\.$/)
  assert.equal(exactInsight(stats({ places: { ...places, strayAt: null }, leastLocatedYear: { year: '2021', percent: 97 } })), null)
})

test('tags and albums: shares of the library, for the size chosen', () => {
  const topTags = [{ name: 'New York', items: 16529 }, { name: 'NY', items: 16009 }, { name: 'NYC', items: 14770 }, { name: 'New York City', items: 14666 }, { name: 'Sculpture', items: 9264 }]
  assert.match(tagsInsight(stats({ topTags, tagUses: 1210050 }), 5), /^The most-used tag, New York, is on 23% of your items\. Your top five tags make up 5.9% of every tag you have used\.$/)
  const topAlbums = [4360, 2923, 2752, 1622, 1312, 941, 864, 843, 812, 787].map((items, i) => ({ name: `A${i}`, items }))
  assert.equal(albumsInsight(stats({ topAlbums, albums: 508, medianAlbum: 117, smallAlbums: 7 }), 5), 'The five biggest albums hold 18% of your items.')
  assert.equal(albumsInsight(stats({ topAlbums, albums: 508, medianAlbum: 117, smallAlbums: 7 }), 10), 'The ten biggest albums hold 24% of your items. The typical album has 117, and only 7 have fewer than 10.')
  assert.equal(albumsInsight(stats({ topAlbums, albums: 12, medianAlbum: 9, smallAlbums: 4 }), 10), 'The ten biggest albums hold 24% of your items.')   // under 20 albums: no "typical album" line
})

test('the Top 5 / 10 / 25 buttons offer only sizes that exist, and no buttons for five or fewer', () => {
  assert.deepEqual(sizeChoices(50).map(c => c.label), ['Top 5', 'Top 10', 'Top 25'])
  assert.deepEqual(sizeChoices(25).map(c => c.label), ['Top 5', 'Top 10', 'Top 25'])
  assert.deepEqual(sizeChoices(15).map(c => c.label), ['Top 5', 'Top 10', 'All 15'])
  assert.deepEqual(sizeChoices(12).map(c => c.label), ['Top 5', 'Top 10', 'All 12'])
  assert.deepEqual(sizeChoices(9).map(c => c.label), ['Top 5', 'All 9'])
  assert.deepEqual(sizeChoices(10).map(c => c.label), ['Top 5', 'All 10'])
  assert.deepEqual(sizeChoices(5), []); assert.deepEqual(sizeChoices(0), [])
  assert.equal(shownCount(25, 20), 20); assert.equal(shownCount(5, 20), 5)
})

test('dates read the way people say them, and a range says the year once', () => {
  assert.equal(formatDay('2010-05-15'), 'May 15, 2010'); assert.equal(formatMonth('2025-04'), 'April 2025')
  assert.equal(formatHour(0), '12 am'); assert.equal(formatHour(12), '12 pm'); assert.equal(formatHour(16), '4 pm')
  assert.equal(formatRange('2013-02-10', '2013-03-16'), 'Feb 10 to Mar 16, 2013'); assert.equal(formatRange('2020-01-11', '2021-05-04'), 'Jan 11, 2020 to May 4, 2021'); assert.equal(formatRange('2010-05-15', '2010-05-15'), 'May 15, 2010')
  assert.equal(addDays('2010-05-14', 15), '2010-05-29'); assert.equal(lastDayOfMonth('2024-02'), '2024-02-29'); assert.equal(lastDayOfMonth('2025-04'), '2025-04-30')
})

test('the captions under the month, day and time charts name the peak', () => {
  const months = Array(12).fill(100); months[4] = 900; months[3] = 800
  const weekdays = [300, 100, 100, 100, 100, 200, 900]
  const hours = Array(24).fill(10); hours[15] = 500
  assert.deepEqual(partsCaptions(stats({ months, weekdays, hours })), { month: 'May is your busiest month, then April.', day: 'Saturday is your day, by a long way.', hour: 'Most are taken around 3 pm.' })
  assert.equal(partsCaptions(stats({ months: Array(12).fill(0), weekdays: [10, 11, 12, 11, 10, 11, 12], hours: Array(24).fill(0) })).day, 'Tuesday is your busiest day.')   // a tie goes to the first
  assert.deepEqual(partsCaptions(stats({ months: [], weekdays: [], hours: [] })), { month: '', day: '', hour: '' })
})
