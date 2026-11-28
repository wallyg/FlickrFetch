// Where the photos go in the collage (#144, #294) and how a photo is cropped inside its slot (#270). Plain functions, so a test can try every
// arrangement, shape and count. All sizes are in the picture's own pixels (1080 wide at standard size).

export type Layout = 'grid' | 'feature' | 'banner' | 'row' | 'column' | 'mosaic' | 'ladder'
export type Rect = { x: number; y: number; w: number; h: number }
export type Head = { text: string; x: number; y: number }   // a year heading in the Year ladder (y is the top of the heading)
export interface Cells { rects: Rect[]; h: number; heads: Head[] }

export const GAP = 14
export const HEAD_H = 44              // room for a year heading in the Year ladder
export const MAX_PHOTOS = 8           // the most photos any collage holds
export const POLAROID_MAX = 6         // Polaroid cards keep six: each has a caption that stops being readable when smaller
export const MIN_SIDE = 0.15          // a photo is never smaller than this share of the picture's width, on its shorter side

// ── arrangements ─────────────────────────────────────────────────────────────

// `k` photos in rows of `cols`; a short last row stretches to fill the width
function restGrid(k: number, x0: number, y0: number, w: number, h: number, cols: number): Rect[] {
  const g = GAP, rows = Math.ceil(k / cols), ch = (h - g * (rows - 1)) / rows
  return Array.from({ length: k }, (_, i) => {
    const row = Math.floor(i / cols), inRow = row === rows - 1 ? k - cols * (rows - 1) : cols
    const cw = (w - g * (inRow - 1)) / inRow
    return { x: x0 + (i - row * cols) * (cw + g), y: y0 + row * (ch + g), w: cw, h: ch }
  })
}
const restCols = (k: number): number => (k <= 5 ? k : Math.ceil(k / 2))   // up to five side by side, then two rows

// A big photo on the left with the rest stacked or gridded on the right, filling a box cw wide and H tall
function bigLeft(n: number, cw: number, H: number): Rect[] {
  const g = GAP
  if (n === 2) { const w = (cw - g) / 2; return [{ x: 0, y: 0, w, h: H }, { x: w + g, y: 0, w, h: H }] }
  if (n === 6) {
    const w = (cw - 2 * g) / 3, h = (H - g) / 2
    return Array.from({ length: 6 }, (_, i) => ({ x: (i % 3) * (w + g), y: Math.floor(i / 3) * (h + g), w, h }))
  }
  const bigW = n === 5 || n >= 7 ? cw * 0.5 : cw * 0.64
  const rects: Rect[] = [{ x: 0, y: 0, w: bigW, h: H }]
  const restX = bigW + g, restW = cw - restX, k = n - 1
  if (n === 5) {
    const w = (restW - g) / 2, h = (H - g) / 2
    for (let i = 0; i < 4; i++) rects.push({ x: restX + (i % 2) * (w + g), y: Math.floor(i / 2) * (h + g), w, h })
  } else if (n >= 7) {
    rects.push(...restGrid(k, restX, 0, restW, H, 2))
  } else {
    const h = (H - g * (k - 1)) / k
    for (let i = 0; i < k; i++) rects.push({ x: restX, y: i * (h + g), w: restW, h })
  }
  return rects
}

// A big photo across the top with the rest in a row (or two) underneath, filling a box cw wide and H tall
function bigTop(n: number, cw: number, H: number, share: number): Rect[] {
  const g = GAP
  if (n === 2) { const h = (H - g) / 2; return [{ x: 0, y: 0, w: cw, h }, { x: 0, y: h + g, w: cw, h }] }
  const topH = H * share, k = n - 1
  return [{ x: 0, y: 0, w: cw, h: topH }, ...restGrid(k, 0, topH + g, cw, H - topH - g, restCols(k))]
}

const stackOf = (n: number, cw: number, H: number): Rect[] => { const h = (H - GAP * (n - 1)) / n; return Array.from({ length: n }, (_, i) => ({ x: 0, y: i * (h + GAP), w: cw, h })) }
const rowOf = (n: number, cw: number, H: number): Rect[] => { const w = (cw - GAP * (n - 1)) / n; return Array.from({ length: n }, (_, i) => ({ x: i * (w + GAP), y: 0, w, h: H })) }

