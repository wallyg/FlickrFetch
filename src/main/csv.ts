import { app, dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'

// Shared spreadsheet export for the audit and health lists.

// Spreadsheet programs run a cell that starts with = + - @ (or a tab or return) as a formula. Tags and
// titles are free text, so those get a leading apostrophe, which makes them show as plain text.
export function csvCell(s: string): string {
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

// Starts with a byte-order mark so Excel reads the file as UTF-8 (otherwise "Québec" shows as "QuÃ©bec")
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)

// Asks where to save (starting in Downloads, where people look for an exported file), then writes the
// file. Returns the path, or null when cancelled or when the file could not be written (the user is told why).
export async function saveCsvFile(getWindow: () => BrowserWindow | null, defaultName: string, header: string[], lines: string[][]): Promise<string | null> {
  const win = getWindow()
  const options = { defaultPath: join(app.getPath('downloads'), defaultName), filters: [{ name: 'Spreadsheet', extensions: ['csv'] }] }
  const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  try {
    writeFileSync(result.filePath, BYTE_ORDER_MARK + [header, ...lines].map(l => l.join(',')).join('\n') + '\n', 'utf-8')
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    const box = { type: 'error' as const, message: 'The spreadsheet could not be saved', detail }
    if (win) await dialog.showMessageBox(win, box)
    else await dialog.showMessageBox(box)
    return null
  }
  return result.filePath
}
