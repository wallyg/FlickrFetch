import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import type { FlickrPhoto, DiscoverGroup } from '../../shared/types'
import PhotoDetail from './PhotoDetail'
import { AttributionNotice, DiscoverTile, DiscoverSelectBar } from './DiscoverExplore'
import SmartDownloadButton from './SmartDownloadButton'
import { GridIcon, ListIcon, JustifiedIcon, ChevronLeftIcon, ChevronRightIcon, sharedStyles as ss, type PhotoViewMode, PhotoListRow, loadPhotoViewMode, savePhotoViewMode, loadRowHeight, saveRowHeight, computeJustifiedRows } from './PhotoGridShared'

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

  useLayoutEffect(() => {
    if (poolLoading) return
    if (gridContainerRef.current) {
      setContainerWidth(Math.round(gridContainerRef.current.getBoundingClientRect().width))
    }
  }, [poolLoading, poolViewMode])

  useEffect(() => {
    if (poolLoading) return
    const el = gridContainerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.round(entry.contentRect.width))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [poolLoading, poolViewMode])

  const poolJustifiedRows = useMemo(() => {
    if (poolViewMode !== 'justified' || containerWidth === 0) return null
    return computeJustifiedRows(poolPhotos, containerWidth, rowHeight)
  }, [poolPhotos, poolViewMode, containerWidth, rowHeight])

  const handleBack = (): void => {
    setView('list')
    setActiveGroup(null)
    setDetailIndex(null)
    setSelectMode(false)
    setSelectedIds(new Set())
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
    if (detailIndex !== null && poolPhotos[detailIndex]) {
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <PhotoDetail
            photo={poolPhotos[detailIndex]}
            index={detailIndex}
            total={poolPhotos.length}
            hasMore={poolPage < poolPages}
            canGoPrev={detailIndex > 0}
            canGoNext={detailIndex < poolPhotos.length - 1 || poolPage < poolPages}
            onPrev={() => setDetailIndex(d => (d !== null && d > 0 ? d - 1 : d))}
            onNext={() => {
              if (detailIndex < poolPhotos.length - 1) setDetailIndex(detailIndex + 1)
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
          {!selectMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '6px' }}>
              <div style={{ flex: 1 }} />
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
            </div>
          )}
        </div>

        <AttributionNotice />

        {poolLoading && <div style={s.loadingState}>Loading group pool…</div>}
        {poolError && <div style={s.errorState}>{poolError}</div>}
        {!poolLoading && !poolError && poolPhotos.length === 0 && (
          <div style={s.emptyState}>No public photos in this group pool.</div>
        )}
        {poolPhotos.length > 0 && (
          <>
            {poolViewMode === 'list' ? (
              <div style={ss.listContainer}>
                {poolPhotos.map((photo, idx) => (
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
            ) : poolViewMode === 'grid' ? (
              <div style={{ display: 'grid', gap: '4px', gridTemplateColumns: `repeat(auto-fill, minmax(${rowHeight}px, 1fr))` }}>
                {poolPhotos.map((photo, idx) => (
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
                      {row.photos.map((photo) => {
                        const photoIdx = gIdx++
                        const pi = row.photos.indexOf(photo)
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
  backBtn: { background: 'none', border: 'none', color: '#0063DC', cursor: 'pointer', fontSize: '14px', padding: '4px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' },
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
    background: '#0063DC', color: '#fff', display: 'flex', alignItems: 'center',
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
  errorState: { textAlign: 'center', color: '#c0392b', fontSize: '14px', paddingTop: '48px' },
  emptyState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
}
