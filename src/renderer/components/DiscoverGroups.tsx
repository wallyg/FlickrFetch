import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import type { FlickrPhoto, DiscoverGroup, TagMode } from '../../shared/types'
import PhotoDetail from './PhotoDetail'
import { AttributionNotice, DiscoverTile, DiscoverSelectBar } from './DiscoverExplore'
import SmartDownloadButton from './SmartDownloadButton'
import { GridIcon, ListIcon, JustifiedIcon, ChevronLeftIcon, ChevronRightIcon, sharedStyles as ss, type PhotoViewMode, type MediaFilter, type DownloadFilter, type LicenseFilter, PhotoListRow, DownloadFilterSelect, LicenseFilterSelect, matchesLicenseFilter, Chip, loadPhotoViewMode, savePhotoViewMode, loadRowHeight, saveRowHeight, computeJustifiedRows } from './PhotoGridShared'

type GroupView = 'list' | 'pool'

export default function DiscoverGroups(): React.JSX.Element {
  const [view, setView] = useState<GroupView>('list')
  const [groups, setGroups] = useState<DiscoverGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState('')
  const [activeGroup, setActiveGroup] = useState<DiscoverGroup | null>(null)
  const [poolPhotos, setPoolPhotos] = useState<FlickrPhoto[]>([])
  const [poolPage, setPoolPage] = useState(1)
  const [poolPages, setPoolPages] = useState(1)
  const [poolLoading, setPoolLoading] = useState(false)
  const [poolLoadingMore, setPoolLoadingMore] = useState(false)
  const [poolError, setPoolError] = useState<string | null>(null)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [poolViewMode, setPoolViewMode] = useState<PhotoViewMode>(loadPhotoViewMode)
  const [rowHeight, setRowHeight] = useState<number>(loadRowHeight)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  // Pool toolbar state
  const [poolMediaFilter, setPoolMediaFilter] = useState<MediaFilter>('all')
  const [poolDownloadRecords, setPoolDownloadRecords] = useState<Record<string, true>>({})
  const [poolSort, setPoolSort] = useState('date-posted-desc')
  const [poolSearchInput, setPoolSearchInput] = useState('')
  const [poolDrawerOpen, setPoolDrawerOpen] = useState(false)
  // Drawer pending state (staged, not applied until Apply is clicked)
  const [poolPendingDownloadFilter, setPoolPendingDownloadFilter] = useState<DownloadFilter>('all')
  const [poolPendingTagInput, setPoolPendingTagInput] = useState('')
  const [poolPendingTagMode, setPoolPendingTagMode] = useState<TagMode>('any')
  const [poolPendingDateField, setPoolPendingDateField] = useState<'taken' | 'posted'>('posted')
  const [poolPendingDatePreset, setPoolPendingDatePreset] = useState('all')
  const [poolPendingDateFrom, setPoolPendingDateFrom] = useState('')
  const [poolPendingDateTo, setPoolPendingDateTo] = useState('')
  const [poolPendingLicenseFilter, setPoolPendingLicenseFilter] = useState<LicenseFilter>('all')
  // Drawer applied state (what actually filters)
  const [poolAppliedDownloadFilter, setPoolAppliedDownloadFilter] = useState<DownloadFilter>('all')
  const [poolAppliedLicenseFilter, setPoolAppliedLicenseFilter] = useState<LicenseFilter>('all')
  const [poolAppliedTagInput, setPoolAppliedTagInput] = useState('')
  const [poolAppliedTagMode, setPoolAppliedTagMode] = useState<TagMode>('any')
  const [poolAppliedDateField, setPoolAppliedDateField] = useState<'taken' | 'posted'>('posted')
  const [poolAppliedDatePreset, setPoolAppliedDatePreset] = useState('all')
  const [poolAppliedDateFrom, setPoolAppliedDateFrom] = useState('')
  const [poolAppliedDateTo, setPoolAppliedDateTo] = useState('')
  // Large-group download warning
  const [groupDownloadWarning, setGroupDownloadWarning] = useState<{ photoCount: number } | null>(null)
  const loadedRef = useRef(false)
  const gridContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    setLoading(true)
    window.flickrAPI.discoverGetMyGroups()
      .then(g => { setGroups(g); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Failed to load groups'); setLoading(false) })
  }, [])

  const filteredGroups = groupFilter.trim()
    ? groups.filter(g => g.name.toLowerCase().includes(groupFilter.toLowerCase()))
    : groups

  const openGroup = useCallback(async (group: DiscoverGroup): Promise<void> => {
    setActiveGroup(group)
    setView('pool')
    setPoolPhotos([])
    setPoolPage(1)
    setPoolPages(1)
    setPoolError(null)
    setDetailIndex(null)
    setSelectMode(false)
    setSelectedIds(new Set())
    setPoolMediaFilter('all')
    setPoolDownloadRecords({})
    setPoolSort('date-posted-desc')
    setPoolSearchInput('')
    setPoolDrawerOpen(false)
    setPoolPendingDownloadFilter('all'); setPoolPendingLicenseFilter('all'); setPoolPendingTagInput(''); setPoolPendingTagMode('any')
    setPoolPendingDateField('posted'); setPoolPendingDatePreset('all'); setPoolPendingDateFrom(''); setPoolPendingDateTo('')
    setPoolAppliedDownloadFilter('all'); setPoolAppliedLicenseFilter('all'); setPoolAppliedTagInput(''); setPoolAppliedTagMode('any')
    setPoolAppliedDateField('posted'); setPoolAppliedDatePreset('all'); setPoolAppliedDateFrom(''); setPoolAppliedDateTo('')
    setGroupDownloadWarning(null)
    setPoolLoading(true)
    try {
      const result = await window.flickrAPI.discoverGetGroupPhotos(group.id, 1)
      setPoolPhotos(result.photos)
      setPoolPage(result.page)
      setPoolPages(result.pages)
    } catch (e) {
      setPoolError(e instanceof Error ? e.message : 'Failed to load group pool')
    } finally {
      setPoolLoading(false)
    }
  }, [])

  const loadMorePool = useCallback(async (): Promise<void> => {
    if (!activeGroup || poolLoadingMore || poolPage >= poolPages) return
    setPoolLoadingMore(true)
    try {
      const result = await window.flickrAPI.discoverGetGroupPhotos(activeGroup.id, poolPage + 1)
      setPoolPhotos(prev => [...prev, ...result.photos])
      setPoolPage(result.page)
    } catch { /* ignore */ }
    finally { setPoolLoadingMore(false) }
  }, [activeGroup, poolLoadingMore, poolPage, poolPages])

  // Computed before effects so hasFilteredPhotos can be used as a dep to re-attach
  // the ResizeObserver when the justified grid container remounts after filtering empties it
  const filteredPoolPhotos = useMemo(() => {
    let result = [...poolPhotos]
    if (poolMediaFilter !== 'all') result = result.filter(p => p.media === poolMediaFilter)
    if (poolAppliedDownloadFilter === 'downloaded') result = result.filter(p => !!poolDownloadRecords[p.id])
    if (poolAppliedDownloadFilter === 'not-downloaded') result = result.filter(p => !poolDownloadRecords[p.id])
    if (poolAppliedLicenseFilter !== 'all') result = result.filter(p => matchesLicenseFilter(p.license, poolAppliedLicenseFilter))
    if (poolSearchInput.trim()) {
      const q = poolSearchInput.trim().toLowerCase()
      result = result.filter(p => p.title.toLowerCase().includes(q))
    }
    if (poolAppliedTagInput.trim()) {
      const tags = poolAppliedTagInput.trim().toLowerCase().split(/\s+/).filter(Boolean)
      result = result.filter(p => {
        if (!p.tags || p.tags.length === 0) return false
        const photoTags = p.tags.map(t => t.toLowerCase())
        return poolAppliedTagMode === 'all'
          ? tags.every(t => photoTags.includes(t))
          : tags.some(t => photoTags.includes(t))
      })
    }
    if (poolAppliedDatePreset !== 'all' || poolAppliedDateFrom || poolAppliedDateTo) {
      const now = new Date()
      let fromDate: Date | null = null
      let toDate: Date | null = null
      if (poolAppliedDatePreset === 'last7') { fromDate = new Date(now.getTime() - 7 * 86400000); toDate = now }
      else if (poolAppliedDatePreset === 'last30') { fromDate = new Date(now.getTime() - 30 * 86400000); toDate = now }
      else if (poolAppliedDatePreset === 'thisYear') { fromDate = new Date(now.getFullYear(), 0, 1); toDate = now }
      else if (poolAppliedDatePreset === 'lastYear') { fromDate = new Date(now.getFullYear() - 1, 0, 1); toDate = new Date(now.getFullYear(), 0, 1) }
      else if (poolAppliedDatePreset === 'custom') {
        if (poolAppliedDateFrom) fromDate = new Date(poolAppliedDateFrom)
        if (poolAppliedDateTo) toDate = new Date(poolAppliedDateTo + 'T23:59:59')
      }
      if (fromDate || toDate) {
        result = result.filter(p => {
          let d: Date | null = null
          if (poolAppliedDateField === 'taken') {
            d = p.dateTaken ? new Date(p.dateTaken.slice(0, 10)) : null
          } else {
            d = p.datePosted ? new Date(Number(p.datePosted) * 1000) : null
          }
          if (!d) return false
          if (fromDate && d < fromDate) return false
          if (toDate && d > toDate) return false
          return true
        })
      }
    }
    if (poolSort === 'date-posted-desc') result.sort((a, b) => Number(b.datePosted ?? 0) - Number(a.datePosted ?? 0))
    else if (poolSort === 'date-posted-asc') result.sort((a, b) => Number(a.datePosted ?? 0) - Number(b.datePosted ?? 0))
    else if (poolSort === 'date-taken-desc') result.sort((a, b) => (b.dateTaken > a.dateTaken ? 1 : -1))
    else if (poolSort === 'date-taken-asc') result.sort((a, b) => (a.dateTaken > b.dateTaken ? 1 : -1))
    return result
  }, [poolPhotos, poolMediaFilter, poolAppliedDownloadFilter, poolAppliedLicenseFilter, poolDownloadRecords, poolSearchInput, poolAppliedTagInput, poolAppliedTagMode, poolAppliedDateField, poolAppliedDatePreset, poolAppliedDateFrom, poolAppliedDateTo, poolSort])

  const hasFilteredPhotos = filteredPoolPhotos.length > 0

  const poolActiveFilterCount = [
    poolAppliedDownloadFilter !== 'all',
    poolAppliedLicenseFilter !== 'all',
    poolAppliedTagInput.trim().length > 0,
    poolAppliedDatePreset !== 'all' || poolAppliedDateFrom !== '' || poolAppliedDateTo !== '',
  ].filter(Boolean).length

  useLayoutEffect(() => {
    if (poolLoading) return
    if (gridContainerRef.current) {
      setContainerWidth(Math.round(gridContainerRef.current.getBoundingClientRect().width))
    }
  }, [poolLoading, poolViewMode, hasFilteredPhotos])

  useEffect(() => {
    if (poolLoading) return
    const el = gridContainerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.round(entry.contentRect.width))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [poolLoading, poolViewMode, hasFilteredPhotos])

  useEffect(() => {
    if (poolPhotos.length === 0) return
    window.flickrAPI.getDiscoverRecordsBatch(poolPhotos.map(p => p.id))
      .then(records => {
        const map: Record<string, true> = {}
        Object.keys(records).forEach(id => { map[id] = true })
        setPoolDownloadRecords(map)
      })
      .catch(() => {})
  }, [poolPhotos])

  const poolJustifiedRows = useMemo(() => {
    if (poolViewMode !== 'justified' || containerWidth === 0) return null
    return computeJustifiedRows(filteredPoolPhotos, containerWidth, rowHeight)
  }, [filteredPoolPhotos, poolViewMode, containerWidth, rowHeight])

  const handleBack = (): void => {
    setView('list')
    setActiveGroup(null)
    setDetailIndex(null)
    setSelectMode(false)
    setSelectedIds(new Set())
    setPoolMediaFilter('all')
    setPoolDownloadRecords({})
    setPoolSort('date-posted-desc')
    setPoolSearchInput('')
    setPoolDrawerOpen(false)
    setPoolPendingDownloadFilter('all'); setPoolPendingLicenseFilter('all'); setPoolPendingTagInput(''); setPoolPendingTagMode('any')
    setPoolPendingDateField('posted'); setPoolPendingDatePreset('all'); setPoolPendingDateFrom(''); setPoolPendingDateTo('')
    setPoolAppliedDownloadFilter('all'); setPoolAppliedLicenseFilter('all'); setPoolAppliedTagInput(''); setPoolAppliedTagMode('any')
    setPoolAppliedDateField('posted'); setPoolAppliedDatePreset('all'); setPoolAppliedDateFrom(''); setPoolAppliedDateTo('')
    setGroupDownloadWarning(null)
  }

  const toggleSelect = (id: string): void => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleDownloadSelected = async (): Promise<void> => {
    if (!activeGroup) return
    const selected = poolPhotos.filter(p => selectedIds.has(p.id)).map(p => ({ id: p.id, title: p.title }))
    if (!selected.length) return
    setDownloading(true)
    try {
      await window.flickrAPI.startDiscoverSelectedBatch(selected, `Selected from ${activeGroup.name}`, ['Groups', activeGroup.name])
    } finally {
      setDownloading(false)
      setSelectMode(false)
      setSelectedIds(new Set())
    }
  }

  if (view === 'pool' && activeGroup) {
    if (detailIndex !== null && filteredPoolPhotos[detailIndex]) {
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <PhotoDetail
            photo={filteredPoolPhotos[detailIndex]}
            index={detailIndex}
            total={filteredPoolPhotos.length}
            hasMore={poolPage < poolPages}
            canGoPrev={detailIndex > 0}
            canGoNext={detailIndex < filteredPoolPhotos.length - 1 || poolPage < poolPages}
            onPrev={() => setDetailIndex(d => (d !== null && d > 0 ? d - 1 : d))}
            onNext={() => {
              if (detailIndex < filteredPoolPhotos.length - 1) setDetailIndex(detailIndex + 1)
              else { loadMorePool().then(() => setDetailIndex(di => di !== null ? di + 1 : di)) }
            }}
            onClose={() => setDetailIndex(null)}
            sourceName={activeGroup.name}
            discoverMode
          />
        </div>
      )
    }

    return (
      <div style={s.container}>
        <div style={s.stickyHeader}>
          <div style={s.headerRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button style={s.backBtn} onClick={handleBack}><ChevronLeftIcon />My Groups</button>
              {activeGroup.iconUrl && (
                <img src={activeGroup.iconUrl} alt="" style={s.groupIcon} loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none' }} />
              )}
              <div>
                <h2 style={s.heading}>{activeGroup.name}</h2>
                {activeGroup.photoCount != null && (
                  <p style={s.subheading}>{activeGroup.photoCount.toLocaleString()} photos in pool</p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {!selectMode && (
                <SmartDownloadButton
                  label="Download Group"
                  onDownload={(mode) => {
                    if (mode === 'all' && activeGroup.photoCount != null && activeGroup.photoCount > 500) {
                      setGroupDownloadWarning({ photoCount: activeGroup.photoCount })
                      return
                    }
                    const smartMode = mode === 'all' ? undefined : mode
                    void window.flickrAPI.startDiscoverGroupBatch(activeGroup.id, activeGroup.name, `↓ ${activeGroup.name}`, true, smartMode)
                  }}
                />
              )}
              {poolPhotos.length > 0 && !selectMode && (
                <button style={s.selectBtn} onClick={() => setSelectMode(true)}>Select</button>
              )}
              {selectMode && (
                <button style={s.selectBtn} onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}>Cancel</button>
              )}
            </div>
          </div>
          {selectMode && (
            <DiscoverSelectBar
              count={selectedIds.size}
              total={poolPhotos.length}
              onDownload={handleDownloadSelected}
              onClearSelection={() => setSelectedIds(new Set())}
              onCancel={() => { setSelectMode(false); setSelectedIds(new Set()) }}
              downloading={downloading}
            />
          )}
          {groupDownloadWarning && (
            <div style={{ padding: '8px 16px', backgroundColor: 'rgba(240,165,51,0.1)', borderBottom: '1px solid rgba(240,165,51,0.25)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
              <span style={{ color: '#f0a533', fontSize: '15px', flexShrink: 0 }}>⚠</span>
              <span style={{ flex: 1 }}>
                This group has {groupDownloadWarning.photoCount.toLocaleString()} photos. Downloading all may take a while to start.
              </span>
              <button
                style={{ background: 'none', border: '1px solid rgba(240,165,51,0.5)', borderRadius: '5px', padding: '4px 10px', fontSize: '12px', color: '#f0a533', cursor: 'pointer', flexShrink: 0 }}
                onClick={() => {
                  setGroupDownloadWarning(null)
                  void window.flickrAPI.startDiscoverGroupBatch(activeGroup.id, activeGroup.name, `↓ ${activeGroup.name}`, true, undefined)
                }}
              >
                Download anyway
              </button>
              <button
                style={{ background: 'none', border: 'none', fontSize: '16px', color: '#999', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
                onClick={() => setGroupDownloadWarning(null)}
              >✕</button>
            </div>
          )}
          {!selectMode && (
            <div style={ss.toolbarWrap}>
              <div style={ss.toolbar}>
                {/* Media filter */}
                <div style={ss.segGroup}>
                  {(['all', 'photo', 'video'] as MediaFilter[]).map(f => (
                    <button key={f}
                      style={{ ...ss.seg, ...(poolMediaFilter === f ? ss.segActive : {}) }}
                      onClick={() => setPoolMediaFilter(f)}
                    >
                      {f === 'all' ? 'All' : f === 'photo' ? 'Photos' : 'Videos'}
                    </button>
                  ))}
                </div>

                {/* Keyword search */}
                <div style={ss.searchGroup}>
                  <span style={ss.searchIcon}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </span>
                  <input
                    style={ss.searchInput}
                    placeholder="Search titles…"
                    value={poolSearchInput}
                    onChange={e => setPoolSearchInput(e.target.value)}
                  />
                  {poolSearchInput && (
                    <button style={ss.searchClearBtn} onClick={() => setPoolSearchInput('')}>✕</button>
                  )}
                </div>

                {/* More filters toggle */}
                <button
                  style={{ ...ss.moreFiltersBtn, ...(poolDrawerOpen || poolActiveFilterCount > 0 ? ss.moreFiltersBtnActive : {}) }}
                  onClick={() => setPoolDrawerOpen(d => !d)}
                >
                  Filters
                  {poolActiveFilterCount > 0 && <span style={ss.drawerBadge}>{poolActiveFilterCount}</span>}
                </button>

                {/* Density + height */}
                <div style={ss.segGroupDensity}>
                  <button style={{ ...ss.densityBtn, ...(poolViewMode === 'list' ? ss.densityBtnActive : {}) }} onClick={() => { const m: PhotoViewMode = 'list'; setPoolViewMode(m); savePhotoViewMode(m) }}>
                    <ListIcon />
                  </button>
                  <button style={{ ...ss.densityBtn, ...(poolViewMode === 'grid' ? ss.densityBtnActive : {}) }} onClick={() => { const m: PhotoViewMode = 'grid'; setPoolViewMode(m); savePhotoViewMode(m) }}>
                    <GridIcon size="medium" />
                  </button>
                  <button style={{ ...ss.densityBtn, ...(poolViewMode === 'justified' ? ss.densityBtnActive : {}) }} onClick={() => { const m: PhotoViewMode = 'justified'; setPoolViewMode(m); savePhotoViewMode(m) }}>
                    <JustifiedIcon />
                  </button>
                  {poolViewMode !== 'list' && (
                    <input type="range" min={100} max={300} step={5} value={rowHeight}
                      onChange={e => { const v = Number(e.target.value); setRowHeight(v); saveRowHeight(v) }}
                      style={ss.rowHeightSlider}
                      title={poolViewMode === 'justified' ? `Row height: ${rowHeight}px` : `Tile size: ${rowHeight}px`}
                    />
                  )}
                </div>

                {/* Sort */}
                <select style={ss.sortSelect} value={poolSort} onChange={e => setPoolSort(e.target.value)}>
                  <option value="date-posted-desc">Newest posted</option>
                  <option value="date-posted-asc">Oldest posted</option>
                  <option value="date-taken-desc">Date taken (newest)</option>
                  <option value="date-taken-asc">Date taken (oldest)</option>
                </select>
              </div>

              {/* Filter drawer */}
              {poolDrawerOpen && (
                <div style={ss.drawer}>
                  <div style={ss.drawerRow}>
                    <span style={ss.drawerLabel}>Downloaded</span>
                    <DownloadFilterSelect value={poolPendingDownloadFilter} onChange={setPoolPendingDownloadFilter} />
                  </div>
                  <div style={ss.drawerRow}>
                    <span style={ss.drawerLabel}>License</span>
                    <LicenseFilterSelect value={poolPendingLicenseFilter} onChange={setPoolPendingLicenseFilter} />
                  </div>
                  <div style={ss.drawerRow}>
                    <span style={ss.drawerLabel}>Tags</span>
                    <input
                      style={{ ...ss.searchInput, border: '1px solid #ddd', borderRadius: '6px', padding: '5px 8px' }}
                      placeholder="tag1 tag2…"
                      value={poolPendingTagInput}
                      onChange={e => setPoolPendingTagInput(e.target.value)}
                    />
                    <div style={ss.segGroup}>
                      {(['any', 'all'] as TagMode[]).map(m => (
                        <button key={m}
                          style={{ ...ss.seg, ...(poolPendingTagMode === m ? ss.segActive : {}) }}
                          onClick={() => setPoolPendingTagMode(m)}
                        >
                          {m === 'any' ? 'Any' : 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={ss.drawerRow}>
                    <span style={ss.drawerLabel}>Date</span>
                    <div style={ss.segGroup}>
                      {(['taken', 'posted'] as Array<'taken' | 'posted'>).map(f => (
                        <button key={f}
                          style={{ ...ss.seg, ...(poolPendingDateField === f ? ss.segActive : {}) }}
                          onClick={() => setPoolPendingDateField(f)}
                        >
                          {f === 'taken' ? 'Taken' : 'Posted'}
                        </button>
                      ))}
                    </div>
                    <select
                      style={{ ...ss.sortSelect, fontSize: '12px' }}
                      value={poolPendingDatePreset}
                      onChange={e => { setPoolPendingDatePreset(e.target.value); setPoolPendingDateFrom(''); setPoolPendingDateTo('') }}
                    >
                      <option value="all">All time</option>
                      <option value="last7">Last 7 days</option>
                      <option value="last30">Last 30 days</option>
                      <option value="thisYear">This year</option>
                      <option value="lastYear">Last year</option>
                      <option value="custom">Custom range</option>
                    </select>
                  </div>
                  {poolPendingDatePreset === 'custom' && (
                    <div style={{ ...ss.drawerRow, paddingLeft: '64px', gap: '6px' }}>
                      <input type="date"
                        style={{ ...ss.searchInput, border: '1px solid #ddd', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}
                        value={poolPendingDateFrom} onChange={e => setPoolPendingDateFrom(e.target.value)} />
                      <span style={{ color: '#999', fontSize: '12px' }}>–</span>
                      <input type="date"
                        style={{ ...ss.searchInput, border: '1px solid #ddd', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}
                        value={poolPendingDateTo} onChange={e => setPoolPendingDateTo(e.target.value)} />
                    </div>
                  )}
                  <div style={{ ...ss.drawerRow, justifyContent: 'flex-end', gap: '10px' }}>
                    <button style={ss.clearFiltersLink} onClick={() => {
                      setPoolPendingDownloadFilter('all'); setPoolPendingLicenseFilter('all'); setPoolPendingTagInput(''); setPoolPendingTagMode('any')
                      setPoolPendingDateField('posted'); setPoolPendingDatePreset('all'); setPoolPendingDateFrom(''); setPoolPendingDateTo('')
                      setPoolAppliedDownloadFilter('all'); setPoolAppliedLicenseFilter('all'); setPoolAppliedTagInput(''); setPoolAppliedTagMode('any')
                      setPoolAppliedDateField('posted'); setPoolAppliedDatePreset('all'); setPoolAppliedDateFrom(''); setPoolAppliedDateTo('')
                    }}>
                      Clear filters
                    </button>
                    <button style={ss.applyBtn} onClick={() => {
                      setPoolAppliedDownloadFilter(poolPendingDownloadFilter)
                      setPoolAppliedLicenseFilter(poolPendingLicenseFilter)
                      setPoolAppliedTagInput(poolPendingTagInput)
                      setPoolAppliedTagMode(poolPendingTagMode)
                      setPoolAppliedDateField(poolPendingDateField)
                      setPoolAppliedDatePreset(poolPendingDatePreset)
                      setPoolAppliedDateFrom(poolPendingDateFrom)
                      setPoolAppliedDateTo(poolPendingDateTo)
                      setPoolDrawerOpen(false)
                    }}>
                      Apply
                    </button>
                  </div>
                </div>
              )}

              {/* Active filter chips */}
              {poolAppliedTagInput.trim() && (
                <div style={ss.chipRow}>
                  <Chip label={`tags: ${poolAppliedTagInput.trim()}`} onDismiss={() => { setPoolPendingTagInput(''); setPoolAppliedTagInput('') }} />
                </div>
              )}
              {(poolAppliedDatePreset !== 'all' || poolAppliedDateFrom || poolAppliedDateTo) && (
                <div style={ss.chipRow}>
                  <Chip
                    label={`date: ${poolAppliedDatePreset === 'last7' ? 'Last 7 days' : poolAppliedDatePreset === 'last30' ? 'Last 30 days' : poolAppliedDatePreset === 'thisYear' ? 'This year' : poolAppliedDatePreset === 'lastYear' ? 'Last year' : poolAppliedDateFrom || poolAppliedDateTo ? `${poolAppliedDateFrom || '…'} – ${poolAppliedDateTo || '…'}` : 'Custom'}`}
                    onDismiss={() => {
                      setPoolPendingDatePreset('all'); setPoolPendingDateFrom(''); setPoolPendingDateTo('')
                      setPoolAppliedDatePreset('all'); setPoolAppliedDateFrom(''); setPoolAppliedDateTo('')
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <AttributionNotice />

        {poolLoading && <div style={s.loadingState}>Loading group pool…</div>}
        {poolError && <div style={s.errorState}>{poolError}</div>}
        {!poolLoading && !poolError && poolPhotos.length === 0 && (
          <div style={s.emptyState}>No public photos in this group pool.</div>
        )}
        {!poolLoading && !poolError && poolPhotos.length > 0 && filteredPoolPhotos.length === 0 && (
          <div style={s.emptyState}>No photos match the current filters.</div>
        )}
        {filteredPoolPhotos.length > 0 && (
          <>
            {poolViewMode === 'list' ? (
              <div style={ss.listContainer}>
                {filteredPoolPhotos.map((photo, idx) => (
                  <PhotoListRow
                    key={photo.id}
                    photo={photo}
                    isDownloaded={!!poolDownloadRecords[photo.id]}
                    isSelected={selectMode ? selectedIds.has(photo.id) : undefined}
                    selectMode={selectMode}
                    onClick={() => selectMode ? toggleSelect(photo.id) : setDetailIndex(idx)}
                  />
                ))}
              </div>
            ) : poolViewMode === 'grid' ? (
              <div style={{ display: 'grid', gap: '4px', gridTemplateColumns: `repeat(auto-fill, minmax(${rowHeight}px, 1fr))` }}>
                {filteredPoolPhotos.map((photo, idx) => (
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
                {poolJustifiedRows && (() => {
                  let gIdx = 0
                  return poolJustifiedRows.map((row, ri) => (
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
            {poolPage < poolPages && (
              <div style={s.loadMoreRow}>
                <button style={s.loadMoreBtn} disabled={poolLoadingMore} onClick={loadMorePool}>
                  {poolLoadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div style={s.container}>
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>My Groups</h2>
          <p style={s.subheading}>Browse photos from groups you belong to</p>
        </div>
      </div>

      {!loading && groups.length > 5 && (
        <input
          style={s.filterInput}
          type="text"
          placeholder="Filter groups…"
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
        />
      )}

      {loading && <div style={s.loadingState}>Loading groups…</div>}
      {error && <div style={s.errorState}>{error}</div>}
      {!loading && !error && groups.length === 0 && (
        <div style={s.emptyState}>You are not a member of any groups.</div>
      )}
      {!loading && !error && filteredGroups.length === 0 && groups.length > 0 && (
        <div style={s.emptyState}>No groups match "{groupFilter}".</div>
      )}
      {filteredGroups.length > 0 && (
        <div style={s.groupList}>
          {filteredGroups.map(g => (
            <div key={g.id} style={s.groupRow} onClick={() => openGroup(g)}>
              <div style={s.groupAvatarWrap}>
                {g.iconUrl
                  ? <img src={g.iconUrl} alt="" style={s.groupAvatar} loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '' }} />
                  : <div style={s.groupAvatarFallback}>{g.name.charAt(0).toUpperCase()}</div>
                }
              </div>
              <div style={s.groupInfo}>
                <span style={s.groupName}>{g.name}</span>
                <span style={s.groupMeta}>
                  {g.memberCount != null ? `${g.memberCount.toLocaleString()} members` : ''}
                  {g.memberCount != null && g.photoCount != null ? ' · ' : ''}
                  {g.photoCount != null ? `${g.photoCount.toLocaleString()} photos` : ''}
                </span>
              </div>
              <ChevronRightIcon />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px 32px' },
  stickyHeader: { position: 'sticky' as const, top: 0, zIndex: 10, background: '#fff', paddingBottom: '8px' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '20px' },
  heading: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#1a1a1a' },
  subheading: { margin: '4px 0 0', fontSize: '13px', color: '#888' },
  backBtn: { background: 'none', border: 'none', color: 'var(--ff-blue)', cursor: 'pointer', fontSize: '14px', padding: '4px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' },
  selectBtn: { padding: '6px 14px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#444', flexShrink: 0 },
  filterInput: {
    height: '36px', borderRadius: '8px', border: '1px solid #ddd',
    padding: '0 12px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  groupList: { display: 'flex', flexDirection: 'column', gap: '0' },
  groupRow: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0',
    borderBottom: '1px solid #f0ede8', cursor: 'pointer',
  },
  groupAvatarWrap: { width: '44px', height: '44px', flexShrink: 0 },
  groupAvatar: { width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' },
  groupAvatarFallback: {
    width: '44px', height: '44px', borderRadius: '8px',
    background: 'var(--ff-blue)', color: '#fff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '18px', fontWeight: 700
  },
  groupInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  groupName: { fontSize: '14px', fontWeight: 500, color: '#1a1a1a' },
  groupMeta: { fontSize: '12px', color: '#888' },
  chevron: { color: '#ccc' },
  groupIcon: { width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' },
  justifiedContainer: { padding: '0' },
  loadMoreRow: { display: 'flex', justifyContent: 'center', paddingTop: '8px' },
  loadMoreBtn: { padding: '8px 24px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#444' },
  loadingState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
  errorState: { textAlign: 'center', color: 'var(--ff-error)', fontSize: '14px', paddingTop: '48px' },
  emptyState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
}
