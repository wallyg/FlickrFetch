import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CloseButton from '../ui/CloseButton'
import { polaroidLayout, captionPlan, type TextKind } from '../ui/polaroid'
import { canShuffle, defaultCount, oldestFirst, planPicks, shufflePicks, SHUFFLE_MAX, type ShuffleMode } from '../ui/shuffle'
import { arrangementOff, cellsFor, cellsFit, maxPhotos, cropSource, panCrop, zoomCrop, hitTest, MAX_ZOOM, MIN_SIDE, type Layout, type Rect, type Crop } from '../ui/collage'
import { dayLinkText, type DayLinkYear } from '../../shared/dayLinks'
import Icon from '../ui/Icon'
import Dialog from '../ui/Dialog'
import type { DayPhoto } from '../../shared/types'
import logoImg from '../assets/logo-tray.png'
import { itemsLabel } from '../../shared/counts'
import { MONTHS } from './DateViewParts'
import { quietBtn, pillBtn, selectedOn, primaryBtn, selectCompact, chip as kitChip } from '../ui/kit'
import { mapColours } from '../ui/mapColours'

// Collage and card maker for On This Day: pick how many photos, a layout and a frame, then save or copy the
// picture. Drawn on a canvas here; nothing is uploaded anywhere. The frame colors come from the photos.

type Frame = 'polaroid' | 'matched' | 'paper' | 'gallery' | 'film'
type RGB = [number, number, number]

// In pairs that go together: Grid and Mosaic, Feature and Banner, Row and Column; the one built on the years last
const LAYOUTS: { key: Layout; label: string; tip: string; short: string }[] = [
  { key: 'grid', label: 'Grid', tip: 'Equal photos in neat rows', short: 'Equal, in rows' }, { key: 'mosaic', label: 'Mosaic', tip: 'Tiles of different sizes, no gaps', short: 'Mixed sizes' },
  { key: 'feature', label: 'Feature', tip: 'One big photo, the rest smaller beside it', short: 'One big, rest beside' }, { key: 'banner', label: 'Banner', tip: 'One wide photo on top, the rest in a row below', short: 'One wide on top' },
  { key: 'row', label: 'Row', tip: 'All the photos side by side', short: 'Side by side' }, { key: 'column', label: 'Column', tip: 'All the photos stacked, one under the next', short: 'Stacked' },
  { key: 'ladder', label: 'By year', tip: 'Grouped under a heading for each year, oldest first', short: 'A heading per year' }
]
const FRAMES: { key: Frame; label: string; tip: string }[] = [
  { key: 'polaroid', label: 'Polaroid', tip: 'White instant-photo cards on a background tinted from your photos' },
  { key: 'matched', label: 'Tinted', tip: 'Page and year tabs in a color made from your photos' },
  { key: 'paper', label: 'Paper', tip: 'A warm cream page with brown accents' }, { key: 'gallery', label: 'Gallery', tip: 'Near-black with thin outlines and gold accents' }, { key: 'film', label: 'Film', tip: 'Black with film sprocket holes and orange text' }
]

const W = 1080
const PAD = 56, HEADER_H = 282, BOTTOM = 40   // the picture's top margin, the header's height and the bottom margin
const FOOTER_H = 76                          // the footer line: your Flickr address, and "Made with FlickrFetch"

// Saved shapes (at standard size). 'auto' keeps the collage's own height; the others give the photos exactly the room
// between the header and the footer, and the layout adapts to it.
type Shape = 'auto' | 'square' | 'portrait' | 'story' | 'wide'
const SHAPES: { key: Shape; label: string; tip: string; w: number; h: number }[] = [
  { key: 'auto', label: 'Auto', tip: 'The collage keeps its own height', w: 0, h: 0 }, { key: 'square', label: '1:1', tip: 'Square', w: 1080, h: 1080 }, { key: 'portrait', label: '4:5', tip: 'Portrait', w: 1080, h: 1350 },
  { key: 'story', label: '9:16', tip: 'Story: a phone screen', w: 1080, h: 1920 }, { key: 'wide', label: '16:9', tip: 'Wide: a TV or computer screen', w: 1920, h: 1080 }
]
type Resolution = 'standard' | 'large'   // 1080 pixels wide, or twice that

// ── small helpers ────────────────────────────────────────────────────────────

type LookPalette = { mat: RGB; text: RGB; accent: RGB }
// The colors of each look: Polaroid and Tinted take theirs from the photos, the others are fixed. Used to draw the picture and the small previews.
function lookTheme(frame: Frame, palette: LookPalette, brand: ReturnType<typeof mapColours>): { bg: string; fg: string; rule: string; tab: string; tabText: string; dark: boolean } {
  return {
    polaroid: { bg: css(palette.mat), fg: css(palette.text), rule: css(palette.accent), tab: css(palette.accent), tabText: brand.white, dark: false },
    matched: { bg: css(palette.mat), fg: css(palette.text), rule: css(palette.accent), tab: css(palette.accent), tabText: brand.white, dark: false },
    paper: { bg: '#faf6ee', fg: '#3b3a36', rule: '#8a7a5c', tab: '#8a7a5c', tabText: brand.white, dark: false },
    gallery: { bg: '#17181b', fg: '#e8e8ea', rule: '#e0b84a', tab: '#e0b84a', tabText: '#1a1a1a', dark: true },
    film: { bg: '#111111', fg: '#f2a65a', rule: '#f2a65a', tab: '#f2a65a', tabText: '#111111', dark: true }
  }[frame]
}

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

// The photo fills its slot: the middle of it, or the part you moved and zoomed to (#270)
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, r: Rect, crop?: Crop): void {
  const c = cropSource(img.width, img.height, r, crop)
  ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, r.x, r.y, r.w, r.h)
}

