import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// The one hover card (#228): what a test can check about it without a window. Where it is drawn is checked in cardPlacement.test.ts;
// how it looks and behaves under the pointer and the keyboard is in the UAT steps (docs/uat/uat-3.13.md, section H).
const root = resolve(process.cwd())
const SRC = join(root, 'src/renderer')
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [] })
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8')

test('the card is drawn in <body>, fixed, above dialogs, and is white', () => {
  const code = read('ui/HoverCard.tsx')
  assert.match(code, /createPortal\(/)
  assert.match(code, /document\.body/)
  assert.match(code, /position: 'fixed'/)
  assert.match(code, /zIndex: 'var\(--ff-z-hover\)'/)
  assert.match(code, /background: 'var\(--ff-surface\)'/)
  const html = read('index.html')
  const hover = Number(/--ff-z-hover:\s*(\d+)/.exec(html)?.[1])
  const dialog = Number(/--ff-z-dialog:\s*(\d+)/.exec(html)?.[1])
  assert.ok(hover > dialog, 'the hover card layer must be above dialogs')
})

test('the card is never drawn inside the control it explains: nothing else makes a tooltip box', () => {
  const found: string[] = []
  for (const f of files(SRC)) {
    const rel = relative(SRC, f)
    if (rel === 'ui/HoverCard.tsx') continue
    const code = readFileSync(f, 'utf8')
    if (/role="tooltip"/.test(code)) found.push(`${rel}: draws its own tooltip`)
    if (/noteBubble|sideShift|noteFit/.test(code)) found.push(`${rel}: uses the old note placement`)
  }
  assert.deepEqual(found, [])
})

test('the old second tip and its grey ? mark are gone: a tip is the card, and its mark is the one (i) icon', () => {
  assert.ok(!/export function Tooltip\b/.test(read('components/PhotoGridShared.tsx')))
  assert.ok(!/tagHint/.test(read('components/PhotoGridShared.tsx')))
  for (const f of ['ui/HoverNote.tsx', 'ui/InfoTip.tsx']) assert.match(read(f), /<Icon name="info"/, f)
})

test('the card is mounted once, at the top of the page, and listens for both title= and data-tip', () => {
  assert.match(read('index.tsx'), /<HoverCardHost \/>/)
  const host = read('ui/HoverCardHost.tsx')
  assert.match(host, /closest\('\[data-tip\],\[title\]'\)/)
  for (const ev of ['mouseover', 'mouseout', 'focusin', 'focusout', 'keydown', 'scroll']) assert.match(host, new RegExp(`'${ev}'`), `no ${ev} listener`)
  assert.match(host, /:focus-visible/)   // a mouse click that focuses a button must not leave a card behind
})

test('a tip on a control reaches the keyboard: the (i) marks can be Tabbed to', () => {
  for (const f of ['ui/HoverNote.tsx', 'ui/InfoTip.tsx']) assert.match(read(f), /tabIndex=\{0\}/, f)
})

test('a click note keeps working with its card outside it: clicks and focus inside the card do not close it', () => {
  const code = read('ui/ClickNote.tsx')
  assert.match(code, /data-hover-card/)
  assert.match(code, /inCard\(e\.target\)/)
  assert.match(code, /inCard\(e\.relatedTarget\)/)
})

test('a disabled control with a tip still gets its card: it lets the pointer through, is found by position, and keeps its title', () => {
  assert.match(read('index.html'), /\[disabled\]\[title\], \[disabled\]\[data-tip\] \{ pointer-events: none; \}/)
  assert.match(read('index.html'), /html\[data-over-disabled\]/)
  const host = read('ui/HoverCardHost.tsx')
  assert.match(host, /function disabledAt/)
  assert.match(host, /!el\.hasAttribute\('disabled'\)/)   // the title stays on it, or it could no longer be found
})

test('the On This Day peek is drawn by the one card, not by its own box', () => {
  const code = read('components/OnThisDayCard.tsx')
  assert.match(code, /<HoverCard /)
  assert.ok(!/position: 'absolute'[^}]*boxShadow/.test(code.slice(code.indexOf('peek:'), code.indexOf('peek:') + 400)))
})

test('a tip never changes the pointer: the (i) marks keep the plain arrow, like every other control with a hover tip', () => {
  const found: string[] = []
  for (const f of files(SRC)) if (/cursor:\s*['"]?help/.test(readFileSync(f, 'utf8')) || /cursor:\s*help/.test(readFileSync(f, 'utf8'))) found.push(relative(SRC, f))
  assert.deepEqual(found, [])
})
