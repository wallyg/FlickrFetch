import React, { useState, useEffect, useMemo } from 'react'
import type { FlickrAlbum } from '../../shared/types'

type GridSize = 'small' | 'medium' | 'large'
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

function GridIcon({ size }: { size: GridSize }): React.JSX.Element {
  if (size === 'small') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      {[0, 3.5, 7, 10.5].flatMap(x => [0, 3.5, 7, 10.5].map(y =>
        <rect key={`${x}-${y}`} x={x} y={y} width="2.5" height="2.5" rx="0.4" />
      ))}
    </svg>
  )
  if (size === 'medium') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      {[0, 5, 10].flatMap(x => [0, 5, 10].map(y =>
        <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx="0.6" />
      ))}
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      {[0, 8].flatMap(x => [0, 8].map(y =>
        <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" rx="1" />
      ))}
    </svg>
  )
}

interface AlbumListProps {
  onAlbumSelect: (album: FlickrAlbum) => void
}

export default function AlbumList({ onAlbumSelect }: AlbumListProps): React.JSX.Element {
  const [albums, setAlbums] = useState<FlickrAlbum[]>([])
  const [pageInfo, setPageInfo] = useState<{ page: number; pages: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingAll, setLoadingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gridSize, setGridSize] = useState<GridSize>('medium')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOperator, setSearchOperator] = useState<AlbumSearchOperator>('contains')
  const [tooltip, setTooltip] = useState<{ title: string; x: number; y: number } | null>(null)

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
    return <div style={styles.center}><p style={styles.message}>Loading albums…</p></div>
  }

  if (error) {
    return <div style={styles.center}><p style={styles.message}>{error}</p></div>
  }

  if (albums.length === 0) {
    return <div style={styles.center}><p style={styles.message}>No albums found.</p></div>
  }

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
            style={styles.searchInput}
            type="text"
            placeholder="Search albums…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button style={styles.searchClearBtn} onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
        <span style={styles.countLabel}>
          {searchQuery
            ? `${filteredAlbums.length.toLocaleString()} of ${pageInfo?.total.toLocaleString() ?? albums.length} album${(pageInfo?.total ?? albums.length) !== 1 ? 's' : ''}${loadingAll ? ' · loading more…' : ''}`
            : loadingAll
              ? `${albums.length.toLocaleString()} of ${pageInfo?.total.toLocaleString() ?? '…'} loaded…`
              : `${pageInfo?.total.toLocaleString() ?? albums.length} album${(pageInfo?.total ?? albums.length) !== 1 ? 's' : ''}`
          }
        </span>
        <div style={styles.segGroupDensity}>
          {(['small', 'medium', 'large'] as GridSize[]).map(v => (
            <button
              key={v}
              style={{ ...styles.densityBtn, ...(gridSize === v ? styles.densityBtnActive : {}) }}
              onClick={() => setGridSize(v)}
              title={v === 'small' ? 'Small grid' : v === 'medium' ? 'Medium grid' : 'Large grid'}
            >
              <GridIcon size={v} />
            </button>
          ))}
        </div>
      </div>
      {filteredAlbums.length === 0 && searchQuery && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '14px', margin: '0 0 12px' }}>No albums match "{searchQuery}".</p>
          <button style={{ background: 'none', border: '1px solid #ccc', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', color: '#555', cursor: 'pointer' }} onClick={() => setSearchQuery('')}>
            Clear search
          </button>
        </div>
      )}
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
              onError={(e) => { e.currentTarget.style.background = '#ddd' }}
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
      {tooltip && (
        <div style={{ position: 'fixed', left: tooltip.x, top: tooltip.y - 4, transform: 'translateY(-100%)', background: 'rgba(30,28,26,0.92)', color: '#fff', padding: '4px 9px', borderRadius: '5px', fontSize: '12px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999, maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tooltip.title}
        </div>
      )}
    </div>
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
    color: '#888',
    fontSize: '15px'
  },
  scroll: {
    height: '100%',
    overflowY: 'auto'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
    padding: '10px 16px 8px',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #f0ede8',
  },
  countLabel: {
    fontSize: '12px',
    color: '#888',
    margin: '0',
  },
  searchGroup: {
    display: 'flex', alignItems: 'center',
    border: '1px solid #ddd', borderRadius: '6px',
    overflow: 'hidden', backgroundColor: '#fff'
  },
  operatorSelect: {
    background: '#f5f5f5', border: 'none', borderRight: '1px solid #ddd',
    padding: '5px 6px', fontSize: '11px', color: '#555', cursor: 'pointer',
    outline: 'none'
  },
  searchInput: {
    border: 'none', outline: 'none', padding: '5px 8px',
    fontSize: '12px', color: '#333', minWidth: '160px', background: 'transparent'
  },
  searchClearBtn: {
    background: 'none', border: 'none', padding: '0 6px',
    fontSize: '11px', color: '#aaa', cursor: 'pointer'
  },
  segGroupDensity: { display: 'flex', gap: '2px' },
  densityBtn: { background: 'none', border: 'none', padding: '4px 5px', cursor: 'pointer', borderRadius: '5px', display: 'flex', alignItems: 'center', color: '#bbb' },
  densityBtnActive: { backgroundColor: '#ece8e2', color: '#333' },
  grid: {
    display: 'grid',
    gap: '16px',
    padding: '16px 16px 24px',
    boxSizing: 'border-box' as const
  },
  card: {
    display: 'block',
    width: '100%',
    background: '#fff',
    border: '1px solid #e8e4de',
    borderRadius: '10px',
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left' as const,
    padding: 0,
    transition: 'box-shadow 0.15s'
  },
  coverWrap: {
    width: '100%',
    overflow: 'hidden',
    background: '#f0ede8'
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
    fontWeight: '600',
    color: '#111',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  count: {
    fontSize: '12px',
    color: '#999'
  },
}
