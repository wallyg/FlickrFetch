import { app, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { readdir, rm, stat, unlink } from 'fs/promises'
import { MAX_TILE_ZOOM, cacheLimitMb } from '../shared/mapGeo'
import type { MapCacheInfo } from '../shared/types'
import { loadSettingsCached } from './settings'
import { USER_AGENT } from './userAgent'

// The street map under the photo dots. Each picture ("tile") comes from OpenStreetMap's free tile server, is saved in a folder on this computer
// and is read from there next time, so a place you have already looked at loads at once and works offline. Only "show me this square of the
// map" leaves your computer; no photo or personal detail does. OpenStreetMap asks apps to identify themselves, to keep to two requests at a time
// and to keep what they download for at least a week, and this follows all three.

const SERVER = 'https://tile.openstreetmap.org'
export const FRESH_DAYS = 7
const MAX_AT_ONCE = 2
export const MAX_WAITING = 40               // requests waiting for a free slot beyond this many: the oldest are dropped (they are for places you have scrolled away from)
const MAX_TILE_BYTES = 400_000
const MB = 1024 * 1024
const TRIM_TO = 0.8                         // past the limit (Settings, default 300 MB), the oldest pictures go until this share of it is left
const RETRY_AFTER_MS = 60_000               // after a failure, don't ask for the same tile again for a minute

export interface TileDeps {
  dir: string
  fetchTile: (url: string) => Promise<Uint8Array | null>
  now: () => number
  onSaved?: (bytes: number) => void   // told whenever a new picture is saved, so the folder can be kept within its limit
}

export function validTile(z: unknown, x: unknown, y: unknown): boolean {
  if (![z, x, y].every(n => typeof n === 'number' && Number.isInteger(n))) return false
  const [zz, xx, yy] = [z as number, x as number, y as number]
  return zz >= 0 && zz <= MAX_TILE_ZOOM && xx >= 0 && yy >= 0 && xx < 2 ** zz && yy < 2 ** zz
}

const isPng = (b: Uint8Array): boolean => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47

/** Reads a response body but gives up as soon as it is bigger than `max` (by its Content-Length header, or by what has actually arrived), so a
 *  wrong answer from a proxy or a sign-in page is never downloaded in full. */
export async function readCapped(res: Pick<Response, 'headers' | 'body'>, max: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) { try { await res.body?.cancel() } catch { /* already closed */ } return null }
  const reader = res.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > max) { try { await reader.cancel() } catch { /* already closed */ } return null }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.length }
  return out
}

async function download(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) return null
    const bytes = await readCapped(res, MAX_TILE_BYTES)
    return bytes && isPng(bytes) ? bytes : null
  } catch { return null }
}

// Two downloads at a time. The ones waiting are served newest first (what you are looking at now was asked for last), and when more than
// MAX_WAITING pile up, the oldest are dropped: they are for squares you have already scrolled past.
const DROPPED = Symbol('dropped')
type Waiter = { go: () => void; drop: () => void }
const waiting: Waiter[] = []
let running = 0
async function oneAtATime<T>(job: () => Promise<T>): Promise<T | typeof DROPPED> {
  if (running >= MAX_AT_ONCE) {
    const got = await new Promise<boolean>(resolve => {
      waiting.push({ go: () => resolve(true), drop: () => resolve(false) })
      if (waiting.length > MAX_WAITING) waiting.shift()?.drop()
    })
    if (!got) return DROPPED           // (a slot is handed to a waiter that goes, never to one that was dropped)
  } else running++
  try { return await job() } finally {
    const next = waiting.pop()         // newest first
    if (next) next.go()                // the slot goes straight to it, so the count never rises above the limit
    else running--
  }
}

const inFlight = new Map<string, Promise<Uint8Array | null | 'dropped'>>()
const failedAt = new Map<string, number>()

