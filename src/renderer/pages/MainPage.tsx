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


type MainView = 'photostream' | 'albums' | 'album-detail' | 'collections' | 'collection-detail' | 'photo-detail'

interface MainPageProps {
  user: FlickrUser
  onSignOut: () => void
}

export default function MainPage({ user, onSignOut }: MainPageProps): React.JSX.Element {
  const displayName = user.realname || user.username
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
  const [albumsVisited, setAlbumsVisited] = useState(false)
  const [collectionsVisited, setCollectionsVisited] = useState(false)
  const [collectionPath, setCollectionPath] = useState<FlickrCollection[]>([])
  const [albumDetailOrigin, setAlbumDetailOrigin] = useState<'albums' | 'collections'>('albums')
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [completedBatches, setCompletedBatches] = useState<BatchProgress[]>([])
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
  const [albumFilteredPhotos, setAlbumFilteredPhotos] = useState<FlickrPhoto[]>([])
  const [photostreamFilteredPhotos, setPhotostreamFilteredPhotos] = useState<FlickrPhoto[]>([])
  const [albumMediaFilter, setAlbumMediaFilter] = useState<'all' | 'photo' | 'video'>('all')
  const [albumPrivacyFilter, setAlbumPrivacyFilter] = useState<'all' | 'public' | 'friends' | 'family' | 'private'>('all')
  const handleBatchDismiss = useCallback(() => setBatchProgress(null), [])
  const handleStackedDismiss = useCallback((idx: number) => setCompletedBatches(prev => prev.filter((_, i) => i !== idx)), [])
  const handleDismissAll = useCallback(() => { setBatchProgress(null); setCompletedBatches([]) }, [])
  const [photostreamRefreshKey, setPhotostreamRefreshKey] = useState(0)
  const [exifToolMissing, setExifToolMissing] = useState(false)

  useEffect(() => {
    window.flickrAPI.checkExifTool().then((available) => {
      if (!available) setExifToolMissing(true)
    })
  }, [])

  useEffect(() => {
    const unsubscribe = window.flickrAPI.onBatchProgress((p) => {
      setBatchProgress(prev => {
        // When a new batch starts and the previous one was done, stack it
        if (prev && prev.status === 'done' && p.status === 'running') {
          setCompletedBatches(old => [prev, ...old])
        }
        return p
      })
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
    const photos = loadedAlbumPhotos.filter((p) => albumSelectedIds.has(p.id)).map((p) => ({ id: p.id, title: p.title }))
    if (photos.length === 0) return
    window.flickrAPI.startSelectedBatch(photos, `${selectedAlbum!.title} (${photos.length} selected)`)
    exitAlbumSelect()
  }

  const handleDownloadPhotostreamSelected = (): void => {
    const photos = loadedPhotostreamPhotos.filter((p) => photostreamSelectedIds.has(p.id)).map((p) => ({ id: p.id, title: p.title }))
    if (photos.length === 0) return
    window.flickrAPI.startSelectedBatch(photos, `Photostream (${photos.length} selected)`)
    exitPhotostreamSelect()
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
      {exifToolMissing && (
        <div style={styles.exifBanner}>
          <span style={styles.exifBannerText}>
            <strong>ExifTool not found.</strong> Photos will download without embedded metadata.
            Install it to enable metadata: <code style={styles.exifCode}>brew install exiftool</code>
          </span>
          <button style={styles.exifBannerDismiss} onClick={() => setExifToolMissing(false)}>✕</button>
        </div>
      )}
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
            <span style={styles.userHandle}>@{user.username} · Flickring since {user.memberSince}</span>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.settingsButton} onClick={() => setShowSettings(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>
          <button style={styles.signOutButton} onClick={onSignOut}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </header>

      <div style={styles.tabBar}>
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
            <button style={styles.selectButton} onClick={() => setPhotostreamSelectMode(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="2" y="3" width="7" height="7" rx="1"/><rect x="13" y="3" width="7" height="7" rx="1"/><rect x="2" y="14" width="7" height="7" rx="1"/><path d="M14 17l2 2 4-4"/>
              </svg>
              Select Photos
            </button>
          </div>
        )}
      </div>

      {view === 'album-detail' && selectedAlbum && (
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
              <button
                style={styles.downloadAllButton}
                onClick={async () => {
                  const mt = albumMediaFilter !== 'all' ? albumMediaFilter : undefined
                  const pf = albumPrivacyFilter !== 'all' ? albumPrivacyFilter : undefined
                  const result = await window.flickrAPI.startBatch(selectedAlbum.id, selectedAlbum.title, selectedAlbum.photoCount, selectedAlbum.videoCount, false, mt, pf)
                  if (result.alreadyQueued) {
                    const ok = await window.flickrAPI.confirm(
                      `"${selectedAlbum.title}" is already downloading or queued.`,
                      'Do you want to add it to the queue again?'
                    )
                    if (ok) window.flickrAPI.startBatch(selectedAlbum.id, selectedAlbum.title, selectedAlbum.photoCount, selectedAlbum.videoCount, true, mt, pf)
                  }
                }}
              >
                ↓ Download All
              </button>
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
                <button style={styles.selectButton} onClick={() => setAlbumSelectedIds(new Set())}>Deselect All</button>
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

      {view === 'photostream' && photostreamSelectMode && (
        <div style={styles.photostreamToolbar}>
          <span style={styles.selectedCount}>{photostreamSelectedIds.size} selected</span>
          {photostreamSelectedIds.size > 0 && (
            <button style={styles.selectButton} onClick={() => setPhotostreamSelectedIds(new Set())}>Deselect All</button>
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

      {view === 'collection-detail' && currentCollection && (
        <div style={styles.albumHeader}>
          <button style={styles.backButton} onClick={handleBackInCollections}>
            ← {collectionPath.length > 1 ? collectionPath[collectionPath.length - 2].title : 'Collections'}
          </button>
          <span style={styles.albumTitle}>{currentCollection.title}</span>
        </div>
      )}

      <main style={styles.main}>
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {aboutVersion && <AboutModal version={aboutVersion} onClose={() => setAboutVersion(null)} />}

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
  exifBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 20px',
    backgroundColor: '#FFF3CD',
    borderBottom: '1px solid #F5C542',
    flexShrink: 0
  },
  exifBannerText: {
    fontSize: '13px',
    color: '#5A4A00',
    lineHeight: '1.5'
  },
  exifCode: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: '4px',
    padding: '1px 5px',
    fontFamily: 'ui-monospace, Menlo, monospace',
    fontSize: '12px'
  },
  exifBannerDismiss: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 4px',
    flexShrink: 0
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    backgroundColor: '#FCFAF6',
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
    color: '#FF0084',
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
    color: '#FF0084',
    borderBottom: '2px solid #FF0084'
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
    color: '#0063DC',
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
  settingsButton: {
    backgroundColor: 'transparent',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '7px 14px',
    fontSize: '13px',
    color: '#555',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  signOutButton: {
    backgroundColor: 'transparent',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '7px 14px',
    fontSize: '13px',
    color: '#555',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  downloadAllButton: {
    backgroundColor: '#FF0084',
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
    color: '#0063DC',
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
}
