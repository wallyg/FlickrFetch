import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { FlickrPhoto, DiscoverGroup } from '../../shared/types'
import PhotoDetail from './PhotoDetail'
import { AttributionNotice, DiscoverTile } from './DiscoverExplore'
import SmartDownloadButton from './SmartDownloadButton'

type GroupView = 'list' | 'pool'

export default function DiscoverGroups(): React.JSX.Element {
  const [view, setView] = useState<GroupView>('list')
  const [groups, setGroups] = useState<DiscoverGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<DiscoverGroup | null>(null)
  const [poolPhotos, setPoolPhotos] = useState<FlickrPhoto[]>([])
  const [poolPage, setPoolPage] = useState(1)
  const [poolPages, setPoolPages] = useState(1)
  const [poolLoading, setPoolLoading] = useState(false)
  const [poolLoadingMore, setPoolLoadingMore] = useState(false)
  const [poolError, setPoolError] = useState<string | null>(null)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    setLoading(true)
    window.flickrAPI.discoverGetMyGroups()
      .then(g => { setGroups(g); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Failed to load groups'); setLoading(false) })
  }, [])

  const openGroup = useCallback(async (group: DiscoverGroup): Promise<void> => {
    setActiveGroup(group)
    setView('pool')
    setPoolPhotos([])
    setPoolPage(1)
    setPoolPages(1)
    setPoolError(null)
    setDetailIndex(null)
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
      const nextPage = poolPage + 1
      const result = await window.flickrAPI.discoverGetGroupPhotos(activeGroup.id, nextPage)
      setPoolPhotos(prev => [...prev, ...result.photos])
      setPoolPage(result.page)
    } catch { /* ignore */ }
    finally { setPoolLoadingMore(false) }
  }, [activeGroup, poolLoadingMore, poolPage, poolPages])

  const handleBack = (): void => {
    setView('list')
    setActiveGroup(null)
    setDetailIndex(null)
  }

  if (view === 'pool' && activeGroup) {
    if (detailIndex !== null && poolPhotos[detailIndex]) {
      return (
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
      )
    }

    return (
      <div style={s.container}>
        <div style={s.headerRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button style={s.backBtn} onClick={handleBack}>← My Groups</button>
            {activeGroup.iconUrl && (
              <img src={activeGroup.iconUrl} alt="" style={s.groupIcon}
                onError={(e) => { e.currentTarget.style.display = 'none' }} />
            )}
            <div>
              <h2 style={s.heading}>{activeGroup.name}</h2>
              {activeGroup.photoCount != null && (
                <p style={s.subheading}>{activeGroup.photoCount.toLocaleString()} photos in pool</p>
              )}
            </div>
          </div>
          <SmartDownloadButton
            label="Download Group"
            onDownload={(mode) => {
              const smartMode = mode === 'all' ? undefined : mode
              window.flickrAPI.startDiscoverGroupBatch(activeGroup.id, activeGroup.name, `↓ ${activeGroup.name}`, true, smartMode)
            }}
          />
        </div>

        <AttributionNotice />

        {poolLoading && <div style={s.loadingState}>Loading group pool…</div>}
        {poolError && <div style={s.errorState}>{poolError}</div>}
        {!poolLoading && !poolError && poolPhotos.length === 0 && (
          <div style={s.emptyState}>No public photos in this group pool.</div>
        )}
        {poolPhotos.length > 0 && (
          <>
            <div style={s.grid}>
              {poolPhotos.map((photo, idx) => (
                <DiscoverTile key={photo.id} photo={photo} onClick={() => setDetailIndex(idx)} />
              ))}
            </div>
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

      {loading && <div style={s.loadingState}>Loading groups…</div>}
      {error && <div style={s.errorState}>{error}</div>}
      {!loading && !error && groups.length === 0 && (
        <div style={s.emptyState}>You are not a member of any groups.</div>
      )}
      {groups.length > 0 && (
        <div style={s.groupList}>
          {groups.map(g => (
            <div key={g.id} style={s.groupRow} onClick={() => openGroup(g)}>
              <div style={s.groupAvatarWrap}>
                {g.iconUrl
                  ? <img src={g.iconUrl} alt="" style={s.groupAvatar}
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
              <span style={s.chevron}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px 32px' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '20px' },
  heading: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#1a1a1a' },
  subheading: { margin: '4px 0 0', fontSize: '13px', color: '#888' },
  backBtn: { background: 'none', border: 'none', color: '#0063DC', cursor: 'pointer', fontSize: '14px', padding: '4px 0' },
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
  chevron: { color: '#ccc', fontSize: '20px' },
  groupIcon: { width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' },
  loadMoreRow: { display: 'flex', justifyContent: 'center', paddingTop: '8px' },
  loadMoreBtn: { padding: '8px 24px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#444' },
  loadingState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
  errorState: { textAlign: 'center', color: '#c0392b', fontSize: '14px', paddingTop: '48px' },
  emptyState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
}
