import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { FlickrPhoto, PhotoSearchParams, SearchOperator, DateRangeField, TagMode } from '../../shared/types'
import { MediaFilter, GridSize, PhotoViewMode, DownloadFilter, PrivacyFilter, PrivacyLevel, PRIVACY_OPTIONS, PRIVACY_LABELS, GRID_COLUMNS, GridIcon, ListIcon, PrivacyIcon, Tooltip, Chip, PhotoListRow, DownloadFilterSelect, getPrivacyLevel, sharedStyles, DateMode, getPresetDates, formatDateChip, loadPhotoViewMode, savePhotoViewMode, DOWNLOAD_FILTER_LABEL } from './PhotoGridShared'

type SortOrder = 'date-posted-desc' | 'date-posted-asc' | 'date-taken-desc' | 'date-taken-asc'


interface PhotoGridProps {
  onPhotoSelect: (photo: FlickrPhoto) => void
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (photo: FlickrPhoto, shiftKey: boolean) => void
  onPhotosLoaded?: (photos: FlickrPhoto[]) => void
  onPageInfo?: (page: number, pages: number) => void
  onSortChange?: (sort: string) => void
  onFilteredPhotosChange?: (photos: FlickrPhoto[]) => void
}

export default function PhotoGrid({ onPhotoSelect, selectMode, selectedIds, onToggleSelect, onPhotosLoaded, onPageInfo, onSortChange, onFilteredPhotosChange }: PhotoGridProps): React.JSX.Element {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Display state
  const [sort, setSort] = useState<SortOrder>('date-posted-desc')
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [viewMode, setViewMode] = useState<PhotoViewMode>(loadPhotoViewMode)
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyFilter>('all')
  const [downloadFilter, setDownloadFilter] = useState<DownloadFilter>('all')
  const [downloadRecords, setDownloadRecords] = useState<Record<string, true>>({})

  const gridSize: GridSize = viewMode === 'list' ? 'medium' : viewMode
  const autoLoadCountRef = useRef(0)
  const [autoLoadCapped, setAutoLoadCapped] = useState(false)
  const [scanAllMode, setScanAllMode] = useState(false)
  const [autoLoadError, setAutoLoadError] = useState(false)

  // Search input state (uncommitted until triggered)
  const [searchMode, setSearchMode] = useState<'title' | 'id'>('title')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOperator, setSearchOperator] = useState<SearchOperator>('contains')
  const [photoIdQuery, setPhotoIdQuery] = useState('')
  const [photoIdStatus, setPhotoIdStatus] = useState<'idle' | 'searching' | 'not-found'>('idle')
  const [tagQuery, setTagQuery] = useState('')
  const [tagMode, setTagMode] = useState<TagMode>('any')
  const [dateField, setDateField] = useState<DateRangeField>('taken')
  const [dateMode, setDateMode] = useState<DateMode>('all')
  const [dateCustomMin, setDateCustomMin] = useState('')
  const [dateCustomMax, setDateCustomMax] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Committed search (what was actually sent to the API)
  const [activeSearch, setActiveSearch] = useState<PhotoSearchParams>({})
  const activeSearchRef = useRef<PhotoSearchParams>({})

  const loadPage = async (pageNum: number, currentSort: SortOrder = sort, searchParams: PhotoSearchParams = activeSearchRef.current): Promise<void> => {
    if (pageNum === 1) { setLoading(true); setPhotos([]) }
    else setLoadingMore(true)
    setError(null)
    try {
      const result = await window.flickrAPI.getPhotos(pageNum, currentSort, searchParams)
      setPhotos(prev => pageNum === 1 ? result.photos : [...prev, ...result.photos])
      setPage(result.page)
      setPages(result.pages)
      setTotal(result.total)
      onPhotosLoaded?.(pageNum === 1 ? result.photos : [...photos, ...result.photos])
      onPageInfo?.(result.page, result.pages)
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to load photos'
      setError(raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => { loadPage(1) }, [])

  const applySearch = (params: PhotoSearchParams): void => {
    activeSearchRef.current = params
    setActiveSearch(params)
    autoLoadCountRef.current = 0
    setAutoLoadCapped(false)
    loadPage(1, sort, params)
  }

  const buildSearchParams = (overrides: Partial<PhotoSearchParams & { dateMin: string; dateMax: string }> = {}): PhotoSearchParams => {
    const params: PhotoSearchParams = {}
    const q = overrides.query !== undefined ? overrides.query : searchQuery
    const op = overrides.operator !== undefined ? overrides.operator : searchOperator
    const tq = overrides.tagQuery !== undefined ? overrides.tagQuery : tagQuery
    const tm = overrides.tagMode !== undefined ? overrides.tagMode : tagMode
    const df = overrides.dateField !== undefined ? overrides.dateField : dateField
    const dmin = overrides.dateMin !== undefined ? overrides.dateMin : dateCustomMin
    const dmax = overrides.dateMax !== undefined ? overrides.dateMax : dateCustomMax
    if (q) { params.query = q; params.operator = op }
    if (tq) { params.tagQuery = tq; params.tagMode = tm }
    if (dmin || dmax) { params.dateField = df; if (dmin) params.dateMin = dmin; if (dmax) params.dateMax = dmax }
    return params
  }

  const triggerSearch = (): void => { applySearch(buildSearchParams()) }

  const handleSortChange = (newSort: SortOrder): void => {
    setSort(newSort)
    onSortChange?.(newSort)
    loadPage(1, newSort, activeSearchRef.current)
  }

  const handleDateModeChange = (mode: DateMode): void => {
    setDateMode(mode)
    if (mode === 'all') {
      setDateCustomMin(''); setDateCustomMax('')
      const params = { ...activeSearchRef.current }
      delete params.dateMin; delete params.dateMax; delete params.dateField
      applySearch(params)
    } else if (mode === 'since' || mode === 'between') {
      setDateCustomMin(''); setDateCustomMax('')
    } else {
      const { min, max } = getPresetDates(mode)
      setDateCustomMin(min); setDateCustomMax(max)
      applySearch(buildSearchParams({ dateMin: min, dateMax: max, dateField }))
    }
  }

  const applyDateFilter = (): void => {
    applySearch(buildSearchParams({ dateMin: dateCustomMin, dateMax: dateCustomMax, dateField }))
  }

  const dismissSearchQuery = (): void => {
    setSearchQuery('')
    const params = { ...activeSearchRef.current }; delete params.query; delete params.operator
    applySearch(params)
  }

  const dismissTagQuery = (): void => {
    setTagQuery('')
    const params = { ...activeSearchRef.current }; delete params.tagQuery; delete params.tagMode
    applySearch(params)
  }

  const dismissDateRange = (): void => {
    setDateMode('all'); setDateCustomMin(''); setDateCustomMax('')
    const params = { ...activeSearchRef.current }
    delete params.dateMin; delete params.dateMax; delete params.dateField
    applySearch(params)
  }

  const clearAllFilters = (): void => {
    setMediaFilter('all'); setPrivacyFilter('all'); setDownloadFilter('all')
    setSearchQuery(''); setTagQuery('')
    setDateMode('all'); setDateCustomMin(''); setDateCustomMax('')
    applySearch({})
  }

  const handlePhotoIdLookup = async (id: string): Promise<void> => {
    const trimmed = id.trim()
    if (!trimmed) return
    setPhotoIdStatus('searching')
    // Check loaded photos first
    const existing = photos.find(p => p.id === trimmed)
    if (existing) { onPhotoSelect(existing); setPhotoIdStatus('idle'); return }
    // Fetch from Flickr
    try {
      const { sizes, info } = await window.flickrAPI.getPhotoDetail(trimmed)
      const thumb = sizes.find(s => s.label === 'Square') ?? sizes[0]
      const photo: FlickrPhoto = {
        id: trimmed,
        title: info.title,
        thumbnailUrl: thumb?.source ?? '',
        dateTaken: info.dateTaken ?? '',
        media: 'photo',
      }
      onPhotoSelect(photo)
      setPhotoIdStatus('idle')
    } catch {
      setPhotoIdStatus('not-found')
    }
  }

  const filteredPhotos = useMemo(() => {
    let result = photos
      .filter(p => mediaFilter === 'all' || p.media === mediaFilter)
      .filter(p => privacyFilter === 'all' || getPrivacyLevel(p) === privacyFilter)
    if (downloadFilter !== 'all') {
      result = result.filter(p => downloadFilter === 'downloaded' ? !!downloadRecords[p.id] : !downloadRecords[p.id])
    }
    if (searchMode === 'id' && photoIdQuery.trim()) {
      result = result.filter(p => p.id === photoIdQuery.trim())
    }
    return result
  }, [photos, mediaFilter, privacyFilter, downloadFilter, downloadRecords, searchMode, photoIdQuery])

  useEffect(() => { onFilteredPhotosChange?.(filteredPhotos) }, [filteredPhotos, onFilteredPhotosChange])

  useEffect(() => {
    autoLoadCountRef.current = 0
    setAutoLoadCapped(false)
    setScanAllMode(false)
    setAutoLoadError(false)
  }, [mediaFilter, privacyFilter])

  useEffect(() => {
    const filterActive = mediaFilter !== 'all' || privacyFilter !== 'all'
    if (filterActive && photos.length > 0 && page < pages && !loadingMore && !loading && !autoLoadError) {
      if (scanAllMode || autoLoadCountRef.current < 10) {
        autoLoadCountRef.current++
        const nextPage = page + 1
        setLoadingMore(true)
        window.flickrAPI.getPhotos(nextPage, sort, activeSearchRef.current)
          .then(result => {
            const updated = [...photos, ...result.photos]
            setPhotos(updated); setPage(result.page); setPages(result.pages); setTotal(result.total)
            onPhotosLoaded?.(updated); onPageInfo?.(result.page, result.pages)
          })
          .catch(() => { setAutoLoadError(true) })
          .finally(() => setLoadingMore(false))
      } else {
        setAutoLoadCapped(true)
      }
    }
  }, [mediaFilter, privacyFilter, photos.length, page, pages, loadingMore, loading, sort, scanAllMode, autoLoadError])

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

  const hasServerSearch = !!(activeSearch.query || activeSearch.tagQuery || activeSearch.dateMin || activeSearch.dateMax)
  const hasClientFilter = mediaFilter !== 'all' || privacyFilter !== 'all' || downloadFilter !== 'all'
  const hasAnyFilter = hasServerSearch || hasClientFilter
  const drawerBadgeCount =
    (privacyFilter !== 'all' ? 1 : 0) +
    (activeSearch.tagQuery ? 1 : 0) +
    ((activeSearch.dateMin || activeSearch.dateMax) ? 1 : 0) +
    (downloadFilter !== 'all' ? 1 : 0)

  const showDateInputs = dateMode === 'since' || dateMode === 'between'

  if (loading) return (
    <div style={styles.wrapper}>
      <style>{`@keyframes ff-shimmer { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }`}</style>
      <div style={{ ...styles.grid, gridTemplateColumns: GRID_COLUMNS['medium'], padding: '16px' }}>
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} style={{ ...styles.tile, background: '#e8e4de', animation: `ff-shimmer 1.4s ease-in-out infinite`, animationDelay: `${(i % 6) * 0.08}s` }} />
        ))}
      </div>
    </div>
  )
  if (error) return (
    <div style={styles.centered}>
      <p style={styles.errorText}>⚠️ {error}</p>
      <button style={styles.retryButton} onClick={() => loadPage(1)}>Try again</button>
    </div>
  )
  if (photos.length === 0 && !hasServerSearch) return <div style={styles.centered}><p style={styles.mutedText}>No photos found in your photostream.</p></div>

  return (
    <div style={styles.wrapper}>
      {selectMode && hasClientFilter && (
        <div style={styles.selectModeCount}>
          {filteredPhotos.length.toLocaleString()} matching · {total.toLocaleString()} loaded
        </div>
      )}

      {!selectMode && (
        <div style={styles.toolbarWrap}>

          {/* ── Main row: Media + Title search + display controls ── */}
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
              {searchMode === 'title' ? (
                <>
                  <select
                    style={styles.operatorSelect}
                    value={searchOperator}
                    onChange={e => {
                      if (e.target.value === '__id__') { setSearchMode('id'); if (activeSearch.query) dismissSearchQuery() }
                      else setSearchOperator(e.target.value as SearchOperator)
                    }}
                  >
                    <option value="contains">Title contains</option>
                    <option value="starts">Starts with</option>
                    <option value="ends">Ends with</option>
                    <option value="exact">Exact match</option>
                    <option value="__id__">Photo ID…</option>
                  </select>
                  <input
                    style={styles.searchInput}
                    type="text"
                    placeholder="Search…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && triggerSearch()}
                  />
                  {searchQuery && (
                    <button style={styles.searchClearBtn} onClick={() => { if (activeSearch.query) dismissSearchQuery(); else setSearchQuery('') }}>✕</button>
                  )}
                </>
              ) : (
                <>
                  <select
                    style={styles.operatorSelect}
                    value="__id__"
                    onChange={e => { if (e.target.value !== '__id__') { setSearchMode('title'); setSearchOperator(e.target.value as SearchOperator); setPhotoIdQuery(''); setPhotoIdStatus('idle') } }}
                  >
                    <option value="contains">Title contains</option>
                    <option value="starts">Starts with</option>
                    <option value="ends">Ends with</option>
                    <option value="exact">Exact match</option>
                    <option value="__id__">Photo ID…</option>
                  </select>
                  <input
                    style={styles.searchInput}
                    type="text"
                    placeholder="Enter photo ID…"
                    value={photoIdQuery}
                    onChange={e => { setPhotoIdQuery(e.target.value); setPhotoIdStatus('idle') }}
                  />
                  {photoIdQuery.trim() && filteredPhotos.length === 0 && photoIdStatus !== 'searching' && (
                    photoIdStatus === 'not-found'
                      ? <span style={styles.idStatusErr}>Not on Flickr</span>
                      : <button style={styles.idOpenDetailBtn} onClick={() => handlePhotoIdLookup(photoIdQuery)}>Open →</button>
                  )}
                  {photoIdStatus === 'searching' && <span style={styles.idStatus}>…</span>}
                  {photoIdQuery && (
                    <button style={styles.searchClearBtn} onClick={() => { setPhotoIdQuery(''); setPhotoIdStatus('idle') }}>✕</button>
                  )}
                </>
              )}
            </div>

            <button
              style={{ ...styles.moreFiltersBtn, ...(drawerOpen ? styles.moreFiltersBtnActive : {}) }}
              onClick={() => setDrawerOpen(o => !o)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ flexShrink: 0 }}><path d="M1 2h10L7 6v4l-2-1V6L1 2z"/></svg>
              Filters
              {drawerBadgeCount > 0 && !drawerOpen && (
                <span style={styles.drawerBadge}>{drawerBadgeCount}</span>
              )}
            </button>

            <div style={styles.segGroupDensity}>
              <button style={{ ...styles.densityBtn, ...(viewMode === 'list' ? styles.densityBtnActive : {}) }} onClick={() => { const m: PhotoViewMode = 'list'; setViewMode(m); savePhotoViewMode(m) }}>
                <ListIcon />
              </button>
              {(['small', 'medium', 'large'] as GridSize[]).map(v => (
                <button key={v} style={{ ...styles.densityBtn, ...(viewMode === v ? styles.densityBtnActive : {}) }} onClick={() => { setViewMode(v); savePhotoViewMode(v) }}>
                  <GridIcon size={v} />
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

          {/* ── More filters drawer ── */}
          {drawerOpen && (
            <div style={styles.drawer}>

              {/* Downloaded */}
              <div style={styles.drawerRow}>
                <span style={styles.drawerLabel}>Downloaded</span>
                <DownloadFilterSelect value={downloadFilter} onChange={setDownloadFilter} />
              </div>

              {/* Privacy */}
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

              {/* Tags */}
              <div style={styles.drawerRow}>
                <span style={styles.drawerLabel}>Tags</span>
                <div style={styles.searchGroup}>
                  <input
                    style={{ ...styles.searchInput, minWidth: '160px' }}
                    type="text"
                    placeholder="paris, travel…"
                    value={tagQuery}
                    onChange={e => setTagQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && triggerSearch()}
                  />
                  {tagQuery && (
                    <button style={styles.searchClearBtn} onClick={() => { if (activeSearch.tagQuery) dismissTagQuery(); else setTagQuery('') }}>✕</button>
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
                {tagQuery !== (activeSearch.tagQuery ?? '') && tagQuery && (
                  <button style={styles.applyBtn} onClick={triggerSearch}>Apply</button>
                )}
              </div>

              {/* Date */}
              <div style={styles.drawerRow}>
                <span style={styles.drawerLabel}>Date</span>
                <div style={styles.segGroup}>
                  {(['taken', 'posted'] as DateRangeField[]).map(f => (
                    <button
                      key={f}
                      style={{ ...styles.seg, ...(dateField === f ? styles.segActive : {}) }}
                      onClick={() => setDateField(f)}
                    >
                      {f === 'taken' ? 'Taken' : 'Posted'}
                    </button>
                  ))}
                </div>
                <select
                  style={styles.dateModeSelect}
                  value={dateMode}
                  onChange={e => handleDateModeChange(e.target.value as DateMode)}
                >
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
                    <input
                      type="date"
                      style={styles.dateInput}
                      value={dateCustomMin}
                      onChange={e => setDateCustomMin(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyDateFilter()}
                    />
                    {dateMode === 'between' && (
                      <>
                        <span style={styles.dateToLabel}>to</span>
                        <input
                          type="date"
                          style={styles.dateInput}
                          value={dateCustomMax}
                          onChange={e => setDateCustomMax(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && applyDateFilter()}
                        />
                      </>
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
              {activeSearch.query && (
                <Chip label={`"${activeSearch.query}"`} onDismiss={dismissSearchQuery} />
              )}
              {activeSearch.tagQuery && (
                <Chip
                  label={`Tags (${activeSearch.tagMode ?? 'any'}): ${activeSearch.tagQuery}`}
                  onDismiss={dismissTagQuery}
                />
              )}
              {(activeSearch.dateMin || activeSearch.dateMax) && (
                <Chip
                  label={formatDateChip(activeSearch.dateMin ?? '', activeSearch.dateMax ?? '', activeSearch.dateField ?? 'taken')}
                  onDismiss={dismissDateRange}
                />
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
            {hasClientFilter
              ? `${filteredPhotos.length.toLocaleString()} matching · ${photos.length.toLocaleString()} of ${total.toLocaleString()} photos scanned${page < pages ? (loadingMore ? '' : ' · Scroll for more') : ''}`
              : `${photos.length.toLocaleString()} of ${total.toLocaleString()} photos loaded${page < pages ? ' · Scroll for more' : ''}`
            }
          </p>
          {hasClientFilter && loadingMore && (
            <div style={styles.scanProgressBar}>
              <div style={{ ...styles.scanProgressFill, width: `${Math.min((page / pages) * 100, 99)}%` }} />
            </div>
          )}

        </div>
      )}

      {filteredPhotos.length === 0 && photos.length > 0 && !loadingMore && !loading && (
        <div style={styles.emptyFilter}>
          <p style={styles.emptyFilterMsg}>No {mediaFilter !== 'all' ? mediaFilter + 's' : 'photos'} match the current filters in the {photos.length.toLocaleString()} photos scanned.</p>
          {autoLoadCapped && page < pages && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, justifyContent: 'center' }}>
              <button style={styles.keepSearchingBtn} onClick={() => { autoLoadCountRef.current = 0; setAutoLoadCapped(false) }}>
                Scan next 1,000
              </button>
              <button style={styles.keepSearchingBtn} onClick={() => { autoLoadCountRef.current = 0; setAutoLoadCapped(false); setScanAllMode(true) }}>
                {(() => { const mins = Math.ceil((pages - page) / 60); return `Scan all remaining (est. ~${mins < 1 ? '< 1' : mins} min)` })()}
              </button>
            </div>
          )}
          <button style={styles.clearFiltersBtn} onClick={clearAllFilters}>Clear Filters</button>
        </div>
      )}

      {photos.length === 0 && hasServerSearch && !loading && (
        <div style={styles.emptyFilter}>
          <p style={styles.emptyFilterMsg}>No photos match your search.</p>
          <button style={styles.clearFiltersBtn} onClick={clearAllFilters}>Clear search</button>
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
          {filteredPhotos.map(photo => {
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
                  <div style={styles.privacyBadge}>
                    <PrivacyIcon level={privacyLevel} />
                  </div>
                )}
                {!selectMode && downloadRecords[photo.id] && (
                  <div style={styles.downloadBadge}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 1v7M3 5.5l3 3 3-3M2 11h8"/>
                    </svg>
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
  ...sharedStyles,
  // Photostream-specific
  wrapper: { padding: '0', overflowY: 'auto', height: '100%', boxSizing: 'border-box' },
  grid: { display: 'grid', gap: '4px', padding: '4px 16px 16px' },
  thumbPlaceholder: { width: '100%', height: '100%', backgroundColor: '#d0d0d0' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)', padding: '6px 8px', display: 'flex', alignItems: 'flex-start', gap: '6px' },
  overlayTitle: { flex: 1, color: '#fff', fontSize: '12px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties,
  downloadBadge: { position: 'absolute', top: '5px', right: '5px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  errorText: { color: '#cc0000', fontSize: '14px', margin: 0 },
  retryButton: { backgroundColor: 'var(--ff-pink-action)', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' },
  loadMoreRow: { display: 'flex', justifyContent: 'center', padding: '24px 16px' },
  loadMoreButton: { backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '6px', padding: '10px 28px', fontSize: '14px', color: '#444', cursor: 'pointer' },
  disabled: { opacity: 0.6, cursor: 'not-allowed' },
  keepSearchingBtn: { background: '#111', border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', color: '#fff', cursor: 'pointer' },
  scanProgressBar: { height: '3px', background: '#e0dcd6', borderRadius: '2px', overflow: 'hidden', margin: '4px 0 2px' },
  scanProgressFill: { height: '100%', background: 'var(--ff-blue)', borderRadius: '2px', transition: 'width 0.4s ease' },
}
