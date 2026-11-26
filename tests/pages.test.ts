import test from 'node:test'
import assert from 'node:assert/strict'
import { allPages } from '../src/shared/pages'
import { batchErrorText } from '../src/shared/batchError'

test('every page is read, in order', async () => {
  const asked: number[] = []
  const got = await allPages(async page => { asked.push(page); return { items: [`a${page}`, `b${page}`], pages: 4 } })
  assert.deepEqual(asked, [1, 2, 3, 4])
  assert.equal(got.length, 8)
})
test('one page is one request, and a person with no albums gets an empty list', async () => {
  let n = 0
  assert.deepEqual(await allPages(async () => { n++; return { items: [], pages: 1 } }), [])
  assert.equal(n, 1)
})
test('a failed page stops the read and says so (nothing half-read is returned)', async () => {
  await assert.rejects(allPages(async page => { if (page === 3) throw new Error('timeout'); return { items: [page], pages: 5 } }), /timeout/)
})
test('a runaway page count is stopped', async () => {
  let n = 0
  await allPages(async () => { n++; return { items: [], pages: 1_000_000 } }, 10)
  assert.equal(n, 10)
})

test('the reason on the download bar is tidy and never empty', () => {
  assert.equal(batchErrorText('Error: Request failed with status code 500'), 'Request failed with status code 500')
  assert.equal(batchErrorText('AxiosError: timeout of 30000ms exceeded'), 'timeout of 30000ms exceeded')
  assert.equal(batchErrorText('Error: Error: two\nlines'), 'two lines')
  assert.match(batchErrorText(undefined), /Something went wrong/)
  assert.match(batchErrorText('   '), /Something went wrong/)
  assert.ok(batchErrorText('x'.repeat(500)).length <= 160)
})
