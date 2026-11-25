import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { placeAt as placeAtForTest } from '../src/shared/mapGeo'
import { anchorAfterResize, limitCentre, minZoomFor, visibleTiles, tileZoomFor, wheelIntent, worldCopies, worldPixel, wrapLon, cacheLimitMb, MAP_CACHE_DEFAULT_MB, MAP_CACHE_MAX_MB, MAP_CACHE_MIN_MB } from '../src/shared/mapGeo'
import { FRESH_DAYS, cacheKeeper, cacheSize, getTile, trimCache, validTile } from '../src/main/mapTiles'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6])
const NEW = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9, 9, 9, 9, 9])
const folder = (): string => mkdtempSync(join(tmpdir(), 'ff-tiles-'))
const DAY = 86_400_000

test('tiles are picked at the nearest whole zoom and cover the whole window', () => {
  assert.equal(tileZoomFor(1.6), 2)
  assert.equal(tileZoomFor(1.4), 1)
  assert.equal(tileZoomFor(40), 19)
  const zoom = 5.3, c = worldPixel(48.85, 2.35, zoom)
  const corner = { x: c.x - 400, y: c.y - 250 }
  const spots = visibleTiles(corner, 800, 500, zoom)
  assert.ok(spots.length > 0)
  assert.ok(spots.every(t => t.z === 5 && t.px < 800 && t.py < 500 && t.px + t.size > 0 && t.py + t.size > 0))
  // together they reach every edge of the window
  assert.ok(Math.min(...spots.map(t => t.px)) <= 0 && Math.max(...spots.map(t => t.px + t.size)) >= 800)
  assert.ok(Math.min(...spots.map(t => t.py)) <= 0 && Math.max(...spots.map(t => t.py + t.size)) >= 500)
  // and none is asked for twice
  assert.equal(new Set(spots.map(t => `${t.x}/${t.y}`)).size, spots.length)
})
test('the world repeats sideways: tiles past the edge come from the other side, none past the top or bottom', () => {
  const spots = visibleTiles({ x: -300, y: -300 }, 1200, 1200, 1)   // the window is bigger than the world on every side
  assert.ok(spots.every(t => t.x >= 0 && t.x < 2 && t.y >= 0 && t.y < 2))
  assert.equal(spots.length, 12)                                     // 6 columns across (the 2 tile columns repeat) by 2 rows
  const row = spots.filter(t => t.y === 0).sort((a, b) => a.px - b.px)
  assert.ok(row.every((t, i) => i === 0 || Math.abs(t.px - row[i - 1].px - t.size) < 1e-6))   // side by side with no gap
  assert.deepEqual(row.map(t => t.x), [0, 1, 0, 1, 0, 1])
})
test('a window centred on the date line shows tiles from both sides of it, next to each other', () => {
  const zoom = 3, c = worldPixel(0, 180, zoom)
  const spots = visibleTiles({ x: c.x - 300, y: c.y - 200 }, 600, 400, zoom)
  const columns = new Set(spots.map(t => t.x))
  assert.ok(columns.has(7) && columns.has(0))                        // the last column of the world and the first
  const seam = spots.filter(t => t.x === 7)[0], after = spots.filter(t => t.x === 0 && t.y === seam.y).sort((a, b) => b.px - a.px)[0]
  assert.ok(Math.abs(after.px - (seam.px + seam.size)) < 1e-6)       // the first column sits right after the last one
})
test('longitude is brought back into the world, and 180 and -180 are the same line', () => {
  assert.equal(wrapLon(0), 0)
  assert.equal(wrapLon(190), -170)
  assert.equal(wrapLon(-190), 170)
  assert.equal(wrapLon(540), -180)
  assert.equal(wrapLon(-180), -180)
  assert.equal(wrapLon(179.5), 179.5)
})
test('copies of the world: only the ones that show in the window', () => {
  assert.deepEqual(worldCopies(0, 512, 512), [0])               // exactly one world
  assert.deepEqual(worldCopies(-100, 600, 512), [-1, 0])        // spills off the left edge
  assert.deepEqual(worldCopies(400, 600, 512), [0, 1])          // spills off the right edge
  assert.deepEqual(worldCopies(-1000, 3000, 512), [-2, -1, 0, 1, 2, 3])
  assert.deepEqual(worldCopies(100, 200, 512), [0])             // a small window inside one world
})
test('the view cannot go past the top or bottom of the world, so there is never blank map above the pole', () => {
  const H = 600, zoom = 3                                          // the world is 2048 px tall at zoom 3
  const north = limitCentre({ lat: 85, lon: 10 }, zoom, H), south = limitCentre({ lat: -85, lon: 10 }, zoom, H)
  assert.ok(Math.abs(worldPixel(north.lat, north.lon, zoom).y - H / 2) < 1e-6)            // the top of the window is the top of the world
  assert.ok(Math.abs(worldPixel(south.lat, south.lon, zoom).y - (2048 - H / 2)) < 1e-6)   // and the bottom is the bottom
  const inside = limitCentre({ lat: 40, lon: 10 }, zoom, H)
  assert.ok(Math.abs(inside.lat - 40) < 1e-9 && inside.lon === 10)                         // anywhere in between is left alone
})
test('a world shorter than the window sits in the middle, and longitude comes back into the world', () => {
  const small = limitCentre({ lat: 60, lon: 190 }, 1, 800)           // 512 px tall in an 800 px window
  assert.ok(Math.abs(small.lat) < 1e-9)
  assert.equal(small.lon, -170)
})
test('the lowest zoom is the one where the world just fills the window height', () => {
  assert.ok(Math.abs(minZoomFor(650) - Math.log2(650 / 256)) < 1e-9)
  assert.equal(minZoomFor(200), 1)                                  // never below the map's own lowest zoom
  assert.equal(minZoomFor(512), 1)
  assert.equal(minZoomFor(1024), 2)
  assert.equal(minZoomFor(100, 0), Math.max(0, Math.log2(100 / 256)))
})
test('two-finger scroll moves the map; pinch and Cmd + scroll zoom; a notched mouse wheel zooms', () => {
  const base = { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, altKey: false }
  assert.deepEqual(wheelIntent({ ...base, deltaX: 5, deltaY: -30 }), { kind: 'pan', dx: 5, dy: -30 })
  assert.deepEqual(wheelIntent({ ...base, deltaY: 400 }), { kind: 'pan', dx: 0, dy: 400 })      // even a hard flick is a move, not a zoom
  const pinchOut = wheelIntent({ ...base, ctrlKey: true, deltaY: -5 }), pinchIn = wheelIntent({ ...base, ctrlKey: true, deltaY: 5 })
  assert.ok(pinchOut.kind === 'zoom' && pinchOut.amount > 0 && pinchIn.kind === 'zoom' && pinchIn.amount < 0)
  const cmd = wheelIntent({ ...base, metaKey: true, deltaY: -40 })
  assert.ok(cmd.kind === 'zoom' && cmd.amount > 0)
  const wheel = wheelIntent({ ...base, deltaMode: 1, deltaY: 3 })
  assert.ok(wheel.kind === 'zoom' && wheel.amount < 0 && Math.abs(wheel.amount + 0.2475) < 1e-9)
})
// Resizing: the map box changes size when the photo tray opens or closes or the window is resized
const cornerOf = (c: { lat: number; lon: number }, zoom: number, w: number, h: number): { x: number; y: number } => {
  const p = worldPixel(c.lat, c.lon, zoom)
  return { x: p.x - w / 2, y: p.y - h / 2 }
}
test('when the box narrows or widens, the top left stays put so the picture does not slide', () => {
  const zoom = 4, start = { lat: 40, lon: 10 }
  const before = cornerOf(start, zoom, 900, 600)
  const narrower = anchorAfterResize({ centre: start, zoom, prev: { w: 900, h: 600 }, next: { w: 588, h: 600 } })   // the photo tray (312 px) opens
  const after = cornerOf(narrower, zoom, 588, 600)
  assert.ok(Math.abs(after.x - before.x) < 1e-6 && Math.abs(after.y - before.y) < 1e-6)
  const wider = anchorAfterResize({ centre: narrower, zoom, prev: { w: 588, h: 600 }, next: { w: 900, h: 600 } })   // and closes again
  const back = cornerOf(wider, zoom, 900, 600)
  assert.ok(Math.abs(back.x - before.x) < 1e-6)
  assert.ok(Math.abs(wider.lat - start.lat) < 1e-6 && Math.abs(wider.lon - start.lon) < 1e-6)      // the same view as before the tray opened
})
test('a picked circle that was in view stays in view when the box narrows', () => {
  const zoom = 4, start = { lat: 40, lon: 10 }, W = 900, H = 600
  const corner = cornerOf(start, zoom, W, H)
  const place = (sx: number, sy: number): { lat: number; lon: number } => { const l = { x: corner.x + sx, y: corner.y + sy }; return placeAtForTest(l.x, l.y, zoom) }
  const focus = place(800, 300)                                                                      // near the right edge: the tray would cover it
  const centre = anchorAfterResize({ centre: start, zoom, prev: { w: W, h: H }, next: { w: 588, h: H }, focus })
  const c = cornerOf(centre, zoom, 588, H), f = worldPixel(focus.lat, focus.lon, zoom)
  const sx = f.x - c.x
  assert.ok(sx >= 40 - 1e-6 && sx <= 588 - 40 + 1e-6, 'x on screen: ' + sx)
  const left = place(60, 300)                                                                        // already clear of the tray: nothing moves
  const same = anchorAfterResize({ centre: start, zoom, prev: { w: W, h: H }, next: { w: 588, h: H }, focus: left })
  const c2 = cornerOf(same, zoom, 588, H)
  assert.ok(Math.abs(c2.x - corner.x) < 1e-6)
})
test('a picked circle near the left edge is kept clear of it too', () => {
  const zoom = 4, start = { lat: 40, lon: 10 }, W = 900, H = 600
  const corner = cornerOf(start, zoom, W, H)
  const focus = placeAtForTest(corner.x + 8, corner.y + 300, zoom)                                    // 8 px from the left edge
  const centre = anchorAfterResize({ centre: start, zoom, prev: { w: W, h: H }, next: { w: 588, h: H }, focus })
  const c = cornerOf(centre, zoom, 588, H), f = worldPixel(focus.lat, focus.lon, zoom)
  assert.ok(f.x - c.x >= 40 - 1e-6, 'x on screen: ' + (f.x - c.x))
})
test('when the window gets shorter, a picked circle near the bottom or top is kept in view', () => {
  const zoom = 4, start = { lat: 40, lon: 10 }, W = 900, H = 800
  const corner = cornerOf(start, zoom, W, H)
  for (const [sy, label] of [[700, 'bottom'], [12, 'top']] as [number, string][]) {
    const focus = placeAtForTest(corner.x + 450, corner.y + sy, zoom)
    const centre = anchorAfterResize({ centre: start, zoom, prev: { w: W, h: H }, next: { w: W, h: 500 }, focus })
    const c = cornerOf(centre, zoom, W, 500), f = worldPixel(focus.lat, focus.lon, zoom)
    assert.ok(f.y - c.y >= 40 - 1e-6 && f.y - c.y <= 500 - 40 + 1e-6, label + ' y on screen: ' + (f.y - c.y))
  }
})
test('a picked circle that was already out of view does not pull the view back', () => {
  const zoom = 4, start = { lat: 40, lon: 10 }, W = 900, H = 600
  const corner = cornerOf(start, zoom, W, H)
  const far = placeAtForTest(corner.x + 3000, corner.y + 300, zoom)                                   // well off to the right
  const centre = anchorAfterResize({ centre: start, zoom, prev: { w: W, h: H }, next: { w: 588, h: H }, focus: far })
  const c = cornerOf(centre, zoom, 588, H)
  assert.ok(Math.abs(c.x - corner.x) < 1e-6)
})
test('the focus is found on the copy of the world nearest the view, across the date line', () => {
  const zoom = 4, W = 900, H = 600
  const start = { lat: 10, lon: 178 }                                                                // the view straddles the date line
  const focus = { lat: 10, lon: -160 }                                                               // across it, on screen well to the right (where the tray would cover it)
  const corner = cornerOf(start, zoom, W, H), world = 256 * 2 ** zoom
  const f = worldPixel(focus.lat, focus.lon, zoom)
  const fx = f.x + Math.round((worldPixel(start.lat, start.lon, zoom).x - f.x) / world) * world
  assert.ok(fx - corner.x > 0 && fx - corner.x < W)                                                  // it really is in view
  const centre = anchorAfterResize({ centre: start, zoom, prev: { w: W, h: H }, next: { w: 588, h: H }, focus })
  const c = cornerOf({ lat: centre.lat, lon: start.lon + (wrapLon(centre.lon - start.lon)) }, zoom, 588, H)
  const sx = fx - c.x
  assert.ok(sx >= 40 - 1e-6 && sx <= 588 - 40 + 1e-6, 'x on screen: ' + sx)
})
test('after a resize the view still stays inside the world top to bottom', () => {
  const centre = anchorAfterResize({ centre: { lat: 84, lon: 0 }, zoom: 3, prev: { w: 900, h: 400 }, next: { w: 900, h: 800 } })   // a view that was already at the very top
  const y = worldPixel(centre.lat, centre.lon, 3).y
  assert.ok(y >= 400 - 1e-6 && y <= 2048 - 400 + 1e-6)
})
test('only real tile numbers are accepted', () => {
  assert.ok(validTile(0, 0, 0) && validTile(3, 7, 7) && validTile(19, 524287, 0))
  assert.ok(!validTile(3, 8, 0) && !validTile(-1, 0, 0) && !validTile(20, 0, 0) && !validTile(2, 0.5, 0) && !validTile(2, '1', 0) && !validTile(2, 0, -1))
})

