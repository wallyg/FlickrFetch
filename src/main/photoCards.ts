import { albumsDb } from './albumDb'
import { ownerNsid } from './owner'
import type { AlbumFitPhoto } from '../shared/types'

// Thumbnails, titles and Flickr links for a list of photo ids, in the order given, for the "Show the photos" strips (read from the local
// library list; nothing is fetched from Flickr). At most CAP photos.
const CAP = 400

export function photoCards(ids: string[]): AlbumFitPhoto[] {
  const db = albumsDb()
  const owner = ownerNsid()
  const want = ids.filter(i => typeof i === 'string').slice(0, CAP)
  const found = new Map<string, { title: string; thumb_url: string }>()
  if (want.length > 0) {
    const rows = db.prepare(`SELECT photo_id, title, thumb_url FROM photo_meta WHERE photo_id IN (${want.map(() => '?').join(',')})`).all(...want) as { photo_id: string; title: string; thumb_url: string }[]
    for (const r of rows) found.set(r.photo_id, r)
  }
  return want.map(id => ({
    photoId: id, title: found.get(id)?.title ?? '', thumbUrl: found.get(id)?.thumb_url ?? '',
    flickrUrl: owner ? `https://www.flickr.com/photos/${owner}/${id}` : `https://www.flickr.com/photo.gne?id=${id}`
  }))
}
