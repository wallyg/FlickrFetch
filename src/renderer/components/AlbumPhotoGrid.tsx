import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { FlickrPhoto, PhotoPage, SearchOperator, DateRangeField, TagMode } from '../../shared/types'
import { MediaFilter, GridSize, AlbumViewMode, DownloadFilter, PrivacyFilter, PrivacyLevel, PRIVACY_OPTIONS, PRIVACY_LABELS, GRID_COLUMNS, GridIcon, ListIcon, PrivacyIcon, Chip, Tooltip, PhotoListRow, DownloadFilterSelect, getPrivacyLevel, sharedStyles, DateMode, getPresetDates, formatDateChip, loadAlbumViewMode, saveAlbumViewMode, DOWNLOAD_FILTER_LABEL } from './PhotoGridShared'

type SortOrder = 'album-order' | 'newest-posted' | 'oldest-posted' | 'date-desc' | 'date-asc'

interface AlbumPhotoGridProps {
  albumId: string
  onPhotoSelect: (photo: FlickrPhoto) => void
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (photo: FlickrPhoto, shiftKey: boolean) => void
  onPhotosLoaded?: (photos: FlickrPhoto[]) => void
  onPageInfo?: (page: number, pages: number) => void
  onFilteredPhotosChange?: (photos: FlickrPhoto[]) => void
  onMediaFilterChange?: (filter: 'all' | 'photo' | 'video') => void
  onPrivacyFilterChange?: (filter: PrivacyFilter) => void
}

