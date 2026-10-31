import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { FlickrPhoto, PhotoPage } from '../../shared/types'

type MediaFilter = 'all' | 'photo' | 'video'
type GridSize = 'small' | 'medium' | 'large'
type SortOrder = 'album-order' | 'date-asc' | 'date-desc' | 'newest-posted' | 'oldest-posted'
type PrivacyFilter = 'all' | 'public' | 'friends' | 'family' | 'private'

const PRIVACY_OPTIONS: PrivacyFilter[] = ['all', 'public', 'friends', 'family', 'private']
const PRIVACY_LABELS: Record<PrivacyFilter, string> = { all: 'All', public: 'Public', friends: 'Friends', family: 'Family', private: 'Private' }

function getPrivacyLevel(photo: FlickrPhoto): PrivacyLevel {
  if (photo.ispublic === undefined) return 'public'
  if (photo.ispublic === 1) return 'public'
  if (photo.isfriend === 1) return 'friends'
  if (photo.isfamily === 1) return 'family'
  return 'private'
}

function PrivacyIcon({ level }: { level: PrivacyLevel }): React.JSX.Element | null {
  if (level === 'public') return null
  if (level === 'private') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
  if (level === 'family') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

interface AlbumPhotoGridProps {
  albumId: string
  onPhotoSelect: (photo: FlickrPhoto) => void
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (photo: FlickrPhoto, shiftKey: boolean) => void
  onPhotosLoaded?: (photos: FlickrPhoto[]) => void
}

const GRID_COLUMNS: Record<GridSize, string> = {
  small:  'repeat(auto-fill, minmax(110px, 1fr))',
  medium: 'repeat(auto-fill, minmax(160px, 1fr))',
  large:  'repeat(auto-fill, minmax(220px, 1fr))'
}

export default function AlbumPhotoGrid({ albumId, onPhotoSelect, selectMode, selectedIds, onToggleSelect, onPhotosLoaded }: AlbumPhotoGridProps): React.JSX.Element {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [pageInfo, setPageInfo] = useState<Pick<PhotoPage, 'page' | 'pages' | 'total'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const [sort, setSort] = useState<SortOrder>('album-order')
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [gridSize, setGridSize] = useState<GridSize>('medium')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyFilter>('all')

  const loadPage = useCallback(async (page: number) => {
    return window.flickrAPI.getAlbumPhotos(albumId, page)
  }, [albumId])

  useEffect(() => {
    setLoading(true)
    setPhotos([])
    loadPage(1)
      .then((data) => {
        setPhotos(data.photos)
        setPageInfo({ page: data.page, pages: data.pages, total: data.total })
        onPhotosLoaded?.(data.photos)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load photos'))
      .finally(() => setLoading(false))
  }, [loadPage])

  const handleLoadMore = async (): Promise<void> => {
    if (!pageInfo || pageInfo.page >= pageInfo.pages) return
    setLoadingMore(true)
    try {
      const data = await loadPage(pageInfo.page + 1)
      const updated = [...photos, ...data.photos]
      setPhotos(updated)
      setPageInfo({ page: data.page, pages: data.pages, total: data.total })
      onPhotosLoaded?.(updated)
    } finally {
      setLoadingMore(false)
    }
  }

  const sortedPhotos = useMemo(() => {
    if (sort === 'album-order') return photos
    return [...photos].sort((a, b) => {
      if (sort === 'date-asc' || sort === 'date-desc') {
        const da = a.dateTaken || ''
        const db = b.dateTaken || ''
        return sort === 'date-asc' ? da.localeCompare(db) : db.localeCompare(da)
      }
      const pa = parseInt(a.datePosted || '0')
      const pb = parseInt(b.datePosted || '0')
      return sort === 'oldest-posted' ? pa - pb : pb - pa
    })
  }, [photos, sort])

  const filteredPhotos = useMemo(() => {
    return sortedPhotos
      .filter(p => mediaFilter === 'all' || p.media === mediaFilter)
      .filter(p => privacyFilter === 'all' || getPrivacyLevel(p) === privacyFilter)
  }, [sortedPhotos, mediaFilter, privacyFilter])

  if (loading) return <div style={styles.center}><p style={styles.message}>Loading photos…</p></div>
  if (error) return <div style={styles.center}><p style={styles.message}>{error}</p></div>
  if (photos.length === 0) return <div style={styles.center}><p style={styles.message}>No photos in this album.</p></div>

  const hasMore = pageInfo ? pageInfo.page < pageInfo.pages : false

  return (
    <div style={styles.container}>
      {!selectMode && (
        <div style={styles.toolbar}>
          <div style={styles.segGroup}>
            {(['all', 'photo', 'video'] as MediaFilter[]).map(v => (
              <button key={v} style={{ ...styles.seg, ...(mediaFilter === v ? styles.segActive : {}) }} onClick={() => setMediaFilter(v)}>
                {v === 'all' ? 'All' : v === 'photo' ? 'Photos' : 'Videos'}
              </button>
            ))}
          </div>
          <div style={styles.segGroup}>
            {PRIVACY_OPTIONS.map(v => (
              <button key={v} style={{ ...styles.seg, ...(privacyFilter === v ? styles.segActive : {}) }} onClick={() => setPrivacyFilter(v)}>
                {PRIVACY_LABELS[v]}
              </button>
            ))}
          </div>
          <div style={styles.segGroup}>
            {(['small', 'medium', 'large'] as GridSize[]).map(v => (
              <button key={v} style={{ ...styles.seg, ...(gridSize === v ? styles.segActive : {}) }} onClick={() => setGridSize(v)}>
                {v === 'small' ? 'S' : v === 'medium' ? 'M' : 'L'}
              </button>
            ))}
          </div>
          <select style={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value as SortOrder)}>
            <option value="album-order">Album order</option>
            <option value="date-desc">Newest taken</option>
            <option value="date-asc">Oldest taken</option>
            <option value="newest-posted">Newest posted</option>
            <option value="oldest-posted">Oldest posted</option>
          </select>
        </div>
      )}

      {filteredPhotos.length === 0 && photos.length > 0 && (
        <div style={styles.emptyFilter}>
          <p style={styles.emptyFilterMsg}>No {mediaFilter !== 'all' ? mediaFilter + 's' : 'photos'} match the current filters.</p>
          <button style={styles.clearFiltersBtn} onClick={() => { setMediaFilter('all'); setPrivacyFilter('all') }}>Clear filters</button>
        </div>
      )}

      <div style={{ ...styles.grid, gridTemplateColumns: GRID_COLUMNS[gridSize] }}>
        {filteredPhotos.map((photo) => {
          const isSelected = selectMode && (selectedIds?.has(photo.id) ?? false)
          const privacyLevel = getPrivacyLevel(photo)
          return (
            <div
              key={photo.id}
              style={{
                ...styles.tile,
                ...(isSelected ? { outline: '3px solid #FF0084', outlineOffset: '-3px', zIndex: 1 } : {}),
                ...(selectMode && !isSelected ? { opacity: 0.75 } : {})
              }}
              onClick={(e) => selectMode ? onToggleSelect?.(photo, e.shiftKey) : onPhotoSelect(photo)}
              onMouseEnter={() => setHoveredId(photo.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <img src={photo.thumbnailUrl} alt={photo.title} style={styles.thumb} />
              {photo.media === 'video' && (
                <div style={styles.videoOverlay}>
                  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                    <circle cx="15" cy="15" r="15" fill="rgba(0,0,0,0.52)"/>
                    <polygon points="12,9 23,15 12,21" fill="white"/>
                  </svg>
                </div>
              )}
              {privacyLevel !== 'public' && (
                <div style={styles.privacyBadge} title={privacyLevel === 'private' ? 'Private' : privacyLevel === 'friends' ? 'Friends only' : 'Family only'}>
                  <PrivacyIcon level={privacyLevel} />
                </div>
              )}
              {!selectMode && (
                <div style={{
                  ...styles.overlay,
                  opacity: hoveredId === photo.id ? 1 : 0,
                  background: hoveredId === photo.id ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0)'
                }}>
                  <span style={styles.overlayTitle}>{photo.title}</span>
                </div>
              )}
              {selectMode && (
                <div style={{
                  ...styles.selectBadge,
                  backgroundColor: isSelected ? '#FF0084' : 'rgba(255,255,255,0.75)',
                  border: isSelected ? '2px solid #FF0084' : '2px solid rgba(255,255,255,0.9)'
                }}>
                  {isSelected && <span style={styles.selectCheck}>✓</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {hasMore && (
        <div style={styles.loadMore}>
          <button style={styles.loadMoreBtn} onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : `Load more (${(pageInfo!.total - photos.length).toLocaleString()} remaining)`}
          </button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' },
  message: { color: '#888', fontSize: '15px' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px 8px',
    flexWrap: 'wrap' as const,
    borderBottom: '1px solid #f0ede8'
  },
  segGroup: { display: 'flex', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' },
  seg: { background: 'none', border: 'none', borderRight: '1px solid #ddd', padding: '5px 10px', fontSize: '12px', color: '#666', cursor: 'pointer', lineHeight: 1 },
  segActive: { backgroundColor: '#f0ede8', color: '#111', fontWeight: '600' },
  sortSelect: { fontSize: '12px', color: '#555', border: '1px solid #ddd', borderRadius: '6px', padding: '5px 8px', background: 'none', cursor: 'pointer', marginLeft: 'auto' },
  grid: { display: 'grid', gap: '4px', padding: '4px' },
  tile: { position: 'relative', paddingBottom: '100%', overflow: 'hidden', cursor: 'pointer', backgroundColor: '#e8e4de' },
  thumb: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  videoOverlay: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  privacyBadge: { position: 'absolute', top: '5px', left: '5px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, cursor: 'default' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'flex-end', padding: '8px', opacity: 0, transition: 'opacity 0.15s' },
  overlayTitle: { color: '#fff', fontSize: '12px', fontWeight: '500', textShadow: '0 1px 3px rgba(0,0,0,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' },
  loadMore: { padding: '16px', textAlign: 'center' },
  loadMoreBtn: { background: 'transparent', border: '1px solid #ccc', borderRadius: '6px', padding: '8px 20px', fontSize: '13px', color: '#555', cursor: 'pointer' },
  selectBadge: { position: 'absolute' as const, top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  selectCheck: { color: '#fff', fontSize: '13px', fontWeight: 'bold', lineHeight: 1 },
  emptyFilter: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px 24px', textAlign: 'center' as const },
  emptyFilterMsg: { color: '#888', fontSize: '14px', margin: 0 },
  clearFiltersBtn: { background: 'none', border: '1px solid #ccc', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', color: '#555', cursor: 'pointer' }
}
