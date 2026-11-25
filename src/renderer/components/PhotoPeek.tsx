import React, { useState } from 'react'
import PhotoDetail from './PhotoDetail'
import type { AlbumFitPhoto, FlickrPhoto } from '../../shared/types'

// The in-app photo view for lists that show only a thumbnail strip (the Map's side panel, the suggested photos in Album fit and Tags): the same view
// as the Photostream, over the whole window, with previous and next through the list and "Open on Flickr" inside it. A bare thumbnail never jumps
// out to the browser (#259). It loads its own details from the photo id.

const asFlickrPhoto = (p: AlbumFitPhoto): FlickrPhoto => ({ id: p.photoId, title: p.title, thumbnailUrl: p.thumbUrl, dateTaken: '' })

export default function PhotoPeek({ photos, start, sourceName, hasMore = false, loadMore, onClose }: {
  photos: AlbumFitPhoto[]
  start: number                       // which photo was clicked
  sourceName: string
  hasMore?: boolean                   // more photos could be loaded at the end of the list (the Map loads a page at a time)
  loadMore?: () => Promise<void>
  onClose: () => void
}): React.JSX.Element | null {
  const [index, setIndex] = useState(start)
  const photo = photos[index]
  if (!photo) return null
  const next = async (): Promise<void> => {
    if (index < photos.length - 1) setIndex(index + 1)
    else if (hasMore && loadMore) { await loadMore(); setIndex(i => i + 1) }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--ff-surface)' }}>
      <PhotoDetail
        photo={asFlickrPhoto(photo)} index={index} total={photos.length} hasMore={hasMore}
        canGoPrev={index > 0} canGoNext={index < photos.length - 1 || hasMore}
        onPrev={() => setIndex(i => Math.max(0, i - 1))} onNext={() => void next()} onClose={onClose} sourceName={sourceName}
      />
    </div>
  )
}
