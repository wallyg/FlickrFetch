import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useFindShortcut } from '../hooks/useFindShortcut'
import type { BatchLogEntry, PhotoDownloadRecord, DiscoverDownloadRecord, FlickrAlbum } from '../../shared/types'
import EmptyState from './EmptyState'
import { sizeTag } from '../../shared/downloadLimits'

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

// Semantic aliases onto the brand tokens defined in index.html
const C = {
  downloaded:  'var(--ff-success)',
  error:       'var(--ff-error)',
  skipped:     'var(--ff-text-secondary)',
  partial:     'var(--ff-warning)',
  complete:    'var(--ff-success)',
  cancelled:   'var(--ff-slate)',
  errorDot:    'var(--ff-error)',
  text:        'var(--ff-text)',
  muted:       'var(--ff-text-muted)',
  subtle:      'var(--ff-text-secondary)',
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
      <circle cx="5" cy="5" r="5" style={{ fill: color }} />
    </svg>
  )
}

function CountPill({ label, color }: { label: string; color: string }): React.JSX.Element {
  return (
    <span style={{ ...styles.pill, color, borderColor: color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
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

// Shown when a read of the download records fails, instead of waiting on Loading forever
function LoadFailed({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return <p style={styles.empty}>This could not be loaded. <button style={{ background: 'none', border: 'none', color: 'var(--ff-blue)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }} onClick={onRetry}>Try again</button></p>
}

function BatchesTab({ onClear }: { onClear: () => void }) {
  const [entries, setEntries] = useState<BatchLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setLoading(true); setFailed(false)
    window.flickrAPI.getBatchLog().then(log => {
      setEntries(log.filter(e => !['discover', 'discover_people', 'discover_groups'].includes(e.sourceType)))
      setLoading(false)
    }).catch(() => { setFailed(true); setLoading(false) })
  }, [attempt])

  async function handleClear() {
    if (!confirming) { setConfirming(true); return }
    await window.flickrAPI.clearHistory()
    setConfirming(false)
    setEntries([])
    onClear()
  }

  if (loading) return <p style={styles.empty}>Loading…</p>
  if (failed) return <LoadFailed onRetry={() => setAttempt(n => n + 1)} />

  if (entries.length === 0) return (
    <EmptyState title="Your history starts here" body="Every batch you download shows up here, with what was saved and what was skipped. Batches are kept for 90 days." />
  )

  return (
    <>
      <div style={styles.tabBody}>
        {entries.map(entry => {
          // smartFiltered is only meaningful on batches that ran to the end (complete or partial);
          // on cancelled/error the residual just means "not yet processed".
          const smartFiltered = entry.status === 'complete' || entry.status === 'partial'
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
          {confirming ? 'Click again to clear all batch history' : 'Clear batch download history'}
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
  const searchRef = useRef<HTMLInputElement | null>(null)
  useFindShortcut(true, searchRef)   // this tab is only mounted while it is showing
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
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setLoading(true); setFailed(false)
    window.flickrAPI.searchPhotoRecords({}).then(results => {
      setAllRecords(results)
      setLoading(false)
    }).catch(() => { setFailed(true); setLoading(false) })
  }, [attempt])

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
            ref={searchRef}
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
        ) : failed ? (
          <LoadFailed onRetry={() => setAttempt(n => n + 1)} />
        ) : allRecords.length === 0 ? (
          <EmptyState title="No downloads recorded yet" body="Photos are tracked here as you download them." />
        ) : albumFilterLoading ? (
          <p style={styles.empty}>Loading album photos…</p>
        ) : filteredRecords.length === 0 ? (
          <EmptyState title="No records match these filters" body="Try removing a filter.">
            <button style={styles.clearFiltersBtn} onClick={handleClearAllPhotoFilters}>Clear filters</button>
          </EmptyState>
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
                  {sizeTag(r) && <span style={sizeTag(r) === 'Smaller size' ? styles.sizeTagSmaller : styles.sizeTag} title={sizeTag(r) === 'Smaller size' ? 'The Original was asked for and Flickr gave a smaller size' : 'Saved at the Original size'}>{sizeTag(r)}</span>}
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
            <span style={styles.clearWarning}>Clear download records from the {clearPresetLabel}?<span style={styles.clearNote}>Your files are not deleted. Smart Download will treat these photos as never downloaded.</span></span>
            <button style={styles.confirmBtn} onClick={handleConfirmPresetClear}>Confirm</button>
            <button style={styles.cancelConfirm} onClick={() => setClearMode('idle')}>Cancel</button>
          </div>
        )}

        {clearMode === 'confirm-before' && (
          <div style={{ ...styles.clearChoiceRow, flexWrap: 'wrap' as const, gap: 6 }}>
            <span style={styles.clearWarning}>Clear download records before this date:<span style={styles.clearNote}>Your files are not deleted. Smart Download will treat these photos as never downloaded.</span></span>
            <input type="date" style={styles.dateInput} value={clearDate} onChange={e => setClearDate(e.target.value)} />
            <button style={styles.confirmBtn} onClick={handleConfirmClearBefore} disabled={!clearDate}>Confirm</button>
            <button style={styles.cancelConfirm} onClick={() => setClearMode('idle')}>Cancel</button>
          </div>
        )}

        {clearMode === 'confirm-after' && (
          <div style={{ ...styles.clearChoiceRow, flexWrap: 'wrap' as const, gap: 6 }}>
            <span style={styles.clearWarning}>Clear download records after this date:<span style={styles.clearNote}>Your files are not deleted. Smart Download will treat these photos as never downloaded.</span></span>
            <input type="date" style={styles.dateInput} value={clearDate} onChange={e => setClearDate(e.target.value)} />
            <button style={styles.confirmBtn} onClick={handleConfirmClearAfter} disabled={!clearDate}>Confirm</button>
            <button style={styles.cancelConfirm} onClick={() => setClearMode('idle')}>Cancel</button>
          </div>
        )}

        {clearMode === 'confirm-all' && (
          <div style={styles.clearChoiceRow}>
            <span style={styles.clearWarning}>Clear all photo download records?<span style={styles.clearNote}>Your files are not deleted. Smart Download will treat these photos as never downloaded.</span></span>
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
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setLoading(true); setFailed(false)
    window.flickrAPI.searchDiscoverRecords({}).then(results => {
      setRecords(results)
      setLoading(false)
    }).catch(() => { setFailed(true); setLoading(false) })
  }, [attempt])

  async function handleClear() {
    if (!confirming) { setConfirming(true); return }
    await window.flickrAPI.clearDiscoverRecords()
    setConfirming(false)
    setRecords([])
  }

  if (loading) return <p style={styles.empty}>Loading…</p>
  if (failed) return <LoadFailed onRetry={() => setAttempt(n => n + 1)} />

  if (records.length === 0) return (
    <EmptyState title="No Discover downloads yet" body="Photos you download from People, Groups, and Explore will appear here." />
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
    position: 'fixed', inset: 0, zIndex: 'var(--ff-z-dialog)',
    background: 'var(--ff-scrim)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
  },
  panel: {
    width: 440, height: '100vh',
    background: 'var(--ff-surface)',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-4px 0 24px var(--ff-shadow-soft)',
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
    fontSize: 22, color: 'var(--ff-text-secondary)', lineHeight: 1, padding: '0 4px',
  },
  tabs: {
    display: 'flex', gap: 0,
    padding: '12px 20px 0',
    borderBottom: '1px solid var(--ff-border)',
  },
  tab: {
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    padding: '6px 12px 10px', fontSize: 13, color: 'var(--ff-text-secondary)',
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
    padding: '24px 20px', color: 'var(--ff-text-muted)', fontSize: 13, lineHeight: 1.5, margin: 0,
  },
  clearFiltersBtn: {
    background: 'none', border: '1px solid var(--ff-line-strong)', borderRadius: '6px',
    padding: '6px 16px', fontSize: 13, color: 'var(--ff-text-secondary)', cursor: 'pointer',
  },
  // Batch tab rows
  row: {
    padding: '10px 20px',
    borderBottom: '1px solid var(--ff-grey-100)',
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
    borderBottom: '1px solid var(--ff-border)',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  searchModeRow: {
    display: 'flex', gap: 4,
  },
  modeTab: {
    background: 'none', border: '1px solid var(--ff-line-strong)', borderRadius: 4,
    padding: '3px 8px', fontSize: 11, color: 'var(--ff-text-secondary)', cursor: 'pointer',
  },
  modeTabActive: {
    background: 'var(--ff-info-bg)', border: '1px solid var(--ff-info-line)', borderRadius: 4,
    padding: '3px 8px', fontSize: 11, color: 'var(--ff-blue)', cursor: 'pointer', fontWeight: 600,
  },
  searchInputWrap: {
    position: 'relative' as const, display: 'flex', alignItems: 'center',
  },
  searchInput: {
    flex: 1, width: '100%', boxSizing: 'border-box' as const,
    border: '1px solid var(--ff-line-strong)', borderRadius: 6,
    padding: '6px 28px 6px 10px', fontSize: 13, outline: 'none',
  },
  searchClearBtn: {
    position: 'absolute' as const, right: 6,
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, color: 'var(--ff-text-muted)', padding: '2px 4px', lineHeight: 1,
  },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  filterLabel: {
    fontSize: 11, color: 'var(--ff-text-muted)', flexShrink: 0,
  },
  presetSelect: {
    border: '1px solid var(--ff-line-strong)', borderRadius: 4,
    padding: '4px 6px', fontSize: 11, color: 'var(--ff-text)', background: 'var(--ff-surface)', cursor: 'pointer',
  },
  clearFilterX: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 10, color: 'var(--ff-text-muted)', padding: '2px 4px',
  },
  dateFieldWrap: {
    display: 'flex', alignItems: 'center', gap: 2,
  },
  dateInput: {
    border: '1px solid var(--ff-line-strong)', borderRadius: 4,
    padding: '4px 6px', fontSize: 11,
  },
  dateFieldClear: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 10, color: 'var(--ff-text-muted)', padding: '2px 3px', lineHeight: 1, flexShrink: 0,
  },
  applyBtn: {
    background: 'var(--ff-stage)', border: 'none', borderRadius: 4,
    padding: '4px 10px', fontSize: 11, color: 'var(--ff-white)', cursor: 'pointer', flexShrink: 0,
  },
  loadAlbumsBtn: {
    background: 'none', border: '1px solid var(--ff-line-strong)', borderRadius: 4,
    padding: '3px 8px', fontSize: 11, color: 'var(--ff-text-secondary)', cursor: 'pointer',
  },
  resultCount: {
    margin: 0, fontSize: 11, color: 'var(--ff-text-muted)',
  },
  // Photo record rows
  photoRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 16px',
    borderBottom: '1px solid var(--ff-grey-100)',
  },
  thumb: {
    width: 44, height: 44, borderRadius: 4,
    objectFit: 'cover', flexShrink: 0,
    background: 'var(--ff-grey-100)',
  },
  discoverThumb: {
    width: 44, height: 44, borderRadius: 4,
    objectFit: 'cover', flexShrink: 0,
    background: 'var(--ff-grey-100)',
  },
  discoverSource: {
    fontSize: 11, color: 'var(--ff-text-secondary)', marginTop: 2,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  thumbPlaceholder: {
    width: 44, height: 44, borderRadius: 4, flexShrink: 0,
    background: 'var(--ff-grey-100)',
  },
  photoMeta: {
    flex: 1, minWidth: 0,
  },
  photoTitle: {
    fontSize: 13, fontWeight: 500, color: 'var(--ff-text)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  untitled: {
    color: 'var(--ff-text-muted)', fontStyle: 'italic',
  },
  photoSub: {
    display: 'flex', alignItems: 'center', gap: 6, marginTop: 2,
  },
  staleIcon: {
    fontSize: 11, color: 'var(--ff-warning-text)', cursor: 'default',
  },
  photoDate: {
    fontSize: 11, color: 'var(--ff-text-muted)',
  },
  sizeTag: {
    fontSize: 10, color: 'var(--ff-text-secondary)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: '0 6px',
  },
  sizeTagSmaller: {
    fontSize: 10, color: 'var(--ff-warning-text)', background: 'var(--ff-warning-bg)', border: '1px solid var(--ff-warning)', borderRadius: 8, padding: '0 6px',
  },
  photoId: {
    fontSize: 10, color: 'var(--ff-text-muted)',
  },
  deleteRecordBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, color: 'var(--ff-text-muted)', padding: '4px',
    flexShrink: 0,
  },
  deleteConfirm: {
    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
  },
  deleteConfirmLabel: {
    fontSize: 11, color: 'var(--ff-text-secondary)', whiteSpace: 'nowrap' as const,
  },
  deleteConfirmYes: {
    background: 'none', border: '1px solid var(--ff-error)', borderRadius: 4,
    padding: '2px 6px', fontSize: 11, color: 'var(--ff-error)', cursor: 'pointer',
  },
  deleteConfirmNo: {
    background: 'none', border: '1px solid var(--ff-line-strong)', borderRadius: 4,
    padding: '2px 6px', fontSize: 11, color: 'var(--ff-text-secondary)', cursor: 'pointer',
  },
  // Footer
  footer: {
    padding: '12px 20px', borderTop: '1px solid var(--ff-border)',
    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
  },
  clearBtn: {
    background: 'none', border: '1px solid var(--ff-line-strong)', borderRadius: 6,
    padding: '6px 12px', fontSize: 12, color: 'var(--ff-text-secondary)', cursor: 'pointer',
  },
  confirmBtn: {
    background: 'var(--ff-error-bg)', border: '1px solid var(--ff-error)', borderRadius: 6,
    padding: '6px 12px', fontSize: 12, color: 'var(--ff-error)', cursor: 'pointer',
  },
  cancelConfirm: {
    background: 'none', border: 'none', fontSize: 12, color: 'var(--ff-text-secondary)', cursor: 'pointer',
  },
  clearLabel: {
    fontSize: 11, color: 'var(--ff-text-muted)', flexShrink: 0,
  },
  clearChoiceRow: {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
  },
  clearChoiceBtn: {
    background: 'none', border: '1px solid var(--ff-line-strong)', borderRadius: 6,
    padding: '5px 9px', fontSize: 11, color: 'var(--ff-text)', cursor: 'pointer',
  },
  clearChoiceBtnDanger: {
    background: 'none', border: '1px solid var(--ff-error)', borderRadius: 6,
    padding: '5px 9px', fontSize: 11, color: 'var(--ff-error)', cursor: 'pointer',
  },
  clearNote: { display: 'block', marginTop: 2, fontSize: 11, fontWeight: 400, color: 'var(--ff-text-secondary)' },
  clearWarning: {
    fontSize: 12, color: 'var(--ff-text-secondary)',
  },
}
