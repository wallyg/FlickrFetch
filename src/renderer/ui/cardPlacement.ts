// Where the hover card goes (#228). One plain function, so a test can try every edge and corner of a window.
// The card opens below what it explains, or above when there is more room there, centred on it (or on `anchorX`, e.g. the pointer, for a very wide
// control), and is then moved sideways and up or down just enough to sit inside the window with a margin all round. A card that is bigger than the
// window is made smaller (it scrolls); it never leaves the window.

export interface Box { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }
export interface Placement extends Box { side: 'below' | 'above' }

export const CARD_GAP = 6       // between the control and the card
export const CARD_MARGIN = 8    // between the card and the window edge

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(n, hi))

export function placeCard(anchor: Box, card: Size, win: Size, anchorX?: number, gap = CARD_GAP, margin = CARD_MARGIN): Placement {
  const mx = Math.min(margin, Math.max(0, win.width) / 2)
  const my = Math.min(margin, Math.max(0, win.height) / 2)
  const width = Math.max(0, Math.min(card.width, win.width - 2 * mx))
  const height = Math.max(0, Math.min(card.height, win.height - 2 * my))

  const roomBelow = win.height - my - (anchor.top + anchor.height + gap)
  const roomAbove = anchor.top - gap - my
  const side: 'below' | 'above' = height <= roomBelow ? 'below' : height <= roomAbove ? 'above' : roomAbove > roomBelow ? 'above' : 'below'
  const wantTop = side === 'below' ? anchor.top + anchor.height + gap : anchor.top - gap - height
  const top = clamp(wantTop, my, win.height - my - height)

  const centre = Number.isFinite(anchorX) ? (anchorX as number) : anchor.left + anchor.width / 2
  const left = clamp(centre - width / 2, mx, win.width - mx - width)
  return { left, top, width, height, side }
}

/** For a wide control (a row of tabs, a long button) the card sits under the pointer rather than far away at the middle of it. */
export function anchorXFor(anchor: Box, pointerX: number | null | undefined): number | undefined {
  if (pointerX == null || !Number.isFinite(pointerX) || anchor.width <= 160) return undefined
  return clamp(pointerX, anchor.left, anchor.left + anchor.width)
}
