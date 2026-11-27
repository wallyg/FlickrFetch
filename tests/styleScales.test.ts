import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// The type and corner scales (#231), kept by a test like the colours and the layers: Lato is bundled in 400 and 700 only, text is never smaller than
// 11 px and uses the scale 11, 12, 13, 14, 16, 18, 22, 24 (display sizes above 24 are free), and corners are 0, 4, 6, 8, 12 or 50.
// What is checked: a style written as fontWeight / fontSize / borderRadius with one number (quoted or not), a weight written as a word, a size in
// em, rem, pt or %, and fontWeight as a JSX attribute (fontWeight="600"). Not checked: SVG text sizes (they are in the drawing's units), the font shorthand, values worked out in code, and the canvas fonts of the collage.
const root = resolve(process.cwd())
const SRC = join(root, 'src/renderer')
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [] })
const WEIGHTS = new Set([400, 700]), SIZES = new Set([11, 12, 13, 14, 16, 18, 22, 24]), RADII = new Set([0, 4, 6, 8, 12, 50])

function offences(key: string, ok: (n: number) => boolean): string[] {
  const out: string[] = []
  const re = new RegExp(`\\b${key}: *'?(\\d+(?:\\.\\d+)?)(?:px)?'?(?=\\s*[,}])`, 'g')   // a single value only: '3px 3px 0 0' is a shape of its own
  for (const f of files(SRC)) {
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const m of code.matchAll(re)) if (!ok(Number(m[1]))) out.push(`${relative(root, f)}: ${key} ${m[1]}`)
  }
  return out
}

test('font weights are only 400 and 700', () => assert.deepEqual(offences('fontWeight', n => WEIGHTS.has(n)), []))

// Words and units the number check cannot see
function matches(re: RegExp): string[] {
  const out: string[] = []
  for (const f of files(SRC)) {
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const m of code.matchAll(re)) out.push(`${relative(root, f)}: ${m[0]}`)
  }
  return out
}
test('no weight is written as a word, and no text size is written in em, rem, pt or %', () => {
  assert.deepEqual(matches(/\bfontWeight: *'(?:bold|bolder|lighter|semibold|medium)'/g), [], 'Use 400 or 700.')
  assert.deepEqual(matches(/\bfontSize: *'\d+(?:\.\d+)?(?:em|rem|pt|%)'/g), [], 'Use a px size from the scale.')
})
test('a font weight written as a JSX attribute is 400 or 700 (SVG text sizes are in the drawing\'s own units, so sizes are not checked there)', () => {
  const bad = matches(/\bfontWeight="(\d+)"/g).filter(m => !WEIGHTS.has(Number(/"(\d+)"/.exec(m)![1])))
  assert.deepEqual(bad, [])
})
test('text sizes are on the scale, and never below 11 px', () => assert.deepEqual(offences('fontSize', n => SIZES.has(n) || n > 24), []))
test('corner radii are on the scale', () => assert.deepEqual(offences('borderRadius', n => RADII.has(n)), []))

// The icon guard (#229): icons come from ui/Icon.tsx, never from an emoji or a plain character (the cross, tick, up-right arrow, warning sign ...).
// The collage picture (ShareDialog.tsx) draws on a canvas and is left alone, and arrows inside text (a tooltip, a saved batch name) stay text.
test('no emoji or symbol characters stand in for icons', () => {
  const found: string[] = []
  for (const f of files(SRC)) {
    if (/ShareDialog\.tsx$|data\/changelog\.ts$/.test(f)) continue   // the release notes are history, written in words
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const m of code.matchAll(/[✕✗✓⚠↗↳↻⬆▾▸▴▼▲▶◀ⓘ\u{1F300}-\u{1FAFF}]/gu)) found.push(`${relative(root, f)}: ${m[0]}`)
  }
  assert.deepEqual(found, [], 'Use <Icon name="..." /> from src/renderer/ui/Icon.tsx.')
})

// No italics (#272): the app has no italic style of its own. A note is plain text in the secondary colour. (A Flickr description keeps the italics its
// author wrote, drawn by DescriptionView with <em>, so the italic font file stays.)
test('no style sets italic text', () => assert.deepEqual(matches(/\bfontStyle: *'italic'/g), [], 'Use plain text; say it in words, not in slant.'))

// One chip family (#272): a pill (rounded 12 or less, named chip, selChip, variantChip ...) is spread from the kit looks in ui/kit.ts (chip, chipLabel,
// chipRemovable, chipCount), never typed out again. A chip on a dark bar (FineReasonHost) is built from the quiet button and is allowed.
test('no screen types out its own chip: they all spread a look from ui/kit.ts', () => {
  const bad: string[] = []
  for (const f of files(SRC)) {
    if (/ui\/kit\.ts$/.test(f)) continue
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const m of code.matchAll(/^ {2,8}(\w*[cC]hip\w*): \{([^}]*)\}/gm)) {
      if (/^(chipOn|chipActive|chipN|chipCount|chipRow|chipX|chips|trayChips)$/.test(m[1])) continue
      if (/borderRadius/.test(m[2]) && !/\.\.\.(?:kitChip|chipLabel|chipRemovable|chip|chipBase|quietBtn)\b/.test(m[2])) bad.push(`${relative(root, f)}: ${m[1]}`)
    }
  }
  assert.deepEqual(bad, [], 'Spread chip, chipLabel or chipRemovable from ui/kit.ts.')
})
