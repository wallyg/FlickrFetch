import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cellsFor, cellsFit, maxPhotos, cropSource, panCrop, zoomCrop, hitTest, MOSAIC_TEMPLATES, MAX_PHOTOS, MAX_ZOOM, MIN_SIDE, HEAD_H, type Layout, type Rect } from '../src/renderer/ui/collage'
import { withExtras, shufflePicks, canShuffle } from '../src/renderer/ui/shuffle'
import { dayLinkText, dayPageUrl, yearLinkUrl } from '../src/shared/dayLinks'
import type { DayPhoto } from '../src/shared/types'

// The collage maker's arrangements (#144), photo count (#294), swap and crop (#143, #270), per-year collage (#164) and links to each year (#267).

const LAYOUTS: Layout[] = ['grid', 'feature', 'banner', 'row', 'column', 'mosaic', 'filmstrip', 'ladder']
const BOXES: { name: string; cw: number; ch?: number }[] = [
  { name: 'auto', cw: 968 }, { name: 'square', cw: 968, ch: 1080 - 56 - 282 - 14 - 40 }, { name: 'portrait', cw: 968, ch: 1350 - 56 - 282 - 14 - 40 },
  { name: 'story', cw: 968, ch: 1920 - 56 - 282 - 14 - 40 }, { name: 'wide', cw: 1808, ch: 1080 - 56 - 282 - 14 - 40 }
]
const YEARS = ['2025', '2025', '2023', '2021', '2021', '2018', '2017', '2015']
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5

