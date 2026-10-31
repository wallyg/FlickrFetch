import React, { useState, useEffect } from 'react'
import type { FlickrAlbum } from '../../shared/types'

interface AlbumListProps {
  onAlbumSelect: (album: FlickrAlbum) => void
}

export default function AlbumList({ onAlbumSelect }: AlbumListProps): React.JSX.Element {
  const [albums, setAlbums] = useState<FlickrAlbum[]>([])
  const [pageInfo, setPageInfo] = useState<{ page: number; pages: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.flickrAPI.getAlbums(1)
      .then((data) => {
        setAlbums(data.albums)
        setPageInfo({ page: data.page, pages: data.pages, total: data.total })
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load albums'))
      .finally(() => setLoading(false))
  }, [])

  const handleLoadMore = async (): Promise<void> => {
    if (!pageInfo || pageInfo.page >= pageInfo.pages) return
    setLoadingMore(true)
    try {
      const data = await window.flickrAPI.getAlbums(pageInfo.page + 1)
      setAlbums((prev) => [...prev, ...data.albums])
      setPageInfo({ page: data.page, pages: data.pages, total: data.total })
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return <div style={styles.center}><p style={styles.message}>Loading albums…</p></div>
  }

  if (error) {
    return <div style={styles.center}><p style={styles.message}>{error}</p></div>
  }

  if (albums.length === 0) {
    return <div style={styles.center}><p style={styles.message}>No albums found.</p></div>
  }

  const hasMore = pageInfo ? pageInfo.page < pageInfo.pages : false

  return (
    <div style={styles.scroll}>
      {pageInfo && (
        <p style={styles.countLabel}>
          {pageInfo.total.toLocaleString()} album{pageInfo.total !== 1 ? 's' : ''}
        </p>
      )}
      <div style={styles.grid}>
      {albums.map((album) => (
        <button
          key={album.id}
          style={styles.card}
          onClick={() => onAlbumSelect(album)}
        >
          <div style={styles.coverWrap}>
            <img
              src={album.coverPhotoUrl}
              alt={album.title}
              style={styles.cover}
              onError={(e) => { e.currentTarget.style.background = '#ddd' }}
            />
          </div>
          <div style={styles.info}>
            <span style={styles.title}>{album.title}</span>
            <span style={styles.count}>
              {album.photoCount.toLocaleString()} photo{album.photoCount !== 1 ? 's' : ''}
              {album.videoCount > 0 ? ` · ${album.videoCount.toLocaleString()} video${album.videoCount !== 1 ? 's' : ''}` : ''}
            </span>
          </div>
        </button>
      ))}
      </div>
      {hasMore && (
        <div style={styles.loadMore}>
          <button style={styles.loadMoreBtn} onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : `Load next 500 (${pageInfo!.total - albums.length} remaining)`}
          </button>
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
  countLabel: {
    fontSize: '13px',
    color: '#888',
    margin: '0',
    padding: '16px 24px 0'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
    padding: '24px',
    boxSizing: 'border-box'
  },
  card: {
    display: 'block',
    width: '100%',
    background: '#fff',
    border: '1px solid #e8e4de',
    borderRadius: '10px',
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0,
    transition: 'box-shadow 0.15s'
  },
  coverWrap: {
    width: '100%',
    height: '180px',
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
  loadMore: {
    padding: '16px 24px',
    textAlign: 'center'
  },
  loadMoreBtn: {
    background: 'transparent',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '8px 20px',
    fontSize: '13px',
    color: '#555',
    cursor: 'pointer'
  }
}
