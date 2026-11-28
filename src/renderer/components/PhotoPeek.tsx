import React, { useState } from 'react'
import PhotoDetail from './PhotoDetail'
import type { AlbumFitPhoto, FlickrPhoto } from '../../shared/types'

// The in-app photo view for lists that show only a thumbnail strip (the Map's side panel, the suggested photos in Album fit and Tags): the same view
// as the Photostream, over the whole window, with previous and next through the list and "Open on Flickr" inside it. A bare thumbnail never jumps
// out to the browser (#259). It loads its own details from the photo id.

const asFlickrPhoto = (p: AlbumFitPhoto): FlickrPhoto => {
  const base: FlickrPhoto = { id: p.photoId, title: p.title, thumbnailUrl: p.thumbUrl, dateTaken: p.dateTaken ?? '' }
  if (p.privacy === undefined) return base
  return { ...base, ispublic: p.privacy === 0 ? 1 : 0, isfriend: p.privacy === 1 || p.privacy === 3 ? 1 : 0, isfamily: p.privacy === 2 || p.privacy === 3 ? 1 : 0 }
}

export default function PhotoPeek({ photos, start, sourceName, hasMore = false, loadMore, onClose }: {
  photos: AlbumFitPhoto[]
  start: number                       // which photo was clicked
  sourceName: string
  hasMore?: boolean                   // more photos could be loaded at the end of the list (the Map loads a page at a time)
  loadMore?: () => Promise<number>   // how many photos it added; 0 when none could be loaded
  onClose: () => void
}): React.JSX.Element | null {
  const [index, setIndex] = useState(start)
  const at = Math.min(index, photos.length - 1)   // never past the end, even if the list is shorter than when it was opened
  const photo = photos[at]
  if (!photo) return null
  const next = async (): Promise<void> => {
    if (at < photos.length - 1) setIndex(at + 1)
    else if (hasMore && loadMore) { if ((await loadMore()) > 0) setIndex(at + 1) }   // a failed or empty load leaves the view where it is
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--ff-z-dialog)', background: 'var(--ff-surface)' }}>
      <PhotoDetail
        photo={asFlickrPhoto(photo)} index={at} total={photos.length} hasMore={hasMore}
        canGoPrev={at > 0} canGoNext={at < photos.length - 1 || hasMore}
        onPrev={() => setIndex(Math.max(0, at - 1))} onNext={() => void next()} onClose={onClose} sourceName={sourceName}
      />
    </div>
  )
}
