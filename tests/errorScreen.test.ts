import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describeError } from '../src/renderer/ui/errorDetails'

// The error screen (#254): a screen that hits an error shows a message and a Reload button, not a blank window.
const SRC = join(resolve(process.cwd()), 'src/renderer')

test('the details to copy name the screen and the message, and stay short', () => {
  const e = new Error('Cannot read properties of undefined (reading \'public\')')
  const text = describeError(e, '\n    at OnThisDayPanel\n    at MainPage', 'the onthisday tab')
  assert.match(text, /^FlickrFetch error on the onthisday tab/)
  assert.match(text, /Cannot read properties of undefined/)
  assert.match(text, /Screens involved:\n+at OnThisDayPanel\nat MainPage/)
  const long = describeError(Object.assign(new Error('x'), { stack: Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n') }), '', 'the app')
  assert.ok(long.split('\n').length < 20)
})

test('a thrown string or an unknown value still gives a message', () => {
  assert.match(describeError('boom', '', 'the app'), /boom/)
  assert.match(describeError(undefined, '', 'the app'), /Unknown error/)
})

test('the whole app and the tab content are inside an error boundary, and the main process offers a reload when the page dies', () => {
  assert.match(readFileSync(join(SRC, 'index.tsx'), 'utf8'), /<ErrorBoundary scope="app">[\s\S]*<App \/>[\s\S]*<\/ErrorBoundary>/)
  assert.match(readFileSync(join(SRC, 'pages/MainPage.tsx'), 'utf8'), /<ErrorBoundary scope="tab" resetKey=\{view\}>/)
  assert.match(readFileSync(join(resolve(process.cwd()), 'src/main/index.ts'), 'utf8'), /'render-process-gone'/)
})
