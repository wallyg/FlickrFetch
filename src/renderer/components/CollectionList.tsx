import React, { useState, useEffect, useMemo } from 'react'
import type { FlickrCollection } from '../../shared/types'

type SearchOperator = 'contains' | 'starts' | 'ends' | 'exact'

interface CollectionListProps {
  onCollectionSelect: (collection: FlickrCollection) => void
}

export default function CollectionList({ onCollectionSelect }: CollectionListProps): React.JSX.Element {
  const [collections, setCollections] = useState<FlickrCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOperator, setSearchOperator] = useState<SearchOperator>('contains')

  useEffect(() => {
    window.flickrAPI.getCollectionTree()
      .then(setCollections)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load collections'))
      .finally(() => setLoading(false))
  }, [])

  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections
    const q = searchQuery.trim().toLowerCase()
    return collections.filter(col => {
      const t = col.title.toLowerCase()
      if (searchOperator === 'starts') return t.startsWith(q)
      if (searchOperator === 'ends') return t.endsWith(q)
      if (searchOperator === 'exact') return t === q
      return t.includes(q)
    })
  }, [collections, searchQuery, searchOperator])

  if (loading) {
    return <div style={styles.center}><p style={styles.message}>Loading collections…</p></div>
  }

  if (error) {
    return <div style={styles.center}><p style={styles.message}>{error}</p></div>
  }

  if (collections.length === 0) {
    return <div style={styles.center}><p style={styles.message}>No collections found for your Flickr account.</p></div>
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <div style={styles.searchGroup}>
          <select
            style={styles.operatorSelect}
            value={searchOperator}
            onChange={e => setSearchOperator(e.target.value as SearchOperator)}
          >
            <option value="contains">Contains</option>
            <option value="starts">Starts with</option>
            <option value="ends">Ends with</option>
            <option value="exact">Exact</option>
          </select>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search collections…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button style={styles.clearBtn} onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
        <span style={styles.countLabel}>
          {searchQuery
            ? `${filteredCollections.length} of ${collections.length} collection${collections.length !== 1 ? 's' : ''}`
            : `${collections.length} collection${collections.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      <div style={styles.scroll}>
        {filteredCollections.length === 0 && searchQuery ? (
          <div style={styles.center}>
            <p style={styles.message}>No collections match "{searchQuery}".</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredCollections.map((col) => (
              <CollectionCard key={col.id} collection={col} onClick={() => onCollectionSelect(col)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CollectionCard({ collection, onClick }: { collection: FlickrCollection; onClick: () => void }): React.JSX.Element {
  const albumCount = collection.sets.length
  const subCount = collection.collections.length
  return (
    <button style={styles.card} onClick={onClick}>
      <div style={styles.iconArea}>
        {collection.coverUrls.length > 0
          ? <CollageThumbnail urls={collection.coverUrls} />
          : <StackIcon />}
      </div>
      <div style={styles.info}>
        <span style={styles.title}>{collection.title}</span>
        <div style={styles.chips}>
          {albumCount > 0 && <span style={styles.chip}>{albumCount} album{albumCount !== 1 ? 's' : ''}</span>}
          {subCount > 0 && <span style={styles.chip}>{subCount} sub-collection{subCount !== 1 ? 's' : ''}</span>}
        </div>
      </div>
    </button>
  )
}

function CollageThumbnail({ urls }: { urls: string[] }): React.JSX.Element {
  const filled = [0, 1, 2, 3].map(i => urls[i % urls.length])
  return (
    <div style={styles.collage}>
      {filled.map((url, i) => (
        <img key={i} src={url} alt="" style={styles.collageCell} />
      ))}
    </div>
  )
}

function StackIcon(): React.JSX.Element {
  return (
    <svg width="54" height="44" viewBox="0 0 54 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="14" width="38" height="28" rx="5" fill="#9e9a93" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5"/>
      <rect x="8"  y="8"  width="38" height="28" rx="5" fill="#c2bdb6" stroke="rgba(0,0,0,0.10)" strokeWidth="1.5"/>
      <rect x="2"  y="2"  width="38" height="28" rx="5" fill="#ffffff" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5"/>
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 24px',
    borderBottom: '1px solid #ede9e3',
    flexShrink: 0
  },
  searchGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1
  },
  operatorSelect: {
    fontSize: '12px',
    color: '#555',
    background: '#f5f2ee',
    border: '1px solid #ddd8d1',
    borderRadius: '6px',
    padding: '5px 8px',
    cursor: 'pointer',
    flexShrink: 0
  },
  searchInput: {
    flex: 1,
    fontSize: '13px',
    padding: '5px 10px',
    border: '1px solid #ddd8d1',
    borderRadius: '6px',
    background: '#fff',
    color: '#111',
    outline: 'none'
  },
  clearBtn: {
    fontSize: '11px',
    color: '#999',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 6px',
    flexShrink: 0
  },
  countLabel: {
    fontSize: '12px',
    color: '#aaa',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0
  },
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
    flex: 1,
    overflowY: 'auto'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    padding: '24px',
    boxSizing: 'border-box' as const
  },
  card: {
    display: 'block',
    width: '100%',
    background: '#fff',
    border: '1px solid #e8e4de',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0
  },
  iconArea: {
    width: '100%',
    aspectRatio: '1',
    background: '#f0ede8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative'
  },
  collage: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
  },
  collageCell: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block'
  },
  info: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  title: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#111',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  chips: {
    display: 'flex',
    gap: '5px',
    flexWrap: 'wrap' as const
  },
  chip: {
    fontSize: '11px',
    color: '#999',
    background: '#f5f2ee',
    borderRadius: '4px',
    padding: '2px 6px'
  }
}
