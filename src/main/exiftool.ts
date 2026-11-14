import { exiftool } from 'exiftool-vendored'
import { extname } from 'path'
import type { PhotoInfo, MetadataSettings } from '../shared/types'

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
  '11': { name: 'CC BY 4.0',       url: 'https://creativecommons.org/licenses/by/4.0/' },
  '12': { name: 'CC BY-SA 4.0',    url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  '13': { name: 'CC BY-ND 4.0',    url: 'https://creativecommons.org/licenses/by-nd/4.0/' },
  '14': { name: 'CC BY-NC 4.0',    url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  '15': { name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  '16': { name: 'CC BY-NC-ND 4.0', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/' },
}

// ExifTool is bundled — always available
export function shouldSkipGps(info: PhotoInfo, settings: MetadataSettings): boolean {
  return !settings.embedGps || (settings.stripGpsFromPrivate && info.isPrivate)
}

export function isExifToolAvailable(): boolean {
  return true
}

// Called on app quit to clean up the long-running exiftool process
export async function endExifTool(): Promise<void> {
  await exiftool.end()
}

export async function embedMetadata(filePath: string, info: PhotoInfo, settings: MetadataSettings): Promise<void> {
  const isVideo = VIDEO_EXTS.has(extname(filePath).toLowerCase())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tags: Record<string, any> = {}

  if (settings.embedTitle && info.title) {
    tags['XMP:Title'] = info.title
    tags['IPTC:ObjectName'] = info.title
  }

  if (settings.embedDescription && info.description) {
    tags['ImageDescription'] = info.description
    tags['XMP:Description'] = info.description
    tags['IPTC:Caption-Abstract'] = info.description
  }

  if (settings.embedTags && info.tags.length > 0) {
    tags['XMP:Subject'] = info.tags
    tags['IPTC:Keywords'] = info.tags
  }

  if (settings.embedDateTaken && info.dateTaken) {
    const [datePart, timePart = '00:00:00'] = info.dateTaken.split(' ')
    const exifDate = `${datePart.replace(/-/g, ':')} ${timePart}`
    tags['DateTimeOriginal'] = exifDate
    tags['CreateDate'] = exifDate
  }

  if (settings.embedCreator && info.ownerName) {
    tags['XMP:Creator'] = info.ownerName
    tags['IPTC:By-line'] = info.ownerName
  }

  if (!shouldSkipGps(info, settings) && info.latitude !== null && info.longitude !== null) {
    if (isVideo) {
      tags['QuickTime:GPSCoordinates'] = `${info.latitude} ${info.longitude}`
    } else {
      tags['GPSLatitude'] = Math.abs(info.latitude)
      tags['GPSLatitudeRef'] = info.latitude >= 0 ? 'N' : 'S'
      tags['GPSLongitude'] = Math.abs(info.longitude)
      tags['GPSLongitudeRef'] = info.longitude >= 0 ? 'E' : 'W'
    }
  }

  if (settings.embedLicense) {
    const lic = LICENSE_MAP[info.license]
    if (lic) {
      tags['XMP-xmpRights:UsageTerms'] = lic.name
      if (lic.url) tags['XMP-xmpRights:WebStatement'] = lic.url
    }
  }

  if (settings.embedPhotoUrl && info.ownerPathAlias) {
    tags['XMP:Source'] = `https://www.flickr.com/photos/${info.ownerPathAlias}/${info.id}/`
  }

  if (settings.embedPhotoId) {
    tags['XMP:Identifier'] = info.id
  }

  if (Object.keys(tags).length === 0) return

  await exiftool.write(filePath, tags, ['-overwrite_original'])
}
