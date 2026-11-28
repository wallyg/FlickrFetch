import test from 'node:test'
import assert from 'node:assert/strict'
import { polaroidLayout, captionPlan, POL_GX, POL_GY, type TextKind } from '../src/renderer/ui/polaroid'

// The Polaroid frame of the collage (#269): cards fill the room, nothing overlaps, and no caption text touches another or leaves its card.

// The body room of each saved shape (width, height), as the dialog works it out: Square 1:1, Portrait 4:5, Story 9:16, Wide 16:9, and Auto (no height limit)
const BODIES: { name: string; cw: number; ch?: number }[] = [
  { name: 'square', cw: 968, ch: 1080 - 56 - 282 - 14 - 40 },
  { name: 'portrait', cw: 968, ch: 1350 - 56 - 282 - 14 - 40 },
  { name: 'story', cw: 968, ch: 1920 - 56 - 282 - 14 - 40 },
  { name: 'wide', cw: 1808, ch: 1080 - 56 - 282 - 14 - 40 },
  { name: 'auto', cw: 968 }
]

test('the cards always fit the room, with a gap between them, in every shape and for 1 to 12 photos', () => {
  for (const b of BODIES) for (let n = 1; n <= 12; n++) {
    const L = polaroidLayout(n, b.cw, b.ch)
    const where = `${b.name} ${n} photos: ${JSON.stringify(L)}`
    assert.ok(L.w > 0 && L.h > 0, `no card (${where})`)
    assert.ok(L.cols * L.w + (L.cols - 1) * L.gx <= b.cw + 0.5, `too wide (${where})`)
    if (b.ch !== undefined) assert.ok(L.offY >= 0 && L.offY + L.total <= b.ch + 0.5, `too tall (${where})`)
    if (L.cols > 1) assert.ok(L.gx >= POL_GX, `cards touch sideways (${where})`)
    if (L.rows > 1) assert.ok(L.gy >= POL_GY, `cards touch up and down (${where})`)
    assert.ok(L.cols * L.rows >= n, `not enough places (${where})`)
    assert.ok(L.capH / L.w >= 0.15 && L.capH / L.w <= 0.26, `caption strip is not a share of the card, so it is empty or cramped (${where})`)   // the empty white strip under the caption
    assert.ok(L.photoW > 0 && L.photoH > 0 && Math.abs(L.h - (L.pad + L.photoH + L.capH)) < 0.01, `card parts do not add up (${where})`)
  }
})

test('the cards use the room: in a fixed shape they cover a good share of it, and 6 photos in Square are well above the old size', () => {
  for (const b of BODIES.filter(x => x.ch !== undefined)) for (let n = 2; n <= 12; n++) {
    const L = polaroidLayout(n, b.cw, b.ch)
    const used = (n * L.w * L.h) / (b.cw * (b.ch as number))
    const floor = n >= 9 ? 0.25 : 0.3
    assert.ok(used >= floor, `${b.name} ${n} photos covers only ${(used * 100).toFixed(0)}% of the room`)
  }
  // Before: 6 photos in Square made cards 205 px wide, with empty strips each side. Now the three columns fill the width.
  const six = polaroidLayout(6, 968, 704)
  assert.ok(six.w > 290 && six.h > 320, JSON.stringify(six))
})

test('Auto is square photos, as wide as three to a row allow', () => {
  const L = polaroidLayout(6, 968)
  assert.equal(L.cols, 3)
  assert.ok(Math.abs(L.photoW - L.photoH) < 0.01)
  assert.ok(L.w > 280)
})

test('a single photo is one big card, and no photos is no card', () => {
  const one = polaroidLayout(1, 968, 704)
  assert.equal(one.cols * one.rows, 1)
  assert.ok(one.h > 600, JSON.stringify(one))
  assert.equal(polaroidLayout(0, 968, 704).w, 0)
})

// A deliberately wide guess at text width (more than the real fonts), so a plan that fits this fits the real thing
const wide = (text: string, size: number, kind: TextKind): number => text.length * size * (kind === 'hand' ? 0.8 : kind === 'sansBold' ? 0.66 : 0.6)

test('the caption never overlaps itself or leaves its card, at every card size and with the longest texts', () => {
  const years = ['2022', '1999']
  const agos = ['this year', '1 year ago', '12 years ago', '126 years ago']
  const links = [null, 'flic.kr/p/2o5724E', 'flic.kr/p/AKxZ8jXYZw']
  let tried = 0
  for (let w = 90; w <= 980; w += 17) for (const year of years) for (const ago of agos) for (const link of links) {
    const card = { w, pad: Math.max(8, Math.round(w * 0.045)), photoH: w - 2 * Math.max(8, Math.round(w * 0.045)), capH: Math.round(w * 0.22) }
    const cardH = card.pad + card.photoH + card.capH
    const p = captionPlan(card, year, ago, link, wide)
    const where = `w=${w} ${year} "${ago}" ${link}: ${JSON.stringify(p)}`
    const yearW = wide(year, p.yearSize, 'hand')
    const rightW = Math.max(wide(ago, p.agoSize, 'sansBold'), link ? wide(link, p.linkSize, 'sans') : 0)
    assert.ok(p.yearX >= 0 && p.yearX + yearW + 2 <= p.rightX - rightW, `year and right-hand text touch (${where})`)
    assert.ok(p.rightX <= w && p.rightX - rightW >= 0, `right-hand text leaves the card (${where})`)
    const stripTop = card.pad + card.photoH
    assert.ok(p.yearBase - p.yearSize * 0.8 >= stripTop - 1 && p.yearBase <= cardH, `year leaves the strip (${where})`)
    assert.ok(p.agoBase - p.agoSize * 0.8 >= stripTop - 1, `"ago" starts above the strip (${where})`)
    if (link) {
      assert.ok(p.agoBase + p.agoSize * 0.25 <= p.linkBase - p.linkSize * 0.75, `"ago" and the link overlap (${where})`)
      assert.ok(p.linkBase + p.linkSize * 0.25 <= cardH, `the link leaves the card (${where})`)
    } else assert.ok(p.agoBase + p.agoSize * 0.25 <= cardH, `"ago" leaves the card (${where})`)
    tried++
  }
  assert.ok(tried > 1000)
})

test('the collage header has room: the subtitle and tag lines sit well down the header, and the body starts under the rule', async () => {
  const { readFileSync } = await import('node:fs')
  const code = readFileSync('src/renderer/components/ShareDialog.tsx', 'utf8')
  assert.match(code, /HEADER_H = 282/)
  assert.match(code, /ctx\.fillText\(line1, hx, ty \+ 118\)/)
  assert.match(code, /const ruleY = pad \+ tileH \+ 62/)
  assert.ok(!/brandLeft/.test(code))
})
