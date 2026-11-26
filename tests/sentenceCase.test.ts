import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// Sentence case for every label, button and heading (brand-tokens.md, Wording): "Clear selection", "Download all", "File naming", not "Clear Selection".
// A label is a whole string (or a piece of screen text) of two or more words that all start with a capital. Names of things are the exception.
// The changelog is left alone: it describes old versions and quotes the old labels.
const root = resolve(process.cwd())
const SRC = join(root, 'src/renderer')
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [] })

// Real names: features, licences and the like
export const NAMES = new Set([
  'On This Day', 'Health Check', 'Album Checks', 'Smart Download', 'My Flickr', 'Creative Commons', 'All Rights Reserved', 'Public Domain',
  'The Problem FlickrFetch Solves', 'US Government', 'Eiffel Tower', 'New York', 'Amusement Park', 'Wally Gobetz'
])

const PROPER = new Set(['Flickr', 'Photostream', 'Discover', 'Explore', 'Finder', 'Mac', 'Pro', 'Photos', 'Videos'])

/** Is this text a Title Case label: two or more words, all starting with a capital, and a word after the first that is not a name. */
export function isTitleCaseLabel(text: string): boolean {
  const t = text.trim()
  if (NAMES.has(t)) return false
  const words = t.split(/\s+/)
  if (words.length < 2 || words.length > 6) return false
  if (!words.every(w => /^[A-Z]/.test(w))) return false
  // After the first word, any ordinary capitalised word makes it Title Case (a capital on a name like Flickr is correct)
  return words.slice(1).some(w => /^[A-Z][a-z]+[.,:;!?…]?$/.test(w) && !PROPER.has(w.replace(/[.,:;!?…]$/, '')))
}

const literal = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n$]*)`/g
const jsxText = /(?:>|\/>)\s*([A-Z][A-Za-z']*(?: [A-Za-z][A-Za-z']*)+?)\s*(?=[<({])/g

test('the label rule itself: what counts as Title Case and what does not', () => {
  for (const bad of ['Clear Selection', 'Download All', 'File Naming', 'Connect Flickr Account', 'Photo Page URL', 'Download Never Downloaded']) assert.equal(isTitleCaseLabel(bad), true, bad)
  for (const ok of ['Clear selection', 'Download all', 'Flickr photo ID', 'On This Day', 'Health Check', 'Album Checks', 'Photo', 'FlickrFetch', 'Open in Flickr\'s organizer', 'Shown in My Flickr', 'ID URL', 'Opening Flickr…', 'Open Finder'])
    assert.equal(isTitleCaseLabel(ok), false, ok)
})

test('no label, button or heading is in Title Case', () => {
  const found: string[] = []
  for (const f of files(SRC)) {
    if (/data\/changelog\.ts$/.test(f)) continue
    readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
      const s = ln.trim()
      if (s.startsWith('//') || s.startsWith('*') || /console\.|^import |font/i.test(ln)) return
      for (const re of [literal, jsxText]) {
        re.lastIndex = 0
        for (let m = re.exec(ln); m; m = re.exec(ln)) {
          const text = m[1] ?? m[2] ?? m[3] ?? ''
          if (isTitleCaseLabel(text)) found.push(`${relative(root, f)}:${i + 1}: ${text}`)
        }
      }
    })
  }
  assert.deepEqual(found, [], 'Use sentence case (only the first word, and names, start with a capital)')
})
