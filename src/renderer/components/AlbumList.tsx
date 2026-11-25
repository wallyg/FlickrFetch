import React, { useState, useEffect, useMemo, useRef } from 'react'
import Icon from '../ui/Icon'
import type { FlickrAlbum } from '../../shared/types'
import { GridIcon, ListIcon, loadAlbumViewMode, saveAlbumViewMode, type AlbumViewMode, type GridSize } from './PhotoGridShared'
import BackToTop from '../ui/BackToTop'
import { useFindShortcut } from '../hooks/useFindShortcut'

type AlbumSearchOperator = 'contains' | 'starts' | 'ends' | 'exact'

const GRID_COLUMNS: Record<GridSize, string> = {
  small:  'repeat(auto-fill, minmax(130px, 1fr))',
  medium: 'repeat(auto-fill, minmax(180px, 1fr))',
  large:  'repeat(auto-fill, minmax(240px, 1fr))'
}

const COVER_HEIGHT: Record<GridSize, string> = {
  small: '130px',
  medium: '180px',
  large: '240px'
}

interface AlbumListProps {
  onAlbumSelect: (album: FlickrAlbum) => void
  active?: boolean   // this tab is showing (Cmd+F then jumps to the search box)
}

export default function AlbumList({ onAlbumSelect, active = true }: AlbumListProps): React.JSX.Element {
  const searchRef = useRef<HTMLInputElement | null>(null)
  useFindShortcut(active, searchRef)
  const [albums, setAlbums] = useState<FlickrAlbum[]>([])
  const [pageInfo, setPageInfo] = useState<{ page: number; pages: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingAll, setLoadingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<AlbumViewMode>(loadAlbumViewMode)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOperator, setSearchOperator] = useState<AlbumSearchOperator>('contains')
  const [tooltip, setTooltip] = useState<{ title: string; x: number; y: number } | null>(null)

  const setAndSaveViewMode = (mode: AlbumViewMode): void => {
    setViewMode(mode)
    saveAlbumViewMode(mode)
  }

  useEffect(() => {
    let cancelled = false

    const loadAll = async (): Promise<void> => {
      try {
        const first = await window.flickrAPI.getAlbums(1)
        if (cancelled) return
        setAlbums(first.albums)
        setPageInfo({ page: first.page, pages: first.pages, total: first.total })
        setLoading(false)

        if (first.pages > 1) {
          setLoadingAll(true)
          for (let p = 2; p <= first.pages; p++) {
            if (cancelled) return
            const next = await window.flickrAPI.getAlbums(p)
            if (cancelled) return
            setAlbums(prev => [...prev, ...next.albums])
            setPageInfo({ page: next.page, pages: next.pages, total: next.total })
          }
          if (!cancelled) setLoadingAll(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load albums')
          setLoading(false)
        }
      }
    }

    loadAll()
    return () => { cancelled = true }
  }, [])

  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albums
    const q = searchQuery.trim().toLowerCase()
    return albums.filter(a => {
      const t = a.title.toLowerCase()
      if (searchOperator === 'starts') return t.startsWith(q)
      if (searchOperator === 'ends') return t.endsWith(q)
      if (searchOperator === 'exact') return t === q
      return t.includes(q)
    })
  }, [albums, searchQuery, searchOperator])

  if (loading) {
    return (
      <div style={styles.scroll}>
        <style>{`@keyframes ff-al-shimmer { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }`}</style>
        <div style={{ ...styles.grid, gridTemplateColumns: GRID_COLUMNS['medium'], padding: '16px' }}>
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} style={{ borderRadius: '8px', overflow: 'hidden', animation: `ff-al-shimmer 1.4s ease-in-out infinite`, animationDelay: `${(i % 6) * 0.08}s` }}>
              <div style={{ height: '180px', background: 'var(--ff-border)' }} />
              <div style={{ padding: '10px 12px', background: 'var(--ff-grey-100)' }}>
                <div style={{ height: '12px', background: 'var(--ff-border)', borderRadius: '4px', marginBottom: '6px', width: '75%' }} />
                <div style={{ height: '10px', background: 'var(--ff-border)', borderRadius: '4px', width: '45%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <div style={styles.center}><p style={styles.message}>{error}</p></div>
  }

  if (albums.length === 0) {
    return <div style={styles.center}><p style={styles.message}>No albums found for your Flickr account.</p></div>
  }

  const gridSize = viewMode === 'list' ? 'medium' : viewMode

  return (
    <div style={styles.scroll}>
      <div style={styles.toolbar}>
        <div style={styles.searchGroup}>
          <select
            style={styles.operatorSelect}
            value={searchOperator}
            onChange={e => setSearchOperator(e.target.value as AlbumSearchOperator)}
          >
            <option value="contains">Name contains</option>
            <option value="starts">Starts with</option>
            <option value="ends">Ends with</option>
            <option value="exact">Exact match</option>
          </select>
          <input
            ref={searchRef}
            style={styles.searchInput}
            type="text"
            placeholder="Search albums…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button style={styles.searchClearBtn} onClick={() => setSearchQuery('')}><Icon name="close" /></button>
          )}
        </div>
        <div style={styles.rightGroup}>
          <span style={styles.countLabel}>
            {searchQuery
              ? `${filteredAlbums.length.toLocaleString()} of ${pageInfo?.total.toLocaleString() ?? albums.length} album${(pageInfo?.total ?? albums.length) !== 1 ? 's' : ''}${loadingAll ? ' · loading more…' : ''}`
              : loadingAll
                ? `${albums.length.toLocaleString()} of ${pageInfo?.total.toLocaleString() ?? '…'} loaded…`
                : `${pageInfo?.total.toLocaleString() ?? albums.length} album${(pageInfo?.total ?? albums.length) !== 1 ? 's' : ''}`
            }
          </span>
          <div style={styles.segGroupDensity}>
            <button
              style={{ ...styles.densityBtn, ...(viewMode === 'list' ? styles.densityBtnActive : {}) }}
              onClick={() => setAndSaveViewMode('list')}
              title="List view"
            >
              <ListIcon />
            </button>
            {(['small', 'medium', 'large'] as GridSize[]).map(v => (
              <button
                key={v}
                style={{ ...styles.densityBtn, ...(viewMode === v ? styles.densityBtnActive : {}) }}
                onClick={() => setAndSaveViewMode(v)}
                title={v === 'small' ? 'Small grid' : v === 'medium' ? 'Medium grid' : 'Large grid'}
              >
                <GridIcon size={v} />
              </button>
            ))}
          </div>
        </div>
      </div>
      {filteredAlbums.length === 0 && searchQuery && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--ff-text-secondary)', fontSize: '14px', margin: '0 0 12px' }}>No albums match "{searchQuery}".</p>
          <button style={{ background: 'none', border: '1px solid var(--ff-line-strong)', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', color: 'var(--ff-text-secondary)', cursor: 'pointer' }} onClick={() => setSearchQuery('')}>
            Clear Search
          </button>
        </div>
      )}
      {viewMode === 'list' ? (
        <div style={styles.listContainer}>
          {filteredAlbums.map((album) => (
            <AlbumListRow key={album.id} album={album} onClick={() => onAlbumSelect(album)} />
          ))}
        </div>
      ) : (
        <div style={{ ...styles.grid, gridTemplateColumns: GRID_COLUMNS[gridSize] }}>
          {filteredAlbums.map((album) => (
            <button
              key={album.id}
              style={styles.card}
              onClick={() => onAlbumSelect(album)}
            >
              <div style={{ ...styles.coverWrap, height: COVER_HEIGHT[gridSize] }}>
                <img
                  src={album.coverPhotoUrl}
                  alt={album.title}
                  style={styles.cover}
                  onError={(e) => { e.currentTarget.style.background = 'var(--ff-line-strong)' }}
                />
              </div>
              <div style={styles.info}>
                <span
                  style={styles.title}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget
                    if (el.scrollWidth > el.clientWidth) {
                      const r = el.getBoundingClientRect()
                      setTooltip({ title: album.title, x: r.left, y: r.top })
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >{album.title}</span>
                <span style={styles.count}>
                  {album.photoCount.toLocaleString()} photo{album.photoCount !== 1 ? 's' : ''}
                  {album.videoCount > 0 ? ` · ${album.videoCount.toLocaleString()} video${album.videoCount !== 1 ? 's' : ''}` : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {tooltip && (
        <div style={{ position: 'fixed', left: tooltip.x, top: tooltip.y - 4, transform: 'translateY(-100%)', background: 'color-mix(in srgb, var(--ff-text) 92%, transparent)', color: 'var(--ff-white)', padding: '4px 9px', borderRadius: '6px', fontSize: '12px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 'var(--ff-z-hover)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tooltip.title}
        </div>
      )}
      <BackToTop />
    </div>
  )
}

function AlbumListRow({ album, onClick }: { album: FlickrAlbum; onClick: () => void }): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      style={{ ...styles.listRow, ...(hovered ? styles.listRowHover : {}) }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.listThumb}>
        <img src={album.coverPhotoUrl} alt="" style={styles.listThumbImg} onError={(e) => { e.currentTarget.style.display = 'none' }} />
      </div>
      <div style={styles.listInfo}>
        <span style={styles.listTitle}>{album.title}</span>
        <span style={styles.listCount}>
          {album.photoCount.toLocaleString()} photo{album.photoCount !== 1 ? 's' : ''}
          {album.videoCount > 0 ? ` · ${album.videoCount.toLocaleString()} video${album.videoCount !== 1 ? 's' : ''}` : ''}
        </span>
      </div>
      <span style={styles.listChevron}>›</span>
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  message: {
    color: 'var(--ff-text-secondary)',
    fontSize: '14px'
  },
  scroll: {
    height: '100%',
    overflowY: 'auto'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px 8px',
    position: 'sticky' as const,
    top: 0,
    zIndex: 'var(--ff-z-sticky)',
    backgroundColor: 'var(--ff-grey-100)',
    borderBottom: '1px solid var(--ff-border)',
  },
  rightGroup: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  countLabel: {
    fontSize: '12px',
    color: 'var(--ff-text-secondary)',
  },
  searchGroup: {
    display: 'flex', alignItems: 'center',
    border: '1px solid var(--ff-line-strong)', borderRadius: '6px',
    overflow: 'hidden', backgroundColor: 'var(--ff-surface)'
  },
  operatorSelect: {
    background: 'var(--ff-grey-100)', border: 'none', borderRight: '1px solid var(--ff-line-strong)',
    padding: '5px 6px', fontSize: '11px', color: 'var(--ff-text-secondary)', cursor: 'pointer',
    outline: 'none'
  },
  searchInput: {
    border: 'none', outline: 'none', padding: '5px 8px',
    fontSize: '12px', color: 'var(--ff-text)', minWidth: '160px', background: 'transparent'
  },
  searchClearBtn: {
    background: 'none', border: 'none', padding: '0 6px',
    fontSize: '11px', color: 'var(--ff-text-secondary)', cursor: 'pointer'
  },
  segGroupDensity: { display: 'flex', gap: '2px' },
  densityBtn: { background: 'none', border: 'none', padding: '4px 5px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', color: 'var(--ff-text-secondary)' },
  densityBtnActive: { backgroundColor: 'var(--ff-border)', color: 'var(--ff-text)' },
  grid: {
    display: 'grid',
    gap: '16px',
    padding: '16px 16px 24px',
    boxSizing: 'border-box' as const
  },
  card: {
    display: 'block',
    width: '100%',
    background: 'var(--ff-surface)',
    border: '1px solid var(--ff-border)',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left' as const,
    padding: 0,
    transition: 'box-shadow 0.15s'
  },
  coverWrap: {
    width: '100%',
    overflow: 'hidden',
    background: 'var(--ff-grey-100)'
  },
  cover: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block'
  },
  info: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px'
  },
  title: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--ff-text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  count: {
    fontSize: '12px',
    color: 'var(--ff-text-secondary)'
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 0',
  },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    background: 'var(--ff-surface)',
    border: 'none',
    borderBottom: '1px solid var(--ff-warm)',
    cursor: 'pointer',
    textAlign: 'left' as const,
    width: '100%',
    transition: 'background 0.1s',
  },
  listRowHover: {
    background: 'var(--ff-cream)',
  },
  listThumb: {
    width: '44px',
    height: '44px',
    borderRadius: '6px',
    overflow: 'hidden',
    background: 'var(--ff-grey-100)',
    flexShrink: 0,
  },
  listThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  listInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'hidden',
    minWidth: 0,
  },
  listTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--ff-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listCount: {
    fontSize: '11px',
    color: 'var(--ff-text-secondary)',
  },
  listChevron: {
    fontSize: '18px',
    color: 'var(--ff-text-muted)',
    flexShrink: 0,
    lineHeight: 1,
  },
}
