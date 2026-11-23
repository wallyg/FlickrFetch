import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { FLICKR_API_KEY } from './config'
import { createHash } from 'crypto'
import { loadToken } from './auth'
import { loadSettings } from './settings'
import { signedGet, clearTagSearchMemory } from './flickr'
import { getDb } from './database'
import { foldLatinAccents, cleanTag } from '../shared/tags'
import { descriptionFlags } from '../shared/descriptionFlags'
import { syncAlbums } from './albumSync'
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
  ispublic?: number | string; isfriend?: number | string; isfamily?: number | string
  media?: string; dateupload?: string | number
  accuracy?: string | number; datetakenunknown?: string | number
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
    date_taken TEXT NOT NULL DEFAULT '',
    privacy INTEGER NOT NULL DEFAULT 0,
    latitude REAL,
    longitude REAL,
    media TEXT NOT NULL DEFAULT 'photo',
    date_upload INTEGER,
    desc_flags INTEGER NOT NULL DEFAULT 0,
    geo_accuracy INTEGER NOT NULL DEFAULT 0,
    date_unknown INTEGER NOT NULL DEFAULT 0,
    tags_verified INTEGER NOT NULL DEFAULT 0
  );
`

// Columns added after 3.4 shipped; tables made by earlier versions get them here
export function addPhotoMetaColumns(db: Database.Database): void {
  const have = new Set((db.prepare('PRAGMA table_info(photo_meta)').all() as { name: string }[]).map(c => c.name))
  if (!have.has('privacy')) db.exec('ALTER TABLE photo_meta ADD COLUMN privacy INTEGER NOT NULL DEFAULT 0')
  if (!have.has('latitude')) db.exec('ALTER TABLE photo_meta ADD COLUMN latitude REAL')
  if (!have.has('longitude')) db.exec('ALTER TABLE photo_meta ADD COLUMN longitude REAL')
  // 3.6: photo or video, when it was uploaded, and what is wrong with the description
  if (!have.has('media')) db.exec("ALTER TABLE photo_meta ADD COLUMN media TEXT NOT NULL DEFAULT 'photo'")
  if (!have.has('date_upload')) db.exec('ALTER TABLE photo_meta ADD COLUMN date_upload INTEGER')
  if (!have.has('desc_flags')) db.exec('ALTER TABLE photo_meta ADD COLUMN desc_flags INTEGER NOT NULL DEFAULT 0')
  // how exact the geotag is (0 when there is none) and Flickr's own flag for a date taken that is only a guess
  if (!have.has('geo_accuracy')) db.exec('ALTER TABLE photo_meta ADD COLUMN geo_accuracy INTEGER NOT NULL DEFAULT 0')
  if (!have.has('date_unknown')) db.exec('ALTER TABLE photo_meta ADD COLUMN date_unknown INTEGER NOT NULL DEFAULT 0')
  // 3.7: 1 once a photo that looked untagged has been asked for on its own (Flickr's photo list can leave out the tags of a photo that has them)
  if (!have.has('tags_verified')) db.exec('ALTER TABLE photo_meta ADD COLUMN tags_verified INTEGER NOT NULL DEFAULT 0')
}

// 0 public, 1 friends, 2 family, 3 friends and family, 4 private
function privacyOf(p: RawPhoto): number {
  if (p.ispublic === undefined || p.ispublic === null) return 4   // unknown counts as private, so a missing field never makes a photo look public
  if (Number(p.ispublic) === 1) return 0
  const friend = Number(p.isfriend ?? 0) === 1, family = Number(p.isfamily ?? 0) === 1
  return friend && family ? 3 : friend ? 1 : family ? 2 : 4
}

// What each scan asks Flickr to include with every photo
const SCAN_EXTRAS = 'tags,last_update,description,geo,url_q,date_taken,ispublic,isfriend,isfamily,media,date_upload'

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
    addPhotoMetaColumns(db)
    addTagSqlFunctions(db)
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
    INSERT INTO photo_meta (photo_id, title, has_description, has_tags, has_location, thumb_url, date_taken, privacy, latitude, longitude, media, date_upload, desc_flags, geo_accuracy, date_unknown, tags_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(photo_id) DO UPDATE SET title = excluded.title, has_description = excluded.has_description, has_tags = excluded.has_tags,
      has_location = excluded.has_location, thumb_url = excluded.thumb_url, date_taken = excluded.date_taken,
      privacy = excluded.privacy, latitude = excluded.latitude, longitude = excluded.longitude,
      media = excluded.media, date_upload = excluded.date_upload, desc_flags = excluded.desc_flags,
      geo_accuracy = excluded.geo_accuracy, date_unknown = excluded.date_unknown, tags_verified = 0
  `)

  db.transaction(() => {
    for (const photo of photos) {
      deleteLinks.run(photo.id)
      upsertPhoto.run(photo.id, Number(photo.lastupdate ?? 0), scanId)
      const names = new Set((photo.tags ?? '').split(' ').filter(Boolean))
      const description = typeof photo.description === 'string' ? photo.description : photo.description?._content ?? ''
      // Flickr reports 0, 0 for a photo with no location
      const hasLocation = Number(photo.latitude ?? 0) !== 0 || Number(photo.longitude ?? 0) !== 0
      upsertMeta.run(photo.id, photo.title ?? '', description.trim() ? 1 : 0, names.size > 0 ? 1 : 0, hasLocation ? 1 : 0, photo.url_q ?? '', photo.datetaken ?? '',
        privacyOf(photo), hasLocation ? Number(photo.latitude) : null, hasLocation ? Number(photo.longitude) : null,
        photo.media === 'video' ? 'video' : 'photo', Number(photo.dateupload) > 0 ? Number(photo.dateupload) : null,
        descriptionFlags(description, photo.title ?? '', names),
        Math.max(0, Number(photo.accuracy) || 0), Number(photo.datetakenunknown) === 1 ? 1 : 0)
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

// Flickr's photo list sometimes returns no tags for a photo that has them (seen in 3.7 testing: 20 to 35 tags on the photo, none in the list).
// So a photo that looks untagged is asked for on its own, once, before it is reported as having no tags. Returns false if cancelled.
async function verifyUntagged(db: Database.Database, tokenData: FlickrTokenData, tagIds: Map<string, number>): Promise<boolean> {
  const ids = (db.prepare('SELECT photo_id FROM photo_meta WHERE has_tags = 0 AND tags_verified = 0').all() as { photo_id: string }[]).map(r => r.photo_id)
  const insertTag = db.prepare('INSERT INTO tag_names (name) VALUES (?)')
  const deleteLinks = db.prepare('DELETE FROM tag_photo WHERE photo_id = ?')
  const insertLink = db.prepare('INSERT OR IGNORE INTO tag_photo (photo_id, tag_id) VALUES (?, ?)')
  const markChecked = db.prepare('UPDATE photo_meta SET tags_verified = 1 WHERE photo_id = ?')
  const markTagged = db.prepare('UPDATE photo_meta SET has_tags = 1, tags_verified = 1 WHERE photo_id = ?')
  let failures = 0
  for (const id of ids) {
    if (cancelRequested) return false
    let tags: { _content?: string }[]
    try {
      const data = await flickrCall(tokenData, 'flickr.photos.getInfo', { photo_id: id })
      tags = ((data.photo as { tags?: { tag?: { _content?: string }[] } } | undefined)?.tags?.tag) ?? []
      failures = 0
    } catch {
      // A photo that cannot be read stays unchecked for next time; a run of failures (for example Flickr refusing calls) stops the check
      if (++failures >= 5) return true
      continue
    }
    const names = new Set(tags.map(t => cleanTag(t._content ?? '')).filter(Boolean))
    db.transaction(() => {
      if (names.size === 0) { markChecked.run(id); return }
      deleteLinks.run(id)
      for (const name of names) {
        let tagId = tagIds.get(name)
        if (tagId === undefined) { tagId = Number(insertTag.run(name).lastInsertRowid); tagIds.set(name, tagId) }
        insertLink.run(id, tagId)
      }
      markTagged.run(id)
    })()
  }
  return true
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
  // Photos the list showed without tags are asked for one by one before they count as untagged
  if (!(await verifyUntagged(db, tokenData, tagIds))) { recomputeCounts(db); send({ mode: 'full', phase: 'cancelled', page: pages, pages, photos: photosDone, total }); return }
  recomputeCounts(db)
  setMeta(db, 'has_spellings', (await syncRawSpellings(db, tokenData)) ? 1 : 0)
  setMeta(db, 'scan_id', scanId)
  setMeta(db, 'last_scan_start', startedAt)
  setMeta(db, 'last_scan_at', Date.now())
  setMeta(db, 'last_full_scan_at', Date.now())
  setMeta(db, 'has_photo_meta', 1)
  setMeta(db, 'has_catalog_v2', 1)   // privacy and coordinates are saved too (3.5)
  setMeta(db, 'has_scan_36', 1)   // media type, upload date, geotag accuracy and description flags are saved too (3.6)
  setMeta(db, 'flickr_total', total)
  clearTagSearchMemory()
  // Which photo is in which album (3.7). The photo and tag data above is already saved, so a failure or a cancel here keeps it.
  send({ mode: 'full', phase: 'albums', page: 0, pages: 0, photos: 0, total })
  const albumsRead = await syncAlbums(db, (m, p) => flickrCall(tokenData, m, p), {
    nsid: tokenData.nsid, mode: 'full', cancelled: () => cancelRequested,
    progress: (done, albums) => send({ mode: 'full', phase: 'albums', page: done, pages: albums, photos: done, total: albums })
  })
  if (!albumsRead) { send({ mode: 'full', phase: 'cancelled', page: pages, pages, photos: photosDone, total }); return }
  setMeta(db, 'has_albums_37', 1)
  setMeta(db, 'albums_scanned_at', Date.now())
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
  // Photos that look untagged (new or changed ones, and the first time any older ones) are asked for one by one
  if (!(await verifyUntagged(db, tokenData, tagIds))) { recomputeCounts(db); send({ mode: 'refresh', phase: 'cancelled', page: pages, pages, photos: photosDone, total: photosDone }); return }
  recomputeCounts(db)
  setMeta(db, 'has_spellings', (await syncRawSpellings(db, tokenData)) ? 1 : 0)

  // Ask Flickr for the current photo total so the tab can flag new or removed photos
  const totalData = await flickrCall(tokenData, 'flickr.people.getPhotos', { user_id: 'me', per_page: 1, page: 1 })
  setMeta(db, 'flickr_total', parsePhotosPage(totalData).total)
  setMeta(db, 'last_scan_start', startedAt)
  setMeta(db, 'last_scan_at', Date.now())
  clearTagSearchMemory()
  // Albums that changed since the last read (only once a Rebuild has read them all). A problem here must not spoil the Update.
  if (metaNumber(db, 'has_albums_37') === 1) {
    try {
      const read = await syncAlbums(db, (m, p) => flickrCall(tokenData, m, p), { nsid: tokenData.nsid, mode: 'refresh', cancelled: () => cancelRequested, progress: () => undefined })
      if (read) setMeta(db, 'albums_scanned_at', Date.now())
    } catch (err) { process.stderr.write(`[flickrfetch] Album update failed: ${err}\n`) }
  }
  send({ mode: 'refresh', phase: 'done', page: pages, pages, photos: photosDone, total: photosDone })
}

// True while an automatic (background) Update is running: it sends no progress and the UI does not show it as a scan
let quiet = false
let runningMode: 'full' | 'refresh' = 'refresh'   // what the running scan is, so a different request is not mistaken for it

export function startTagScan(mode: 'full' | 'refresh', getWindow: () => BrowserWindow | null, silent = false): { started: boolean } {
  if (scanning) {
    // The user pressed Update or Rebuild while the quiet one was running: let them see it from here on
    if (quiet && !silent) {
      if (mode !== runningMode) throw new Error('An automatic update is running in the background. Try again in a minute.')
      quiet = false; return { started: true }
    }
    return { started: false }
  }
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  const db = requireDb()
  // A background (automatic) update stays quiet: no progress screen, only the final "done" so open screens refresh
  const send: Sender = progress => { if (!quiet || progress.phase === 'done') getWindow()?.webContents.send('tags:scanProgress', progress) }

  scanning = true
  quiet = silent
  runningMode = mode
  cancelRequested = false
  const run = mode === 'full' ? runFullScan : runRefresh
  run(db, tokenData, send)
    .catch(err => {
      const message = err instanceof Error ? err.message : String(err)
      send({ mode, phase: 'error', page: 0, pages: 0, photos: 0, total: 0, error: message })
    })
    .finally(() => { scanning = false; quiet = false })
  return { started: true }
}

// ── Reading the index ────────────────────────────────────────────────────────

export function getTagIndexStatus(): TagIndexStatus {
  const db = requireDb()
  const indexedPhotos = (db.prepare('SELECT COUNT(*) AS n FROM tag_indexed_photo').get() as { n: number }).n
  const tagCount = (db.prepare('SELECT COUNT(*) AS n FROM tag_names WHERE photo_count > 0').get() as { n: number }).n
  return {
    hasIndex: metaNumber(db, 'last_full_scan_at') !== null,
    scanning: scanning && !quiet,
    lastScanAt: metaNumber(db, 'last_scan_at'),
    lastFullScanAt: metaNumber(db, 'last_full_scan_at'),
    indexedPhotos,
    tagCount,
    flickrTotal: metaNumber(db, 'flickr_total'),
    hasSpellings: metaNumber(db, 'has_spellings') === 1,
    hasPhotoMeta: metaNumber(db, 'has_photo_meta') === 1,
    hasCatalog: metaNumber(db, 'has_catalog_v2') === 1,
    hasCatalogV3: metaNumber(db, 'has_scan_36') === 1,
    hasAlbums: metaNumber(db, 'has_albums_37') === 1
  }
}

const isLetter = (col: string): string => `(${col} BETWEEN 'a' AND 'z')`
const isDigit = (col: string): string => `(${col} BETWEEN '0' AND '9')`

// ── "Other" tags: grouped by the writing system of the first character ───────
// Tags that start with something other than a-z or 0-9 (accented letters, other alphabets, symbols).
const SCRIPT_LABELS: Record<string, string> = {
  latin: 'Accented Latin (é ñ ø…)', cyrillic: 'Cyrillic', greek: 'Greek', arabic: 'Arabic', hebrew: 'Hebrew',
  indic: 'Indian scripts', cjk: 'Chinese & Japanese', korean: 'Korean', seasia: 'Thai, Lao, Khmer…', digits: 'Other digits', misc: 'Symbols & others'
}
export function scriptBucket(name: string): string {
  const ch = Array.from(name)[0] ?? ''
  if (/\p{Script=Latin}/u.test(ch)) return 'latin'
  if (/\p{Script=Cyrillic}/u.test(ch)) return 'cyrillic'
  if (/\p{Script=Greek}/u.test(ch)) return 'greek'
  if (/[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}]/u.test(ch)) return 'arabic'
  if (/\p{Script=Hebrew}/u.test(ch)) return 'hebrew'
  if (/[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}]/u.test(ch)) return 'indic'
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Bopomofo}]/u.test(ch)) return 'cjk'
  if (/\p{Script=Hangul}/u.test(ch)) return 'korean'
  if (/[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u.test(ch)) return 'seasia'
  if (/\p{N}/u.test(ch)) return 'digits'
  return 'misc'
}
// The plain letter an accented first letter stands for (é -> e); empty when it has none (ø, ł)
export function baseLetter(name: string): string {
  const ch = Array.from(name)[0] ?? ''
  const plain = foldLatinAccents(ch).toLowerCase()
  return /^[a-z]$/.test(plain) ? plain : ''
}
export function addTagSqlFunctions(db: Database.Database): void {
  db.function('ff_script', { deterministic: true }, (n: unknown) => (typeof n === 'string' ? scriptBucket(n) : 'misc'))
  db.function('ff_base', { deterministic: true }, (n: unknown) => (typeof n === 'string' ? baseLetter(n) : ''))
}

