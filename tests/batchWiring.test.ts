import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Checks on how the main process hands things from the screen to the downloads (this code cannot run without Electron, so the source is read).
const src = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')

test('a photostream download keeps the sort order that was chosen (the file numbers follow it)', () => {
  assert.ok(/batch:startPhotostream[^\n]*sort\?: string/.test(src))
  assert.ok(/enqueueBatch\(\{ type: 'album', albumId: '__photostream__'[^}]*\bsort\b/.test(src), 'the sort is stored on the job')
  assert.ok(/runPhotostreamBatch\(job\.albumTitle, job\.track \?\? true, job\.smartMode, job\.privacyFilter, job\.sort,/.test(src), 'and given to the download')
})

test('downloading one photo from Discover can be cancelled and is named by the File naming settings', () => {
  const at = src.indexOf("ipcMain.handle('discover:downloadPhoto'")
  const body = src.slice(at, src.indexOf("ipcMain.handle('batch:startDiscoverUser'"))
  assert.ok(/new AbortController\(\)/.test(body))
  assert.ok(/downloadPhoto\([^\n]*controller\.signal/.test(body))
  assert.ok(/buildFilename\(/.test(body))
})

test('one download finishing never clears the cancel of another one started since', () => {
  assert.equal((src.match(/if \(activeDownloadController === controller\) activeDownloadController = null/g) ?? []).length, 2)
})

test('only a sign-in that Flickr has taken back signs the user out at launch', () => {
  const at = src.indexOf("ipcMain.handle('auth:getState'")
  const body = src.slice(at, src.indexOf("ipcMain.handle('photos:getPage'"))
  assert.ok(/instanceof SignInRevokedError/.test(body))
  assert.ok(/throw err/.test(body))
})
