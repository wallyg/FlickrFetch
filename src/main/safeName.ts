// A name made safe to use as a folder inside the download folder: no path characters, no leading dots (so it is never "." or ".." or hidden),
// and never empty. Album, collection, user and group names come from Flickr, some of them from other people.
export function safeFolderName(name: string): string {
  const cleaned = name.replace(/[/\\:*?"<>|]/g, '_').trim().replace(/^\.+/, '_').trim()
  return cleaned || '_'
}
