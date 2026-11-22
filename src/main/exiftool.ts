import { exiftool } from 'exiftool-vendored'
import { extname } from 'path'
import type { PhotoInfo, MetadataSettings } from '../shared/types'
import { LICENSE_MAP } from '../shared/licenses'
import { descriptionToPlainText } from '../shared/description'

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v'])


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
    // Plain text by default (links written as "text (address)"); the Settings switch keeps Flickr's HTML
    const description = settings.keepDescriptionHtml ? info.description : descriptionToPlainText(info.description)
    if (description) {
      tags['ImageDescription'] = description
      tags['XMP:Description'] = description
      tags['IPTC:Caption-Abstract'] = description
    }
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
