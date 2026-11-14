import React, { useEffect, useState, useMemo } from 'react'
import type { BatchLogEntry, PhotoDownloadRecord, DiscoverDownloadRecord, FlickrAlbum } from '../../shared/types'

interface HistoryPanelProps {
  onClose: () => void
}

type Tab = 'batches' | 'photos' | 'discover'

type DatePreset = 'all' | 'last24h' | 'last7d' | 'last30d' | 'last60d' | 'custom'
type ClearMode = 'idle' | 'choose' | 'confirm-preset' | 'confirm-before' | 'confirm-after' | 'confirm-all'

// ── Shared formatters ────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })
}

function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

// ── Color tokens (update here for dark mode; inline styles reference these) ──
const C = {
  downloaded:  '#16a34a',  // green  — successful downloads
  error:       '#dc2626',  // red    — failed photos
  skipped:     '#6b7280',  // gray   — skipped / cancelled
  partial:     '#f59e0b',  // amber  — partial success (status dot)
  complete:    '#22c55e',  // green  — complete (status dot)
  cancelled:   '#94a3b8',  // slate  — cancelled (status dot)
  errorDot:    '#ef4444',  // red    — error (status dot)
  text:        '#111827',  // near-black body text
  muted:       '#9ca3af',  // muted secondary text
  subtle:      '#6b7280',  // subtle third-level text
} as const

// ── Batches tab ──────────────────────────────────────────────────────────────

function sourceLabel(entry: BatchLogEntry): string {
  if (entry.sourceType === 'photostream') return 'Photostream'
  if (entry.sourceType === 'selected') return `Selected — ${entry.source}`
  if (entry.sourceType === 'discover_people') return `User — ${entry.source}`
  if (entry.sourceType === 'discover_groups') return `Groups — ${entry.source}`
  if (entry.sourceType === 'discover') return `Explore — ${entry.source}`
  return entry.source
}

function statusCircleColor(status: BatchLogEntry['status']): string {
  switch (status) {
    case 'complete':  return C.complete
    case 'partial':   return C.partial
    case 'cancelled': return C.cancelled
    case 'error':     return C.errorDot
  }
}

function StatusCircle({ status }: { status: BatchLogEntry['status'] }): React.JSX.Element {
  const color = statusCircleColor(status)
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
      <circle cx="5" cy="5" r="5" fill={color} />
    </svg>
  )
}

function CountPill({ label, color }: { label: string; color: string }): React.JSX.Element {
  return (
    <span style={{ ...styles.pill, color, borderColor: color, background: color + '18' }}>
      {label}
    </span>
  )
}

function ExpandableSection({ label, color, defaultExpanded, children }: {
  label: string; color: string; defaultExpanded: boolean; children: React.ReactNode
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div style={styles.expandableWrap}>
      <button style={{ ...styles.expandableToggle, color }} onClick={() => setExpanded(e => !e)}>
        {expanded ? '▾' : '▸'} {label}
      </button>
      {expanded && <div style={styles.expandableBody}>{children}</div>}
    </div>
  )
}

