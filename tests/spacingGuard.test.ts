import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { SPACING_SCALE, SPACING_TOP } from '../src/renderer/ui/space'

// The spacing guard (#241): every padding, margin and gap written in a style is on the scale in ui/space.ts (0, 2, 4, 6, 8, 12, 16, 24, 32), or above 32
// (a layout dimension, free). A negative margin counts by its size. This counts the sizes still off the scale, file by file, and fails when a file has
// MORE than its ceiling in tests/spacing-ceiling.json, or fewer (so the ceiling is lowered). The ceilings only go down:
//   UPDATE_SPACING_CEILING=1 node scripts/test.mjs spacingGuard
// Not checked: values worked out in code, calc(), var(), percentages, auto, em/rem, and a number inside a template string.
const root = resolve(process.cwd())
const SRC = join(root, 'src/renderer')
const CEILING_FILE = join(root, 'tests/spacing-ceiling.json')
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [] })
const ON = new Set<number>(SPACING_SCALE)

const PROP = /\b(?:padding|margin|gap|rowGap|columnGap|padding(?:Top|Right|Bottom|Left|Block|Inline)|margin(?:Top|Right|Bottom|Left|Block|Inline)):\s*(?:'([^']*)'|"([^"]*)"|(-?\d+(?:\.\d+)?))\s*(?=[,}\n])/g

/** The sizes in a source that are off the scale (as written, e.g. "10" or "7"). */
export function offScale(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const out: string[] = []
  for (const m of code.matchAll(PROP)) {
    const value = m[1] ?? m[2] ?? m[3]
    if (/calc|var\(|%|auto|em|vh|vw|\$\{/.test(value)) continue
    for (const part of value.trim().split(/\s+/)) {
      const n = Math.abs(Number(part.replace(/px$/, '')))
      if (!Number.isFinite(n)) continue
      if (n > SPACING_TOP || ON.has(n)) continue
      out.push(String(n))
    }
  }
  return out
}

const counts = (): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const f of files(SRC)) { const n = offScale(readFileSync(f, 'utf8')).length; if (n > 0) out[relative(root, f)] = n }
  return out
}
const ceiling = (): Record<string, number> => (existsSync(CEILING_FILE) ? JSON.parse(readFileSync(CEILING_FILE, 'utf8')) as Record<string, number> : {})

test('the counter sees a size off the scale, in a number, a pair and a negative, and leaves the scale, big spaces and computed sizes alone', () => {
  assert.deepEqual(offScale("a: { padding: 10, margin: '5px 8px', gap: 6, marginTop: -3 }"), ['10', '5', '3'])
  assert.deepEqual(offScale("a: { padding: '0 24px', margin: 48, gap: 'calc(100% - 7px)', width: 11, marginLeft: -20 }"), ['20'])
  assert.deepEqual(offScale("a: { padding: '7px 0', rowGap: 14, paddingBlock: 9 }"), ['7', '14', '9'])
  assert.deepEqual(offScale("// padding: 11\n  a: { padding: 8 } /* margin: 13 */"), [])
})

test('no file has more sizes off the spacing scale than its ceiling, and a file with fewer lowers it', () => {
  const now = counts(), max = ceiling()
  if (process.env.UPDATE_SPACING_CEILING === '1') {
    const raised = existsSync(CEILING_FILE) ? Object.keys(now).filter(f => now[f] > (max[f] ?? 0)) : []
    assert.deepEqual(raised, [], 'the ceilings only go down')
    writeFileSync(CEILING_FILE, JSON.stringify(Object.fromEntries(Object.entries(now).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n')
    return
  }
  const more = Object.keys(now).filter(f => now[f] > (max[f] ?? 0)).map(f => `${f}: ${now[f]} (ceiling ${max[f] ?? 0})`)
  assert.deepEqual(more, [], 'A padding, margin or gap off the spacing scale. Use 0, 2, 4, 6, 8, 12, 16, 24 or 32 (src/renderer/ui/space.ts).')
  const fewer = Object.keys(max).filter(f => (now[f] ?? 0) < max[f]).map(f => `${f}: ${now[f] ?? 0} (ceiling ${max[f]})`)
  assert.deepEqual(fewer, [], 'Fewer sizes off the scale than the ceiling: lower it with  UPDATE_SPACING_CEILING=1 node scripts/test.mjs spacingGuard')
})
