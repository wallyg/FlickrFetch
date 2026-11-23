import { ipcMain, shell } from 'electron'

// Opens Flickr's own batch editor (Organizr) with photos already loaded into its tray, so the user can fix them there.
// FlickrFetch never edits anything: it only opens the page. The editor takes a few hundred photos at a time, so a big
// list goes in parts; the caller asks for one part at a time.

export const BATCH_SIZE = 500

export function batchUrl(ids: string[]): string {
  return `https://www.flickr.com/photos/organize/?start_tab=batch&ids=${ids.filter(i => /^\d+$/.test(i)).join(',')}`
}

export function registerBatchIpc(): void {
  // part is 0-based. Returns how many parts there are in all and how many photos this part held.
  ipcMain.handle('batch:open', (_event, ids: unknown, part: unknown): { parts: number; count: number } => {
    const clean = Array.isArray(ids) ? [...new Set(ids.filter((i): i is string => typeof i === 'string' && /^\d+$/.test(i)))] : []
    const parts = Math.ceil(clean.length / BATCH_SIZE)
    const p = Math.min(Math.max(Number.isInteger(part) ? (part as number) : 0, 0), Math.max(parts - 1, 0))
    const slice = clean.slice(p * BATCH_SIZE, (p + 1) * BATCH_SIZE)
    if (slice.length > 0) void shell.openExternal(batchUrl(slice))
    return { parts, count: slice.length }
  })
}