function BatchesTab({ onClear }: { onClear: () => void }) {
  const [entries, setEntries] = useState<BatchLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setLoading(true)
    window.flickrAPI.getBatchLog().then(log => {
      setEntries(log.filter(e => !['discover', 'discover_people', 'discover_groups'].includes(e.sourceType)))
      setLoading(false)
    })
  }, [])

  async function handleClear() {
    if (!confirming) { setConfirming(true); return }
    await window.flickrAPI.clearHistory()
    setConfirming(false)
    setEntries([])
    onClear()
  }

  if (loading) return <p style={styles.empty}>Loading…</p>

  if (entries.length === 0) return (
    <p style={styles.empty}>No batch download history yet. Batches are tracked for 90 days.</p>
  )

  return (
    <>
      <div style={styles.tabBody}>
        {entries.map(entry => {
          // smartFiltered is only meaningful on complete batches; on cancelled/error
          // the residual just means "not yet processed", not "already downloaded".
          const smartFiltered = entry.status === 'complete'
            ? entry.total - entry.downloaded - entry.skippedCollision - entry.failed
            : 0
          const isPartial = entry.downloaded > 0 && entry.failed > 0
          const hasNoPills = entry.downloaded === 0 && entry.failed === 0 && entry.skippedCollision === 0 && smartFiltered === 0
          return (
            <div key={entry.id} style={styles.row}>
              <div style={styles.rowTop}>
                <StatusCircle status={entry.status} />
                <span style={styles.source}>{sourceLabel(entry)}</span>
                <span style={styles.date}>{formatDate(entry.createdAt)}</span>
              </div>
              <div style={styles.rowCounts}>
                {entry.downloaded > 0 && (
                  <CountPill label={`✓ ${entry.downloaded} downloaded`} color={C.downloaded} />
                )}
                {entry.failed > 0 && (
                  <CountPill label={`✕ ${entry.failed} errors`} color={C.error} />
                )}
                {entry.skippedCollision > 0 && (
                  <CountPill label={`— ${entry.skippedCollision} skipped`} color={C.skipped} />
                )}
                {smartFiltered > 0 && (
                  <CountPill label={`— ${smartFiltered} already downloaded`} color={C.skipped} />
                )}
                {hasNoPills && (
                  <CountPill label={entry.status === 'cancelled' ? '— cancelled' : '— no downloads'} color={C.skipped} />
                )}
              </div>
              {entry.failedPhotos && entry.failedPhotos.length > 0 && (
                <ExpandableSection
                  label={`${entry.failed} failed — show details`}
                  color={C.error}
                  defaultExpanded={isPartial}
                >
                  <ul style={styles.expandableList}>
                    {entry.failedPhotos.map(p => (
                      <li key={p.id} style={styles.expandableItem}>{p.title || p.id}</li>
                    ))}
                  </ul>
                </ExpandableSection>
              )}
              {entry.skippedCollision > 0 && (
                <ExpandableSection
                  label={`${entry.skippedCollision} skipped — files already in folder`}
                  color={C.skipped}
                  defaultExpanded={false}
                >
                  <ul style={styles.expandableList}>
                    <li style={styles.expandableItem}>These files were not downloaded because they already exist in your download folder. Change conflict behavior in Settings to overwrite or rename instead.</li>
                  </ul>
                </ExpandableSection>
              )}
            </div>
          )
        })}
      </div>
      <div style={styles.footer}>
        <button
          style={confirming ? styles.confirmBtn : styles.clearBtn}
          onClick={handleClear}
        >
          {confirming ? 'Tap again to confirm — clears all batch download history' : 'Clear batch download history'}
        </button>
        {confirming && (
          <button style={styles.cancelConfirm} onClick={() => setConfirming(false)}>Cancel</button>
        )}
      </div>
    </>
  )
}

// ── Photos tab ───────────────────────────────────────────────────────────────

const DAY = 86400000

function presetRange(preset: DatePreset): { min?: number; max?: number } {
  const now = Date.now()
  switch (preset) {
    case 'last24h': return { min: now - DAY }
    case 'last7d':  return { min: now - 7  * DAY }
    case 'last30d': return { min: now - 30 * DAY }
    case 'last60d': return { min: now - 60 * DAY }
    default: return {}
  }
}