test('every arrangement, shape and count keeps every photo inside the box, with no photo on top of another', () => {
  for (const layout of LAYOUTS) for (const box of BOXES) for (let n = 1; n <= MAX_PHOTOS; n++) {
    const cells = cellsFor(layout, n, box.cw, box.ch, YEARS.slice(0, n))
    const where = `${layout} ${box.name} n=${n}`
    assert.equal(cells.rects.length, n, where)
    for (const r of cells.rects) {
      assert.ok(r && r.w > 0 && r.h > 0, where)
      assert.ok(r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= box.cw + 0.5 && r.y + r.h <= cells.h + 0.5, `${where}: ${JSON.stringify(r)} in ${box.cw} x ${cells.h}`)
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(!overlap(cells.rects[i], cells.rects[j]), `${where}: ${i} and ${j} overlap`)
    if (box.ch !== undefined) assert.equal(cells.h, box.ch, where)   // a fixed shape gives the photos exactly the room there is
  }
})

test('the Mosaic templates fill their grid exactly: four columns, no gaps in the tiling', () => {
  for (const [n, t] of Object.entries(MOSAIC_TEMPLATES)) {
    assert.equal(t.tiles.length, Number(n))
    const seen = new Set<string>()
    for (const [c, r, cs, rs] of t.tiles) for (let i = 0; i < cs; i++) for (let j = 0; j < rs; j++) { const key = `${c + i},${r + j}`; assert.ok(!seen.has(key), `n=${n} covers ${key} twice`); seen.add(key) }
    assert.equal(seen.size, 4 * t.rows, `n=${n} leaves holes`)
    assert.ok([...seen].every(k => Number(k.split(',')[0]) < 4 && Number(k.split(',')[1]) < t.rows))
  }
})

test('Year ladder: photos sit under their year heading, newest year first, and rects line up with the photos they belong to', () => {
  const years = ['2021', '2025', '2021', '2018']
  const cells = cellsFor('ladder', 4, 968, undefined, years)
  assert.deepEqual(cells.heads.map(h => h.text), ['2025', '2021', '2018'])
  assert.ok(cells.heads[1].y > cells.heads[0].y)
  // photo 1 is the 2025 one: it sits right under the first heading, above both 2021 photos
  assert.equal(cells.rects[1].y, cells.heads[0].y + HEAD_H)
  assert.ok(cells.rects[0].y > cells.rects[1].y && cells.rects[2].y === cells.rects[0].y)
  assert.ok(cells.rects[3].y > cells.rects[0].y)
  assert.equal(cells.rects[0].y, cells.heads[1].y + HEAD_H)
})

test('Year ladder with one year has nothing to climb: it falls back to a Mosaic with no headings', () => {
  const cells = cellsFor('ladder', 3, 968, undefined, ['2021', '2021', '2021'])
  assert.equal(cells.heads.length, 0)
  assert.deepEqual(cells.rects, cellsFor('mosaic', 3, 968).rects)
})

test('only the Year ladder has headings', () => {
  for (const layout of LAYOUTS.filter(l => l !== 'ladder')) assert.equal(cellsFor(layout, 4, 968, undefined, YEARS).heads.length, 0, layout)
})

test('how many photos fit: up to eight, six for Polaroid, never more than there are, never a photo smaller than the limit', () => {
  const always = (): boolean => true
  assert.equal(maxPhotos(26, false, always), 8)
  assert.equal(maxPhotos(26, true, always), 6)
  assert.equal(maxPhotos(3, false, always), 3)
  assert.equal(maxPhotos(0, false, always), 1)
  assert.equal(maxPhotos(26, false, n => n <= 5), 5)
  assert.equal(maxPhotos(26, false, () => false), 1)
  // a Row of eight would be thin slivers, so the Row stops sooner; a Grid and a Mosaic hold all eight
  const cw = 968
  const fits = (layout: Layout) => (n: number): boolean => cellsFit(cellsFor(layout, n, cw, undefined, YEARS.slice(0, n)), cw)
  assert.equal(maxPhotos(8, false, fits('grid')), 8)
  assert.equal(maxPhotos(8, false, fits('mosaic')), 8)
  assert.equal(maxPhotos(8, false, fits('feature')), 8)
  assert.equal(maxPhotos(8, false, fits('banner')), 8)
  const row = maxPhotos(8, false, fits('row'))
  assert.ok(row >= 6 && row < 8, `Row holds ${row}`)   // six, as before
  for (const n of [row]) for (const r of cellsFor('row', n, cw).rects) assert.ok(Math.min(r.w, r.h) >= cw * MIN_SIDE - 0.5)
})

test('crop: no crop shows the middle of the photo, as before', () => {
  const c = cropSource(4000, 3000, { w: 300, h: 300 })
  assert.equal(c.sh, 3000); assert.equal(c.sw, 3000); assert.equal(c.sx, 500); assert.equal(c.sy, 0)
})

test('crop: zooming shows a smaller part, around the middle, and never past the photo or beyond the largest zoom', () => {
  const slot = { w: 300, h: 300 }
  const z2 = zoomCrop(undefined, 2, 4000, 3000, slot)
  const s = cropSource(4000, 3000, slot, z2)
  assert.equal(s.sw, 1500); assert.equal(s.sh, 1500)
  assert.ok(Math.abs(s.sx + s.sw / 2 - 2000) < 1e-6 && Math.abs(s.sy + s.sh / 2 - 1500) < 1e-6)
  assert.equal(zoomCrop(undefined, 99, 4000, 3000, slot).zoom, MAX_ZOOM)
  assert.equal(zoomCrop(z2, 0.2, 4000, 3000, slot).zoom, 1)
  for (const cz of [1, 1.7, 4]) { const k = cropSource(4000, 3000, slot, { zoom: cz, cx: -3, cy: 9 }); assert.ok(k.sx >= 0 && k.sy >= 0 && k.sx + k.sw <= 4000 + 1e-6 && k.sy + k.sh <= 3000 + 1e-6) }
})

test('crop: dragging moves the photo with the finger and stops at its edge; a photo already filling the slot cannot move across its short side', () => {
  const slot = { w: 300, h: 300 }
  const start = zoomCrop(undefined, 2, 4000, 3000, slot)
  const before = cropSource(4000, 3000, slot, start)
  const moved = panCrop(start, 30, 0, 4000, 3000, slot)   // drag the photo right: we now see more of its left side
  const after = cropSource(4000, 3000, slot, moved)
  assert.ok(after.sx < before.sx)
  assert.ok(Math.abs((before.sx - after.sx) * before.scale - 30) < 1e-6)
  const far = cropSource(4000, 3000, slot, panCrop(start, 1e9, 1e9, 4000, 3000, slot))
  assert.equal(far.sx, 0); assert.equal(far.sy, 0)
  const flat = cropSource(4000, 3000, slot, panCrop(undefined, 0, 80, 4000, 3000, slot))   // at zoom 1 the photo fills the slot's height already
  assert.equal(flat.sy, 0)
})

test('hit test: the topmost photo under a point, or none', () => {
  const rects: Rect[] = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 50, w: 100, h: 100 }]
  assert.equal(hitTest(rects, 10, 10), 0); assert.equal(hitTest(rects, 75, 75), 1); assert.equal(hitTest(rects, 400, 10), -1)
})

const photo = (id: string, year: number): DayPhoto => ({ id, title: id, thumbUrl: '', dateTaken: `${year}-11-27 10:00:00`, privacy: 0, media: 'photo' })
const dice = (): number => 0.3

