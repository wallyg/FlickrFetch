import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConflict } from '../src/main/downloader'

// Two photos in one batch that come out with the same name never replace each other, even with "overwrite" chosen.
const dir = (): string => mkdtempSync(join(tmpdir(), 'ff-batch-'))

test('overwrite still replaces a file from an earlier run', () => {
  const d = dir(); writeFileSync(join(d, 'Sunset.jpg'), 'old')
  assert.equal(resolveConflict(join(d, 'Sunset.jpg'), 'overwrite', new Set()), join(d, 'Sunset.jpg'))
})
test('overwrite does not replace a file saved earlier in the same batch: it gets _2, _3…', () => {
  const d = dir(), written = new Set<string>()
  const names: string[] = []
  for (let i = 0; i < 3; i++) {
    const p = resolveConflict(join(d, 'Sunset.jpg'), 'overwrite', written)!
    names.push(p.slice(d.length + 1)); written.add(p.toLowerCase())
  }
  assert.deepEqual(names, ['Sunset.jpg', 'Sunset_2.jpg', 'Sunset_3.jpg'])
})
test('names that differ only in capitals count as the same name (the Mac does not tell them apart)', () => {
  const d = dir(), written = new Set([join(d, 'sunset.jpg').toLowerCase()])
  assert.equal(resolveConflict(join(d, 'Sunset.jpg'), 'overwrite', written), join(d, 'Sunset_2.jpg'))
})
test('skip and rename behave as before', () => {
  const d = dir(), written = new Set([join(d, 'A.jpg').toLowerCase()])
  assert.equal(resolveConflict(join(d, 'A.jpg'), 'skip', written), null)
  assert.equal(resolveConflict(join(d, 'A.jpg'), 'rename', written), join(d, 'A_2.jpg'))
  assert.equal(resolveConflict(join(d, 'B.jpg'), 'skip', written), join(d, 'B.jpg'))
})
test('every batch passes the names it has saved so far to the download', () => {
  const src = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  const calls = src.match(/downloadToFolder\([^\n]*\)/g) ?? []
  assert.equal(calls.length, 5)
  for (const c of calls) assert.ok(/, written\)$/.test(c), c)
  assert.equal((src.match(/const written = new Set<string>\(\)/g) ?? []).length, 5)
})
