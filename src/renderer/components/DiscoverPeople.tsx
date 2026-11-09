import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { FlickrPhoto, FlickrAlbum, FlickrCollection, DiscoverUser, DiscoverContact, PhotoSearchParams, SearchOperator, DateRangeField, TagMode } from '../../shared/types'
import PhotoDetail from './PhotoDetail'
import { AttributionNotice, DiscoverTile, DiscoverSelectBar } from './DiscoverExplore'
import SmartDownloadButton from './SmartDownloadButton'
import { GridIcon, ListIcon, GRID_COLUMNS, sharedStyles as ss, type MediaFilter, type GridSize, type AlbumViewMode, type PhotoViewMode, type DownloadFilter, type DateMode, getPresetDates, formatDateChip, Chip, PhotoListRow, DownloadFilterSelect, loadAlbumViewMode, saveAlbumViewMode, loadPhotoViewMode, savePhotoViewMode } from './PhotoGridShared'

const ALBUM_COLUMNS: Record<GridSize, string> = {
  small: 'repeat(auto-fill, minmax(130px, 1fr))',
  medium: 'repeat(auto-fill, minmax(180px, 1fr))',
  large: 'repeat(auto-fill, minmax(240px, 1fr))',
}

type PeopleView = 'home' | 'user-photos' | 'user-albums' | 'album-photos' | 'photo-detail'
type UserTab = 'photos' | 'albums' | 'collections'

