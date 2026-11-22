import { app, ipcMain, dialog, clipboard, nativeImage } from 'electron'
import type { BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'

// Support for the On This Day collage and card maker: fetching picture bytes for the canvas (Flickr's
// picture servers do not allow a web page to read them directly), saving the result, and copying it.

// Only Flickr's picture servers, and only over https
function allowed(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && (u.hostname === 'staticflickr.com' || u.hostname.endsWith('.staticflickr.com'))
  } catch { return false }
}

const MAX_IMAGE_BYTES = 64 * 1024 * 1024   // the collage asks for display sizes (a few hundred KB); this is only a safety stop

async function fetchImage(url: string): Promise<string | null> {
  if (!allowed(url)) return null
  try {
    // No redirects (the allowlist above only covers the address we were given) and a size cap
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error', headers: { 'User-Agent': 'FlickrFetch' } })
    const type = res.headers.get('content-type') ?? ''
    // A size Flickr does not have comes back as a small placeholder gif, not as an error
    if (!res.ok || !type.startsWith('image/') || type === 'image/gif') return null
    if (Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > MAX_IMAGE_BYTES) return null
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch { return null }
}

const PNG_PREFIX = 'data:image/png;base64,'

export function registerShareIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('share:image', (_e, url: string) => fetchImage(url))

  ipcMain.handle('share:savePng', async (_e, dataUrl: string, defaultName: string): Promise<string | null> => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_PREFIX)) return null
    const win = getWindow()
    const safeName = defaultName.replace(/[^\w.\- ]+/g, '_') || 'on-this-day.png'
    const options = { defaultPath: join(app.getPath('downloads'), safeName), filters: [{ name: 'Image', extensions: ['png'] }] }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    try {
      writeFileSync(result.filePath, Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64'))
    } catch (err) {
      const box = { type: 'error' as const, message: 'The image could not be saved', detail: err instanceof Error ? err.message : String(err) }
      if (win) await dialog.showMessageBox(win, box); else await dialog.showMessageBox(box)
      return null
    }
    return result.filePath
  })

  ipcMain.handle('share:copyImage', (_e, dataUrl: string): boolean => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_PREFIX)) return false
    const img = nativeImage.createFromDataURL(dataUrl)
    if (img.isEmpty()) return false
    clipboard.writeImage(img)
    return true
  })
}
