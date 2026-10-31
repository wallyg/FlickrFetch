import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { promisify } from 'util'
import type { PhotoInfo } from '../shared/types'

const execFileAsync = promisify(execFile)

function findExifTool(): string {
  for (const p of ['/usr/local/bin/exiftool', '/opt/homebrew/bin/exiftool']) {
    if (existsSync(p)) return p
  }
  throw new Error('ExifTool not found — please install it from exiftool.org')
}

function buildArgs(info: PhotoInfo, filePath: string): string[] {
  const args: string[] = []

  if (info.title) {
    args.push(`-XMP:Title=${info.title}`)
    args.push(`-IPTC:ObjectName=${info.title}`)
  }

  if (info.description) {
    args.push(`-ImageDescription=${info.description}`)
    args.push(`-XMP:Description=${info.description}`)
    args.push(`-IPTC:Caption-Abstract=${info.description}`)
  }

  info.tags.forEach((tag, i) => {
    const op = i === 0 ? '=' : '+='
    args.push(`-XMP:Subject${op}${tag}`)
    args.push(`-IPTC:Keywords${op}${tag}`)
  })

  if (info.dateTaken) {
    const [datePart, timePart = '00:00:00'] = info.dateTaken.split(' ')
    const exifDate = `${datePart.replace(/-/g, ':')} ${timePart}`
    args.push(`-DateTimeOriginal=${exifDate}`)
    args.push(`-CreateDate=${exifDate}`)
  }

  if (info.latitude !== null && info.longitude !== null) {
    args.push(`-GPSLatitude=${Math.abs(info.latitude)}`)
    args.push(`-GPSLatitudeRef=${info.latitude >= 0 ? 'N' : 'S'}`)
    args.push(`-GPSLongitude=${Math.abs(info.longitude)}`)
    args.push(`-GPSLongitudeRef=${info.longitude >= 0 ? 'E' : 'W'}`)
  }

  if (info.ownerName) {
    args.push(`-XMP:Creator=${info.ownerName}`)
    args.push(`-IPTC:By-line=${info.ownerName}`)
  }

  args.push('-overwrite_original')
  args.push(filePath)

  return args
}

export async function embedMetadata(filePath: string, info: PhotoInfo): Promise<void> {
  const exiftoolPath = findExifTool()
  const args = buildArgs(info, filePath)
  await execFileAsync(exiftoolPath, args)
}