/** The picture for one tile: the saved copy if it is under a week old, else a fresh download (an older saved copy still stands in if the download fails). */
export function getTile(z: number, x: number, y: number, deps: TileDeps): Promise<Uint8Array | null | 'dropped'> {
  if (!validTile(z, x, y)) return Promise.resolve(null)
  const key = `${deps.dir}|${z}/${x}/${y}`
  const pending = inFlight.get(key)
  if (pending) return pending
  const job = (async () => {
    const file = join(deps.dir, String(z), String(x), `${y}.png`)
    let stale: Uint8Array | null = null
    if (existsSync(file)) {
      try {
        const age = deps.now() - statSync(file).mtimeMs
        const bytes = new Uint8Array(readFileSync(file))
        if (age < FRESH_DAYS * 86_400_000) return bytes
        stale = bytes
      } catch { /* an unreadable saved copy is the same as none */ }
    }
    const tried = failedAt.get(key)
    if (tried !== undefined && deps.now() - tried < RETRY_AFTER_MS) return stale
    const got = await oneAtATime(() => deps.fetchTile(`${SERVER}/${z}/${x}/${y}.png`))
    if (got === DROPPED) return stale ?? 'dropped'   // not a failure: nothing is remembered, so it is simply asked for again if it is still in view
    if (!got) { failedAt.set(key, deps.now()); return stale }
    failedAt.delete(key)
    try { mkdirSync(join(deps.dir, String(z), String(x)), { recursive: true }); writeFileSync(file, got); deps.onSaved?.(got.length) } catch { /* it still shows this time */ }
    return got
  })().finally(() => inFlight.delete(key))
  inFlight.set(key, job)
  return job
}

async function listFiles(dir: string): Promise<{ path: string; size: number; at: number }[]> {
  const files: { path: string; size: number; at: number }[] = []
  const walk = async (d: string): Promise<void> => {
    let entries
    try { entries = await readdir(d, { withFileTypes: true }) } catch { return }   // a folder that is not there is empty
    for (const e of entries) {
      const p = join(d, e.name)
      if (e.isDirectory()) await walk(p)
      else try { const st = await stat(p); files.push({ path: p, size: st.size, at: st.mtimeMs }) } catch { /* gone already */ }
    }
  }
  await walk(dir)
  return files
}

/** How much the saved pictures take now. (Asynchronous, so a big folder never freezes the app.) */
export async function cacheSize(dir: string): Promise<MapCacheInfo> {
  const files = await listFiles(dir)
  return { bytes: files.reduce((n, f) => n + f.size, 0), files: files.length }
}

/** Keep the saved pictures within a limit: past it, the oldest go until 80% of the limit is left (so it is not trimmed again on the very next picture). */
export async function trimCache(dir: string, limitBytes: number): Promise<number> {
  const files = await listFiles(dir)
  let total = files.reduce((n, f) => n + f.size, 0)
  if (total <= limitBytes) return 0
  let removed = 0
  for (const f of files.sort((a, b) => a.at - b.at)) {
    if (total <= limitBytes * TRIM_TO) break
    try { await unlink(f.path); total -= f.size; removed++ } catch { /* leave it */ }
  }
  return removed
}

/** Remembers how big the folder is, so it is measured once and then only added to, and trims it when it passes the limit. The work happens in the
 *  background, one piece at a time, so measuring and trimming never overlap and never hold up a tile. */
export function cacheKeeper(dir: string): { saved: (added: number, limitBytes: number) => Promise<void>; reset: () => void } {
  let bytes: number | null = null
  let busy: Promise<void> = Promise.resolve()
  return {
    saved(added, limitBytes) {
      busy = busy.then(async () => {
        bytes = bytes === null ? (await cacheSize(dir)).bytes : bytes + added   // the first measure already includes whatever was just saved
        if (bytes > limitBytes) { await trimCache(dir, limitBytes); bytes = (await cacheSize(dir)).bytes }
      }).catch(() => { bytes = null })   // if the folder could not be read, measure again next time
      return busy
    },
    reset() { bytes = null }
  }
}

export function registerTileIpc(): void {
  const dir = join(app.getPath('userData'), 'map-tiles')
  const keeper = cacheKeeper(dir)
  ipcMain.handle('map:tile', async (_event, z: number, x: number, y: number) => {
    const settings = loadSettingsCached()
    if (settings.mapStreet !== true) return null   // nothing is ever asked of OpenStreetMap unless the street map is on
    const limit = cacheLimitMb(settings.mapCacheMb) * MB
    void keeper.saved(0, limit)                       // also trims (in the background) if the limit was lowered since last time
    return getTile(z, x, y, { dir, fetchTile: download, now: Date.now, onSaved: n => { void keeper.saved(n, limit) } })
  })
  ipcMain.handle('map:cacheInfo', (): Promise<MapCacheInfo> => cacheSize(dir))
  ipcMain.handle('map:cacheClear', async (): Promise<void> => { await rm(dir, { recursive: true, force: true }); keeper.reset() })
}
