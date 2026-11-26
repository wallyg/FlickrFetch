import { join } from 'path'
import { safeFolderName } from './safeName'

// Where a download of chosen photos is saved. The name shown on the download bar ("Album (37 shown)", "On This Day, November 26 (3)",
// "Try again: Album") is only a label: the folder comes from `folderName` (a folder inside the download folder; '' is the download folder itself,
// as for the Photostream) or, for "Try again", from `targetFolder` (the exact folder the first try used).
export function selectedPlace(o: { downloadFolder: string; albumTitle: string; folderName?: string; targetFolder?: string }): { baseTitle: string; folder: string; zipName: string; photostream: boolean } {
  const baseTitle = o.albumTitle.replace(/ \(\d+ selected\)$/, '')
  const photostream = o.folderName !== undefined ? o.folderName === '' : baseTitle === 'Photostream'
  const name = o.folderName !== undefined ? o.folderName : baseTitle
  const folder = o.targetFolder ?? (photostream ? o.downloadFolder : join(o.downloadFolder, safeFolderName(name)))
  return { baseTitle, folder, zipName: photostream ? '' : safeFolderName(name), photostream }
}
