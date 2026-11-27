import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import Icon from '../ui/Icon'
import { useFindShortcut } from '../hooks/useFindShortcut'
import { DEBOUNCE, useDebouncedEffect } from '../ui/useDebounce'
import type { FlickrPhoto, PhotoPage, SearchOperator, DateRangeField, TagMode, LicenseFilter } from '../../shared/types'
import { MediaFilter, DownloadFilter, PrivacyFilter, PrivacyLevel, PRIVACY_OPTIONS, PRIVACY_LABELS, JustifiedIcon, GridIcon, ListIcon, PrivacyIcon, Chip, PhotoListRow, DownloadFilterSelect, LicenseFilterSelect, matchesLicenseFilter, LICENSE_FILTER_LABEL, getPrivacyLevel, sharedStyles, DateMode, getPresetDates, formatDateChip, loadRowHeight, saveRowHeight, computeJustifiedRows, DOWNLOAD_FILTER_LABEL } from './PhotoGridShared'
import InfoTip from '../ui/InfoTip'
import { cleanTag } from '../../shared/tags'
import EmptyState from './EmptyState'
import BackToTop from '../ui/BackToTop'

type AlbumPhotoViewMode = 'list' | 'grid' | 'justified'

const ALBUM_PHOTO_VIEW_KEY = 'ff-album-photo-view'
function loadAlbumPhotoViewMode(): AlbumPhotoViewMode {
  try {
    const v = localStorage.getItem(ALBUM_PHOTO_VIEW_KEY)
    if (v === 'list') return 'list'
    if (v === 'grid') return 'grid'
  } catch { /* ignore */ }
  return 'justified'
}
function saveAlbumPhotoViewMode(m: AlbumPhotoViewMode): void {
  try { localStorage.setItem(ALBUM_PHOTO_VIEW_KEY, m) } catch { /* ignore */ }
}

type SortOrder = 'album-order' | 'newest-posted' | 'oldest-posted' | 'date-desc' | 'date-asc'

interface AlbumPhotoGridProps {
  albumId: string
  findActive?: boolean   // this album is the screen being shown, so Cmd+F goes to its title search
  onPhotoSelect: (photo: FlickrPhoto) => void
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (photo: FlickrPhoto, shiftKey: boolean) => void
  onPhotosLoaded?: (photos: FlickrPhoto[]) => void
  onPageInfo?: (page: number, pages: number) => void
  onFilteredPhotosChange?: (photos: FlickrPhoto[]) => void
  onMediaFilterChange?: (filter: 'all' | 'photo' | 'video') => void
  onPrivacyFilterChange?: (filter: PrivacyFilter) => void
  // True when any filter other than media/privacy is on (those two are applied server-side by the album download)
  onExtraFiltersChange?: (active: boolean) => void
  // From a tag clicked in the photo detail panel: filter this album to that tag (replaces other filters)
  tagFilterRequest?: { tag: string; nonce: number } | null
  // Lets the tag chip offer 'Search whole photostream' for the same tag
  onSearchWholePhotostream?: (tag: string) => void
  // Remembers which request was already applied, so opening another album doesn't replay it
  handledTagRequest?: React.MutableRefObject<number>
}

