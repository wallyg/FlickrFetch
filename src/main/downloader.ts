import { dialog, BrowserWindow } from 'electron'
import { createWriteStream, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import axios from 'axios'
import { embedMetadata } from './exiftool'
import type { PhotoSize, PhotoInfo, DownloadSize, ConflictBehavior, MetadataSettings } from '../shared/types'

const USER_AGENT = 'FlickrFetch/0.1.0 (Electron desktop app; https://github.com/flickrfetch)'

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

function resolveConflict(basePath: string, behavior: ConflictBehavior): string | null {
  if (!existsSync(basePath)) return basePath
  if (behavior === 'overwrite') return basePath
  if (behavior === 'skip') return null

  // rename: append _2, _3, …
  const lastDot = basePath.lastIndexOf('.')
  const stem = lastDot >= 0 ? basePath.slice(0, lastDot) : basePath
  const ext = lastDot >= 0 ? basePath.slice(lastDot) : ''
  for (let n = 2; n <= 999; n++) {
    const candidate = `${stem}_${n}${ext}`
    if (!existsSync(candidate)) return candidate
  }
  return basePath  // give up and overwrite after 999
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

  try {
    await pipeline(response.data, createWriteStream(filePath))
  } catch (err) {
    if (existsSync(filePath)) unlinkSync(filePath)
    throw err
  }

  if (photoInfo && metadataSettings) {
    try {
      await embedMetadata(filePath, photoInfo, metadataSettings)
    } catch (err) {
      process.stderr.write(`[flickrfetch] ExifTool embedding failed: ${err}\n`)
    }
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
): Promise<DownloadOutcome> {
  const chosen = pickSize(sizes, downloadSize)
  if (!chosen) return { status: 'skipped', reason: 'size-unavailable' }

  const ext = resolveExtension(chosen.source)
  const rawPath = join(destFolder, `${filename}.${ext}`)
  const filePath = resolveConflict(rawPath, conflictBehavior)
  if (filePath === null) return { status: 'skipped', reason: 'collision' }

  const response = await axios<NodeJS.ReadableStream>({
    method: 'GET',
    url: chosen.source,
    responseType: 'stream',
    signal,
    headers: { 'User-Agent': USER_AGENT }
  })

  try {
    await pipeline(response.data, createWriteStream(filePath))
  } catch (err) {
    if (existsSync(filePath)) unlinkSync(filePath)
    throw err
  }

  if (photoInfo && metadataSettings) {
    try {
      await embedMetadata(filePath, photoInfo, metadataSettings)
    } catch (err) {
      process.stderr.write(`[flickrfetch] ExifTool batch embed failed: ${err}\n`)
    }
  }

  return { status: 'downloaded', filePath }
}
