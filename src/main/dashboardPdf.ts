import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// "Save as PDF" on the Health Check dashboard: the window prints itself with the dashboard alone on the page (the screen marks the page for printing, and the
// print styles in index.html hide the rest and let the dashboard run over as many pages as it needs). The person picks where it goes, Downloads to start with.

const LETTER_COUNTRIES = ['US', 'CA', 'MX']

export async function saveDashboardPdf(getWindow: () => BrowserWindow | null): Promise<string | null> {
  const win = getWindow()
  if (!win) return null
  const day = new Date().toISOString().slice(0, 10)
  const options = { defaultPath: join(app.getPath('downloads'), `FlickrFetch library overview ${day}.pdf`), filters: [{ name: 'PDF', extensions: ['pdf'] }] }
  const picked = await dialog.showSaveDialog(win, options)
  if (picked.canceled || !picked.filePath) return null
  try {
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: LETTER_COUNTRIES.includes(app.getLocaleCountryCode()) ? 'Letter' : 'A4',
      margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    })
    writeFileSync(picked.filePath, pdf)
  } catch (err) {
    await dialog.showMessageBox(win, { type: 'error', message: 'Couldn\'t save the PDF', detail: err instanceof Error ? err.message : String(err) })
    return null
  }
  return picked.filePath
}

export function registerDashboardPdfIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('dashboard:savePdf', () => saveDashboardPdf(getWindow))
}
