// "Download updated photos": whether a photo has changed on Flickr since it was last saved.
// A stored update time of 0 means the time was not known when the photo was saved (a download from a selection does not know it), so that
// photo is never called changed: otherwise every photo saved through a selection would download again each time.
export function changedSinceSaved(record: { flickrLastUpdate: number } | undefined, photo: { lastUpdate?: number }): boolean {
  return record != null && record.flickrLastUpdate > 0 && (photo.lastUpdate ?? 0) > record.flickrLastUpdate
}
