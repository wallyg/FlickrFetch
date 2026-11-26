import { app } from 'electron'
import { join } from 'path'
import { migrateDataFolder } from './dataFolderMigration'

// This file must be the FIRST thing the main process imports. The sign-in and settings modules work out where their files live as soon as
// they load, so the app's data folder has to be chosen before they do (it used to be chosen at the bottom of index.ts, too late for them).
// The name is pinned to the one used since the first release so an upgrade never changes the path.
const home = join(app.getPath('appData'), 'flickr-fetch')
const before = app.getPath('userData')
app.setPath('userData', home)
try {
  for (const line of migrateDataFolder(before, home)) process.stderr.write(`[flickrfetch] data folder: ${line}\n`)
} catch (err) {
  process.stderr.write(`[flickrfetch] data folder merge failed, carrying on: ${err}\n`)
}