export default function DiscoverPeople({ isActive }: { isActive: boolean }): React.JSX.Element {
  const [view, setView] = useState<PeopleView>('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [foundUser, setFoundUser] = useState<DiscoverUser | null>(null)
  const [contacts, setContacts] = useState<DiscoverContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [userTab, setUserTab] = useState<UserTab>('photos')

  // Photos state
  const [userPhotos, setUserPhotos] = useState<FlickrPhoto[]>([])
  const [photosPage, setPhotosPage] = useState(1)
  const [photosPages, setPhotosPages] = useState(1)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photosLoadingMore, setPhotosLoadingMore] = useState(false)
  const [photosError, setPhotosError] = useState<string | null>(null)

  // Albums state
  const [userAlbums, setUserAlbums] = useState<FlickrAlbum[]>([])
  const [albumsLoading, setAlbumsLoading] = useState(false)
  const [albumsError, setAlbumsError] = useState<string | null>(null)
  const [activeAlbum, setActiveAlbum] = useState<FlickrAlbum | null>(null)

  // Album photos state
  const [albumPhotos, setAlbumPhotos] = useState<FlickrPhoto[]>([])
  const [albumPhotosPage, setAlbumPhotosPage] = useState(1)
  const [albumPhotosPages, setAlbumPhotosPages] = useState(1)
  const [albumPhotosLoading, setAlbumPhotosLoading] = useState(false)
  const [albumPhotosLoadingMore, setAlbumPhotosLoadingMore] = useState(false)
  const [albumPhotosError, setAlbumPhotosError] = useState<string | null>(null)

  // Detail view
  const [detailIndex, setDetailIndex] = useState<number | null>(null)

  // Collections state
  const [userCollections, setUserCollections] = useState<FlickrCollection[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const [collectionsError, setCollectionsError] = useState<string | null>(null)
  const [collectionsLoaded, setCollectionsLoaded] = useState(false)
  const [activeDiscoverCollection, setActiveDiscoverCollection] = useState<FlickrCollection | null>(null)
  const [collectionNavStack, setCollectionNavStack] = useState<FlickrCollection[]>([])

  // Multi-select for user photos
  const [userSelectMode, setUserSelectMode] = useState(false)
  const [userSelectedIds, setUserSelectedIds] = useState<Set<string>>(new Set())
  const [userDownloading, setUserDownloading] = useState(false)

  // Multi-select for album photos
  const [albumSelectMode, setAlbumSelectMode] = useState(false)
  const [albumSelectedIds, setAlbumSelectedIds] = useState<Set<string>>(new Set())
  const [albumDownloading, setAlbumDownloading] = useState(false)

  // Toolbar state (user photos view)
  const [userPhotosViewMode, setUserPhotosViewMode] = useState<PhotoViewMode>(loadPhotoViewMode)
  const [userDownloadFilter, setUserDownloadFilter] = useState<DownloadFilter>('all')
  const [userDownloadRecords, setUserDownloadRecords] = useState<Record<string, true>>({})
  const [sort, setSort] = useState('date-posted-desc')
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [searchOperator, setSearchOperator] = useState<string>('contains')
  const [photoSearchInput, setPhotoSearchInput] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tagMode, setTagMode] = useState<TagMode>('any')
  const [dateField, setDateField] = useState<DateRangeField>('taken')
  const [dateMode, setDateMode] = useState<DateMode>('all')
  const [dateCustomMin, setDateCustomMin] = useState('')
  const [dateCustomMax, setDateCustomMax] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeSearch, setActiveSearch] = useState<PhotoSearchParams>({})

  // Toolbar state (albums tab)
  const [albumsViewMode, setAlbumsViewMode] = useState<AlbumViewMode>(loadAlbumViewMode)

  // Toolbar state (album photos view)
  const [albumPhotosViewMode, setAlbumPhotosViewMode] = useState<AlbumViewMode>(loadAlbumViewMode)
  const [albumPhotosDownloadFilter, setAlbumPhotosDownloadFilter] = useState<DownloadFilter>('all')
  const [albumPhotosDownloadRecords, setAlbumPhotosDownloadRecords] = useState<Record<string, true>>({})
  const [albumPhotosMediaFilter, setAlbumPhotosMediaFilter] = useState<MediaFilter>('all')
  const [albumPhotosSearchInput, setAlbumPhotosSearchInput] = useState('')
  const [albumPhotosSearchOperator, setAlbumPhotosSearchOperator] = useState('contains')
  const [albumPhotosSort, setAlbumPhotosSort] = useState('default')
  const [albumPhotosDrawerOpen, setAlbumPhotosDrawerOpen] = useState(false)
  const [albumPhotosDateField, setAlbumPhotosDateField] = useState<DateRangeField>('taken')
  const [albumPhotosDateMin, setAlbumPhotosDateMin] = useState('')
  const [albumPhotosDateMax, setAlbumPhotosDateMax] = useState('')
  const [albumPhotosActiveDateMin, setAlbumPhotosActiveDateMin] = useState('')
  const [albumPhotosActiveDateMax, setAlbumPhotosActiveDateMax] = useState('')
  const [albumPhotosActiveDateField, setAlbumPhotosActiveDateField] = useState<DateRangeField>('taken')

  const userPhotosGridSize: GridSize = userPhotosViewMode === 'list' ? 'medium' : userPhotosViewMode
  const albumPhotosGridSize: GridSize = albumPhotosViewMode === 'list' ? 'medium' : albumPhotosViewMode

  const loadedContactsRef = useRef(false)

  useEffect(() => {
    if (!isActive || loadedContactsRef.current) return
    loadedContactsRef.current = true
    setContactsLoading(true)
    window.flickrAPI.discoverGetContacts()
      .then(c => { setContacts(c); setContactsLoading(false) })
      .catch(() => setContactsLoading(false))
  }, [isActive])

  // Real-time contact filter
  const filteredContacts = searchQuery.trim()
    ? contacts.filter(c =>
        c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.realname ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : contacts

  const handleSearch = useCallback(async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    setFoundUser(null)
    try {
      const user = await window.flickrAPI.discoverFindUser(q)
      setFoundUser(user)
      await openUser(user)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'User not found')
      setSearching(false)
    }
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const openUser = useCallback(async (user: DiscoverUser): Promise<void> => {
    setFoundUser(user)
    setView('user-photos')
    setUserTab('photos')
    setUserPhotos([])
    setUserAlbums([])
    setUserCollections([])
    setCollectionsLoading(false)
    setCollectionsError(null)
    setCollectionsLoaded(false)
    setActiveDiscoverCollection(null)
    setCollectionNavStack([])
    setPhotosPage(1)
    setPhotosPages(1)
    setPhotosError(null)
    setAlbumPhotos([])
    setActiveAlbum(null)
    setDetailIndex(null)
    setPhotosLoading(true)
    setSearching(false)
    setUserSelectMode(false)
    setUserSelectedIds(new Set())
    // Reset toolbar state for new user
    setSort('date-posted-desc')
    setMediaFilter('all')
    setUserDownloadFilter('all')
    setUserDownloadRecords({})
    setSearchOperator('contains')
    setPhotoSearchInput('')
    setTagInput('')
    setTagMode('any')
    setDateField('taken')
    setDateMode('all')
    setDateCustomMin('')
    setDateCustomMax('')
    setDrawerOpen(false)
    setActiveSearch({})
    try {
      const result = await window.flickrAPI.discoverGetPublicPhotos(user.nsid, 1, 'date-posted-desc', {})
      setUserPhotos(result.photos)
      setPhotosPage(result.page)
      setPhotosPages(result.pages)
    } catch (e) {
      setPhotosError(e instanceof Error ? e.message : 'Failed to load photos')
    } finally {
      setPhotosLoading(false)
    }
  }, [])

  const openContact = useCallback((contact: DiscoverContact): void => {
    const user: DiscoverUser = {
      nsid: contact.nsid,
      username: contact.username,
      realname: contact.realname,
      avatarUrl: contact.avatarUrl,
    }
    openUser(user)
  }, [openUser])

  const applySearch = useCallback(async (newSort?: string, newSearch?: PhotoSearchParams): Promise<void> => {
    if (!foundUser) return
    const effectiveSort = newSort !== undefined ? newSort : sort
    const effectiveSearch = newSearch !== undefined ? newSearch : activeSearch
    if (newSort !== undefined) setSort(newSort)
    if (newSearch !== undefined) setActiveSearch(newSearch)
    setPhotosLoading(true)
    setUserPhotos([])
    setPhotosPage(1)
    setPhotosPages(1)
    setPhotosError(null)
    try {
      const result = await window.flickrAPI.discoverGetPublicPhotos(foundUser.nsid, 1, effectiveSort, effectiveSearch)
      setUserPhotos(result.photos)
      setPhotosPage(result.page)
      setPhotosPages(result.pages)
    } catch (e) {
      setPhotosError(e instanceof Error ? e.message : 'Failed to load photos')
    } finally {
      setPhotosLoading(false)
    }
  }, [foundUser, sort, activeSearch])

  const loadMorePhotos = useCallback(async (): Promise<void> => {
    if (!foundUser || photosLoadingMore || photosPage >= photosPages) return
    setPhotosLoadingMore(true)
    try {
      const result = await window.flickrAPI.discoverGetPublicPhotos(foundUser.nsid, photosPage + 1, sort, activeSearch)
      setUserPhotos(prev => [...prev, ...result.photos])
      setPhotosPage(result.page)
    } catch { /* ignore */ }
    finally { setPhotosLoadingMore(false) }
  }, [foundUser, photosLoadingMore, photosPage, photosPages, sort, activeSearch])

  const loadAlbums = useCallback(async (): Promise<void> => {
    if (!foundUser || albumsLoading) return
    setAlbumsLoading(true)
    setAlbumsError(null)
    try {
      const result = await window.flickrAPI.discoverGetUserAlbums(foundUser.nsid, 1)
      setUserAlbums(result.albums)
    } catch (e) {
      setAlbumsError(e instanceof Error ? e.message : 'Failed to load albums')
    } finally {
      setAlbumsLoading(false)
    }
  }, [foundUser, albumsLoading])

  const loadCollections = useCallback(async (): Promise<void> => {
    if (!foundUser || collectionsLoading || collectionsLoaded) return
    setCollectionsLoading(true)
    setCollectionsError(null)
    try {
      const result = await window.flickrAPI.discoverGetCollectionTree(foundUser.nsid)
      setUserCollections(result)
      setCollectionsLoaded(true)
    } catch (e) {
      setCollectionsError(e instanceof Error ? e.message : 'Failed to load collections')
    } finally {
      setCollectionsLoading(false)
    }
  }, [foundUser, collectionsLoading, collectionsLoaded])

  const openAlbum = useCallback(async (album: FlickrAlbum): Promise<void> => {
    setActiveAlbum(album)
    setView('album-photos')
    setAlbumPhotos([])
    setAlbumPhotosPage(1)
    setAlbumPhotosPages(1)
    setAlbumPhotosError(null)
    setDetailIndex(null)
    setAlbumSelectMode(false)
    setAlbumSelectedIds(new Set())
    setAlbumPhotosMediaFilter('all')
    setAlbumPhotosDownloadFilter('all')
    setAlbumPhotosDownloadRecords({})
    setAlbumPhotosSearchInput('')
    setAlbumPhotosSearchOperator('contains')
    setAlbumPhotosSort('default')
    setAlbumPhotosDrawerOpen(false)
    setAlbumPhotosDateField('taken')
    setAlbumPhotosDateMin('')
    setAlbumPhotosDateMax('')
    setAlbumPhotosActiveDateMin('')
    setAlbumPhotosActiveDateMax('')
    setAlbumPhotosActiveDateField('taken')
    setAlbumPhotosLoading(true)
    try {
      const albumResult = await window.flickrAPI.discoverGetAlbumPhotos(foundUser!.nsid, album.id, 1)
      setAlbumPhotos(albumResult.photos)
      setAlbumPhotosPage(albumResult.page)
      setAlbumPhotosPages(albumResult.pages)
    } catch (e) {
      setAlbumPhotosError(e instanceof Error ? e.message : 'Failed to load album')
    } finally {
      setAlbumPhotosLoading(false)
    }
  }, [foundUser])

  const loadMoreAlbumPhotos = useCallback(async (): Promise<void> => {
    if (!activeAlbum || albumPhotosLoadingMore || albumPhotosPage >= albumPhotosPages) return
    setAlbumPhotosLoadingMore(true)
    try {
      const result = await window.flickrAPI.discoverGetAlbumPhotos(foundUser!.nsid, activeAlbum.id, albumPhotosPage + 1)
      setAlbumPhotos(prev => [...prev, ...result.photos])
      setAlbumPhotosPage(result.page)
    } catch { /* ignore */ }
    finally { setAlbumPhotosLoadingMore(false) }
  }, [foundUser, activeAlbum, albumPhotosLoadingMore, albumPhotosPage, albumPhotosPages])

  const toggleUserSelect = (id: string): void => {
    setUserSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAlbumSelect = (id: string): void => {
    setAlbumSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleUserDownloadSelected = async (): Promise<void> => {
    if (!foundUser) return
    const selected = filteredPhotos.filter(p => userSelectedIds.has(p.id)).map(p => ({ id: p.id, title: p.title }))
    if (!selected.length) return
    setUserDownloading(true)
    try {
      await window.flickrAPI.startDiscoverSelectedBatch(selected, `Selected from ${foundUser.realname || foundUser.username}`, ['Users', foundUser.username])
    } finally {
      setUserDownloading(false)
      setUserSelectMode(false)
      setUserSelectedIds(new Set())
    }
  }

  const handleAlbumDownloadSelected = async (): Promise<void> => {
    if (!foundUser || !activeAlbum) return
    const selected = albumPhotos.filter(p => albumSelectedIds.has(p.id)).map(p => ({ id: p.id, title: p.title }))
    if (!selected.length) return
    setAlbumDownloading(true)
    try {
      await window.flickrAPI.startDiscoverSelectedBatch(selected, `Selected from ${activeAlbum.title}`, ['Users', foundUser.username, activeAlbum.title])
    } finally {
      setAlbumDownloading(false)
      setAlbumSelectMode(false)
      setAlbumSelectedIds(new Set())
    }
  }

  const handleTitleSearch = (): void => {
    const q = photoSearchInput.trim()
    if (!q) {
      const newSearch = { ...activeSearch }
      delete newSearch.query
      delete newSearch.operator
      void applySearch(undefined, newSearch)
    } else {
      void applySearch(undefined, { ...activeSearch, query: q, operator: searchOperator as SearchOperator })
    }
  }

  const handleApplyDrawer = (): void => {
    const dates = (dateMode !== 'all' && dateMode !== 'since' && dateMode !== 'between')
      ? getPresetDates(dateMode)
      : { min: dateCustomMin, max: dateCustomMax }
    const newSearch: PhotoSearchParams = { ...activeSearch }
    if (tagInput.trim()) {
      newSearch.tagQuery = tagInput.trim()
      newSearch.tagMode = tagMode
    } else {
      delete newSearch.tagQuery
      delete newSearch.tagMode
    }
    if (dateMode !== 'all' && (dates.min || dates.max)) {
      newSearch.dateField = dateField
      newSearch.dateMin = dates.min
      newSearch.dateMax = dates.max
    } else {
      delete newSearch.dateField
      delete newSearch.dateMin
      delete newSearch.dateMax
    }
    void applySearch(undefined, newSearch)
    setDrawerOpen(false)
  }

  const handleClearFilters = (): void => {
    const newSearch: PhotoSearchParams = {}
    if (activeSearch.query) newSearch.query = activeSearch.query
    if (activeSearch.operator) newSearch.operator = activeSearch.operator
    setTagInput('')
    setTagMode('any')
    setDateField('taken')
    setDateMode('all')
    setDateCustomMin('')
    setDateCustomMax('')
    void applySearch(undefined, newSearch)
    setDrawerOpen(false)
  }

  // Client-side filters: media type and photo ID
  const filteredPhotos = useMemo(() => {
    let result = userPhotos
    if (mediaFilter !== 'all') result = result.filter(p => p.media === mediaFilter)
    if (searchOperator === 'photo-id' && photoSearchInput.trim()) {
      result = result.filter(p => p.id === photoSearchInput.trim())
    }
    if (userDownloadFilter !== 'all') {
      result = result.filter(p => userDownloadFilter === 'downloaded' ? !!userDownloadRecords[p.id] : !userDownloadRecords[p.id])
    }
    return result
  }, [userPhotos, mediaFilter, searchOperator, photoSearchInput, userDownloadFilter, userDownloadRecords])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (activeSearch.tagQuery) count++
    if (activeSearch.dateMin || activeSearch.dateMax) count++
    if (userDownloadFilter !== 'all') count++
    return count
  }, [activeSearch, userDownloadFilter])

  const filteredAlbumPhotos = useMemo(() => {
    let result = albumPhotos
    if (albumPhotosMediaFilter !== 'all') result = result.filter(p => p.media === albumPhotosMediaFilter)
    if (albumPhotosSearchOperator === 'photo-id' && albumPhotosSearchInput.trim()) {
      return result.filter(p => p.id === albumPhotosSearchInput.trim())
    }
    if (albumPhotosSearchInput.trim()) {
      const q = albumPhotosSearchInput.trim().toLowerCase()
      result = result.filter(p => {
        const t = p.title.toLowerCase()
        if (albumPhotosSearchOperator === 'starts') return t.startsWith(q)
        if (albumPhotosSearchOperator === 'ends') return t.endsWith(q)
        if (albumPhotosSearchOperator === 'exact') return t === q
        return t.includes(q)
      })
    }
    if (albumPhotosActiveDateMin || albumPhotosActiveDateMax) {
      result = result.filter(p => {
        const dateStr = albumPhotosActiveDateField === 'taken'
          ? (p.dateTaken ?? '').substring(0, 10)
          : p.datePosted ? new Date(Number(p.datePosted) * 1000).toISOString().substring(0, 10) : ''
        if (!dateStr) return true
        if (albumPhotosActiveDateMin && dateStr < albumPhotosActiveDateMin) return false
        if (albumPhotosActiveDateMax && dateStr > albumPhotosActiveDateMax) return false
        return true
      })
    }
    if (albumPhotosSort === 'date-taken-asc') result = [...result].sort((a, b) => (a.dateTaken ?? '').localeCompare(b.dateTaken ?? ''))
    if (albumPhotosSort === 'date-taken-desc') result = [...result].sort((a, b) => (b.dateTaken ?? '').localeCompare(a.dateTaken ?? ''))
    if (albumPhotosDownloadFilter !== 'all') {
      result = result.filter(p => albumPhotosDownloadFilter === 'downloaded' ? !!albumPhotosDownloadRecords[p.id] : !albumPhotosDownloadRecords[p.id])
    }
    return result
  }, [albumPhotos, albumPhotosMediaFilter, albumPhotosSearchInput, albumPhotosSearchOperator, albumPhotosSort, albumPhotosActiveDateMin, albumPhotosActiveDateMax, albumPhotosActiveDateField, albumPhotosDownloadFilter, albumPhotosDownloadRecords])

  const albumPhotosActiveFilterCount = useMemo(() => {
    return (albumPhotosActiveDateMin || albumPhotosActiveDateMax ? 1 : 0) + (albumPhotosDownloadFilter !== 'all' ? 1 : 0)
  }, [albumPhotosActiveDateMin, albumPhotosActiveDateMax, albumPhotosDownloadFilter])

  useEffect(() => {
    if (userPhotos.length === 0) return
    window.flickrAPI.getDiscoverRecordsBatch(userPhotos.map(p => p.id))
      .then(records => {
        const map: Record<string, true> = {}
        Object.keys(records).forEach(id => { map[id] = true })
        setUserDownloadRecords(map)
      })
      .catch(() => {})
  }, [userPhotos])

  useEffect(() => {
    if (albumPhotos.length === 0) return
    window.flickrAPI.getDiscoverRecordsBatch(albumPhotos.map(p => p.id))
      .then(records => {
        const map: Record<string, true> = {}
        Object.keys(records).forEach(id => { map[id] = true })
        setAlbumPhotosDownloadRecords(map)
      })
      .catch(() => {})
  }, [albumPhotos])

  // ── Photo detail view
  if (detailIndex !== null) {
    const currentPhotos = view === 'album-photos' ? filteredAlbumPhotos : filteredPhotos
    if (!currentPhotos[detailIndex]) { setDetailIndex(currentPhotos.length > 0 ? currentPhotos.length - 1 : null); return <></> }
    const hasMore = view === 'album-photos' ? albumPhotosPage < albumPhotosPages : photosPage < photosPages
    const sourceName = view === 'album-photos' ? (activeAlbum?.title ?? '') : (foundUser ? (foundUser.realname || foundUser.username) : '')
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <PhotoDetail
          photo={currentPhotos[detailIndex]}
          index={detailIndex}
          total={currentPhotos.length}
          hasMore={hasMore}
          canGoPrev={detailIndex > 0}
          canGoNext={detailIndex < currentPhotos.length - 1 || hasMore}
          onPrev={() => setDetailIndex(d => (d !== null && d > 0 ? d - 1 : d))}
          onNext={() => {
            if (detailIndex < currentPhotos.length - 1) {
              setDetailIndex(detailIndex + 1)
            } else if (view === 'album-photos') {
              loadMoreAlbumPhotos().then(() => setDetailIndex(di => di !== null ? di + 1 : di))
            } else {
              loadMorePhotos().then(() => setDetailIndex(di => di !== null ? di + 1 : di))
            }
          }}
          onClose={() => setDetailIndex(null)}
          sourceName={sourceName}
          discoverMode
        />
      </div>
    )
  }

  // ── Album photo grid
  if (view === 'album-photos' && activeAlbum && foundUser) {
    return (
      <div style={s.container}>
        <div style={s.stickyHeader}>
          <div style={s.headerRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button style={s.backBtn} onClick={() => { setView('user-photos'); setUserTab(activeDiscoverCollection !== null ? 'collections' : 'albums'); setActiveAlbum(null) }}>
                ← {foundUser.realname || foundUser.username}
              </button>
              <div>
                <h2 style={s.heading}>{activeAlbum.title}</h2>
                <p style={s.subheading}>{activeAlbum.photoCount.toLocaleString()} photos</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {!albumSelectMode && (
                <SmartDownloadButton
                  label="Download Album"
                  onDownload={() => {
                    void window.flickrAPI.startDiscoverSelectedBatch(
                      albumPhotos.map(p => ({ id: p.id, title: p.title })),
                      activeAlbum.title,
                      ['Users', foundUser.username, activeAlbum.title]
                    )
                  }}
                />
              )}
              {albumPhotos.length > 0 && !albumSelectMode && (
                <button style={s.selectBtn} onClick={() => setAlbumSelectMode(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="2" y="3" width="7" height="7" rx="1"/><rect x="13" y="3" width="7" height="7" rx="1"/><rect x="2" y="14" width="7" height="7" rx="1"/><path d="M14 17l2 2 4-4"/>
                  </svg>
                  Select Photos
                </button>
              )}
              {albumSelectMode && (
                <button style={s.selectBtn} onClick={() => { setAlbumSelectMode(false); setAlbumSelectedIds(new Set()) }}>Cancel</button>
              )}
            </div>
          </div>
          {albumSelectMode && (
            <DiscoverSelectBar
              count={albumSelectedIds.size}
              total={filteredAlbumPhotos.length}
              onDownload={handleAlbumDownloadSelected}
              onClearSelection={() => setAlbumSelectedIds(new Set())}
              onCancel={() => { setAlbumSelectMode(false); setAlbumSelectedIds(new Set()) }}
              downloading={albumDownloading}
            />
          )}
          {/* Album photos toolbar */}
          <div style={s.toolbarArea}>
            <div style={ss.segGroup}>
              {(['all', 'photo', 'video'] as MediaFilter[]).map(f => (
                <button key={f} style={{ ...ss.seg, ...(albumPhotosMediaFilter === f ? ss.segActive : {}) }} onClick={() => setAlbumPhotosMediaFilter(f)}>
                  {f === 'all' ? 'All' : f === 'photo' ? 'Photos' : 'Videos'}
                </button>
              ))}
            </div>
            <div style={ss.searchGroup}>
              <select style={ss.operatorSelect} value={albumPhotosSearchOperator} onChange={e => { setAlbumPhotosSearchOperator(e.target.value); setAlbumPhotosSearchInput('') }}>
                <option value="contains">contains</option>
                <option value="starts">starts with</option>
                <option value="ends">ends with</option>
                <option value="exact">exact match</option>
                <option value="photo-id">Photo ID</option>
              </select>
              <span style={ss.searchIcon}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </span>
              <input style={ss.searchInput} placeholder={albumPhotosSearchOperator === 'photo-id' ? 'Photo ID…' : 'Title…'} value={albumPhotosSearchInput} onChange={e => setAlbumPhotosSearchInput(e.target.value)} />
              {albumPhotosSearchInput && (
                <button style={ss.searchClearBtn} onClick={() => setAlbumPhotosSearchInput('')}>✕</button>
              )}
            </div>
            <button
              style={{ ...ss.moreFiltersBtn, ...(albumPhotosDrawerOpen || albumPhotosActiveFilterCount > 0 ? ss.moreFiltersBtnActive : {}) }}
              onClick={() => setAlbumPhotosDrawerOpen(d => !d)}
            >
              Filters{albumPhotosActiveFilterCount > 0 && <span style={ss.drawerBadge}>{albumPhotosActiveFilterCount}</span>}
            </button>
            <div style={{ flex: 1 }} />
            <div style={ss.segGroupDensity}>
              <button style={{ ...ss.densityBtn, ...(albumPhotosViewMode === 'list' ? ss.densityBtnActive : {}) }} onClick={() => { const m: AlbumViewMode = 'list'; setAlbumPhotosViewMode(m); saveAlbumViewMode(m) }}>
                <ListIcon />
              </button>
              {(['small', 'medium', 'large'] as GridSize[]).map(g => (
                <button key={g} style={{ ...ss.densityBtn, ...(albumPhotosViewMode === g ? ss.densityBtnActive : {}) }} onClick={() => { setAlbumPhotosViewMode(g); saveAlbumViewMode(g) }}>
                  <GridIcon size={g} />
                </button>
              ))}
            </div>
            <select style={ss.sortSelect} value={albumPhotosSort} onChange={e => setAlbumPhotosSort(e.target.value)}>
              <option value="default">Album order</option>
              <option value="date-taken-desc">Date taken (newest)</option>
              <option value="date-taken-asc">Date taken (oldest)</option>
            </select>
          </div>

          {/* More filters drawer */}
          {albumPhotosDrawerOpen && (
            <div style={{ ...ss.drawer, marginLeft: '-20px', marginRight: '-20px', paddingLeft: '20px', paddingRight: '20px' }}>
              <div style={ss.drawerRow}>
                <span style={ss.drawerLabel}>Downloaded</span>
                <DownloadFilterSelect value={albumPhotosDownloadFilter} onChange={setAlbumPhotosDownloadFilter} />
              </div>
              <div style={ss.drawerRow}>
                <span style={ss.drawerLabel}>Date</span>
                <div style={ss.segGroup}>
                  {(['taken', 'posted'] as DateRangeField[]).map(f => (
                    <button key={f} style={{ ...ss.seg, ...(albumPhotosDateField === f ? ss.segActive : {}) }} onClick={() => setAlbumPhotosDateField(f)}>
                      {f === 'taken' ? 'Date taken' : 'Date posted'}
                    </button>
                  ))}
                </div>
                <input type="date" style={ss.dateInput} value={albumPhotosDateMin} onChange={e => setAlbumPhotosDateMin(e.target.value)} />
                <span style={ss.dateSep}>–</span>
                <input type="date" style={ss.dateInput} value={albumPhotosDateMax} onChange={e => setAlbumPhotosDateMax(e.target.value)} />
                <button style={ss.applyBtn} onClick={() => {
                  setAlbumPhotosActiveDateMin(albumPhotosDateMin)
                  setAlbumPhotosActiveDateMax(albumPhotosDateMax)
                  setAlbumPhotosActiveDateField(albumPhotosDateField)
                  setAlbumPhotosDrawerOpen(false)
                }}>Apply</button>
                {(albumPhotosActiveDateMin || albumPhotosActiveDateMax) && (
                  <button style={ss.clearFiltersLink} onClick={() => {
                    setAlbumPhotosDateMin(''); setAlbumPhotosDateMax('')
                    setAlbumPhotosActiveDateMin(''); setAlbumPhotosActiveDateMax('')
                  }}>Clear</button>
                )}
              </div>
            </div>
          )}
        </div>
        <AttributionNotice />
        {albumPhotosLoading && <div style={s.loadingState}>Loading album…</div>}
        {albumPhotosError && <div style={s.errorState}>{albumPhotosError}</div>}
        {filteredAlbumPhotos.length > 0 && (
          <>
            {albumPhotosViewMode === 'list' ? (
              <div style={ss.listContainer}>
                {filteredAlbumPhotos.map((photo, idx) => (
                  <PhotoListRow
                    key={photo.id}
                    photo={photo}
                    isDownloaded={!!albumPhotosDownloadRecords[photo.id]}
                    isSelected={albumSelectMode ? albumSelectedIds.has(photo.id) : undefined}
                    selectMode={albumSelectMode}
                    onClick={() => albumSelectMode ? toggleAlbumSelect(photo.id) : setDetailIndex(idx)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ ...s.grid, gridTemplateColumns: GRID_COLUMNS[albumPhotosGridSize] }}>
                {filteredAlbumPhotos.map((photo, idx) => (
                  <DiscoverTile
                    key={photo.id}
                    photo={photo}
                    onClick={() => !albumSelectMode && setDetailIndex(idx)}
                    selectMode={albumSelectMode}
                    selected={albumSelectedIds.has(photo.id)}
                    onSelect={() => toggleAlbumSelect(photo.id)}
                  />
                ))}
              </div>
            )}
            {albumPhotosPage < albumPhotosPages && (
              <div style={s.loadMoreRow}>
                <button style={s.loadMoreBtn} disabled={albumPhotosLoadingMore} onClick={loadMoreAlbumPhotos}>
                  {albumPhotosLoadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── User profile view (photos + albums tabs)
  if (view === 'user-photos' && foundUser) {
    return (
      <div style={s.container}>
        <div style={s.stickyHeader}>
          <div style={s.headerRow}>
            <button style={s.backBtn} onClick={() => { setView('home'); setFoundUser(null) }}>← Back</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <img
                src={foundUser.avatarUrl}
                alt={foundUser.username}
                style={s.userAvatar}
                onError={(e) => { e.currentTarget.src = 'https://www.flickr.com/images/buddyicon.gif' }}
              />
              <div>
                <span style={s.userName}>{foundUser.realname || foundUser.username}</span>
                {foundUser.realname && <div style={s.userHandle}>@{foundUser.username}</div>}
                {foundUser.photoCount != null && (
                  <div style={s.userHandle}>{foundUser.photoCount.toLocaleString()} public photos</div>
                )}
              </div>
            </div>
            {userTab === 'photos' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!userSelectMode && (
                  <SmartDownloadButton
                    label="Download All"
                    onDownload={(mode) => {
                      const smartMode = mode === 'all' ? undefined : mode
                      void window.flickrAPI.startDiscoverUserBatch(foundUser.nsid, foundUser.username, `↓ ${foundUser.realname || foundUser.username}`, true, smartMode)
                    }}
                  />
                )}
                {filteredPhotos.length > 0 && !userSelectMode && (
                  <button style={s.selectBtn} onClick={() => setUserSelectMode(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="2" y="3" width="7" height="7" rx="1"/><rect x="13" y="3" width="7" height="7" rx="1"/><rect x="2" y="14" width="7" height="7" rx="1"/><path d="M14 17l2 2 4-4"/>
                    </svg>
                    Select Photos
                  </button>
                )}
                {userSelectMode && (
                  <button style={s.selectBtn} onClick={() => { setUserSelectMode(false); setUserSelectedIds(new Set()) }}>Cancel</button>
                )}
              </div>
            )}
          </div>

          <div style={s.userTabBar}>
            <button
              style={{ ...s.userTabBtn, ...(userTab === 'photos' ? s.userTabActive : {}) }}
              onClick={() => setUserTab('photos')}
            >Photos</button>
            <button
              style={{ ...s.userTabBtn, ...(userTab === 'albums' ? s.userTabActive : {}) }}
              onClick={() => { setUserTab('albums'); void loadAlbums() }}
            >Albums</button>
            <button
              style={{ ...s.userTabBtn, ...(userTab === 'collections' ? s.userTabActive : {}) }}
              onClick={() => { setUserTab('collections'); void loadCollections() }}
            >Collections</button>
          </div>

          {/* Photo toolbar — only in Photos tab */}
          {userTab === 'photos' && (
            <div>
              <div style={s.toolbarArea}>
                {/* Media filter */}
                <div style={ss.segGroup}>
                  {(['all', 'photo', 'video'] as MediaFilter[]).map(f => (
                    <button
                      key={f}
                      style={{ ...ss.seg, ...(mediaFilter === f ? ss.segActive : {}) }}
                      onClick={() => setMediaFilter(f)}
                    >
                      {f === 'all' ? 'All' : f === 'photo' ? 'Photos' : 'Videos'}
                    </button>
                  ))}
                </div>

                {/* Search (title or photo ID) */}
                <div style={ss.searchGroup}>
                  <select
                    style={ss.operatorSelect}
                    value={searchOperator}
                    onChange={e => { setSearchOperator(e.target.value); setPhotoSearchInput('') }}
                  >
                    <option value="contains">contains</option>
                    <option value="starts">starts with</option>
                    <option value="ends">ends with</option>
                    <option value="exact">exact match</option>
                    <option value="photo-id">Photo ID</option>
                  </select>
                  <span style={ss.searchIcon}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </span>
                  <input
                    style={ss.searchInput}
                    placeholder={searchOperator === 'photo-id' ? 'Photo ID…' : 'Title…'}
                    value={photoSearchInput}
                    onChange={e => setPhotoSearchInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && searchOperator !== 'photo-id') handleTitleSearch()
                    }}
                  />
                  {photoSearchInput && (
                    <button
                      style={ss.searchClearBtn}
                      onClick={() => {
                        setPhotoSearchInput('')
                        if (searchOperator !== 'photo-id' && activeSearch.query) {
                          const newSearch = { ...activeSearch }
                          delete newSearch.query
                          delete newSearch.operator
                          void applySearch(undefined, newSearch)
                        }
                      }}
                    >✕</button>
                  )}
                </div>

                {/* More filters button */}
                <button
                  style={{ ...ss.moreFiltersBtn, ...(drawerOpen || activeFilterCount > 0 ? ss.moreFiltersBtnActive : {}) }}
                  onClick={() => setDrawerOpen(d => !d)}
                >
                  Filters
                  {activeFilterCount > 0 && <span style={ss.drawerBadge}>{activeFilterCount}</span>}
                </button>

                {/* Grid density + list toggle */}
                <div style={ss.segGroupDensity}>
                  <button style={{ ...ss.densityBtn, ...(userPhotosViewMode === 'list' ? ss.densityBtnActive : {}) }} onClick={() => { const m: PhotoViewMode = 'list'; setUserPhotosViewMode(m); savePhotoViewMode(m) }}>
                    <ListIcon />
                  </button>
                  {(['small', 'medium', 'large'] as GridSize[]).map(g => (
                    <button
                      key={g}
                      style={{ ...ss.densityBtn, ...(userPhotosViewMode === g ? ss.densityBtnActive : {}) }}
                      onClick={() => { setUserPhotosViewMode(g); savePhotoViewMode(g) }}
                    >
                      <GridIcon size={g} />
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <select
                  style={ss.sortSelect}
                  value={sort}
                  onChange={e => { void applySearch(e.target.value, undefined) }}
                >
                  <option value="date-posted-desc">Newest posted</option>
                  <option value="date-posted-asc">Oldest posted</option>
                  <option value="date-taken-desc">Date taken (newest)</option>
                  <option value="date-taken-asc">Date taken (oldest)</option>
                  <option value="interestingness-desc">Most interesting</option>
                </select>
              </div>

              {/* More filters drawer */}
              {drawerOpen && (
                <div style={ss.drawer}>
                  {/* Downloaded */}
                  <div style={ss.drawerRow}>
                    <span style={ss.drawerLabel}>Downloaded</span>
                    <DownloadFilterSelect value={userDownloadFilter} onChange={setUserDownloadFilter} />
                  </div>
                  {/* Tags row */}
                  <div style={ss.drawerRow}>
                    <span style={ss.drawerLabel}>Tags</span>
                    <input
                      style={s.drawerInput}
                      placeholder="tag1 tag2…"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                    />
                    <div style={ss.segGroup}>
                      {(['any', 'all'] as TagMode[]).map(m => (
                        <button
                          key={m}
                          style={{ ...ss.seg, ...(tagMode === m ? ss.segActive : {}) }}
                          onClick={() => setTagMode(m)}
                        >
                          {m === 'any' ? 'Any' : 'All'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date row */}
                  <div style={ss.drawerRow}>
                    <span style={ss.drawerLabel}>Date</span>
                    <div style={ss.segGroup}>
                      {(['taken', 'posted'] as DateRangeField[]).map(f => (
                        <button
                          key={f}
                          style={{ ...ss.seg, ...(dateField === f ? ss.segActive : {}) }}
                          onClick={() => setDateField(f)}
                        >
                          {f === 'taken' ? 'Taken' : 'Posted'}
                        </button>
                      ))}
                    </div>
                    <select
                      style={ss.sortSelect}
                      value={dateMode}
                      onChange={e => setDateMode(e.target.value as DateMode)}
                    >
                      <option value="all">All time</option>
                      <option value="last7">Last 7 days</option>
                      <option value="last30">Last 30 days</option>
                      <option value="thisYear">This year</option>
                      <option value="lastYear">Last year</option>
                      <option value="between">Custom range</option>
                    </select>
                    {dateMode === 'between' && (
                      <>
                        <input
                          type="date"
                          style={s.dateInput}
                          value={dateCustomMin}
                          onChange={e => setDateCustomMin(e.target.value)}
                        />
                        <span style={s.dateSep}>–</span>
                        <input
                          type="date"
                          style={s.dateInput}
                          value={dateCustomMax}
                          onChange={e => setDateCustomMax(e.target.value)}
                        />
                      </>
                    )}
                  </div>

                  {/* Drawer actions row */}
                  <div style={{ ...ss.drawerRow, justifyContent: 'flex-end', gap: '12px' }}>
                    <button style={ss.clearFiltersLink} onClick={handleClearFilters}>Clear filters</button>
                    <button style={s.applyBtn} onClick={handleApplyDrawer}>Apply</button>
                  </div>
                </div>
              )}

              {/* Active filter chips */}
              {(activeSearch.query || activeSearch.tagQuery || activeSearch.dateMin || activeSearch.dateMax) && (
                <div style={ss.chipRow}>
                  {activeSearch.query && (
                    <Chip
                      label={`"${activeSearch.query}"`}
                      onDismiss={() => {
                        setPhotoSearchInput('')
                        const newSearch = { ...activeSearch }
                        delete newSearch.query
                        delete newSearch.operator
                        void applySearch(undefined, newSearch)
                      }}
                    />
                  )}
                  {activeSearch.tagQuery && (
                    <Chip
                      label={`tags: ${activeSearch.tagQuery}`}
                      onDismiss={() => {
                        setTagInput('')
                        const newSearch = { ...activeSearch }
                        delete newSearch.tagQuery
                        delete newSearch.tagMode
                        void applySearch(undefined, newSearch)
                      }}
                    />
                  )}
                  {(activeSearch.dateMin || activeSearch.dateMax) && (
                    <Chip
                      label={formatDateChip(activeSearch.dateMin ?? '', activeSearch.dateMax ?? '', activeSearch.dateField ?? 'taken')}
                      onDismiss={() => {
                        setDateMode('all')
                        setDateCustomMin('')
                        setDateCustomMax('')
                        const newSearch = { ...activeSearch }
                        delete newSearch.dateField
                        delete newSearch.dateMin
                        delete newSearch.dateMax
                        void applySearch(undefined, newSearch)
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {userTab === 'photos' && userSelectMode && (
            <DiscoverSelectBar
              count={userSelectedIds.size}
              total={filteredPhotos.length}
              onDownload={handleUserDownloadSelected}
              onClearSelection={() => setUserSelectedIds(new Set())}
              onCancel={() => { setUserSelectMode(false); setUserSelectedIds(new Set()) }}
              downloading={userDownloading}
            />
          )}
        </div>

        <AttributionNotice />

        {userTab === 'photos' && (
          <>
            {photosLoading && <div style={s.loadingState}>Loading photos…</div>}
            {photosError && <div style={s.errorState}>{photosError}</div>}
            {!photosLoading && !photosError && filteredPhotos.length === 0 && userPhotos.length === 0 && (
              <div style={s.emptyState}>No public photos found.</div>
            )}
            {!photosLoading && !photosError && filteredPhotos.length === 0 && userPhotos.length > 0 && (
              <div style={s.emptyState}>No photos match the current filters.</div>
            )}
            {filteredPhotos.length > 0 && (
              <>
                {userPhotosViewMode === 'list' ? (
                  <div style={ss.listContainer}>
                    {filteredPhotos.map((photo, idx) => (
                      <PhotoListRow
                        key={photo.id}
                        photo={photo}
                        isDownloaded={!!userDownloadRecords[photo.id]}
                        isSelected={userSelectMode ? userSelectedIds.has(photo.id) : undefined}
                        selectMode={userSelectMode}
                        onClick={() => userSelectMode ? toggleUserSelect(photo.id) : setDetailIndex(idx)}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ ...s.grid, gridTemplateColumns: GRID_COLUMNS[userPhotosGridSize] }}>
                    {filteredPhotos.map((photo, idx) => (
                      <DiscoverTile
                        key={photo.id}
                        photo={photo}
                        onClick={() => !userSelectMode && setDetailIndex(idx)}
                        selectMode={userSelectMode}
                        selected={userSelectedIds.has(photo.id)}
                        onSelect={() => toggleUserSelect(photo.id)}
                      />
                    ))}
                  </div>
                )}
                {photosPage < photosPages && searchOperator !== 'photo-id' && (
                  <div style={s.loadMoreRow}>
                    <button style={s.loadMoreBtn} disabled={photosLoadingMore} onClick={loadMorePhotos}>
                      {photosLoadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {userTab === 'albums' && (
          <>
            {/* Albums toolbar — grid/list density */}
            <div style={s.toolbarArea}>
              <div style={{ flex: 1 }} />
              <div style={ss.segGroupDensity}>
                <button
                  style={{ ...ss.densityBtn, ...(albumsViewMode === 'list' ? ss.densityBtnActive : {}) }}
                  onClick={() => { setAlbumsViewMode('list'); saveAlbumViewMode('list') }}
                  title="List view"
                >
                  <ListIcon />
                </button>
                {(['small', 'medium', 'large'] as GridSize[]).map(g => (
                  <button
                    key={g}
                    style={{ ...ss.densityBtn, ...(albumsViewMode === g ? ss.densityBtnActive : {}) }}
                    onClick={() => { setAlbumsViewMode(g); saveAlbumViewMode(g) }}
                    title={g === 'small' ? 'Small grid' : g === 'medium' ? 'Medium grid' : 'Large grid'}
                  >
                    <GridIcon size={g} />
                  </button>
                ))}
              </div>
            </div>

            {albumsLoading && <div style={s.loadingState}>Loading albums…</div>}
            {albumsError && <div style={s.errorState}>{albumsError}</div>}
            {!albumsLoading && !albumsError && userAlbums.length === 0 && (
              <div style={s.emptyState}>No public albums.</div>
            )}
            {userAlbums.length > 0 && (
              albumsViewMode === 'list' ? (
                <div style={s.albumListContainer}>
                  {userAlbums.map(album => (
                    <button key={album.id} style={s.albumListRow} onClick={() => openAlbum(album)}>
                      <div style={s.albumListThumb}>
                        {album.coverPhotoUrl
                          ? <img src={album.coverPhotoUrl} alt="" style={s.albumListThumbImg} loading="lazy" />
                          : <div style={s.albumCoverPlaceholder} />
                        }
                      </div>
                      <div style={s.albumListInfo}>
                        <span style={s.albumTitle}>{album.title}</span>
                        <span style={s.albumMeta}>{album.photoCount.toLocaleString()} photos</span>
                      </div>
                      <span style={s.albumListChevron}>›</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ ...s.albumGrid, gridTemplateColumns: ALBUM_COLUMNS[albumsViewMode as GridSize] }}>
                  {userAlbums.map(album => (
                    <div key={album.id} style={s.albumCard} onClick={() => openAlbum(album)}>
                      <div style={s.albumCover}>
                        {album.coverPhotoUrl
                          ? <img src={album.coverPhotoUrl} alt="" style={s.albumCoverImg} loading="lazy" />
                          : <div style={s.albumCoverPlaceholder} />
                        }
                      </div>
                      <div style={s.albumInfo}>
                        <span style={s.albumTitle}>{album.title}</span>
                        <span style={s.albumMeta}>{album.photoCount.toLocaleString()} photos</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {userTab === 'collections' && (
          <>
            {activeDiscoverCollection !== null && (
              <div style={s.collectionBreadcrumb}>
                <button style={s.backBtn} onClick={() => {
                  if (collectionNavStack.length === 0) {
                    setActiveDiscoverCollection(null)
                  } else {
                    const prev = collectionNavStack[collectionNavStack.length - 1]
                    setCollectionNavStack(st => st.slice(0, -1))
                    setActiveDiscoverCollection(prev)
                  }
                }}>
                  ← {collectionNavStack.length === 0 ? 'Collections' : collectionNavStack[collectionNavStack.length - 1].title}
                </button>
                <span style={s.collectionBreadcrumbTitle}>{activeDiscoverCollection.title}</span>
              </div>
            )}
            {collectionsLoading && <div style={s.loadingState}>Loading collections…</div>}
            {collectionsError && <div style={s.errorState}>{collectionsError}</div>}
            {!collectionsLoading && !collectionsError && collectionsLoaded && userCollections.length === 0 && activeDiscoverCollection === null && (
              <div style={s.emptyState}>No public collections.</div>
            )}
            {activeDiscoverCollection === null && userCollections.length > 0 && (
              <div style={s.collectionGrid}>
                {userCollections.map(col => (
                  <DiscoverCollCard key={col.id} col={col} onClick={() => setActiveDiscoverCollection(col)} />
                ))}
              </div>
            )}
            {activeDiscoverCollection !== null && (() => {
              const col = activeDiscoverCollection
              const hasSubColls = col.collections.length > 0
              const hasSets = col.sets.length > 0
              if (!hasSubColls && !hasSets) {
                return <div style={s.emptyState}>This collection is empty.</div>
              }
              return (
                <>
                  {hasSubColls && (
                    <section>
                      {hasSets && <p style={s.collectionSectionLabel}>Sub-collections</p>}
                      <div style={s.collectionGrid}>
                        {col.collections.map(sub => (
                          <DiscoverCollCard key={sub.id} col={sub} onClick={() => {
                            setCollectionNavStack(prev => [...prev, col])
                            setActiveDiscoverCollection(sub)
                          }} />
                        ))}
                      </div>
                    </section>
                  )}
                  {hasSets && (
                    <section>
                      <div style={s.collectionAlbumsHeader}>
                        {hasSubColls && <p style={{ ...s.collectionSectionLabel, margin: 0 }}>Albums</p>}
                        <div style={s.collectionSizerGroup}>
                          <button
                            style={{ ...ss.densityBtn, ...(albumsViewMode === 'list' ? ss.densityBtnActive : {}) }}
                            onClick={() => { setAlbumsViewMode('list'); saveAlbumViewMode('list') }}
                            title="List view"
                          ><ListIcon /></button>
                          {(['small', 'medium', 'large'] as GridSize[]).map(v => (
                            <button key={v}
                              style={{ ...ss.densityBtn, ...(albumsViewMode === v ? ss.densityBtnActive : {}) }}
                              onClick={() => { setAlbumsViewMode(v as AlbumViewMode); saveAlbumViewMode(v as AlbumViewMode) }}
                              title={v === 'small' ? 'Small grid' : v === 'medium' ? 'Medium grid' : 'Large grid'}
                            ><GridIcon size={v as GridSize} /></button>
                          ))}
                        </div>
                      </div>
                      {albumsViewMode === 'list' ? (
                        <div style={s.albumListContainer}>
                          {col.sets.map(set => (
                            <button key={set.id} style={s.albumListRow}
                              onClick={() => openAlbum({ id: set.id, title: set.title, description: set.description, photoCount: 0, videoCount: 0, coverPhotoUrl: set.coverPhotoUrl ?? '' })}
                            >
                              <div style={s.albumListThumb}>
                                {set.coverPhotoUrl
                                  ? <img src={set.coverPhotoUrl} alt="" style={s.albumListThumbImg} loading="lazy" />
                                  : <div style={s.albumCoverPlaceholder} />
                                }
                              </div>
                              <div style={s.albumListInfo}>
                                <span style={s.albumTitle}>{set.title}</span>
                              </div>
                              <span style={s.albumListChevron}>›</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ ...s.albumGrid, gridTemplateColumns: ALBUM_COLUMNS[albumsViewMode as GridSize] }}>
                          {col.sets.map(set => (
                            <div key={set.id} style={s.albumCard}
                              onClick={() => openAlbum({ id: set.id, title: set.title, description: set.description, photoCount: 0, videoCount: 0, coverPhotoUrl: set.coverPhotoUrl ?? '' })}
                            >
                              <div style={s.albumCover}>
                                {set.coverPhotoUrl
                                  ? <img src={set.coverPhotoUrl} alt="" style={s.albumCoverImg} loading="lazy" />
                                  : <div style={s.albumCoverPlaceholder} />
                                }
                              </div>
                              <div style={s.albumInfo}>
                                <span style={s.albumTitle}>{set.title}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </>
              )
            })()}
          </>
        )}
      </div>
    )
  }

  // ── Home: search + contacts
  return (
    <div style={s.container}>
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>People</h2>
          <p style={s.subheading}>Browse photos from anyone on Flickr</p>
        </div>
      </div>

      <form onSubmit={handleSearch} style={s.searchForm}>
        <input
          style={s.searchInput}
          type="text"
          placeholder="Filter contacts or search Flickr by username…"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearchError(null) }}
          disabled={searching}
        />
        <button type="submit" style={s.searchBtn} disabled={searching || !searchQuery.trim()}>
          {searching ? 'Finding…' : 'Find on Flickr'}
        </button>
      </form>

      {searchError && <div style={s.searchError}>{searchError}</div>}

      <div style={s.contactsSection}>
        <div style={s.contactsLabel}>
          {searchQuery.trim() ? `Contacts matching "${searchQuery}"` : 'Following'}
        </div>
        {contactsLoading && <div style={s.loadingState}>Loading contacts…</div>}
        {!contactsLoading && filteredContacts.length === 0 && contacts.length === 0 && (
          <div style={s.emptyState}>You are not following anyone on Flickr.</div>
        )}
        {!contactsLoading && filteredContacts.length === 0 && contacts.length > 0 && searchQuery.trim() && (
          <div style={s.emptyState}>No contacts match "{searchQuery}". Press Find to search all of Flickr.</div>
        )}
        {filteredContacts.length > 0 && (
          <div style={s.contactsGrid}>
            {filteredContacts.map(c => (
              <ContactCard key={c.nsid} contact={c} onClick={() => openContact(c)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ContactCard({ contact, onClick }: { contact: DiscoverContact; onClick: () => void }): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ ...s.contactCard, ...(hovered ? s.contactCardHover : {}) }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={contact.avatarUrl}
        alt={contact.username}
        style={s.contactAvatar}
        onError={(e) => { e.currentTarget.src = 'https://www.flickr.com/images/buddyicon.gif' }}
      />
      <span style={s.contactName}>{contact.realname || contact.username}</span>
      {contact.realname && <span style={s.contactHandle}>@{contact.username}</span>}
    </div>
  )
}

function CollectionStackIcon(): React.JSX.Element {
  return (
    <svg width="54" height="44" viewBox="0 0 54 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="14" width="38" height="28" rx="5" fill="#9e9a93" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5"/>
      <rect x="8"  y="8"  width="38" height="28" rx="5" fill="#c2bdb6" stroke="rgba(0,0,0,0.10)" strokeWidth="1.5"/>
      <rect x="2"  y="2"  width="38" height="28" rx="5" fill="#ffffff" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5"/>
    </svg>
  )
}

function DiscoverCollCard({ col, onClick }: { col: FlickrCollection; onClick: () => void }): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const albumCount = col.sets.length
  const subCount = col.collections.length
  const hasCover = col.coverUrls && col.coverUrls.length > 0
  return (
    <button
      style={{ ...s.collectionCard, ...(hovered ? s.collectionCardHover : {}) }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={s.collectionIconArea}>
        {hasCover ? (
          <div style={s.collectionCollage}>
            {[0, 1, 2, 3].map(i => col.coverUrls[i % col.coverUrls.length]).map((url, i) => (
              <img key={i} src={url} alt="" style={s.collectionCollageCell} />
            ))}
          </div>
        ) : (
          <CollectionStackIcon />
        )}
      </div>
      <div style={s.collectionCardInfo}>
        <span style={s.collectionCardTitle}>{col.title}</span>
        <div style={s.collectionChips}>
          {albumCount > 0 && <span style={s.collectionChip}>{albumCount} album{albumCount !== 1 ? 's' : ''}</span>}
          {subCount > 0 && <span style={s.collectionChip}>{subCount} sub-collection{subCount !== 1 ? 's' : ''}</span>}
        </div>
      </div>
    </button>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px 32px' },
  stickyHeader: { position: 'sticky' as const, top: 0, zIndex: 10, background: '#fff', display: 'flex', flexDirection: 'column' as const },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '20px', paddingBottom: '8px' },
  heading: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#1a1a1a' },
  subheading: { margin: '4px 0 0', fontSize: '13px', color: '#888' },
  backBtn: { background: 'none', border: 'none', color: '#0063DC', cursor: 'pointer', fontSize: '14px', padding: '4px 0', flexShrink: 0 },
  selectBtn: { background: 'none', border: '1px solid #ccc', borderRadius: '6px', padding: '5px 12px', fontSize: '13px', color: '#555', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' },
  searchForm: { display: 'flex', gap: '8px' },
  searchInput: {
    flex: 1, height: '36px', borderRadius: '8px', border: '1px solid #ddd',
    padding: '0 12px', fontSize: '14px', outline: 'none',
  },
  searchBtn: {
    height: '36px', padding: '0 20px', borderRadius: '8px',
    background: '#0063DC', color: '#fff', border: 'none', cursor: 'pointer',
    fontSize: '14px', fontWeight: 500, flexShrink: 0,
  },
  searchError: { color: '#c0392b', fontSize: '13px' },
  contactsSection: { display: 'flex', flexDirection: 'column', gap: '12px' },
  contactsLabel: { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' },
  contactsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '12px',
  },
  contactCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    padding: '12px 8px', borderRadius: '10px', cursor: 'pointer',
    border: '1px solid transparent',
  },
  contactCardHover: { background: '#f8f8f8', border: '1px solid #eee' },
  contactAvatar: { width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' },
  contactName: { fontSize: '12px', fontWeight: 500, color: '#1a1a1a', textAlign: 'center', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  contactHandle: { fontSize: '11px', color: '#aaa', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  userTabBar: { display: 'flex', gap: '0', borderBottom: '1px solid #e8e8e8', marginBottom: '0' },
  userTabBtn: {
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
    color: '#888', marginBottom: '-1px', outline: 'none',
  },
  userTabActive: { borderBottom: '2px solid #FF0084', color: '#FF0084' },
  userAvatar: { width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  userName: { fontSize: '16px', fontWeight: 600, color: '#1a1a1a' },
  userHandle: { fontSize: '12px', color: '#888' },
  toolbarArea: {
    display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' as const,
    padding: '8px 0 6px', backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #f0ede8',
    marginLeft: '-20px', marginRight: '-20px',
    paddingLeft: '20px', paddingRight: '20px',
  },
  drawerInput: {
    border: '1px solid #ddd', borderRadius: '6px', padding: '4px 8px',
    fontSize: '12px', outline: 'none', minWidth: '140px',
  },
  dateInput: {
    border: '1px solid #ddd', borderRadius: '6px', padding: '4px 8px',
    fontSize: '12px', outline: 'none', cursor: 'pointer',
  },
  dateSep: { fontSize: '12px', color: '#888' },
  applyBtn: {
    padding: '5px 14px', borderRadius: '6px', border: 'none',
    background: '#0063DC', color: '#fff', fontSize: '12px',
    fontWeight: 600, cursor: 'pointer',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' },
  albumGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
  },
  albumCard: { cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' },
  albumCover: { aspectRatio: '1', overflow: 'hidden', background: '#f0f0f0' },
  albumCoverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  albumCoverPlaceholder: { width: '100%', height: '100%', background: '#e8e8e8' },
  albumInfo: { padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '2px' },
  albumTitle: { fontSize: '13px', fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  albumMeta: { fontSize: '11px', color: '#888' },
  albumListContainer: { display: 'flex', flexDirection: 'column' },
  albumListRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: '#fff', border: 'none', borderBottom: '1px solid #f5f2ee', cursor: 'pointer', textAlign: 'left', width: '100%' },
  albumListThumb: { width: '44px', height: '44px', borderRadius: '6px', overflow: 'hidden', background: '#f0ede8', flexShrink: 0 },
  albumListThumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  albumListInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', minWidth: 0 },
  albumListChevron: { fontSize: '18px', color: '#ccc', flexShrink: 0, lineHeight: 1 },
  loadMoreRow: { display: 'flex', justifyContent: 'center', paddingTop: '8px' },
  loadMoreBtn: { padding: '8px 24px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#444' },
  loadingState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
  errorState: { textAlign: 'center', color: '#c0392b', fontSize: '14px', paddingTop: '48px' },
  emptyState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
  // Collections tab
  collectionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' },
  collectionCard: { display: 'block', width: '100%', background: '#fff', border: '1px solid #e8e4de', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', textAlign: 'left' as const, padding: 0 },
  collectionCardHover: { background: '#faf8f5' },
  collectionIconArea: { width: '100%', aspectRatio: '1', background: '#f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' as const },
  collectionCollage: { position: 'absolute' as const, inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' },
  collectionCollageCell: { width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' },
  collectionCardInfo: { padding: '10px 12px', display: 'flex', flexDirection: 'column' as const, gap: '5px' },
  collectionCardTitle: { fontSize: '13px', fontWeight: 600, color: '#111', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  collectionChips: { display: 'flex', gap: '5px', flexWrap: 'wrap' as const },
  collectionChip: { fontSize: '11px', color: '#999', background: '#f5f2ee', borderRadius: '4px', padding: '2px 6px' },
  collectionSectionLabel: { fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 12px 0' },
  collectionAlbumsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  collectionSizerGroup: { display: 'flex', gap: '2px', marginLeft: 'auto' },
  collectionBreadcrumb: { display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' },
  collectionBreadcrumbTitle: { fontSize: '14px', color: '#888' },
}