function buildWhere(q: TagListQuery): { sql: string; params: (string | number)[] } {
  const conds: string[] = ['photo_count > 0']
  const params: (string | number)[] = []
  if (!q.includeMachine) conds.push("instr(name, ':') = 0")

  const first = 'substr(name, 1, 1)'
  if (q.digits) {
    conds.push(isDigit(first))
  } else if (q.other) {
    conds.push(`NOT (${isLetter(first)} OR ${isDigit(first)})`)
    if (q.script) { conds.push('ff_script(name) = ?'); params.push(q.script) }
    if (q.base) { conds.push('ff_base(name) = ?'); params.push(q.base === 'misc' ? '' : q.base) }
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
  const order = q.sort === 'count' ? 'photo_count DESC, name ASC' : q.sort === 'alphaDesc' ? 'name DESC' : 'name ASC'
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

  if (prefix === '#') {
    // Digits: one chip per first digit
    const c = 'substr(name, 1, 1)'
    const digits = db.prepare(`SELECT ${c} AS k, COUNT(*) AS n FROM tag_names WHERE photo_count > 0${machine} AND ${isDigit(c)} GROUP BY k ORDER BY k`).all() as { k: string; n: number }[]
    return digits.map(r => ({ key: r.k, label: r.k, count: r.n }))
  }
  if (prefix === 'other') {
    // Other: one chip per writing system, biggest first
    const c = 'substr(name, 1, 1)'
    const buckets = db.prepare(`SELECT ff_script(name) AS k, COUNT(*) AS n FROM tag_names WHERE photo_count > 0${machine} AND NOT (${isLetter(c)} OR ${isDigit(c)}) GROUP BY k`).all() as { k: string; n: number }[]
    return buckets.sort((a, b) => b.n - a.n).map(r => ({ key: r.k, label: SCRIPT_LABELS[r.k] ?? r.k, count: r.n }))
  }
  if (prefix === 'other:latin') {
    // Accented Latin: by the plain letter it stands for (é under e), then the letters with none (ø, ł)
    const c = 'substr(name, 1, 1)'
    const bases = db.prepare(`SELECT ff_base(name) AS k, COUNT(*) AS n FROM tag_names WHERE photo_count > 0${machine} AND NOT (${isLetter(c)} OR ${isDigit(c)}) AND ff_script(name) = 'latin' GROUP BY k`).all() as { k: string; n: number }[]
    return bases.sort((a, b) => (a.k === '' ? 1 : b.k === '' ? -1 : a.k < b.k ? -1 : 1)).map(r => ({ key: r.k === '' ? 'misc' : r.k, label: r.k === '' ? 'ø ł đ…' : `${r.k} (${r.k === 'a' ? 'á à â ã ä å' : r.k === 'e' ? 'é è ê ë' : r.k === 'i' ? 'í ì î ï' : r.k === 'o' ? 'ó ò ô ö' : r.k === 'u' ? 'ú ù û ü' : r.k === 'n' ? 'ñ' : r.k === 'c' ? 'ç' : '…'})`, count: r.n }))
  }
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

// Automatic Update: while the app is open, once a day (checked shortly after launch and then hourly), run the quick
// Update if the library list is more than a day old. Never a full rebuild, never anything on Flickr's side.
const AUTO_UPDATE_AGE_MS = 24 * 3600 * 1000
function autoUpdateMode(): 'open' | 'daily' | 'off' {
  const st = loadSettings()
  return st.autoUpdateWhen ?? (st.autoUpdate === false ? 'off' : 'daily')
}
// atLaunch: the check shortly after the app opens. In "every time I open it" mode that one always updates; every other
// check (the hourly ones while the app stays open) only updates when the list is more than a day old.
function maybeAutoUpdate(getWindow: () => BrowserWindow | null, atLaunch = false): void {
  try {
    const mode = autoUpdateMode()
    if (scanning || mode === 'off' || !loadToken()) return
    const db = getDb()
    if (!db || metaNumber(db, 'last_full_scan_at') === null) return   // nothing built yet: the user starts that
    const last = metaNumber(db, 'last_scan_at')
    const always = atLaunch && mode === 'open'
    if (!always && last !== null && Date.now() - last < AUTO_UPDATE_AGE_MS) return
    startTagScan('refresh', getWindow, true)
  } catch { /* try again at the next check */ }
}

export function registerTagIpc(getWindow: () => BrowserWindow | null): void {
  setTimeout(() => maybeAutoUpdate(getWindow, true), 30 * 1000)
  setInterval(() => maybeAutoUpdate(getWindow), 3600 * 1000)
  ipcMain.handle('tags:getStatus', () => getTagIndexStatus())
  ipcMain.handle('tags:startScan', (_event, mode: 'full' | 'refresh') => startTagScan(mode, getWindow))
  ipcMain.on('tags:cancelScan', () => { cancelRequested = true })
  ipcMain.handle('tags:getGroups', (_event, prefix: string, includeMachine: boolean) => listTagGroups(prefix, includeMachine))
  ipcMain.handle('tags:list', (_event, query: TagListQuery) => listTags(query))
  ipcMain.handle('tags:countPhotos', (_event, names: string[], mode: 'any' | 'all') => countPhotosForTags(names, mode))
}
