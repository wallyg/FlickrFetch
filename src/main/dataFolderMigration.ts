import { copyFileSync, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

// Earlier versions kept some files (the sign-in, the settings) in a folder named after the app ("FlickrFetch") and others (the history
// database, the On This Day file) in "flickr-fetch", because the folder was only chosen after the first group had already been located.
// This brings everything into one folder, once. It never touches the second folder's own files unless the first folder's copy is newer.

export const MERGE_MARKER = '.merged-from-old-folder'

const SIGN_IN = 'token.enc'
const SETTINGS = 'settings.json'
// Copied only when the new folder has none of its own
const KEEP_IF_MISSING = ['flickrfetch.db', 'flickrfetch.db-wal', 'flickrfetch.db-shm', 'on-this-day.json']

const mtime = (file: string): number => statSync(file).mtimeMs

/** Moves what the old folder holds into the new one. Returns a line for each thing it did (for the log and the tests). Safe to run on every launch: it does nothing after the first time. */
export function migrateDataFolder(oldDir: string, newDir: string): string[] {
  const did: string[] = []
  if (oldDir === newDir) return did
  mkdirSync(newDir, { recursive: true })
  const marker = join(newDir, MERGE_MARKER)
  if (existsSync(marker)) return did
  if (!existsSync(oldDir)) return did

  // The sign-in and the settings: whichever copy was saved last is the live one
  for (const name of [SIGN_IN, SETTINGS]) {
    const from = join(oldDir, name), to = join(newDir, name)
    if (!existsSync(from)) continue
    if (existsSync(to)) {
      if (mtime(from) <= mtime(to)) continue
      if (name === SETTINGS) { copyFileSync(to, `${to}.bak-pre-merge`); did.push(`${name}: the replaced copy was kept as ${name}.bak-pre-merge`) }
    }
    copyFileSync(from, to)
    did.push(`${name}: copied from the old folder`)
    // A second copy of the sign-in must not stay behind (it would come back after a sign-out on an older build)
    if (name === SIGN_IN) { try { unlinkSync(from); did.push(`${name}: the old copy was removed`) } catch { /* left where it was */ } }
  }

  // The history database and the On This Day file: only when there is nothing in the new folder yet
  if (!existsSync(join(newDir, 'flickrfetch.db'))) {
    for (const name of KEEP_IF_MISSING) {
      const from = join(oldDir, name), to = join(newDir, name)
      if (existsSync(from) && !existsSync(to)) { copyFileSync(from, to); did.push(`${name}: copied from the old folder`) }
    }
  } else if (existsSync(join(oldDir, 'on-this-day.json')) && !existsSync(join(newDir, 'on-this-day.json'))) {
    copyFileSync(join(oldDir, 'on-this-day.json'), join(newDir, 'on-this-day.json'))
    did.push('on-this-day.json: copied from the old folder')
  }

  writeFileSync(marker, `Merged ${new Date().toISOString()}\n`)
  return did
}
