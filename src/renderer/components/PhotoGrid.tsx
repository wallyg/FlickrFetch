import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { FlickrPhoto, PhotoSearchParams, SearchOperator, DateRangeField, TagMode, LicenseFilter } from '../../shared/types'
import { MediaFilter, PhotoViewMode, DownloadFilter, PrivacyFilter, PrivacyLevel, PRIVACY_OPTIONS, PRIVACY_LABELS, GRID_COLUMNS, JustifiedIcon, GridIcon, ListIcon, PrivacyIcon, Tooltip, Chip, PhotoListRow, DownloadFilterSelect, LicenseFilterSelect, matchesLicenseFilter, LICENSE_FILTER_LABEL, sameSearchParams, getPrivacyLevel, sharedStyles, DateMode, getPresetDates, formatDateChip, loadPhotoViewMode, savePhotoViewMode, loadRowHeight, saveRowHeight, computeJustifiedRows, DOWNLOAD_FILTER_LABEL } from './PhotoGridShared'
import EmptyState from './EmptyState'

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
  onFiltersActiveChange?: (active: boolean) => void
  // From the Tags tab: show only photos with these tags (replaces any search or filters in place)
  tagSearchRequest?: { tags: string[]; mode: TagMode; nonce: number } | null
}

export default function PhotoGrid({ onPhotoSelect, selectMode, selectedIds, onToggleSelect, onPhotosLoaded, onPageInfo, onSortChange, onFilteredPhotosChange, onFiltersActiveChange, tagSearchRequest }: PhotoGridProps): React.JSX.Element {
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
  const [licenseFilter, setLicenseFilter] = useState<LicenseFilter>('all')
  const [downloadRecords, setDownloadRecords] = useState<Record<string, true>>({})

  const [rowHeight, setRowHeight] = useState<number>(loadRowHeight)
  const [containerWidth, setContainerWidth] = useState(0)
  const gridContainerRef = useRef<HTMLDivElement>(null)
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

  // Each load gets a number; if a newer search starts while an older one is still in flight,
  // the older answer is thrown away so it can't overwrite the newer results.
  const loadReqRef = useRef(0)
  const loadedOnceRef = useRef(false)

  const loadPage = async (pageNum: number, currentSort: SortOrder = sort, searchParams: PhotoSearchParams = activeSearchRef.current): Promise<void> => {
    const reqId = ++loadReqRef.current
    // Page 1 keeps whatever is on screen until the new results arrive (dimmed), so a search or
    // filter change never flashes to an empty skeleton.
    if (pageNum === 1) { setLoading(true) }
    else setLoadingMore(true)
    setError(null)
    try {
      const result = await window.flickrAPI.getPhotos(pageNum, currentSort, searchParams)
      if (reqId !== loadReqRef.current) return
      setPhotos(prev => pageNum === 1 ? result.photos : [...prev, ...result.photos])
      setPage(result.page)
      setPages(result.pages)
      setTotal(result.total)
      onPhotosLoaded?.(pageNum === 1 ? result.photos : [...photos, ...result.photos])
      onPageInfo?.(result.page, result.pages)
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to load photos'
      if (reqId !== loadReqRef.current) return
      setError(raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      if (reqId === loadReqRef.current) {
        loadedOnceRef.current = true
        setLoading(false)
        setLoadingMore(false)
      }
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
    const q = (overrides.query !== undefined ? overrides.query : searchQuery).trim()
    const op = overrides.operator !== undefined ? overrides.operator : searchOperator
    const tq = (overrides.tagQuery !== undefined ? overrides.tagQuery : tagQuery).trim()
    const tm = overrides.tagMode !== undefined ? overrides.tagMode : tagMode
    const df = overrides.dateField !== undefined ? overrides.dateField : dateField
    const dmin = overrides.dateMin !== undefined ? overrides.dateMin : dateCustomMin
    const dmax = overrides.dateMax !== undefined ? overrides.dateMax : dateCustomMax
    if (q) { params.query = q; params.operator = op }
    if (tq) { params.tagQuery = tq; params.tagMode = tm }
    if (dmin || dmax) { params.dateField = df; if (dmin) params.dateMin = dmin; if (dmax) params.dateMax = dmax }
    return params
  }

  const triggerSearch = (): void => {
    const next = buildSearchParams()
    if (sameSearchParams(next, activeSearchRef.current)) return
    applySearch(next)
  }

  // Searches go to Flickr (one request each), so they run shortly after you stop typing
  // rather than on every keystroke. Enter runs the search immediately. Dropdowns and
  // buttons apply right away; this also covers custom dates once they're entered.
  useEffect(() => {
    const t = setTimeout(triggerSearch, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchOperator, tagQuery, tagMode, dateField, dateMode, dateCustomMin, dateCustomMax])

  // 'View photos' in the Tags tab: start over with just that tag search
  useEffect(() => {
    if (!tagSearchRequest) return
    const tq = tagSearchRequest.tags.join(', ')
    setMediaFilter('all'); setPrivacyFilter('all'); setDownloadFilter('all'); setLicenseFilter('all')
    setSearchQuery(''); setDateMode('all'); setDateCustomMin(''); setDateCustomMax('')
    setTagQuery(tq); setTagMode(tagSearchRequest.mode)
    applySearch({ tagQuery: tq, tagMode: tagSearchRequest.mode })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagSearchRequest?.nonce])

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
      // Keep the dates already applied so switching to a custom range doesn't drop the filter
      // (and trigger an unfiltered reload) before the user has picked new dates.
      if (mode === 'since') setDateCustomMax('')
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
    setMediaFilter('all'); setPrivacyFilter('all'); setDownloadFilter('all'); setLicenseFilter('all')
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
    if (licenseFilter !== 'all') {
      result = result.filter(p => matchesLicenseFilter(p.license, licenseFilter))
    }
    if (searchMode === 'id' && photoIdQuery.trim()) {
      result = result.filter(p => p.id === photoIdQuery.trim())
    }
    return result
  }, [photos, mediaFilter, privacyFilter, downloadFilter, licenseFilter, downloadRecords, searchMode, photoIdQuery])

  useEffect(() => { onFilteredPhotosChange?.(filteredPhotos) }, [filteredPhotos, onFilteredPhotosChange])

  useEffect(() => {
    autoLoadCountRef.current = 0
    setAutoLoadCapped(false)
    setScanAllMode(false)
    setAutoLoadError(false)
  }, [mediaFilter, privacyFilter, licenseFilter])

  useEffect(() => {
    const filterActive = mediaFilter !== 'all' || privacyFilter !== 'all' || licenseFilter !== 'all'
    if (filterActive && photos.length > 0 && page < pages && !loadingMore && !loading && !autoLoadError) {
      if (scanAllMode || autoLoadCountRef.current < 10) {
        autoLoadCountRef.current++
        const nextPage = page + 1
        const reqId = loadReqRef.current
        setLoadingMore(true)
        window.flickrAPI.getPhotos(nextPage, sort, activeSearchRef.current)
          .then(result => {
            if (reqId !== loadReqRef.current) return
            const updated = [...photos, ...result.photos]
            setPhotos(updated); setPage(result.page); setPages(result.pages); setTotal(result.total)
            onPhotosLoaded?.(updated); onPageInfo?.(result.page, result.pages)
          })
          .catch(() => { if (reqId === loadReqRef.current) setAutoLoadError(true) })
          .finally(() => { if (reqId === loadReqRef.current) setLoadingMore(false) })
      } else {
        setAutoLoadCapped(true)
      }
    }
  }, [mediaFilter, privacyFilter, licenseFilter, photos.length, page, pages, loadingMore, loading, sort, scanAllMode, autoLoadError])

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

  useLayoutEffect(() => {
    if (loading) return
    if (gridContainerRef.current) {
      setContainerWidth(Math.round(gridContainerRef.current.getBoundingClientRect().width))
    }
  }, [loading, viewMode])

  useEffect(() => {
    if (loading) return
    const el = gridContainerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.round(entry.contentRect.width))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loading, viewMode])

  const justifiedRows = useMemo(() => {
    if (viewMode !== 'justified' || containerWidth === 0) return null
    return computeJustifiedRows(filteredPhotos, containerWidth, rowHeight)
  }, [filteredPhotos, containerWidth, rowHeight, viewMode])


  const hasServerSearch = !!(activeSearch.query || activeSearch.tagQuery || activeSearch.dateMin || activeSearch.dateMax)
  const hasClientFilter = mediaFilter !== 'all' || privacyFilter !== 'all' || downloadFilter !== 'all' || licenseFilter !== 'all'
  const hasAnyFilter = hasServerSearch || hasClientFilter
  useEffect(() => { onFiltersActiveChange?.(hasAnyFilter) }, [hasAnyFilter, onFiltersActiveChange])
  const drawerBadgeCount =
    (privacyFilter !== 'all' ? 1 : 0) +
    (activeSearch.tagQuery ? 1 : 0) +
    ((activeSearch.dateMin || activeSearch.dateMax) ? 1 : 0) +
    (downloadFilter !== 'all' ? 1 : 0) +
    (licenseFilter !== 'all' ? 1 : 0)

  const showDateInputs = dateMode === 'since' || dateMode === 'between'

  if (loading && !loadedOnceRef.current) return (
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
  if (photos.length === 0 && !hasServerSearch && !loading) return <EmptyState title="Your photostream is empty" body="Photos and videos you upload to Flickr will show up here." />

  return (
    <div style={styles.wrapper}>
      <style>{`@keyframes ff-pop { 0% { transform: scale(0.5); opacity: 0 } 65% { transform: scale(1.2) } 100% { transform: scale(1); opacity: 1 } } @keyframes ff-shimmer { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }`}</style>
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
              <button style={{ ...styles.densityBtn, ...(viewMode === 'grid' ? styles.densityBtnActive : {}) }} onClick={() => { const m: PhotoViewMode = 'grid'; setViewMode(m); savePhotoViewMode(m) }}>
                <GridIcon size="medium" />
              </button>
              <button style={{ ...styles.densityBtn, ...(viewMode === 'justified' ? styles.densityBtnActive : {}) }} onClick={() => { const m: PhotoViewMode = 'justified'; setViewMode(m); savePhotoViewMode(m) }}>
                <JustifiedIcon />
              </button>
              {viewMode !== 'list' && (
                <input
                  type="range" min={100} max={300} step={5}
                  value={rowHeight}
                  onChange={e => { const v = Number(e.target.value); setRowHeight(v); saveRowHeight(v) }}
                  style={styles.rowHeightSlider}
                  title={viewMode === 'justified' ? `Row height: ${rowHeight}px` : `Tile size: ${rowHeight}px`}
                />
              )}
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

              {/* License */}
              <div style={styles.drawerRow}>
                <span style={styles.drawerLabel}>License</span>
                <LicenseFilterSelect value={licenseFilter} onChange={setLicenseFilter} />
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
                <Tooltip text={"Separate multiple tags with commas.\n\nAny: photos with at least one of the tags.\nAll: photos with every tag."}>
                  <span style={styles.tagHint}>?</span>
                </Tooltip>
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
              {licenseFilter !== 'all' && (
                <Chip label={LICENSE_FILTER_LABEL[licenseFilter]} onDismiss={() => setLicenseFilter('all')} />
              )}
              <button style={styles.clearFiltersLink} onClick={clearAllFilters}>Clear all</button>
            </div>
          )}

          <p style={styles.countLabel}>
            {loading && photos.length > 0 ? 'Updating…' : hasClientFilter
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

      {loading && photos.length === 0 && (
        <div style={{ ...styles.grid, gridTemplateColumns: GRID_COLUMNS['medium'], padding: '16px' }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{ ...styles.tile, background: '#e8e4de', animation: `ff-shimmer 1.4s ease-in-out infinite`, animationDelay: `${(i % 6) * 0.08}s` }} />
          ))}
        </div>
      )}

      {filteredPhotos.length === 0 && photos.length > 0 && !loadingMore && !loading && (
        <EmptyState
          title="No photos match these filters"
          body={`Nothing in the ${photos.length.toLocaleString()} photos scanned so far. Try removing a filter${autoLoadCapped && page < pages ? ' or scan further.' : '.'}`}
        >
          {autoLoadCapped && page < pages && (
            <>
              <button style={styles.keepSearchingBtn} onClick={() => { autoLoadCountRef.current = 0; setAutoLoadCapped(false) }}>
                Scan next 1,000
              </button>
              <button style={styles.keepSearchingBtn} onClick={() => { autoLoadCountRef.current = 0; setAutoLoadCapped(false); setScanAllMode(true) }}>
                {(() => { const mins = Math.ceil((pages - page) / 60); return `Scan all remaining (est. ~${mins < 1 ? '< 1' : mins} min)` })()}
              </button>
            </>
          )}
          <button style={styles.clearFiltersBtn} onClick={clearAllFilters}>Clear filters</button>
        </EmptyState>
      )}

      {photos.length === 0 && hasServerSearch && !loading && (
        <EmptyState title="No photos match your search" body="Try different words, or remove a filter.">
          <button style={styles.clearFiltersBtn} onClick={clearAllFilters}>Clear search</button>
        </EmptyState>
      )}

      <div style={loading && photos.length > 0 ? { opacity: 0.45, pointerEvents: 'none', transition: 'opacity 0.15s' } : { transition: 'opacity 0.15s' }}>
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
              onContextMenu={() => window.flickrAPI.showPhotoMenu(photo.id)}
            />
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ ...styles.gridContainer, gridTemplateColumns: `repeat(auto-fill, minmax(${rowHeight}px, 1fr))` }}>
          {filteredPhotos.map(photo => {
            const isSelected = selectMode && (selectedIds?.has(photo.id) ?? false)
            const privacyLevel = getPrivacyLevel(photo)
            return (
              <div
                key={photo.id}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  overflow: 'hidden',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  backgroundColor: '#e8e8e8',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  ...(isSelected ? { outline: '3px solid var(--ff-pink)', outlineOffset: '-3px', zIndex: 1 } : {}),
                  ...(selectMode && !isSelected ? { opacity: 0.75 } : {}),
                  ...(!selectMode && hoveredId === photo.id ? { transform: 'scale(1.015)', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 2 } : {})
                }}
                onMouseEnter={() => setHoveredId(photo.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => selectMode ? onToggleSelect?.(photo, e.shiftKey) : onPhotoSelect(photo)}
                onContextMenu={() => window.flickrAPI.showPhotoMenu(photo.id)}
              >
                <img
                  src={photo.url_m || photo.thumbnailUrl}
                  alt={photo.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
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
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 5.5l2.5 2.5 4.5-4.5"/>
                    </svg>
                  </div>
                )}
                {!selectMode && (
                  <div style={{ ...styles.overlay, opacity: hoveredId === photo.id ? 1 : 0 }}>
                    <span style={styles.overlayTitle}>{photo.title}</span>
                  </div>
                )}
                {selectMode && (
                  <div style={{
                    ...styles.selectBadge,
                    backgroundColor: isSelected ? 'var(--ff-pink)' : 'rgba(255,255,255,0.75)',
                    border: isSelected ? '2px solid var(--ff-pink)' : '2px solid rgba(255,255,255,0.9)'
                  }}>
                    {isSelected && <span style={{ ...styles.selectCheck, animation: 'ff-pop 0.18s ease-out' }}>✓</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div ref={gridContainerRef} style={styles.justifiedContainer}>
          {justifiedRows && justifiedRows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              {row.photos.map((photo, pi) => {
                const isSelected = selectMode && (selectedIds?.has(photo.id) ?? false)
                const privacyLevel = getPrivacyLevel(photo)
                return (
                  <div
                    key={photo.id}
                    style={{
                      position: 'relative',
                      width: `${row.widths[pi]}px`,
                      height: `${row.height}px`,
                      flexShrink: 0,
                      overflow: 'hidden',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      ...(isSelected ? { outline: '3px solid var(--ff-pink)', outlineOffset: '-3px', zIndex: 1 } : {}),
                      ...(selectMode && !isSelected ? { opacity: 0.75 } : {}),
                      ...(!selectMode && hoveredId === photo.id ? { transform: 'scale(1.015)', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 2 } : {})
                    }}
                    onMouseEnter={() => setHoveredId(photo.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={(e) => selectMode ? onToggleSelect?.(photo, e.shiftKey) : onPhotoSelect(photo)}
                    onContextMenu={() => window.flickrAPI.showPhotoMenu(photo.id)}
                  >
                    <img
                      src={photo.url_m || photo.thumbnailUrl}
                      alt={photo.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
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
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1.5 5.5l2.5 2.5 4.5-4.5"/>
                        </svg>
                      </div>
                    )}
                    {!selectMode && (
                      <div style={{ ...styles.overlay, opacity: hoveredId === photo.id ? 1 : 0 }}>
                        <span style={styles.overlayTitle}>{photo.title}</span>
                      </div>
                    )}
                    {selectMode && (
                      <div style={{
                        ...styles.selectBadge,
                        backgroundColor: isSelected ? 'var(--ff-pink)' : 'rgba(255,255,255,0.75)',
                        border: isSelected ? '2px solid var(--ff-pink)' : '2px solid rgba(255,255,255,0.9)'
                      }}>
                        {isSelected && <span style={{ ...styles.selectCheck, animation: 'ff-pop 0.18s ease-out' }}>✓</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      </div>

      {!loading && page < pages && (
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
  justifiedContainer: { padding: '4px 16px 16px' },
  gridContainer: { display: 'grid', gap: '4px', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', padding: '4px 16px 16px' },
  thumbPlaceholder: { width: '100%', height: '100%', backgroundColor: '#d0d0d0' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)', padding: '6px 8px', display: 'flex', alignItems: 'flex-start', gap: '6px', opacity: 0, transition: 'opacity 0.15s ease' },
  overlayTitle: { flex: 1, color: '#fff', fontSize: '12px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties,
  downloadBadge: { position: 'absolute', bottom: '6px', right: '6px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(34,168,93,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9), 0 1px 4px rgba(0,0,0,0.12)' },
  errorText: { color: '#cc0000', fontSize: '14px', margin: 0 },
  retryButton: { backgroundColor: 'var(--ff-pink-action)', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' },
  loadMoreRow: { display: 'flex', justifyContent: 'center', padding: '24px 16px' },
  loadMoreButton: { backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '6px', padding: '10px 28px', fontSize: '14px', color: '#444', cursor: 'pointer' },
  disabled: { opacity: 0.6, cursor: 'not-allowed' },
  keepSearchingBtn: { background: '#111', border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', color: '#fff', cursor: 'pointer' },
  scanProgressBar: { height: '3px', background: '#e0dcd6', borderRadius: '2px', overflow: 'hidden', margin: '4px 0 2px' },
  scanProgressFill: { height: '100%', background: 'var(--ff-blue)', borderRadius: '2px', transition: 'width 0.4s ease' },
}
