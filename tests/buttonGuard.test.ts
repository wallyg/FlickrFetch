import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// The button guard (#262): a clickable thing that has a 1 px edge or the pink fill should be built from the shared looks in ui/kit.ts
// (primaryBtn, quietBtn, smallBtn, doThisBtn, doThisSmallBtn, putAsideBtn, dangerBtn, linkBtn, pillBtn, chip, selectedOn), not typed out again.
// This counts the style entries that still type one out (a boxed or pink clickable with no kit spread), file by file, and fails when a file has MORE
// than its ceiling in tests/button-ceiling.json. What is left are chips, tabs, cards, tiles and selects, which are not buttons, and a few one-offs.
// The ceilings only go down:   UPDATE_BUTTON_CEILING=1 node scripts/test.mjs buttonGuard
const root = resolve(process.cwd())
const SRC = join(root, 'src/renderer')
const CEILING_FILE = join(root, 'tests/button-ceiling.json')
const files = (dir: string, ext = /\.tsx$/): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p, ext) : ext.test(n) ? [p] : [] })
const KIT = /\.\.\.(?:primaryBtn|quietBtn|smallBtn|doThisBtn|doThisSmallBtn|putAsideBtn|dangerBtn|linkBtn|pillBtn|chip|selectedOn|fieldBox|fieldCompact|selectBox|selectCompact)\b/

/** Style entries written as `name: { ... }` that mention a pointer cursor and type out a 1 px edge or the pink fill, without a kit spread. */
export function handBuilt(source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(/^ {2,8}(\w+): \{/gm)) {
    let i = (m.index ?? 0) + m[0].length, depth = 1, q: string | null = null
    while (i < source.length && depth > 0) {
      const ch = source[i]
      if (q) { if (ch === '\\') i++; else if (ch === q) q = null } else if (ch === '\'' || ch === '"' || ch === '`') q = ch
      else if (ch === '{') depth++; else if (ch === '}') depth--
      i++
    }
    const body = source.slice((m.index ?? 0) + m[0].length, i - 1)
    if (!/cursor: *'pointer'/.test(body) || KIT.test(body)) continue
    if (/border: *'1(?:\.5)?px solid (?!transparent)/.test(body) || /background(?:Color)?: *'var\(--ff-pink-action\)'/.test(body)) out.push(m[1])
  }
  return out
}

const counts = (): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const f of files(SRC)) { const n = handBuilt(readFileSync(f, 'utf8')).length; if (n > 0) out[relative(root, f)] = n }
  return out
}
const ceiling = (): Record<string, number> => (existsSync(CEILING_FILE) ? JSON.parse(readFileSync(CEILING_FILE, 'utf8')) as Record<string, number> : {})

test('the counter sees a typed-out boxed button and skips one built from the kit', () => {
  assert.deepEqual(handBuilt("  a: { border: '1px solid var(--ff-line-strong)', cursor: 'pointer' },\n  b: { ...quietBtn, width: 10, cursor: 'pointer' },\n  c: { background: 'var(--ff-pink-action)', cursor: 'pointer' },\n  d: { border: '1px solid transparent', cursor: 'pointer' }"), ['a', 'c'])
})

test('no file types out more boxed or pink buttons than its ceiling, and a file with fewer lowers it', () => {
  const now = counts(), max = ceiling()
  if (process.env.UPDATE_BUTTON_CEILING === '1') {
    const raised = existsSync(CEILING_FILE) ? Object.keys(now).filter(f => now[f] > (max[f] ?? 0)) : []
    assert.deepEqual(raised, [], 'the ceilings only go down')
    writeFileSync(CEILING_FILE, JSON.stringify(Object.fromEntries(Object.entries(now).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n')
    return
  }
  const more = Object.keys(now).filter(f => now[f] > (max[f] ?? 0)).map(f => `${f}: ${now[f]} (ceiling ${max[f] ?? 0})`)
  assert.deepEqual(more, [], 'New hand-built boxed or pink button. Spread a look from ui/kit.ts (quietBtn, smallBtn, primaryBtn, doThisBtn, putAsideBtn, dangerBtn, linkBtn).')
  const fewer = Object.keys(max).filter(f => (now[f] ?? 0) < max[f]).map(f => `${f}: ${now[f] ?? 0} (ceiling ${max[f]})`)
  assert.deepEqual(fewer, [], 'Fewer hand-built buttons than the ceiling: lower it with  UPDATE_BUTTON_CEILING=1 node scripts/test.mjs buttonGuard')
})

// Wording (#261): Flickr's tool for editing many photos is "Flickr's organizer", and opening it is "Open ...", never "Fix ..." or "batch editor".
test('Flickr\'s organizer is called that everywhere the user reads it', () => {
  const bad: string[] = []
  const all = [...files(SRC, /\.tsx?$/), ...readdirSync(join(root, 'src/main')).filter(n => /\.ts$/.test(n)).map(n => join(root, 'src/main', n))]
  for (const f of all) {
    if (/data\/changelog\.ts$/.test(f)) continue   // the release notes are history
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const m of code.matchAll(/[Bb]atch editor|Fix (?:selected )?in Flickr/g)) bad.push(`${relative(root, f)}: ${m[0]}`)
  }
  assert.deepEqual(bad, [], 'Say "Open in Flickr\'s organizer" (see assets/brand/brand-tokens.md, Wording).')
})

// Wording (#243): "Try again" after a failure (never "Retry"), and a button says what it does (never a bare "OK" or "Confirm").
test('no button says Retry, OK or Confirm on its own', () => {
  const bad: string[] = []
  for (const f of files(SRC)) {
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const m of code.matchAll(/>\s*(?:Retry\b[^<{]*|OK|Ok|Confirm)\s*</g)) bad.push(`${relative(root, f)}: ${m[0].trim()}`)
  }
  assert.deepEqual(bad, [], 'Say "Try again", or name what the button does ("Clear records"). See assets/brand/brand-tokens.md, Wording.')
})