// Rows and columns of roughly 4:3 cells that fill a box; a short last row sits in the middle (or stretches to fill, in a fixed shape)
export function gridOf(n: number, cw: number, H: number, stretch = false): Rect[] {
  const g = GAP
  let best = { cols: 1, score: -Infinity }
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c), w = (cw - g * (c - 1)) / c, h = (H - g * (r - 1)) / r
    if (w <= 0 || h <= 0) continue
    // closest to 4:3 cells, and a mild preference for rows that fill completely (no lone photo on the last row)
    const score = -Math.abs(Math.log(w / h / 1.3)) - (n % c === 0 ? 0 : 0.8)
    if (score > best.score) best = { cols: c, score }
  }
  const cols = best.cols, rows = Math.ceil(n / cols), w = (cw - g * (cols - 1)) / cols, h = (H - g * (rows - 1)) / rows
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols), inRow = row === rows - 1 ? n - cols * (rows - 1) : cols
    if (stretch && inRow < cols) {   // in a fixed shape a short last row stretches to fill the width
      const sw = (cw - g * (inRow - 1)) / inRow
      return { x: (i % cols) * (sw + g), y: row * (h + g), w: sw, h }
    }
    const offset = (cw - (inRow * w + g * (inRow - 1))) / 2
    return { x: offset + (i % cols) * (w + g), y: row * (h + g), w, h }
  })
}

// Mosaic: tiles of different sizes on a grid four across. [column, row, columns wide, rows tall]; every template fills its grid exactly.
// The big tile moves around (never always on the left, which would be Feature) and tall and wide tiles mix.
type Tile = [number, number, number, number]
const MOSAIC: Record<number, { rows: number; tiles: Tile[] }> = {
  2: { rows: 2, tiles: [[0, 0, 1, 2], [1, 0, 3, 2]] },
  3: { rows: 2, tiles: [[0, 0, 1, 2], [1, 0, 2, 2], [3, 0, 1, 2]] },
  4: { rows: 2, tiles: [[0, 0, 2, 1], [0, 1, 2, 1], [2, 0, 1, 2], [3, 0, 1, 2]] },
  5: { rows: 2, tiles: [[0, 0, 1, 2], [1, 0, 2, 1], [1, 1, 1, 1], [2, 1, 1, 1], [3, 0, 1, 2]] },
  6: { rows: 3, tiles: [[0, 0, 1, 3], [1, 0, 2, 2], [3, 0, 1, 1], [3, 1, 1, 1], [1, 2, 2, 1], [3, 2, 1, 1]] },
  7: { rows: 3, tiles: [[0, 0, 1, 3], [1, 0, 2, 2], [3, 0, 1, 1], [3, 1, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1], [3, 2, 1, 1]] },
  8: { rows: 3, tiles: [[0, 0, 1, 2], [1, 0, 1, 1], [2, 0, 1, 1], [3, 0, 1, 2], [1, 1, 1, 2], [2, 1, 1, 2], [0, 2, 1, 1], [3, 2, 1, 1]] }
}
export const MOSAIC_TEMPLATES = MOSAIC
function mosaicCells(n: number, cw: number, ch?: number): { rects: Rect[]; h: number } {
  const t = MOSAIC[Math.min(MAX_PHOTOS, Math.max(2, n))]
  const g = GAP, cellW = (cw - 3 * g) / 4
  const cellH = ch === undefined ? cellW * 0.8 : (ch - (t.rows - 1) * g) / t.rows
  const H = ch === undefined ? t.rows * cellH + (t.rows - 1) * g : ch
  return { h: H, rects: t.tiles.slice(0, n).map(([c, r, cs, rs]) => ({ x: c * (cellW + g), y: r * (cellH + g), w: cs * cellW + (cs - 1) * g, h: rs * cellH + (rs - 1) * g })) }
}

