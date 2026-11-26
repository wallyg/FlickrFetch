import test from 'node:test'
import assert from 'node:assert/strict'
import { placeCard, anchorXFor, type Box, type Size } from '../src/renderer/ui/cardPlacement'

// The hover card never leaves the window (#228). Tried at every edge and corner, with cards bigger than the room and with a tiny window.

const inside = (p: Box, win: Size): boolean => p.left >= 0 && p.top >= 0 && p.left + p.width <= win.width && p.top + p.height <= win.height

test('a card with room opens below its control, centred on it', () => {
  const p = placeCard({ left: 400, top: 300, width: 40, height: 20 }, { width: 200, height: 60 }, { width: 1200, height: 800 })
  assert.equal(p.side, 'below')
  assert.equal(p.left, 420 - 100)
  assert.equal(p.top, 300 + 20 + 6)
})

test('near the bottom it opens above, and it keeps the gap to the control', () => {
  const p = placeCard({ left: 400, top: 760, width: 40, height: 20 }, { width: 200, height: 80 }, { width: 1200, height: 800 })
  assert.equal(p.side, 'above')
  assert.equal(p.top, 760 - 6 - 80)
})

test('every edge and corner of the window keeps the whole card inside it', () => {
  const win = { width: 1000, height: 700 }
  const sizes: Size[] = [{ width: 60, height: 24 }, { width: 300, height: 120 }, { width: 440, height: 400 }, { width: 2000, height: 2000 }]
  const xs = [-50, 0, 3, 120, 500, 940, 997, 1000, 1060]
  const ys = [-50, 0, 3, 120, 350, 660, 697, 700, 760]
  let tried = 0
  for (const card of sizes) for (const x of xs) for (const y of ys) for (const w of [1, 40, 400, 1000]) {
    const p = placeCard({ left: x, top: y, width: w, height: 20 }, card, win)
    assert.ok(inside(p, win), `card ${card.width}x${card.height} at anchor ${x},${y} (${w} wide) gave ${JSON.stringify(p)}`)
    tried++
  }
  assert.ok(tried > 1000)
})

test('a card bigger than the room is made smaller, with a margin on all sides', () => {
  const p = placeCard({ left: 500, top: 350, width: 20, height: 20 }, { width: 5000, height: 5000 }, { width: 1000, height: 700 })
  assert.deepEqual({ l: p.left, t: p.top, w: p.width, h: p.height }, { l: 8, t: 8, w: 984, h: 684 })
})

test('in a tiny window the card still stays inside it', () => {
  for (const win of [{ width: 20, height: 20 }, { width: 5, height: 300 }, { width: 300, height: 0 }, { width: 0, height: 0 }]) {
    for (const x of [-10, 0, 3, 10, 400]) {
      const p = placeCard({ left: x, top: x, width: 10, height: 10 }, { width: 200, height: 100 }, win)
      assert.ok(inside(p, win), `${JSON.stringify(win)} anchor ${x} gave ${JSON.stringify(p)}`)
    }
  }
})

test('a control scrolled out of the window still gets a card inside the window', () => {
  const win = { width: 800, height: 600 }
  assert.ok(inside(placeCard({ left: 100, top: -400, width: 30, height: 20 }, { width: 200, height: 80 }, win), win))
  assert.ok(inside(placeCard({ left: 100, top: 1500, width: 30, height: 20 }, { width: 200, height: 80 }, win), win))
})

test('a wide control puts the card under the pointer, kept within the control', () => {
  const wide = { left: 100, top: 50, width: 600, height: 30 }
  assert.equal(anchorXFor(wide, 250), 250)
  assert.equal(anchorXFor(wide, 20), 100)          // pointer to the left of it: the control's own edge
  assert.equal(anchorXFor(wide, 9000), 700)
  assert.equal(anchorXFor({ left: 100, top: 50, width: 80, height: 30 }, 130), undefined)   // a small control: centred on it
  assert.equal(anchorXFor(wide, null), undefined)  // from the keyboard there is no pointer
  const p = placeCard(wide, { width: 200, height: 40 }, { width: 1200, height: 800 }, anchorXFor(wide, 250))
  assert.equal(p.left, 150)
})
