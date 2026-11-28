import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// American spelling in everything a person reads: "color", "gray", "center", "neighbor" (the app is written for American English).
// Only text people see is checked: string literals and text between tags. Comments, names in the code (setCentre, mapColours) and CSS tokens (--ff-grey-100) are left alone.
// The changelog is checked too, since people read it.
const root = resolve(process.cwd())
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? (n === 'data' && dir.endsWith('main') ? [] : files(p)) : /\.tsx?$/.test(n) ? [p] : [] })

export const BRITISH = /\b(colours?|coloured|colouring|greys?|greyed|greying|greyish|favour\w*|centres?|centred|neighbour\w*|behaviour\w*|organis\w+|recognis\w+|catalogues?|analyse[sd]?|customis\w+|licenced|summaris\w+|realis\w+|minimis\w+|maximis\w+|initialis\w+|normalis\w+|prioritis\w+|categoris\w+|authoris\w+|apologis\w+)\b/i

export function britishWords(text: string): string[] {
  const t = text.replace(/--ff-[a-z0-9-]+/g, '').replace(/\bvar\([^)]*\)/g, '')
  return [...t.matchAll(new RegExp(BRITISH.source, 'gi'))].map(m => m[0])
}

const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$\n]|\\.)*)`/g
const jsxText = />\s*([^<>{}\n]*[A-Za-z][^<>{}\n]*?)\s*(?=<|\{)/g
const stripComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

test('the spelling rule itself: British spellings are caught, American ones and code names are not', () => {
  for (const bad of ['colour', 'Colours from your photos', 'a grey bar', 'greyed out', 'the centre', 'your neighbours', 'organise', 'behaviour', 'catalogue'])
    assert.ok(britishWords(bad).length > 0, bad)
  for (const ok of ['color', 'Colors from your photos', 'a gray bar', 'grayed out', 'the center', 'neighbors', 'organize', 'behavior', 'var(--ff-grey-100)', 'Color'])
    assert.deepEqual(britishWords(ok), [], ok)
})

test('nothing a person reads uses a British spelling', () => {
  const found: string[] = []
  for (const dir of ['src/renderer', 'src/main']) for (const f of files(join(root, dir))) {
    const code = stripComments(readFileSync(f, 'utf8'))
    for (const m of code.matchAll(literal)) { const s = m[1] ?? m[2] ?? m[3] ?? ''; const w = britishWords(s); if (w.length) found.push(`${relative(root, f)}: "${s.slice(0, 70)}" (${w.join(', ')})`) }
    if (f.endsWith('.tsx')) for (const m of code.matchAll(jsxText)) { const w = britishWords(m[1]); if (w.length) found.push(`${relative(root, f)}: text "${m[1].slice(0, 70)}" (${w.join(', ')})`) }
  }
  assert.deepEqual(found, [], 'Use American spelling (color, gray, center, neighbor) in text people read')
})
