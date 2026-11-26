import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (f: string): string => readFileSync(join(process.cwd(), 'src/renderer', f), 'utf8')

// A screen that cannot read what it asked for must say so and offer Try again, instead of staying on "Loading…" for good (#290).
const LISTS: [string, string][] = [
  ['components/AuditPanel.tsx', 'listAuditFindings'],
  ['components/HealthPanel.tsx', 'listHealthPhotos'],
  ['components/AlbumsPanel.tsx', 'listAlbumItems'],
  ['components/CameraRoll.tsx', 'getCameraRoll'],
  ['components/OnThisDayPanel.tsx', 'getDayView'],
  ['components/TimelinePanel.tsx', 'getTimelineMonths']
]

test('every list that reads the local library catches a failed read, stops "Loading…" and offers Try again', () => {
  for (const [file, call] of LISTS) {
    const src = read(file)
    const at = src.indexOf(`window.flickrAPI.${call}(`)
    assert.ok(at > 0, `${file} calls ${call}`)
    const around = src.slice(Math.max(0, at - 250), at + 900)
    assert.ok(/try \{/.test(around) && /\} catch \{/.test(around), `${file}: the read is in a try/catch`)
    assert.ok(/setFailed\(true\)/.test(src), `${file}: a failure is remembered`)
    assert.ok(/<LoadFailed /.test(src) && /onRetry=/.test(src), `${file}: and shown with Try again`)
  }
})

test('the Timeline also catches a failed read of one month\'s days', () => {
  const src = read('components/TimelinePanel.tsx')
  assert.ok(/getTimelineDays\(drill\.year[^\n]*\.catch\(\(\) => \{ if \(!cancelled\) setDaysFailed\(true\) \}\)/.test(src))
  assert.ok(/daysTry/.test(src) && /setDaysTry\(n => n \+ 1\)/.test(src), 'and Try again reads them again')
})

test('Reset download records keeps its box open and says why when it could not read the album', () => {
  const src = read('pages/MainPage.tsx')
  const fn = src.slice(src.indexOf('const handleResetRecords'), src.indexOf('const handleBatchDismiss'))
  assert.ok(/try \{/.test(fn) && /catch \{/.test(fn) && /setResetError\('/.test(fn))
  assert.ok(fn.indexOf('setShowResetConfirm(false)') > fn.indexOf('deletePhotoRecords'), 'the box closes only after the records are gone')
  assert.ok(/\{resetError && <p role="alert"/.test(src))
})
