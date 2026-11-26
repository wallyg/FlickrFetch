import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { accountDbFile, LEGACY_DB, OWNER_NOTE } from '../src/main/accountDb'

const read = (f: string): string => readFileSync(join(process.cwd(), f), 'utf8')
const folder = (): string => mkdtempSync(join(tmpdir(), 'ff-acct-'))

test('the first account to sign in adopts the existing database and is noted as its owner', () => {
  const d = folder()
  try {
    assert.equal(accountDbFile(d, '111@N00'), join(d, LEGACY_DB))
    assert.equal(readFileSync(join(d, OWNER_NOTE), 'utf-8'), '111@N00')
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('signing back in as the same account finds its records again; another account gets a file of its own', () => {
  const d = folder()
  try {
    accountDbFile(d, '111@N00')
    assert.equal(accountDbFile(d, '111@N00'), join(d, LEGACY_DB))
    const other = accountDbFile(d, '222@N00')
    assert.notEqual(other, join(d, LEGACY_DB))
    assert.equal(other, join(d, 'flickrfetch-222_N00.db'))
    assert.equal(accountDbFile(d, '222@N00'), other, 'and the second account finds its own file again')
    assert.equal(accountDbFile(d, '111@N00'), join(d, LEGACY_DB), 'the first account still has the original')
    assert.equal(readFileSync(join(d, OWNER_NOTE), 'utf-8'), '111@N00', 'the owner note does not change hands')
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('a file name made from an account id holds only safe characters', () => {
  const d = folder()
  try {
    accountDbFile(d, 'a')
    const f = accountDbFile(d, '../x/y z@N01')
    assert.ok(f.startsWith(d) && !f.slice(d.length + 1).includes('/'), f)
    assert.ok(/^flickrfetch-[A-Za-z0-9_-]+\.db$/.test(f.slice(d.length + 1)))
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('when the note cannot be written the account still gets the original file, as before', () => {
  const missing = join(tmpdir(), 'ff-acct-missing-' + Date.now())
  assert.equal(accountDbFile(missing, '111@N00'), join(missing, LEGACY_DB))
  assert.ok(!existsSync(missing))
})

test('the app opens an account\'s database after sign-in, and stops its work and closes it before sign-out clears the sign-in', () => {
  const src = read('src/main/index.ts')
  assert.ok(/const signedIn = loadToken\(\)\s*\n\s*if \(signedIn\) openAccountDatabase\(signedIn\.nsid\)/.test(src), 'at launch only when someone is signed in')
  assert.ok(/openAccountDatabase\(tokenData\.nsid\)/.test(src), 'after a successful sign-in')
  assert.equal((src.match(/await endAccountSession\(\)\s*\n\s*clearToken\(\)/g) ?? []).length, 2, 'sign out and a taken-back sign-in')
  const end = src.slice(src.indexOf('async function endAccountSession'), src.indexOf('// Step 1: Get a request token'))
  assert.ok(end.indexOf('running?.abort()') < end.indexOf('await stopTagScan()') && end.indexOf('await stopTagScan()') < end.indexOf('closeDatabase()'), 'downloads, then the scan, then the database')
  const db = read('src/main/database.ts')
  assert.ok(/export function openDatabase\(nsid: string\): void \{\s*closeDatabase\(\)/.test(db))
  assert.ok(/dbGeneration\(\)/.test(read('src/main/dateViews.ts')), 'a cached day summary is never reused across accounts')
})

test('signing out also forgets the Health Check front page the screen was holding', () => {
  assert.ok(/forgetOverview\(\)/.test(read('src/renderer/App.tsx')))
})

test('every answer kept from one account\'s database is forgotten when another account\'s opens', () => {
  const db = read('src/main/database.ts')
  assert.ok(/export function onDatabaseChange/.test(db) && /generation\+\+\s*\n\s*forgetAll\(\)/.test(db) && /db = null\s*\n\s*forgetAll\(\)/.test(db), 'forgotten when a database opens and when it closes')
  for (const [file, name] of [['albumFit', 'cache = null'], ['locationHints', 'cached = null'], ['mapPoints', 'cache = null'], ['tagAudit', 'baseCache = null']] as const) {
    assert.ok(new RegExp(`onDatabaseChange\\(\\(\\) => \\{[^}]*${name}`).test(read(`src/main/${file}.ts`)), `${file} registers its cache`)
  }
  assert.ok(/\$\{dbGeneration\(\)\}\|/.test(read('src/main/mapPoints.ts')), 'the map\'s answers are keyed by the database too')
})

import { openDatabase, closeDatabase, writePhotoRecord, getPhotoRecord, getDb, dbGeneration } from '../src/main/database'
test('two accounts on one computer: each sees only its own download records, and signing back in finds them again', () => {
  openDatabase('first@N00')
  writePhotoRecord('photo-1', 5, 'Mine')
  assert.ok(getPhotoRecord('photo-1'))
  const g1 = dbGeneration()
  openDatabase('second@N00')                      // a different account signs in
  assert.ok(dbGeneration() > g1)
  assert.equal(getPhotoRecord('photo-1'), null, 'the first account\'s records are not shown to the second')
  writePhotoRecord('photo-2', 6, 'Theirs')
  openDatabase('first@N00')                       // the first account signs back in
  assert.ok(getPhotoRecord('photo-1'), 'its own record is back')
  assert.equal(getPhotoRecord('photo-2'), null, 'and the second account\'s is not there')
  closeDatabase()
  assert.equal(getDb(), null, 'signed out: no database is open')
})
