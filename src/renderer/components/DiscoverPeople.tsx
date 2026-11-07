import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { FlickrPhoto, FlickrAlbum, DiscoverUser, DiscoverContact } from '../../shared/types'
import PhotoDetail from './PhotoDetail'
import { AttributionNotice, DiscoverTile, DiscoverSelectBar } from './DiscoverExplore'
import SmartDownloadButton from './SmartDownloadButton'

type PeopleView = 'home' | 'user-photos' | 'user-albums' | 'album-photos' | 'photo-detail'
type UserTab = 'photos' | 'albums'

export default function DiscoverPeople(): React.JSX.Element {
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

  // Multi-select for user photos
  const [userSelectMode, setUserSelectMode] = useState(false)
  const [userSelectedIds, setUserSelectedIds] = useState<Set<string>>(new Set())
  const [userDownloading, setUserDownloading] = useState(false)

  // Multi-select for album photos
  const [albumSelectMode, setAlbumSelectMode] = useState(false)
  const [albumSelectedIds, setAlbumSelectedIds] = useState<Set<string>>(new Set())
  const [albumDownloading, setAlbumDownloading] = useState(false)

  const loadedContactsRef = useRef(false)

  useEffect(() => {
    if (loadedContactsRef.current) return
    loadedContactsRef.current = true
    setContactsLoading(true)
    window.flickrAPI.discoverGetContacts()
      .then(c => { setContacts(c); setContactsLoading(false) })
      .catch(() => setContactsLoading(false))
  }, [])

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
    setUserAlbums([]) // clear stale albums from previous user
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
    try {
      const result = await window.flickrAPI.discoverGetPublicPhotos(user.nsid, 1)
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

  const loadMorePhotos = useCallback(async (): Promise<void> => {
    if (!foundUser || photosLoadingMore || photosPage >= photosPages) return
    setPhotosLoadingMore(true)
    try {
      const result = await window.flickrAPI.discoverGetPublicPhotos(foundUser.nsid, photosPage + 1)
      setUserPhotos(prev => [...prev, ...result.photos])
      setPhotosPage(result.page)
    } catch { /* ignore */ }
    finally { setPhotosLoadingMore(false) }
  }, [foundUser, photosLoadingMore, photosPage, photosPages])

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
    const selected = userPhotos.filter(p => userSelectedIds.has(p.id)).map(p => ({ id: p.id, title: p.title }))
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

  // ── Photo detail view
  if (detailIndex !== null) {
    const currentPhotos = view === 'album-photos' ? albumPhotos : userPhotos
    if (!currentPhotos[detailIndex]) { setDetailIndex(null); return <></> }
    const hasMore = view === 'album-photos' ? albumPhotosPage < albumPhotosPages : photosPage < photosPages
    const sourceName = view === 'album-photos' ? (activeAlbum?.title ?? '') : (foundUser ? (foundUser.realname || foundUser.username) : '')
    return (
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
    )
  }

  // ── Album photo grid
  if (view === 'album-photos' && activeAlbum && foundUser) {
    return (
      <div style={s.container}>
        <div style={s.headerRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button style={s.backBtn} onClick={() => { setView('user-photos'); setUserTab('albums'); setActiveAlbum(null) }}>
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
              <button style={s.selectBtn} onClick={() => setAlbumSelectMode(true)}>Select</button>
            )}
            {albumSelectMode && (
              <button style={s.selectBtn} onClick={() => { setAlbumSelectMode(false); setAlbumSelectedIds(new Set()) }}>Cancel</button>
            )}
          </div>
        </div>
        {albumSelectMode && (
          <DiscoverSelectBar
            count={albumSelectedIds.size}
            total={albumPhotos.length}
            onDownload={handleAlbumDownloadSelected}
            onCancel={() => { setAlbumSelectMode(false); setAlbumSelectedIds(new Set()) }}
            downloading={albumDownloading}
          />
        )}
        <AttributionNotice />
        {albumPhotosLoading && <div style={s.loadingState}>Loading album…</div>}
        {albumPhotosError && <div style={s.errorState}>{albumPhotosError}</div>}
        {albumPhotos.length > 0 && (
          <>
            <div style={s.grid}>
              {albumPhotos.map((photo, idx) => (
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
              {userPhotos.length > 0 && !userSelectMode && (
                <button style={s.selectBtn} onClick={() => setUserSelectMode(true)}>Select</button>
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
            onClick={() => { setUserTab('albums'); loadAlbums() }}
          >Albums</button>
        </div>

        {userTab === 'photos' && userSelectMode && (
          <DiscoverSelectBar
            count={userSelectedIds.size}
            total={userPhotos.length}
            onDownload={handleUserDownloadSelected}
            onCancel={() => { setUserSelectMode(false); setUserSelectedIds(new Set()) }}
            downloading={userDownloading}
          />
        )}

        <AttributionNotice />

        {userTab === 'photos' && (
          <>
            {photosLoading && <div style={s.loadingState}>Loading photos…</div>}
            {photosError && <div style={s.errorState}>{photosError}</div>}
            {!photosLoading && !photosError && userPhotos.length === 0 && (
              <div style={s.emptyState}>No public photos found.</div>
            )}
            {userPhotos.length > 0 && (
              <>
                <div style={s.grid}>
                  {userPhotos.map((photo, idx) => (
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
                {photosPage < photosPages && (
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
            {albumsLoading && <div style={s.loadingState}>Loading albums…</div>}
            {albumsError && <div style={s.errorState}>{albumsError}</div>}
            {!albumsLoading && !albumsError && userAlbums.length === 0 && (
              <div style={s.emptyState}>No public albums.</div>
            )}
            {userAlbums.length > 0 && (
              <div style={s.albumGrid}>
                {userAlbums.map(album => (
                  <div key={album.id} style={s.albumCard} onClick={() => openAlbum(album)}>
                    <div style={s.albumCover}>
                      {album.coverPhotoUrl
                        ? <img src={album.coverPhotoUrl} alt="" style={s.albumCoverImg} />
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
            )}
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

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px 32px' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '20px' },
  heading: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#1a1a1a' },
  subheading: { margin: '4px 0 0', fontSize: '13px', color: '#888' },
  backBtn: { background: 'none', border: 'none', color: '#0063DC', cursor: 'pointer', fontSize: '14px', padding: '4px 0', flexShrink: 0 },
  selectBtn: { padding: '6px 14px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#444', flexShrink: 0 },
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
  contactName: { fontSize: '12px', fontWeight: 500, color: '#1a1a1a', textAlign: 'center', lineHeight: 1.3 },
  contactHandle: { fontSize: '11px', color: '#aaa', textAlign: 'center' },
  userTabBar: { display: 'flex', gap: '0', borderBottom: '1px solid #e8e8e8', marginBottom: '4px' },
  userTabBtn: {
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
    color: '#888', marginBottom: '-1px', outline: 'none',
  },
  userTabActive: { borderBottom: '2px solid #FF0084', color: '#FF0084' },
  userAvatar: { width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  userName: { fontSize: '16px', fontWeight: 600, color: '#1a1a1a' },
  userHandle: { fontSize: '12px', color: '#888' },
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
  loadMoreRow: { display: 'flex', justifyContent: 'center', paddingTop: '8px' },
  loadMoreBtn: { padding: '8px 24px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#444' },
  loadingState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
  errorState: { textAlign: 'center', color: '#c0392b', fontSize: '14px', paddingTop: '48px' },
  emptyState: { textAlign: 'center', color: '#888', fontSize: '14px', paddingTop: '48px' },
}
