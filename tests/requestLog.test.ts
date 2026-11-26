import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RequestLog, slowDownWaitMs, MAX_WAIT_MS, MAX_SLOW_DOWN_RETRIES } from '../src/main/requestLog'
import { flickrHttp, requestLog } from '../src/main/flickr'

const read = (f: string): string => readFileSync(join(process.cwd(), f), 'utf8')

test('the counter counts the last hour, everything since opening, and the methods asked for most', () => {
  const log = new RequestLog()
  const t0 = 1_000_000_000_000
  log.record('https://www.flickr.com/services/rest/?method=flickr.photos.search&page=1', t0)
  log.record('https://www.flickr.com/services/rest/?method=flickr.photos.search&page=2', t0 + 1000)
  log.record('https://www.flickr.com/services/rest/?api_key=x&method=flickr.people.getInfo', t0 + 2000)
  log.record('https://www.flickr.com/other', t0 + 3000)
  const s = log.stats(t0 + 4000)
  assert.deepEqual([s.lastHour, s.sinceOpen], [4, 4])
  assert.deepEqual(s.top[0], { method: 'flickr.photos.search', count: 2 })
  assert.ok(s.top.some(t => t.method === 'other'))
  const later = log.stats(t0 + 3600 * 1000 + 1500)   // the first two are more than an hour old
  assert.deepEqual([later.lastHour, later.sinceOpen], [2, 4])
})

test('after "slow down" it waits what Flickr asks for, else 2, 4, 8 seconds, never more than a minute', () => {
  assert.equal(slowDownWaitMs(0, '5'), 5000)
  assert.equal(slowDownWaitMs(0, '0'), 0)
  assert.equal(slowDownWaitMs(0, '900'), MAX_WAIT_MS)
  assert.deepEqual([0, 1, 2].map(a => slowDownWaitMs(a)), [2000, 4000, 8000])
  assert.equal(slowDownWaitMs(1, 'soon'), 4000, 'a Retry-After that is not a number is ignored')
  assert.equal(slowDownWaitMs(20), MAX_WAIT_MS)
})

function serve(statuses: number[]): Promise<{ url: string; hits: () => number; close: () => void }> {
  let n = 0
  return new Promise(resolve => {
    const server = createServer((_q, s) => {
      const status = statuses[Math.min(n++, statuses.length - 1)]
      s.writeHead(status, { 'Content-Type': 'application/json', 'Retry-After': '0' }); s.end('{"stat":"ok"}')
    }).listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/x`, hits: () => n, close: () => server.close() }))
  })
}

test('a request Flickr answers with "slow down" is tried again and then works', async () => {
  const s = await serve([429, 429, 200])
  try {
    const before = requestLog.stats().slowDowns
    const r = await flickrHttp.get(s.url)
    assert.equal(r.status, 200)
    assert.equal(s.hits(), 3)
    assert.equal(requestLog.stats().slowDowns - before, 2)
  } finally { s.close() }
})

test('after the last try it gives up with a plain message, and other errors are not retried', async () => {
  const always = await serve([429])
  try {
    await assert.rejects(flickrHttp.get(always.url), (e: Error & { response?: { status?: number } }) => /slow down/.test(e.message) && e.response?.status === 429)
    assert.equal(always.hits(), MAX_SLOW_DOWN_RETRIES + 1)
  } finally { always.close() }
  const broken = await serve([500])
  try {
    await assert.rejects(flickrHttp.get(broken.url))
    assert.equal(broken.hits(), 1)
  } finally { broken.close() }
})

test('a request that is tried again is signed again, and a sign-out while waiting stops it', () => {
  const src = read('src/main/flickr.ts')
  assert.ok(/getOAuthHeader\(e\.config\.url/.test(src))
  assert.ok(/if \(!token \|\| typeof e\.config\.url !== 'string'\) throw err/.test(src))
})

import { FREE_BANNER_TEXT, isFreeAccount } from '../src/shared/downloadLimits'
test('the free-account banner is shown only for a known free account, once per page, and can be dismissed', () => {
  assert.ok(isFreeAccount(false) && !isFreeAccount(true) && !isFreeAccount(undefined), 'an unknown answer shows nothing')
  assert.ok(FREE_BANNER_TEXT.mine.includes('1024 px') && FREE_BANNER_TEXT.discover.includes('Creative Commons'))
  const banner = read('src/renderer/components/FreeAccountBanner.tsx')
  assert.ok(/localStorage\.setItem\(KEY\(kind\)/.test(banner) && />Dismiss</.test(banner))
  assert.ok(/<FreeAccountBanner kind="mine" isPro=\{user\.isPro\} \/>/.test(read('src/renderer/pages/MainPage.tsx')))
  assert.ok(/<FreeAccountBanner kind="discover" isPro=\{isPro\} \/>/.test(read('src/renderer/pages/DiscoverPage.tsx')))
})

test('Settings shows the request count and the main process answers for it', () => {
  assert.ok(/<RequestStatsNote \/>/.test(read('src/renderer/components/SettingsModal.tsx')))
  assert.ok(/ipcMain\.handle\('flickr:requestStats', \(\) => requestLog\.stats\(\)\)/.test(read('src/main/index.ts')))
})
