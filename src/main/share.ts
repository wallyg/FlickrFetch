import { app, ipcMain, dialog, clipboard, nativeImage, ShareMenu } from 'electron'
import type { BrowserWindow } from 'electron'
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { safePngName, staleShareFiles } from './shareFile'

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
    const safeName = safePngName(defaultName)
    const options = { defaultPath: join(app.getPath('downloads'), safeName), filters: [{ name: 'Image', extensions: ['png'] }] }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    try {
      writeFileSync(result.filePath, Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64'))
    } catch (err) {
      const box = { type: 'error' as const, message: 'Couldn\'t save the image', detail: err instanceof Error ? err.message : String(err) }
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

  // The Mac share sheet (Mail, Messages, AirDrop, Notes...). It needs a file, so the picture is written to a folder of its own in the
  // system's temporary files; `x` and `y` are where the Share button sits in the window, so the sheet opens right under it.
  ipcMain.handle('share:shareImage', (_e, dataUrl: string, defaultName: string, x: number, y: number): boolean => {
    if (process.platform !== 'darwin') return false
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_PREFIX)) return false
    const win = getWindow()
    if (!win) return false
    try {
      const folder = join(app.getPath('temp'), 'FlickrFetch-share')
      mkdirSync(folder, { recursive: true })
      const now = Date.now()
      const waiting = readdirSync(folder).flatMap(name => { try { return [{ name, changedMs: statSync(join(folder, name)).mtimeMs }] } catch { return [] } })   // a file that vanished meanwhile is skipped
      for (const old of staleShareFiles(waiting, now)) { try { unlinkSync(join(folder, old)) } catch { /* it goes next time */ } }
      const file = join(folder, safePngName(defaultName))
      writeFileSync(file, Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64'))
      const menu = new ShareMenu({ filePaths: [file] })
      menu.popup({ window: win, x: Math.round(Number.isFinite(x) ? x : 0), y: Math.round(Number.isFinite(y) ? y : 0) })
      return true
    } catch { return false }
  })
}