export default function AlbumPhotoGrid({ albumId, findActive, onPhotoSelect, selectMode, selectedIds, onToggleSelect, onPhotosLoaded, onPageInfo, onFilteredPhotosChange, onMediaFilterChange, onPrivacyFilterChange, onExtraFiltersChange, tagFilterRequest, onSearchWholePhotostream, handledTagRequest }: AlbumPhotoGridProps): React.JSX.Element {
  const [photos, setPhotos] = useState<FlickrPhoto[]>([])
  const [pageInfo, setPageInfo] = useState<Pick<PhotoPage, 'page' | 'pages' | 'total'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A page that would not load: the filters' auto-loading stops there (instead of asking again in a loop) until "Load more" is pressed
  const [moreError, setMoreError] = useState<string | null>(null)
  const albumReq = useRef(0)   // each album opened (and each page asked for) gets a number, so a slow answer for an album you left is ignored
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const [sort, setSort] = useState<SortOrder>('album-order')
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [viewMode, setViewMode] = useState<AlbumPhotoViewMode>(loadAlbumPhotoViewMode)
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyFilter>('all')
  const [downloadFilter, setDownloadFilter] = useState<DownloadFilter>('all')
  const [licenseFilter, setLicenseFilter] = useState<LicenseFilter>('all')
  const [downloadRecords, setDownloadRecords] = useState<Record<string, true>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [rowHeight, setRowHeight] = useState<number>(loadRowHeight)
  const [containerWidth, setContainerWidth] = useState(0)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  useFindShortcut(findActive === true, searchRef)

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
    const req = ++albumReq.current
    setLoading(true)
    setLoadingMore(false)
    setError(null)
    setMoreError(null)
    setPhotos([])
    loadPage(1)
      .then((data) => {
        if (req !== albumReq.current) return
        setPhotos(data.photos)
        setPageInfo({ page: data.page, pages: data.pages, total: data.total })
        onPhotosLoaded?.(data.photos)
        onPageInfo?.(data.page, data.pages)
      })
      .catch((err: unknown) => { if (req === albumReq.current) setError(err instanceof Error ? err.message : 'Couldn\'t load photos.') })
      .finally(() => { if (req === albumReq.current) setLoading(false) })
  }, [loadPage])

  const handleLoadMore = useCallback(async (): Promise<void> => {
    if (!pageInfo || pageInfo.page >= pageInfo.pages) return
    const req = albumReq.current
    setLoadingMore(true)
    setMoreError(null)
    try {
      const data = await loadPage(pageInfo.page + 1)
      if (req !== albumReq.current) return
      setPhotos(prev => {
        const updated = [...prev, ...data.photos]
        onPhotosLoaded?.(updated)
        return updated
      })
      setPageInfo({ page: data.page, pages: data.pages, total: data.total })
      onPageInfo?.(data.page, data.pages)
    } catch (err) {
      if (req === albumReq.current) setMoreError(err instanceof Error ? err.message : 'Couldn\'t load more photos.')
    } finally {
      if (req === albumReq.current) setLoadingMore(false)
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

  // Filters apply as you go. Albums are filtered on the photos already loaded, so a short
  // pause after typing is enough — no Apply button needed.
  useDebouncedEffect(() => { setActiveTitleQuery(titleQuery.trim()); setActiveTitleOperator(titleOperator) }, [titleQuery, titleOperator], DEBOUNCE.tags)
  useDebouncedEffect(() => { setActiveTagQuery(tagQuery.trim()); setActiveTagMode(tagMode) }, [tagQuery, tagMode], DEBOUNCE.tags)
  useDebouncedEffect(() => {
    if (dateMode === 'all') { setActiveDateMin(''); setActiveDateMax(''); return }
    setActiveDateMin(dateCustomMin); setActiveDateMax(dateCustomMax); setActiveDateField(dateField)
  }, [dateMode, dateField, dateCustomMin, dateCustomMax], DEBOUNCE.dates)

  // A tag clicked in the detail panel: start over with just that tag
  useEffect(() => {
    if (!tagFilterRequest || handledTagRequest?.current === tagFilterRequest.nonce) return
    if (handledTagRequest) handledTagRequest.current = tagFilterRequest.nonce
    setMediaFilter('all'); setPrivacyFilter('all'); setDownloadFilter('all'); setLicenseFilter('all')
    setTitleQuery(''); setActiveTitleQuery('')
    setDateMode('all'); setDateCustomMin(''); setDateCustomMax('')
    setActiveDateMin(''); setActiveDateMax('')
    setTagMode('any'); setTagQuery(tagFilterRequest.tag)
    setActiveTagQuery(tagFilterRequest.tag); setActiveTagMode('any')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagFilterRequest?.nonce])

  const clearAllFilters = (): void => {
    setMediaFilter('all'); setPrivacyFilter('all'); setDownloadFilter('all'); setLicenseFilter('all')
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
    // Flickr's own tag form (lower case, no spaces or punctuation), so "New York" matches "newyork"
    const tagList = activeTagQuery ? activeTagQuery.split(',').map(cleanTag).filter(Boolean) : []
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
        const photoTags = (p.tags ?? []).map(cleanTag)
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
    if (licenseFilter !== 'all') {
      result = result.filter(p => matchesLicenseFilter(p.license, licenseFilter))
    }
    return result
  }, [licenseFilter, sortedPhotos, activeTitleQuery, activeTitleOperator, activeTagQuery, activeTagMode, activeDateMin, activeDateMax, activeDateField, mediaFilter, privacyFilter, downloadFilter, downloadRecords])

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
    const filterActive = mediaFilter !== 'all' || privacyFilter !== 'all' || downloadFilter !== 'all' || licenseFilter !== 'all' || !!activeTitleQuery || !!activeTagQuery || !!activeDateMin || !!activeDateMax
    if (filterActive && photos.length > 0 && pageInfo && pageInfo.page < pageInfo.pages && !loadingMore && !loading && !moreError) {
      handleLoadMore()
    }
  }, [mediaFilter, privacyFilter, downloadFilter, licenseFilter, activeTitleQuery, activeTagQuery, activeDateMin, activeDateMax, photos.length, pageInfo?.page, pageInfo?.pages, loadingMore, loading, moreError, handleLoadMore])

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

  const hasAnyFilter = mediaFilter !== 'all' || privacyFilter !== 'all' || downloadFilter !== 'all' || licenseFilter !== 'all' || !!activeTitleQuery || !!activeTagQuery || !!activeDateMin || !!activeDateMax
  const drawerBadgeCount = (privacyFilter !== 'all' ? 1 : 0) + (activeTagQuery ? 1 : 0) + ((activeDateMin || activeDateMax) ? 1 : 0) + (downloadFilter !== 'all' ? 1 : 0) + (licenseFilter !== 'all' ? 1 : 0)
  const extraFiltersActive = downloadFilter !== 'all' || licenseFilter !== 'all' || !!activeTitleQuery || !!activeTagQuery || !!activeDateMin || !!activeDateMax
  useEffect(() => { onExtraFiltersChange?.(extraFiltersActive) }, [extraFiltersActive, onExtraFiltersChange])
  const showDateInputs = dateMode === 'since' || dateMode === 'between'
  const hasMore = pageInfo ? pageInfo.page < pageInfo.pages : false

  if (loading) return <div style={styles.centered}><p style={styles.mutedText}>Loading photos…</p></div>
  if (error) return <div style={styles.centered}><p style={styles.mutedText}>{error}</p></div>
  if (photos.length === 0) return <EmptyState title="This album is empty" body="Photos added to it on Flickr will show up here." />

  return (
    <div style={styles.container}>
      <style>{`@keyframes ff-pop { 0% { transform: scale(0.5); opacity: 0 } 65% { transform: scale(1.2) } 100% { transform: scale(1); opacity: 1 } }`}</style>
      {selectMode && (mediaFilter !== 'all' || privacyFilter !== 'all' || downloadFilter !== 'all' || licenseFilter !== 'all' || !!activeTitleQuery || !!activeTagQuery || !!activeDateMin || !!activeDateMax) && (
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
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.77" strokeLinecap="round" strokeLinejoin="round">
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
                ref={searchRef}
                style={styles.searchInput}
                type="text"
                placeholder="Search…"
                value={titleQuery}
                onChange={e => setTitleQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyTitleSearch()}
              />
              {titleQuery && (
                <button style={styles.searchClearBtn} onClick={() => { if (activeTitleQuery) dismissTitleSearch(); else setTitleQuery('') }}><Icon name="close" /></button>
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
              <button style={{ ...styles.densityBtn, ...(viewMode === 'list' ? styles.densityBtnActive : {}) }} onClick={() => { const m: AlbumPhotoViewMode = 'list'; setViewMode(m); saveAlbumPhotoViewMode(m) }}>
                <ListIcon />
              </button>
              <button style={{ ...styles.densityBtn, ...(viewMode === 'grid' ? styles.densityBtnActive : {}) }} onClick={() => { const m: AlbumPhotoViewMode = 'grid'; setViewMode(m); saveAlbumPhotoViewMode(m) }}>
                <GridIcon size="medium" />
              </button>
              <button style={{ ...styles.densityBtn, ...(viewMode === 'justified' ? styles.densityBtnActive : {}) }} onClick={() => { const m: AlbumPhotoViewMode = 'justified'; setViewMode(m); saveAlbumPhotoViewMode(m) }}>
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

              {/* Downloaded */}
              <div style={styles.drawerRow}>
                <span style={styles.drawerLabel}>Downloaded</span>
                <DownloadFilterSelect value={downloadFilter} onChange={setDownloadFilter} />
              </div>

              <div style={styles.drawerRow}>
                <span style={styles.drawerLabel}>License</span>
                <LicenseFilterSelect value={licenseFilter} onChange={setLicenseFilter} />
              </div>

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
                    <button style={styles.searchClearBtn} onClick={() => { if (activeTagQuery) dismissTagSearch(); else setTagQuery('') }}><Icon name="close" /></button>
                  )}
                </div>
                <div style={styles.segGroup}>
                  {(['any', 'all'] as TagMode[]).map(v => (
                    <button key={v} style={{ ...styles.seg, ...(tagMode === v ? styles.segActive : {}) }} onClick={() => setTagMode(v)}>
                      {v}
                    </button>
                  ))}
                </div>
                <InfoTip text={"Separate multiple tags with commas.\n\nAny: photos with at least one of the tags.\nAll: photos with every tag."} />
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
                <>
                  <Chip
                    label={`Tags (${activeTagMode}): ${activeTagQuery} · in this album (${filteredPhotos.length.toLocaleString()}${hasMore ? '+' : ''})`}
                    onDismiss={dismissTagSearch}
                  />
                  {onSearchWholePhotostream && (
                    <button style={styles.clearFiltersLink} onClick={() => onSearchWholePhotostream(activeTagQuery)}>Search whole photostream</button>
                  )}
                </>
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
              {licenseFilter !== 'all' && (
                <Chip label={LICENSE_FILTER_LABEL[licenseFilter]} onDismiss={() => setLicenseFilter('all')} />
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
        <EmptyState title="No photos match these filters" body="Try removing a filter.">
          <button style={styles.clearFiltersBtn} onClick={clearAllFilters}>Clear filters</button>
        </EmptyState>
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
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: 'var(--ff-border)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  ...(isSelected ? { outline: '3px solid var(--ff-pink)', outlineOffset: '-3px', zIndex: 1 } : {}),
                  ...(selectMode && !isSelected ? { opacity: 0.75 } : {}),
                  ...(!selectMode && hoveredId === photo.id ? { transform: 'scale(1.015)', boxShadow: '0 4px 16px var(--ff-shadow-mid)', zIndex: 2 } : {})
                }}
                onClick={(e) => selectMode ? onToggleSelect?.(photo, e.shiftKey) : onPhotoSelect(photo)}
                onContextMenu={() => window.flickrAPI.showPhotoMenu(photo.id)}
                onMouseEnter={() => setHoveredId(photo.id)}
                onMouseLeave={() => setHoveredId(null)}
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
                      <circle cx="15" cy="15" r="15" fill="var(--ff-badge-bg)"/>
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
                  <div style={{ ...styles.overlay, opacity: hoveredId === photo.id ? 1 : 0, background: hoveredId === photo.id ? 'var(--ff-shadow-strong)' : 'transparent' }}>
                    <span style={styles.overlayTitle}>{photo.title}</span>
                  </div>
                )}
                {selectMode && (
                  <div style={{
                    ...styles.selectBadge,
                    backgroundColor: isSelected ? 'var(--ff-pink)' : 'var(--ff-glass-soft)',
                    border: isSelected ? '2px solid var(--ff-pink)' : '2px solid var(--ff-glass)'
                  }}>
                    {isSelected && <span style={{ ...styles.selectCheck, animation: 'ff-pop 0.18s ease-out' }}><Icon name="check" /></span>}
                  </div>
                )}
              </div>
            )
          })}
          <BackToTop />
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
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      ...(isSelected ? { outline: '3px solid var(--ff-pink)', outlineOffset: '-3px', zIndex: 1 } : {}),
                      ...(selectMode && !isSelected ? { opacity: 0.75 } : {}),
                      ...(!selectMode && hoveredId === photo.id ? { transform: 'scale(1.015)', boxShadow: '0 4px 16px var(--ff-shadow-mid)', zIndex: 2 } : {})
                    }}
                    onClick={(e) => selectMode ? onToggleSelect?.(photo, e.shiftKey) : onPhotoSelect(photo)}
                    onContextMenu={() => window.flickrAPI.showPhotoMenu(photo.id)}
                    onMouseEnter={() => setHoveredId(photo.id)}
                    onMouseLeave={() => setHoveredId(null)}
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
                          <circle cx="15" cy="15" r="15" fill="var(--ff-badge-bg)"/>
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
                      <div style={{ ...styles.overlay, opacity: hoveredId === photo.id ? 1 : 0, background: hoveredId === photo.id ? 'var(--ff-shadow-strong)' : 'transparent' }}>
                        <span style={styles.overlayTitle}>{photo.title}</span>
                      </div>
                    )}
                    {selectMode && (
                      <div style={{
                        ...styles.selectBadge,
                        backgroundColor: isSelected ? 'var(--ff-pink)' : 'var(--ff-glass-soft)',
                        border: isSelected ? '2px solid var(--ff-pink)' : '2px solid var(--ff-glass)'
                      }}>
                        {isSelected && <span style={{ ...styles.selectCheck, animation: 'ff-pop 0.18s ease-out' }}><Icon name="check" /></span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div style={styles.loadMore}>
          {moreError && <p style={styles.mutedText}>Couldn't load the next page ({moreError}). Press the button to try again.</p>}
          <button style={styles.loadMoreBtn} onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : `${moreError ? 'Try again' : 'Load more'} (${(pageInfo!.total - photos.length).toLocaleString()} remaining)`}
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
  justifiedContainer: { padding: '4px' },
  gridContainer: { display: 'grid', gap: '4px', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', padding: '4px' },
  // Album tile uses opacity transition for hover overlay; PhotoGrid conditionally renders its overlay instead
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', padding: '8px', opacity: 0, transition: 'opacity 0.15s' },
  overlayTitle: { color: 'var(--ff-white)', fontSize: '12px', fontWeight: '400', textShadow: '0 1px 3px var(--ff-scrim-strong)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', width: '100%' } as React.CSSProperties,
  downloadBadge: { position: 'absolute', bottom: '6px', right: '6px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--ff-success) 90%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, boxShadow: '0 0 0 1.5px var(--ff-glass), 0 1px 4px var(--ff-shadow-soft)' },
  loadMore: { padding: '16px', textAlign: 'center' },
  loadMoreBtn: { background: 'var(--ff-surface)', border: '1px solid var(--ff-line-strong)', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', color: 'var(--ff-text)', cursor: 'pointer' },
}
