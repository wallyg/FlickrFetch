import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeJustifiedRows } from '../src/renderer/components/PhotoGridShared'
import type { FlickrPhoto } from '../src/shared/types'

const photo = (id: string, w: number, h: number): FlickrPhoto => ({ id, title: id, thumbnailUrl: '', dateTaken: '', media: 'photo', width_m: w, height_m: h } as FlickrPhoto)
const rowWidth = (r: { widths: number[] }, gap = 4): number => r.widths.reduce((a, b) => a + b, 0) + gap * (r.widths.length - 1)

test('every row of the photo grid fits the window, even a last row that is one very wide photo', () => {
  const photos = [photo('a', 4, 3), photo('b', 3, 4), photo('c', 16, 9), photo('d', 4, 3), photo('e', 1, 1), photo('pano', 12, 1)]
  const rows = computeJustifiedRows(photos, 1000, 180)
  for (const r of rows) assert.ok(rowWidth(r) <= 1000.001, `a row is ${rowWidth(r)} wide`)
  assert.equal(rows.flatMap(r => r.photos).length, photos.length, 'no photo is lost')
  const last = rows[rows.length - 1]
  assert.deepEqual(last.photos.map(p => p.id), ['pano'])
  assert.ok(last.height < 180, 'the panorama is shrunk to fit')
})

test('an ordinary last row keeps the target height', () => {
  const rows = computeJustifiedRows([photo('a', 4, 3), photo('b', 4, 3), photo('c', 4, 3)], 2000, 180)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].height, 180)
})

test('Open in Flickr\'s organizer says so when it could not open', () => {
  const src = readFileSync(join(process.cwd(), 'src/renderer/components/BatchEditButton.tsx'), 'utf8')
  assert.ok(/\} catch \{\s*\n\s*setFailed\(true\)/.test(src) && /\{failed && <div role="alert"/.test(src))
})
