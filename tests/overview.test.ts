import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { openDatabase, getDb } from '../src/main/database'
import { auditOverview } from '../src/main/tagAudit'
import { loadSettings, saveSettings } from '../src/main/settings'
import { addTag, libraryTables } from './helpers'

// The Health Check overview (#220): a photo is counted once, under its worst; nothing is "fixed"; no green; one row format everywhere.
const ids = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${prefix}${i}`)
const read = (f: string): string => readFileSync(join(__dirname, '..', f), 'utf8')

before(() => {
  openDatabase('overview@N00')
  const db = getDb()!
  libraryTables(db)
  const common = ids('c', 100), rare = ids('r', 3)
  addTag(db, 'alley', common); addTag(db, 'alleys', rare)            // alleys is an Issue (singular and plural)
  addTag(db, 'street', [...common, ...rare]); addTag(db, 'urban', [...common, ...rare])
  addTag(db, 'solo', ['r0'])                                          // used once, on a photo that also carries the Issue tag
  addTag(db, 'lonely', ['x1'])                                        // used once, on a photo of its own
  db.exec('CREATE TABLE IF NOT EXISTS tag_indexed_photo (photo_id TEXT PRIMARY KEY, last_update INTEGER NOT NULL, scan_id INTEGER NOT NULL)')
  const put = db.prepare('INSERT OR REPLACE INTO tag_indexed_photo (photo_id, last_update, scan_id) VALUES (?, 1, 1)')
  for (const p of [...common, ...rare, 'x1', 'x2']) put.run(p)
  db.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('last_scan_at', '1')").run()
  saveSettings({ ...loadSettings(), cleanupRules: { 'tags:plural': 'on', 'tags:usedonce': 'optional' } })
})

test('a photo with an Issue tag and a Warning tag is counted once, under the Issue', () => {
  const o = auditOverview()
  assert.equal(o.flaggedTags, 1)                                      // alleys
  assert.equal(o.flaggedPhotos, 3)                                    // r0, r1, r2
  assert.equal(o.optionalTags, 2)                                     // solo and lonely
  assert.equal(o.optionalPhotos, 1)                                   // x1 only: r0 already counts under the Issue
  assert.equal(o.totalPhotos - o.flaggedPhotos - o.optionalPhotos, 105 - 3 - 1)   // 105 photos in all. No problems is the rest, so the three add up to the library
})

test('the overview has no fixed state and no list of top rows: every check is one row with its tags and photos', () => {
  const o = auditOverview() as unknown as Record<string, unknown>
  assert.ok(!('fixed' in o) && !('biggest' in o) && !('biggestWarnings' in o))
  for (const r of auditOverview().byType) assert.ok(!('fixed' in r))
})

test('the screens use one row, the three names and no green', () => {
  const parts = read('src/renderer/components/DashboardParts.tsx')
  assert.match(parts, /export const COLORS = \{ open: [^}]*warn: [^}]*fine: [^}]*\}/)
  assert.ok(!/fixed:|plan:|ff-success\)/.test(parts.slice(parts.indexOf('export const COLORS'), parts.indexOf('export const COLORS') + 300)), 'no green and no blue plan colour')
  for (const f of ['AuditOverview', 'HealthOverview', 'LibraryOverview', 'HealthBand', 'DashboardCards']) {
    const code = read(`src/renderer/components/${f}.tsx`)
    assert.ok(!/Dealt with|Fixed|COLORS\.fixed|COLORS\.plan/.test(code), `${f} has no fixed or dealt-with`)
  }
  for (const f of ['AuditOverview', 'HealthOverview']) assert.match(read(`src/renderer/components/${f}.tsx`), /Counts/)
  assert.match(read('src/renderer/components/AuditOverview.tsx'), /StatusLegend rows=\{legend\} withTags/)
  assert.match(read('src/renderer/components/HealthOverview.tsx'), /StatusLegend rows=\{legend\} withTags=\{false\}/)
  // The front page is the dashboard: a health band first, no lists of issues (they are on the Tags, Photos and Albums screens)
  const front = read('src/renderer/components/LibraryOverview.tsx')
  assert.match(front, /<HealthBand /)
  assert.ok(front.indexOf('<HealthBand') < front.indexOf('<Totals'), 'health comes first')
  assert.ok(!/Biggest issues|Biggest warnings|Where to start|Warnings to review/.test(front))
})

test('the Tags screen: no "Fixed" tab, no fixed ticks in the plan', () => {
  const panel = read('src/renderer/components/AuditPanel.tsx')
  assert.ok(!/key: 'fixed'|status === 'fixed'|p\.status/.test(panel))
})

test('every bar on the dashboard has a hover that says its figure and share, and where a click goes', () => {
  const cards = read('src/renderer/components/DashboardCards.tsx')
  for (const what of ['of the total', 'of those with a date', 'Click to show them', 'Click to see it on the Map', 'Click to open the album']) assert.ok(cards.includes(what), what)
  assert.match(read('src/renderer/components/DashboardParts.tsx'), /title=\{title\}/)   // a bar row carries its own hover
})

test('many decades get short labels so none is cut off', () => {
  assert.match(read('src/renderer/components/DashboardCards.tsx'), /decades\.length > 6 \? d\.decade\.slice\(2\) : d\.decade/)
})

test('the "numbers differ" notice has an alert icon and a dismiss button, and comes back only when a number changes', () => {
  const code = read('src/renderer/components/TagScanParts.tsx')
  assert.match(code, /<Icon name="warning" size=\{18\} \/>/)
  assert.match(code, /aria-label="Dismiss this notice"/)
  assert.match(code, /gapDismissed !== pair/)                                          // dismissed for this pair of numbers only
  assert.match(code, /const pair = `\$\{status\.flickrTotal\}\|\$\{status\.indexedPhotos\}`/)
})

test('Save as PDF is in the Health Check toolbar with a download icon, and "every date" shortcuts show no date chip', () => {
  const front = read('src/renderer/components/LibraryOverview.tsx')
  assert.match(front, /createPortal\(pdfButton, toolbarRight\)/)
  assert.match(front, /<Icon name="download" \/> PDF<\/button>/)                    // short, so it fits beside the other toolbar buttons
  assert.match(front, /aria-label="Save as PDF"/)
  for (const part of ['series={s} span={sp}', 'view="countries" n={10}', 'view="states" n={10}', 'mode="days"', 'mode="months"', 'n={25}']) assert.ok(front.includes(part), `the PDF has ${part}`)   // every view is printed, whatever is chosen on screen
  assert.match(read('src/renderer/components/CleanupPanel.tsx'), /toolbarRight=\{rightSlot\}/)
  const grid = read('src/renderer/components/PhotoGrid.tsx')
  assert.match(grid, /dateSearchRequest\.from === ALL_TIME\.from && dateSearchRequest\.to === ALL_TIME\.to/)   // no date filter, so no "01/01/00 – 12/31/99" chip
  assert.match(grid, /setDateMode\(everyDate \? 'all' : 'between'\)/)
})

test('every dashboard shortcut has a way back to Health Check: the Photostream, a tag, an album and the Map', () => {
  const main = read('src/renderer/pages/MainPage.tsx')
  assert.match(main, /openDateRange\(from, to, opts \?\? \{\}, 'cleanup'\)/)                 // the Photostream: "Back to Health Check"
  assert.match(main, /albumDetailOrigin === 'cleanup' \? 'Health Check' : 'Albums'/)          // an album: its back button says where it goes
  assert.match(main, /else if \(albumDetailOrigin === 'cleanup'\) \{\s*setCleanupVisited\(true\); setView\('cleanup'\)/)
  assert.match(main, /backTo=\{mapBack \? \{ label: 'Health Check'/)                           // the Map
  assert.match(main, /if \(view !== 'map'\) setMapBack\(false\)/)                              // and the link goes when you leave the Map
  assert.match(read('src/renderer/components/MapPanel.tsx'), /Back to \{backTo\.label\}/)
})

test('the month, day and time-of-day cards stretch across the row: the guessed-dates note is not inside their grid', () => {
  assert.match(read('src/renderer/components/LibraryOverview.tsx'), /<PartsCards stats=\{stats\} \/>\s*<\/div>\s*<GuessedNote/)
  assert.ok(!/gridColumn: '1 \/ -1' \}\}>\s*<b>\{fmt\(g\.items\)\}/.test(read('src/renderer/components/DashboardCards.tsx')))
})
