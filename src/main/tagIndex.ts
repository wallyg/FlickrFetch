import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { FLICKR_API_KEY } from './config'
import { createHash } from 'crypto'
import { loadToken } from './auth'
import { signedGet, clearTagSearchMemory } from './flickr'
import { getDb } from './database'
import type {
  FlickrTokenData, TagIndexStatus, TagScanProgress, TagListQuery, TagListPage, TagRow, TagLetterGroup
} from '../shared/types'

// Local tag index for the Tags tab.
// Flickr gives no tag counts, so we read each photo's tags once (500 photos per request,
// about a minute for 70,000 photos) and keep them in the local database. Browsing, filtering
// and counting then run locally. Read-only: nothing is changed on Flickr.

const FLICKR_API_BASE = 'https://www.flickr.com/services/rest/'
const PER_PAGE = 500
const REFRESH_MARGIN_MS = 60 * 60 * 1000   // look back an extra hour to cover clock differences

let scanning = false
let cancelRequested = false
let schemaReady: Database.Database | null = null

interface RawPhoto {
  id: string; tags?: string; lastupdate?: string
  title?: string; description?: { _content?: string } | string
  latitude?: number | string; longitude?: number | string
  url_q?: string; datetaken?: string
}

// One row per photo with what the Health report needs (also created by photoHealth.ts, so it lives here once)
export const PHOTO_META_DDL = `
  CREATE TABLE IF NOT EXISTS photo_meta (
    photo_id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    has_description INTEGER NOT NULL DEFAULT 0,
    has_tags INTEGER NOT NULL DEFAULT 0,
    has_location INTEGER NOT NULL DEFAULT 0,
    thumb_url TEXT NOT NULL DEFAULT '',
    date_taken TEXT NOT NULL DEFAULT ''
  );
`

// What each scan asks Flickr to include with every photo
const SCAN_EXTRAS = 'tags,last_update,description,geo,url_q,date_taken'

// ── Schema and small helpers ─────────────────────────────────────────────────

