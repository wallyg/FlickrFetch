import test from 'node:test'
import assert from 'node:assert/strict'
import { safePngName, staleShareFiles, SHARE_FILE_KEEP_MS } from '../src/main/shareFile'

// The picture file the Share button hands to the Mac share sheet (#265): a safe name, and old files cleared away.

test('a picture name keeps its letters and ends in .png', () => {
  assert.equal(safePngName('on-this-day-Mar-15.png'), 'on-this-day-Mar-15.png')
  assert.equal(safePngName('on-this-day-Mar-15'), 'on-this-day-Mar-15.png')
  assert.equal(safePngName('Photo.PNG'), 'Photo.PNG')
})

test('a picture name cannot climb out of its folder or hide', () => {
  assert.equal(safePngName('../../etc/passwd'), '_.._etc_passwd.png')
  assert.equal(safePngName('..hidden.png'), 'hidden.png')
  assert.ok(!safePngName('a/b\\c:d').match(/[\\/:]/))
})

test('an empty or odd name falls back to a plain one', () => {
  assert.equal(safePngName(''), 'on-this-day.png')
  assert.equal(safePngName('   '), 'on-this-day.png')
  assert.equal(safePngName(undefined as unknown as string), 'on-this-day.png')
})

test('only pictures older than a day are cleared from the share folder', () => {
  const now = 10 * SHARE_FILE_KEEP_MS
  const files = [
    { name: 'old.png', changedMs: now - SHARE_FILE_KEEP_MS - 1 },
    { name: 'fresh.png', changedMs: now - SHARE_FILE_KEEP_MS + 1000 },
    { name: 'notes.txt', changedMs: 0 }
  ]
  assert.deepEqual(staleShareFiles(files, now), ['old.png'])      // a file that is not a picture is never touched
})
