import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// The type and corner scales (#231), kept by a test like the colours and the layers: Lato is bundled in 400 and 700 only, text is never smaller than
// 11 px and uses the scale 11, 12, 13, 14, 16, 18, 22, 24 (display sizes above 24 are free), and corners are 0, 4, 6, 8, 12 or 50.
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
test('text sizes are on the scale, and never below 11 px', () => assert.deepEqual(offences('fontSize', n => SIZES.has(n) || n > 24), []))
test('corner radii are on the scale', () => assert.deepEqual(offences('borderRadius', n => RADII.has(n)), []))
