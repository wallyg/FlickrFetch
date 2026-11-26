import { formatDateStamp } from '../shared/dateStamp'
import type { FileNamingConfig, PhotoInfo } from '../shared/types'

// The name a photo is saved under (without its extension), built from the File naming settings.

const SIZE_TOKEN_MAP: Record<string, string> = {
  original: 'o',
  xlarge: 'xl',
  large: 'l',
  medium: 'm',
  small: 's',
  square: 'sq'
}

// macOS allows 255 bytes in one file name. The extension, ".part" while it downloads, "_2"… for a copy and ".json" for a sidecar are added
// to what is built here, so the name itself stays well under that. Counted in bytes: a Japanese character is 3, an emoji is 4.
export const MAX_NAME_BYTES = 200
const TITLE_CHARS = 150   // and no title is longer than this, whatever it is made of

const encoder = new TextEncoder()
export const byteLength = (s: string): number => encoder.encode(s).length

/** The start of `s` that fits in `max` bytes, cut between characters (never through the middle of an emoji). */
export function truncateBytes(s: string, max: number): string {
  let out = '', used = 0
  for (const ch of s) {
    const n = byteLength(ch)
    if (used + n > max) break
    out += ch; used += n
  }
  return out
}

/** Characters a file name cannot hold become "_" (this is also what keeps a typed "/" from making a folder, or ".." from leaving one). */
export const cleanForFileName = (s: string): string => s.replace(/[/\\:*?"<>|\u0000-\u001f]/g, '_')

export function buildFilename(
  config: FileNamingConfig,
  photoId: string,
  title: string,
  info: PhotoInfo,
  seqNum?: number,
  downloadSize?: string
): string {
  const s = cleanForFileName(config.separator)
  let titleStr = title || photoId
  if (config.subStripParens) titleStr = titleStr.replace(/[()]/g, '')
  if (config.subStripBrackets) titleStr = titleStr.replace(/[\[\]]/g, '')
  const fullTitle = Array.from(cleanForFileName(titleStr).trim()).slice(0, TITLE_CHARS).join('')
  const customText = cleanForFileName(config.customText.text.trim())

  // Everything but the title is fixed, so a name that is too long is made to fit by shortening the title
  const assemble = (titlePart: string): string => {
    const rawTitle = titlePart.trim()
    const safeTitle = config.charSubstitution ? rawTitle.replace(/\s+/g, s) : rawTitle

    let core: string
    switch (config.core) {
      case 'id':       core = photoId; break
      case 'id-title': core = `${photoId}${s}${safeTitle}`; break
      case 'title-id': core = `${safeTitle}${s}${photoId}`; break
      default:         core = safeTitle
    }

    const pre: string[] = []
    const suf: string[] = []

    if (config.date.position !== 'off' && info.dateTaken) {
      const d = formatDateStamp(config.date.format, info.dateTaken)
      config.date.position === 'prefix' ? pre.push(d) : suf.push(d)
    }
    if (config.sequence.position !== 'off' && seqNum != null) {
      const seq = String(seqNum).padStart(3, '0')
      config.sequence.position === 'prefix' ? pre.push(seq) : suf.push(seq)
    }
    if (config.customText.position !== 'off' && customText) {
      config.customText.position === 'prefix' ? pre.push(customText) : suf.push(customText)
    }
    if (config.sizeToken?.position && config.sizeToken.position !== 'off' && downloadSize) {
      const token = SIZE_TOKEN_MAP[downloadSize] ?? downloadSize
      config.sizeToken.position === 'prefix' ? pre.push(token) : suf.push(token)
    }

    const assembled = [...pre, core, ...suf].join(s)
    switch (config.caseTransform) {
      case 'lowercase': return assembled.toLowerCase()
      case 'uppercase': return assembled.toUpperCase()
      default: return assembled
    }
  }

  let part = fullTitle
  let name = assemble(part)
  while (byteLength(name) > MAX_NAME_BYTES && part.length > 0) {
    part = truncateBytes(part, Math.max(0, byteLength(part) - (byteLength(name) - MAX_NAME_BYTES))).trim()
    name = assemble(part)
  }
  if (byteLength(name) > MAX_NAME_BYTES) name = truncateBytes(name, MAX_NAME_BYTES)   // (only with huge custom text)
  // Never empty (that would save ".jpg") and never starting with a dot (that would hide the file in Finder)
  name = name.replace(/^\.+/, '_').trim()
  return name || photoId
}
