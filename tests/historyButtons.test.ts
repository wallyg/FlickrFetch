import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// What each History button clears, and that the batch details are kept.
const read = (f: string): string => readFileSync(join(process.cwd(), f), 'utf8')

test('"Clear batch download history" clears only the batch list, not the record of downloaded photos', () => {
  assert.ok(/clearBatchHistory\(\)/.test(read('src/renderer/components/HistoryPanel.tsx')))
  assert.ok(/ipcMain\.handle\('db:clearBatchLog', \(\) => clearBatchLog\(\)\)/.test(read('src/main/index.ts')))
  assert.ok(!/db:clearHistory/.test(read('src/main/index.ts')), 'nothing wipes every record from a button any more')
})

test('every batch log entry carries the photos that failed', () => {
  const src = read('src/main/index.ts')
  const calls = src.split('\n').filter(l => l.includes('writeBatchLog({'))
  assert.ok(calls.length >= 12)
  for (const l of calls) assert.ok(/failedPhotos/.test(l), l.slice(0, 120))
})

test('the photostream download counts "size not available" apart from name clashes, as the others do', () => {
  const src = read('src/main/index.ts')
  const body = src.slice(src.indexOf('async function runPhotostreamBatch'), src.indexOf('// Discover IPC handlers'))
  assert.ok(/outcome\.reason === 'size-unavailable'/.test(body))
  assert.ok(/skippedSizeUnavailableCount\+\+/.test(body))
})