test('more photos than years: the busiest years give a second, after the one-per-year photos', () => {
  const pool = [photo('a1', 2025), photo('a2', 2025), photo('a3', 2025), photo('b1', 2023), photo('b2', 2023), photo('c1', 2021)]
  const firsts = [pool[0], pool[3], pool[5]]
  const list = withExtras(firsts, pool, 8)
  assert.deepEqual(list.map(p => p.id), ['a1', 'b1', 'c1', 'a2', 'b2', 'a3'])
  assert.deepEqual(withExtras(firsts, pool, 4).map(p => p.id), ['a1', 'b1', 'c1', 'a2'])
  assert.equal(new Set(list.map(p => p.id)).size, list.length)
  assert.deepEqual(withExtras(firsts, pool, 2).map(p => p.id), ['a1', 'b1'])
  assert.deepEqual(shufflePicks('years', pool, [], firsts, 3, dice).slice(0, 3).map(p => p.dateTaken.slice(0, 4)), ['2025', '2023', '2021'])
})

test('one year only: shuffle gives a different few of that year, each photo once', () => {
  const pool = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map(id => photo(id, 2021))
  let current = pool.slice(0, 4)
  for (let i = 0; i < 100; i++) {
    const next = shufflePicks('year', pool, [], current, 4)
    assert.notEqual(next.slice(0, 4).map(p => p.id).join(), current.map(p => p.id).join())
    assert.equal(new Set(next.map(p => p.id)).size, next.length)
    assert.ok(next.every(p => pool.some(q => q.id === p.id)))
    current = next
  }
  assert.equal(canShuffle('year', pool, [], 4), true)
  assert.equal(canShuffle('year', pool.slice(0, 4), [], 4), false)
})

test('the day links: one line per year with its count, each a link to that day on Flickr; a single photo links to the photo itself', () => {
  const years = [{ year: '2025', count: 7, videos: 0 }, { year: '2018', count: 1, videos: 0, photoId: '53456789012' }, { year: '2014', count: 3, videos: 1 }]
  const text = dayLinkText('12345@N01', years, 11, 27)
  assert.match(text, /^On this day, November 27, in my photos:\n\n2025 · 7 photos\nhttps:\/\/www\.flickr\.com\/photos\/12345@N01\/archives\/date-taken\/2025\/11\/27\/\n/)
  assert.match(text, /2018 · 1 photo\nhttps:\/\/www\.flickr\.com\/photos\/12345@N01\/53456789012\/\n/)
  assert.match(text, /2014 · 2 photos and 1 video\n/)
  assert.match(text, /Public photos open for anyone/)
  assert.ok(!/Public photos open for anyone/.test(dayLinkText('12345@N01', years, 11, 27, { everyone: true })))
  assert.equal(dayPageUrl('x', '2020', 3, 4), 'https://www.flickr.com/photos/x/archives/date-taken/2020/03/04/')
  assert.equal(yearLinkUrl('x', { year: '2020', count: 1, videos: 0 }, 3, 4), dayPageUrl('x', '2020', 3, 4))   // no photo to name: the day page
})

test('the day links for one year: a single line under a dated headline', () => {
  const years = [{ year: '2025', count: 7, videos: 0 }, { year: '2021', count: 6, videos: 0 }]
  const text = dayLinkText('x', years, 11, 27, { onlyYear: '2021', everyone: true })
  assert.equal(text, 'On this day, November 27, 2021, in my photos:\n\n6 photos\nhttps://www.flickr.com/photos/x/archives/date-taken/2021/11/27/')
  assert.equal(dayLinkText('', years, 11, 27), '')   // not signed in: nothing to link to
})

test('the collage window wires the new pieces in', () => {
  const code = readFileSync('src/renderer/components/ShareDialog.tsx', 'utf8')
  assert.match(code, /Include \{onlyYear/)                         // the share-links tick
  assert.match(code, /shareImage\(await dataUrl\(\), fileName\(\), box\.left, box\.bottom \+ 4, yearLinks\)/)   // the words travel with the picture
  assert.match(code, /draggable/); assert.match(code, /swapPlaces/); assert.match(code, /replaceWith/)   // swap and replace
  assert.match(code, /panCrop/); assert.match(code, /zoomCrop/)                                      // move and zoom
  assert.match(code, /maxPhotos\(picks\.length/)                                                      // the count rule
  assert.ok(!/slice\(0, 6\)/.test(code), 'no hard limit of six left')
  const panel = readFileSync('src/renderer/components/OnThisDayPanel.tsx', 'utf8')
  assert.match(panel, /Collage from these/); assert.match(panel, /onlyYear=\{share\.year\}/)
  const share = readFileSync('src/main/share.ts', 'utf8')
  assert.match(share, /texts: \[words\]/)
})
