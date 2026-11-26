import { dialog, BrowserWindow } from 'electron'
import { createWriteStream, unlinkSync, existsSync, writeFileSync, renameSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import axios from 'axios'
import { USER_AGENT } from './userAgent'
import { embedMetadata, shouldSkipGps } from './exiftool'
import type { PhotoSize, PhotoInfo, DownloadSize, DownloadedSize, ConflictBehavior, MetadataSettings } from '../shared/types'


function pickSize(sizes: PhotoSize[], downloadSize: DownloadSize): PhotoSize | undefined {
  const videoSizes = sizes.filter((s) => s.media === 'video')
  const photoSizes = sizes.filter((s) => s.media === 'photo')

  if (videoSizes.length > 0) {
    return (
      videoSizes.find((s) => s.label === 'Video Original') ||
      videoSizes.find((s) => s.label === 'Video HD MP4') ||
      videoSizes[videoSizes.length - 1]
    )
  }

  const find = (...labels: string[]) => labels.reduce<PhotoSize | undefined>(
    (found, label) => found ?? photoSizes.find((s) => s.label === label),
    undefined
  )

  switch (downloadSize) {
    case 'xlarge':
      return find('Large 2048', 'Large 1600', 'Large', 'Original') ?? photoSizes[photoSizes.length - 1]
    case 'large':
      return find('Large', 'Large 1600', 'Medium 800', 'Original') ?? photoSizes[photoSizes.length - 1]
    case 'medium':
      return find('Medium 800', 'Medium 640', 'Medium', 'Large') ?? photoSizes[photoSizes.length - 1]
    case 'small':
      return find('Small 320', 'Small', 'Medium') ?? photoSizes[photoSizes.length - 1]
    case 'square':
      return find('Large Square', 'Square') ?? photoSizes[photoSizes.length - 1]
    case 'original':
    default:
      return find('Original', 'Large 2048') ?? photoSizes[photoSizes.length - 1]
  }
}

// Which size a photo will come down at, to save with its download record. "Limited" = the original was asked for and Flickr
// did not offer it (free accounts only get sizes up to 1024 px), so the copy is smaller than the original.
export function describeSize(sizes: PhotoSize[], downloadSize: DownloadSize = 'original'): DownloadedSize {
  const chosen = pickSize(sizes, downloadSize)
  if (!chosen) return { label: '', width: 0, height: 0, limited: false }
  const limited = downloadSize === 'original' && chosen.media === 'photo' && chosen.label !== 'Original'
  return { label: chosen.label, width: chosen.width, height: chosen.height, limited }
}

// Named "<file>.<ext>.json" so a photo and video sharing a base name get separate sidecars.
function writeSidecar(filePath: string, info: PhotoInfo, settings: MetadataSettings): void {
  if (!settings.writeSidecarJson) return
  try {
    const record = shouldSkipGps(info, settings)
      ? { ...info, latitude: null, longitude: null, locationName: undefined }
      : info
    writeFileSync(`${filePath}.json`, JSON.stringify(record, null, 2), 'utf-8')
  } catch (err) {
    process.stderr.write(`[flickrfetch] Sidecar JSON write failed: ${err}\n`)
  }
}

// A download that was cut off (the app was quit or crashed) leaves name.ext.part behind. Once per folder per session, old ones of ours
// (a photo or video extension, untouched for a day) are removed; anything else in the folder is left alone.
const sweptFolders = new Set<string>()
export function sweepStaleParts(folder: string): void {
  if (sweptFolders.has(folder)) return
  sweptFolders.add(folder)
  try {
    for (const name of readdirSync(folder)) {
      if (!/\.(jpe?g|png|gif|webp|tiff?|mp4|mov|m4v|avi)\.part$/i.test(name)) continue
      const file = join(folder, name)
      if (Date.now() - statSync(file).mtimeMs > 24 * 3600 * 1000) unlinkSync(file)
    }
  } catch { /* the folder may not exist yet or may not be readable: nothing to clean */ }
}

// `written` = the names already saved earlier in this same batch (compared without regard to capitals, as the Mac does). Two photos in one batch
// that come out with the same name must never replace each other, even when "overwrite" is chosen: that setting is for files from earlier runs.
export function resolveConflict(basePath: string, behavior: ConflictBehavior, written?: Set<string>): string | null {
  const taken = (p: string): boolean => existsSync(p) || !!written?.has(p.toLowerCase())
  if (!taken(basePath)) return basePath
  if (behavior === 'overwrite' && !written?.has(basePath.toLowerCase())) return basePath
  if (behavior === 'skip') return null

  // rename: append _2, _3, …
  const lastDot = basePath.lastIndexOf('.')
  const stem = lastDot >= 0 ? basePath.slice(0, lastDot) : basePath
  const ext = lastDot >= 0 ? basePath.slice(lastDot) : ''
  for (let n = 2; n <= 999; n++) {
    const candidate = `${stem}_${n}${ext}`
    if (!taken(candidate)) return candidate
  }
  return null  // 999 copies already: skip rather than overwrite one
}

const CONTENT_TYPE_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/tiff': 'tif',
}

