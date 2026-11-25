import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { DayPhoto } from '../../shared/types'
import logoImg from '../assets/logo-tray.png'
import { itemsLabel } from '../../shared/counts'
import { MONTHS } from './DateViewParts'
import { quietBtn, selectedOn } from '../ui/kit'

// Collage and card maker for On This Day: pick how many photos, a layout and a frame, then save or copy the
// picture. Drawn on a canvas here; nothing is uploaded anywhere. The frame colors come from the photos.

type Layout = 'grid' | 'feature' | 'banner' | 'row' | 'column'
type Frame = 'polaroid' | 'matched' | 'paper' | 'gallery' | 'film'
type Rect = { x: number; y: number; w: number; h: number }
type RGB = [number, number, number]

const LAYOUTS: { key: Layout; label: string }[] = [
  { key: 'grid', label: 'Grid' }, { key: 'feature', label: 'Feature' }, { key: 'banner', label: 'Banner' }, { key: 'row', label: 'Row' }, { key: 'column', label: 'Column' }
]
const FRAMES: { key: Frame; label: string }[] = [
  { key: 'polaroid', label: 'Polaroid' }, { key: 'matched', label: 'Matched' }, { key: 'paper', label: 'Paper' }, { key: 'gallery', label: 'Gallery' }, { key: 'film', label: 'Film' }
]

const W = 1080
const GAP = 14

// Saved shapes (at standard size). 'auto' keeps the collage's own height; the others give the photos exactly the room
// between the header and the footer, and the layout adapts to it.
type Shape = 'auto' | 'square' | 'portrait' | 'story' | 'wide'
const SHAPES: { key: Shape; label: string; w: number; h: number }[] = [
  { key: 'auto', label: 'Auto', w: 0, h: 0 }, { key: 'square', label: 'Square 1:1', w: 1080, h: 1080 }, { key: 'portrait', label: 'Portrait 4:5', w: 1080, h: 1350 },
  { key: 'story', label: 'Story 9:16', w: 1080, h: 1920 }, { key: 'wide', label: 'Wide 16:9', w: 1920, h: 1080 }
]
type Resolution = 'standard' | 'large'   // 1080 pixels wide, or twice that

// ── small helpers ────────────────────────────────────────────────────────────

