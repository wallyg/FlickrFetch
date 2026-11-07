import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { FlickrUser, FlickrPhoto, FlickrAlbum, FlickrCollection, FlickrSet, BatchProgress } from '../../shared/types'
import PhotoGrid from '../components/PhotoGrid'
import PhotoDetail from '../components/PhotoDetail'
import SettingsModal from '../components/SettingsModal'
import AlbumList from '../components/AlbumList'
import AlbumPhotoGrid from '../components/AlbumPhotoGrid'
import CollectionList from '../components/CollectionList'
import CollectionDetail from '../components/CollectionDetail'
import DownloadQueueBar from '../components/DownloadQueueBar'
import AboutModal from '../components/AboutModal'
import DownloadConfirmModal, { type PendingDownload } from '../components/DownloadConfirmModal'
import HistoryPanel from '../components/HistoryPanel'
import SmartDownloadButton from '../components/SmartDownloadButton'
import DiscoverPage from './DiscoverPage'


function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        style={styles.iconButton}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
      </button>
      {hovered && (
        <div style={styles.iconTooltip}>{label}</div>
      )}
    </div>
  )
}

type MainView = 'photostream' | 'albums' | 'album-detail' | 'collections' | 'collection-detail' | 'photo-detail'

interface MainPageProps {
  user: FlickrUser
  onSignOut: () => void
}

