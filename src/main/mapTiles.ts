import { app, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { MAX_TILE_ZOOM, cacheLimitMb } from '../shared/mapGeo'
import type { MapCacheInfo } from '../shared/types'
import { loadSettings } from './settings'
import { USER_AGENT } from './userAgent'

// The street map under the photo dots. Each picture ("tile") comes from OpenStreetMap's free tile server, is saved in a folder on this computer
// and is read from there next time, so a place you have already looked at loads at once and works offline. Only "show me this square of the
// map" leaves your computer; no photo or personal detail does. OpenStreetMap asks apps to identify themselves, to keep to two requests at a time
// and to keep what they download for at least a week, and this follows all three.

const SERVER = 'https://tile.openstreetmap.org'
export const FRESH_DAYS = 7
const MAX_AT_ONCE = 2
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

async function download(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    return bytes.length <= MAX_TILE_BYTES && isPng(bytes) ? bytes : null
  } catch { return null }
}

let waiting: (() => void)[] = []
let running = 0
async function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  if (running >= MAX_AT_ONCE) await new Promise<void>(resolve => waiting.push(resolve))
  running++
  try { return await job() } finally { running--; waiting.shift()?.() }
}

const inFlight = new Map<string, Promise<Uint8Array | null>>()
const failedAt = new Map<string, number>()

/** The picture for one tile: the saved copy if it is under a week old, else a fresh download (an older saved copy still stands in if the download fails). */
export function getTile(z: number, x: number, y: number, deps: TileDeps): Promise<Uint8Array | null> {
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
    if (!got) { failedAt.set(key, deps.now()); return stale }
    failedAt.delete(key)
    try { mkdirSync(join(deps.dir, String(z), String(x)), { recursive: true }); writeFileSync(file, got); deps.onSaved?.(got.length) } catch { /* it still shows this time */ }
    return got
  })().finally(() => inFlight.delete(key))
  inFlight.set(key, job)
  return job
}

function listFiles(dir: string): { path: string; size: number; at: number }[] {
  const files: { path: string; size: number; at: number }[] = []
  if (!existsSync(dir)) return files
  const walk = (d: string): void => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name)
      if (name.isDirectory()) walk(p)
      else try { const s = statSync(p); files.push({ path: p, size: s.size, at: s.mtimeMs }) } catch { /* gone already */ }
    }
  }
  walk(dir)
  return files
}

/** How much the saved pictures take now. */
export function cacheSize(dir: string): MapCacheInfo {
  const files = listFiles(dir)
  return { bytes: files.reduce((n, f) => n + f.size, 0), files: files.length }
}

/** Keep the saved pictures within a limit: past it, the oldest go until 80% of the limit is left (so it is not trimmed again on the very next picture). */
export function trimCache(dir: string, limitBytes: number): number {
  const files = listFiles(dir)
  let total = files.reduce((n, f) => n + f.size, 0)
  if (total <= limitBytes) return 0
  let removed = 0
  for (const f of files.sort((a, b) => a.at - b.at)) {
    if (total <= limitBytes * TRIM_TO) break
    try { unlinkSync(f.path); total -= f.size; removed++ } catch { /* leave it */ }
  }
  return removed
}

/** Remembers how big the folder is, so it is measured once and then only added to, and trims it when it passes the limit. */
export function cacheKeeper(dir: string): { saved: (added: number, limitBytes: number) => void; reset: () => void } {
  let bytes: number | null = null
  return {
    saved(added, limitBytes) {
      bytes = bytes === null ? cacheSize(dir).bytes : bytes + added   // the first measure already includes whatever was just saved
      if (bytes > limitBytes) { trimCache(dir, limitBytes); bytes = cacheSize(dir).bytes }
    },
    reset() { bytes = null }
  }
}

export function registerTileIpc(): void {
  const dir = join(app.getPath('userData'), 'map-tiles')
  const keeper = cacheKeeper(dir)
  ipcMain.handle('map:tile', async (_event, z: number, x: number, y: number) => {
    const settings = loadSettings()
    if (settings.mapStreet !== true) return null   // nothing is ever asked of OpenStreetMap unless the street map is on
    const limit = cacheLimitMb(settings.mapCacheMb) * MB
    keeper.saved(0, limit)                            // also trims right away if the limit was lowered since last time
    return getTile(z, x, y, { dir, fetchTile: download, now: Date.now, onSaved: n => keeper.saved(n, limit) })
  })
  ipcMain.handle('map:cacheInfo', (): MapCacheInfo => cacheSize(dir))
  ipcMain.handle('map:cacheClear', (): void => { rmSync(dir, { recursive: true, force: true }); keeper.reset() })
}