export default function AlbumPhotoGrid({ albumId, onPhotoSelect, selectMode, selectedIds, onToggleSelect, onPhotosLoaded, onPageInfo, onFilteredPhotosChange, onMediaFilterChange, onPrivacyFilterChange }: AlbumPhotoGridProps): React.JSX.Element {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [pageInfo, setPageInfo] = useState<Pick<PhotoPage, 'page' | 'pages' | 'total'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const [sort, setSort] = useState<SortOrder>('album-order')
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [viewMode, setViewMode] = useState<AlbumViewMode>(loadAlbumViewMode)
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyFilter>('all')
  const [downloadFilter, setDownloadFilter] = useState<DownloadFilter>('all')
  const [downloadRecords, setDownloadRecords] = useState<Record<string, true>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)

  const gridSize: GridSize = viewMode === 'list' ? 'medium' : viewMode

  // All filters are client-side — album API doesn't support server-side search
  const [titleQuery, setTitleQuery] = useState('')
  const [titleOperator, setTitleOperator] = useState<SearchOperator>('contains')
  const [activeTitleQuery, setActiveTitleQuery] = useState('')
  const [activeTitleOperator, setActiveTitleOperator] = useState<SearchOperator>('contains')

  const [tagQuery, setTagQuery] = useState('')
  const [tagMode, setTagMode] = useState<TagMode>('any')
  const [activeTagQuery, setActiveTagQuery] = useState('')
  const [activeTagMode, setActiveTagMode] = useState<TagMode>('any')

  const [dateField, setDateField] = useState<DateRangeField>('taken')
  const [dateMode, setDateMode] = useState<DateMode>('all')
  const [dateCustomMin, setDateCustomMin] = useState('')
  const [dateCustomMax, setDateCustomMax] = useState('')
  const [activeDateMin, setActiveDateMin] = useState('')
  const [activeDateMax, setActiveDateMax] = useState('')
  const [activeDateField, setActiveDateField] = useState<DateRangeField>('taken')

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
        onPageInfo?.(data.page, data.pages)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load photos'))
      .finally(() => setLoading(false))
  }, [loadPage])

  const handleLoadMore = useCallback(async (): Promise<void> => {
    if (!pageInfo || pageInfo.page >= pageInfo.pages) return
    setLoadingMore(true)
    try {
      const data = await loadPage(pageInfo.page + 1)
      setPhotos(prev => {
        const updated = [...prev, ...data.photos]
        onPhotosLoaded?.(updated)
        return updated
      })
      setPageInfo({ page: data.page, pages: data.pages, total: data.total })
      onPageInfo?.(data.page, data.pages)
    } finally {
      setLoadingMore(false)
    }
  }, [pageInfo, loadPage, onPhotosLoaded, onPageInfo])

  const applyTitleSearch = (): void => {
    setActiveTitleQuery(titleQuery)
    setActiveTitleOperator(titleOperator)
  }
  const dismissTitleSearch = (): void => { setTitleQuery(''); setActiveTitleQuery('') }

  const applyTagSearch = (): void => {
    setActiveTagQuery(tagQuery)
    setActiveTagMode(tagMode)
  }
  const dismissTagSearch = (): void => { setTagQuery(''); setActiveTagQuery('') }

  const handleDateModeChange = (mode: DateMode): void => {
    setDateMode(mode)
    if (mode === 'all') {
      setDateCustomMin(''); setDateCustomMax('')
      setActiveDateMin(''); setActiveDateMax('')
    } else if (mode === 'since' || mode === 'between') {
      setDateCustomMin(''); setDateCustomMax('')
    } else {
      const { min, max } = getPresetDates(mode)
      setDateCustomMin(min); setDateCustomMax(max)
      setActiveDateMin(min); setActiveDateMax(max); setActiveDateField(dateField)
    }
  }
  const applyDateFilter = (): void => {
    setActiveDateMin(dateCustomMin); setActiveDateMax(dateCustomMax); setActiveDateField(dateField)
  }
  const dismissDateFilter = (): void => {
    setDateMode('all'); setDateCustomMin(''); setDateCustomMax('')
    setActiveDateMin(''); setActiveDateMax('')
  }

  const clearAllFilters = (): void => {
    setMediaFilter('all'); setPrivacyFilter('all'); setDownloadFilter('all')
    setTitleQuery(''); setActiveTitleQuery('')
    setTagQuery(''); setActiveTagQuery('')
    setDateMode('all'); setDateCustomMin(''); setDateCustomMax('')
    setActiveDateMin(''); setActiveDateMax('')
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
    const tagList = activeTagQuery ? activeTagQuery.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : []
    let result = sortedPhotos
      .filter(p => {
        if (!activeTitleQuery) return true
        const t = p.title.toLowerCase()
        const q = activeTitleQuery.toLowerCase()
        if (activeTitleOperator === 'starts') return t.startsWith(q)
        if (activeTitleOperator === 'ends') return t.endsWith(q)
        if (activeTitleOperator === 'exact') return t === q
        return t.includes(q)
      })
      .filter(p => {
        if (!tagList.length) return true
        const photoTags = (p.tags ?? []).map(t => t.toLowerCase())
        return activeTagMode === 'all'
          ? tagList.every(t => photoTags.includes(t))
          : tagList.some(t => photoTags.includes(t))
      })
      .filter(p => {
        if (!activeDateMin && !activeDateMax) return true
        const photoDate = activeDateField === 'posted'
          ? (p.datePosted ? new Date(parseInt(p.datePosted) * 1000).toISOString().slice(0, 10) : '')
          : (p.dateTaken ? p.dateTaken.slice(0, 10) : '')
        if (!photoDate) return true
        if (activeDateMin && photoDate < activeDateMin) return false
        if (activeDateMax && photoDate > activeDateMax) return false
        return true
      })
      .filter(p => mediaFilter === 'all' || p.media === mediaFilter)
      .filter(p => privacyFilter === 'all' || getPrivacyLevel(p) === privacyFilter)
    if (downloadFilter !== 'all') {
      result = result.filter(p => downloadFilter === 'downloaded' ? !!downloadRecords[p.id] : !downloadRecords[p.id])
    }
    return result
  }, [sortedPhotos, activeTitleQuery, activeTitleOperator, activeTagQuery, activeTagMode, activeDateMin, activeDateMax, activeDateField, mediaFilter, privacyFilter, downloadFilter, downloadRecords])

  useEffect(() => { onFilteredPhotosChange?.(filteredPhotos) }, [filteredPhotos, onFilteredPhotosChange])
  useEffect(() => { onMediaFilterChange?.(mediaFilter) }, [mediaFilter, onMediaFilterChange])
  useEffect(() => { onPrivacyFilterChange?.(privacyFilter) }, [privacyFilter, onPrivacyFilterChange])

  useEffect(() => {
    if (photos.length === 0) return
    window.flickrAPI.getPhotoRecordsBatch(photos.map(p => p.id))
      .then(records => {
        const map: Record<string, true> = {}
        Object.keys(records).forEach(id => { map[id] = true })
        setDownloadRecords(map)
      })
      .catch(() => {})
  }, [photos])

  // Auto-load remaining pages when any filter is active (albums are finite — no page cap)
  useEffect(() => {
    const filterActive = mediaFilter !== 'all' || privacyFilter !== 'all' || downloadFilter !== 'all' || !!activeTitleQuery || !!activeTagQuery || !!activeDateMin || !!activeDateMax
    if (filterActive && photos.length > 0 && pageInfo && pageInfo.page < pageInfo.pages && !loadingMore && !loading) {
      handleLoadMore()
    }
  }, [mediaFilter, privacyFilter, downloadFilter, activeTitleQuery, activeTagQuery, activeDateMin, activeDateMax, photos.length, pageInfo?.page, pageInfo?.pages, loadingMore, loading, handleLoadMore])

  const hasAnyFilter = mediaFilter !== 'all' || privacyFilter !== 'all' || downloadFilter !== 'all' || !!activeTitleQuery || !!activeTagQuery || !!activeDateMin || !!activeDateMax
  const drawerBadgeCount = (privacyFilter !== 'all' ? 1 : 0) + (activeTagQuery ? 1 : 0) + ((activeDateMin || activeDateMax) ? 1 : 0)
  const showDateInputs = dateMode === 'since' || dateMode === 'between'
  const hasMore = pageInfo ? pageInfo.page < pageInfo.pages : false

  if (loading) return <div style={styles.centered}><p style={styles.mutedText}>Loading photos…</p></div>
  if (error) return <div style={styles.centered}><p style={styles.mutedText}>{error}</p></div>
  if (photos.length === 0) return <div style={styles.centered}><p style={styles.mutedText}>No photos in this album.</p></div>

  return (
    <div style={styles.container}>
      {selectMode && (mediaFilter !== 'all' || privacyFilter !== 'all' || downloadFilter !== 'all' || !!activeTitleQuery || !!activeTagQuery || !!activeDateMin || !!activeDateMax) && (
        <div style={styles.selectModeCount}>
          {filteredPhotos.length.toLocaleString()} matching · {photos.length.toLocaleString()} of {pageInfo?.total.toLocaleString() ?? '?'} loaded
        </div>
      )}

      {!selectMode && (
        <div style={styles.toolbarWrap}>

          {/* ── Main row ── */}
          <div style={styles.toolbar}>

            <div style={styles.segGroup}>
              {(['all', 'photo', 'video'] as MediaFilter[]).map(v => (
                <button key={v} style={{ ...styles.seg, ...(mediaFilter === v ? styles.segActive : {}) }} onClick={() => setMediaFilter(v)}>
                  {v === 'all' ? 'All' : v === 'photo' ? 'Photos' : 'Videos'}
                </button>
              ))}
            </div>

            <div style={styles.searchGroup}>
              <span style={styles.searchIcon}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <select
                style={styles.operatorSelect}
                value={titleOperator}
                onChange={e => setTitleOperator(e.target.value as SearchOperator)}
              >
                <option value="contains">Title contains</option>
                <option value="starts">Starts with</option>
                <option value="ends">Ends with</option>
                <option value="exact">Exact match</option>
              </select>
              <input
                style={styles.searchInput}
                type="text"
                placeholder="Search…"
                value={titleQuery}
                onChange={e => setTitleQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyTitleSearch()}
              />
              {titleQuery && (
                <button style={styles.searchClearBtn} onClick={() => { if (activeTitleQuery) dismissTitleSearch(); else setTitleQuery('') }}>✕</button>
              )}
            </div>

            <button
              style={{ ...styles.moreFiltersBtn, ...(drawerOpen ? styles.moreFiltersBtnActive : {}) }}
              onClick={() => setDrawerOpen(o => !o)}
            >
              {drawerOpen ? 'Hide filters' : 'More filters'}
              {drawerBadgeCount > 0 && !drawerOpen && (
                <span style={styles.drawerBadge}>{drawerBadgeCount}</span>
              )}
            </button>

            <DownloadFilterSelect value={downloadFilter} onChange={setDownloadFilter} />

            <div style={styles.segGroupDensity}>
              <button style={{ ...styles.densityBtn, ...(viewMode === 'list' ? styles.densityBtnActive : {}) }} onClick={() => { const m: AlbumViewMode = 'list'; setViewMode(m); saveAlbumViewMode(m) }}>
                <ListIcon />
              </button>
              {(['small', 'medium', 'large'] as GridSize[]).map(v => (
                <button key={v} style={{ ...styles.densityBtn, ...(viewMode === v ? styles.densityBtnActive : {}) }} onClick={() => { setViewMode(v); saveAlbumViewMode(v) }}>
                  <GridIcon size={v} />
                </button>
              ))}
            </div>

            <select style={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value as SortOrder)}>
              <option value="album-order">Default album order</option>
              <option value="newest-posted">Newest posted</option>
              <option value="oldest-posted">Oldest posted</option>
              <option value="date-desc">Newest taken</option>
              <option value="date-asc">Oldest taken</option>
            </select>

          </div>

          {/* ── More filters drawer ── */}
          {drawerOpen && (
            <div style={styles.drawer}>

              <div style={styles.drawerRow}>
                <span style={styles.drawerLabel}>Privacy</span>
                <div style={styles.segGroup}>
                  {PRIVACY_OPTIONS.map(v => (
                    <button key={v} style={{ ...styles.seg, ...(privacyFilter === v ? styles.segActive : {}) }} onClick={() => setPrivacyFilter(v)}>
                      {PRIVACY_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.drawerRow}>
                <span style={styles.drawerLabel}>Tags</span>
                <div style={styles.searchGroup}>
                  <input
                    style={{ ...styles.searchInput, minWidth: '160px' }}
                    type="text"
                    placeholder="paris, travel…"
                    value={tagQuery}
                    onChange={e => setTagQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyTagSearch()}
                  />
                  {tagQuery && (
                    <button style={styles.searchClearBtn} onClick={() => { if (activeTagQuery) dismissTagSearch(); else setTagQuery('') }}>✕</button>
                  )}
                </div>
                <div style={styles.segGroup}>
                  {(['any', 'all'] as TagMode[]).map(v => (
                    <button key={v} style={{ ...styles.seg, ...(tagMode === v ? styles.segActive : {}) }} onClick={() => setTagMode(v)}>
                      {v}
                    </button>
                  ))}
                </div>
                <Tooltip text="Separate multiple tags with commas. 'Any' finds photos with at least one tag; 'All' requires every tag.">
                  <span style={styles.tagHint}>?</span>
                </Tooltip>
                {tagQuery !== activeTagQuery && tagQuery && (
                  <button style={styles.applyBtn} onClick={applyTagSearch}>Apply</button>
                )}
              </div>

              <div style={styles.drawerRow}>
                <span style={styles.drawerLabel}>Date</span>
                <div style={styles.segGroup}>
                  {(['taken', 'posted'] as DateRangeField[]).map(f => (
                    <button key={f} style={{ ...styles.seg, ...(dateField === f ? styles.segActive : {}) }} onClick={() => setDateField(f)}>
                      {f === 'taken' ? 'Taken' : 'Posted'}
                    </button>
                  ))}
                </div>
                <select style={styles.dateModeSelect} value={dateMode} onChange={e => handleDateModeChange(e.target.value as DateMode)}>
                  <option value="all">All dates</option>
                  <optgroup label="Quick ranges">
                    <option value="last7">Last 7 days</option>
                    <option value="last30">Last 30 days</option>
                    <option value="thisYear">This year</option>
                    <option value="lastYear">Last year</option>
                  </optgroup>
                  <optgroup label="Custom">
                    <option value="since">Since a date…</option>
                    <option value="between">Between two dates…</option>
                  </optgroup>
                </select>
                {showDateInputs && (
                  <div style={styles.dateInputsInline}>
                    <input type="date" style={styles.dateInput} value={dateCustomMin} onChange={e => setDateCustomMin(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyDateFilter()} />
                    {dateMode === 'between' && (
                      <><span style={styles.dateToLabel}>to</span>
                      <input type="date" style={styles.dateInput} value={dateCustomMax} onChange={e => setDateCustomMax(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyDateFilter()} /></>
                    )}
                    <button style={styles.applyBtn} onClick={applyDateFilter}>Apply</button>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── Active filter chips ── */}
          {hasAnyFilter && (
            <div style={styles.chipRow}>
              {activeTitleQuery && (
                <Chip label={`"${activeTitleQuery}"`} onDismiss={dismissTitleSearch} />
              )}
              {activeTagQuery && (
                <Chip label={`Tags (${activeTagMode}): ${activeTagQuery}`} onDismiss={dismissTagSearch} />
              )}
              {(activeDateMin || activeDateMax) && (
                <Chip label={formatDateChip(activeDateMin, activeDateMax, activeDateField)} onDismiss={dismissDateFilter} />
              )}
              {mediaFilter !== 'all' && (
                <Chip label={mediaFilter === 'photo' ? 'Photos only' : 'Videos only'} onDismiss={() => setMediaFilter('all')} />
              )}
              {privacyFilter !== 'all' && (
                <Chip label={`Privacy: ${PRIVACY_LABELS[privacyFilter]}`} onDismiss={() => setPrivacyFilter('all')} />
              )}
              {downloadFilter !== 'all' && (
                <Chip label={DOWNLOAD_FILTER_LABEL[downloadFilter]} onDismiss={() => setDownloadFilter('all')} />
              )}
              <button style={styles.clearFiltersLink} onClick={clearAllFilters}>Clear all</button>
            </div>
          )}

          <p style={styles.countLabel}>
            {hasAnyFilter
              ? `${filteredPhotos.length.toLocaleString()} matching · ${photos.length.toLocaleString()} of ${pageInfo?.total.toLocaleString() ?? '?'} photos loaded${hasMore ? (loadingMore ? ' · loading…' : ' · Scroll for more') : ''}`
              : `${photos.length.toLocaleString()} of ${pageInfo?.total.toLocaleString() ?? '?'} photos loaded${hasMore ? ' · Scroll for more' : ''}`
            }
          </p>

        </div>
      )}

      {filteredPhotos.length === 0 && photos.length > 0 && !loadingMore && !loading && (
        <div style={styles.emptyFilter}>
          <p style={styles.emptyFilterMsg}>No {mediaFilter !== 'all' ? mediaFilter + 's' : 'photos'} match the current filters.</p>
          <button style={styles.clearFiltersBtn} onClick={clearAllFilters}>Clear Filters</button>
        </div>
      )}

      {viewMode === 'list' ? (
        <div style={styles.listContainer}>
          {filteredPhotos.map(photo => (
            <PhotoListRow
              key={photo.id}
              photo={photo}
              isDownloaded={!!downloadRecords[photo.id]}
              isSelected={selectMode ? (selectedIds?.has(photo.id) ?? false) : undefined}
              selectMode={selectMode}
              onClick={(e) => selectMode ? onToggleSelect?.(photo, e.shiftKey) : onPhotoSelect(photo)}
            />
          ))}
        </div>
      ) : (
        <div style={{ ...styles.grid, gridTemplateColumns: GRID_COLUMNS[gridSize] }}>
          {filteredPhotos.map((photo) => {
            const isSelected = selectMode && (selectedIds?.has(photo.id) ?? false)
            const privacyLevel = getPrivacyLevel(photo)
            return (
              <div
                key={photo.id}
                style={{
                  ...styles.tile,
                  ...(isSelected ? { outline: '3px solid var(--ff-pink)', outlineOffset: '-3px', zIndex: 1 } : {}),
                  ...(selectMode && !isSelected ? { opacity: 0.75 } : {})
                }}
                onClick={(e) => selectMode ? onToggleSelect?.(photo, e.shiftKey) : onPhotoSelect(photo)}
                onMouseEnter={() => setHoveredId(photo.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <img src={photo.thumbnailUrl} alt={photo.title} style={styles.thumb} loading="lazy" />
                {photo.media === 'video' && (
                  <div style={styles.videoOverlay}>
                    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                      <circle cx="15" cy="15" r="15" fill="rgba(0,0,0,0.52)"/>
                      <polygon points="12,9 23,15 12,21" fill="white"/>
                    </svg>
                  </div>
                )}
                {privacyLevel !== 'public' && (
                  <div style={styles.privacyBadge}>
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
                    backgroundColor: isSelected ? 'var(--ff-pink)' : 'rgba(255,255,255,0.75)',
                    border: isSelected ? '2px solid var(--ff-pink)' : '2px solid rgba(255,255,255,0.9)'
                  }}>
                    {isSelected && <span style={styles.selectCheck}>✓</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

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
  ...sharedStyles,
  // Album-specific
  container: { height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  grid: { display: 'grid', gap: '4px', padding: '4px' },
  // Album tile uses opacity transition for hover overlay; PhotoGrid conditionally renders its overlay instead
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', padding: '8px', opacity: 0, transition: 'opacity 0.15s' },
  overlayTitle: { color: '#fff', fontSize: '12px', fontWeight: '500', textShadow: '0 1px 3px rgba(0,0,0,0.8)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', width: '100%' } as React.CSSProperties,
  loadMore: { padding: '16px', textAlign: 'center' },
  loadMoreBtn: { background: 'transparent', border: '1px solid #ccc', borderRadius: '6px', padding: '8px 20px', fontSize: '13px', color: '#555', cursor: 'pointer' },
}
