import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, utimesSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateDataFolder, MERGE_MARKER } from '../src/main/dataFolderMigration'

// The app's files used to be split between two folders; they are brought into one, once.
const DAY = 86400
const put = (dir: string, name: string, text: string, daysAgo: number): void => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), text)
  const t = Date.now() / 1000 - daysAgo * DAY
  utimesSync(join(dir, name), t, t)
}
const folders = (): { oldDir: string; newDir: string } => { const base = mkdtempSync(join(tmpdir(), 'ff-data-')); return { oldDir: join(base, 'FlickrFetch'), newDir: join(base, 'flickr-fetch') } }
const text = (dir: string, name: string): string => readFileSync(join(dir, name), 'utf8')

test('the newer sign-in and settings win, the history database stays, and the old sign-in copy is removed', () => {
  const { oldDir, newDir } = folders()
  put(oldDir, 'token.enc', 'live-token', 1); put(oldDir, 'settings.json', 'live-settings', 0); put(oldDir, 'flickrfetch.db', 'stale-db', 20)
  put(newDir, 'token.enc', 'stale-token', 30); put(newDir, 'settings.json', 'stale-settings', 5); put(newDir, 'flickrfetch.db', 'live-db', 0)
  migrateDataFolder(oldDir, newDir)
  assert.equal(text(newDir, 'token.enc'), 'live-token')
  assert.equal(text(newDir, 'settings.json'), 'live-settings')
  assert.equal(text(newDir, 'settings.json.bak-pre-merge'), 'stale-settings')   // what was replaced is kept
  assert.equal(text(newDir, 'flickrfetch.db'), 'live-db')                       // never overwritten
  assert.ok(!existsSync(join(oldDir, 'token.enc')), 'no second copy of the sign-in is left behind')
  assert.ok(existsSync(join(newDir, MERGE_MARKER)))
})

test('an older copy in the old folder never replaces the one in the new folder', () => {
  const { oldDir, newDir } = folders()
  put(oldDir, 'token.enc', 'old-token', 10); put(oldDir, 'settings.json', 'old-settings', 10)
  put(newDir, 'token.enc', 'new-token', 1); put(newDir, 'settings.json', 'new-settings', 1)
  migrateDataFolder(oldDir, newDir)
  assert.equal(text(newDir, 'token.enc'), 'new-token')
  assert.equal(text(newDir, 'settings.json'), 'new-settings')
  assert.ok(!existsSync(join(newDir, 'settings.json.bak-pre-merge')))
})

test('with nothing in the new folder yet, the database (with its working files) and the On This Day file come across', () => {
  const { oldDir, newDir } = folders()
  put(oldDir, 'flickrfetch.db', 'db', 1); put(oldDir, 'flickrfetch.db-wal', 'wal', 1); put(oldDir, 'on-this-day.json', '{}', 1)
  migrateDataFolder(oldDir, newDir)
  for (const n of ['flickrfetch.db', 'flickrfetch.db-wal', 'on-this-day.json']) assert.ok(existsSync(join(newDir, n)), n)
})

test('it runs once: a sign-in removed later by signing out does not come back at the next launch', () => {
  const { oldDir, newDir } = folders()
  put(oldDir, 'token.enc', 'token', 1)
  migrateDataFolder(oldDir, newDir)
  unlinkSync(join(newDir, 'token.enc'))                // the user signs out
  put(oldDir, 'token.enc', 'older-build-wrote-this', 0)   // even if an older build wrote one again
  migrateDataFolder(oldDir, newDir)
  assert.ok(!existsSync(join(newDir, 'token.enc')))
})

test('the same folder, or an old folder that does not exist, is left alone', () => {
  const { oldDir, newDir } = folders()
  assert.deepEqual(migrateDataFolder(newDir, newDir), [])
  assert.deepEqual(migrateDataFolder(oldDir, newDir), [])
})

test('the main process chooses the data folder before anything else loads (the sign-in and settings modules read the folder when they load)', () => {
  const src = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  const firstImport = src.split('\n').find(l => l.startsWith('import '))
  assert.equal(firstImport?.startsWith("import './dataFolder'"), true, 'dataFolder must be the first import of index.ts')
  assert.ok(!/app\.setPath\(\s*'userData'/.test(src), 'index.ts must not set the data folder itself (too late)')
  for (const f of ['auth.ts', 'settings.ts']) {
    const m = readFileSync(join(process.cwd(), 'src/main', f), 'utf8')
    assert.ok(/getPath\('userData'\)/.test(m))   // these two work the folder out at load, which is why the order matters
  }
})