test('a tile is downloaded once, saved, and then read from the saved copy', async () => {
  const dir = folder(); let calls = 0; const urls: string[] = []
  const deps = { dir, now: Date.now, fetchTile: async (u: string) => { calls++; urls.push(u); return PNG } }
  assert.deepEqual(await getTile(4, 3, 5, deps), PNG)
  assert.deepEqual(await getTile(4, 3, 5, deps), PNG)
  assert.equal(calls, 1)
  assert.equal(urls[0], 'https://tile.openstreetmap.org/4/3/5.png')
  assert.deepEqual(new Uint8Array(readFileSync(join(dir, '4', '3', '5.png'))), PNG)
})
test('asking for the same tile twice at once downloads it once', async () => {
  const dir = folder(); let calls = 0
  const deps = { dir, now: Date.now, fetchTile: async () => { calls++; await new Promise(r => setTimeout(r, 20)); return PNG } }
  const [a, b] = await Promise.all([getTile(6, 1, 1, deps), getTile(6, 1, 1, deps)])
  assert.deepEqual(a, b)
  assert.equal(calls, 1)
})
test('a bad tile number never reaches the network', async () => {
  let calls = 0
  const out = await getTile(2, 9, 9, { dir: folder(), now: Date.now, fetchTile: async () => { calls++; return PNG } })
  assert.equal(out, null)
  assert.equal(calls, 0)
})
test('a failed download gives nothing, saves nothing, and is not retried for a minute', async () => {
  const dir = folder(); let calls = 0; let now = Date.now()
  const deps = { dir, now: () => now, fetchTile: async () => { calls++; return null } }
  assert.equal(await getTile(5, 2, 2, deps), null)
  assert.equal(existsSync(join(dir, '5', '2', '2.png')), false)
  assert.equal(await getTile(5, 2, 2, deps), null)
  assert.equal(calls, 1)
  now += 61_000
  await getTile(5, 2, 2, deps)
  assert.equal(calls, 2)
})
test('a saved copy older than a week is downloaded again, and stands in if that fails', async () => {
  const dir = folder()
  mkdirSync(join(dir, '7', '4'), { recursive: true })
  const file = join(dir, '7', '4', '9.png')
  writeFileSync(file, PNG)
  const old = new Date(Date.now() - (FRESH_DAYS + 1) * DAY)
  utimesSync(file, old, old)
  let fresh = true
  const deps = { dir, now: Date.now, fetchTile: async () => (fresh ? NEW : null) }
  assert.deepEqual(await getTile(7, 4, 9, deps), NEW)
  assert.deepEqual(new Uint8Array(readFileSync(file)), NEW)
  utimesSync(file, old, old)
  fresh = false
  assert.deepEqual(await getTile(7, 4, 9, { ...deps, dir }), NEW)   // offline: the week-old copy is better than a blank square
})

