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
  for (const f of ['AuditOverview', 'HealthOverview', 'LibraryOverview']) {
    const code = read(`src/renderer/components/${f}.tsx`)
    assert.ok(!/Dealt with|Fixed|COLORS\.fixed|COLORS\.plan/.test(code), `${f} has no fixed or dealt-with`)
    assert.match(code, /Counts/)
  }
  assert.match(read('src/renderer/components/AuditOverview.tsx'), /StatusLegend rows=\{legend\} withTags/)
  assert.match(read('src/renderer/components/HealthOverview.tsx'), /StatusLegend rows=\{legend\} withTags=\{false\}/)
  const front = read('src/renderer/components/LibraryOverview.tsx')
  assert.match(front, /Biggest issues to address/)
  assert.match(front, /Biggest warnings to review/)
  assert.ok(!/Where to start|Warnings to review </.test(front))
})

test('the Tags screen: no "Fixed" tab, no fixed ticks in the plan', () => {
  const panel = read('src/renderer/components/AuditPanel.tsx')
  assert.ok(!/key: 'fixed'|status === 'fixed'|p\.status/.test(panel))
})
