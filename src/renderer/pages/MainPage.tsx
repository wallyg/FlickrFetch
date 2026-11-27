import React, { useState, useEffect, useCallback, useRef } from 'react'
import ErrorBoundary from '../ui/ErrorBoundary'
import Dialog from '../ui/Dialog'
import ScreenTop from '../ui/ScreenTop'
import MoreMenu from '../ui/MoreMenu'
import { tabMark, linkBtn, primaryBtn, quietBtn, headingCard, headingDialog } from '../ui/kit'
import Icon from '../ui/Icon'
import { useRememberScroll } from '../hooks/useRememberScroll'
import MapPanel from '../components/MapPanel'
import type { RangeOpts } from '../components/DateFilterBar'
import type { PrivacyFilter } from '../components/PhotoGridShared'
import BatchEditButton from '../components/BatchEditButton'
import { collectionAlbums } from '../../shared/collections'
import type { FlickrUser, FlickrPhoto, FlickrAlbum, FlickrCollection, FlickrSet, BatchProgress, TagMode } from '../../shared/types'
import PhotoGrid from '../components/PhotoGrid'
import PhotoDetail from '../components/PhotoDetail'
import SettingsModal from '../components/SettingsModal'
import type { SettingsTab } from '../components/SettingsModal'
import AlbumList from '../components/AlbumList'
import AlbumPhotoGrid from '../components/AlbumPhotoGrid'
import CollectionList from '../components/CollectionList'
import CollectionDetail from '../components/CollectionDetail'
import TagsPanel from '../components/TagsPanel'
import CleanupPanel from '../components/CleanupPanel'
import OnThisDayPanel from '../components/OnThisDayPanel'
import TimelinePanel from '../components/TimelinePanel'
import OnThisDayCard from '../components/OnThisDayCard'
import DownloadQueueBar from '../components/DownloadQueueBar'
import AboutModal from '../components/AboutModal'
import FreeAccountBanner from '../components/FreeAccountBanner'
import DownloadConfirmModal, { type PendingDownload } from '../components/DownloadConfirmModal'
import HistoryPanel from '../components/HistoryPanel'
import SmartDownloadButton from '../components/SmartDownloadButton'
import DiscoverPage from './DiscoverPage'


function IconBtn({ label, onClick, children, badge, showLabel }: { label: string; onClick: () => void; children: React.ReactNode; badge?: boolean; showLabel?: boolean }) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        style={{ ...styles.iconButton, ...(showLabel ? styles.iconButtonLabeled : {}) }}
        aria-label={label}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
        {showLabel && <span style={styles.iconButtonLabel}>{label}</span>}
      </button>
      {badge && <span style={styles.updateBadge} />}
      {hovered && !showLabel && (
        <div style={styles.iconTooltip}>{label}</div>
      )}
    </div>
  )
}

type MainView = 'photostream' | 'tags' | 'cleanup' | 'onthisday' | 'timeline' | 'map' | 'albums' | 'album-detail' | 'collections' | 'collection-detail' | 'photo-detail'

interface MainPageProps {
  user: FlickrUser
  onSignOut: () => void
}

