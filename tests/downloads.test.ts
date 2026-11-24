import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, existsSync, utimesSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { changedSinceSaved } from '../src/main/smartFilter'
import { sweepStaleParts } from '../src/main/downloader'

// ---- "download updated photos": which photos count as changed
test('a photo changed on Flickr after it was saved counts as changed', () => {
  assert.equal(changedSinceSaved({ flickrLastUpdate: 100 }, { lastUpdate: 200 }), true)
})
test('a photo that has not changed since it was saved does not', () => {
  assert.equal(changedSinceSaved({ flickrLastUpdate: 200 }, { lastUpdate: 200 }), false)
  assert.equal(changedSinceSaved({ flickrLastUpdate: 200 }, { lastUpdate: 100 }), false)
})
test('a photo never saved is not "updated" (it is a never-downloaded photo)', () => {
  assert.equal(changedSinceSaved(undefined, { lastUpdate: 200 }), false)
})
test('a photo saved through a selection (update time stored as 0) is never called changed', () => {
  assert.equal(changedSinceSaved({ flickrLastUpdate: 0 }, { lastUpdate: 999999 }), false)
})
test('a photo with no update time from Flickr is not called changed', () => {
  assert.equal(changedSinceSaved({ flickrLastUpdate: 100 }, {}), false)
})

// ---- cleaning up half-finished downloads
test('old half-finished photo downloads are removed; recent ones and other files are kept', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ff-part-'))
  const old = (name: string): void => { writeFileSync(join(dir, name), 'x'); const t = (Date.now() - 3 * 86400000) / 1000; utimesSync(join(dir, name), t, t) }
  old('stale.jpg.part'); old('stale-video.MOV.part'); old('notes.txt.part'); old('keep-me.jpg')
  writeFileSync(join(dir, 'fresh.jpg.part'), 'x')
  sweepStaleParts(dir)
  assert.deepEqual(readdirSync(dir).sort(), ['fresh.jpg.part', 'keep-me.jpg', 'notes.txt.part'])
  assert.ok(!existsSync(join(dir, 'stale.jpg.part')))
})
test('a folder that does not exist is simply skipped', () => {
  assert.doesNotThrow(() => sweepStaleParts(join(tmpdir(), 'ff-no-such-folder-9f3a')))
})