export default function MainPage({ user, onSignOut }: MainPageProps): React.JSX.Element {
  const displayName = user.realname || user.username
  const [appMode, setAppMode] = useState<'you' | 'discover'>('you')
  const [view, setView] = useState<MainView>('photostream')
  const [selectedAlbum, setSelectedAlbum] = useState<FlickrAlbum | null>(null)
  const [photoDetailIndex, setPhotoDetailIndex] = useState<number | null>(null)
  const [photoDetailSource, setPhotoDetailSource] = useState<'photostream' | 'album'>('photostream')
  const [photoDetailReturnView, setPhotoDetailReturnView] = useState<MainView>('photostream')
  const [photostreamPageInfo, setPhotostreamPageInfo] = useState<{ page: number; pages: number } | null>(null)
  const [albumPageInfo, setAlbumPageInfo] = useState<{ page: number; pages: number } | null>(null)
  const [photostreamSort, setPhotostreamSort] = useState('date-posted-desc')
  const [fetchingMoreDetail, setFetchingMoreDetail] = useState(false)
  const waitingToAdvanceRef = useRef(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [albumsVisited, setAlbumsVisited] = useState(false)
  const [collectionsVisited, setCollectionsVisited] = useState(false)
  const [collectionPath, setCollectionPath] = useState<FlickrCollection[]>([])
  const [albumDetailOrigin, setAlbumDetailOrigin] = useState<'albums' | 'collections'>('albums')
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [completedBatches, setCompletedBatches] = useState<BatchProgress[]>([])
  const prevProgressRef = useRef<BatchProgress | null>(null)
  const [aboutVersion, setAboutVersion] = useState<string | null>(null)
  // Album select state — independent from photostream so tab-switching preserves each
  const [albumSelectMode, setAlbumSelectMode] = useState(false)
  const [albumSelectedIds, setAlbumSelectedIds] = useState<Set<string>>(new Set())
  const [albumLastClickedId, setAlbumLastClickedId] = useState<string | null>(null)
  // Photostream select state
  const [photostreamSelectMode, setPhotostreamSelectMode] = useState(false)
  const [photostreamSelectedIds, setPhotostreamSelectedIds] = useState<Set<string>>(new Set())
  const [photostreamLastClickedId, setPhotostreamLastClickedId] = useState<string | null>(null)
  const [loadedAlbumPhotos, setLoadedAlbumPhotos] = useState<FlickrPhoto[]>([])
  const [loadedPhotostreamPhotos, setLoadedPhotostreamPhotos] = useState<FlickrPhoto[]>([])
  const [pendingDownload, setPendingDownload] = useState<PendingDownload | null>(null)
  const [settingsKey, setSettingsKey] = useState(0)
  const [albumFilteredPhotos, setAlbumFilteredPhotos] = useState<FlickrPhoto[]>([])
  const [photostreamFilteredPhotos, setPhotostreamFilteredPhotos] = useState<FlickrPhoto[]>([])
  const [albumMediaFilter, setAlbumMediaFilter] = useState<'all' | 'photo' | 'video'>('all')
  const [albumPrivacyFilter, setAlbumPrivacyFilter] = useState<'all' | 'public' | 'friends' | 'family' | 'private'>('all')
  const handleBatchDismiss = useCallback(() => setBatchProgress(null), [])
  const handleStackedDismiss = useCallback((idx: number) => setCompletedBatches(prev => prev.filter((_, i) => i !== idx)), [])
  const handleDismissAll = useCallback(() => { setBatchProgress(null); setCompletedBatches([]) }, [])
  const [photostreamRefreshKey, setPhotostreamRefreshKey] = useState(0)
  useEffect(() => {
    const unsubscribe = window.flickrAPI.onBatchProgress((p) => {
      const prev = prevProgressRef.current
      if (prev && prev.status === 'done' && p.status === 'running') {
        setCompletedBatches(old => [prev, ...old])
      }
      prevProgressRef.current = p
      setBatchProgress(p)
    })
    return unsubscribe
  }, [])

  // Auto-advance when new photos arrive after fetch-more was triggered at end of list
  useEffect(() => {
    if (!waitingToAdvanceRef.current || photoDetailIndex === null) return
    const photos = photoDetailSource === 'photostream' ? loadedPhotostreamPhotos : loadedAlbumPhotos
    if (photoDetailIndex < photos.length - 1) {
      waitingToAdvanceRef.current = false
      setPhotoDetailIndex(prev => (prev !== null ? prev + 1 : prev))
    }
  }, [loadedPhotostreamPhotos, loadedAlbumPhotos, photoDetailIndex, photoDetailSource])

  useEffect(() => {
    const unsubscribe = window.flickrAPI.onShowAbout((data) => setAboutVersion(data.version))
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = window.flickrAPI.onOpenSettings(() => setShowSettings(true))
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = window.flickrAPI.onOpenHistory(() => setShowHistory(true))
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = window.flickrAPI.onMenuSignOut(() => onSignOut())
    return unsubscribe
  }, [onSignOut])

  const exitAlbumSelect = useCallback((): void => {
    setAlbumSelectMode(false); setAlbumSelectedIds(new Set()); setAlbumLastClickedId(null)
  }, [])

  const exitPhotostreamSelect = useCallback((): void => {
    setPhotostreamSelectMode(false); setPhotostreamSelectedIds(new Set()); setPhotostreamLastClickedId(null)
  }, [])

  const handleSelectAll = useCallback((): void => {
    const source = albumFilteredPhotos.length > 0 ? albumFilteredPhotos : loadedAlbumPhotos
    setAlbumSelectedIds(new Set(source.map((p) => p.id)))
  }, [albumFilteredPhotos, loadedAlbumPhotos])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') {
        if (albumSelectMode) exitAlbumSelect()
        else if (photostreamSelectMode) exitPhotostreamSelect()
      }
      if (e.metaKey && e.key === 'a') {
        if (albumSelectMode) { e.preventDefault(); handleSelectAll() }
        else if (photostreamSelectMode) {
          e.preventDefault()
          const source = photostreamFilteredPhotos.length > 0 ? photostreamFilteredPhotos : loadedPhotostreamPhotos
          setPhotostreamSelectedIds(new Set(source.map(p => p.id)))
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [albumSelectMode, photostreamSelectMode, exitAlbumSelect, exitPhotostreamSelect, handleSelectAll, loadedPhotostreamPhotos, photostreamFilteredPhotos])

  const handleAlbumToggleSelect = (photo: FlickrPhoto, shiftKey: boolean): void => {
    if (shiftKey && albumLastClickedId) {
      const fromIdx = loadedAlbumPhotos.findIndex((p) => p.id === albumLastClickedId)
      const toIdx = loadedAlbumPhotos.findIndex((p) => p.id === photo.id)
      if (fromIdx !== -1 && toIdx !== -1) {
        const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
        const rangeIds = loadedAlbumPhotos.slice(start, end + 1).map((p) => p.id)
        setAlbumSelectedIds((prev) => new Set([...prev, ...rangeIds]))
      }
    } else {
      setAlbumSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(photo.id)) next.delete(photo.id)
        else next.add(photo.id)
        return next
      })
      setAlbumLastClickedId(photo.id)
    }
  }

  const handlePhotostreamToggleSelect = (photo: FlickrPhoto, shiftKey: boolean): void => {
    if (shiftKey && photostreamLastClickedId) {
      const fromIdx = loadedPhotostreamPhotos.findIndex((p) => p.id === photostreamLastClickedId)
      const toIdx = loadedPhotostreamPhotos.findIndex((p) => p.id === photo.id)
      if (fromIdx !== -1 && toIdx !== -1) {
        const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
        const rangeIds = loadedPhotostreamPhotos.slice(start, end + 1).map((p) => p.id)
        setPhotostreamSelectedIds((prev) => new Set([...prev, ...rangeIds]))
      }
    } else {
      setPhotostreamSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(photo.id)) next.delete(photo.id)
        else next.add(photo.id)
        return next
      })
      setPhotostreamLastClickedId(photo.id)
    }
  }

  const handleDownloadAlbumSelected = (): void => {
    const selected = loadedAlbumPhotos.filter((p) => albumSelectedIds.has(p.id))
    if (selected.length === 0) return
    const albumTitle = selectedAlbum?.title ?? ''
    const photoCount = selected.filter(p => p.media !== 'video').length
    const videoCount = selected.filter(p => p.media === 'video').length
    const photos = selected.map(p => ({ id: p.id, title: p.title }))
    setPendingDownload({
      title: `↓ Download Selected from "${albumTitle}"`,
      photoCount,
      videoCount,
      onConfirm: (track) => {
        window.flickrAPI.startSelectedBatch(photos, `${albumTitle} (${photos.length} selected)`, track)
        exitAlbumSelect()
      },
    })
  }

  const handleDownloadPhotostreamSelected = (): void => {
    const selected = loadedPhotostreamPhotos.filter((p) => photostreamSelectedIds.has(p.id))
    if (selected.length === 0) return
    const photoCount = selected.filter(p => p.media !== 'video').length
    const videoCount = selected.filter(p => p.media === 'video').length
    const photos = selected.map(p => ({ id: p.id, title: p.title }))
    setPendingDownload({
      title: `↓ Download Selected from Photostream`,
      photoCount,
      videoCount,
      onConfirm: (track) => {
        window.flickrAPI.startSelectedBatch(photos, `Photostream (${photos.length} selected)`, track)
        exitPhotostreamSelect()
      },
    })
  }

  const handlePhotostreamPhotoSelect = useCallback((photo: FlickrPhoto): void => {
    const idx = loadedPhotostreamPhotos.findIndex(p => p.id === photo.id)
    if (idx === -1) return
    setPhotoDetailIndex(idx)
    setPhotoDetailSource('photostream')
    setPhotoDetailReturnView(view)
    setView('photo-detail')
  }, [loadedPhotostreamPhotos, view])

  const handleAlbumPhotoSelect = useCallback((photo: FlickrPhoto): void => {
    const idx = loadedAlbumPhotos.findIndex(p => p.id === photo.id)
    if (idx === -1) return
    setPhotoDetailIndex(idx)
    setPhotoDetailSource('album')
    setPhotoDetailReturnView(view)
    setView('photo-detail')
  }, [loadedAlbumPhotos, view])

  const handleClosePhotoDetail = useCallback((): void => {
    setView(photoDetailReturnView)
    setPhotoDetailIndex(null)
  }, [photoDetailReturnView])

  const handlePrevPhoto = useCallback((): void => {
    if (photoDetailIndex === null || photoDetailIndex <= 0) return
    setPhotoDetailIndex(photoDetailIndex - 1)
  }, [photoDetailIndex])

  const fetchMoreForDetail = useCallback(async (): Promise<void> => {
    if (fetchingMoreDetail) return
    if (photoDetailSource === 'photostream') {
      if (!photostreamPageInfo || photostreamPageInfo.page >= photostreamPageInfo.pages) return
      setFetchingMoreDetail(true)
      try {
        const result = await window.flickrAPI.getPhotos(photostreamPageInfo.page + 1, photostreamSort)
        setLoadedPhotostreamPhotos(prev => [...prev, ...result.photos])
        setPhotostreamPageInfo({ page: result.page, pages: result.pages })
      } catch (_e) { /* silently ignore — nav buttons stay disabled */ } finally {
        setFetchingMoreDetail(false)
      }
    } else {
      if (!selectedAlbum || !albumPageInfo || albumPageInfo.page >= albumPageInfo.pages) return
      setFetchingMoreDetail(true)
      try {
        const result = await window.flickrAPI.getAlbumPhotos(selectedAlbum.id, albumPageInfo.page + 1)
        setLoadedAlbumPhotos(prev => [...prev, ...result.photos])
        setAlbumPageInfo({ page: result.page, pages: result.pages })
      } catch (_e) { /* silently ignore */ } finally {
        setFetchingMoreDetail(false)
      }
    }
  }, [fetchingMoreDetail, photoDetailSource, photostreamPageInfo, albumPageInfo, photostreamSort, selectedAlbum])

  const handleNextPhoto = useCallback((): void => {
    if (photoDetailIndex === null) return
    const photos = photoDetailSource === 'photostream' ? loadedPhotostreamPhotos : loadedAlbumPhotos
    if (photoDetailIndex < photos.length - 1) {
      setPhotoDetailIndex(photoDetailIndex + 1)
      if (photoDetailIndex >= photos.length - 4) fetchMoreForDetail()
    } else {
      waitingToAdvanceRef.current = true
      fetchMoreForDetail()
    }
  }, [photoDetailIndex, photoDetailSource, loadedPhotostreamPhotos, loadedAlbumPhotos, fetchMoreForDetail])

  const handleAlbumSelect = (album: FlickrAlbum): void => {
    setSelectedAlbum(album)
    setAlbumDetailOrigin('albums')
    setView('album-detail')
  }

  const handleSetSelect = (set: FlickrSet): void => {
    setSelectedAlbum({ id: set.id, title: set.title, description: set.description, photoCount: 0, videoCount: 0, coverPhotoUrl: '' })
    setAlbumDetailOrigin('collections')
    setView('album-detail')
  }

  const handleCollectionSelect = (collection: FlickrCollection): void => {
    setCollectionPath((prev) => [...prev, collection])
    setView('collection-detail')
  }

  const handleBackFromAlbumDetail = (): void => {
    exitAlbumSelect()
    setLoadedAlbumPhotos([])
    setSelectedAlbum(null)
    if (albumDetailOrigin === 'collections') {
      setView('collection-detail')
    } else {
      setView('albums')
    }
  }

  const handleBackInCollections = (): void => {
    if (collectionPath.length <= 1) {
      setCollectionPath([])
      setView('collections')
    } else {
      setCollectionPath((prev) => prev.slice(0, -1))
    }
  }

  const currentCollection = collectionPath[collectionPath.length - 1] ?? null

  const detailPhotos = photoDetailSource === 'photostream' ? loadedPhotostreamPhotos : loadedAlbumPhotos
  const detailPhoto = photoDetailIndex !== null ? (detailPhotos[photoDetailIndex] ?? null) : null
  const detailPageInfo = photoDetailSource === 'photostream' ? photostreamPageInfo : albumPageInfo
  const detailHasMore = detailPageInfo !== null && detailPageInfo.page < detailPageInfo.pages
  const detailSourceName = photoDetailSource === 'photostream' ? 'Photostream' : (selectedAlbum?.title ?? 'Album')

  return (
    <div style={styles.container}>
<header style={styles.header}>
        <span style={styles.wordmark}>
          <span style={{ color: '#0063DC' }}>Flickr</span><span style={{ color: '#FF0084' }}>Fetch</span>
        </span>
        <div style={styles.userInfo}>
          <img
            src={user.avatarUrl}
            alt={displayName}
            style={styles.avatar}
            onError={(e) => {
              e.currentTarget.src = 'https://www.flickr.com/images/buddyicon.gif'
            }}
          />
          <div style={styles.userText}>
            <div style={styles.userNameRow}>
              <span style={styles.userName}>{displayName}</span>
              {user.isPro && <span style={styles.proBadge}>PRO</span>}
            </div>
            <span style={styles.userHandle}>
              @{user.username} · Flickring since {user.memberSince} ·{' '}
              <button style={styles.signOutLink} onClick={onSignOut}>Sign out</button>
            </span>
          </div>
        </div>
        <div style={styles.modePill}>
          <button
            style={{ ...styles.modePillBtn, ...(appMode === 'you' ? styles.modePillActive : {}) }}
            onClick={() => setAppMode('you')}
          >You</button>
          <button
            style={{ ...styles.modePillBtn, ...(appMode === 'discover' ? styles.modePillActive : {}) }}
            onClick={() => setAppMode('discover')}
          >Discover</button>
        </div>
        <div style={styles.headerActions}>
          <IconBtn label="Download History" onClick={() => setShowHistory(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1"/>
              <circle cx="12" cy="12" r="1.8" fill="currentColor" strokeWidth="0"/>
              <polyline points="12 7 12 12 15.5 14" strokeWidth="2"/>
            </svg>
          </IconBtn>
          <IconBtn label="Settings" onClick={() => setShowSettings(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="4" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="18" x2="20" y2="18"/>
              <circle cx="8" cy="6" r="2.2" fill="white" strokeWidth="1.8"/>
              <circle cx="16" cy="12" r="2.2" fill="white" strokeWidth="1.8"/>
              <circle cx="10" cy="18" r="2.2" fill="white" strokeWidth="1.8"/>
            </svg>
          </IconBtn>
        </div>
      </header>

      {appMode === 'you' && <div style={styles.tabBar}>
        <div style={styles.tabGroup}>
          <button
            style={{ ...styles.tab, ...(view === 'photostream' ? styles.tabActive : {}) }}
            onClick={() => setView('photostream')}
          >
            Photostream
          </button>
          <button
            style={{ ...styles.tab, ...(view === 'albums' || view === 'album-detail' && albumDetailOrigin === 'albums' ? styles.tabActive : {}) }}
            onClick={() => { setAlbumsVisited(true); setSelectedAlbum(null); setView('albums') }}
          >
            Albums
          </button>
          <button
            style={{ ...styles.tab, ...(view === 'collections' || view === 'collection-detail' || view === 'album-detail' && albumDetailOrigin === 'collections' ? styles.tabActive : {}) }}
            onClick={() => { setCollectionsVisited(true); setCollectionPath([]); setSelectedAlbum(null); setView('collections') }}
          >
            Collections
          </button>
        </div>
        {view === 'photostream' && !photostreamSelectMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              style={styles.refreshButton}
              title="Refresh photostream"
              onClick={() => {
                exitPhotostreamSelect()
                setLoadedPhotostreamPhotos([])
                setPhotostreamRefreshKey(k => k + 1)
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
            <SmartDownloadButton
              label="Download All"
              onDownload={(mode) => {
                const smartMode = mode === 'all' ? undefined : mode
                const photoCount = loadedPhotostreamPhotos.filter(p => p.media !== 'video').length
                const videoCount = loadedPhotostreamPhotos.filter(p => p.media === 'video').length
                const modeTitle = mode === 'updated' ? '↓ Download Updated (Photostream)' : mode === 'never-downloaded' ? '↓ Download Never Downloaded (Photostream)' : '↓ Download Photostream'
                setPendingDownload({
                  title: modeTitle,
                  photoCount,
                  videoCount,
                  note: `${(photoCount + videoCount).toLocaleString()} loaded — batch downloads your full photostream`,
                  onConfirm: (track) => {
                    window.flickrAPI.startPhotostreamBatch('Photostream', track, smartMode, undefined, photostreamSort)
                  },
                })
              }}
            />
            <button style={styles.selectButton} onClick={() => setPhotostreamSelectMode(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="2" y="3" width="7" height="7" rx="1"/><rect x="13" y="3" width="7" height="7" rx="1"/><rect x="2" y="14" width="7" height="7" rx="1"/><path d="M14 17l2 2 4-4"/>
              </svg>
              Select Photos
            </button>
          </div>
        )}
      </div>}

      {appMode === 'you' && view === 'album-detail' && selectedAlbum && (
        <div style={styles.albumHeader}>
          <button style={styles.backButton} onClick={handleBackFromAlbumDetail}>
            ← {albumDetailOrigin === 'collections' ? (currentCollection?.title ?? 'Collection') : 'Albums'}
          </button>
          <span style={styles.albumTitle}>{selectedAlbum.title}</span>
          {!albumSelectMode && selectedAlbum.photoCount > 0 && (
            <span style={styles.albumCount}>
              {selectedAlbum.photoCount.toLocaleString()} photo{selectedAlbum.photoCount !== 1 ? 's' : ''}
              {selectedAlbum.videoCount > 0 ? ` · ${selectedAlbum.videoCount.toLocaleString()} video${selectedAlbum.videoCount !== 1 ? 's' : ''}` : ''}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {!albumSelectMode ? (
            <>
              <SmartDownloadButton
                label="Download Album"
                onDownload={(mode) => {
                  const mt = albumMediaFilter !== 'all' ? albumMediaFilter : undefined
                  const pf = albumPrivacyFilter !== 'all' ? albumPrivacyFilter : undefined
                  const photoCount = mt === 'video' ? 0 : selectedAlbum.photoCount
                  const videoCount = mt === 'photo' ? 0 : selectedAlbum.videoCount
                  const smartMode = mode === 'all' ? undefined : mode
                  const modeTitle = mode === 'updated' ? `↓ Download Updated: "${selectedAlbum.title}"` : mode === 'never-downloaded' ? `↓ Download Never Downloaded: "${selectedAlbum.title}"` : `↓ Download Album: "${selectedAlbum.title}"`
                  setPendingDownload({
                    title: modeTitle,
                    photoCount,
                    videoCount,
                    onConfirm: async (track) => {
                      const result = await window.flickrAPI.startBatch(selectedAlbum.id, selectedAlbum.title, selectedAlbum.photoCount, selectedAlbum.videoCount, false, mt, pf, track, smartMode)
                      if (result.alreadyQueued) {
                        const ok = await window.flickrAPI.confirm(
                          `"${selectedAlbum.title}" is already downloading or queued.`,
                          'Do you want to add it to the queue again?'
                        )
                        if (ok) window.flickrAPI.startBatch(selectedAlbum.id, selectedAlbum.title, selectedAlbum.photoCount, selectedAlbum.videoCount, true, mt, pf, track, smartMode)
                      }
                    },
                  })
                }}
              />
              <button
                style={styles.selectButton}
                title="Reset download records for all photos in this album"
                onClick={async () => {
                  if (!selectedAlbum) return
                  const total = (selectedAlbum.photoCount ?? 0) + (selectedAlbum.videoCount ?? 0)
                  const ok = await window.flickrAPI.confirm(
                    `Reset download records for "${selectedAlbum.title}"?`,
                    `This will remove the download record for all ${total} photos in this album. Smart Download will treat them as never downloaded. Batch history is not affected.`
                  )
                  if (!ok) return
                  const allIds: string[] = []
                  let page = 1
                  let hasMore = true
                  while (hasMore) {
                    const result = await window.flickrAPI.getAlbumPhotos(selectedAlbum.id, page)
                    allIds.push(...result.photos.map((p: { id: string }) => p.id))
                    hasMore = page < result.pages
                    page++
                  }
                  if (allIds.length > 0) await window.flickrAPI.deletePhotoRecords(allIds)
                }}
              >Reset records</button>
              <button style={styles.selectButton} onClick={() => setAlbumSelectMode(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="2" y="3" width="7" height="7" rx="1"/><rect x="13" y="3" width="7" height="7" rx="1"/><rect x="2" y="14" width="7" height="7" rx="1"/><path d="M14 17l2 2 4-4"/>
                </svg>
                Select Photos
              </button>
            </>
          ) : (
            <>
              <button style={styles.selectButton} onClick={handleSelectAll}>Select All</button>
              {albumSelectedIds.size > 0 && (
                <button style={styles.selectButton} onClick={() => setAlbumSelectedIds(new Set())}>Clear Selection</button>
              )}
              <button
                style={{
                  ...styles.downloadAllButton,
                  ...(albumSelectedIds.size === 0 ? styles.downloadAllButtonDisabled : {})
                }}
                disabled={albumSelectedIds.size === 0}
                onClick={handleDownloadAlbumSelected}
              >
                ↓ Download Selected ({albumSelectedIds.size})
              </button>
              <button style={styles.doneButton} onClick={exitAlbumSelect}>Cancel</button>
            </>
          )}
        </div>
      )}

      {appMode === 'you' && view === 'photostream' && photostreamSelectMode && (
        <div style={styles.photostreamToolbar}>
          <span style={styles.selectedCount}>{photostreamSelectedIds.size} photos selected</span>
          {photostreamSelectedIds.size > 0 && (
            <button style={styles.selectButton} onClick={() => setPhotostreamSelectedIds(new Set())}>Clear Selection</button>
          )}
          <div style={{ flex: 1 }} />
          <button
            style={{ ...styles.downloadAllButton, ...(photostreamSelectedIds.size === 0 ? styles.downloadAllButtonDisabled : {}) }}
            disabled={photostreamSelectedIds.size === 0}
            onClick={handleDownloadPhotostreamSelected}
          >
            ↓ Download Selected ({photostreamSelectedIds.size})
          </button>
          <button style={styles.doneButton} onClick={exitPhotostreamSelect}>Cancel</button>
        </div>
      )}

      {appMode === 'you' && view === 'collection-detail' && currentCollection && (
        <div style={styles.albumHeader}>
          <button style={styles.backButton} onClick={handleBackInCollections}>
            ← {collectionPath.length > 1 ? collectionPath[collectionPath.length - 2].title : 'Collections'}
          </button>
          <span style={styles.albumTitle}>{currentCollection.title}</span>
        </div>
      )}

      {appMode === 'discover' && (
        <main style={{ ...styles.main, display: 'flex', flexDirection: 'column' }}>
          <DiscoverPage />
        </main>
      )}

      <main style={{ ...styles.main, ...(appMode === 'discover' ? { display: 'none' } : {}) }}>
        <div style={view === 'photostream' ? styles.tabPane : styles.tabPaneHidden}>
          <PhotoGrid
            key={photostreamRefreshKey}
            onPhotoSelect={handlePhotostreamPhotoSelect}
            selectMode={photostreamSelectMode}
            selectedIds={photostreamSelectedIds}
            onToggleSelect={handlePhotostreamToggleSelect}
            onPhotosLoaded={setLoadedPhotostreamPhotos}
            onPageInfo={(page, pages) => setPhotostreamPageInfo({ page, pages })}
            onSortChange={sort => setPhotostreamSort(sort)}
            onFilteredPhotosChange={setPhotostreamFilteredPhotos}
          />
        </div>
        {albumsVisited && (
          <div style={view === 'albums' ? styles.tabPane : styles.tabPaneHidden}>
            <AlbumList onAlbumSelect={handleAlbumSelect} />
          </div>
        )}
        {collectionsVisited && (
          <div style={view === 'collections' ? styles.tabPane : styles.tabPaneHidden}>
            <CollectionList onCollectionSelect={handleCollectionSelect} />
          </div>
        )}
        {view === 'collection-detail' && currentCollection && (
          <CollectionDetail
            collection={currentCollection}
            onCollectionSelect={handleCollectionSelect}
            onSetSelect={handleSetSelect}
          />
        )}
        {selectedAlbum && (
          <div style={view === 'album-detail' ? styles.tabPane : styles.tabPaneHidden}>
            <AlbumPhotoGrid
              albumId={selectedAlbum.id}
              onPhotoSelect={handleAlbumPhotoSelect}
              selectMode={albumSelectMode}
              selectedIds={albumSelectedIds}
              onToggleSelect={handleAlbumToggleSelect}
              onPhotosLoaded={setLoadedAlbumPhotos}
              onPageInfo={(page, pages) => setAlbumPageInfo({ page, pages })}
              onFilteredPhotosChange={setAlbumFilteredPhotos}
              onMediaFilterChange={setAlbumMediaFilter}
              onPrivacyFilterChange={setAlbumPrivacyFilter}
            />
          </div>
        )}
        {detailPhoto && (
          <div style={view === 'photo-detail' ? styles.tabPane : styles.tabPaneHidden}>
            <PhotoDetail
              photo={detailPhoto}
              index={photoDetailIndex!}
              total={detailPhotos.length}
              hasMore={detailHasMore}
              canGoPrev={photoDetailIndex! > 0}
              canGoNext={photoDetailIndex! < detailPhotos.length - 1 || detailHasMore}
              onPrev={handlePrevPhoto}
              onNext={handleNextPhoto}
              onClose={handleClosePhotoDetail}
              sourceName={detailSourceName}
            />
          </div>
        )}
      </main>

      {showSettings && <SettingsModal onClose={() => { setShowSettings(false); setSettingsKey(k => k + 1) }} />}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
      {aboutVersion && <AboutModal version={aboutVersion} onClose={() => setAboutVersion(null)} />}
      {pendingDownload && (
        <DownloadConfirmModal
          pending={pendingDownload}
          settingsKey={settingsKey}
          onCancel={() => setPendingDownload(null)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {(batchProgress && batchProgress.status !== 'error' || completedBatches.length > 0) && (
        <DownloadQueueBar
          progress={batchProgress && batchProgress.status !== 'error' ? batchProgress : null}
          completedBatches={completedBatches}
          onDismiss={handleBatchDismiss}
          onStackedDismiss={handleStackedDismiss}
          onDismissAll={handleDismissAll}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    backgroundColor: '#f5f5f5'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    backgroundColor: 'var(--ff-cream)',
    borderBottom: '1px solid #e8e4de'
  },
  wordmark: {
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '-0.02em',
    lineHeight: 1,
    flexShrink: 0,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #e0e0e0'
  },
  userText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px'
  },
  userNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  userName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#111'
  },
  proBadge: {
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--ff-pink)',
    backgroundColor: 'rgba(255,0,132,0.1)',
    border: '1px solid rgba(255,0,132,0.3)',
    borderRadius: '4px',
    padding: '1px 5px',
    letterSpacing: '0.06em',
    lineHeight: '1.4'
  },
  userHandle: {
    fontSize: '12px',
    color: '#888'
  },
  signOutLink: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '12px',
    color: '#aaa',
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted' as const,
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #e8e4de',
    backgroundColor: '#fff',
    paddingLeft: '24px',
    paddingRight: '16px'
  },
  tabGroup: {
    display: 'flex',
    gap: '0'
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#888',
    cursor: 'pointer',
    marginBottom: '-1px'
  },
  tabActive: {
    color: 'var(--ff-pink)',
    borderBottom: '2px solid var(--ff-pink)'
  },
  albumHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 24px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e8e4de'
  },
  backButton: {
    background: 'none',
    border: 'none',
    fontSize: '13px',
    color: 'var(--ff-blue)',
    cursor: 'pointer',
    padding: '0',
    flexShrink: 0
  },
  albumTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111'
  },
  albumCount: {
    fontSize: '13px',
    color: '#999'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  iconButton: {
    backgroundColor: 'transparent',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '8px',
    color: '#555',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTooltip: {
    position: 'absolute' as const,
    top: 'calc(100% + 6px)',
    right: 0,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '5px',
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
    zIndex: 999,
  },
  downloadAllButton: {
    backgroundColor: 'var(--ff-pink-action)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0
  },
  downloadAllButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  refreshButton: {
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '5px 8px',
    color: '#555',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  selectButton: {
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '5px 12px',
    fontSize: '13px',
    color: '#555',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  doneButton: {
    background: 'none',
    border: 'none',
    padding: '5px 8px',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--ff-text-secondary)',
    cursor: 'pointer',
    flexShrink: 0
  },
  photostreamToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 24px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e8e4de',
    minHeight: '40px'
  },
  selectedCount: {
    fontSize: '13px',
    color: '#555'
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative'
  },
  tabPane: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden'
  },
  tabPaneHidden: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    display: 'none'
  },
  modePill: {
    display: 'flex', alignItems: 'center', gap: '1px',
    background: '#f0ede8', borderRadius: '8px', padding: '3px',
  },
  modePillBtn: {
    background: 'none', border: 'none', borderRadius: '6px',
    padding: '5px 14px', cursor: 'pointer', fontSize: '13px',
    fontWeight: 500, color: '#888',
  },
  modePillActive: {
    background: '#fff', color: '#1a1a1a',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
}
