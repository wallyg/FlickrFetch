import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// The colour guard (#234): the app's colours live in the brand guide (src/renderer/index.html, assets/brand/brand-tokens.md) and components use them as
// var(--ff-...). This counts the colours still typed by hand in the renderer's code, file by file, and fails when any file has MORE than its ceiling in
// tests/colour-ceiling.json. A new file starts at zero. The ceilings only go down: when a file has fewer, the test also fails, asking for the ceiling to be
// lowered so the gain is kept (run the update below). The sweep brings every number towards zero.
//
//   Lower the ceilings after a sweep:   UPDATE_COLOUR_CEILING=1 node scripts/test.mjs colourGuard
const root = resolve(process.cwd())   // npm test runs from the project folder
const SRC = join(root, 'src/renderer')
const CEILING_FILE = join(root, 'tests/colour-ceiling.json')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(name) ? [p] : []
  })
}

/** Comments are left out (they quote issue numbers such as #242), then hex colours and rgb(), rgba(), hsl(), hsla() are counted. */
export function countColours(source: string): number {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const hex = code.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g) ?? []
  const fn = code.match(/\b(?:rgb|rgba|hsl|hsla)\(/g) ?? []
  return hex.length + fn.length
}

const counts = (): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const f of files(SRC)) { const n = countColours(readFileSync(f, 'utf8')); if (n > 0) out[relative(root, f)] = n }
  return out
}
const ceiling = (): Record<string, number> => (existsSync(CEILING_FILE) ? JSON.parse(readFileSync(CEILING_FILE, 'utf8')) as Record<string, number> : {})

test('the counter sees hex and function colours and skips comments and issue numbers', () => {
  assert.equal(countColours("a: '#fff', b: '#1B2946', c: 'rgba(0,0,0,0.1)', d: '#ff008480'"), 4)
  assert.equal(countColours("// fixes #242 and #1234\nconst x = 1 /* #fff */"), 0)
  assert.equal(countColours("border: '1px solid var(--ff-border)'"), 0)
  assert.equal(countColours("const nope = '#ggg'"), 0)
})

test('no file has more hand-typed colours than its ceiling, and a file that has fewer lowers its ceiling', () => {
  const now = counts(), max = ceiling()
  if (process.env.UPDATE_COLOUR_CEILING === '1') {
    const raised = existsSync(CEILING_FILE) ? Object.keys(now).filter(f => now[f] > (max[f] ?? 0)) : []   // the very first time there is nothing to compare with
    assert.deepEqual(raised, [], 'the ceilings only go down, so a file with more colours cannot be written in')
    writeFileSync(CEILING_FILE, JSON.stringify(Object.fromEntries(Object.entries(now).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n')
    return
  }
  const more = Object.keys(now).filter(f => now[f] > (max[f] ?? 0)).map(f => `${f}: ${now[f]} (ceiling ${max[f] ?? 0})`)
  assert.deepEqual(more, [], 'New hand-typed colours. Use a var(--ff-...) token from assets/brand/brand-tokens.md instead.')
  const fewer = Object.keys(max).filter(f => (now[f] ?? 0) < max[f]).map(f => `${f}: ${now[f] ?? 0} (ceiling ${max[f]})`)
  assert.deepEqual(fewer, [], 'Fewer colours than the ceiling: lower it with  UPDATE_COLOUR_CEILING=1 node scripts/test.mjs colourGuard')
})
