import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import type { AppSettings, FileNamingConfig } from '../shared/types'

const SETTINGS_FILE = join(app.getPath('userData'), 'settings.json')

const DEFAULT_FILE_NAMING: FileNamingConfig = {
  core: 'title',
  separator: '.',
  date: { position: 'off', format: 'YYYY-MM-DD' },
  sequence: { position: 'off' },
  customText: { position: 'off', text: '' }
}

const defaults: AppSettings = {
  fileNaming: DEFAULT_FILE_NAMING,
  downloadFolder: join(app.getPath('pictures'), 'FlickrFetch'),
  showDockProgress: true,
  notifyOnComplete: true
}

export function ensureDownloadFolder(folder: string): void {
  try {
    mkdirSync(folder, { recursive: true })
  } catch {
    // ignore
  }
}

export function loadSettings(): AppSettings {
  if (!existsSync(SETTINGS_FILE)) return { ...defaults }
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'))
    // Migrate old string-based fileNaming to FileNamingConfig
    if (typeof raw.fileNaming === 'string') {
      const old = raw.fileNaming as string
      raw.fileNaming = {
        ...DEFAULT_FILE_NAMING,
        core: old === 'id' ? 'id' : old === 'id-title' ? 'id-title' : 'title',
        date: old === 'date-title'
          ? { position: 'prefix', format: 'YYYY-MM-DD' }
          : { position: 'off', format: 'YYYY-MM-DD' }
      } as FileNamingConfig
    }
    return {
      ...defaults,
      ...raw,
      fileNaming: { ...DEFAULT_FILE_NAMING, ...raw.fileNaming }
    }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(settings: AppSettings): void {
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
}
