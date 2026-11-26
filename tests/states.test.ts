import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// States, focus and fields (#232, #237). The states are written once in src/renderer/index.html; the field looks once in ui/kit.ts.
const root = resolve(process.cwd())
const SRC = join(root, 'src/renderer')
const html = readFileSync(join(SRC, 'index.html'), 'utf8')
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [] })

test('one keyboard focus ring for the whole app, strong enough to beat a control that turns its outline off', () => {
  assert.match(html, /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ff-blue\)\s*!important/)
  assert.match(html, /:focus-visible\s*\{[^}]*outline-offset:\s*2px\s*!important/)
})

test('hover, pressed and disabled looks are written once', () => {
  assert.match(html, /button\[style\*="--ff-box"\]:not\(:disabled\):hover/)
  assert.match(html, /button\[style\*="--ff-box"\]:not\(:disabled\):active/)
  const kit = readFileSync(join(SRC, 'ui/kit.ts'), 'utf8')
  for (const name of ['primaryBtn', 'quietBtn', 'chip']) assert.match(kit, new RegExp(`export const ${name}: CSSProperties = \\{\\s*\\.\\.\\.BOXED`), `${name} must carry the marker the hover wash looks for`)
  assert.match(html, /:disabled\s*\{[^}]*cursor:\s*not-allowed\s*!important/)
  assert.match(html, /button:disabled[^{]*\{[^}]*opacity:\s*0\.5/)
})

test('reduce motion switches animations and transitions off, except a spinner marked data-motion="keep"', () => {
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.01ms\s*!important[\s\S]*transition-duration:\s*0\.01ms\s*!important/)
  assert.match(html, /:not\(\[data-motion="keep"\]\)/)
  const spinner = readFileSync(join(SRC, 'components/PhotoDetail.tsx'), 'utf8')
  assert.match(spinner, /data-motion="keep"[^>]*animation: `?'?ff-spin|data-motion="keep"[\s\S]{0,300}ff-spin/)
})

test('tab buttons carry the mark that moves their focus ring inside them', () => {
  assert.match(html, /button\[style\*="--ff-tab"\]:focus-visible\s*\{[^}]*outline-offset:\s*-3px\s*!important/)
  for (const f of ['pages/MainPage.tsx', 'pages/DiscoverPage.tsx', 'components/SettingsModal.tsx', 'components/DiscoverPeople.tsx']) {
    assert.match(readFileSync(join(SRC, f), 'utf8'), /\.\.\.tabMark/, `${f}: its tab buttons need ...tabMark`)
  }
})

test('a hover note is plain text under any heading: weight, case and spacing are set on the note itself', () => {
  for (const f of ['ui/HoverCard.tsx']) {
    const code = readFileSync(join(SRC, f), 'utf8')
    assert.match(code, /fontWeight: 400/, f)
    assert.match(code, /textTransform: 'none'/, f)
    assert.match(code, /letterSpacing: 'normal'/, f)
  }
})

// A text box or select typed out in full (edge, 6 px corner, white fill) instead of spread from fieldBox / fieldCompact / selectBox / selectCompact.
// Buttons are #262, so keys ending in Btn or Button are left out, and so is anything laid out as a row (a card).
test('no new text box or select is typed out by hand', () => {
  const found: string[] = []
  for (const f of files(SRC)) {
    if (/ui\/kit\.ts$/.test(f)) continue
    for (const ln of readFileSync(f, 'utf8').split('\n')) {
      const m = /^\s*(\w+): \{ (.*) \},?\s*$/.exec(ln)
      if (!m || /(Btn|Button)$/.test(m[1]) || m[2].includes('...')) continue
      if (/border: '1px solid var\(--ff-(?:border|line-strong)\)'/.test(m[2]) && /borderRadius: '?6(?:px)?'?/.test(m[2]) && /background: 'var\(--ff-surface\)'/.test(m[2]) && /fontSize/.test(m[2]) && !/display: 'flex'/.test(m[2])) found.push(`${relative(root, f)}: ${m[1]}`)
    }
  }
  assert.deepEqual(found, [], 'Use fieldBox, fieldCompact, selectBox or selectCompact from ui/kit.ts.')
})

// Segmented switches (the pink-edged "this or that" group): one look in ui/kit.ts (segGroup, segBtn, selectedOn). A screen may adjust the padding, never retype the look.
test('no segmented switch is typed out by hand', () => {
  const found: string[] = []
  for (const f of files(SRC)) {
    if (/ui\/kit\.ts$/.test(f)) continue
    readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
      const m = /^\s*(seg\w*): \{ (.*) \},?\s*$/.exec(ln)
      if (m && !m[2].includes('...') && /border: 'none'|borderRadius/.test(m[2]) && /background:/.test(m[2])) found.push(`${relative(root, f)}:${i + 1}: ${m[1]}`)
    })
  }
  assert.deepEqual(found, [], 'spread segGroup / segBtn / selectedOn from ui/kit')
})
