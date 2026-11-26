import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RULE_DEPENDENT } from '../src/main/tagAudit'

const read = (f: string): string => readFileSync(join(process.cwd(), f), 'utf8')

test('the download bar shows a download that could not start, with the reason and a way to close it', () => {
  const bar = read('src/renderer/components/DownloadQueueBar.tsx')
  assert.ok(/const isError = status === 'error'/.test(bar))
  assert.ok(/batchErrorText\(progress\?\.error\)/.test(bar))
  assert.ok(/\(isDone \|\| isCancelled \|\| isError\) && !cancelling/.test(bar), 'the close button shows for it')
  assert.ok(/isError && \(\s*<button[^>]*onClick=\{handleDismiss\}>Dismiss/.test(bar), 'and so does a Dismiss button in the bar')
})

test('an album opened in Discover ignores answers meant for an album you have left', () => {
  const src = read('src/renderer/components/DiscoverPeople.tsx')
  assert.ok(/const albumReqRef = useRef\(0\)/.test(src))
  assert.equal((src.match(/req !== albumReqRef\.current\) return/g) ?? []).length, 3)
  assert.ok(/allPages\(/.test(src), 'and a person\'s albums are read page after page')
})

test('the Map photo tray ignores answers for a circle you have moved off', () => {
  const src = read('src/renderer/components/MapPanel.tsx')
  assert.ok(/moreReq\.current\+\+/.test(src))
  assert.ok(/if \(req !== moreReq\.current\) return 0/.test(src))
})

test('a planned fix for a generic word stays planned until the tag is gone, like the other rule-dependent checks', () => {
  for (const c of ['glued', 'runon', 'plural', 'possessive', 'generic'] as const) assert.ok(RULE_DEPENDENT.has(c), c)
  assert.ok(!RULE_DEPENDENT.has('typo'))
})