// Year ladder: the photos grouped by year, a year heading over each band, oldest year first. Rects line up with `years` (one per photo).
function ladderCells(years: string[], cw: number, ch?: number): Cells {
  const g = GAP, perRow = 4
  const order = [...new Set(years)].sort()   // oldest year first, like every other arrangement
  const rows: { year: string; idx: number[]; first: boolean }[] = []
  for (const y of order) {
    const idx = years.map((v, i) => (v === y ? i : -1)).filter(i => i >= 0)
    for (let s = 0; s < idx.length; s += perRow) rows.push({ year: y, idx: idx.slice(s, s + perRow), first: s === 0 })
  }
  const heads = order.length
  const rowH = ch === undefined ? cw * 0.26 : (ch - heads * HEAD_H - (rows.length - 1) * g) / rows.length
  const H = ch === undefined ? rows.length * rowH + (rows.length - 1) * g + heads * HEAD_H : ch
  const rects: Rect[] = new Array(years.length)
  const out: Head[] = []
  let y = 0
  for (const r of rows) {
    if (r.first) { out.push({ text: r.year, x: 0, y }); y += HEAD_H }
    const m = r.idx.length, w = (cw - g * (m - 1)) / m
    r.idx.forEach((photo, i) => { rects[photo] = { x: i * (w + g), y, w, h: rowH } })
    y += rowH + g
  }
  return { rects, h: H, heads: out }
}

/**
 * Where each photo goes inside the content box (cw wide). In a fixed shape (ch given) the photos fill the whole box and the arrangement adapts to it
 * (a Row turns into a stack in a tall shape, a Column into a row in a wide one). With Auto (no ch) each layout keeps its own natural height.
 * `years` (one per photo) is only used by the Year ladder.
 */
export function cellsFor(layout: Layout, n: number, cw: number, ch?: number, years: string[] = []): Cells {
  const g = GAP
  const done = (rects: Rect[], h: number): Cells => ({ rects, h, heads: [] })
  if (layout === 'ladder' && new Set(years.slice(0, n)).size >= 2) return ladderCells(years.slice(0, n), cw, ch)
  if (layout === 'ladder') layout = 'mosaic'   // one year has nothing to climb
  if (ch !== undefined) {
    const aspect = cw / ch
    if (n === 1) return done([{ x: 0, y: 0, w: cw, h: ch }], ch)
    if (layout === 'mosaic') return { ...mosaicCells(n, cw, ch), heads: [] }
    const rects = layout === 'grid' ? gridOf(n, cw, ch, true)
      : layout === 'feature' ? (aspect < 0.85 ? bigTop(n, cw, ch, 0.58) : bigLeft(n, cw, ch))
      : layout === 'banner' ? (aspect >= 1.5 ? bigLeft(n, cw, ch) : bigTop(n, cw, ch, 0.52))
      : layout === 'row' ? (aspect < 0.85 ? stackOf(n, cw, ch) : rowOf(n, cw, ch))
      : (aspect >= 1.5 ? rowOf(n, cw, ch) : stackOf(n, cw, ch))
    return done(rects, ch)
  }
  if (n === 1) return done([{ x: 0, y: 0, w: cw, h: cw * 0.75 }], cw * 0.75)
  if (layout === 'mosaic') return { ...mosaicCells(n, cw), heads: [] }
  if (layout === 'grid') {
    const cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols)
    const w = (cw - g * (cols - 1)) / cols, h = w * 0.75
    const H = rows * h + (rows - 1) * g
    return done(gridOf(n, cw, H), H)
  }
  if (layout === 'feature') { const H = cw * 0.78; return done(bigLeft(n, cw, H), H) }
  if (layout === 'banner') {
    const topH = cw * 0.5, k = n - 1, cols = restCols(k), rows = Math.ceil(k / cols)
    const w = (cw - g * (cols - 1)) / cols, h = Math.min(w * 0.85, cw * 0.3)
    const bottomH = rows * h + (rows - 1) * g
    return done([{ x: 0, y: 0, w: cw, h: topH }, ...restGrid(k, 0, topH + g, cw, bottomH, cols)], topH + g + bottomH)
  }
  if (layout === 'row') { const w = (cw - g * (n - 1)) / n, h = Math.max(w * 1.3, 300); return done(rowOf(n, cw, h), h) }
  const h = cw * 0.4   // column
  return done(stackOf(n, cw, n * h + (n - 1) * g), n * h + (n - 1) * g)
}

/** Does every photo keep a decent size? (Its shorter side is at least MIN_SIDE of the picture's width.) */
export function cellsFit(cells: Cells, cw: number): boolean {
  return cells.rects.every(r => Math.min(r.w, r.h) >= cw * MIN_SIDE - 0.5)
}