// Saved-picture limit
const fill = (dir: string, names: string[], bytes: number, ageDays: (i: number) => number): void => {
  names.forEach((n, i) => {
    const file = join(dir, '3', '1', `${n}.png`)
    mkdirSync(join(dir, '3', '1'), { recursive: true })
    writeFileSync(file, new Uint8Array(bytes))
    const when = new Date(Date.now() - ageDays(i) * DAY)
    utimesSync(file, when, when)
  })
}
test('the size limit is a whole number kept between the smallest and largest allowed, and the default when there is none', () => {
  assert.equal(cacheLimitMb(undefined), MAP_CACHE_DEFAULT_MB)
  assert.equal(cacheLimitMb('500'), MAP_CACHE_DEFAULT_MB)
  assert.equal(cacheLimitMb(NaN), MAP_CACHE_DEFAULT_MB)
  assert.equal(cacheLimitMb(1), MAP_CACHE_MIN_MB)
  assert.equal(cacheLimitMb(999999), MAP_CACHE_MAX_MB)
  assert.equal(cacheLimitMb(750.4), 750)
  assert.equal(cacheLimitMb(MAP_CACHE_MIN_MB), MAP_CACHE_MIN_MB)
  assert.equal(cacheLimitMb(MAP_CACHE_MAX_MB), MAP_CACHE_MAX_MB)
})
test('the size shown counts every saved picture, and an empty or missing folder is zero', () => {
  assert.deepEqual(cacheSize(join(folder(), 'nope')), { bytes: 0, files: 0 })
  const dir = folder()
  fill(dir, ['a', 'b', 'c'], 1000, () => 1)
  assert.deepEqual(cacheSize(dir), { bytes: 3000, files: 3 })
})
test('trimming removes the oldest pictures first and stops with room to spare', () => {
  const dir = folder()
  fill(dir, ['new', 'mid', 'old', 'older'], 1000, i => [1, 5, 9, 20][i])
  assert.equal(trimCache(dir, 4000), 0)                         // at the limit: nothing goes
  assert.equal(trimCache(dir, 3500), 2)                         // over it: down to 80% of 3500 = 2800, so two of the oldest go
  assert.ok(existsSync(join(dir, '3', '1', 'new.png')) && existsSync(join(dir, '3', '1', 'mid.png')))
  assert.ok(!existsSync(join(dir, '3', '1', 'old.png')) && !existsSync(join(dir, '3', '1', 'older.png')))
})
test('the folder is measured once, then only added to, and trimmed as soon as it passes the limit', () => {
  const dir = folder()
  fill(dir, ['a', 'b'], 1000, i => 5 - i)
  const keeper = cacheKeeper(dir)
  keeper.saved(0, 5000)                                         // first look: 2000 of 5000
  assert.equal(cacheSize(dir).files, 2)
  fill(dir, ['c', 'd', 'e'], 1000, () => 0)                     // 3 more arrive: 5000, not over yet
  keeper.saved(3000, 5000)
  assert.equal(cacheSize(dir).files, 5)
  fill(dir, ['f'], 1000, () => 0)                               // one more: 6000, over 5000, so it trims to 4000
  keeper.saved(1000, 5000)
  assert.ok(cacheSize(dir).bytes <= 4000 && cacheSize(dir).files >= 3)
  assert.ok(!existsSync(join(dir, '3', '1', 'a.png')))          // the oldest went
})
test('lowering the limit trims on the next look even if nothing new was saved', () => {
  const dir = folder()
  fill(dir, ['a', 'b', 'c', 'd'], 1000, i => 10 - i)
  const keeper = cacheKeeper(dir)
  keeper.saved(0, 2000)
  assert.ok(cacheSize(dir).bytes <= 1600)
})
test('saving a picture reports its size so the folder can be kept within its limit', async () => {
  const dir = folder(); const told: number[] = []
  await getTile(8, 1, 1, { dir, now: Date.now, fetchTile: async () => PNG, onSaved: n => told.push(n) })
  await getTile(8, 1, 1, { dir, now: Date.now, fetchTile: async () => PNG, onSaved: n => told.push(n) })   // from the saved copy: nothing new
  assert.deepEqual(told, [PNG.length])
})
