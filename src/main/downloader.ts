import { dialog, BrowserWindow } from 'electron'
import { createWriteStream, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import axios from 'axios'
import { embedMetadata } from './exiftool'
import type { PhotoSize, PhotoInfo } from '../shared/types'

const USER_AGENT = 'FlickrFetch/0.1.0 (Electron desktop app; https://github.com/flickrfetch)'

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
  photoInfo?: PhotoInfo
): Promise<string | null> {
  const videoSizes = sizes.filter((s) => s.media === 'video')
  const photoSizes = sizes.filter((s) => s.media === 'photo')

  const original = videoSizes.length > 0
    ? (videoSizes.find((s) => s.label === 'Video Original') ||
       videoSizes.find((s) => s.label === 'Video HD MP4') ||
       videoSizes[videoSizes.length - 1])
    : (photoSizes.find((s) => s.label === 'Original') ||
       photoSizes.find((s) => s.label === 'Large 2048') ||
       photoSizes[photoSizes.length - 1])

  if (!original) throw new Error('No downloadable size found')

  const ext = resolveExtension(original.source)
  const safeName = photoTitle.replace(/[/\\:*?"<>|]/g, '_').trim() || 'photo'
  const fileTypeName = ['mp4', 'mov', 'avi'].includes(ext) ? 'Video' : 'Image'

  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: `${safeName}.${ext}`,
    filters: [{ name: fileTypeName, extensions: [ext] }]
  })

  if (canceled || !filePath) return null

  const response = await axios<NodeJS.ReadableStream>({
    method: 'GET',
    url: original.source,
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

  if (photoInfo) {
    try {
      await embedMetadata(filePath, photoInfo)
    } catch (err) {
      process.stderr.write(`[flickrfetch] ExifTool embedding failed: ${err}\n`)
    }
  }

  win.webContents.send('download:progress', { percent: 100 })

  return filePath
}

export async function downloadToFolder(
  sizes: PhotoSize[],
  filename: string,
  destFolder: string,
  signal?: AbortSignal,
  photoInfo?: PhotoInfo
): Promise<string> {
  const videoSizes = sizes.filter((s) => s.media === 'video')
  const photoSizes = sizes.filter((s) => s.media === 'photo')

  const original = videoSizes.length > 0
    ? (videoSizes.find((s) => s.label === 'Video Original') ||
       videoSizes.find((s) => s.label === 'Video HD MP4') ||
       videoSizes[videoSizes.length - 1])
    : (photoSizes.find((s) => s.label === 'Original') ||
       photoSizes.find((s) => s.label === 'Large 2048') ||
       photoSizes[photoSizes.length - 1])

  if (!original) throw new Error('No downloadable size found')

  const ext = resolveExtension(original.source)
  const filePath = join(destFolder, `${filename}.${ext}`)

  const response = await axios<NodeJS.ReadableStream>({
    method: 'GET',
    url: original.source,
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

  if (photoInfo) {
    try {
      await embedMetadata(filePath, photoInfo)
    } catch (err) {
      process.stderr.write(`[flickrfetch] ExifTool batch embed failed: ${err}\n`)
    }
  }

  return filePath
}