/**
 * The most photos the collage can hold for what is chosen: at most MAX_PHOTOS (POLAROID_MAX for Polaroid), never more than there are, and
 * never so many that a photo would shrink below MIN_SIDE. `boxFor(n)` gives the room the photos have for n of them; `fits(n)` says whether
 * n photos fit in it (the dialog passes a Polaroid or arrangement check). Always at least 1.
 */
export function maxPhotos(available: number, polaroid: boolean, fits: (n: number) => boolean): number {
  const cap = Math.min(polaroid ? POLAROID_MAX : MAX_PHOTOS, Math.max(1, available))
  for (let n = cap; n > 1; n--) if (fits(n)) return n
  return 1
}

// ── cropping a photo inside its slot ─────────────────────────────────────────

export interface Crop { zoom: number; cx: number; cy: number }   // zoom 1 = fills the slot; (cx, cy) is the centre of what shows, as shares of the photo
export const MAX_ZOOM = 4
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** The part of the photo that fills a slot of `slot` size: where it starts, and how big. Without a crop it is the middle, as before. */
export function cropSource(iw: number, ih: number, slot: { w: number; h: number }, crop?: Crop): { sx: number; sy: number; sw: number; sh: number; scale: number } {
  const z = clamp(crop?.zoom ?? 1, 1, MAX_ZOOM)
  const scale = Math.max(slot.w / iw, slot.h / ih) * z
  const sw = slot.w / scale, sh = slot.h / scale
  const sx = clamp((crop?.cx ?? 0.5) * iw - sw / 2, 0, Math.max(0, iw - sw))
  const sy = clamp((crop?.cy ?? 0.5) * ih - sh / 2, 0, Math.max(0, ih - sh))
  return { sx, sy, sw, sh, scale }
}
const cropOf = (iw: number, ih: number, src: { sx: number; sy: number; sw: number; sh: number }, zoom: number): Crop => ({ zoom, cx: (src.sx + src.sw / 2) / iw, cy: (src.sy + src.sh / 2) / ih })

/** Drag the photo `dx`, `dy` (in picture pixels, the way a finger moves it): the view moves the other way, and stops at the photo's edge. */
export function panCrop(crop: Crop | undefined, dx: number, dy: number, iw: number, ih: number, slot: { w: number; h: number }): Crop {
  const cur = cropSource(iw, ih, slot, crop)
  const next = cropSource(iw, ih, slot, { zoom: crop?.zoom ?? 1, cx: (cur.sx - dx / cur.scale + cur.sw / 2) / iw, cy: (cur.sy - dy / cur.scale + cur.sh / 2) / ih })
  return cropOf(iw, ih, next, crop?.zoom ?? 1)
}

/** Zoom to `zoom` (1 to MAX_ZOOM) around the centre of what shows now, kept inside the photo. */
export function zoomCrop(crop: Crop | undefined, zoom: number, iw: number, ih: number, slot: { w: number; h: number }): Crop {
  const z = clamp(zoom, 1, MAX_ZOOM)
  return cropOf(iw, ih, cropSource(iw, ih, slot, { zoom: z, cx: crop?.cx ?? 0.5, cy: crop?.cy ?? 0.5 }), z)
}

/** The topmost slot under a point, or -1. */
export function hitTest(rects: Rect[], px: number, py: number): number {
  for (let i = rects.length - 1; i >= 0; i--) { const r = rects[i]; if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i }
  return -1
}

// Which arrangements the window greys out, and why: too few photos, or a shape in which one arrangement draws the same as another (checked by a test).
// `aspect` is the room the photos have, width over height; undefined for Auto, where each arrangement keeps its own height.
export function arrangementOff(layout: Layout, n: number, aspect: number | undefined, years: string[]): string {
  if ((layout === 'feature' || layout === 'banner') && n < 3) return 'Needs 3 or more photos'
  if (layout === 'ladder' && new Set(years.slice(0, n)).size < 2) return 'Needs photos from more than one year'
  if (aspect !== undefined) {
    if (layout === 'column' && aspect >= 1.5) return 'Same as Row in a wide picture'
    if (layout === 'row' && aspect < 0.85) return 'Same as Column in a tall picture'
    if (layout === 'banner' && aspect >= 1.5) return 'Same as Feature in a wide picture'
  }
  return ''
}