function requireDb(): Database.Database {
  const db = getDb()
  if (!db) throw new Error('Database is not open')
  if (schemaReady !== db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tag_index_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tag_names (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        photo_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS tag_raw (
        tag_id INTEGER NOT NULL,
        raw TEXT NOT NULL,
        raw_lower TEXT NOT NULL,
        PRIMARY KEY (tag_id, raw)
      ) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS tag_photo (
        photo_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (photo_id, tag_id)
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS idx_tag_photo_tag ON tag_photo(tag_id);
      ${PHOTO_META_DDL}
      CREATE TABLE IF NOT EXISTS tag_indexed_photo (
        photo_id TEXT PRIMARY KEY,
        last_update INTEGER NOT NULL,
        scan_id INTEGER NOT NULL
      );
    `)
    // Older copies of the table have no 'display' column
    const cols = db.prepare('PRAGMA table_info(tag_names)').all() as { name: string }[]
    if (!cols.some(c => c.name === 'display')) db.exec('ALTER TABLE tag_names ADD COLUMN display TEXT')
    schemaReady = db
  }
  return db
}

function getMeta(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM tag_index_meta WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : null
}

function setMeta(db: Database.Database, key: string, value: string | number): void {
  db.prepare('INSERT INTO tag_index_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value))
}

function metaNumber(db: Database.Database, key: string): number | null {
  const v = getMeta(db, key)
  return v === null ? null : Number(v)
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

// ── Flickr calls (read-only, signed with the user's stored sign-in) ──────────

async function flickrCall(tokenData: FlickrTokenData, method: string, params: Record<string, string | number>): Promise<Record<string, unknown>> {
  const query = Object.entries({ method, api_key: FLICKR_API_KEY, format: 'json', nojsoncallback: 1, ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  const url = `${FLICKR_API_BASE}?${query}`
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await signedGet(url, tokenData)   // signed fresh on each attempt
      const data = res.data as Record<string, unknown>
      if (data.stat !== 'ok') throw new Error(String(data.message ?? 'Flickr returned an error'))
      return data
    } catch (err) {
      lastError = err
      if (attempt < 2) await sleep(1000 * (attempt + 1))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Flickr request failed')
}

interface PhotosPage { photos: RawPhoto[]; pages: number; total: number }

function parsePhotosPage(data: Record<string, unknown>): PhotosPage {
  const p = (data.photos ?? {}) as { photo?: RawPhoto[]; pages?: number | string; total?: number | string }
  return { photos: p.photo ?? [], pages: Number(p.pages ?? 1), total: Number(p.total ?? 0) }
}

// ── Writing photos into the index ────────────────────────────────────────────

function indexPhotos(db: Database.Database, photos: RawPhoto[], scanId: number, tagIds: Map<string, number>): void {
  const insertTag = db.prepare('INSERT INTO tag_names (name) VALUES (?)')
  const deleteLinks = db.prepare('DELETE FROM tag_photo WHERE photo_id = ?')
  const upsertPhoto = db.prepare(`
    INSERT INTO tag_indexed_photo (photo_id, last_update, scan_id) VALUES (?, ?, ?)
    ON CONFLICT(photo_id) DO UPDATE SET last_update = excluded.last_update, scan_id = excluded.scan_id
  `)
  const insertLink = db.prepare('INSERT OR IGNORE INTO tag_photo (photo_id, tag_id) VALUES (?, ?)')
  const upsertMeta = db.prepare(`
    INSERT INTO photo_meta (photo_id, title, has_description, has_tags, has_location, thumb_url, date_taken) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(photo_id) DO UPDATE SET title = excluded.title, has_description = excluded.has_description, has_tags = excluded.has_tags,
      has_location = excluded.has_location, thumb_url = excluded.thumb_url, date_taken = excluded.date_taken
  `)

  db.transaction(() => {
    for (const photo of photos) {
      deleteLinks.run(photo.id)
      upsertPhoto.run(photo.id, Number(photo.lastupdate ?? 0), scanId)
      const names = new Set((photo.tags ?? '').split(' ').filter(Boolean))
      const description = typeof photo.description === 'string' ? photo.description : photo.description?._content ?? ''
      // Flickr reports 0, 0 for a photo with no location
      const hasLocation = Number(photo.latitude ?? 0) !== 0 || Number(photo.longitude ?? 0) !== 0
      upsertMeta.run(photo.id, photo.title ?? '', description.trim() ? 1 : 0, names.size > 0 ? 1 : 0, hasLocation ? 1 : 0, photo.url_q ?? '', photo.datetaken ?? '')
      for (const name of names) {
        let id = tagIds.get(name)
        if (id === undefined) {
          id = Number(insertTag.run(name).lastInsertRowid)
          tagIds.set(name, id)
        }
        insertLink.run(photo.id, id)
      }
    }
  })()
}

function loadTagIds(db: Database.Database): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of db.prepare('SELECT id, name FROM tag_names').iterate() as IterableIterator<{ id: number; name: string }>) {
    map.set(row.name, row.id)
  }
  return map
}

function recomputeCounts(db: Database.Database): void {
  db.transaction(() => {
    db.exec('UPDATE tag_names SET photo_count = (SELECT COUNT(*) FROM tag_photo WHERE tag_photo.tag_id = tag_names.id)')
    db.exec('DELETE FROM tag_names WHERE photo_count = 0')
    db.exec('DELETE FROM tag_raw WHERE tag_id NOT IN (SELECT id FROM tag_names)')   // ids can be reused
  })()
}

// ── As-typed spellings ───────────────────────────────────────────────────────
// Flickr's normal tag form drops spaces and capitals ("newyork"). One extra call returns every
// spelling you actually typed ("New York", "new york"). We keep them all: the best one is shown in
// the Tags tab, and the filter matches against all of them.

interface RawTagEntry { clean?: string; raw?: { _content?: string }[] }

// Pick the spelling to show: prefer one with spaces, then one with more capitals, then Flickr's order.
function pickDisplay(spellings: string[]): string {
  let best = spellings[0]
  const score = (t: string): number => (t.includes(' ') ? 1000 : 0) + (t.match(/[A-Z]/g)?.length ?? 0)
  for (const t of spellings) if (score(t) > score(best)) best = t
  return best
}

async function syncRawSpellings(db: Database.Database, tokenData: FlickrTokenData): Promise<boolean> {
  let entries: RawTagEntry[]
  try {
    const data = await flickrCall(tokenData, 'flickr.tags.getListUserRaw', {})
    entries = ((data.who as { tags?: { tag?: RawTagEntry[] } } | undefined)?.tags?.tag) ?? []
  } catch {
    return false   // spellings are a nice-to-have; the scan itself still succeeded
  }
  // Nothing changed since the last time: keep what is stored instead of rewriting ~100,000 rows
  const signature = createHash('sha1').update(JSON.stringify(entries)).digest('hex')
  const stored = (db.prepare('SELECT COUNT(*) AS n FROM tag_raw').get() as { n: number }).n
  if (stored > 0 && getMeta(db, 'raw_signature') === signature) return true
  const tagIds = loadTagIds(db)
  const insertRaw = db.prepare('INSERT OR IGNORE INTO tag_raw (tag_id, raw, raw_lower) VALUES (?, ?, ?)')
  const setDisplay = db.prepare('UPDATE tag_names SET display = ? WHERE id = ?')
  db.transaction(() => {
    db.exec('DELETE FROM tag_raw')
    db.exec('UPDATE tag_names SET display = NULL')
    for (const entry of entries) {
      const id = entry.clean ? tagIds.get(entry.clean) : undefined
      if (id === undefined) continue
      const spellings = (entry.raw ?? []).map(r => r._content ?? '').filter(Boolean)
      if (spellings.length === 0) continue
      for (const t of spellings) insertRaw.run(id, t, t.toLowerCase())
      setDisplay.run(pickDisplay(spellings), id)
    }
  })()
  setMeta(db, 'raw_signature', signature)
  return true
}

// ── Scans ────────────────────────────────────────────────────────────────────

type Sender = (progress: TagScanProgress) => void

async function runFullScan(db: Database.Database, tokenData: FlickrTokenData, send: Sender): Promise<void> {
  const startedAt = Date.now()
  const scanId = startedAt
  const tagIds = loadTagIds(db)
  let page = 1
  let pages = 1
  let total = 0
  let photosDone = 0

  while (page <= pages) {
    if (cancelRequested) { recomputeCounts(db); send({ mode: 'full', phase: 'cancelled', page, pages, photos: photosDone, total }); return }
    let data: Record<string, unknown>
    try {
      data = await flickrCall(tokenData, 'flickr.people.getPhotos', {
        user_id: 'me', per_page: PER_PAGE, page, extras: SCAN_EXTRAS
      })
    } catch (err) {
      recomputeCounts(db)   // pages already read stay; make the counts match what is stored
      throw err
    }
    const parsed = parsePhotosPage(data)
    pages = parsed.pages
    total = parsed.total
    indexPhotos(db, parsed.photos, scanId, tagIds)
    photosDone += parsed.photos.length
    send({ mode: 'full', phase: 'scanning', page, pages, photos: photosDone, total })
    page++
  }

  send({ mode: 'full', phase: 'finishing', page: pages, pages, photos: photosDone, total })
  db.transaction(() => {
    // Anything not seen in this scan is gone from Flickr
    db.prepare('DELETE FROM tag_photo WHERE photo_id IN (SELECT photo_id FROM tag_indexed_photo WHERE scan_id != ?)').run(scanId)
    db.prepare('DELETE FROM photo_meta WHERE photo_id IN (SELECT photo_id FROM tag_indexed_photo WHERE scan_id != ?)').run(scanId)
    db.prepare('DELETE FROM tag_indexed_photo WHERE scan_id != ?').run(scanId)
  })()
  recomputeCounts(db)
  setMeta(db, 'has_spellings', (await syncRawSpellings(db, tokenData)) ? 1 : 0)
  setMeta(db, 'scan_id', scanId)
  setMeta(db, 'last_scan_start', startedAt)
  setMeta(db, 'last_scan_at', Date.now())
  setMeta(db, 'last_full_scan_at', Date.now())
  setMeta(db, 'has_photo_meta', 1)
  setMeta(db, 'flickr_total', total)
  clearTagSearchMemory()
  send({ mode: 'full', phase: 'done', page: pages, pages, photos: photosDone, total })
}

async function runRefresh(db: Database.Database, tokenData: FlickrTokenData, send: Sender): Promise<void> {
  const lastStart = metaNumber(db, 'last_scan_start')
  const scanId = metaNumber(db, 'scan_id')
  if (lastStart === null || scanId === null) throw new Error('Build the tag list first')
  const startedAt = Date.now()
  const minDate = Math.floor((lastStart - REFRESH_MARGIN_MS) / 1000)
  const tagIds = loadTagIds(db)
  let page = 1
  let pages = 1
  let photosDone = 0

  while (page <= pages) {
    if (cancelRequested) { recomputeCounts(db); send({ mode: 'refresh', phase: 'cancelled', page, pages, photos: photosDone, total: photosDone }); return }
    let data: Record<string, unknown>
    try {
      data = await flickrCall(tokenData, 'flickr.photos.recentlyUpdated', {
        min_date: minDate, per_page: PER_PAGE, page, extras: SCAN_EXTRAS
      })
    } catch (err) {
      recomputeCounts(db)
      throw err
    }
    const parsed = parsePhotosPage(data)
    pages = parsed.pages
    indexPhotos(db, parsed.photos, scanId, tagIds)
    photosDone += parsed.photos.length
    send({ mode: 'refresh', phase: 'scanning', page, pages, photos: photosDone, total: parsed.total })
    page++
  }

  send({ mode: 'refresh', phase: 'finishing', page: pages, pages, photos: photosDone, total: photosDone })
  recomputeCounts(db)
  setMeta(db, 'has_spellings', (await syncRawSpellings(db, tokenData)) ? 1 : 0)

  // Ask Flickr for the current photo total so the tab can flag new or removed photos
  const totalData = await flickrCall(tokenData, 'flickr.people.getPhotos', { user_id: 'me', per_page: 1, page: 1 })
  setMeta(db, 'flickr_total', parsePhotosPage(totalData).total)
  setMeta(db, 'last_scan_start', startedAt)
  setMeta(db, 'last_scan_at', Date.now())
  clearTagSearchMemory()
  send({ mode: 'refresh', phase: 'done', page: pages, pages, photos: photosDone, total: photosDone })
}

export function startTagScan(mode: 'full' | 'refresh', getWindow: () => BrowserWindow | null): { started: boolean } {
  if (scanning) return { started: false }
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  const db = requireDb()
  const send: Sender = progress => getWindow()?.webContents.send('tags:scanProgress', progress)

  scanning = true
  cancelRequested = false
  const run = mode === 'full' ? runFullScan : runRefresh
  run(db, tokenData, send)
    .catch(err => {
      const message = err instanceof Error ? err.message : String(err)
      send({ mode, phase: 'error', page: 0, pages: 0, photos: 0, total: 0, error: message })
    })
    .finally(() => { scanning = false })
  return { started: true }
}

// ── Reading the index ────────────────────────────────────────────────────────

export function getTagIndexStatus(): TagIndexStatus {
  const db = requireDb()
  const indexedPhotos = (db.prepare('SELECT COUNT(*) AS n FROM tag_indexed_photo').get() as { n: number }).n
  const tagCount = (db.prepare('SELECT COUNT(*) AS n FROM tag_names WHERE photo_count > 0').get() as { n: number }).n
  return {
    hasIndex: metaNumber(db, 'last_full_scan_at') !== null,
    scanning,
    lastScanAt: metaNumber(db, 'last_scan_at'),
    lastFullScanAt: metaNumber(db, 'last_full_scan_at'),
    indexedPhotos,
    tagCount,
    flickrTotal: metaNumber(db, 'flickr_total'),
    hasSpellings: metaNumber(db, 'has_spellings') === 1,
    hasPhotoMeta: metaNumber(db, 'has_photo_meta') === 1
  }
}

const isLetter = (col: string): string => `(${col} BETWEEN 'a' AND 'z')`
const isDigit = (col: string): string => `(${col} BETWEEN '0' AND '9')`

function buildWhere(q: TagListQuery): { sql: string; params: (string | number)[] } {
  const conds: string[] = ['photo_count > 0']
  const params: (string | number)[] = []
  if (!q.includeMachine) conds.push("instr(name, ':') = 0")

  const first = 'substr(name, 1, 1)'
  if (q.digits) {
    conds.push(isDigit(first))
  } else if (q.other) {
    conds.push(`NOT (${isLetter(first)} OR ${isDigit(first)})`)
  } else if (q.prefix) {
    conds.push('substr(name, 1, ?) = ?')
    params.push(q.prefix.length, q.prefix)
    if (q.afterPrefix === 'other') {
      const next = `substr(name, ${q.prefix.length + 1}, 1)`
      conds.push(`length(name) > ${q.prefix.length}`)
      conds.push(`NOT (${isLetter(next)} OR ${isDigit(next)})`)
    }
  }

  // Text matches the clean form ("newyork") or any as-typed spelling ("new york")
  const text = (q.text ?? '').trim().toLowerCase()
  if (text) {
    const len = Array.from(text).length   // SQLite counts characters, not UTF-16 units
    const anyRaw = (test: string): string =>
      `EXISTS (SELECT 1 FROM tag_raw r WHERE r.tag_id = tag_names.id AND ${test})`
    switch (q.operator ?? 'contains') {
      case 'startsWith':
        conds.push(`(substr(name, 1, ?) = ? OR ${anyRaw('substr(r.raw_lower, 1, ?) = ?')})`)
        params.push(len, text, len, text)
        break
      case 'endsWith':
        conds.push(`(substr(name, ?) = ? OR ${anyRaw('substr(r.raw_lower, ?) = ?')})`)
        params.push(-len, text, -len, text)
        break
      case 'exact':
        conds.push(`(name = ? OR ${anyRaw('r.raw_lower = ?')})`)
        params.push(text, text)
        break
      default:
        conds.push(`(instr(name, ?) > 0 OR ${anyRaw('instr(r.raw_lower, ?) > 0')})`)
        params.push(text, text)
    }
  }
  return { sql: conds.join(' AND '), params }
}

export function listTags(q: TagListQuery): TagListPage {
  const db = requireDb()
  const { sql, params } = buildWhere(q)
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM tag_names WHERE ${sql}`).get(...params) as { n: number }).n
  const order = q.sort === 'count' ? 'photo_count DESC, name ASC' : 'name ASC'
  const limit = Math.min(Math.max(q.limit ?? 200, 1), 1000)
  const offset = Math.max(q.offset ?? 0, 0)
  const rows = db.prepare(`
    SELECT name, COALESCE(display, name) AS display, photo_count AS count,
           MAX((SELECT COUNT(*) FROM tag_raw r WHERE r.tag_id = tag_names.id), 1) AS variants,
           (SELECT group_concat(raw, char(31)) FROM tag_raw r WHERE r.tag_id = tag_names.id) AS spellingList
    FROM tag_names WHERE ${sql} ORDER BY ${order} LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (TagRow & { spellingList: string | null })[]
  return {
    rows: rows.map(({ spellingList, ...row }) => ({ ...row, spellings: spellingList ? spellingList.split('\u001f') : [] })),
    total
  }
}

// The strip: groups by the next character after `prefix`. With no prefix this is the top-level
// strip (a-z, # for all digits, other). With a prefix it is the next level (aa, ab, ... or a0 ...).
export function listTagGroups(prefix: string, includeMachine: boolean): TagLetterGroup[] {
  const db = requireDb()
  const machine = includeMachine ? '' : " AND instr(name, ':') = 0"
  let rows: { k: string; n: number }[]

  if (!prefix) {
    const c = 'substr(name, 1, 1)'
    rows = db.prepare(`
      SELECT CASE WHEN ${isLetter(c)} THEN ${c} WHEN ${isDigit(c)} THEN '#' ELSE 'other' END AS k, COUNT(*) AS n
      FROM tag_names WHERE photo_count > 0${machine} GROUP BY k
    `).all() as { k: string; n: number }[]
  } else {
    const len = prefix.length
    const c = `substr(name, ${len + 1}, 1)`
    rows = db.prepare(`
      SELECT CASE WHEN length(name) <= ${len} THEN '' WHEN ${isLetter(c)} OR ${isDigit(c)} THEN ${c} ELSE 'other' END AS k, COUNT(*) AS n
      FROM tag_names WHERE photo_count > 0${machine} AND substr(name, 1, ?) = ? GROUP BY k
    `).all(len, prefix) as { k: string; n: number }[]
  }

  // Plain character order, with the digits group first and Other last
  const order = (k: string): string => (k === '' ? ' ' : k === '#' ? '!' : k === 'other' ? '~' : k)
  return rows
    .map(r => ({ key: r.k, label: r.k === '' ? prefix : r.k === 'other' ? 'Other' : r.k === '#' ? '#' : (prefix + r.k), count: r.n }))
    .sort((a, b) => { const x = order(a.key); const y = order(b.key); return x < y ? -1 : x > y ? 1 : 0 })
}

export function countPhotosForTags(names: string[], mode: 'any' | 'all'): number {
  const db = requireDb()
  if (names.length === 0) return 0
  const placeholders = names.map(() => '?').join(',')
  const ids = (db.prepare(`SELECT id FROM tag_names WHERE name IN (${placeholders})`).all(...names) as { id: number }[]).map(r => r.id)
  if (ids.length === 0) return 0
  const idList = ids.map(() => '?').join(',')
  if (mode === 'all') {
    if (ids.length < names.length) return 0
    const row = db.prepare(`SELECT COUNT(*) AS n FROM (SELECT photo_id FROM tag_photo WHERE tag_id IN (${idList}) GROUP BY photo_id HAVING COUNT(*) = ?)`)
      .get(...ids, ids.length) as { n: number }
    return row.n
  }
  const row = db.prepare(`SELECT COUNT(DISTINCT photo_id) AS n FROM tag_photo WHERE tag_id IN (${idList})`).get(...ids) as { n: number }
  return row.n
}

// ── IPC wiring ───────────────────────────────────────────────────────────────

export function registerTagIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('tags:getStatus', () => getTagIndexStatus())
  ipcMain.handle('tags:startScan', (_event, mode: 'full' | 'refresh') => startTagScan(mode, getWindow))
  ipcMain.on('tags:cancelScan', () => { cancelRequested = true })
  ipcMain.handle('tags:getGroups', (_event, prefix: string, includeMachine: boolean) => listTagGroups(prefix, includeMachine))
  ipcMain.handle('tags:list', (_event, query: TagListQuery) => listTags(query))
  ipcMain.handle('tags:countPhotos', (_event, names: string[], mode: 'any' | 'all') => countPhotosForTags(names, mode))
}
