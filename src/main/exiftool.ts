import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { extname } from 'path'
import { promisify } from 'util'
import type { PhotoInfo, MetadataSettings } from '../shared/types'

const execFileAsync = promisify(execFile)

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v'])

const LICENSE_MAP: Record<string, { name: string; url: string }> = {
  '0':  { name: 'All Rights Reserved', url: '' },
  '1':  { name: 'CC BY-NC-SA 2.0', url: 'https://creativecommons.org/licenses/by-nc-sa/2.0/' },
  '2':  { name: 'CC BY-NC 2.0',    url: 'https://creativecommons.org/licenses/by-nc/2.0/' },
  '3':  { name: 'CC BY-NC-ND 2.0', url: 'https://creativecommons.org/licenses/by-nc-nd/2.0/' },
  '4':  { name: 'CC BY 2.0',       url: 'https://creativecommons.org/licenses/by/2.0/' },
  '5':  { name: 'CC BY-SA 2.0',    url: 'https://creativecommons.org/licenses/by-sa/2.0/' },
  '6':  { name: 'CC BY-ND 2.0',    url: 'https://creativecommons.org/licenses/by-nd/2.0/' },
  '7':  { name: 'No known copyright restrictions', url: 'https://www.flickr.com/commons/usage/' },
  '8':  { name: 'United States Government Work',   url: 'http://www.usa.gov/copyright.shtml' },
  '9':  { name: 'CC0 1.0',         url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  '10': { name: 'Public Domain Mark 1.0', url: 'https://creativecommons.org/publicdomain/mark/1.0/' },
}

function findExifTool(): string {
  for (const p of ['/usr/local/bin/exiftool', '/opt/homebrew/bin/exiftool']) {
    if (existsSync(p)) return p
  }
  throw new Error('ExifTool not found — please install it from exiftool.org')
}

export function isExifToolAvailable(): boolean {
  try { findExifTool(); return true } catch { return false }
}

function buildArgs(info: PhotoInfo, filePath: string, settings: MetadataSettings): string[] {
  const args: string[] = []
  const isVideo = VIDEO_EXTS.has(extname(filePath).toLowerCase())

  if (settings.embedTitle && info.title) {
    args.push(`-XMP:Title=${info.title}`)
    args.push(`-IPTC:ObjectName=${info.title}`)
  }

  if (settings.embedDescription && info.description) {
    args.push(`-ImageDescription=${info.description}`)
    args.push(`-XMP:Description=${info.description}`)
    args.push(`-IPTC:Caption-Abstract=${info.description}`)
  }

  if (settings.embedTags && info.tags.length > 0) {
    info.tags.forEach((tag, i) => {
      const op = i === 0 ? '=' : '+='
      args.push(`-XMP:Subject${op}${tag}`)
      args.push(`-IPTC:Keywords${op}${tag}`)
    })
  }

  if (settings.embedDateTaken && info.dateTaken) {
    const [datePart, timePart = '00:00:00'] = info.dateTaken.split(' ')
    const exifDate = `${datePart.replace(/-/g, ':')} ${timePart}`
    args.push(`-DateTimeOriginal=${exifDate}`)
    args.push(`-CreateDate=${exifDate}`)
  }

  if (settings.embedCreator && info.ownerName) {
    args.push(`-XMP:Creator=${info.ownerName}`)
    args.push(`-IPTC:By-line=${info.ownerName}`)
  }

  const skipGps = !settings.embedGps || (settings.stripGpsFromPrivate && info.isPrivate)
  if (!skipGps && info.latitude !== null && info.longitude !== null) {
    if (isVideo) {
      args.push(`-QuickTime:GPSCoordinates=${info.latitude} ${info.longitude}`)
    } else {
      args.push(`-GPSLatitude=${Math.abs(info.latitude)}`)
      args.push(`-GPSLatitudeRef=${info.latitude >= 0 ? 'N' : 'S'}`)
      args.push(`-GPSLongitude=${Math.abs(info.longitude)}`)
      args.push(`-GPSLongitudeRef=${info.longitude >= 0 ? 'E' : 'W'}`)
    }
  }

  if (settings.embedLicense) {
    const lic = LICENSE_MAP[info.license] ?? LICENSE_MAP['0']
    args.push(`-XMP-xmpRights:UsageTerms=${lic.name}`)
    if (lic.url) args.push(`-XMP-xmpRights:WebStatement=${lic.url}`)
  }

  if (settings.embedPhotoUrl && info.ownerPathAlias) {
    const photoUrl = `https://www.flickr.com/photos/${info.ownerPathAlias}/${info.id}/`
    args.push(`-XMP:Source=${photoUrl}`)
  }

  if (settings.embedPhotoId) {
    args.push(`-XMP:Identifier=${info.id}`)
  }

  args.push('-overwrite_original')
  args.push(filePath)

  return args
}

export async function embedMetadata(filePath: string, info: PhotoInfo, settings: MetadataSettings): Promise<void> {
  const exiftoolPath = findExifTool()
  const args = buildArgs(info, filePath, settings)
  if (args.length <= 2) return  // only -overwrite_original + path = nothing to embed
  await execFileAsync(exiftoolPath, args)
}
