import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFilename, byteLength, truncateBytes, MAX_NAME_BYTES } from '../src/main/fileNaming'
import type { FileNamingConfig, PhotoInfo } from '../src/shared/types'

// The name a photo is saved under, built from the File naming settings.
const config = (over: Partial<FileNamingConfig> = {}): FileNamingConfig => ({
  core: 'title', separator: '.', date: { position: 'off', format: 'yyyy-MM-dd' }, sequence: { position: 'off' }, customText: { position: 'off', text: '' },
  caseTransform: 'none', charSubstitution: false, sizeToken: { position: 'off' }, ...over
} as FileNamingConfig)
const info = { dateTaken: '2024-03-15 10:20:30' } as PhotoInfo
const name = (title: string, over: Partial<FileNamingConfig> = {}, id = '53123456789'): string => buildFilename(config(over), id, title, info, 7, 'original')
// The longest thing added to the name afterwards: ".jpeg.part", or "_999" for a copy, or ".jpeg.json"
const withExtras = (n: string): number => byteLength(n) + byteLength('_999.jpeg.part')

test('an ordinary title is saved as it is', () => {
  assert.equal(name('NYC Highline (2024)'), 'NYC Highline (2024)')
  assert.equal(name('Sunset: "Fire"/Sky'), 'Sunset_ _Fire__Sky')
})

test('a long title in Japanese, Chinese or emoji still makes a name the Mac accepts (255 bytes)', () => {
  for (const title of ['夕焼けの空'.repeat(40), '山水'.repeat(120), '🌅'.repeat(100), 'é'.repeat(300)]) {
    const n = name(title, { core: 'id-title', date: { position: 'prefix', format: 'yyyy-MM-dd' }, sequence: { position: 'suffix' }, customText: { position: 'suffix', text: 'Trip' } })
    assert.ok(withExtras(n) <= 255, `${title.slice(0, 4)}… is ${withExtras(n)} bytes`)
    assert.ok(n.includes('53123456789') && n.startsWith('2024-03-15') && n.endsWith('.007.Trip'), 'the date, the number, the sequence and the custom text stay; only the title is shortened')
  }
})

test('a title is never cut through the middle of an emoji', () => {
  for (let n = 1; n < 40; n++) {
    const cut = truncateBytes('a🌅b🌅c🌅', n)
    assert.equal(cut.isWellFormed(), true, `${n}`)
  }
  assert.equal(name('🌅'.repeat(100)).isWellFormed(), true)
})

test('uppercase letters that grow when capitalised (ß) are counted after the change', () => {
  const n = name('ß'.repeat(150), { caseTransform: 'uppercase' })
  assert.ok(byteLength(n) <= MAX_NAME_BYTES)
})

test('typed custom text cannot hold a path: "/" and ":" become "_", and ".." cannot leave the folder', () => {
  for (const text of ['Trip/2024', '../x', '..\\x', 'a:b', '../../etc/passwd']) {
    const n = name('Beach', { customText: { position: 'prefix', text } })
    assert.ok(!/[/\\:]/.test(n), `${text} → ${n}`)
  }
  assert.ok(!name('Beach', { customText: { position: 'prefix', text: '../x' } }).startsWith('.'))
  assert.equal(name('Beach', { customText: { position: 'suffix', text: 'Trip/2024' } }), 'Beach.Trip_2024')
})

test('a name never starts with a dot (the file would be hidden) and is never empty', () => {
  assert.equal(name('..'), '_')   // the dots are replaced, so the name is no hidden file
  assert.ok(!name('.hidden').startsWith('.'))
  assert.equal(name('   ', {}, '99'), '99')
  assert.equal(name('', {}, '99'), '99')
})

test('the sequence, date and size settings still show up', () => {
  const n = name('Beach', { date: { position: 'prefix', format: 'yyyy-MM-dd' }, sequence: { position: 'prefix' }, sizeToken: { position: 'suffix' } })
  assert.equal(n, '2024-03-15.007.Beach.o')
})

test('every separator Settings offers is used as it is (the | stays |), and a / or : can never get into a name', () => {
  for (const sep of ['.', '-', '_', ' ', '|'] as const) {
    assert.equal(name('NYC Highline', { separator: sep, sequence: { position: 'prefix' } }), `007${sep}NYC Highline`, `separator "${sep}"`)
  }
  assert.equal(name('A', { separator: '/' as never, sequence: { position: 'prefix' } }), '007_A')
  assert.equal(name('A', { separator: ':' as never, sequence: { position: 'prefix' } }), '007_A')
})
