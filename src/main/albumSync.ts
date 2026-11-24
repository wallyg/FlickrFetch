import type Database from 'better-sqlite3'

// Reads the user's albums and which photo is in which album, and keeps them in the local library list (3.7). Read-only toward Flickr.
//   Rebuild reads every album. Update reads the album list and the collection tree (two or three calls), then only the albums
//   whose photo count or last-update time changed since the last read.

export const ALBUMS_DDL = `
  CREATE TABLE IF NOT EXISTS album (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    photo_count INTEGER NOT NULL DEFAULT 0,
    date_create INTEGER,
    date_update INTEGER,
    in_collection INTEGER NOT NULL DEFAULT 0,
    thumb_url TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS album_photo (
    album_id TEXT NOT NULL,
    photo_id TEXT NOT NULL,
    PRIMARY KEY (album_id, photo_id)
  );
  CREATE INDEX IF NOT EXISTS idx_album_photo_photo ON album_photo (photo_id);
  CREATE TABLE IF NOT EXISTS album_health_state (
    album_id TEXT NOT NULL,
    condition TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (album_id, condition)
  );
  CREATE TABLE IF NOT EXISTS album_kind (
    album_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS album_fit_state (
    key TEXT NOT NULL,
    condition TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (key, condition)
  );
  CREATE TABLE IF NOT EXISTS photo_health_state (
    photo_id TEXT NOT NULL,
    condition TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (photo_id, condition)
  );
`

export type FlickrCall = (method: string, params: Record<string, string | number>) => Promise<Record<string, unknown>>

interface AlbumInfo { id: string; title: string; description: string; count: number; created: number | null; updated: number | null; thumb: string }

// Flickr sends text fields either as a plain string or as { _content }
const text = (v: unknown): string =>
  typeof v === 'string' ? v : v && typeof v === 'object' && '_content' in v ? String((v as { _content: unknown })._content ?? '') : ''

async function readAlbumList(call: FlickrCall, nsid: string): Promise<AlbumInfo[]> {
  const out: AlbumInfo[] = []
  let page = 1
  let pages = 1
  while (page <= pages) {
    const data = await call('flickr.photosets.getList', { user_id: nsid, per_page: 500, page })
    const sets = data.photosets as { pages?: number | string; photoset?: Record<string, unknown>[] } | undefined
    pages = Number(sets?.pages ?? 1) || 1
    for (const s of sets?.photoset ?? []) {
      out.push({
        id: String(s.id), title: text(s.title), description: text(s.description),
        count: (Number(s.photos) || 0) + (Number(s.videos) || 0),
        created: Number(s.date_create) || null, updated: Number(s.date_update) || null,
        thumb: s.server && s.primary && s.secret ? `https://live.staticflickr.com/${s.server}/${s.primary}_${s.secret}_q.jpg` : ''
      })
    }
    page++
  }
  return out
}

// Which albums sit in a collection, anywhere in the tree. `any` is false when there are no collections at all.
async function readCollected(call: FlickrCall, nsid: string): Promise<{ any: boolean; ids: Set<string> }> {
  let data: Record<string, unknown>
  // If Flickr cannot give the collection tree, nothing is flagged as "in no collection" rather than everything
  try { data = await call('flickr.collections.getTree', { user_id: nsid }) } catch { return { any: false, ids: new Set() } }
  const top = (data.collections as { collection?: Record<string, unknown>[] } | undefined)?.collection ?? []
  const ids = new Set<string>()
  const walk = (c: Record<string, unknown>): void => {
    for (const s of (c.set as Record<string, unknown>[] | undefined) ?? []) ids.add(String(s.id))
    for (const sub of (c.collection as Record<string, unknown>[] | undefined) ?? []) walk(sub)
  }
  top.forEach(walk)
  return { any: top.length > 0, ids }
}

async function readAlbumPhotoIds(call: FlickrCall, nsid: string, albumId: string): Promise<string[]> {
  const ids: string[] = []
  let page = 1
  let pages = 1
  while (page <= pages) {
    const data = await call('flickr.photosets.getPhotos', { photoset_id: albumId, user_id: nsid, per_page: 500, page })
    const set = data.photoset as { pages?: number | string; photo?: { id: string }[] } | undefined
    pages = Number(set?.pages ?? 1) || 1
    for (const p of set?.photo ?? []) ids.push(String(p.id))
    page++
  }
  return ids
}

export interface AlbumSyncOptions {
  nsid: string
  mode: 'full' | 'refresh'
  cancelled: () => boolean
  progress: (done: number, total: number) => void
}

// Returns false when it was cancelled part way (what was read so far is kept)
export async function syncAlbums(db: Database.Database, call: FlickrCall, opts: AlbumSyncOptions): Promise<boolean> {
  db.exec(ALBUMS_DDL)
  const albums = await readAlbumList(call, opts.nsid)
  const collected = await readCollected(call, opts.nsid)
  const stored = new Map((db.prepare('SELECT id, photo_count, date_update FROM album').all() as { id: string; photo_count: number; date_update: number | null }[]).map(r => [r.id, r]))
  const toRead = new Set(albums.filter(a => {
    if (opts.mode === 'full') return true
    const s = stored.get(a.id)
    return !s || s.photo_count !== a.count || (s.date_update ?? 0) !== (a.updated ?? 0)
  }).map(a => a.id))

  const upsert = db.prepare(`
    INSERT INTO album (id, title, description, photo_count, date_create, date_update, in_collection, thumb_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description, photo_count = excluded.photo_count,
      date_create = excluded.date_create, date_update = excluded.date_update, in_collection = excluded.in_collection, thumb_url = excluded.thumb_url
  `)
  // With no collections at all, "in no collection" would flag every album, so it flags none
  const saveInfo = (a: AlbumInfo): void => { upsert.run(a.id, a.title, a.description, a.count, a.created, a.updated, collected.any ? (collected.ids.has(a.id) ? 1 : 0) : 1, a.thumb) }

  // Albums that did not change keep their photos; only their details are refreshed
  db.transaction(() => { for (const a of albums) if (!toRead.has(a.id)) saveInfo(a) })()

  const insertLink = db.prepare('INSERT OR IGNORE INTO album_photo (album_id, photo_id) VALUES (?, ?)')
  const clearLinks = db.prepare('DELETE FROM album_photo WHERE album_id = ?')
  let done = 0
  for (const a of albums) {
    if (!toRead.has(a.id)) continue
    if (opts.cancelled()) return false
    const ids = await readAlbumPhotoIds(call, opts.nsid, a.id)
    db.transaction(() => { clearLinks.run(a.id); for (const id of ids) insertLink.run(a.id, id); saveInfo(a) })()
    done++
    opts.progress(done, toRead.size)
  }

  // Albums that are gone from Flickr
  const live = new Set(albums.map(a => a.id))
  db.transaction(() => {
    for (const id of stored.keys()) {
      if (live.has(id)) continue
      db.prepare('DELETE FROM album WHERE id = ?').run(id)
      clearLinks.run(id)
      db.prepare('DELETE FROM album_health_state WHERE album_id = ?').run(id)
      db.prepare('DELETE FROM album_kind WHERE album_id = ?').run(id)
      db.prepare('DELETE FROM album_fit_state WHERE key = ? OR key LIKE ?').run(id, `%|${id}`)   // marks fine for a May belong album, or a photo in it
    }
  })()
  return true
}