// "5 years ago" for the header of a one-year collage
function yearAgo(year: string): string {
  const ago = new Date().getFullYear() - Number(year)
  return ago <= 0 ? 'this year' : `${ago} year${ago === 1 ? '' : 's'} ago`
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

// ── component ────────────────────────────────────────────────────────────────

type Source = 'years' | 'year' | 'ticked'   // one photo from each year, one year only, or the photos you ticked on the page
interface ShareProps {
  years: { year: string; count: number }[]   // the day's years and how many photos (stills) each has, newest first
  candidates: DayPhoto[]      // every photo of the day that is loaded, for choosing and re-picking
  ticked: DayPhoto[]          // the photos you ticked on the page (stills)
  initialSource: Source
  initialYear?: string
  loadYear: (year: string) => Promise<DayPhoto[]>   // every still of one year
  defaultPublicOnly: boolean
  tag?: string                // set when the page is showing only photos with one tag
  month: number
  day: number
  onClose: () => void
}

export default function ShareDialog({ years, candidates, ticked, initialSource, initialYear, loadYear, defaultPublicOnly, tag, month, day, onClose }: ShareProps): React.JSX.Element {
  const [publicOnly, setPublicOnly] = useState(defaultPublicOnly)
  const [layout, setLayout] = useState<Layout>('feature')
  const [frame, setFrame] = useState<Frame>('polaroid')
  const [shape, setShape] = useState<Shape>('auto')
  const [resolution, setResolution] = useState<Resolution>('standard')
  const [source, setSource] = useState<Source>(initialSource)
  const [year, setYear] = useState(initialYear ?? years[0]?.year ?? '')
  const [yearPool, setYearPool] = useState<Record<string, DayPhoto[]>>({})   // every still of a year, loaded when that year is chosen
  const [step, setStep] = useState(1)                                      // 1 Style, 2 Layout, 3 Photos
  const [nsid, setNsid] = useState('')
  const [profile, setProfile] = useState('')                            // the name in the picture's footer address (flickr.com/photos/<name>)
  const [hover, setHover] = useState<{ p: DayPhoto; left: number; top: number } | null>(null)   // the enlarged photo shown while you point at a small one
  const [moreBelow, setMoreBelow] = useState(false)                    // the step scrolls: show a fade at the bottom while there is more
  const scrollRef = useRef<HTMLDivElement>(null)
  const [crops, setCrops] = useState<Record<string, Crop>>({})          // how you moved and zoomed each photo (#270), by photo id
  const [selId, setSelId] = useState<string | null>(null)               // the photo being moved and zoomed
  const [picker, setPicker] = useState<{ index: number; candidate: DayPhoto | null } | null>(null)   // the "replace this photo" box (#143)
  const hitRef = useRef<{ id: string; x: number; y: number; w: number; h: number }[]>([])   // where each photo sits in the picture, for clicks
  const dragRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [, bump] = useState(0)
  const [note, setNote] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logoRef = useRef<HTMLImageElement | null>(null)
  const cache = useRef<Map<string, HTMLImageElement>>(new Map())   // bigger pictures already fetched, by photo id

  // One year only (#164): that year's photos, all of them, fetched when the year is chosen
  const onlyYear = source === 'year' ? year : undefined
  useEffect(() => {
    if (source !== 'year' || !year || yearPool[year]) return
    let cancelled = false
    void loadYear(year).then(list => { if (!cancelled) setYearPool(p => ({ ...p, [year]: list.filter(x => x.media !== 'video') })) }).catch(() => undefined)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, year])

  // The photos to choose from; public ones only when asked. For each count, the photos it opens with (oldest first, spread evenly across the years).
  const mode: ShuffleMode = source
  const poolPhotos = useMemo(() => {
    const all = source === 'year' ? (yearPool[year] ?? candidates.filter(p => p.dateTaken.slice(0, 4) === year)) : source === 'ticked' ? ticked : candidates
    return publicOnly ? all.filter(p => p.privacy === 0) : all
  }, [source, year, yearPool, candidates, ticked, publicOnly])
  const plans = useMemo(() => Array.from({ length: SHUFFLE_MAX + 1 }, (_, n) => planPicks(mode, poolPhotos, n)), [mode, poolPhotos])
  const startCount = (src: Source, yr: string): number => defaultCount(src, years.length, src === 'year' ? (years.find(y => y.year === yr)?.count ?? 1) : ticked.length)
  const [count, setCount] = useState(() => startCount(initialSource, initialYear ?? years[0]?.year ?? ''))
  // Changing where the photos come from starts again from a sensible count for it
  const chooseSource = (value: string): void => {
    const next: Source = value === 'years' ? 'years' : value === 'ticked' ? 'ticked' : 'year'
    const nextYear = value.startsWith('y:') ? value.slice(2) : year
    setSource(next); setYear(nextYear); setCount(startCount(next, nextYear)); setSelId(null); setPicker(null)
  }

  // How many photos fit: no more than 8 (6 for Polaroid), and none smaller than MIN_SIDE of the picture's width, for this look, arrangement and shape
  const shapeInfo = SHAPES.find(x => x.key === shape) ?? SHAPES[0]
  const fixedShape = shapeInfo.key !== 'auto'
  const pictureW = fixedShape ? shapeInfo.w : W
  // The room the photos have for n of them: the picture's width inside its margins and, in a fixed shape, the height between the header and the footer
  function boxFor(n: number): { padX: number; cw: number; ch?: number; footerH: number } {
    const padX = frame === 'film' ? 92 : 56
    const footerH = FOOTER_H
    return { padX, cw: pictureW - 2 * padX, ch: fixedShape ? Math.max(120, shapeInfo.h - PAD - HEADER_H - footerH - BOTTOM) : undefined, footerH }
  }
  const yearsOf = (n: number): string[] => plans[Math.min(Math.max(n, 0), SHUFFLE_MAX)].map(p => p.dateTaken.slice(0, 4))
  const aspectFor = (n: number): number | undefined => { const b = boxFor(n); return b.ch ? b.cw / b.ch : undefined }
  const layoutWith = (l: Layout, n: number, ys: string[]): Layout => (arrangementOff(l, n, aspectFor(n), ys) ? 'grid' : l)   // a greyed arrangement draws as Grid
  const layoutFor = (l: Layout, n: number): Layout => layoutWith(l, n, yearsOf(n))   // for the photos planned for n (how many fit)
  const fitsCount = (n: number): boolean => {
    const b = boxFor(n)
    if (frame === 'polaroid') return polaroidLayout(n, b.cw, b.ch).w >= b.cw * MIN_SIDE
    const l = layoutFor(layout, n)
    if (l === 'column' && !fixedShape && n > 6) return false   // a tall stack of eight is more than a picture
    return cellsFit(cellsFor(l, n, b.cw, b.ch, yearsOf(n)), b.cw)
  }
  const maxCount = maxPhotos(poolPhotos.length, frame === 'polaroid', fitsCount)
  const shownCount = Math.min(Math.max(count, 1), Math.max(maxCount, 1), SHUFFLE_MAX)
  // Shuffle: a fresh set for the same choices. A change to those choices (source, year, public only, count) goes back to the first set.
  const [shuffled, setShuffled] = useState<{ key: string; list: DayPhoto[] } | null>(null)
  const pickMode = `${source}|${year}|${publicOnly}|${shownCount}`
  const basePicks = shuffled && shuffled.key === pickMode ? shuffled.list : plans[shownCount]
  // Replace and swap (#143) edit the list; a Shuffle or a change of source starts a fresh list
  const baseKey = basePicks.map(p => p.id).join(',')
  const [override, setOverride] = useState<{ key: string; list: DayPhoto[] } | null>(null)
  const picks = override && override.key === baseKey ? override.list : basePicks
  const chosen = useMemo(() => picks.slice(0, shownCount), [picks, shownCount])
  const shownYears = chosen.map(p => p.dateTaken.slice(0, 4))   // the years of the photos on screen, which a Shuffle, Replace or Swap can change
  const dateLabel = onlyYear ? `${MONTHS[month - 1]} ${day}, ${onlyYear}` : `${MONTHS[month - 1]} ${day}`
  const nonPublic = chosen.filter(p => p.privacy > 0).length
  // Why fewer photos show than you asked for: the look's own limit, the room in this look and shape, or simply not having that many photos
  const lookCap = frame === 'polaroid' ? 6 : 8
  const countNote = maxCount < Math.min(poolPhotos.length, lookCap) ? `This look and shape fit ${maxCount}, so the picture shows ${shownCount}. A different look or shape can bring ${count} back.`
    : poolPhotos.length < count ? `There ${poolPhotos.length === 1 ? 'is only 1 photo' : `are only ${poolPhotos.length} photos`} to choose from here.`
    : `${frame === 'polaroid' ? 'Polaroid holds 6' : 'A collage holds 8'}, so the picture shows ${shownCount}. A different look can bring ${count} back.`

  // What the header says about the whole day (all of its photos, or only the public ones when that is ticked)
  const [facts, setFacts] = useState<{ total: number; videos: number; years: number; tags: string[]; yearList: DayLinkYear[] } | null>(null)   // tags: the day's most common, up to 8
  useEffect(() => {
    let cancelled = false
    void window.flickrAPI.getDayView({ month, day, scope: publicOnly ? 'public' : 'all', perYear: 1, tag }).then(v => {
      if (!cancelled) setFacts({ total: v.total, videos: v.videos, years: v.years.length, tags: v.insights.topTags.map(t => t.name), yearList: v.years.map(g => ({ year: g.year, count: g.count, videos: g.videos, photoId: g.count === 1 ? g.photos[0]?.id : undefined })) })
    })
    return () => { cancelled = true }
  }, [month, day, publicOnly, tag])

  // Whose Flickr pages the year links point to
  useEffect(() => {
    void window.flickrAPI.getAuthState().then(a => { setNsid(a.user?.nsid ?? ''); setProfile(a.user?.username || a.user?.nsid || '') }).catch(() => { setNsid(''); setProfile('') })
  }, [])

  // Load the bigger pictures (each one once) and the logo. The effect follows the list of photo ids, not the array
  // itself, so a redraw of the page behind the dialog never restarts the downloads.
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const pickKey = picks.map(p => p.id).join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try { if (!logoRef.current) logoRef.current = await loadImage(logoImg) } catch { /* the mark is drawn without the logo */ }
      const need = picks.filter(p => !cache.current.has(p.id))
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
    const vctx = view.getContext('2d')
    vctx?.drawImage(c, 0, 0)
    const sel = selId ? hitRef.current.find(h => h.id === selId) : undefined
    if (vctx && sel) { vctx.strokeStyle = mapColours().pink; vctx.lineWidth = 8; vctx.strokeRect(sel.x + 4, sel.y + 4, sel.w - 8, sel.h - 8) }   // shows which photo is being moved; never saved
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready.map(p => p.id).join(','), layout, frame, shape, profile, palette, loading, facts, crops, selId, onlyYear])

  const outW = (SHAPES.find(x => x.key === shape)?.w || W) * (resolution === 'large' ? 2 : 1)
  const outH = shape === 'auto' ? null : (SHAPES.find(x => x.key === shape)?.h ?? 0) * (resolution === 'large' ? 2 : 1)

  function render(canvas: HTMLCanvasElement, m = 1, src: Map<string, HTMLImageElement> = images): { H: number; bg: string } | null {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const sh = SHAPES.find(x => x.key === shape) ?? SHAPES[0]
    const fixed = sh.key !== 'auto'
    const brand = mapColours()   // the brand colours and shadow, read from the page's tokens
    const OW = fixed ? sh.w : W   // canvas width at standard size
    const hits: typeof hitRef.current = []
    const theme = lookTheme(frame, palette, brand)
    const SANS = '-apple-system, "SF Pro Display", Helvetica, Arial, sans-serif'
    const setSpacing = (v: string): void => { (ctx as unknown as { letterSpacing: string }).letterSpacing = v }
    const n = ready.length
    const { padX, cw, footerH } = boxFor(n)
    const pad = PAD, headerH = HEADER_H, bottom = BOTTOM

    // Work out the sizes: a fixed shape gives the photos exactly the room between the header and the footer
    const bodyAvail = fixed ? Math.max(120, sh.h - pad - headerH - footerH - bottom) : undefined
    const pol = polaroidLayout(n, cw, bodyAvail)
    const lay = layoutWith(layout, n, ready.map(p => p.dateTaken.slice(0, 4)))
    const body = frame === 'polaroid' ? { rects: [] as Rect[], h: pol.total, heads: [] } : cellsFor(lay, n, cw, bodyAvail, ready.map(p => p.dateTaken.slice(0, 4)))
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
    ctx.save(); ctx.shadowColor = brand.shadow; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3
    ctx.fillStyle = brand.white; ctx.beginPath(); ctx.roundRect(tx, ty, tileW, tileH, 14); ctx.fill(); ctx.restore()
    ctx.save(); ctx.beginPath(); ctx.roundRect(tx, ty, tileW, tileH, 14); ctx.clip(); ctx.fillStyle = brand.pink; ctx.fillRect(tx, ty, tileW, 38); ctx.restore()
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = brand.white; ctx.font = `700 22px ${SANS}`; setSpacing('3.5px'); ctx.fillText(MONTHS[month - 1].slice(0, 3).toUpperCase(), tx + tileW / 2 + 1.75, ty + 27)
    setSpacing('0px'); ctx.fillStyle = brand.navy; ctx.font = `800 68px ${SANS}`; ctx.fillText(String(day), tx + tileW / 2, ty + 106)
    ctx.textAlign = 'left'
    const hx = tx + tileW + 36, hMax = OW - padX - hx
    ctx.fillStyle = theme.fg; ctx.font = `800 68px ${SANS}`; setSpacing('-1.5px'); ctx.fillText('On This Day', hx, ty + 66); setSpacing('0px')
    const nowYear = new Date().getFullYear()
    const years = ready.map(p => Number(p.dateTaken.slice(0, 4)))
    const ago = n === 1 ? nowYear - years[0] : 0
    const yearFacts = onlyYear ? facts?.yearList.find(g => g.year === onlyYear) : undefined
    const sinceYear = onlyYear ? nowYear - Number(onlyYear) : 0
    const line1 = onlyYear ? `${yearFacts ? itemsLabel(yearFacts.count, yearFacts.videos) : onlyYear} · ${sinceYear <= 0 ? 'this year' : `${sinceYear} year${sinceYear === 1 ? '' : 's'} ago`}`
      : n === 1 ? (ago <= 0 ? 'Today' : `${ago} year${ago === 1 ? '' : 's'} ago today`)
      : facts ? `${itemsLabel(facts.total, facts.videos)} from ${facts.years} year${facts.years === 1 ? '' : 's'}`
      : `${Math.min(...years)} to ${Math.max(...years)}`
    // The day's whole count (photos and videos), shrunk a little if a long line would not fit
    let l1Size = 31
    ctx.font = `700 ${l1Size}px ${SANS}`
    while (l1Size > 22 && ctx.measureText(line1).width > hMax) { l1Size -= 1; ctx.font = `700 ${l1Size}px ${SANS}` }
    ctx.globalAlpha = 0.95; ctx.fillText(line1, hx, ty + 118)
    if (n > 1 && !onlyYear && facts && facts.tags.length > 0) {
      // One row: up to five ordinary-length tags, spaced out; fewer only if the row would run out of room
      const iconW = 36
      ctx.font = `500 25px ${SANS}`; ctx.globalAlpha = 0.85
      const sep = '  ·  '
      let tags = facts.tags.filter(t => t.length <= 18).slice(0, 5)
      if (tags.length === 0) tags = facts.tags.slice(0, 1)
      while (tags.length > 1 && iconW + ctx.measureText(tags.join(sep)).width > hMax) tags = tags.slice(0, -1)
      let line = tags.join(sep)
      while (line.length > 3 && iconW + ctx.measureText(line).width > hMax) line = line.slice(0, -2) + '…'
      drawTagIcon(ctx, hx, ty + 142, 24, theme.fg)
      ctx.fillText(line, hx + iconW, ty + 162)
    }
    ctx.globalAlpha = 1
    const ruleY = pad + tileH + 62
    const grad = ctx.createLinearGradient(padX, 0, padX + cw, 0); grad.addColorStop(0, theme.rule); grad.addColorStop(1, brand.pink)
    ctx.fillStyle = grad; ctx.fillRect(padX, ruleY, cw, 4)

    const top = pad + headerH
    if (frame === 'polaroid') {
      const rot = [-2.2, 1.6, -1.2, 2.0, -1.7, 1.3]
      ready.forEach((p, i) => {
        const col = i % pol.cols, row = Math.floor(i / pol.cols)
        const inRow = row === pol.rows - 1 ? n - pol.cols * (pol.rows - 1) : pol.cols
        const off = (cw - (inRow * pol.w + pol.gx * (inRow - 1))) / 2
        const x = padX + off + col * (pol.w + pol.gx), y = top + pol.offY + row * (pol.h + pol.gy)
        const pw = pol.w
        ctx.save()
        ctx.translate(x + pw / 2, y + pol.h / 2); ctx.rotate((rot[i % 6] * Math.PI) / 180); ctx.translate(-pw / 2, -pol.h / 2)
        ctx.shadowColor = brand.shadow; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5
        ctx.fillStyle = brand.white; ctx.fillRect(0, 0, pw, pol.h)
        ctx.shadowColor = 'transparent'
        drawCover(ctx, src.get(p.id) as HTMLImageElement, { x: pol.pad, y: pol.pad, w: pol.photoW, h: pol.photoH }, crops[p.id])
        hits.push({ id: p.id, x: x + pol.pad, y: y + pol.pad, w: pol.photoW, h: pol.photoH })   // (the slight tilt is ignored for clicks)
        // Caption: the year in big handwriting and how long ago. Sized and placed by captionPlan so no text touches another.
        const yr = p.dateTaken.slice(0, 4), yrsAgo = nowYear - Number(yr)
        const agoText = yrsAgo <= 0 ? 'this year' : `${yrsAgo} year${yrsAgo === 1 ? '' : 's'} ago`
        const fontOf = (kind: TextKind, size: number): string => kind === 'hand' ? `${size}px "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive` : `${kind === 'sansBold' ? 600 : 500} ${size}px ${SANS}`
        const cap = captionPlan(pol, yr, agoText, null, (t, size, kind) => { ctx.font = fontOf(kind, size); return ctx.measureText(t).width })
        ctx.fillStyle = '#3a3a3a'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
        ctx.font = fontOf('hand', cap.yearSize); ctx.fillText(yr, cap.yearX, cap.yearBase)
        ctx.textAlign = 'right'
        ctx.font = fontOf('sansBold', cap.agoSize); ctx.fillStyle = '#666666'; ctx.fillText(agoText, cap.rightX, cap.agoBase)
        ctx.restore()
      })
    } else {
      ready.forEach((p, i) => {
        const r = body.rects[i]
        const rx = padX + r.x, ry = top + r.y
        drawCover(ctx, src.get(p.id) as HTMLImageElement, { x: rx, y: ry, w: r.w, h: r.h }, crops[p.id])
        hits.push({ id: p.id, x: rx, y: ry, w: r.w, h: r.h })
        if (frame === 'gallery') { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, r.w, r.h) }
        if (lay === 'ladder' && body.heads.length > 0) return   // the Year ladder has a heading over each year instead of a tab on each photo
        // A year tab on the corner of every photo, so each year sits with its picture
        const yr = p.dateTaken.slice(0, 4)
        ctx.font = `800 30px ${SANS}`
        const tw = ctx.measureText(yr).width + 34, th = 46, ty2 = ry + r.h - th - 18
        ctx.save(); ctx.shadowColor = brand.shadow; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1
        ctx.fillStyle = theme.tab; ctx.beginPath(); ctx.roundRect(rx, ty2, tw, th, [0, 12, 12, 0]); ctx.fill(); ctx.restore()
        ctx.fillStyle = theme.tabText; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(yr, rx + 16, ty2 + th / 2 + 1)
        ctx.textBaseline = 'alphabetic'
      })
    }

    if (frame !== 'polaroid') {   // the Year ladder's headings, one over each band
      ctx.fillStyle = theme.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `800 30px ${SANS}`
      for (const h of body.heads) ctx.fillText(h.text, padX + h.x, top + h.y + 30)
    }
    hitRef.current = hits

    // Footer: your Flickr address on the left, a quiet "Made with FlickrFetch" (the blue and pink name) on the right
    {
      const fy = top + contentH + 62, left = padX, right = OW - padX   // 22 more than before, so the footer sits clear of the photos
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
      ctx.font = `400 20px Lato, ${SANS}`
      const madeW = ctx.measureText('Made with ').width
      ctx.font = `700 26px Lato, ${SANS}`
      const flickrW = ctx.measureText('Flickr').width, fetchW = ctx.measureText('Fetch').width
      const brandX = right - madeW - flickrW - fetchW
      ctx.font = `400 20px Lato, ${SANS}`; ctx.fillStyle = theme.fg; ctx.globalAlpha = 0.7
      ctx.fillText('Made with ', brandX, fy); ctx.globalAlpha = 1
      ctx.font = `700 26px Lato, ${SANS}`
      ctx.fillStyle = theme.dark ? brand.white : brand.blue; ctx.fillText('Flickr', brandX + madeW, fy)
      ctx.fillStyle = brand.pink; ctx.fillText('Fetch', brandX + madeW + flickrW, fy)
      if (profile) {   // a long name is shortened so it never runs into the brand
        const full = `flickr.com/photos/${profile}`, room = brandX - left - 24
        ctx.font = `400 20px Lato, ${SANS}`; ctx.fillStyle = theme.fg; ctx.globalAlpha = 0.75
        let k = full.length
        while (k > 16 && ctx.measureText(k < full.length ? full.slice(0, k) + '…' : full).width > room) k--
        ctx.fillText(k < full.length ? full.slice(0, k) + '…' : full, left, fy); ctx.globalAlpha = 1
      }
    }
    return { H, bg: theme.bg }
  }

  // The words Share sends with the picture: a link for each year of the day (#267). Not while one tag is showing: Flickr's day pages cannot filter by tag.
  const yearLinksAvailable = !tag && !!nsid && !!facts && facts.yearList.length > 0
  const yearLinks = yearLinksAvailable ? dayLinkText(nsid, facts?.yearList ?? [], month, day, { onlyYear, everyone: publicOnly }) : ''

  // Replace one photo with another from the day, or swap two places (#143). A photo that moves keeps its crop; a replaced one is simply a different photo.
  const edit = (list: DayPhoto[]): void => setOverride({ key: baseKey, list })
  const inOrder = (l: DayPhoto[]): boolean => l.every((p, i) => i === 0 || l[i - 1].dateTaken <= p.dateTaken)
  const swapPlaces = (a: number, b: number): void => {
    if (a === b || a >= picks.length || b >= picks.length) return
    const list = picks.slice(); [list[a], list[b]] = [list[b], list[a]]
    edit(list)
  }
  const replaceWith = async (index: number, cand: DayPhoto): Promise<void> => {
    setNote('Loading the picture…')
    if (!cache.current.has(cand.id)) {
      const img = await fetchBig(cand.thumbUrl)
      if (!img) { setNote('Couldn\'t load that picture. Try another.'); return }
      cache.current.set(cand.id, img)
    }
    const list = picks.slice()
    const at = list.findIndex(p => p.id === cand.id)   // already further down the list (not shown yet): trade places so no photo appears twice
    if (at >= 0) list[at] = list[index]
    list[index] = cand
    edit(inOrder(picks) ? oldestFirst(list) : list)   // a list still oldest first stays that way; one you reordered by hand keeps your order
    setPicker(null); setNote(''); setSelId(null)
  }
  const replacePool = useMemo(() => {   // to replace a photo, any photo of the day (or of the year, in a one-year collage)
    const all = source === 'year' ? poolPhotos : candidates
    return publicOnly ? all.filter(p => p.privacy === 0) : all
  }, [source, poolPhotos, candidates, publicOnly])
  const others = useMemo(() => replacePool.filter(p => !chosen.some(c => c.id === p.id)), [replacePool, chosen])

  // Click a photo in the picture to select it; drag the selected photo to move it inside its slot (#270)
  const toPicture = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number; k: number } => {
    const box = e.currentTarget.getBoundingClientRect(), k = e.currentTarget.width / box.width
    return { x: (e.clientX - box.left) * k, y: (e.clientY - box.top) * k, k }
  }
  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const pt = toPicture(e), i = hitTest(hitRef.current, pt.x, pt.y)
    if (i < 0) { setSelId(null); return }
    const id = hitRef.current[i].id
    setSelId(id); setPicker(null)
    dragRef.current = { id, x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const d = dragRef.current
    if (!d) return
    const hit = hitRef.current.find(h => h.id === d.id), img = cache.current.get(d.id)
    if (!hit || !img) return
    const k = e.currentTarget.width / e.currentTarget.getBoundingClientRect().width
    const dx = (e.clientX - d.x) * k, dy = (e.clientY - d.y) * k
    dragRef.current = { id: d.id, x: e.clientX, y: e.clientY }
    setCrops(c => ({ ...c, [d.id]: panCrop(c[d.id], dx, dy, img.width, img.height, hit) }))
  }
  const pointerUp = (): void => { dragRef.current = null }
  const setZoom = (z: number): void => {
    const hit = hitRef.current.find(h => h.id === selId), img = selId ? cache.current.get(selId) : undefined
    if (!selId || !hit || !img) return
    setCrops(c => ({ ...c, [selId]: zoomCrop(c[selId], z, img.width, img.height, hit) }))
  }
  const resetCrop = (): void => { if (selId) setCrops(c => { const n = { ...c }; delete n[selId]; return n }) }
  const selPhoto = selId ? chosen.find(p => p.id === selId) : undefined

  const confirmPrivacy = async (): Promise<boolean> => {
    if (nonPublic === 0) return true
    return window.flickrAPI.confirm(
      `${nonPublic} of these ${chosen.length} photo${chosen.length === 1 ? ' is' : 's are'} not public.`,
      'The picture shows them, so anyone you send it to can see them.\n\nLinks sent with the picture open only for people Flickr lets see those photos.',
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
      setNote('Loading sharper pictures…')
      try {
        const src = await sharpPictures()
        return compose(2, src)?.toDataURL('image/png') ?? ''
      } finally { setNote('') }
    }
    return compose(1)?.toDataURL('image/png') ?? ''
  }
  const fileName = (): string => `on-this-day-${MONTHS[month - 1].slice(0, 3)}-${day}${shape === 'auto' ? '' : '-' + shape}${resolution === 'large' ? '-large' : ''}.png`
  const shuffleNow = (): void => setShuffled({ key: pickMode, list: shufflePicks(mode, poolPhotos, chosen, shownCount) })
  const save = async (): Promise<void> => {
    if (!(await confirmPrivacy())) return
    const path = await window.flickrAPI.saveShareImage(await dataUrl(), fileName())
    if (path) setNote(`Saved to ${path.split('/').pop()}`)
  }
  const copy = async (): Promise<void> => {
    if (!(await confirmPrivacy())) return
    setNote((await window.flickrAPI.copyShareImage(await dataUrl())) ? 'Image copied. Paste it into a message or post.' : 'Couldn\'t copy the image.')
  }
  // The Mac share sheet opens under the button. The privacy question comes first, as for Save and Copy.
  const share = async (box: DOMRect, withLinks: boolean): Promise<void> => {
    if (!(await confirmPrivacy())) return
    const ok = await window.flickrAPI.shareImage(await dataUrl(), fileName(), box.left, box.bottom + 4, withLinks ? yearLinks : '')
    if (!ok) setNote('Couldn\'t open sharing.')
  }
  const copyLinks = async (): Promise<void> => {
    if (!(await confirmPrivacy())) return
    const text = ready.map(p => `${p.dateTaken.slice(0, 4)}  ${p.title || 'untitled'}  https://${shortLink(p.id)}`).join('\n') + (yearLinks ? `\n\n${yearLinks}` : '')
    try { await navigator.clipboard.writeText(text); setNote('Links copied. Paste them next to the image.') } catch { setNote('Couldn\'t copy the links.') }
  }

  // A soft fade at the bottom of the left panel while there is more to scroll to
  const checkScroll = (): void => {
    const el = scrollRef.current
    if (el) setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }
  useEffect(checkScroll)

  return (
    <Dialog label="Collage or card" width="min(1100px, 94vw)" onClose={onClose} cardStyle={{ background: 'var(--ff-cream)', height: 'min(840px, 94vh)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={styles.head}>
          <b style={{ fontSize: 16, color: 'var(--ff-navy)' }}>Collage or card · {dateLabel}{onlyYear ? ` · ${yearAgo(onlyYear)}` : ''}</b>
          <CloseButton onClick={onClose} />
        </div>
        <div style={styles.body}>
          <div style={styles.controls}>
            <div style={styles.pinned}>
              <div style={styles.pinRow}>
                <span style={styles.label}>Photos from</span>
                <select style={{ ...selectCompact, flex: 1, minWidth: 0 }} aria-label="Photos from" value={source === 'year' ? `y:${year}` : source} onChange={e => chooseSource(e.target.value)}>
                  <option value="years">One photo from each year</option>
                  {years.map(y => <option key={y.year} value={`y:${y.year}`}>{y.year} only · {y.count.toLocaleString()} {y.count === 1 ? 'photo' : 'photos'}</option>)}
                  {ticked.length >= 2 && <option value="ticked">My {ticked.length} ticked photos</option>}
                </select>
              </div>
              <div style={styles.pinRow}>
                <span style={styles.label}>How many</span>
                <button style={styles.step} aria-label="Fewer photos" disabled={shownCount <= 1} onClick={() => setCount(Math.max(1, shownCount - 1))}>−</button>
                <b style={{ fontSize: 18, minWidth: 18, textAlign: 'center' }}>{shownCount}</b>
                <button style={styles.step} aria-label="More photos" disabled={shownCount >= maxCount} onClick={() => setCount(Math.min(maxCount, shownCount + 1))}>+</button>
                <span style={styles.muted}>up to {maxCount}{maxCount < Math.min(poolPhotos.length, frame === 'polaroid' ? 6 : 8) ? ' for this look' : ''}</span>
              </div>
              {source === 'years' && shownCount > 1 && <div style={styles.muted} title="The years are spread evenly across your years, with the newest and the oldest always in">Years: {[...new Set(chosen.map(p => p.dateTaken.slice(0, 4)))].join(' · ')}</div>}
              {count > shownCount && <div style={styles.muted}>{countNote}</div>}
            </div>
            <div style={styles.tabs} role="tablist">
              {['Style', 'Layout', 'Photos'].map((name, i) => (
                <button key={name} role="tab" aria-selected={step === i + 1} style={{ ...styles.tab, ...(step === i + 1 ? styles.tabOn : {}) }} onClick={() => setStep(i + 1)}>
                  <span style={{ ...styles.tabNum, ...(step === i + 1 ? styles.tabNumOn : {}) }}>{i + 1}</span>{name}
                </button>
              ))}
            </div>
            <div style={styles.muted}><b style={{ color: 'var(--ff-text)' }}>{FRAMES.find(f => f.key === frame)?.label}</b>
              {frame !== 'polaroid' && shownCount > 1 ? <> · <b style={{ color: 'var(--ff-text)' }}>{LAYOUTS.find(l => l.key === layoutWith(layout, shownCount, shownYears))?.label}</b></> : null}
              {' · '}<b style={{ color: 'var(--ff-text)' }}>{shapeInfo.label}</b>{resolution === 'large' ? <> · <b style={{ color: 'var(--ff-text)' }}>Large</b></> : null}</div>
            <div ref={scrollRef} style={styles.scroll} onScroll={checkScroll}>
              {step === 1 && (
                <>
                  <div style={styles.label}>Look</div>
                  <div style={styles.lookGrid}>
                    {FRAMES.map(f => (
                      <button key={f.key} style={{ ...styles.look, ...(frame === f.key ? styles.lookOn : {}) }} title={f.tip} aria-pressed={frame === f.key} onClick={() => setFrame(f.key)}>
                        <LookPreview look={f.key} theme={lookTheme(f.key, palette, mapColours())} thumbs={chosen.map(p => p.thumbUrl)} />
                        <b style={{ fontSize: 13 }}>{f.label}</b>
                      </button>
                    ))}
                  </div>
                  <div style={styles.label}>Shape</div>
                  <div style={styles.shapeGrid}>
                    {SHAPES.map(sh => (
                      <button key={sh.key} style={{ ...styles.shapeBtn, ...(shape === sh.key ? styles.lookOn : {}) }} title={sh.tip} aria-pressed={shape === sh.key} onClick={() => setShape(sh.key)}>
                        <ShapeIcon w={sh.w} h={sh.h} />{sh.label}
                      </button>
                    ))}
                  </div>
                  <div style={styles.chips}>
                    <button style={{ ...styles.chip, ...(resolution === 'standard' ? styles.chipOn : {}) }} onClick={() => setResolution('standard')}>Standard</button>
                    <button style={{ ...styles.chip, ...(resolution === 'large' ? styles.chipOn : {}) }} onClick={() => setResolution('large')}>Large (2×)</button>
                  </div>
                  <div style={styles.muted}>Saves {outW.toLocaleString()}{outH ? ` × ${outH.toLocaleString()}` : ' pixels wide'}.{resolution === 'large' ? ' The preview stays standard size; Large fetches the sharper 2048-pixel pictures when Flickr has them.' : ''}</div>
                </>
              )}
              {step === 2 && (
                <>
                  <div style={styles.label}>Arrangement</div>
                  {frame === 'polaroid' ? <div style={styles.muted}>Polaroids arrange themselves. Pick another look in Style to choose an arrangement.</div>
                    : shownCount < 2 ? <div style={styles.muted}>One photo makes a single card.</div>
                    : (
                      <div style={styles.cardGrid}>
                        {LAYOUTS.map(l => {
                          const why = arrangementOff(l.key, shownCount, aspectFor(shownCount), shownYears)
                          const bx = boxFor(shownCount)
                          const on = layoutWith(layout, shownCount, shownYears) === l.key
                          return (
                            <button key={l.key} disabled={!!why} aria-pressed={on} title={why || l.tip} style={{ ...styles.arrCard, ...(on ? styles.lookOn : {}), ...(why ? { opacity: 0.45, cursor: 'default' } : {}) }} onClick={() => setLayout(l.key)}>
                              <span style={styles.arrPic}><ArrangeIcon layout={l.key} n={shownCount} cw={bx.cw} ch={bx.ch} years={shownYears} width={90} height={40} /></span>
                              <b style={{ fontSize: 13 }}>{l.label}</b>
                              <span style={styles.muted}>{why || l.short}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                </>
              )}
              {step === 3 && (
                <>
                  <div style={styles.label}>Photos</div>
                  <div style={styles.muted}>Click a photo in the picture to move and zoom it. Click one below to replace it. Drag one onto another to swap places.</div>
                  <div style={styles.strip}>
                    {chosen.map((p, i) => (
                      <button key={p.id} draggable style={{ ...styles.thumb, backgroundImage: `url(${p.thumbUrl})`, ...(picker?.index === i || selId === p.id ? styles.thumbOn : {}) }}
                        title={`${p.dateTaken.slice(0, 4)}. Click to replace, drag onto another to swap places.`} aria-label={`Photo ${i + 1}, ${p.dateTaken.slice(0, 4)}. Replace`}
                        onClick={() => { setSelId(null); setPicker(picker?.index === i ? null : { index: i, candidate: null }) }}
                        onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setHover({ p, left: r.right + 12, top: r.top }) }}
                        onMouseLeave={() => setHover(null)}
                        onDragStart={e => { setHover(null); e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move' }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) swapPlaces(from, i) }}>
                        <span style={styles.thumbYear}>{p.dateTaken.slice(0, 4)}</span>
                      </button>
                    ))}
                  </div>
                  <div>
                    <button style={styles.btn} disabled={!canShuffle(mode, poolPhotos, shownCount)} onClick={shuffleNow}
                      title={canShuffle(mode, poolPhotos, shownCount) ? 'Pick a different set of photos' : 'There is nothing else to pick from'}><Icon name="shuffle" /> Shuffle</button>
                  </div>
                  <div style={styles.muted}>{source === 'years' ? 'Shuffle keeps the spread across the years and picks other photos.' : source === 'year' ? `Shuffle picks a different few of the photos from ${year}.` : 'Shuffle picks a different few of the photos you ticked.'}</div>
                  <label style={styles.check} title="Leaves out any photo that is private, friends only or family only">
                    <input type="checkbox" checked={publicOnly} onChange={e => setPublicOnly(e.target.checked)} /> Public photos only
                  </label>
                </>
              )}
            </div>
            {moreBelow && (
              <div style={styles.fade}>
                <button style={styles.more} onClick={() => scrollRef.current?.scrollBy({ top: 240, behavior: 'smooth' })}><Icon name="arrowDown" /> More below</button>
              </div>
            )}
            <div style={styles.dock}>
              {nonPublic > 0 && <div style={styles.warn} title="You will be asked before saving, copying or sharing"><Icon name="lock" /> {nonPublic} of {chosen.length} photos aren't public</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
                <button style={{ ...styles.primary, ...styles.dockBtn }} disabled={loading || ready.length === 0} title="Save the picture as a file" onClick={() => void save()}><Icon name="download" /> Save</button>
                <DockMenu label="Copy" icon="copy" disabled={ready.length === 0} items={[
                  { key: 'image', label: 'Copy image', disabled: loading, onClick: () => void copy() },
                  { key: 'links', label: 'Copy links', title: 'The photos\' Flickr links as text, to paste next to the picture', onClick: () => void copyLinks() }
                ]} />
                <DockMenu label="Share" icon="share" disabled={loading || ready.length === 0} items={[
                  { key: 'with', label: onlyYear ? `Picture with link to ${onlyYear}` : 'Picture with links', disabled: !yearLinksAvailable,
                    title: yearLinksAvailable ? (onlyYear ? 'Sends the picture and a link to that day on your Flickr page' : 'Sends the picture and one line per year, each a link to that day on your Flickr page') : tag ? 'Flickr\'s day pages cannot show one tag, so there are no links while a tag is showing' : 'Sign in to Flickr to include links',
                    onClick: box => void share(box, true) },
                  { key: 'only', label: 'Picture only', onClick: box => void share(box, false) }
                ]} />
              </div>
              {note && <div style={styles.muted}>{note}</div>}
            </div>
          </div>
          <div style={styles.preview}>
            {loading ? <span style={styles.muted}>Loading bigger pictures…{progress.total > 0 ? ` ${Math.min(progress.done, progress.total)} of ${progress.total}` : ''}</span>
              : basePicks.length === 0 ? <span style={styles.muted}>{publicOnly ? 'None of this day\'s photos are public. Untick "Use public photos only" to include them.' : 'No photos to use.'}</span>
              : ready.length === 0 ? <span style={{ ...styles.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>Couldn't load these pictures. Check your connection and try again.<button style={styles.btn} onClick={() => { setLoading(true); setAttempt(a => a + 1) }}>Try again</button></span>
              : <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 2px 12px var(--ff-shadow-mid)', cursor: selId ? 'grab' : 'pointer', touchAction: 'none' }}
                  onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />}
            {picker && picker.index < chosen.length && (
              <div style={styles.pop} role="dialog" aria-label="Replace a photo">
                <b>Replace photo {picker.index + 1} ({chosen[picker.index].dateTaken.slice(0, 4)})</b>
                <div style={styles.muted}>{others.length === 0 ? 'There are no other photos loaded for this day. Show more photos on the page first.' : `Other photos from ${dateLabel}. The ones already in the picture are not listed.`}</div>
                <div style={styles.popGrid}>
                  {others.slice(0, 60).map(p => (
                    <button key={p.id} style={{ ...styles.popThumb, backgroundImage: `url(${p.thumbUrl})`, ...(picker.candidate?.id === p.id ? styles.thumbOn : {}) }} aria-label={`Use the photo from ${p.dateTaken.slice(0, 4)}`}
                      onClick={() => setPicker({ ...picker, candidate: p })}><span style={styles.thumbYear}>{p.dateTaken.slice(0, 4)}</span></button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={styles.primary} disabled={!picker.candidate} onClick={() => picker.candidate && void replaceWith(picker.index, picker.candidate)}>Use this one</button>
                  <button style={styles.btn} onClick={() => setPicker(null)}>Cancel</button>
                </div>
              </div>
            )}
            {selPhoto && !picker && (
              <div style={styles.tool}>
                <b>Move and zoom the {selPhoto.dateTaken.slice(0, 4)} photo</b>
                <span style={styles.muted}>Drag it in the picture to move it.</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>Zoom
                  <input type="range" min={100} max={MAX_ZOOM * 100} step={5} value={Math.round((crops[selPhoto.id]?.zoom ?? 1) * 100)} onChange={e => setZoom(Number(e.target.value) / 100)} aria-label="Zoom" style={{ width: 120 }} />
                  <span style={{ minWidth: 36 }}>{Math.round((crops[selPhoto.id]?.zoom ?? 1) * 100)}%</span>
                </label>
                <button style={styles.btn} disabled={!crops[selPhoto.id]} onClick={resetCrop}>Reset</button>
                <button style={styles.btn} onClick={() => setPicker({ index: chosen.findIndex(p => p.id === selPhoto.id), candidate: null })}>Replace…</button>
                <button style={styles.primary} onClick={() => setSelId(null)}>Done</button>
              </div>
            )}
          </div>
        </div>
        {hover && createPortal(
          <div style={{ ...styles.zoomCard, left: hover.left, top: Math.max(8, Math.min(hover.top, window.innerHeight - 320)) }} aria-hidden="true">
            <img src={cache.current.get(hover.p.id)?.src ?? hover.p.thumbUrl} alt="" style={styles.zoomImg} />
            <div style={styles.muted}>{hover.p.dateTaken.slice(0, 4)}{hover.p.title ? ` · ${hover.p.title}` : ''}</div>
          </div>,
          document.body
        )}
</Dialog>
  )
}

// A button in the dock that opens a short menu upward (Copy, Share). Items get the button's box, so the Mac share sheet can open under it.
interface DockItem { key: string; label: string; onClick: (box: DOMRect) => void; disabled?: boolean; title?: string }
function DockMenu({ label, icon, items, disabled }: { label: string; icon: string; items: DockItem[]; disabled?: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    const onDown = (e: MouseEvent): void => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown) }
  }, [open])
  return (
    <div ref={wrap} style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
      <button style={{ ...styles.btn, ...styles.dockBtn }} disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name={icon} /> {label} <Icon name="chevronDown" />
      </button>
      {open && (
        <div role="menu" style={styles.dockMenu}>
          {items.map(it => (
            <button key={it.key} role="menuitem" style={{ ...styles.dockItem, ...(it.disabled ? { opacity: 0.5, cursor: 'default' } : {}) }} disabled={it.disabled} title={it.title}
              onClick={() => { const box = wrap.current?.getBoundingClientRect(); setOpen(false); if (box) it.onClick(box) }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// A drawing of an arrangement, made from the same layout code as the picture, for the photos and shape you have now
function ArrangeIcon({ layout, n, cw, ch, years, width = 26, height = 18 }: { layout: Layout; n: number; cw: number; ch?: number; years: string[]; width?: number; height?: number }): React.JSX.Element {
  const cells = cellsFor(layout, n, cw, ch, years)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${cw} ${cells.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ flexShrink: 0 }}>
      {cells.rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={cw * 0.015} fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      {cells.heads.map((h, i) => <rect key={`h${i}`} x={h.x} y={h.y + 6} width={cw * 0.3} height={cw * 0.04} fill="var(--ff-pink)" />)}
    </svg>
  )
}

// A drawing of a shape: a box with that proportion (a dashed one for Auto)
function ShapeIcon({ w, h }: { w: number; h: number }): React.JSX.Element {
  const a = w === 0 ? 0.8 : w / h
  const bw = a >= 1 ? 22 : 22 * a, bh = a >= 1 ? 22 / a : 22
  return (
    <svg width={26} height={26} viewBox="0 0 26 26" aria-hidden="true">
      <rect x={13 - bw / 2} y={13 - bh / 2} width={bw} height={bh} rx={2} fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeDasharray={w === 0 ? '3 2' : undefined} />
    </svg>
  )
}

// A small preview of a look, made from the chosen photos and the look's own colors
function LookPreview({ look, theme, thumbs }: { look: Frame; theme: ReturnType<typeof lookTheme>; thumbs: string[] }): React.JSX.Element {
  const photo = (i: number): React.CSSProperties => ({ backgroundImage: thumbs.length ? `url(${thumbs[i % thumbs.length]})` : undefined, backgroundColor: 'var(--ff-warm)', backgroundSize: 'cover', backgroundPosition: 'center' })
  const slots = [[10, 18], [52, 18], [10, 56], [52, 56]]
  const tilt = [-3, 2.5, 2, -2.5]
  return (
    <span style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '3 / 2', background: theme.bg, borderRadius: 6, overflow: 'hidden' }} aria-hidden="true">
      <i style={{ position: 'absolute', left: '10%', right: '10%', top: '8%', height: 2, background: theme.rule }} />
      {slots.map(([x, y], i) => look === 'polaroid' ? (
        <i key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y - 6}%`, width: '38%', height: '46%', background: 'var(--ff-white)', boxShadow: '0 1px 3px var(--ff-shadow-mid)', transform: `rotate(${tilt[i]}deg)` }}>
          <b style={{ position: 'absolute', left: '8%', right: '8%', top: '8%', bottom: '24%', ...photo(i) }} />
        </i>
      ) : (
        <i key={i} style={{ position: 'absolute', left: `${x + (look === 'film' ? 4 : 0)}%`, top: `${y}%`, width: '36%', height: '30%', border: look === 'gallery' ? '1px solid color-mix(in srgb, var(--ff-white) 35%, transparent)' : undefined, ...photo(i) }}>
          <b style={{ position: 'absolute', left: 0, bottom: '10%', width: '40%', height: '20%', background: theme.tab }} />
        </i>
      ))}
      {look === 'film' && [0, 1, 2, 3, 4, 5, 6].map(n => (
        <React.Fragment key={n}>
          <i style={{ position: 'absolute', left: '3%', top: `${6 + n * 13}%`, width: '4%', height: '6%', background: theme.fg, opacity: 0.3 }} />
          <i style={{ position: 'absolute', right: '3%', top: `${6 + n * 13}%`, width: '4%', height: '6%', background: theme.fg, opacity: 0.3 }} />
        </React.Fragment>
      ))}
    </span>
  )
}

const styles: Record<string, React.CSSProperties> = {
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--ff-border)' },
  x: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--ff-text-secondary)' },
  body: { flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: 16 },
  controls: { width: 316, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 },
  pinned: { display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--ff-white)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: 8 },
  pinRow: { display: 'flex', alignItems: 'center', gap: 8 },
  tabs: { display: 'flex', gap: 4 },
  tab: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, border: 'none', background: 'none', color: 'var(--ff-text-secondary)', cursor: 'pointer', padding: '4px 0', borderBottom: '2px solid var(--ff-border)', fontSize: 12 },
  tabOn: { color: 'var(--ff-navy)', fontWeight: 700, borderBottom: '2px solid var(--ff-pink)' },   // a whole border, never borderColor: React leaves the old colour behind when a longhand is switched back off
  tabNum: { width: 20, height: 20, borderRadius: 50, background: 'var(--ff-border)', color: 'var(--ff-text)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tabNumOn: { background: 'var(--ff-navy)', color: 'var(--ff-white)' },
  lookGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  look: { ...quietBtn, border: '1px solid var(--ff-line-strong)', background: 'var(--ff-white)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--ff-text)' },
  lookOn: { border: '1px solid var(--ff-pink)', boxShadow: 'inset 0 0 0 1px var(--ff-pink)', color: 'var(--ff-pink-action)' },
  shapeGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 },
  shapeBtn: { ...quietBtn, border: '1px solid var(--ff-line-strong)', background: 'var(--ff-white)', borderRadius: 8, padding: '6px 2px', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', color: 'var(--ff-text)' },
  cardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  arrCard: { ...quietBtn, border: '1px solid var(--ff-line-strong)', background: 'var(--ff-white)', borderRadius: 8, padding: '6px 8px 8px', display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', cursor: 'pointer', color: 'var(--ff-text)', minWidth: 0 },
  arrPic: { background: 'var(--ff-warm)', borderRadius: 6, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  scroll: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 6, paddingBottom: 8 },
  dock: { flexShrink: 0, borderTop: '1px solid var(--ff-border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  fade: { flexShrink: 0, height: 36, marginTop: -36, marginRight: 6, pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2, background: 'linear-gradient(to bottom, transparent, var(--ff-cream))' },
  more: { ...pillBtn, pointerEvents: 'auto', boxShadow: '0 1px 4px var(--ff-shadow-soft)' },
  chipDraw: { padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 },
  dockBtn: { flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap', padding: '6px 8px' },
  dockMenu: { position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, zIndex: 'var(--ff-z-menu)', minWidth: 200, background: 'var(--ff-surface)', border: '1px solid var(--ff-line-strong)', borderRadius: 8, boxShadow: '0 4px 16px var(--ff-shadow-soft)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2 },
  dockItem: { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 13, color: 'var(--ff-text)', cursor: 'pointer' },
  num: { flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: 'var(--ff-navy)', color: 'var(--ff-white)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  preview: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ece8e1', borderRadius: 8, padding: 12, overflow: 'hidden', position: 'relative' },
  strip: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  thumb: { position: 'relative', width: 60, height: 60, padding: 0, border: '2px solid transparent', borderRadius: 4, cursor: 'pointer', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'var(--ff-warm)' },
  thumbOn: { border: '2px solid var(--ff-pink)' },
  zoomCard: { position: 'fixed', zIndex: 'var(--ff-z-hover)', width: 'max-content', maxWidth: 280, pointerEvents: 'none', background: 'var(--ff-white)', border: '1px solid var(--ff-border)', borderRadius: 8, boxShadow: '0 6px 20px var(--ff-shadow-mid)', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 },
  zoomImg: { display: 'block', maxWidth: 268, maxHeight: 268, objectFit: 'contain', borderRadius: 4 },
  thumbYear: { position: 'absolute', left: 2, bottom: 0, fontSize: 11, fontWeight: 700, color: 'var(--ff-white)', textShadow: '0 0 3px var(--ff-shadow-mid)' },
  pop: { position: 'absolute', left: 12, top: 12, zIndex: 'var(--ff-z-sticky)', width: 'min(340px, calc(100% - 24px))', maxHeight: 'calc(100% - 24px)', overflowY: 'auto', background: 'var(--ff-white)', border: '1px solid var(--ff-border)', borderRadius: 12, boxShadow: '0 6px 20px var(--ff-shadow-mid)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  popGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 },
  popThumb: { position: 'relative', aspectRatio: '1', padding: 0, border: '2px solid transparent', borderRadius: 4, cursor: 'pointer', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'var(--ff-warm)' },
  tool: { position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--ff-z-sticky)', width: 'min(94%, 520px)', background: 'var(--ff-white)', border: '1px solid var(--ff-border)', borderRadius: 12, boxShadow: '0 6px 20px var(--ff-shadow-mid)', padding: '8px 12px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', fontSize: 13 },
  group: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ff-text-secondary)' },
  muted: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { ...kitChip },
  chipOn: { ...selectedOn },
  step: { ...quietBtn, width: 28, height: 28, padding: 0, fontSize: 16 },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ff-text)' },
  warn: { background: '#fff7e6', border: '1px solid #f5d28b', borderRadius: 8, padding: '8px 8px', fontSize: 12 },
  primary: { ...primaryBtn },
  btn: { ...quietBtn, padding: '6px 12px' }
}
