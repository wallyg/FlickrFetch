import React, { useState, useEffect, useCallback } from 'react'
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
import wordmark from '../assets/wordmark.png'

type MainView = 'photostream' | 'albums' | 'album-detail' | 'collections' | 'collection-detail'

interface MainPageProps {
  user: FlickrUser
  onSignOut: () => void
}

export default function MainPage({ user, onSignOut }: MainPageProps): React.JSX.Element {
  const displayName = user.realname || user.username
  const [view, setView] = useState<MainView>('photostream')
  const [selectedAlbum, setSelectedAlbum] = useState<FlickrAlbum | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<FlickrPhoto | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [albumsVisited, setAlbumsVisited] = useState(false)
  const [collectionsVisited, setCollectionsVisited] = useState(false)
  const [collectionPath, setCollectionPath] = useState<FlickrCollection[]>([])
  const [albumDetailOrigin, setAlbumDetailOrigin] = useState<'albums' | 'collections'>('albums')
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
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
  const [photostreamRefreshKey, setPhotostreamRefreshKey] = useState(0)

  useEffect(() => {
    const unsubscribe = window.flickrAPI.onBatchProgress((p) => setBatchProgress(p))
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = window.flickrAPI.onShowAbout((data) => setAboutVersion(data.version))
    return unsubscribe
  }, [])

  const exitAlbumSelect = useCallback((): void => {
    setAlbumSelectMode(false); setAlbumSelectedIds(new Set()); setAlbumLastClickedId(null)
  }, [])

  const exitPhotostreamSelect = useCallback((): void => {
    setPhotostreamSelectMode(false); setPhotostreamSelectedIds(new Set()); setPhotostreamLastClickedId(null)
  }, [])

  const handleSelectAll = useCallback((): void => setAlbumSelectedIds(new Set(loadedAlbumPhotos.map((p) => p.id))), [loadedAlbumPhotos])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') {
        if (albumSelectMode) exitAlbumSelect()
        else if (photostreamSelectMode) exitPhotostreamSelect()
      }
      if (e.metaKey && e.key === 'a') {
        if (albumSelectMode) { e.preventDefault(); handleSelectAll() }
        else if (photostreamSelectMode) { e.preventDefault(); setPhotostreamSelectedIds(new Set(loadedPhotostreamPhotos.map(p => p.id))) }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [albumSelectMode, photostreamSelectMode, exitAlbumSelect, exitPhotostreamSelect, handleSelectAll, loadedPhotostreamPhotos])

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

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={wordmark} alt="FlickrFetch" style={styles.wordmark} />
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
            <span style={styles.userName}>{displayName}</span>
            <span style={styles.userHandle}>@{user.username}</span>
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
            <button style={styles.selectButton} onClick={() => setPhotostreamSelectMode(true)}>Select</button>
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
                  const result = await window.flickrAPI.startBatch(selectedAlbum.id, selectedAlbum.title, selectedAlbum.photoCount, selectedAlbum.videoCount)
                  if (result.alreadyQueued) {
                    const ok = await window.flickrAPI.confirm(
                      `"${selectedAlbum.title}" is already downloading or queued.`,
                      'Do you want to add it to the queue again?'
                    )
                    if (ok) window.flickrAPI.startBatch(selectedAlbum.id, selectedAlbum.title, selectedAlbum.photoCount, selectedAlbum.videoCount, true)
                  }
                }}
              >
                ↓ Download All
              </button>
              <button style={styles.selectButton} onClick={() => setAlbumSelectMode(true)}>
                Select
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
            onPhotoSelect={setSelectedPhoto}
            selectMode={photostreamSelectMode}
            selectedIds={photostreamSelectedIds}
            onToggleSelect={handlePhotostreamToggleSelect}
            onPhotosLoaded={setLoadedPhotostreamPhotos}
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
        {view === 'album-detail' && selectedAlbum && (
          <AlbumPhotoGrid
            albumId={selectedAlbum.id}
            onPhotoSelect={setSelectedPhoto}
            selectMode={albumSelectMode}
            selectedIds={albumSelectedIds}
            onToggleSelect={handleAlbumToggleSelect}
            onPhotosLoaded={setLoadedAlbumPhotos}
          />
        )}
        {selectedPhoto && (
          <PhotoDetail photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
        )}
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {aboutVersion && <AboutModal version={aboutVersion} onClose={() => setAboutVersion(null)} />}

      {batchProgress && batchProgress.status !== 'error' && (
        <DownloadQueueBar
          progress={batchProgress}
          onDismiss={() => setBatchProgress(null)}
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
    backgroundColor: '#FCFAF6',
    borderBottom: '1px solid #e8e4de'
  },
  wordmark: {
    height: '28px',
    width: 'auto'
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
    flexDirection: 'column'
  },
  userName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#111'
  },
  userHandle: {
    fontSize: '13px',
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
    flexShrink: 0
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
