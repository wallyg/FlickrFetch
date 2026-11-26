import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, closeDatabase, getDb, writeBatchLog, getBatchLog, clearBatchLog, clearAllHistory } from '../src/main/database'

// Clearing the history takes the titles of failed photos with it, and the 90-day tidy-up does too.
before(() => { openDatabase('test@N00') })
const failures = (): number => (getDb()!.prepare('SELECT COUNT(*) AS n FROM batch_log_failures').get() as { n: number }).n
const log = (createdAt: number): void => { writeBatchLog({ createdAt, source: 'Album', sourceType: 'album', total: 2, downloaded: 0, skippedCollision: 0, failed: 2, status: 'partial', failedPhotos: [{ id: '1', title: 'One' }, { id: '2', title: 'Two' }] }) }

test('Clear history removes the failed-photo rows as well', () => {
  clearAllHistory(); log(Date.now()); assert.equal(failures(), 2)
  clearAllHistory(); assert.equal(failures(), 0)
})
test('clearing only the download log removes them too', () => {
  clearAllHistory(); log(Date.now()); clearBatchLog(); assert.equal(failures(), 0)
})
test('entries older than 90 days go with their failed-photo rows', () => {
  clearAllHistory(); log(Date.now() - 100 * 86400000); log(Date.now())
  assert.equal(failures(), 4)
  assert.equal(getBatchLog().length, 1)
  assert.equal(failures(), 2)
})
test('rows left behind by an earlier version are removed when the database opens', () => {
  clearAllHistory()
  getDb()!.prepare("INSERT INTO batch_log_failures (batch_log_id, photo_id, title) VALUES (999, '5', 'Left over')").run()
  assert.equal(failures(), 1)
  closeDatabase(); openDatabase('test@N00')
  assert.equal(failures(), 0)
})
