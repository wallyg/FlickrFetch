import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, getDb } from '../src/main/database'
import { auditPlan, auditSet, auditList } from '../src/main/tagAudit'
import { addTag, libraryTables } from './helpers'

// The "Tag fixes to make on Flickr" plan. A plural or possessive item drops off the plan only when the tag itself has gone, not when a rule merely stops flagging it. Nothing is counted as fixed (#220).
const ids = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${prefix}${i}`)
let stamp = 0
const rescan = (): void => { getDb()!.prepare("INSERT OR REPLACE INTO tag_index_meta (key, value) VALUES ('last_scan_at', ?)").run(String(++stamp)) }

before(() => {
  openDatabase('test@N00')
  const db = getDb()!
  libraryTables(db)
  const common = ids('c', 100), rare = ids('r', 3)
  addTag(db, 'alley', common); addTag(db, 'alleys', rare)
  addTag(db, 'street', [...common, ...rare]); addTag(db, 'urban', [...common, ...rare])
  rescan()
})

test('a flagged tag can be put in the plan', () => {
  const found = auditList({ category: 'plural', status: 'open', offset: 0, limit: 30 } as Parameters<typeof auditList>[0])
  assert.equal(found.total, 1)
  auditSet({ tag: 'alleys', category: 'plural', status: 'plan' })
  const plan = auditPlan()
  assert.equal(plan.length, 1); assert.equal(plan[0].replacement, 'alley')
})
test('when a rule merely stops flagging the tag, the plan item stays on the plan', () => {
  // The rare form now sits on a photo that also has the common form: a deliberate pair, so the check lets it go. The tag is still there.
  getDb()!.prepare("INSERT OR IGNORE INTO tag_photo (photo_id, tag_id) VALUES ('r0', (SELECT id FROM tag_names WHERE name = 'alley'))").run()
  rescan()
  assert.equal(auditPlan().length, 1)
})
test('when the tag itself is gone from the library, the plan item drops off the plan: nothing is kept as fixed', () => {
  getDb()!.prepare("UPDATE tag_names SET photo_count = 0 WHERE name = 'alleys'").run()
  rescan()
  assert.equal(auditPlan().length, 0)
  assert.equal((getDb()!.prepare("SELECT COUNT(*) AS n FROM tag_audit_state WHERE status = 'fixed'").get() as { n: number }).n, 0)
})
