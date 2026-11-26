import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { selectedPlace } from '../src/main/batchFolder'

// Where a download of chosen photos is saved: the folder is named by the caller, never read out of the label on the download bar.
const DL = '/Users/me/Pictures/FlickrFetch'
test('a download of the photos shown by a filter goes to the album folder, not to "Album (37 shown)"', () => {
  const p = selectedPlace({ downloadFolder: DL, albumTitle: 'Album (37 shown)', folderName: 'Album' })
  assert.equal(p.folder, join(DL, 'Album'))
})
test('the Photostream goes into the download folder itself, however it is labelled', () => {
  assert.equal(selectedPlace({ downloadFolder: DL, albumTitle: 'Photostream (12 shown)', folderName: '' }).folder, DL)
  assert.equal(selectedPlace({ downloadFolder: DL, albumTitle: 'Photostream (5 selected)' }).folder, DL)   // as before, with no name given
})
test('a day (On This Day, Timeline) is saved in a folder named for the day, without the count', () => {
  assert.equal(selectedPlace({ downloadFolder: DL, albumTitle: 'On This Day, November 26 (3)', folderName: 'On This Day, November 26' }).folder, join(DL, 'On This Day, November 26'))
})
test('Try again goes to the exact folder the first try used, whatever the label says', () => {
  const first = join(DL, 'Trips', 'Italy')
  assert.equal(selectedPlace({ downloadFolder: DL, albumTitle: 'Try again: Italy', targetFolder: first }).folder, first)
  assert.equal(selectedPlace({ downloadFolder: DL, albumTitle: 'Try again: Photostream', targetFolder: DL }).folder, DL)
})
test('a folder name cannot hold a path', () => {
  assert.equal(selectedPlace({ downloadFolder: DL, albumTitle: 'x', folderName: '../Secrets/a:b' }).folder, join(DL, '__Secrets_a_b'))
})
test('nothing is named from the label any more: every caller names its folder, and Try again uses the saved folder', () => {
  const page = readFileSync(join(process.cwd(), 'src/renderer/pages/MainPage.tsx'), 'utf8')
  const calls = page.split('\n').filter(l => l.includes('startSelectedBatch('))
  assert.equal(calls.length, 4)
  for (const l of calls) assert.ok(/exportFormat === 'zip', /.test(l), l.trim())
  const bar = readFileSync(join(process.cwd(), 'src/renderer/components/DownloadQueueBar.tsx'), 'utf8')
  assert.ok(/retrySelectedBatch\(photos, title, b\.saveFolder\)/.test(bar))
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  for (const fn of ['runAlbumBatch', 'runSelectedBatch', 'runPhotostreamBatch']) {
    const body = main.slice(main.indexOf(`async function ${fn}`))
    assert.ok(/saveFolder: tempDir \? undefined :/.test(body.slice(0, 2500)), `${fn} reports where it saved`)
  }
})
