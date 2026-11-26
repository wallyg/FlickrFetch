import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Which database file belongs to which Flickr account. The library list (tags, health, albums, backup) and the download records live in one
// SQLite file per account, so signing in as someone else never shows or mixes in the first account's data, and signing back in shows your own.
//   The file every version before this one made (flickrfetch.db) is adopted by the first account that signs in, and a small note beside it
//   (db-owner.txt) says whose it is. Any other account gets a file of its own, named for its Flickr id.
export const LEGACY_DB = 'flickrfetch.db'
export const OWNER_NOTE = 'db-owner.txt'

export function accountDbFile(folder: string, nsid: string): string {
  const legacy = join(folder, LEGACY_DB)
  let owner = ''
  try { owner = readFileSync(join(folder, OWNER_NOTE), 'utf-8').trim() } catch { /* no note yet: nobody has claimed the file */ }
  if (!owner) {
    try { writeFileSync(join(folder, OWNER_NOTE), nsid, 'utf-8') } catch { /* cannot write the note: this account uses the file, as before */ }
    return legacy
  }
  if (owner === nsid) return legacy
  return join(folder, `flickrfetch-${nsid.replace(/[^A-Za-z0-9_-]/g, '_')}.db`)
}