export default function MainPage({ user, onSignOut }: MainPageProps): React.JSX.Element {
  const displayName = user.realname || user.username
  const [appMode, setAppMode] = useState<'you' | 'discover'>('you')
  const [showAvatarPopover, setShowAvatarPopover] = useState(false)
  const [view, setView] = useState<MainView>('photostream')
  // Each tab keeps how far you had scrolled when you click away and come back
  const youMainRef = useRef<HTMLElement | null>(null)
  const discoverMainRef = useRef<HTMLElement | null>(null)
  useRememberScroll(youMainRef, `${appMode}|${view}`)
  useRememberScroll(discoverMainRef, appMode)
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
  const [settingsTab, setSettingsTab] = useState<SettingsTab | undefined>(undefined)   // which tab Settings opens on
  const openSettings = (tab?: SettingsTab): void => { setSettingsTab(tab); setShowSettings(true) }
  const [showHistory, setShowHistory] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [albumsVisited, setAlbumsVisited] = useState(false)
  const [collectionsVisited, setCollectionsVisited] = useState(false)
  const [tagsVisited, setTagsVisited] = useState(false)
  const [cleanupVisited, setCleanupVisited] = useState(false)
  // Which tab a 'View photos' search came from, so the Photostream's back link returns there
  const [tagBackView, setTagBackView] = useState<'tags' | 'cleanup'>('tags')
  const [onThisDayVisited, setOnThisDayVisited] = useState(false)
  const [timelineVisited, setTimelineVisited] = useState(false)
  const [mapVisited, setMapVisited] = useState(false)
  const [mapTarget, setMapTarget] = useState<{ lat: number; lon: number; nonce: number } | null>(null)   // Health Check's "Show on the map"
  // Only Health Check opens the Map on a place, so the Map offers a way back there until you leave it
  const [mapBack, setMapBack] = useState(false)
  const showOnMap = (lat: number, lon: number): void => { setMapTarget({ lat, lon, nonce: Date.now() }); setMapVisited(true); setMapBack(true); setView('map') }
  useEffect(() => { if (view !== 'map') setMapBack(false) }, [view])
  // A finished download that came down smaller than the Original: open Health Check > Backup > Saved smaller than the original (#126)
  const [backupRequest, setBackupRequest] = useState<{ list: 'smaller'; nonce: number } | null>(null)
  const showSmaller = (): void => { setBackupRequest({ list: 'smaller', nonce: Date.now() }); setCleanupVisited(true); setView('cleanup') }
  // Set by 'Open in Photostream' in On This Day or the Timeline; the photostream applies it as a date range
  const [dateSearchRequest, setDateSearchRequest] = useState<{ from: string; to: string; privacy?: PrivacyFilter; media?: 'photo' | 'video'; tag?: string; backLabel?: string; nonce: number } | null>(null)
  const handledDateSearch = useRef(0)
  const [dateBackView, setDateBackView] = useState<'onthisday' | 'timeline' | 'cleanup'>('onthisday')
  const [otdJump, setOtdJump] = useState<{ month: number; day: number; year?: number; nonce: number } | null>(null)
  // In a narrow window the sub-tab row tightens (smaller text and gaps) so all eight labels still fit on one line
  const [tight, setTight] = useState(typeof window !== 'undefined' && window.innerWidth < 860)
  // Under 660 px the top bar is full: History and Settings show only their icons (the name appears on hover) so the account button stays on screen.
  // With the words the bar needs about 630 to 650 px (measured from the owner's screenshots at 564 and 764 pt).
  const [compactHeader, setCompactHeader] = useState(typeof window !== 'undefined' && window.innerWidth < 660)
  useEffect(() => {
    const watch = (): void => { setTight(window.innerWidth < 860); setCompactHeader(window.innerWidth < 660) }
    window.addEventListener('resize', watch)
    return () => window.removeEventListener('resize', watch)
  }, [])
  const tabStyle: React.CSSProperties = tight ? { ...styles.tab, padding: '8px 8px', fontSize: '13px' } : styles.tab
  const [dataKey, setDataKey] = useState(0)   // changes when a scan finishes, so On This Day, the Timeline and the card look again
  // Set when a tag is clicked in the photo detail while viewing an album; the album grid filters itself to it
  const [albumTagRequest, setAlbumTagRequest] = useState<{ tag: string; nonce: number } | null>(null)
  // Which of those requests the grids have already applied (a grid that remounts must not replay an old one)
  const handledTagSearch = useRef(0)
  const handledAlbumTag = useRef(0)
  // Set when 'View photos' is pressed in the Tags tab; the photostream applies it as a tag search
  const [tagSearchRequest, setTagSearchRequest] = useState<{ tags: string[]; mode: TagMode; nonce: number } | null>(null)
  const [collectionPath, setCollectionPath] = useState<FlickrCollection[]>([])
  const [albumDetailOrigin, setAlbumDetailOrigin] = useState<'albums' | 'collections' | 'cleanup'>('albums')
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
  const [albumExtraFilters, setAlbumExtraFilters] = useState(false)
  const [photostreamFiltersActive, setPhotostreamFiltersActive] = useState(false)
  const [albumPrivacyFilter, setAlbumPrivacyFilter] = useState<PrivacyFilter>('all')
  const [resetError, setResetError] = useState<string | null>(null)
  const handleResetRecords = useCallback(async () => {
    if (!selectedAlbum) return
    setResetError(null)
    try {
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
      setShowResetConfirm(false)
    } catch {
      // The box stays open and says so, so nothing looks done when it was not
      setResetError('Couldn\u2019t reset the records. Check your connection and try again.')
    }
  }, [selectedAlbum])

  const handleBatchDismiss = useCallback(() => setBatchProgress(null), [])
  const handleStackedDismiss = useCallback((idx: number) => setCompletedBatches(prev => prev.filter((_, i) => i !== idx)), [])
  const handleDismissAll = useCallback(() => {
    setCompletedBatches([])
    setBatchProgress(prev => (prev?.status === 'done' || prev?.status === 'cancelled') ? null : prev)
  }, [])
  const [photostreamRefreshKey, setPhotostreamRefreshKey] = useState(0)
  const [showAlbumOverflow, setShowAlbumOverflow] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [collectionToDownload, setCollectionToDownload] = useState<FlickrCollection | null>(null)
  const [collectionNote, setCollectionNote] = useState<string | null>(null)   // what the last "Download all albums" did, when it did less than asked
  useEffect(() => window.flickrAPI.onTagScanProgress(p => { if (p.phase === 'done') setDataKey(k => k + 1) }), [])
  useEffect(() => window.flickrAPI.onOpenOnThisDay(() => { setAppMode('you'); setOnThisDayVisited(true); setView('onthisday') }), [])

  useEffect(() => {
    const unsubscribe = window.flickrAPI.onBatchProgress((p) => {
      const prev = prevProgressRef.current
      if (prev && prev.status === 'done' && p.status === 'running') {
        setCompletedBatches(old => [{ ...prev, completedAt: Date.now() }, ...old])
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
    const unsubscribe = window.flickrAPI.onOpenSettings(() => { setSettingsTab(undefined); setShowSettings(true) })
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

  useEffect(() => {
    const unsubscribe = window.flickrAPI.onUpdateAvailable(({ version }) => setUpdateVersion(version))
    return unsubscribe
  }, [])

  const exitAlbumSelect = useCallback((): void => {
    setAlbumSelectMode(false); setAlbumSelectedIds(new Set()); setAlbumLastClickedId(null)
  }, [])

  const exitPhotostreamSelect = useCallback((): void => {
    setPhotostreamSelectMode(false); setPhotostreamSelectedIds(new Set()); setPhotostreamLastClickedId(null)
  }, [])

  const handleSelectAll = useCallback((): void => {
    // Only what's visible: photos hidden by a filter are never selected
    setAlbumSelectedIds(new Set(albumFilteredPhotos.map((p) => p.id)))
  }, [albumFilteredPhotos])

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
          setPhotostreamSelectedIds(new Set(photostreamFilteredPhotos.map(p => p.id)))
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [albumSelectMode, photostreamSelectMode, exitAlbumSelect, exitPhotostreamSelect, handleSelectAll, photostreamFilteredPhotos])

  const handleAlbumToggleSelect = (photo: FlickrPhoto, shiftKey: boolean): void => {
    if (shiftKey && albumLastClickedId) {
      const fromIdx = albumFilteredPhotos.findIndex((p) => p.id === albumLastClickedId)
      const toIdx = albumFilteredPhotos.findIndex((p) => p.id === photo.id)
      if (fromIdx !== -1 && toIdx !== -1) {
        const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
        const rangeIds = albumFilteredPhotos.slice(start, end + 1).map((p) => p.id)
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
      const fromIdx = photostreamFilteredPhotos.findIndex((p) => p.id === photostreamLastClickedId)
      const toIdx = photostreamFilteredPhotos.findIndex((p) => p.id === photo.id)
      if (fromIdx !== -1 && toIdx !== -1) {
        const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
        const rangeIds = photostreamFilteredPhotos.slice(start, end + 1).map((p) => p.id)
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

  // Filters are on: download exactly the photos visible in the grid instead of the whole album/photostream
  // Downloads started from On This Day or the Timeline (the photos come from the local list)
  const startDateDownload = (photos: { id: string; title: string }[], title: string, note: string): void => {
    if (photos.length === 0) return
    setPendingDownload({
      title,
      photoCount: photos.length,
      videoCount: 0,
      note,
      onConfirm: (track, exportFormat) => {
        window.flickrAPI.startSelectedBatch(photos, `${title} (${photos.length})`, track, exportFormat === 'zip', title)
      },
    })
  }
  const openDateRange = (from: string, to: string, opts: RangeOpts, from_view: 'onthisday' | 'timeline' | 'cleanup'): void => {
    exitPhotostreamSelect()
    setDateBackView(from_view)
    setDateSearchRequest({ from, to, privacy: opts.privacy, media: opts.media, tag: opts.tag, backLabel: from_view === 'onthisday' ? 'On This Day' : from_view === 'cleanup' ? 'Health Check' : 'Timeline', nonce: Date.now() })
    setView('photostream')
  }

  // isPhotostream says which it is: an album that happens to be called "Photostream" still gets its own folder
  const startShownDownload = (shown: FlickrPhoto[], where: string, displayTitle: string, isPhotostream = false): void => {
    if (shown.length === 0) return
    const photoCount = shown.filter(p => p.media !== 'video').length
    const videoCount = shown.filter(p => p.media === 'video').length
    const photos = shown.map(p => ({ id: p.id, title: p.title }))
    setPendingDownload({
      title: `Shown in ${where}`,
      photoCount,
      videoCount,
      note: 'Only the photos matching your filters are downloaded',
      onConfirm: (track, exportFormat) => {
        window.flickrAPI.startSelectedBatch(photos, `${displayTitle} (${photos.length} shown)`, track, exportFormat === 'zip', isPhotostream ? '' : displayTitle)
      },
    })
  }

  const handleDownloadAlbumSelected = (): void => {
    const selected = albumFilteredPhotos.filter((p) => albumSelectedIds.has(p.id))
    if (selected.length === 0) return
    const albumTitle = selectedAlbum?.title ?? ''
    const photoCount = selected.filter(p => p.media !== 'video').length
    const videoCount = selected.filter(p => p.media === 'video').length
    const photos = selected.map(p => ({ id: p.id, title: p.title }))
    setPendingDownload({
      title: `Selected from "${albumTitle}"`,
      photoCount,
      videoCount,
      onConfirm: (track, exportFormat) => {
        window.flickrAPI.startSelectedBatch(photos, `${albumTitle} (${photos.length} selected)`, track, exportFormat === 'zip', albumTitle)
        exitAlbumSelect()
      },
    })
  }

  const handleDownloadPhotostreamSelected = (): void => {
    const selected = photostreamFilteredPhotos.filter((p) => photostreamSelectedIds.has(p.id))
    if (selected.length === 0) return
    const photoCount = selected.filter(p => p.media !== 'video').length
    const videoCount = selected.filter(p => p.media === 'video').length
    const photos = selected.map(p => ({ id: p.id, title: p.title }))
    setPendingDownload({
      title: 'Selected from Photostream',
      photoCount,
      videoCount,
      onConfirm: (track, exportFormat) => {
        window.flickrAPI.startSelectedBatch(photos, `Photostream (${photos.length} selected)`, track, exportFormat === 'zip', '')
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

  // A tag clicked in the photo detail panel: inside an album it filters that album, otherwise it
  // searches the whole photostream. Commas would split one tag into two in Flickr's search.
  const showPhotostreamTag = useCallback((tag: string): void => {
    exitPhotostreamSelect()
    setTagSearchRequest({ tags: [tag.replace(/,/g, ' ').trim()], mode: 'any', nonce: Date.now() })
    setPhotoDetailIndex(null)
    setView('photostream')
  }, [exitPhotostreamSelect])

  const handleDetailTagClick = useCallback((tag: string): void => {
    if (photoDetailSource === 'album' && selectedAlbum) {
      setAlbumTagRequest({ tag: tag.replace(/,/g, ' ').trim(), nonce: Date.now() })
      setPhotoDetailIndex(null)
      setView(photoDetailReturnView)
    } else {
      showPhotostreamTag(tag)
    }
  }, [photoDetailSource, selectedAlbum, photoDetailReturnView, showPhotostreamTag])

  const handleAlbumSelect = (album: FlickrAlbum): void => {
    setSelectedAlbum(album)
    setAlbumDetailOrigin('albums')
    setView('album-detail')
  }

  const handleSetSelect = (set: FlickrSet): void => {
    setLoadedAlbumPhotos([])
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
    } else if (albumDetailOrigin === 'cleanup') {
      setCleanupVisited(true); setView('cleanup')   // opened from the Health Check dashboard: back goes there
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
        <div style={styles.headerLeft}>
          <span style={styles.wordmark}>
            <span style={{ color: 'var(--ff-blue)' }}>Flickr</span><span style={{ color: 'var(--ff-pink)' }}>Fetch</span>
          </span>
          <div style={styles.headerDivider} />
          <div style={styles.modeTabs}>
            <button
              style={{ ...styles.modeTab, ...(appMode === 'you' ? styles.modeTabActive : {}) }}
              onClick={() => setAppMode('you')}
            >My Flickr</button>
            <button
              style={{ ...styles.modeTab, ...(appMode === 'discover' ? styles.modeTabActive : {}) }}
              onClick={() => setAppMode('discover')}
            >Discover</button>
          </div>
        </div>
        <div style={styles.headerActions}>
          <IconBtn label="History" onClick={() => setShowHistory(true)} showLabel={!compactHeader}>
            <Icon name="clock" size={18} />
          </IconBtn>
          <IconBtn label="Settings" onClick={() => openSettings()} badge={!!updateVersion} showLabel={!compactHeader}>
            <Icon name="cog" size={18} />
          </IconBtn>
          <div style={{ position: 'relative' }}>
            <button style={styles.avatarBtn} onClick={() => setShowAvatarPopover(o => !o)}>
              <img
                src={user.avatarUrl}
                alt={displayName}
                style={styles.avatarBtnImg}
                onError={(e) => { if (!e.currentTarget.src.endsWith('buddyicon.gif')) e.currentTarget.src = 'https://www.flickr.com/images/buddyicon.gif' }}
              />
              <svg width="9" height="6" viewBox="0 0 9 6" fill="none" style={{ flexShrink: 0 }}>
                <path d="M1 1l3.5 3.5L8 1" stroke="var(--ff-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showAvatarPopover && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--ff-z-menu) - 1)' }} onClick={() => setShowAvatarPopover(false)} />
                <div style={styles.avatarPopover}>
                  <div style={styles.avatarPopoverUser}>
                    <img
                      src={user.avatarUrl}
                      alt={displayName}
                      style={styles.avatarPopoverImg}
                      onError={(e) => { if (!e.currentTarget.src.endsWith('buddyicon.gif')) e.currentTarget.src = 'https://www.flickr.com/images/buddyicon.gif' }}
                    />
                    <div>
                      <div style={styles.avatarPopoverName}>
                        {displayName}
                        {user.isPro && <span style={styles.proBadge}>PRO</span>}
                      </div>
                      <div style={styles.avatarPopoverHandle}>@{user.username}</div>
                      {user.memberSince !== undefined && <div style={styles.avatarPopoverSince}>Flickring since {user.memberSince}</div>}
                    </div>
                  </div>
                  <div style={styles.avatarPopoverDivider} />
                  <button
                    style={styles.avatarPopoverItem}
                    onClick={() => { setShowAvatarPopover(false); window.flickrAPI.openAbout() }}
                  >About FlickrFetch</button>
                  <button
                    style={styles.avatarPopoverSignOut}
                    onClick={() => { setShowAvatarPopover(false); setShowSignOutConfirm(true) }}
                  >Sign out</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {appMode === 'you' && <FreeAccountBanner kind="mine" isPro={user.isPro} />}
      {appMode === 'you' && <div style={styles.tabBar}>
        <div style={styles.tabGroup}>
          <button
            style={{ ...tabStyle, ...(view === 'photostream' ? styles.tabActive : {}) }}
            onClick={() => setView('photostream')}
          >
            Photostream
          </button>
          <button
            style={{ ...tabStyle, ...(view === 'albums' || view === 'album-detail' && albumDetailOrigin === 'albums' ? styles.tabActive : {}) }}
            onClick={() => { setAlbumsVisited(true); setSelectedAlbum(null); setView('albums') }}
          >
            Albums
          </button>
          <button
            style={{ ...tabStyle, ...(view === 'collections' || view === 'collection-detail' || view === 'album-detail' && albumDetailOrigin === 'collections' ? styles.tabActive : {}) }}
            onClick={() => { setCollectionsVisited(true); setCollectionPath([]); setSelectedAlbum(null); setView('collections') }}
          >
            Collections
          </button>
          <button
            style={{ ...tabStyle, ...(view === 'tags' ? styles.tabActive : {}) }}
            onClick={() => { setTagsVisited(true); setView('tags') }}
          >
            Tags
          </button>
          <button
            style={{ ...tabStyle, ...(view === 'timeline' ? styles.tabActive : {}) }}
            onClick={() => { setTimelineVisited(true); setView('timeline') }}
          >
            Timeline
          </button>
          <button
            style={{ ...tabStyle, ...(view === 'onthisday' ? styles.tabActive : {}) }}
            onClick={() => { setOnThisDayVisited(true); setView('onthisday') }}
          >
            On This Day
          </button>
          <button
            style={{ ...tabStyle, ...(view === 'map' ? styles.tabActive : {}) }}
            onClick={() => { setMapVisited(true); setView('map') }}
          >
            Map
          </button>
          <span style={styles.tabDivider} aria-hidden="true" />   {/* views on the left, tools on the right */}
          <button
            style={{ ...tabStyle, ...(view === 'cleanup' || view === 'album-detail' && albumDetailOrigin === 'cleanup' ? styles.tabActive : {}) }}
            onClick={() => { setCleanupVisited(true); setView('cleanup') }}
          >
            Health Check
          </button>
        </div>
      </div>}
      {appMode === 'you' && view !== 'onthisday' && view !== 'photo-detail' && view !== 'map' && !(batchProgress && batchProgress.status !== 'error' || completedBatches.length > 0) && <OnThisDayCard refreshKey={dataKey} onOpen={() => { setOnThisDayVisited(true); setView('onthisday') }} />}
      {appMode === 'you' && view === 'photostream' && !photostreamSelectMode && (
        <div style={{ padding: '8px 16px 0' }}>
          <ScreenTop
            context={<span style={{ ...headingDialog }}>Photostream</span>}
            actions={<>
              {photostreamFiltersActive ? (
              <button
                style={{ ...styles.selectButton, borderColor: 'var(--ff-pink)', color: 'var(--ff-pink-action)' }}
                disabled={photostreamFilteredPhotos.length === 0}
                title={"Filters are on, so only the photos shown below are downloaded.\n\nClear the filters to download the whole photostream."}
                onClick={() => startShownDownload(photostreamFilteredPhotos, 'Photostream', 'Photostream', true)}
              >
                {`Download ${photostreamFilteredPhotos.length.toLocaleString()} shown`}
              </button>
            ) : (
              <SmartDownloadButton
                label="Download all"
                onDownload={(mode) => {
                  const smartMode = mode === 'all' ? undefined : mode
                  const photoCount = loadedPhotostreamPhotos.filter(p => p.media !== 'video').length
                  const videoCount = loadedPhotostreamPhotos.filter(p => p.media === 'video').length
                  const modeTitle = mode === 'updated' ? 'Photostream: updated photos' : mode === 'never-downloaded' ? 'Photostream: never downloaded' : 'Photostream'
                  setPendingDownload({
                    title: modeTitle,
                    photoCount,
                    videoCount,
                    note: `${(photoCount + videoCount).toLocaleString()} loaded — batch downloads your full photostream`,
                    onConfirm: (track, exportFormat) => {
                      window.flickrAPI.startPhotostreamBatch('Photostream', track, smartMode, undefined, photostreamSort, exportFormat === 'zip')
                    },
                  })
                }}
              />
            )}
              <MoreMenu items={[
                { key: 'select', label: 'Select photos', onClick: () => setPhotostreamSelectMode(true) },
                { key: 'refresh', label: 'Refresh photostream', onClick: () => { exitPhotostreamSelect(); setLoadedPhotostreamPhotos([]); setPhotostreamRefreshKey(k => k + 1) } }
              ]} />
            </>}
          />
        </div>
      )}

      {appMode === 'you' && view === 'album-detail' && selectedAlbum && (
        <div style={styles.albumHeader}>
          <button style={styles.backButton} onClick={handleBackFromAlbumDetail}>
            <Icon name="arrowLeft" /> {albumDetailOrigin === 'collections' ? (currentCollection?.title ?? 'Collection') : albumDetailOrigin === 'cleanup' ? 'Health Check' : 'Albums'}
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
              {albumExtraFilters ? (
                <button
                  style={{ ...styles.selectButton, borderColor: 'var(--ff-pink)', color: 'var(--ff-pink-action)' }}
                  disabled={albumFilteredPhotos.length === 0}
                  title={"Filters are on, so only the photos shown below are downloaded.\n\nClear the filters to download the whole album."}
                  onClick={() => startShownDownload(albumFilteredPhotos, `"${selectedAlbum.title}"`, selectedAlbum.title)}
                >
                  {`Download ${albumFilteredPhotos.length.toLocaleString()} shown`}
                </button>
              ) : (
                <SmartDownloadButton
                  label="Download album"
                  onDownload={(mode) => {
                    const mt = albumMediaFilter !== 'all' ? albumMediaFilter : undefined
                    const pf = albumPrivacyFilter !== 'all' ? albumPrivacyFilter : undefined
                    const photoCount = mt === 'video' ? 0 : selectedAlbum.photoCount
                    const videoCount = mt === 'photo' ? 0 : selectedAlbum.videoCount
                    const smartMode = mode === 'all' ? undefined : mode
                    const modeTitle = mode === 'updated' ? `Album "${selectedAlbum.title}": updated photos` : mode === 'never-downloaded' ? `Album "${selectedAlbum.title}": never downloaded` : `Album "${selectedAlbum.title}"`
                    setPendingDownload({
                      title: modeTitle,
                      photoCount,
                      videoCount,
                      onConfirm: async (track, exportFormat) => {
                        const zipMode = exportFormat === 'zip'
                        const result = await window.flickrAPI.startBatch(selectedAlbum.id, selectedAlbum.title, selectedAlbum.photoCount, selectedAlbum.videoCount, false, mt, pf, track, smartMode, zipMode)
                        if (result.alreadyQueued) {
                          const ok = await window.flickrAPI.confirm(
                            `"${selectedAlbum.title}" is already downloading or queued.`,
                            'Do you want to add it to the queue again?',
                            'Queue again'
                          )
                          if (ok) window.flickrAPI.startBatch(selectedAlbum.id, selectedAlbum.title, selectedAlbum.photoCount, selectedAlbum.videoCount, true, mt, pf, track, smartMode, zipMode)
                        }
                      },
                    })
                  }}
                />
              )}
              <button style={styles.selectButton} onClick={() => setAlbumSelectMode(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="2" y="3" width="7" height="7" rx="1"/><rect x="13" y="3" width="7" height="7" rx="1"/><rect x="2" y="14" width="7" height="7" rx="1"/><path d="M14 17l2 2 4-4"/>
                </svg>
                Select Photos
              </button>
              <div style={{ position: 'relative' }}>
                <button style={styles.overflowBtn} onClick={() => setShowAlbumOverflow(o => !o)} title="More actions">⋯</button>
                {showAlbumOverflow && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--ff-z-menu) - 1)' }} onClick={() => setShowAlbumOverflow(false)} />
                    <div style={styles.overflowMenu}>
                      <button
                        style={styles.overflowMenuItemDestructive}
                        onClick={() => { setShowAlbumOverflow(false); setResetError(null); setShowResetConfirm(true) }}
                      >
                        Reset download records
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <button style={styles.selectButton} onClick={handleSelectAll}>Select all</button>
              {albumSelectedIds.size > 0 && (
                <button style={styles.selectButton} onClick={() => setAlbumSelectedIds(new Set())}>Clear selection</button>
              )}
              {albumSelectedIds.size > 0 && <BatchEditButton inline style={styles.selectButton} getIds={async () => [...albumSelectedIds]} />}
              <button
                style={{
                  ...styles.downloadAllButton,
                  ...(albumSelectedIds.size === 0 ? styles.downloadAllButtonDisabled : {})
                }}
                disabled={albumSelectedIds.size === 0}
                onClick={handleDownloadAlbumSelected}
              >
                <Icon name="arrowDown" /> Download selected ({albumSelectedIds.size})
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
            <button style={styles.selectButton} onClick={() => setPhotostreamSelectedIds(new Set())}>Clear selection</button>
          )}
          <div style={{ flex: 1 }} />
          {photostreamSelectedIds.size > 0 && <BatchEditButton inline style={styles.selectButton} getIds={async () => [...photostreamSelectedIds]} />}
          <button
            style={{ ...styles.downloadAllButton, ...(photostreamSelectedIds.size === 0 ? styles.downloadAllButtonDisabled : {}) }}
            disabled={photostreamSelectedIds.size === 0}
            onClick={handleDownloadPhotostreamSelected}
          >
            <Icon name="arrowDown" /> Download selected ({photostreamSelectedIds.size})
          </button>
          <button style={styles.doneButton} onClick={exitPhotostreamSelect}>Cancel</button>
        </div>
      )}

      {appMode === 'you' && view === 'collection-detail' && currentCollection && (
        <div style={styles.albumHeader}>
          <button style={styles.backButton} onClick={handleBackInCollections}>
            <Icon name="arrowLeft" /> {collectionPath.length > 1 ? collectionPath[collectionPath.length - 2].title : 'Collections'}
          </button>
          <span style={styles.albumTitle}>{currentCollection.title}</span>
          <div style={{ flex: 1 }} />
          <button
            style={styles.downloadAllBtn}
            onClick={() => setCollectionToDownload(currentCollection)}
          >
            <Icon name="arrowDown" /> Download all albums
          </button>
        </div>
      )}
      {appMode === 'you' && view === 'collection-detail' && collectionNote && (
        <p style={{ ...styles.confirmBody, margin: '8px 24px 0' }}>{collectionNote} <button style={styles.confirmCancel} onClick={() => setCollectionNote(null)}>Dismiss</button></p>
      )}

      <main ref={discoverMainRef} style={{ ...styles.main, display: appMode === 'discover' ? 'flex' : 'none', flexDirection: 'column' }}>
        <DiscoverPage isActive={appMode === 'discover'} isPro={user.isPro} />
      </main>

      <main ref={youMainRef} style={{ ...styles.main, ...(appMode === 'discover' ? { display: 'none' } : {}) }}>
        <ErrorBoundary scope="tab" resetKey={view}>
        <div style={view === 'photostream' ? styles.tabPane : styles.tabPaneHidden}>
          <PhotoGrid
            key={photostreamRefreshKey}
            active={appMode === 'you' && view === 'photostream'}
            onPhotoSelect={handlePhotostreamPhotoSelect}
            selectMode={photostreamSelectMode}
            selectedIds={photostreamSelectedIds}
            onToggleSelect={handlePhotostreamToggleSelect}
            onPhotosLoaded={setLoadedPhotostreamPhotos}
            onPageInfo={(page, pages) => setPhotostreamPageInfo({ page, pages })}
            onSortChange={sort => setPhotostreamSort(sort)}
            onFilteredPhotosChange={setPhotostreamFilteredPhotos}
            onFiltersActiveChange={setPhotostreamFiltersActive}
            tagSearchRequest={tagSearchRequest}
            onBackToTags={() => { if (tagBackView === 'cleanup') setCleanupVisited(true); else setTagsVisited(true); setView(tagBackView) }}
            backToTagsLabel={tagBackView === 'cleanup' ? 'Health Check' : 'Tags'}
            handledTagRequest={handledTagSearch}
            dateSearchRequest={dateSearchRequest}
            handledDateRequest={handledDateSearch}
            onBackToDates={() => { if (dateBackView === 'timeline') setTimelineVisited(true); else if (dateBackView === 'cleanup') setCleanupVisited(true); else setOnThisDayVisited(true); setView(dateBackView) }}
          />
        </div>
        {onThisDayVisited && (
          <div style={view === 'onthisday' ? styles.tabPane : styles.tabPaneHidden}>
            <OnThisDayPanel
              refreshKey={dataKey}
              jumpTo={otdJump}
              onOpenRange={(from, to, opts) => openDateRange(from, to, opts, 'onthisday')}
              onDownload={startDateDownload}
              onFullRescan={() => { setCleanupVisited(true); setView('cleanup') }}
            />
          </div>
        )}
        {timelineVisited && (
          <div style={view === 'timeline' ? styles.tabPane : styles.tabPaneHidden}>
            <TimelinePanel
              active={view === 'timeline' && !showSettings && !showHistory && !aboutVersion && !pendingDownload && !showResetConfirm && !showSignOutConfirm}
              refreshKey={dataKey}
              onOpenRange={(from, to, opts) => openDateRange(from, to, opts, 'timeline')}
              onDownload={startDateDownload}
              onOpenDay={(month, day, year) => { setOtdJump({ month, day, year, nonce: Date.now() }); setOnThisDayVisited(true); setView('onthisday') }}
              onFullRescan={() => { setCleanupVisited(true); setView('cleanup') }}
            />
          </div>
        )}
        {tagsVisited && (
          <div style={view === 'tags' ? styles.tabPane : styles.tabPaneHidden}>
            <TagsPanel
              active={view === 'tags'}
              onViewPhotos={(tags, mode) => {
                exitPhotostreamSelect()
                setTagBackView('tags')
                setTagSearchRequest({ tags: tags.map(t => t.replace(/,/g, ' ').trim()), mode, nonce: Date.now() })
                setView('photostream')
              }}
              onOpenCleanup={() => { setCleanupVisited(true); setView('cleanup') }}
            />
          </div>
        )}
        {mapVisited && (
          <div style={view === 'map' ? styles.tabPane : styles.tabPaneHidden}>
            <MapPanel
              active={view === 'map'}
              refreshKey={dataKey}
              settingsKey={settingsKey}
              target={mapTarget}
              backTo={mapBack ? { label: 'Health Check', onClick: () => { setCleanupVisited(true); setView('cleanup') } } : null}
              onDownload={startDateDownload}
              onFullRescan={() => { setCleanupVisited(true); setView('cleanup') }}
            />
          </div>
        )}
        {cleanupVisited && (
          <div style={view === 'cleanup' ? styles.tabPane : styles.tabPaneHidden}>
            <CleanupPanel
              settingsKey={settingsKey}
              onOpenSettings={() => openSettings('health')}
              onShowOnMap={showOnMap}
              onOpenRange={(from, to, opts) => openDateRange(from, to, opts ?? {}, 'cleanup')}
              onOpenAlbum={(id, title, items) => { exitPhotostreamSelect(); setLoadedAlbumPhotos([]); setSelectedAlbum({ id, title, description: '', photoCount: items, videoCount: 0, coverPhotoUrl: '' }); setAlbumDetailOrigin('cleanup'); setAlbumsVisited(true); setView('album-detail') }}
              onGoTab={v => { if (v === 'albums') { setAlbumsVisited(true); setSelectedAlbum(null); setView('albums') } else { setTagsVisited(true); setView('tags') } }}
              backupRequest={backupRequest}
              onDownload={startDateDownload}
              onViewPhotos={(tags, mode) => {
                exitPhotostreamSelect()
                setTagBackView('cleanup')
                setTagSearchRequest({ tags: tags.map(t => t.replace(/,/g, ' ').trim()), mode, nonce: Date.now() })
                setView('photostream')
              }}
            />
          </div>
        )}
        {albumsVisited && (
          <div style={view === 'albums' ? styles.tabPane : styles.tabPaneHidden}>
            <AlbumList onAlbumSelect={handleAlbumSelect} active={appMode === 'you' && view === 'albums'} />
          </div>
        )}
        {collectionsVisited && (
          <div style={view === 'collections' ? styles.tabPane : styles.tabPaneHidden}>
            <CollectionList onCollectionSelect={handleCollectionSelect} active={appMode === 'you' && view === 'collections'} />
          </div>
        )}
        {currentCollection && (
          <div style={view === 'collection-detail' ? styles.tabPane : styles.tabPaneHidden}>
            <CollectionDetail
              collection={currentCollection}
              onCollectionSelect={handleCollectionSelect}
              onSetSelect={handleSetSelect}
            />
          </div>
        )}
        {selectedAlbum && (
          <div style={view === 'album-detail' ? styles.tabPane : styles.tabPaneHidden}>
            <AlbumPhotoGrid
              albumId={selectedAlbum.id}
              findActive={appMode === 'you' && view === 'album-detail'}
              onPhotoSelect={handleAlbumPhotoSelect}
              selectMode={albumSelectMode}
              selectedIds={albumSelectedIds}
              onToggleSelect={handleAlbumToggleSelect}
              onPhotosLoaded={setLoadedAlbumPhotos}
              onPageInfo={(page, pages) => setAlbumPageInfo({ page, pages })}
              onFilteredPhotosChange={setAlbumFilteredPhotos}
              onExtraFiltersChange={setAlbumExtraFilters}
              onMediaFilterChange={setAlbumMediaFilter}
              onPrivacyFilterChange={setAlbumPrivacyFilter}
              tagFilterRequest={albumTagRequest}
              onSearchWholePhotostream={showPhotostreamTag}
              handledTagRequest={handledAlbumTag}
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
              onTagClick={handleDetailTagClick}
            />
          </div>
        )}
        </ErrorBoundary>
      </main>

      {showResetConfirm && selectedAlbum && (
        <Dialog label="Reset download records" size="small" onClose={() => setShowResetConfirm(false)} cardStyle={{ padding: 24 }}>
            <p style={styles.confirmTitle}>Reset download records?</p>
            <p style={styles.confirmBody}>
              This removes the download record for all {((selectedAlbum.photoCount ?? 0) + (selectedAlbum.videoCount ?? 0)).toLocaleString()} items in &ldquo;{selectedAlbum.title}&rdquo;.<br /><br />Smart Download will then treat them as never downloaded.<br /><br />Your downloaded files are not touched.
            </p>
            {resetError && <p role="alert" style={{ ...styles.confirmBody, color: 'var(--ff-error)', marginTop: -8 }}>{resetError}</p>}
            <div style={styles.confirmActions}>
              <button style={styles.confirmCancel} onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button style={styles.confirmDestructive} onClick={handleResetRecords}>Reset records</button>
            </div>
</Dialog>
      )}
      {collectionToDownload && (() => {
        const albums = collectionAlbums(collectionToDownload)
        const col = collectionToDownload
        const start = (): void => {
          setCollectionToDownload(null)
          window.flickrAPI.startCollectionBatch(col)
            .then(r => setCollectionNote(r.skipped > 0 ? `${r.queued} album${r.queued !== 1 ? 's' : ''} queued. ${r.skipped} already waiting or downloading, so not added again.` : null))
            .catch(() => setCollectionNote('Couldn\u2019t start the download. Try again.'))
        }
        return (
          <Dialog label="Download all albums" size="small" onClose={() => setCollectionToDownload(null)} cardStyle={{ padding: 24 }}>
            <p style={styles.confirmTitle}>Download all albums in &ldquo;{col.title}&rdquo;?</p>
            <p style={styles.confirmBody}>
              {albums.length === 0
                ? 'There are no albums in this collection.'
                : <>{albums.length.toLocaleString()} album{albums.length !== 1 ? 's' : ''}, including any in sub-collections, will be added to the download queue. Each saves into its own folder, inside a folder named for the collection.<br /><br />An album that is already waiting or downloading is not added again.</>}
            </p>
            <div style={styles.confirmActions}>
              <button style={styles.confirmCancel} onClick={() => setCollectionToDownload(null)}>Cancel</button>
              {albums.length > 0 && <button style={styles.downloadAllBtn} onClick={start}>Download {albums.length.toLocaleString()} album{albums.length !== 1 ? 's' : ''}</button>}
            </div>
          </Dialog>
        )
      })()}
      {showSignOutConfirm && (
        <Dialog label="Sign out of Flickr" size="small" onClose={() => setShowSignOutConfirm(false)} cardStyle={{ padding: 24 }}>
            <p style={styles.confirmTitle}>Sign out of Flickr?</p>
            <p style={styles.confirmBody}>You&rsquo;ll need to reconnect your Flickr account to use FlickrFetch.<br /><br />Your downloaded photos and your download history stay on this computer.</p>
            <div style={styles.confirmActions}>
              <button style={styles.confirmCancel} onClick={() => setShowSignOutConfirm(false)}>Cancel</button>
              <button style={styles.confirmDestructive} onClick={() => { setShowSignOutConfirm(false); onSignOut() }}>Sign out</button>
            </div>
</Dialog>
      )}
      {showSettings && <SettingsModal initialTab={settingsTab} onClose={() => { setShowSettings(false); setSettingsKey(k => k + 1) }} updateVersion={updateVersion ?? undefined} />}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
      {aboutVersion && <AboutModal version={aboutVersion} onClose={() => setAboutVersion(null)} />}
      {pendingDownload && (
        <DownloadConfirmModal
          pending={pendingDownload}
          settingsKey={settingsKey}
          isPro={user.isPro}
          onCancel={() => setPendingDownload(null)}
          onOpenSettings={() => openSettings()}
        />
      )}

      {(batchProgress && batchProgress.status !== 'error' || completedBatches.length > 0) && (
        <DownloadQueueBar
          progress={batchProgress && batchProgress.status !== 'error' ? batchProgress : null}
          completedBatches={completedBatches}
          onDismiss={handleBatchDismiss}
          onStackedDismiss={handleStackedDismiss}
          onDismissAll={handleDismissAll}
          onShowSmaller={showSmaller}
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
    backgroundColor: 'var(--ff-grey-100)'
  },
  header: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    backgroundColor: 'var(--ff-cream)',
    borderBottom: '1px solid var(--ff-border)',
    minHeight: '52px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'stretch',
  },
  wordmark: {
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '-0.02em',
    lineHeight: 1,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
  },
  headerDivider: {
    width: '1px',
    backgroundColor: 'var(--ff-border)',
    margin: '8px 0',
  },
  modeTabs: {
    display: 'flex',
    alignItems: 'stretch',
  },
  modeTab: {
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    padding: '0 16px',
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--ff-text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap' as const,
    letterSpacing: '-0.01em',
  },
  modeTabActive: {
    color: 'var(--ff-blue)',
    borderBottom: '3px solid var(--ff-blue)',
  },
  proBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--ff-pink)',
    backgroundColor: 'color-mix(in srgb, var(--ff-pink) 10%, transparent)',
    border: '1px solid color-mix(in srgb, var(--ff-pink) 30%, transparent)',
    borderRadius: '4px',
    padding: '0px 4px',
    letterSpacing: '0.06em',
    lineHeight: '1.4'
  },
  avatarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    borderRadius: '50px',
    overflow: 'visible',
    cursor: 'pointer',
    border: '1px solid var(--ff-line-strong)',
    background: 'none',
    padding: '2px 8px 2px 2px',
    flexShrink: 0,
  },
  avatarBtnImg: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    display: 'block',
    flexShrink: 0,
  },
  avatarPopover: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    right: 0,
    backgroundColor: 'var(--ff-surface)',
    border: '1px solid var(--ff-line-strong)',
    borderRadius: '8px',
    boxShadow: '0 4px 20px var(--ff-shadow-mid)',
    zIndex: 'var(--ff-z-menu)',
    minWidth: '220px',
    padding: '12px',
  },
  avatarPopoverUser: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  avatarPopoverImg: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    flexShrink: 0,
    border: '1.5px solid var(--ff-line-strong)',
  },
  avatarPopoverName: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--ff-text)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '2px',
  },
  avatarPopoverHandle: {
    fontSize: '12px',
    color: 'var(--ff-text-secondary)',
    marginBottom: '2px',
  },
  avatarPopoverSince: {
    fontSize: '11px',
    color: 'var(--ff-text-secondary)',
  },
  avatarPopoverDivider: {
    height: '1px',
    backgroundColor: 'var(--ff-grey-100)',
    margin: '8px 0',
  },
  avatarPopoverItem: {
    display: 'block',
    background: 'none',
    border: 'none',
    padding: '0 0 8px',
    fontSize: '13px',
    color: 'var(--ff-text)',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  avatarPopoverSignOut: {
    background: 'none',
    border: 'none',
    padding: '0',
    fontSize: '13px',
    color: 'var(--ff-text-secondary)',
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted' as const,
  },
  tabBar: {
    display: 'flex',
    flexWrap: 'wrap',           // the buttons on the right drop under the tabs in a narrow window instead of running off the edge
    alignItems: 'center',
    justifyContent: 'space-between',
    rowGap: '2px',
    borderBottom: '1px solid var(--ff-border)',
    backgroundColor: 'var(--ff-surface)',
    paddingLeft: '24px',
    paddingRight: '16px'
  },
  tabGroup: {
    display: 'flex',
    flexWrap: 'wrap',           // if the tabs do not fit in a narrow window, whole tabs move to a second line (never clipped, never a label folded in two)
    gap: '0',
    minWidth: 0
  },
  tabDivider: {
    width: '1px',
    height: '18px',
    background: 'var(--ff-border)',
    margin: '0 8px',
    alignSelf: 'center',
    flexShrink: 0
  },
  tab: {
    ...tabMark,
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '400',
    color: 'var(--ff-text-secondary)',
    cursor: 'pointer',
    marginBottom: '0px',
    whiteSpace: 'nowrap',       // "On This Day" and "Health Check" used to fold onto two or three lines in a narrow window
    flexShrink: 0
  },
  tabActive: {
    color: 'var(--ff-pink)',
    borderBottom: '2px solid var(--ff-pink)'
  },
  albumHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 24px',
    backgroundColor: 'var(--ff-surface)',
    borderBottom: '1px solid var(--ff-border)'
  },
  backButton: { ...linkBtn, fontSize: '13px', flexShrink: 0 },
  albumTitle: { ...headingCard },
  albumCount: {
    fontSize: '13px',
    color: 'var(--ff-text-secondary)'
  },
  downloadAllBtn: { ...primaryBtn, flexShrink: 0 },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 16px',
    flexShrink: 0,              // the account button must never be pushed off the edge
  },
  iconButton: {
    backgroundColor: 'transparent',
    border: '1px solid var(--ff-line-strong)',
    borderRadius: '6px',
    padding: '8px',
    color: 'var(--ff-text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonLabeled: {
    gap: '4px',
    padding: '6px 8px',
  },
  iconButtonLabel: {
    fontSize: '12px',
    fontWeight: '400',
    color: 'var(--ff-text-secondary)',
    letterSpacing: '-0.01em',
    lineHeight: 1,
  },
  updateBadge: {
    position: 'absolute' as const,
    top: '1px', right: '1px',
    width: '8px', height: '8px', borderRadius: '50%',
    backgroundColor: 'var(--ff-pink)', border: '2px solid var(--ff-white)',
    pointerEvents: 'none' as const,
  },
  iconTooltip: {
    position: 'absolute' as const,
    top: 'calc(100% + 6px)',
    right: 0,
    backgroundColor: 'var(--ff-text)',
    color: 'var(--ff-white)',
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '6px',
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
    zIndex: 'var(--ff-z-hover)',
  },
  downloadAllButton: { ...primaryBtn, flexShrink: 0 },
  downloadAllButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  refreshButton: {
    background: 'none',
    border: '1px solid var(--ff-line-strong)',
    borderRadius: '6px',
    padding: '4px 8px',
    color: 'var(--ff-text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  selectButton: { ...quietBtn, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' },
  doneButton: {
    background: 'none',
    border: 'none',
    padding: '4px 8px',
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--ff-text-secondary)',
    cursor: 'pointer',
    flexShrink: 0
  },
  photostreamToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 24px',
    backgroundColor: 'var(--ff-surface)',
    borderBottom: '1px solid var(--ff-border)',
    minHeight: '40px'
  },
  selectedCount: {
    fontSize: '13px',
    color: 'var(--ff-text-secondary)'
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
  overflowBtn: {
    background: 'none', border: '1px solid var(--ff-line-strong)', borderRadius: '6px',
    padding: '4px 8px', fontSize: '16px', color: 'var(--ff-text-secondary)', cursor: 'pointer',
    flexShrink: 0, lineHeight: 1,
  },
  overflowMenu: {
    position: 'absolute' as const, top: 'calc(100% + 4px)', right: 0,
    background: 'var(--ff-surface)', border: '1px solid var(--ff-line-strong)', borderRadius: '8px',
    boxShadow: '0 4px 16px var(--ff-shadow-soft)', zIndex: 'var(--ff-z-menu)', minWidth: '190px', padding: '4px',
  },
  overflowMenuItemDestructive: {
    display: 'block', width: '100%', textAlign: 'left' as const, background: 'none', border: 'none',
    padding: '8px 12px', fontSize: '13px', color: 'var(--ff-error)', cursor: 'pointer', borderRadius: '6px',
  },
  confirmTitle: { ...headingDialog, margin: '0 0 8px' },
  confirmBody: { fontSize: '13px', color: 'var(--ff-text-secondary)', lineHeight: '1.5', margin: '0 0 16px' },
  confirmActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' as const },
  confirmCancel: { ...quietBtn },
  confirmDestructive: {
    background: 'var(--ff-error)', border: 'none', borderRadius: '8px',
    padding: '8px 16px', fontSize: '14px', fontWeight: '700' as const, color: 'var(--ff-white)', cursor: 'pointer',
  },
}
