// The Polaroid frame of the On This Day collage (#269): how big the cards are, where they go, and how the caption fits on one. Plain functions, so a test
// can try every shape with the longest captions. Everything on a card is a share of its width, so a small card has a small caption, never a crowded one.

export const POL_GX = 28          // least gap between cards, sideways
export const POL_GY = 34          // and up and down (room for the slight tilt and the shadow)
const GAP_MAX = 3                 // the gaps may grow to this many times the least, to use up spare room
const ASPECT_MIN = 1.0, ASPECT_MAX = 1.5   // the photo window is square to 3:2 wide; spare height is not turned into a tall thin window

export const polPad = (w: number): number => Math.max(8, Math.round(w * 0.045))     // white edge round the photo
export const polCap = (w: number): number => Math.round(w * 0.22)                   // the caption strip under it

export interface PolLayout {
  cols: number; rows: number
  w: number; h: number                      // one card
  pad: number; photoW: number; photoH: number; capH: number
  gx: number; gy: number                    // gaps between cards
  offY: number                              // where the first row starts below the header (a fixed shape centres the cards)
  total: number                             // height of all the rows
}

// The card for a width: a square photo window (Auto), or, in a fixed shape, a window that takes the height there is, within limits.
function cardFor(w: number, cellH?: number): { w: number; h: number; pad: number; photoW: number; photoH: number; capH: number } {
  const pad = polPad(w), capH = polCap(w), photoW = w - 2 * pad
  const photoH = cellH === undefined ? photoW : Math.min(photoW / ASPECT_MIN, Math.max(photoW / ASPECT_MAX, cellH - pad - capH))
  return { w, h: pad + photoH + capH, pad, photoW, photoH, capH }
}

/** `n` cards in a body `cw` wide; `ch` is the height there is in a fixed shape (undefined for Auto, which has no limit). */
export function polaroidLayout(n: number, cw: number, ch?: number): PolLayout {
  const empty: PolLayout = { cols: 1, rows: 1, w: 0, h: 0, pad: 0, photoW: 0, photoH: 0, capH: 0, gx: POL_GX, gy: POL_GY, offY: 0, total: 0 }
  if (n <= 0 || cw <= 0) return empty
  const options = ch === undefined ? [n === 1 ? 1 : n <= 4 ? 2 : 3] : Array.from({ length: n }, (_, i) => i + 1)
  let best = empty, bestArea = 0
  for (const cols of options) {
    const rows = Math.ceil(n / cols)
    let w = (cw - POL_GX * (cols - 1)) / cols
    let card = cardFor(w)
    if (ch !== undefined) {
      const cellH = (ch - POL_GY * (rows - 1)) / rows
      // Narrow the card until its shortest form fits the height
      for (let i = 0; i < 400 && polPad(w) + polCap(w) + (w - 2 * polPad(w)) / ASPECT_MAX > cellH && w > 10; i++) w *= 0.99
      card = cardFor(w, cellH)
      if (card.h > cellH + 0.5) continue
    }
    if (card.w <= 0) continue
    const area = card.w * card.h
    if (area > bestArea + 0.5) {
      const gx = cols > 1 ? Math.min(POL_GX * GAP_MAX, Math.max(POL_GX, (cw - cols * card.w) / (cols - 1))) : POL_GX
      const gy = ch !== undefined && rows > 1 ? Math.min(POL_GY * GAP_MAX, Math.max(POL_GY, (ch - rows * card.h) / (rows - 1))) : POL_GY
      const total = rows * card.h + gy * (rows - 1)
      best = { cols, rows, ...card, gx, gy, offY: ch !== undefined ? Math.max(0, (ch - total) / 2) : 0, total }
      bestArea = area
    }
  }
  return best
}

// ── the caption ──────────────────────────────────────────────────────────────

export type TextKind = 'hand' | 'sans' | 'sansBold'
export interface CaptionPlan {
  yearSize: number; agoSize: number; linkSize: number          // 0 = not drawn
  yearX: number; yearBase: number                              // left edge and baseline of the year (card coordinates)
  rightX: number; agoBase: number; linkBase: number            // right edge and baselines of the other two lines
}

/**
 * Where the caption's three texts go on a card, sized so that none can touch another or leave the card. `measure(text, sizePx, kind)` gives a text's width;
 * the dialog passes the canvas, a test passes a deliberately wide guess. Start at the natural sizes (shares of the card width) and shrink all three together
 * until the year and the right-hand block fit side by side with a gap, and both fit the strip's height.
 */
export function captionPlan(card: { w: number; pad: number; photoH: number; capH: number }, year: string, ago: string, link: string | null, measure: (text: string, size: number, kind: TextKind) => number): CaptionPlan {
  const inset = card.pad * 1.4
  const left = inset, right = card.w - inset
  const top = card.pad + card.photoH            // the strip starts under the photo
  const room = right - left, gap = card.w * 0.04
  let f = 1
  const sizes = (): { y: number; a: number; l: number } => ({ y: card.w * 0.16 * f, a: card.w * 0.078 * f, l: link ? card.w * 0.056 * f : 0 })
  for (let i = 0; i < 60; i++, f *= 0.94) {
    const s = sizes()
    const rightW = Math.max(measure(ago, s.a, 'sansBold'), link ? measure(link, s.l, 'sans') : 0)
    const blockH = s.a * 1.15 + (link ? s.l * 1.3 : 0)
    if (measure(year, s.y, 'hand') + gap + rightW <= room && blockH <= card.capH * 0.88 && s.y * 0.9 <= card.capH * 0.88) break
  }
  const s = sizes()
  const blockH = s.a * 1.15 + (link ? s.l * 1.3 : 0)
  const blockTop = top + (card.capH - blockH) / 2
  return {
    yearSize: s.y, agoSize: s.a, linkSize: s.l,
    yearX: left, yearBase: top + (card.capH + s.y * 0.55) / 2,
    rightX: right, agoBase: blockTop + s.a * 0.95, linkBase: blockTop + s.a * 1.15 + s.l * 0.95
  }
}
