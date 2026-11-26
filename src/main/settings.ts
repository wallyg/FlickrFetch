import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs'
import type { AppSettings, FileNamingConfig, MetadataSettings } from '../shared/types'
import { DEFAULT_DATE_PATTERN, migrateDatePattern } from '../shared/dateStamp'

const SETTINGS_FILE = join(app.getPath('userData'), 'settings.json')

const DEFAULT_FILE_NAMING: FileNamingConfig = {
  core: 'title',
  separator: '.',
  date: { position: 'off', format: DEFAULT_DATE_PATTERN },
  sequence: { position: 'off' },
  customText: { position: 'off', text: '' },
  caseTransform: 'none',
  charSubstitution: false,
  sizeToken: { position: 'off' as const }
}

const DEFAULT_METADATA: MetadataSettings = {
  embedTitle: true,
  embedDescription: true,
  embedTags: true,
  embedDateTaken: true,
  embedCreator: true,
  embedGps: true,
  stripGpsFromPrivate: false,
  embedLicense: true,
  embedPhotoUrl: true,
  embedPhotoId: true,
  writeSidecarJson: false,
  keepDescriptionHtml: false,
}

const defaults: AppSettings = {
  fileNaming: DEFAULT_FILE_NAMING,
  downloadFolder: join(app.getPath('pictures'), 'FlickrFetch'),
  showDockProgress: true,
  notifyOnComplete: true,
  conflictBehavior: 'rename',
  downloadSize: 'original',
  openFinderOnComplete: true,
  metadata: DEFAULT_METADATA,
  onThisDayCard: true,
  onThisDayNotify: false,
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
          ? { position: 'prefix', format: DEFAULT_DATE_PATTERN }
          : { position: 'off', format: DEFAULT_DATE_PATTERN }
      } as FileNamingConfig
    }
    return {
      ...defaults,
      ...raw,
      fileNaming: {
        ...DEFAULT_FILE_NAMING,
        ...raw.fileNaming,
        date: { ...DEFAULT_FILE_NAMING.date, ...(raw.fileNaming?.date ?? {}), format: migrateDatePattern(raw.fileNaming?.date?.format) },
        sizeToken: { ...DEFAULT_FILE_NAMING.sizeToken, ...(raw.fileNaming?.sizeToken ?? {}) }
      },
      metadata: { ...DEFAULT_METADATA, ...(raw.metadata ?? {}) }
    }
  } catch {
    return { ...defaults }
  }
}

// For code that asks for the settings many times a second (the map's street pictures): the file is read again only when it has changed
let cached: { key: string; value: AppSettings } | null = null
export function loadSettingsCached(): AppSettings {
  try {
    const st = statSync(SETTINGS_FILE)
    const key = `${st.mtimeMs}:${st.size}`
    if (cached && cached.key === key) return cached.value
    const value = loadSettings()
    cached = { key, value }
    return value
  } catch { return loadSettings() }   // no file yet: the defaults
}

export function saveSettings(settings: AppSettings): void {
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
}

export function resetSettings(): AppSettings {
  const fresh = { ...defaults }
  saveSettings(fresh)
  return fresh
}
