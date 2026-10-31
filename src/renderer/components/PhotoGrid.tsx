import React, { useState, useEffect, useMemo } from 'react'
import type { FlickrPhoto } from '../../shared/types'

type MediaFilter = 'all' | 'photo' | 'video'
type GridSize = 'small' | 'medium' | 'large'
type SortOrder = 'date-posted-desc' | 'date-posted-asc' | 'date-taken-desc' | 'date-taken-asc'
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
  // friends
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

interface PhotoGridProps {
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

export default function PhotoGrid({ onPhotoSelect, selectMode, selectedIds, onToggleSelect, onPhotosLoaded }: PhotoGridProps): React.JSX.Element {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const [sort, setSort] = useState<SortOrder>('date-posted-desc')
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [gridSize, setGridSize] = useState<GridSize>('medium')
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyFilter>('all')

  const loadPage = async (pageNum: number, currentSort: SortOrder = sort): Promise<void> => {
    if (pageNum === 1) { setLoading(true); setPhotos([]) }
    else setLoadingMore(true)
    setError(null)
    try {
      const result = await window.flickrAPI.getPhotos(pageNum, currentSort)
      setPhotos(prev => pageNum === 1 ? result.photos : [...prev, ...result.photos])
      setPage(result.page)
      setPages(result.pages)
      setTotal(result.total)
      onPhotosLoaded?.(pageNum === 1 ? result.photos : [...photos, ...result.photos])
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to load photos'
      setError(raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => { loadPage(1) }, [])

  const handleSortChange = (newSort: SortOrder): void => {
    setSort(newSort)
    loadPage(1, newSort)
  }

  const filteredPhotos = useMemo(() => {
    return photos
      .filter(p => mediaFilter === 'all' || p.media === mediaFilter)
      .filter(p => privacyFilter === 'all' || getPrivacyLevel(p) === privacyFilter)
  }, [photos, mediaFilter, privacyFilter])

  if (loading) {
    return <div style={styles.centered}><p style={styles.mutedText}>Loading your photos…</p></div>
  }
  if (error) {
    return (
      <div style={styles.centered}>
        <p style={styles.errorText}>⚠️ {error}</p>
        <button style={styles.retryButton} onClick={() => loadPage(1)}>Try again</button>
      </div>
    )
  }
  if (photos.length === 0) {
    return <div style={styles.centered}><p style={styles.mutedText}>No photos found in your photostream.</p></div>
  }

  return (
    <div style={styles.wrapper}>
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
          <select style={styles.sortSelect} value={sort} onChange={e => handleSortChange(e.target.value as SortOrder)}>
            <option value="date-posted-desc">Newest posted</option>
            <option value="date-posted-asc">Oldest posted</option>
            <option value="date-taken-desc">Newest taken</option>
            <option value="date-taken-asc">Oldest taken</option>
          </select>
        </div>
      )}

      <p style={styles.countLabel}>
        Showing {filteredPhotos.length.toLocaleString()} of {total.toLocaleString()}
        {mediaFilter === 'photo' ? ' photos' : mediaFilter === 'video' ? ' videos' : ' photos & videos'}
        {page < pages ? ' (more below)' : ''}
      </p>

      {filteredPhotos.length === 0 && photos.length > 0 && (
        <div style={styles.emptyFilter}>
          <p style={styles.emptyFilterMsg}>No {mediaFilter !== 'all' ? mediaFilter + 's' : 'photos'} match the current filters.</p>
          <button style={styles.clearFiltersBtn} onClick={() => { setMediaFilter('all'); setPrivacyFilter('all') }}>Clear filters</button>
        </div>
      )}

      <div style={{ ...styles.grid, gridTemplateColumns: GRID_COLUMNS[gridSize] }}>
        {filteredPhotos.map(photo => {
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
              onMouseEnter={() => setHoveredId(photo.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => selectMode ? onToggleSelect?.(photo, e.shiftKey) : onPhotoSelect(photo)}
            >
              {photo.thumbnailUrl ? (
                <img src={photo.thumbnailUrl} alt={photo.title} style={styles.thumb} loading="lazy" />
              ) : (
                <div style={styles.thumbPlaceholder} />
              )}
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
              {!selectMode && hoveredId === photo.id && (
                <div style={styles.overlay}>
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
      {page < pages && (
        <div style={styles.loadMoreRow}>
          <button
            style={{ ...styles.loadMoreButton, ...(loadingMore ? styles.disabled : {}) }}
            onClick={() => loadPage(page + 1)}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { padding: '16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap' as const
  },
  segGroup: {
    display: 'flex',
    border: '1px solid #ddd',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  seg: {
    background: 'none',
    border: 'none',
    borderRight: '1px solid #ddd',
    padding: '5px 10px',
    fontSize: '12px',
    color: '#666',
    cursor: 'pointer',
    lineHeight: 1
  },
  segActive: {
    backgroundColor: '#f0ede8',
    color: '#111',
    fontWeight: '600'
  },
  sortSelect: {
    fontSize: '12px',
    color: '#555',
    border: '1px solid #ddd',
    borderRadius: '6px',
    padding: '5px 8px',
    background: 'none',
    cursor: 'pointer',
    marginLeft: 'auto'
  },
  countLabel: { fontSize: '12px', color: '#aaa', margin: '0 0 10px 0' },
  grid: { display: 'grid', gap: '4px' },
  tile: { position: 'relative', aspectRatio: '1', overflow: 'hidden', backgroundColor: '#e8e8e8', cursor: 'pointer' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbPlaceholder: { width: '100%', height: '100%', backgroundColor: '#d0d0d0' },
  videoOverlay: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  privacyBadge: { position: 'absolute', top: '5px', left: '5px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, cursor: 'default' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)', padding: '6px 8px' },
  overlayTitle: {
    color: '#fff',
    fontSize: '12px',
    lineHeight: '1.3',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  } as React.CSSProperties,
  centered: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' },
  mutedText: { color: '#888', fontSize: '15px', margin: 0 },
  errorText: { color: '#cc0000', fontSize: '14px', margin: 0 },
  retryButton: { backgroundColor: '#FF0084', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' },
  loadMoreRow: { display: 'flex', justifyContent: 'center', padding: '24px 0' },
  loadMoreButton: { backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '6px', padding: '10px 28px', fontSize: '14px', color: '#444', cursor: 'pointer' },
  disabled: { opacity: 0.6, cursor: 'not-allowed' },
  selectBadge: { position: 'absolute' as const, top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  selectCheck: { color: '#fff', fontSize: '13px', fontWeight: 'bold', lineHeight: 1 },
  emptyFilter: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px 24px', textAlign: 'center' as const },
  emptyFilterMsg: { color: '#888', fontSize: '14px', margin: 0 },
  clearFiltersBtn: { background: 'none', border: '1px solid #ccc', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', color: '#555', cursor: 'pointer' }
}
