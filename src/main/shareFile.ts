// Small rules for the picture files the collage maker writes (no Electron here, so they can be tested on their own).

/** A file name that is safe to write: letters, digits, dot, dash, space and underscore, always ending in .png. */
export function safePngName(name: string): string {
  const cleaned = String(name ?? '').replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').trim()
  if (!cleaned) return 'on-this-day.png'
  return /\.png$/i.test(cleaned) ? cleaned : `${cleaned}.png`
}

/** The Mac share sheet reads the file after it opens (AirDrop and Mail can take a moment), so a shared picture is kept for a day and then cleared. */
export const SHARE_FILE_KEEP_MS = 24 * 60 * 60 * 1000

/** Which of the files waiting in the share folder are old enough to delete. `files` is name + last-changed time (ms). */
export function staleShareFiles(files: { name: string; changedMs: number }[], nowMs: number): string[] {
  return files.filter(f => f.name.toLowerCase().endsWith('.png') && nowMs - f.changedMs > SHARE_FILE_KEEP_MS).map(f => f.name)
}
