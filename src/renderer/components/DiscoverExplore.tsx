import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import type { FlickrPhoto, PhotoPage } from '../../shared/types'
import PhotoDetail from './PhotoDetail'
import { GridIcon, ListIcon, JustifiedIcon, sharedStyles as ss, type PhotoViewMode, PhotoListRow, loadPhotoViewMode, savePhotoViewMode, loadRowHeight, saveRowHeight, computeJustifiedRows } from './PhotoGridShared'

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
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [exploreViewMode, setExploreViewMode] = useState<PhotoViewMode>(loadPhotoViewMode)
  const [rowHeight, setRowHeight] = useState<number>(loadRowHeight)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const gridContainerRef = useRef<HTMLDivElement>(null)

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
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
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
      </div>
    )
  }

  const toggleSelect = (id: string): void => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useLayoutEffect(() => {
    if (loading) return
    if (gridContainerRef.current) {
      setContainerWidth(Math.round(gridContainerRef.current.getBoundingClientRect().width))
    }
  }, [loading, exploreViewMode])

  useEffect(() => {
    if (loading) return
    const el = gridContainerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.round(entry.contentRect.width))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loading, exploreViewMode])

  const exploreJustifiedRows = useMemo(() => {
    if (exploreViewMode !== 'justified' || containerWidth === 0) return null
    return computeJustifiedRows(photos, containerWidth, rowHeight)
  }, [photos, exploreViewMode, containerWidth, rowHeight])

  const handleDownloadSelected = async (): Promise<void> => {
    const selected = photos.filter(p => selectedIds.has(p.id)).map(p => ({ id: p.id, title: p.title }))
    if (!selected.length) return
    setDownloading(true)
    try {
      await window.flickrAPI.startDiscoverSelectedBatch(selected, 'Explore', ['Explore'])
    } finally {
      setDownloading(false)
      setSelectMode(false)
      setSelectedIds(new Set())
    }
  }

  return (
    <div style={s.container}>
      <div style={s.stickyHeader}>
        <div style={s.headerRow}>
          <div>
            <h2 style={s.heading}>Explore</h2>
            <p style={s.subheading}>Today's most interesting photos on Flickr</p>
          </div>
          {photos.length > 0 && !selectMode && (
            <button style={s.selectToggleBtn} onClick={() => setSelectMode(true)}>Select</button>
          )}
        </div>
        {selectMode && (
          <DiscoverSelectBar
            count={selectedIds.size}
            total={photos.length}
            onDownload={handleDownloadSelected}
            onClearSelection={() => setSelectedIds(new Set())}
            onCancel={() => { setSelectMode(false); setSelectedIds(new Set()) }}
            downloading={downloading}
          />
        )}
        {!selectMode && photos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '6px' }}>
            <div style={{ flex: 1 }} />
            <div style={ss.segGroupDensity}>
              <button style={{ ...ss.densityBtn, ...(exploreViewMode === 'list' ? ss.densityBtnActive : {}) }} onClick={() => { const m: PhotoViewMode = 'list'; setExploreViewMode(m); savePhotoViewMode(m) }}>
                <ListIcon />
              </button>
              <button style={{ ...ss.densityBtn, ...(exploreViewMode === 'grid' ? ss.densityBtnActive : {}) }} onClick={() => { const m: PhotoViewMode = 'grid'; setExploreViewMode(m); savePhotoViewMode(m) }}>
                <GridIcon size="medium" />
              </button>
              <button style={{ ...ss.densityBtn, ...(exploreViewMode === 'justified' ? ss.densityBtnActive : {}) }} onClick={() => { const m: PhotoViewMode = 'justified'; setExploreViewMode(m); savePhotoViewMode(m) }}>
                <JustifiedIcon />
              </button>
              {exploreViewMode !== 'list' && (
                <input type="range" min={100} max={300} step={5} value={rowHeight}
                  onChange={e => { const v = Number(e.target.value); setRowHeight(v); saveRowHeight(v) }}
                  style={ss.rowHeightSlider}
                  title={exploreViewMode === 'justified' ? `Row height: ${rowHeight}px` : `Tile size: ${rowHeight}px`}
                />
              )}
            </div>
          </div>
        )}
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
          {exploreViewMode === 'list' ? (
            <div style={ss.listContainer}>
              {photos.map((photo, idx) => (
                <PhotoListRow
                  key={photo.id}
                  photo={photo}
                  isDownloaded={false}
                  isSelected={selectMode ? selectedIds.has(photo.id) : undefined}
                  selectMode={selectMode}
                  onClick={() => selectMode ? toggleSelect(photo.id) : setDetailIndex(idx)}
                />
              ))}
            </div>
          ) : exploreViewMode === 'grid' ? (
            <div style={{ display: 'grid', gap: '4px', gridTemplateColumns: `repeat(auto-fill, minmax(${rowHeight}px, 1fr))` }}>
              {photos.map((photo, idx) => (
                <DiscoverTile
                  key={photo.id}
                  photo={photo}
                  onClick={() => !selectMode && setDetailIndex(idx)}
                  selectMode={selectMode}
                  selected={selectedIds.has(photo.id)}
                  onSelect={() => toggleSelect(photo.id)}
                />
              ))}
            </div>
          ) : (
            <div ref={gridContainerRef} style={s.justifiedContainer}>
              {exploreJustifiedRows && (() => {
                let gIdx = 0
                return exploreJustifiedRows.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    {row.photos.map((photo, pi) => {
                      const photoIdx = gIdx++
                      const isSelected = selectMode && selectedIds.has(photo.id)
                      return (
                        <div key={photo.id} style={{
                          position: 'relative', width: `${row.widths[pi]}px`, height: `${row.height}px`,
                          flexShrink: 0, overflow: 'hidden', borderRadius: '2px', cursor: 'pointer',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          ...(isSelected ? { outline: '3px solid var(--ff-pink)', outlineOffset: '-3px', zIndex: 1 } : {}),
                          ...(selectMode && !isSelected ? { opacity: 0.75 } : {}),
                          ...(!selectMode && hoveredId === photo.id ? { transform: 'scale(1.015)', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 2 } : {})
                        }}
                          onMouseEnter={() => setHoveredId(photo.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onClick={() => selectMode ? toggleSelect(photo.id) : setDetailIndex(photoIdx)}
                        >
                          <img src={photo.url_m || photo.thumbnailUrl} alt={photo.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                          {photo.media === 'video' && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                              <svg width="30" height="30" viewBox="0 0 30 30" fill="none"><circle cx="15" cy="15" r="15" fill="rgba(0,0,0,0.52)"/><polygon points="12,9 23,15 12,21" fill="white"/></svg>
                            </div>
                          )}
                          {!selectMode && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', padding: '6px 8px', opacity: hoveredId === photo.id ? 1 : 0, transition: 'opacity 0.15s ease' }}>
                              <span style={{ color: '#fff', fontSize: '12px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{photo.title}</span>
                            </div>
                          )}
                          {selectMode && (
                            <div style={{ position: 'absolute', top: '6px', right: '6px', width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${isSelected ? 'var(--ff-pink)' : 'rgba(255,255,255,0.9)'}`, backgroundColor: isSelected ? 'var(--ff-pink)' : 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {isSelected && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>✓</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))
              })()}
            </div>
          )}
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
  selectMode?: boolean
  selected?: boolean
  onSelect?: () => void
}

export function DiscoverTile({ photo, onClick, selectMode, selected, onSelect }: TileProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const handleClick = (): void => {
    if (selectMode) onSelect?.()
    else onClick()
  }
  return (
    <div
      style={{ ...s.tile, ...(hovered ? s.tileHover : {}), ...(selected ? s.tileSelected : {}) }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={photo.title}
    >
      {photo.thumbnailUrl
        ? <img src={photo.thumbnailUrl} alt={photo.title} style={s.thumb} loading="lazy" />
        : <div style={s.thumbPlaceholder} />
      }
      {selected && <div style={s.checkOverlay}><span style={s.check}>✓</span></div>}
      {!selected && hovered && (
        <div style={s.overlay}>
          <span style={s.overlayTitle}>{photo.title || 'Untitled'}</span>
          {photo.media === 'video' && <span style={s.videoTag}>Video</span>}
        </div>
      )}
    </div>
  )
}

interface SelectBarProps {
  count: number
  total: number
  onDownload: () => void
  onCancel: () => void
  onClearSelection: () => void
  downloading?: boolean
}

export function DiscoverSelectBar({ count, onDownload, onCancel, onClearSelection, downloading }: SelectBarProps): React.JSX.Element {
  return (
    <div style={sb.bar}>
      <span style={sb.label}>{count} photos selected</span>
      {count > 0 && (
        <button style={sb.clearBtn} onClick={onClearSelection}>Clear Selection</button>
      )}
      <div style={{ flex: 1 }} />
      <button
        style={{ ...sb.downloadBtn, ...(count === 0 || downloading ? sb.downloadBtnDisabled : {}) }}
        disabled={count === 0 || downloading}
        onClick={onDownload}
      >
        {downloading ? 'Queueing…' : `↓ Download Selected (${count})`}
      </button>
      <button style={sb.cancelBtn} onClick={onCancel}>Cancel</button>
    </div>
  )
}

const sb: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex', alignItems: 'center',
    gap: '10px', padding: '8px 0',
    borderBottom: '1px solid #e8e4de', marginBottom: '4px',
  },
  label: { fontSize: '13px', color: '#555' },
  clearBtn: {
    background: 'none', border: '1px solid #ccc', borderRadius: '6px',
    padding: '5px 12px', fontSize: '13px', color: '#555', cursor: 'pointer', flexShrink: 0,
  },
  downloadBtn: {
    backgroundColor: 'var(--ff-pink-action)', color: '#fff', border: 'none',
    borderRadius: '6px', padding: '6px 14px', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer', flexShrink: 0,
  },
  downloadBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  cancelBtn: {
    background: 'none', border: 'none', padding: '5px 8px',
    fontSize: '13px', fontWeight: 600, color: 'var(--ff-text-secondary)', cursor: 'pointer',
  },
}

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px 32px' },
  stickyHeader: { position: 'sticky' as const, top: 0, zIndex: 10, background: '#fff', paddingBottom: '8px' },
  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: '20px' },
  heading: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#1a1a1a' },
  subheading: { margin: '4px 0 0', fontSize: '13px', color: '#888' },
  attrNotice: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    background: '#fdf8f0', border: '1px solid #f0dfc0', borderRadius: '8px',
    padding: '10px 14px', fontSize: '12px', color: '#7a5a1a', lineHeight: 1.5
  },
  lockIcon: { fontSize: '14px', flexShrink: 0, marginTop: '1px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '4px' },
  justifiedContainer: { padding: '0' },
  tile: {
    position: 'relative', aspectRatio: '1', overflow: 'hidden',
    cursor: 'pointer', borderRadius: '4px', background: '#f0f0f0',
  },
  tileHover: { opacity: 0.9 },
  tileSelected: { outline: '3px solid var(--ff-pink)', outlineOffset: '-3px' },
  checkOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(255,0,132,0.25)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '6px',
  },
  check: {
    width: '20px', height: '20px', borderRadius: '50%', background: 'var(--ff-pink)',
    color: '#fff', fontSize: '11px', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
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
  errorState: { textAlign: 'center', color: 'var(--ff-error)', fontSize: '14px', paddingTop: '48px' },
  emptyState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
  selectToggleBtn: { padding: '6px 14px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#444', flexShrink: 0 },
}
