import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// A chosen look is a whole border, never a colour on its own (borderColor, borderBottomColor...). React sets the pieces one by one, and when the colour is
// taken away again it clears the colour for all four sides, which then fall back to the text colour: a tile or button that was chosen once keeps a dark edge.
// Found in 3.15 testing (the collage window kept several dark tiles). The one place left is a loading spinner whose top edge is a different colour from its
// other three, which never switches off.
const root = resolve(process.cwd())
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [] })

test('no style sets a border colour on its own', () => {
  const found: string[] = []
  for (const f of files(join(root, 'src/renderer'))) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '')
      if (/\bborder(?:Top|Bottom|Left|Right)?Color\s*:/.test(code) && !code.includes('data-motion')) found.push(`${relative(root, f)}:${i + 1}`)
    })
  }
  assert.deepEqual(found, [], 'Write the whole border instead, for example border: \'1px solid var(--ff-pink)\'')
})