function resolveExtension(url: string): string {
  const pathname = new URL(url).pathname
  const rawExt = pathname.split('.').pop()?.toLowerCase() || ''
  // A valid extension is 2–4 alpha chars
  if (/^[a-z]{2,4}$/.test(rawExt)) return rawExt
  // Flickr video play URLs contain /play/ and are always mp4
  if (pathname.includes('/play/')) return 'mp4'
  return 'jpg'
}

export async function downloadPhoto(
  sizes: PhotoSize[],
  photoTitle: string,
  win: BrowserWindow,
  signal?: AbortSignal,
  photoInfo?: PhotoInfo,
  metadataSettings?: MetadataSettings,
  downloadSize: DownloadSize = 'original',
): Promise<string | null> {
  const chosen = pickSize(sizes, downloadSize)
  if (!chosen) throw new Error('No downloadable size found')

  const ext = resolveExtension(chosen.source)
  const safeName = photoTitle.replace(/[/\\:*?"<>|]/g, '_').trim() || 'photo'
  const fileTypeName = ['mp4', 'mov', 'avi'].includes(ext) ? 'Video' : 'Image'

  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: `${safeName}.${ext}`,
    filters: [{ name: fileTypeName, extensions: [ext] }]
  })

  if (canceled || !filePath) return null

  const response = await axios<NodeJS.ReadableStream>({
    method: 'GET',
    url: chosen.source,
    responseType: 'stream',
    signal,
    timeout: 60000,   // no data for a minute: fail instead of hanging
    headers: { 'User-Agent': USER_AGENT }
  })

  const totalBytes = parseInt(String(response.headers['content-length'] || '0'), 10)
  let downloaded = 0

  response.data.on('data', (chunk: Buffer) => {
    downloaded += chunk.length
    if (totalBytes > 0) {
      const percent = Math.round((downloaded / totalBytes) * 100)
      win.webContents.send('download:progress', { percent })
    }
  })

  // Written under a temporary name and moved into place only when it is complete, so a failed or cancelled download never
  // damages a file that was already there (overwrite mode) and never leaves half a photo under the real name
  const partPath = `${filePath}.part`
  try {
    await pipeline(response.data, createWriteStream(partPath))
    renameSync(partPath, filePath)
  } catch (err) {
    if (existsSync(partPath)) unlinkSync(partPath)
    throw err
  }

  if (photoInfo && metadataSettings) {
    try {
      await embedMetadata(filePath, photoInfo, metadataSettings)
    } catch (err) {
      process.stderr.write(`[flickrfetch] ExifTool embedding failed: ${err}\n`)
    }
    writeSidecar(filePath, photoInfo, metadataSettings)
  }

  win.webContents.send('download:progress', { percent: 100 })

  return filePath
}

export type DownloadOutcome =
  | { status: 'downloaded'; filePath: string }
  | { status: 'skipped'; reason: 'collision' }
  | { status: 'skipped'; reason: 'size-unavailable' }

export async function downloadToFolder(
  sizes: PhotoSize[],
  filename: string,
  destFolder: string,
  signal?: AbortSignal,
  photoInfo?: PhotoInfo,
  conflictBehavior: ConflictBehavior = 'rename',
  downloadSize: DownloadSize = 'original',
  metadataSettings?: MetadataSettings,
  written?: Set<string>,   // the paths saved so far in this batch
): Promise<DownloadOutcome> {
  const chosen = pickSize(sizes, downloadSize)
  if (!chosen) return { status: 'skipped', reason: 'size-unavailable' }

  const ext = resolveExtension(chosen.source)
  sweepStaleParts(destFolder)
  const rawPath = join(destFolder, `${filename}.${ext}`)
  const filePath = resolveConflict(rawPath, conflictBehavior, written)
  if (filePath === null) return { status: 'skipped', reason: 'collision' }

  const response = await axios<NodeJS.ReadableStream>({
    method: 'GET',
    url: chosen.source,
    responseType: 'stream',
    signal,
    timeout: 60000,   // no data for a minute: fail instead of hanging
    headers: { 'User-Agent': USER_AGENT }
  })

  // Written under a temporary name and moved into place only when it is complete, so a failed or cancelled download never
  // damages a file that was already there (overwrite mode) and never leaves half a photo under the real name
  const partPath = `${filePath}.part`
  try {
    await pipeline(response.data, createWriteStream(partPath))
    renameSync(partPath, filePath)
    written?.add(filePath.toLowerCase())
  } catch (err) {
    if (existsSync(partPath)) unlinkSync(partPath)
    throw err
  }

  if (photoInfo && metadataSettings) {
    try {
      await embedMetadata(filePath, photoInfo, metadataSettings)
    } catch (err) {
      process.stderr.write(`[flickrfetch] ExifTool batch embed failed: ${err}\n`)
    }
    writeSidecar(filePath, photoInfo, metadataSettings)
  }

  return { status: 'downloaded', filePath }
}