function PhotosTab() {
  const [allRecords, setAllRecords]       = useState<PhotoDownloadRecord[]>([])
  const [loading, setLoading]             = useState(true)
  const [searchMode, setSearchMode]       = useState<'title' | 'id'>('title')
  const [titleFilter, setTitleFilter]     = useState('')
  const [photoIdQuery, setPhotoIdQuery]   = useState('')

  // Date filter
  const [datePreset, setDatePreset]           = useState<DatePreset>('all')
  const [customDateMin, setCustomDateMin]     = useState('')
  const [customDateMax, setCustomDateMax]     = useState('')
  const [appliedDateMin, setAppliedDateMin]   = useState<number | undefined>()
  const [appliedDateMax, setAppliedDateMax]   = useState<number | undefined>()

  // Album filter
  const [albums, setAlbums]                     = useState<FlickrAlbum[]>([])
  const [albumsLoaded, setAlbumsLoaded]         = useState(false)
  const [albumsLoading, setAlbumsLoading]       = useState(false)
  const [selectedAlbum, setSelectedAlbum]       = useState<FlickrAlbum | null>(null)
  const [albumPhotoIds, setAlbumPhotoIds]       = useState<Set<string> | null>(null)
  const [albumFilterLoading, setAlbumFilterLoading] = useState(false)

  // Delete confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // Clear records
  const [clearMode, setClearMode]           = useState<ClearMode>('idle')
  const [clearPresetMs, setClearPresetMs]   = useState<number | null>(null)
  const [clearPresetLabel, setClearPresetLabel] = useState('')
  const [clearDate, setClearDate]           = useState('')

  // Load all records on mount
  useEffect(() => {
    setLoading(true)
    window.flickrAPI.searchPhotoRecords({}).then(results => {
      setAllRecords(results)
      setLoading(false)
    })
  }, [])

  // ── Date filter ──

  function handlePresetChange(preset: DatePreset) {
    setDatePreset(preset)
    if (preset === 'custom') {
      // Default end date to today when opening custom range
      if (!customDateMax) setCustomDateMax(new Date().toISOString().slice(0, 10))
    } else {
      const { min, max } = presetRange(preset)
      setAppliedDateMin(min)
      setAppliedDateMax(max)
    }
  }

  function handleApplyCustomDate() {
    setAppliedDateMin(customDateMin ? new Date(customDateMin + 'T00:00:00').getTime() : undefined)
    setAppliedDateMax(customDateMax ? new Date(customDateMax + 'T23:59:59').getTime() : undefined)
  }

  function handleClearDateFilter() {
    setDatePreset('all')
    setCustomDateMin('')
    setCustomDateMax('')
    setAppliedDateMin(undefined)
    setAppliedDateMax(undefined)
  }

  function handleClearAllPhotoFilters() {
    setTitleFilter('')
    setPhotoIdQuery('')
    handleClearDateFilter()
    handleAlbumSelect('')
  }

  // ── Album filter ──

  async function handleLoadAlbums() {
    if (albumsLoaded) return
    setAlbumsLoading(true)
    const page = await window.flickrAPI.getAlbums(1)
    setAlbums(page.albums)
    setAlbumsLoaded(true)
    setAlbumsLoading(false)
  }

  async function handleAlbumSelect(albumId: string) {
    if (!albumId) {
      setSelectedAlbum(null)
      setAlbumPhotoIds(null)
      return
    }
    const album = albums.find(a => a.id === albumId) ?? null
    setSelectedAlbum(album)
    if (!album) return

    setAlbumFilterLoading(true)
    setAlbumPhotoIds(null)

    const photoIds = new Set<string>()
    const page1 = await window.flickrAPI.getAlbumPhotos(album.id, 1)
    page1.photos.forEach(p => photoIds.add(p.id))

    if (page1.pages > 1) {
      const pageNums = Array.from({ length: page1.pages - 1 }, (_, i) => i + 2)
      const pages = await Promise.all(pageNums.map(p => window.flickrAPI.getAlbumPhotos(album.id, p)))
      pages.forEach(pg => pg.photos.forEach(p => photoIds.add(p.id)))
    }

    setAlbumPhotoIds(photoIds)
    setAlbumFilterLoading(false)
  }

  // ── Delete record ──

  async function handleDeleteRecord(photoId: string) {
    await window.flickrAPI.deletePhotoRecord(photoId)
    setAllRecords(prev => prev.filter(r => r.photoId !== photoId))
  }

  // ── Clear records ──

  function handlePresetClear(afterMs: number, label: string) {
    setClearPresetMs(afterMs)
    setClearPresetLabel(label)
    setClearMode('confirm-preset')
  }

  async function handleConfirmPresetClear() {
    if (clearPresetMs === null) return
    await window.flickrAPI.clearPhotoRecords(undefined, clearPresetMs)
    setAllRecords(prev => prev.filter(r => r.lastDownloadedAt <= clearPresetMs))
    setClearMode('idle')
    setClearPresetMs(null)
  }

  async function handleConfirmClearBefore() {
    if (!clearDate) return
    const beforeMs = new Date(clearDate + 'T23:59:59').getTime()
    await window.flickrAPI.clearPhotoRecords(beforeMs)
    setAllRecords(prev => prev.filter(r => r.lastDownloadedAt >= beforeMs))
    setClearMode('idle')
    setClearDate('')
  }

  async function handleConfirmClearAfter() {
    if (!clearDate) return
    const afterMs = new Date(clearDate + 'T00:00:00').getTime()
    await window.flickrAPI.clearPhotoRecords(undefined, afterMs)
    setAllRecords(prev => prev.filter(r => r.lastDownloadedAt <= afterMs))
    setClearMode('idle')
    setClearDate('')
  }

  async function handleConfirmClearAll() {
    await window.flickrAPI.clearPhotoRecords()
    setAllRecords([])
    setClearMode('idle')
  }

  // ── Filtered records ──

  const filteredRecords = useMemo(() => {
    let result = allRecords

    if (searchMode === 'id') {
      const q = photoIdQuery.trim()
      return q ? result.filter(r => r.photoId === q) : result
    }

    if (titleFilter.trim()) {
      const q = titleFilter.toLowerCase()
      result = result.filter(r => r.title.toLowerCase().includes(q))
    }
    if (appliedDateMin !== undefined) result = result.filter(r => r.lastDownloadedAt >= appliedDateMin)
    if (appliedDateMax !== undefined) result = result.filter(r => r.lastDownloadedAt <= appliedDateMax)
    if (albumPhotoIds) result = result.filter(r => albumPhotoIds.has(r.photoId))

    return result
  }, [allRecords, titleFilter, searchMode, photoIdQuery, appliedDateMin, appliedDateMax, albumPhotoIds])

  const isStale = (r: PhotoDownloadRecord) =>
    r.flickrLastUpdate > 0 && r.flickrLastUpdate * 1000 > r.lastDownloadedAt

  const hasDateFilter = datePreset !== 'all'

  // ── Render ──

  return (
    <>
      {/* Search + filter bar */}
      <div style={styles.photoSearchBar}>
        {/* Mode toggle */}
        <div style={styles.searchModeRow}>
          <button
            style={searchMode === 'title' ? styles.modeTabActive : styles.modeTab}
            onClick={() => { setSearchMode('title'); setPhotoIdQuery('') }}
          >By title</button>
          <button
            style={searchMode === 'id' ? styles.modeTabActive : styles.modeTab}
            onClick={() => { setSearchMode('id'); setTitleFilter('') }}
          >By photo ID</button>
        </div>

        {/* Search input */}
        <div style={styles.searchInputWrap}>
          <input
            style={styles.searchInput}
            placeholder={searchMode === 'title' ? 'Search by title…' : 'Enter photo ID…'}
            value={searchMode === 'title' ? titleFilter : photoIdQuery}
            onChange={e => searchMode === 'title'
              ? setTitleFilter(e.target.value)
              : setPhotoIdQuery(e.target.value)}
          />
          {(titleFilter || photoIdQuery) && (
            <button
              style={styles.searchClearBtn}
              onClick={() => searchMode === 'title' ? setTitleFilter('') : setPhotoIdQuery('')}
              title="Clear search"
            >✕</button>
          )}
        </div>

        {/* Date filter */}
        <div style={styles.filterRow}>
          <span style={styles.filterLabel}>Downloaded</span>
          <select
            style={styles.presetSelect}
            value={datePreset}
            onChange={e => handlePresetChange(e.target.value as DatePreset)}
          >
            <option value="all">All time</option>
            <option value="last24h">Last 24 hours</option>
            <option value="last7d">Last 7 days</option>
            <option value="last30d">Last 30 days</option>
            <option value="last60d">Last 60 days</option>
            <option value="custom">Custom range…</option>
          </select>
          {hasDateFilter && (
            <button style={styles.clearFilterX} onClick={handleClearDateFilter} title="Clear date filter">✕</button>
          )}
        </div>

        {/* Custom date range */}
        {datePreset === 'custom' && (
          <div style={styles.filterRow}>
            <div style={styles.dateFieldWrap}>
              <input type="date" style={styles.dateInput} value={customDateMin} onChange={e => setCustomDateMin(e.target.value)} />
              {customDateMin && (
                <button style={styles.dateFieldClear} onClick={() => setCustomDateMin('')} title="Clear start date">✕</button>
              )}
            </div>
            <span style={styles.filterLabel}>–</span>
            <div style={styles.dateFieldWrap}>
              <input type="date" style={styles.dateInput} value={customDateMax} onChange={e => setCustomDateMax(e.target.value)} />
              {customDateMax && (
                <button style={styles.dateFieldClear} onClick={() => setCustomDateMax('')} title="Clear end date">✕</button>
              )}
            </div>
            <button style={styles.applyBtn} onClick={handleApplyCustomDate}>Apply</button>
            <button style={styles.cancelConfirm} onClick={handleClearDateFilter}>All time</button>
          </div>
        )}

        {/* Album filter */}
        <div style={styles.filterRow}>
          <span style={styles.filterLabel}>Album</span>
          {!albumsLoaded ? (
            <button style={styles.loadAlbumsBtn} onClick={handleLoadAlbums} disabled={albumsLoading}>
              {albumsLoading ? 'Loading…' : 'Load albums'}
            </button>
          ) : (
            <>
              <select
                style={{ ...styles.presetSelect, flex: 1, maxWidth: 220 }}
                value={selectedAlbum?.id ?? ''}
                onChange={e => handleAlbumSelect(e.target.value)}
              >
                <option value="">All</option>
                {albums.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              {albumFilterLoading && <span style={styles.filterLabel}>Loading…</span>}
              {selectedAlbum && !albumFilterLoading && (
                <button style={styles.clearFilterX} onClick={() => handleAlbumSelect('')} title="Clear album filter">✕</button>
              )}
            </>
          )}
        </div>

        {/* Result count */}
        {!loading && allRecords.length > 0 && (
          <p style={styles.resultCount}>
            {filteredRecords.length === allRecords.length
              ? `${allRecords.length} records`
              : `${filteredRecords.length} of ${allRecords.length} records`}
          </p>
        )}
      </div>

      {/* Results */}
      <div style={styles.tabBody}>
        {loading ? (
          <p style={styles.empty}>Loading records…</p>
        ) : allRecords.length === 0 ? (
          <p style={styles.empty}>No download records yet. Photos are tracked when you download them.</p>
        ) : albumFilterLoading ? (
          <p style={styles.empty}>Loading album photos…</p>
        ) : filteredRecords.length === 0 ? (
          <div style={styles.emptyFilter}>
            <p style={styles.empty}>No records match your filters.</p>
            <button style={styles.clearFiltersBtn} onClick={handleClearAllPhotoFilters}>Clear Filters</button>
          </div>
        ) : (
          filteredRecords.map(r => (
            <div key={r.photoId} style={styles.photoRow}>
              {r.thumbnailUrl
                ? <img src={r.thumbnailUrl} alt="" style={styles.thumb} />
                : <div style={styles.thumbPlaceholder} />
              }
              <div style={styles.photoMeta}>
                <div style={styles.photoTitle}>
                  {r.title || <span style={styles.untitled}>Untitled</span>}
                </div>
                <div style={styles.photoSub}>
                  {isStale(r) && (
                    <span style={styles.staleIcon} title="Updated on Flickr since last download">⚠</span>
                  )}
                  <span style={styles.photoDate}>{formatDateShort(r.lastDownloadedAt)}</span>
                  <span style={styles.photoId}>{r.photoId}</span>
                </div>
              </div>
              {pendingDeleteId === r.photoId ? (
                <div style={styles.deleteConfirm}>
                  <span style={styles.deleteConfirmLabel}>Remove download record?</span>
                  <button
                    style={styles.deleteConfirmYes}
                    onClick={() => { setPendingDeleteId(null); handleDeleteRecord(r.photoId) }}
                    title="Confirm removal"
                  >✓</button>
                  <button
                    style={styles.deleteConfirmNo}
                    onClick={() => setPendingDeleteId(null)}
                    title="Cancel"
                  >✕</button>
                </div>
              ) : (
                <button
                  style={styles.deleteRecordBtn}
                  onClick={() => setPendingDeleteId(r.photoId)}
                  title="Remove this download record"
                >✕</button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer / clear records */}
      <div style={styles.footer}>
        {clearMode === 'idle' && (
          <button style={styles.clearBtn} onClick={() => setClearMode('choose')}>Clear photo download records</button>
        )}

        {clearMode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <div style={styles.clearChoiceRow}>
              <span style={styles.clearLabel}>From the last:</span>
              <button style={styles.clearChoiceBtn} onClick={() => handlePresetClear(Date.now() - DAY, 'last 24 hours')}>24 hours</button>
              <button style={styles.clearChoiceBtn} onClick={() => handlePresetClear(Date.now() - 7 * DAY, 'last 7 days')}>7 days</button>
              <button style={styles.clearChoiceBtn} onClick={() => handlePresetClear(Date.now() - 30 * DAY, 'last 30 days')}>30 days</button>
              <button style={styles.clearChoiceBtn} onClick={() => handlePresetClear(Date.now() - 60 * DAY, 'last 60 days')}>60 days</button>
            </div>
            <div style={styles.clearChoiceRow}>
              <button style={styles.clearChoiceBtn} onClick={() => { setClearDate(''); setClearMode('confirm-before') }}>Before a date…</button>
              <button style={styles.clearChoiceBtn} onClick={() => { setClearDate(''); setClearMode('confirm-after') }}>After a date…</button>
              <button style={styles.clearChoiceBtnDanger} onClick={() => setClearMode('confirm-all')}>Clear all</button>
              <button style={styles.cancelConfirm} onClick={() => setClearMode('idle')}>Cancel</button>
            </div>
          </div>
        )}

        {clearMode === 'confirm-preset' && (
          <div style={styles.clearChoiceRow}>
            <span style={styles.clearWarning}>Clear download records from {clearPresetLabel}?</span>
            <button style={styles.confirmBtn} onClick={handleConfirmPresetClear}>Confirm</button>
            <button style={styles.cancelConfirm} onClick={() => setClearMode('idle')}>Cancel</button>
          </div>
        )}

        {clearMode === 'confirm-before' && (
          <div style={{ ...styles.clearChoiceRow, flexWrap: 'wrap' as const, gap: 6 }}>
            <span style={styles.clearWarning}>Clear download records before:</span>
            <input type="date" style={styles.dateInput} value={clearDate} onChange={e => setClearDate(e.target.value)} />
            <button style={styles.confirmBtn} onClick={handleConfirmClearBefore} disabled={!clearDate}>Confirm</button>
            <button style={styles.cancelConfirm} onClick={() => setClearMode('idle')}>Cancel</button>
          </div>
        )}

        {clearMode === 'confirm-after' && (
          <div style={{ ...styles.clearChoiceRow, flexWrap: 'wrap' as const, gap: 6 }}>
            <span style={styles.clearWarning}>Clear download records after:</span>
            <input type="date" style={styles.dateInput} value={clearDate} onChange={e => setClearDate(e.target.value)} />
            <button style={styles.confirmBtn} onClick={handleConfirmClearAfter} disabled={!clearDate}>Confirm</button>
            <button style={styles.cancelConfirm} onClick={() => setClearMode('idle')}>Cancel</button>
          </div>
        )}

        {clearMode === 'confirm-all' && (
          <div style={styles.clearChoiceRow}>
            <span style={styles.clearWarning}>Clear all photo download records?</span>
            <button style={styles.confirmBtn} onClick={handleConfirmClearAll}>Confirm</button>
            <button style={styles.cancelConfirm} onClick={() => setClearMode('idle')}>Cancel</button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Discover tab ─────────────────────────────────────────────────────────────

function DiscoverTab() {
  const [records, setRecords] = useState<DiscoverDownloadRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setLoading(true)
    window.flickrAPI.searchDiscoverRecords({}).then(results => {
      setRecords(results)
      setLoading(false)
    })
  }, [])

  async function handleClear() {
    if (!confirming) { setConfirming(true); return }
    await window.flickrAPI.clearDiscoverRecords()
    setConfirming(false)
    setRecords([])
  }

  if (loading) return <p style={styles.empty}>Loading…</p>

  if (records.length === 0) return (
    <p style={styles.empty}>No Discover download history yet. Individual photos downloaded from People, Groups, and Explore appear here.</p>
  )

  return (
    <>
      <div style={styles.tabBody}>
        {records.map(record => (
          <div key={record.photoId} style={styles.row}>
            <div style={styles.rowTop}>
              {record.thumbnailUrl && (
                <img src={record.thumbnailUrl} alt="" style={styles.discoverThumb} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={styles.source}>{record.title || record.photoId}</span>
                {record.source && <span style={styles.discoverSource}>{record.source}</span>}
              </div>
              <span style={styles.date}>{formatDate(record.lastDownloadedAt)}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={styles.footer}>
        <button
          style={confirming ? styles.confirmBtn : styles.clearBtn}
          onClick={handleClear}
        >
          {confirming ? 'Tap again to confirm — clears Discover download records' : 'Clear Discover download history'}
        </button>
        {confirming && (
          <button style={styles.cancelConfirm} onClick={() => setConfirming(false)}>Cancel</button>
        )}
      </div>
    </>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function HistoryPanel({ onClose }: HistoryPanelProps) {
  const [tab, setTab] = useState<Tab>('batches')

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>

        <div style={styles.header}>
          <h2 style={styles.title}>Download History</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={styles.tabs}>
          <button
            style={tab === 'batches' ? styles.tabActive : styles.tab}
            onClick={() => setTab('batches')}
          >Batches</button>
          <button
            style={tab === 'photos' ? styles.tabActive : styles.tab}
            onClick={() => setTab('photos')}
          >Photos</button>
          <button
            style={tab === 'discover' ? styles.tabActive : styles.tab}
            onClick={() => setTab('discover')}
          >Discover</button>
        </div>

        {tab === 'batches' && <BatchesTab onClear={() => {}} />}
        {tab === 'photos' && <PhotosTab />}
        {tab === 'discover' && <DiscoverTab />}
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 400,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
  },
  panel: {
    width: 440, height: '100vh',
    background: '#fff',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 20px 0',
  },
  title: {
    margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--ff-navy)',
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 22, color: '#6b7280', lineHeight: 1, padding: '0 4px',
  },
  tabs: {
    display: 'flex', gap: 0,
    padding: '12px 20px 0',
    borderBottom: '1px solid #e5e7eb',
  },
  tab: {
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    padding: '6px 12px 10px', fontSize: 13, color: '#6b7280',
    cursor: 'pointer', fontWeight: 500,
  },
  tabActive: {
    background: 'none', border: 'none', borderBottom: '2px solid var(--ff-pink)',
    padding: '6px 12px 10px', fontSize: 13, color: 'var(--ff-pink)',
    cursor: 'pointer', fontWeight: 600,
  },
  tabBody: {
    flex: 1, overflowY: 'auto',
  },
  empty: {
    padding: '24px 20px', color: '#9ca3af', fontSize: 13, lineHeight: 1.5, margin: 0,
  },
  emptyFilter: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '12px',
    padding: '40px 24px', textAlign: 'center' as const,
  },
  clearFiltersBtn: {
    background: 'none', border: '1px solid #d1d5db', borderRadius: '6px',
    padding: '6px 16px', fontSize: 13, color: '#555', cursor: 'pointer',
  },
  // Batch tab rows
  row: {
    padding: '10px 20px',
    borderBottom: '1px solid #f3f4f6',
  },
  rowTop: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  source: {
    flex: 1, fontSize: 13, fontWeight: 500, color: C.text,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  date: {
    fontSize: 11, color: C.muted, flexShrink: 0,
  },
  rowCounts: {
    display: 'flex', flexWrap: 'wrap' as const, gap: 6, paddingLeft: 18, marginTop: 4,
  },
  pill: {
    display: 'inline-flex', alignItems: 'center',
    fontSize: 11, fontWeight: 500,
    padding: '2px 7px', borderRadius: 99,
    border: '1px solid',
  },
  expandableWrap: { marginTop: 6, paddingLeft: 18 },
  expandableToggle: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, padding: 0,
  },
  expandableBody: { marginTop: 4, paddingLeft: 12 },
  expandableList: {
    margin: '2px 0 0 0', padding: 0,
    listStyle: 'disc', listStylePosition: 'inside' as const,
  },
  expandableItem: { fontSize: 12, color: C.subtle, padding: '1px 0' },
  // Photos tab search bar
  photoSearchBar: {
    padding: '12px 16px 10px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  searchModeRow: {
    display: 'flex', gap: 4,
  },
  modeTab: {
    background: 'none', border: '1px solid #d1d5db', borderRadius: 4,
    padding: '3px 8px', fontSize: 11, color: '#6b7280', cursor: 'pointer',
  },
  modeTabActive: {
    background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 4,
    padding: '3px 8px', fontSize: 11, color: '#1d4ed8', cursor: 'pointer', fontWeight: 600,
  },
  searchInputWrap: {
    position: 'relative' as const, display: 'flex', alignItems: 'center',
  },
  searchInput: {
    flex: 1, width: '100%', boxSizing: 'border-box' as const,
    border: '1px solid #d1d5db', borderRadius: 6,
    padding: '6px 28px 6px 10px', fontSize: 13, outline: 'none',
  },
  searchClearBtn: {
    position: 'absolute' as const, right: 6,
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, color: '#9ca3af', padding: '2px 4px', lineHeight: 1,
  },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  filterLabel: {
    fontSize: 11, color: '#9ca3af', flexShrink: 0,
  },
  presetSelect: {
    border: '1px solid #d1d5db', borderRadius: 4,
    padding: '4px 6px', fontSize: 11, color: '#374151', background: '#fff', cursor: 'pointer',
  },
  clearFilterX: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 10, color: '#9ca3af', padding: '2px 4px',
  },
  dateFieldWrap: {
    display: 'flex', alignItems: 'center', gap: 2,
  },
  dateInput: {
    border: '1px solid #d1d5db', borderRadius: 4,
    padding: '4px 6px', fontSize: 11,
  },
  dateFieldClear: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 10, color: '#9ca3af', padding: '2px 3px', lineHeight: 1, flexShrink: 0,
  },
  applyBtn: {
    background: '#111', border: 'none', borderRadius: 4,
    padding: '4px 10px', fontSize: 11, color: '#fff', cursor: 'pointer', flexShrink: 0,
  },
  loadAlbumsBtn: {
    background: 'none', border: '1px solid #d1d5db', borderRadius: 4,
    padding: '3px 8px', fontSize: 11, color: '#6b7280', cursor: 'pointer',
  },
  resultCount: {
    margin: 0, fontSize: 11, color: '#9ca3af',
  },
  // Photo record rows
  photoRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 16px',
    borderBottom: '1px solid #f3f4f6',
  },
  thumb: {
    width: 44, height: 44, borderRadius: 4,
    objectFit: 'cover', flexShrink: 0,
    background: '#f3f4f6',
  },
  discoverThumb: {
    width: 44, height: 44, borderRadius: 4,
    objectFit: 'cover', flexShrink: 0,
    background: '#f3f4f6',
  },
  discoverSource: {
    fontSize: 11, color: '#888', marginTop: 2,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  thumbPlaceholder: {
    width: 44, height: 44, borderRadius: 4, flexShrink: 0,
    background: '#f3f4f6',
  },
  photoMeta: {
    flex: 1, minWidth: 0,
  },
  photoTitle: {
    fontSize: 13, fontWeight: 500, color: '#111827',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  untitled: {
    color: '#9ca3af', fontStyle: 'italic',
  },
  photoSub: {
    display: 'flex', alignItems: 'center', gap: 6, marginTop: 2,
  },
  staleIcon: {
    fontSize: 11, color: '#f59e0b', cursor: 'default',
  },
  photoDate: {
    fontSize: 11, color: '#9ca3af',
  },
  photoId: {
    fontSize: 10, color: '#c4c9d4',
  },
  deleteRecordBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, color: '#d1d5db', padding: '4px',
    flexShrink: 0,
  },
  deleteConfirm: {
    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
  },
  deleteConfirmLabel: {
    fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' as const,
  },
  deleteConfirmYes: {
    background: 'none', border: '1px solid #fca5a5', borderRadius: 4,
    padding: '2px 6px', fontSize: 11, color: '#dc2626', cursor: 'pointer',
  },
  deleteConfirmNo: {
    background: 'none', border: '1px solid #d1d5db', borderRadius: 4,
    padding: '2px 6px', fontSize: 11, color: '#6b7280', cursor: 'pointer',
  },
  // Footer
  footer: {
    padding: '12px 20px', borderTop: '1px solid #e5e7eb',
    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
  },
  clearBtn: {
    background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
    padding: '6px 12px', fontSize: 12, color: '#6b7280', cursor: 'pointer',
  },
  confirmBtn: {
    background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6,
    padding: '6px 12px', fontSize: 12, color: '#dc2626', cursor: 'pointer',
  },
  cancelConfirm: {
    background: 'none', border: 'none', fontSize: 12, color: '#6b7280', cursor: 'pointer',
  },
  clearLabel: {
    fontSize: 11, color: '#9ca3af', flexShrink: 0,
  },
  clearChoiceRow: {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
  },
  clearChoiceBtn: {
    background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
    padding: '5px 9px', fontSize: 11, color: '#374151', cursor: 'pointer',
  },
  clearChoiceBtnDanger: {
    background: 'none', border: '1px solid #fca5a5', borderRadius: 6,
    padding: '5px 9px', fontSize: 11, color: '#dc2626', cursor: 'pointer',
  },
  clearWarning: {
    fontSize: 12, color: '#6b7280',
  },
}