const B58 = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
// Flickr's short address for a photo: flic.kr/p/ plus the photo id written in base 58
function shortLink(photoId: string): string {
  let n = BigInt(photoId)
  let out = ''
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n }
  return `flic.kr/p/${out}`
}

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => Math.round(a[i] * (1 - t) + b[i] * t)) as RGB
const css = (c: RGB): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`

function toHsv([r, g, b]: RGB): [number, number, number] {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, d = mx - mn
  let h = 0
  if (d > 0) {
    if (mx === r / 255) h = ((g - b) / 255 / d) % 6
    else if (mx === g / 255) h = (b - r) / 255 / d + 2
    else h = (r - g) / 255 / d + 4
    h *= 60; if (h < 0) h += 360
  }
  return [h, mx === 0 ? 0 : d / mx, mx]
}
function fromHsv(h: number, s: number, v: number): RGB {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function averageColor(img: HTMLImageElement): RGB {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16
  const ctx = c.getContext('2d')
  if (!ctx) return [128, 128, 128]
  ctx.drawImage(img, 0, 0, 16, 16)
  const d = ctx.getImageData(0, 0, 16, 16).data
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src })
}

// The pictures in the local list are the small 150-pixel squares; ask for a bigger size and fall back
async function fetchBig(thumbUrl: string): Promise<HTMLImageElement | null> {
  for (const suffix of ['_b', '_c', '_z', '_m', '_q']) {
    const url = thumbUrl.replace(/_[a-z]\.jpg$/, `${suffix}.jpg`)
    const data = await window.flickrAPI.fetchShareImage(url)
    if (data) { const img = await loadImage(data); if (img) return img }
  }
  return null
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, r: Rect): void {
  const s = Math.max(r.w / img.width, r.h / img.height)
  const sw = r.w / s, sh = r.h / s
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, r.x, r.y, r.w, r.h)
}

// ── layouts: where the photos go inside the framed area ──────────────────────

// A big photo on the left with the rest stacked or gridded on the right, filling a box cw wide and H tall
function bigLeft(n: number, cw: number, H: number): Rect[] {
  const g = GAP
  if (n === 2) { const w = (cw - g) / 2; return [{ x: 0, y: 0, w, h: H }, { x: w + g, y: 0, w, h: H }] }
  if (n === 6) {
    const w = (cw - 2 * g) / 3, h = (H - g) / 2
    return Array.from({ length: 6 }, (_, i) => ({ x: (i % 3) * (w + g), y: Math.floor(i / 3) * (h + g), w, h }))
  }
  const bigW = n === 5 ? cw * 0.5 : cw * 0.64
  const rects: Rect[] = [{ x: 0, y: 0, w: bigW, h: H }]
  const restX = bigW + g, restW = cw - restX
  if (n === 5) {
    const w = (restW - g) / 2, h = (H - g) / 2
    for (let i = 0; i < 4; i++) rects.push({ x: restX + (i % 2) * (w + g), y: Math.floor(i / 2) * (h + g), w, h })
  } else {
    const k = n - 1, h = (H - g * (k - 1)) / k
    for (let i = 0; i < k; i++) rects.push({ x: restX, y: i * (h + g), w: restW, h })
  }
  return rects
}

// A big photo across the top with the rest in a row underneath, filling a box cw wide and H tall
function bigTop(n: number, cw: number, H: number, share: number): Rect[] {
  const g = GAP
  if (n === 2) { const h = (H - g) / 2; return [{ x: 0, y: 0, w: cw, h }, { x: 0, y: h + g, w: cw, h }] }
  const topH = H * share, k = n - 1, w = (cw - g * (k - 1)) / k
  return [{ x: 0, y: 0, w: cw, h: topH }, ...Array.from({ length: k }, (_, i) => ({ x: i * (w + g), y: topH + g, w, h: H - topH - g }))]
}

const stackOf = (n: number, cw: number, H: number): Rect[] => { const h = (H - GAP * (n - 1)) / n; return Array.from({ length: n }, (_, i) => ({ x: 0, y: i * (h + GAP), w: cw, h })) }
const rowOf = (n: number, cw: number, H: number): Rect[] => { const w = (cw - GAP * (n - 1)) / n; return Array.from({ length: n }, (_, i) => ({ x: i * (w + GAP), y: 0, w, h: H })) }

// Rows and columns of roughly 4:3 cells that fill a box; a short last row sits in the middle (or stretches to fill, in a fixed shape)
function gridOf(n: number, cw: number, H: number, stretch = false): Rect[] {
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

// Where each photo goes inside the content box (cw wide). In a fixed shape (ch given) the photos fill the whole box and the
// arrangement adapts to it (a Row turns into a stack in a tall shape, a Column into a row in a wide one). With Auto (no ch)
// each layout keeps its own natural height.
function cellsFor(layout: Layout, n: number, cw: number, ch?: number): { rects: Rect[]; h: number } {
  const g = GAP
  if (ch !== undefined) {
    const aspect = cw / ch
    if (n === 1) return { rects: [{ x: 0, y: 0, w: cw, h: ch }], h: ch }
    const rects = layout === 'grid' ? gridOf(n, cw, ch, true)
      : layout === 'feature' ? (aspect < 0.85 ? bigTop(n, cw, ch, 0.58) : bigLeft(n, cw, ch))
      : layout === 'banner' ? (aspect >= 1.5 ? bigLeft(n, cw, ch) : bigTop(n, cw, ch, 0.52))
      : layout === 'row' ? (aspect < 0.85 ? stackOf(n, cw, ch) : rowOf(n, cw, ch))
      : (aspect >= 1.5 ? rowOf(n, cw, ch) : stackOf(n, cw, ch))
    return { rects, h: ch }
  }
  if (n === 1) return { rects: [{ x: 0, y: 0, w: cw, h: cw * 0.75 }], h: cw * 0.75 }
  if (layout === 'grid') {
    const cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols)
    const w = (cw - g * (cols - 1)) / cols, h = w * 0.75
    const H = rows * h + (rows - 1) * g
    return { rects: gridOf(n, cw, H), h: H }
  }
  if (layout === 'feature') { const H = cw * 0.78; return { rects: bigLeft(n, cw, H), h: H } }
  if (layout === 'banner') {
    const topH = cw * 0.5, k = n - 1, w = (cw - g * (k - 1)) / k, h = Math.min(w * 0.85, cw * 0.3)
    return { rects: [{ x: 0, y: 0, w: cw, h: topH }, ...Array.from({ length: k }, (_, i) => ({ x: i * (w + g), y: topH + g, w, h }))], h: topH + g + h }
  }
  if (layout === 'row') { const w = (cw - g * (n - 1)) / n, h = Math.max(w * 1.3, 300); return { rects: rowOf(n, cw, h), h } }
  const h = cw * 0.4   // column
  return { rects: stackOf(n, cw, n * h + (n - 1) * g), h: n * h + (n - 1) * g }
}

// A small price-tag icon (crisper and more consistent than an emoji)
function drawTagIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = color; ctx.globalAlpha = 0.85
  const k = size / 20
  ctx.beginPath(); ctx.moveTo(1 * k, 2 * k); ctx.lineTo(10 * k, 2 * k); ctx.lineTo(19 * k, 11 * k); ctx.lineTo(11 * k, 19 * k); ctx.lineTo(2 * k, 10 * k); ctx.closePath()
  ctx.moveTo(8 * k, 7 * k); ctx.arc(6 * k, 7 * k, 2 * k, 0, Math.PI * 2)
  ctx.fill('evenodd')
  ctx.restore()
}

// Polaroid cards: a square photo with a caption strip. In a fixed shape the cards pick the columns and rows that let them
// be as large as possible; with Auto they use two columns up to four photos, three beyond.
const POL_CAP = 118, POL_GX = 34, POL_GY = 58
function polaroidLayout(n: number, cw: number, ch?: number): { cols: number; rows: number; w: number; h: number; offY: number; h_total: number } {
  const options = ch === undefined ? [n === 1 ? 1 : n <= 4 ? 2 : 3] : Array.from({ length: n }, (_, i) => i + 1)
  let best = { cols: 1, rows: 1, w: 0, h: 0, offY: 0, h_total: 0 }
  for (const cols of options) {
    const rows = Math.ceil(n / cols)
    let w = (cw - POL_GX * (cols - 1)) / cols
    if (ch !== undefined) w = Math.min(w, (ch - POL_GY * (rows - 1)) / rows - POL_CAP)
    if (w <= 0) continue
    const total = rows * (w + POL_CAP) + POL_GY * (rows - 1)
    if (w > best.w) best = { cols, rows, w, h: w + POL_CAP, offY: ch !== undefined ? Math.max(0, (ch - total) / 2) : 0, h_total: total }
  }
  return best
}

// ── component ────────────────────────────────────────────────────────────────

interface ShareProps {
  photos: DayPhoto[]          // the photos to start with: the ones you ticked, or one from each year
  candidates: DayPhoto[]      // every photo of the day that is loaded, for re-picking
  userPicked: boolean         // true when `photos` is your own selection (kept as is, apart from the public-only choice)
  defaultPublicOnly: boolean
  tag?: string                // set when the page is showing only photos with one tag
  month: number
  day: number
  onClose: () => void
}

export default function ShareDialog({ photos, candidates, userPicked, defaultPublicOnly, tag, month, day, onClose }: ShareProps): React.JSX.Element {
  const [publicOnly, setPublicOnly] = useState(defaultPublicOnly)
  const [layout, setLayout] = useState<Layout>('feature')
  const [frame, setFrame] = useState<Frame>('polaroid')
  const [shape, setShape] = useState<Shape>('auto')
  const [resolution, setResolution] = useState<Resolution>('standard')
  const [showLinks, setShowLinks] = useState(true)
  const [source, setSource] = useState<'ticked' | 'years'>('ticked')   // when photos were ticked: use those, or one from each year
  const [loading, setLoading] = useState(true)
  const [, bump] = useState(0)
  const [note, setNote] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logoRef = useRef<HTMLImageElement | null>(null)
  const cache = useRef<Map<string, HTMLImageElement>>(new Map())   // bigger pictures already fetched, by photo id

  // The photos to choose from: your ticks as they are, or one per year (newest year first); public ones only when asked
  const basePicks = useMemo(() => {
    if (userPicked && source === 'ticked') return (publicOnly ? photos.filter(p => p.privacy === 0) : photos).slice(0, 6)
    const pool = publicOnly ? candidates.filter(p => p.privacy === 0) : candidates
    const byYear = new Map<string, DayPhoto>()
    for (const p of pool) { const y = p.dateTaken.slice(0, 4); if (!byYear.has(y)) byYear.set(y, p) }
    return [...byYear.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(e => e[1]).slice(0, 6)
  }, [photos, candidates, userPicked, source, publicOnly])

  const maxCount = Math.min(6, basePicks.length)
  const [count, setCount] = useState(Math.min(4, maxCount))
  const shownCount = Math.min(Math.max(count, 1), Math.max(maxCount, 1))
  const chosen = useMemo(() => basePicks.slice(0, shownCount), [basePicks, shownCount])
  const dateLabel = `${MONTHS[month - 1]} ${day}`
  const nonPublic = chosen.filter(p => p.privacy > 0).length

  // What the header says about the whole day (all of its photos, or only the public ones when that is ticked)
  const [facts, setFacts] = useState<{ total: number; videos: number; years: number; tags: string[] } | null>(null)   // tags: the day's most common, up to 8
  useEffect(() => {
    let cancelled = false
    void window.flickrAPI.getDayView({ month, day, scope: publicOnly ? 'public' : 'all', perYear: 1, tag }).then(v => {
      if (!cancelled) setFacts({ total: v.total, videos: v.videos, years: v.years.length, tags: v.insights.topTags.map(t => t.name) })
    })
    return () => { cancelled = true }
  }, [month, day, publicOnly, tag])

  // Load the bigger pictures (each one once) and the logo. The effect follows the list of photo ids, not the array
  // itself, so a redraw of the page behind the dialog never restarts the downloads.
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const pickKey = basePicks.map(p => p.id).join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try { if (!logoRef.current) logoRef.current = await loadImage(logoImg) } catch { /* the mark is drawn without the logo */ }
      const need = basePicks.filter(p => !cache.current.has(p.id))
      if (need.length > 0) setProgress({ done: 0, total: need.length })
      await Promise.all(need.map(async p => {
        const img = await fetchBig(p.thumbUrl)
        if (img) cache.current.set(p.id, img)
        if (!cancelled) setProgress(pr => ({ ...pr, done: pr.done + 1 }))
      }))
      if (!cancelled) { setLoading(false); bump(v => v + 1) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickKey, attempt])

  const ready = chosen.filter(p => cache.current.has(p.id))
  const images = cache.current

  // Colors picked from the photos: a soft paper tone, a dark text color, and an accent
  const palette = useMemo(() => {
    const avgs = ready.map(p => averageColor(images.get(p.id) as HTMLImageElement))
    const blend: RGB = avgs.length ? [0, 1, 2].map(i => Math.round(avgs.reduce((a, c) => a + c[i], 0) / avgs.length)) as RGB : [150, 140, 130]
    const [h, s] = toHsv(blend)
    return { mat: mix(blend, [255, 255, 255], 0.8), text: mix(blend, [0, 0, 0], 0.62), accent: fromHsv(h, Math.min(1, s * 2.2 + 0.15), 0.58) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready.map(p => p.id).join(',')])

  // The picture as it will be saved: the collage drawn at 1x or 2x, in the chosen shape
  function compose(m: number, src: Map<string, HTMLImageElement> = images): HTMLCanvasElement | null {
    const off = document.createElement('canvas')
    return render(off, m, src) ? off : null
  }

  useEffect(() => {
    const view = canvasRef.current
    if (!view || loading || ready.length === 0) return
    const c = compose(1)
    if (!c) return
    view.width = c.width; view.height = c.height
    view.getContext('2d')?.drawImage(c, 0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready.map(p => p.id).join(','), layout, frame, shape, showLinks, palette, loading, facts])

  const outW = (SHAPES.find(x => x.key === shape)?.w || W) * (resolution === 'large' ? 2 : 1)
  const outH = shape === 'auto' ? null : (SHAPES.find(x => x.key === shape)?.h ?? 0) * (resolution === 'large' ? 2 : 1)

  function render(canvas: HTMLCanvasElement, m = 1, src: Map<string, HTMLImageElement> = images): { H: number; bg: string } | null {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const sh = SHAPES.find(x => x.key === shape) ?? SHAPES[0]
    const fixed = sh.key !== 'auto'
    const OW = fixed ? sh.w : W   // canvas width at standard size
    const theme = {
      polaroid: { bg: css(palette.mat), fg: css(palette.text), rule: css(palette.accent), tab: css(palette.accent), tabText: '#ffffff', dark: false },
      matched: { bg: css(palette.mat), fg: css(palette.text), rule: css(palette.accent), tab: css(palette.accent), tabText: '#ffffff', dark: false },
      paper: { bg: '#faf6ee', fg: '#3b3a36', rule: '#8a7a5c', tab: '#8a7a5c', tabText: '#ffffff', dark: false },
      gallery: { bg: '#17181b', fg: '#e8e8ea', rule: '#e0b84a', tab: '#e0b84a', tabText: '#1a1a1a', dark: true },
      film: { bg: '#111111', fg: '#f2a65a', rule: '#f2a65a', tab: '#f2a65a', tabText: '#111111', dark: true }
    }[frame]
    const SANS = '-apple-system, "SF Pro Display", Helvetica, Arial, sans-serif'
    const setSpacing = (v: string): void => { (ctx as unknown as { letterSpacing: string }).letterSpacing = v }
    const padX = frame === 'film' ? 92 : 56, pad = 56
    const cw = OW - 2 * padX
    const n = ready.length
    const links = ready.map(p => shortLink(p.id))
    const linkLines = showLinks && frame !== 'polaroid' ? Math.ceil(links.length / 3) : 0
    const footerH = linkLines > 0 ? 54 + (linkLines - 1) * 30 : 14
    const headerH = 266, bottom = 40

    // Work out the sizes: a fixed shape gives the photos exactly the room between the header and the footer
    const bodyAvail = fixed ? Math.max(120, sh.h - pad - headerH - footerH - bottom) : undefined
    const pol = polaroidLayout(n, cw, bodyAvail)
    const body = frame === 'polaroid' ? { rects: [] as Rect[], h: pol.h_total } : cellsFor(layout, n, cw, bodyAvail)
    const contentH = fixed ? (bodyAvail as number) : body.h
    const H = fixed ? sh.h : Math.ceil(pad + headerH + contentH + footerH + bottom)
    canvas.width = Math.round(OW * m); canvas.height = Math.round(H * m)
    ctx.setTransform(m, 0, 0, m, 0, 0)

    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, OW, H)
    if (frame === 'film') {   // sprocket holes down both edges
      ctx.fillStyle = '#3a3a3a'
      for (let y = 22; y < H - 30; y += 46) { ctx.fillRect(30, y, 26, 26); ctx.fillRect(OW - 56, y, 26, 26) }
    }

    // Header: a calendar page with the date, the title, a line about the whole day, and a line of its most common tags
    const tileW = 116, tileH = 124, tx = padX, ty = pad
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(tx, ty, tileW, tileH, 14); ctx.fill(); ctx.restore()
    ctx.save(); ctx.beginPath(); ctx.roundRect(tx, ty, tileW, tileH, 14); ctx.clip(); ctx.fillStyle = '#FF0084'; ctx.fillRect(tx, ty, tileW, 38); ctx.restore()
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#ffffff'; ctx.font = `700 22px ${SANS}`; setSpacing('3.5px'); ctx.fillText(MONTHS[month - 1].slice(0, 3).toUpperCase(), tx + tileW / 2 + 1.75, ty + 27)
    setSpacing('0px'); ctx.fillStyle = '#1b2946'; ctx.font = `800 68px ${SANS}`; ctx.fillText(String(day), tx + tileW / 2, ty + 106)
    ctx.textAlign = 'left'
    const hx = tx + tileW + 36, hMax = OW - padX - hx
    ctx.fillStyle = theme.fg; ctx.font = `800 68px ${SANS}`; setSpacing('-1.5px'); ctx.fillText('On This Day', hx, ty + 66); setSpacing('0px')
    const nowYear = new Date().getFullYear()
    const years = ready.map(p => Number(p.dateTaken.slice(0, 4)))
    const ago = n === 1 ? nowYear - years[0] : 0
    const line1 = n === 1 ? (ago <= 0 ? 'Today' : `${ago} year${ago === 1 ? '' : 's'} ago today`)
      : facts ? `${itemsLabel(facts.total, facts.videos)} from ${facts.years} year${facts.years === 1 ? '' : 's'}`
      : `${Math.min(...years)} to ${Math.max(...years)}`
    // The day's whole count (photos and videos), shrunk a little if a long line would not fit
    let l1Size = 31
    ctx.font = `700 ${l1Size}px ${SANS}`
    while (l1Size > 22 && ctx.measureText(line1).width > hMax) { l1Size -= 1; ctx.font = `700 ${l1Size}px ${SANS}` }
    ctx.globalAlpha = 0.95; ctx.fillText(line1, hx, ty + 108)
    if (n > 1 && facts && facts.tags.length > 0) {
      // One row: up to five ordinary-length tags, spaced out; fewer only if the row would run out of room
      const iconW = 36
      ctx.font = `500 25px ${SANS}`; ctx.globalAlpha = 0.85
      const sep = '  ·  '
      let tags = facts.tags.filter(t => t.length <= 18).slice(0, 5)
      if (tags.length === 0) tags = facts.tags.slice(0, 1)
      while (tags.length > 1 && iconW + ctx.measureText(tags.join(sep)).width > hMax) tags = tags.slice(0, -1)
      let line = tags.join(sep)
      while (line.length > 3 && iconW + ctx.measureText(line).width > hMax) line = line.slice(0, -2) + '…'
      drawTagIcon(ctx, hx, ty + 126, 24, theme.fg)
      ctx.fillText(line, hx + iconW, ty + 146)
    }
    ctx.globalAlpha = 1
    const ruleY = pad + tileH + 46
    const grad = ctx.createLinearGradient(padX, 0, padX + cw, 0); grad.addColorStop(0, theme.rule); grad.addColorStop(1, '#FF0084')
    ctx.fillStyle = grad; ctx.fillRect(padX, ruleY, cw, 4)

    const top = pad + headerH
    if (frame === 'polaroid') {
      const rot = [-2.2, 1.6, -1.2, 2.0, -1.7, 1.3]
      ready.forEach((p, i) => {
        const col = i % pol.cols, row = Math.floor(i / pol.cols)
        const inRow = row === pol.rows - 1 ? n - pol.cols * (pol.rows - 1) : pol.cols
        const off = (cw - (inRow * pol.w + POL_GX * (inRow - 1))) / 2
        const x = padX + off + col * (pol.w + POL_GX), y = top + pol.offY + row * (pol.h + POL_GY)
        const pw = pol.w
        ctx.save()
        ctx.translate(x + pw / 2, y + pol.h / 2); ctx.rotate((rot[i % 6] * Math.PI) / 180); ctx.translate(-pw / 2, -pol.h / 2)
        ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, pw, pol.h)
        ctx.shadowColor = 'transparent'
        drawCover(ctx, src.get(p.id) as HTMLImageElement, { x: 14, y: 14, w: pw - 28, h: pw - 28 })
        // Caption: the year in big handwriting, how long ago, and the short Flickr link
        const k = Math.min(1.2, Math.max(0.72, pw / 420))   // caption type follows the card width
        const base = pw - 14 + Math.round(66 * k)
        const yr = p.dateTaken.slice(0, 4), yrsAgo = nowYear - Number(yr)
        ctx.fillStyle = '#3a3a3a'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
        ctx.font = `${Math.round(56 * k)}px "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive`
        ctx.fillText(yr, 18, base)
        // How long ago (and the link under it) on the right, so the year has room
        ctx.textAlign = 'right'
        ctx.font = `600 ${Math.round(30 * k)}px ${SANS}`; ctx.fillStyle = '#666666'
        ctx.fillText(yrsAgo <= 0 ? 'this year' : `${yrsAgo} year${yrsAgo === 1 ? '' : 's'} ago`, pw - 18, showLinks ? base - Math.round(24 * k) : base - 4)
        if (showLinks) { ctx.font = `500 ${Math.round(22 * k)}px ${SANS}`; ctx.fillStyle = '#7a7a7a'; ctx.fillText(links[i], pw - 18, base + Math.round(8 * k)) }
        ctx.restore()
      })
    } else {
      ready.forEach((p, i) => {
        const r = body.rects[i]
        const rx = padX + r.x, ry = top + r.y
        drawCover(ctx, src.get(p.id) as HTMLImageElement, { x: rx, y: ry, w: r.w, h: r.h })
        if (frame === 'gallery') { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, r.w, r.h) }
        // A year tab on the corner of every photo, so each year sits with its picture
        const yr = p.dateTaken.slice(0, 4)
        ctx.font = `800 30px ${SANS}`
        const tw = ctx.measureText(yr).width + 34, th = 46, ty2 = ry + r.h - th - 18
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1
        ctx.fillStyle = theme.tab; ctx.beginPath(); ctx.roundRect(rx, ty2, tw, th, [0, 12, 12, 0]); ctx.fill(); ctx.restore()
        ctx.fillStyle = theme.tabText; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(yr, rx + 16, ty2 + th / 2 + 1)
        ctx.textBaseline = 'alphabetic'
      })
    }

    // "Created with FlickrFetch", top right of the header (always there)
    {
      const right = OW - padX
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'right'
      ctx.font = `700 16px ${SANS}`; setSpacing('3px'); ctx.fillStyle = theme.fg; ctx.globalAlpha = 0.65
      ctx.fillText('CREATED WITH', right + 1.5, ty + 18); setSpacing('0px'); ctx.globalAlpha = 1
      ctx.font = `700 44px Lato, ${SANS}`
      const fetchW = ctx.measureText('Fetch').width, flickrW = ctx.measureText('Flickr').width
      const nameY = ty + 68
      ctx.textAlign = 'left'
      ctx.fillStyle = theme.dark ? '#ffffff' : '#0063DC'; ctx.fillText('Flickr', right - fetchW - flickrW, nameY)
      ctx.fillStyle = '#FF0084'; ctx.fillText('Fetch', right - fetchW, nameY)
      const logo = logoRef.current
      if (logo) {
        const sz = 62, lx = right - fetchW - flickrW - sz - 14
        ctx.save(); ctx.beginPath(); ctx.roundRect(lx, nameY - 46, sz, sz, 14); ctx.clip(); ctx.drawImage(logo, lx, nameY - 46, sz, sz); ctx.restore()
      }
    }

    // Footer: the short links (when ticked, for the frames that have no captions)
    const y = top + contentH + 40
    ctx.textAlign = 'left'
    let yy = y
    if (showLinks && frame !== 'polaroid') {
      ctx.font = `21px ${SANS}`; ctx.fillStyle = theme.fg; ctx.globalAlpha = 0.8
      for (let l = 0; l < linkLines; l++) { ctx.fillText(links.slice(l * 3, l * 3 + 3).join('   ·   '), padX, yy); if (l < linkLines - 1) yy += 30 }
      ctx.globalAlpha = 1
    }
    return { H, bg: theme.bg }
  }

  const confirmPrivacy = async (): Promise<boolean> => {
    if (nonPublic === 0) return true
    return window.flickrAPI.confirm(
      `${nonPublic} of these ${chosen.length} photo${chosen.length === 1 ? ' is' : 's are'} not public.`,
      'Anyone you send this picture to can see them.\n\nThe short Flickr links only open for people Flickr lets see the photo.',
      'Make it anyway'
    )
  }
  // Large (2x) is worth sharper pictures than the 1024-pixel preview ones: ask Flickr for the 2048 or 1600 pixel size of
  // each chosen photo (never the original, which can be huge). A photo whose size cannot be fetched keeps the standard picture.
  const sharp = useRef<Map<string, HTMLImageElement>>(new Map())
  async function sharpPictures(): Promise<Map<string, HTMLImageElement>> {
    const out = new Map(cache.current)
    await Promise.all(ready.map(async p => {
      if (!sharp.current.has(p.id)) {
        try {
          const sizes = await window.flickrAPI.getSizes(p.id)
          const pick = ['Large 2048', 'Large 1600', 'Large'].map(l => sizes.find(s => s.label === l && s.media === 'photo')).find(Boolean)
          if (pick) {
            const data = await window.flickrAPI.fetchShareImage(pick.source)
            const img = data ? await loadImage(data) : null
            if (img) sharp.current.set(p.id, img)
          }
        } catch { /* the standard picture is used */ }
      }
      const s = sharp.current.get(p.id)
      if (s) out.set(p.id, s)
    }))
    return out
  }
  // The saved picture: at the chosen size and shape (the preview is always standard size)
  const dataUrl = async (): Promise<string> => {
    if (resolution === 'large') {
      setNote('Getting sharper pictures from Flickr…')
      try {
        const src = await sharpPictures()
        return compose(2, src)?.toDataURL('image/png') ?? ''
      } finally { setNote('') }
    }
    return compose(1)?.toDataURL('image/png') ?? ''
  }
  const save = async (): Promise<void> => {
    if (!(await confirmPrivacy())) return
    const path = await window.flickrAPI.saveShareImage(await dataUrl(), `on-this-day-${MONTHS[month - 1].slice(0, 3)}-${day}${shape === 'auto' ? '' : '-' + shape}${resolution === 'large' ? '-large' : ''}.png`)
    if (path) setNote(`Saved to ${path.split('/').pop()}`)
  }
  const copy = async (): Promise<void> => {
    if (!(await confirmPrivacy())) return
    setNote((await window.flickrAPI.copyShareImage(await dataUrl())) ? 'Image copied. Paste it into a message or post.' : 'Could not copy the image.')
  }
  const copyLinks = async (): Promise<void> => {
    if (!(await confirmPrivacy())) return
    const text = ready.map(p => `${p.dateTaken.slice(0, 4)}  ${p.title || 'untitled'}  https://${shortLink(p.id)}`).join('\n')
    try { await navigator.clipboard.writeText(text); setNote('Links copied. Paste them next to the image.') } catch { setNote('Could not copy the links.') }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <b style={{ fontSize: 16, color: 'var(--ff-navy)' }}>Collage or card · {dateLabel}</b>
          <button style={styles.x} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={styles.body}>
          <div style={styles.controls}>
            <div style={styles.scroll}>
              <Step n={1} label="Photos">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button style={styles.step} disabled={shownCount <= 1} onClick={() => setCount(Math.max(1, shownCount - 1))}>−</button>
                  <b style={{ fontSize: 18, minWidth: 18, textAlign: 'center' }}>{shownCount}</b>
                  <button style={styles.step} disabled={shownCount >= maxCount} onClick={() => setCount(Math.min(maxCount, shownCount + 1))}>+</button>
                  <span style={styles.muted}>up to {maxCount}. One photo makes a single card.</span>
                </div>
                {userPicked ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
                    <label style={styles.check}><input type="radio" name="otd-source" checked={source === 'ticked'} onChange={() => setSource('ticked')} /> The {photos.length} photo{photos.length === 1 ? '' : 's'} I ticked</label>
                    <label style={styles.check}><input type="radio" name="otd-source" checked={source === 'years'} onChange={() => setSource('years')} /> One photo from each year</label>
                  </div>
                ) : (
                  <div style={styles.muted}>One photo from each year. (Tick photos on the page first to choose your own.)</div>
                )}
                <label style={{ ...styles.check, marginTop: 2 }} title="Leaves out any photo that is private, friends only or family only">
                  <input type="checkbox" checked={publicOnly} onChange={e => setPublicOnly(e.target.checked)} /> Public photos only
                </label>
              </Step>
              <Step n={2} label="Look">
                <div style={styles.chips}>{FRAMES.map(f => <button key={f.key} style={{ ...styles.chip, ...(frame === f.key ? styles.chipOn : {}) }} onClick={() => setFrame(f.key)}>{f.label}</button>)}</div>
                {frame !== 'polaroid' && (
                  <>
                    <div style={{ ...styles.label, marginTop: 4 }}>Arrangement</div>
                    <div style={styles.chips}>{LAYOUTS.map(l => <button key={l.key} style={{ ...styles.chip, ...(layout === l.key ? styles.chipOn : {}) }} onClick={() => setLayout(l.key)}>{l.label}</button>)}</div>
                  </>
                )}
                <div style={styles.muted}>Colors come from your photos.{frame === 'polaroid' ? ' Polaroids arrange themselves.' : ''}</div>
              </Step>
              <Step n={3} label="Shape and size">
                <div style={styles.chips}>{SHAPES.map(sh => <button key={sh.key} style={{ ...styles.chip, ...(shape === sh.key ? styles.chipOn : {}) }} onClick={() => setShape(sh.key)}>{sh.label}</button>)}</div>
                <div style={styles.chips}>
                  <button style={{ ...styles.chip, ...(resolution === 'standard' ? styles.chipOn : {}) }} onClick={() => setResolution('standard')}>Standard</button>
                  <button style={{ ...styles.chip, ...(resolution === 'large' ? styles.chipOn : {}) }} onClick={() => setResolution('large')}>Large (2×)</button>
                </div>
                <div style={styles.muted}>Saves {outW.toLocaleString()}{outH ? ` × ${outH.toLocaleString()}` : ' pixels wide'}. The preview is always standard size.{resolution === 'large' ? ' Large fetches the sharper 2048-pixel pictures when Flickr has them.' : ''}</div>
              </Step>
              <Step n={4} label="Extras">
                <label style={styles.check}><input type="checkbox" checked={showLinks} onChange={e => setShowLinks(e.target.checked)} /> Short Flickr link under each photo</label>
                <div style={styles.muted}>A saved picture can't hold a clickable link, so it is printed. "Copy links" gives clickable ones to paste beside it. "Created with FlickrFetch" is always included.</div>
              </Step>
            </div>
            <div style={styles.dock}>
              {nonPublic > 0 && <div style={styles.warn}>🔒 {nonPublic} of the {chosen.length} photos are not public. You will be asked before saving or copying.</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={styles.primary} disabled={loading || ready.length === 0} onClick={() => void save()}>Save image…</button>
                <button style={styles.btn} disabled={loading || ready.length === 0} onClick={() => void copy()}>Copy image</button>
                <button style={styles.btn} disabled={ready.length === 0} onClick={() => void copyLinks()}>Copy links</button>
              </div>
              {note && <div style={styles.muted}>{note}</div>}
            </div>
          </div>
          <div style={styles.preview}>
            {loading ? <span style={styles.muted}>Getting bigger pictures from Flickr…{progress.total > 0 ? ` ${Math.min(progress.done, progress.total)} of ${progress.total}` : ''}</span>
              : basePicks.length === 0 ? <span style={styles.muted}>{publicOnly ? 'None of this day\'s photos are public. Untick "Use public photos only" to include them.' : 'No photos to use.'}</span>
              : ready.length === 0 ? <span style={{ ...styles.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>Could not get these pictures from Flickr. Check your connection and try again.<button style={styles.btn} onClick={() => { setLoading(true); setAttempt(a => a + 1) }}>Try again</button></span>
              : <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 9 }}>
      <div style={styles.num}>{n}</div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={styles.label}>{label}</div>
        {children}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 'var(--ff-z-dialog)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: 'var(--ff-cream, #fcfaf6)', borderRadius: 14, width: 'min(1100px, 94vw)', height: 'min(760px, 92vh)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--ff-border)' },
  x: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--ff-text-secondary)' },
  body: { flex: 1, minHeight: 0, display: 'flex', gap: 18, padding: 16 },
  controls: { width: 316, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  scroll: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 6, paddingBottom: 8 },
  dock: { flexShrink: 0, borderTop: '1px solid var(--ff-border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  num: { flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: 'var(--ff-navy)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  preview: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ece8e1', borderRadius: 10, padding: 14, overflow: 'hidden' },
  group: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ff-text-secondary)' },
  muted: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { border: '1px solid var(--ff-border)', borderRadius: 14, padding: '3px 11px', fontSize: 13, background: '#fff', color: 'var(--ff-text)', cursor: 'pointer' },
  chipOn: { ...selectedOn },
  step: { ...quietBtn, width: 28, height: 28, padding: 0, fontSize: 16 },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ff-text)' },
  warn: { background: '#fff7e6', border: '1px solid #f5d28b', borderRadius: 8, padding: '8px 10px', fontSize: 12 },
  primary: { background: 'var(--ff-pink-action)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btn: { ...quietBtn, padding: '6px 12px' }
}
