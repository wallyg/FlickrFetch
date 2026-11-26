import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { isTopDialog, nextFocusIndex, popDialog, pushDialog } from '../src/renderer/ui/dialogStack'

// One shell for every dialog (#236): src/renderer/ui/Dialog.tsx gives the backdrop, Esc, focus and sizes; ui/CloseButton.tsx the one close mark.
const root = resolve(process.cwd())
const SRC = join(root, 'src/renderer')
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [] })

test('only the dialog on top answers Esc, and the one below takes over when it closes', () => {
  const about = pushDialog(), note = pushDialog()
  assert.equal(isTopDialog(note), true)
  assert.equal(isTopDialog(about), false)
  popDialog(note)
  assert.equal(isTopDialog(about), true)
  popDialog(about)
  assert.equal(isTopDialog(about), false)
})

test('Tab goes round inside a dialog, and Shift+Tab goes round the other way', () => {
  assert.equal(nextFocusIndex(0, 3, false), 1)
  assert.equal(nextFocusIndex(2, 3, false), 0)    // past the last: back to the first
  assert.equal(nextFocusIndex(0, 3, true), 2)     // before the first: round to the last
  assert.equal(nextFocusIndex(-1, 3, false), 0)   // focus is on the dialog itself
  assert.equal(nextFocusIndex(-1, 3, true), 2)
  assert.equal(nextFocusIndex(-1, 0, false), -1)  // nothing to focus
})

test('no screen builds its own dimmed backdrop: they use the Dialog shell (the History side panel is the one exception)', () => {
  const found: string[] = []
  for (const f of files(SRC)) {
    if (/ui\/Dialog\.tsx$/.test(f)) continue
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const m of code.matchAll(/^ {2,8}(\w+): \{([^}]*)\}/gm)) {
      if (/inset: 0/.test(m[2]) && /var\(--ff-scrim(?:-strong)?\)/.test(m[2]) && /position: '?fixed/.test(m[2])) found.push(`${relative(root, f)}: ${m[1]}`)
    }
  }
  assert.deepEqual(found, ['src/renderer/components/HistoryPanel.tsx: overlay'], 'Use <Dialog> from ui/Dialog.tsx.')
})

test('a screen that uses Dialog leaves Esc to it, and uses the shared close button', () => {
  const bad: string[] = []
  for (const f of files(SRC)) {
    if (/ui\/(Dialog|CloseButton)\.tsx$/.test(f)) continue
    const code = readFileSync(f, 'utf8')
    if (!/from '\.\.\/ui\/Dialog'/.test(code) || !/<Dialog\b/.test(code)) continue
    if (/key === 'Escape'\) \{?\s*(?:\w+\.stopPropagation\(\)\s*;?\s*)?on(?:Close|Cancel)\(\)/.test(code)) bad.push(`${relative(root, f)}: its own Esc handler`)
    if (/<button[^>]*aria-label="Close"/.test(code)) bad.push(`${relative(root, f)}: its own close button`)
  }
  assert.deepEqual(bad, [])
})
