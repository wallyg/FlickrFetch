import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { FlickrPhoto, PhotoPage } from '../../shared/types'
import PhotoDetail from './PhotoDetail'

const GRID_COLS = 4

interface Props {
  onDownload?: (photo: FlickrPhoto) => void
}

export default function DiscoverExplore({ onDownload }: Props): React.JSX.Element {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const loadedRef = useRef(false)

  const loadPage = useCallback(async (p: number): Promise<void> => {
    if (p === 1) { setLoading(true); setError(null) }
    else setLoadingMore(true)
    try {
      const result: PhotoPage = await window.flickrAPI.discoverGetInterestingness(p)
      setPhotos(prev => p === 1 ? result.photos : [...prev, ...result.photos])
      setPage(result.page)
      setPages(result.pages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Explore feed')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadPage(1)
  }, [loadPage])

  const handlePrev = useCallback(() => {
    setDetailIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev))
  }, [])

  const handleNext = useCallback(() => {
    if (detailIndex === null) return
    if (detailIndex < photos.length - 1) {
      setDetailIndex(detailIndex + 1)
    } else if (page < pages) {
      loadPage(page + 1).then(() => setDetailIndex(detailIndex + 1))
    }
  }, [detailIndex, photos.length, page, pages, loadPage])

  if (detailIndex !== null && photos[detailIndex]) {
    const detailPhoto = photos[detailIndex]
    return (
      <PhotoDetail
        photo={detailPhoto}
        index={detailIndex}
        total={photos.length}
        hasMore={page < pages}
        canGoPrev={detailIndex > 0}
        canGoNext={detailIndex < photos.length - 1 || page < pages}
        onPrev={handlePrev}
        onNext={handleNext}
        onClose={() => setDetailIndex(null)}
        sourceName="Explore"
        discoverMode
      />
    )
  }

  return (
    <div style={s.container}>
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Explore</h2>
          <p style={s.subheading}>Today's most interesting photos on Flickr</p>
        </div>
      </div>

      <AttributionNotice />

      {loading && (
        <div style={s.loadingState}>Loading Explore…</div>
      )}

      {error && (
        <div style={s.errorState}>{error}</div>
      )}

      {!loading && !error && photos.length === 0 && (
        <div style={s.emptyState}>No photos found.</div>
      )}

      {photos.length > 0 && (
        <>
          <div style={s.grid}>
            {photos.map((photo, idx) => (
              <DiscoverTile
                key={photo.id}
                photo={photo}
                onClick={() => setDetailIndex(idx)}
              />
            ))}
          </div>
          {page < pages && (
            <div style={s.loadMoreRow}>
              <button
                style={s.loadMoreBtn}
                disabled={loadingMore}
                onClick={() => loadPage(page + 1)}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function AttributionNotice(): React.JSX.Element {
  return (
    <div style={s.attrNotice}>
      <span style={s.lockIcon}>🔒</span>
      <span>
        <strong>Creator, License, Photo URL, and Photo ID</strong> are always embedded when downloading Discover photos — required for proper attribution of others' work.
      </span>
    </div>
  )
}

interface TileProps {
  photo: FlickrPhoto
  onClick: () => void
}

export function DiscoverTile({ photo, onClick }: TileProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ ...s.tile, ...(hovered ? s.tileHover : {}) }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={photo.title}
    >
      {photo.thumbnailUrl
        ? <img src={photo.thumbnailUrl} alt={photo.title} style={s.thumb} />
        : <div style={s.thumbPlaceholder} />
      }
      {hovered && (
        <div style={s.overlay}>
          <span style={s.overlayTitle}>{photo.title || 'Untitled'}</span>
          {photo.media === 'video' && <span style={s.videoTag}>Video</span>}
        </div>
      )}
    </div>
  )
}

const TILE_SIZE = `calc((100% - ${(GRID_COLS - 1) * 4}px) / ${GRID_COLS})`

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px 32px' },
  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: '20px' },
  heading: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#1a1a1a' },
  subheading: { margin: '4px 0 0', fontSize: '13px', color: '#888' },
  attrNotice: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    background: '#fdf8f0', border: '1px solid #f0dfc0', borderRadius: '8px',
    padding: '10px 14px', fontSize: '12px', color: '#7a5a1a', lineHeight: 1.5
  },
  lockIcon: { fontSize: '14px', flexShrink: 0, marginTop: '1px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: `repeat(${GRID_COLS}, ${TILE_SIZE})`,
    gap: '4px',
  },
  tile: {
    position: 'relative', aspectRatio: '1', overflow: 'hidden',
    cursor: 'pointer', borderRadius: '4px', background: '#f0f0f0',
  },
  tileHover: { opacity: 0.9 },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbPlaceholder: { width: '100%', height: '100%', background: '#e8e8e8' },
  overlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    padding: '8px',
  },
  overlayTitle: { color: '#fff', fontSize: '11px', fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  videoTag: { color: '#ccc', fontSize: '10px', marginTop: '2px' },
  loadMoreRow: { display: 'flex', justifyContent: 'center', paddingTop: '8px' },
  loadMoreBtn: {
    padding: '8px 24px', borderRadius: '8px', border: '1px solid #ddd',
    background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#444'
  },
  loadingState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
  errorState: { textAlign: 'center', color: '#c0392b', fontSize: '14px', paddingTop: '48px' },
  emptyState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
}
