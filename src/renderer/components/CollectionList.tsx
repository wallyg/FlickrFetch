import React, { useState, useEffect } from 'react'
import type { FlickrCollection } from '../../shared/types'

interface CollectionListProps {
  onCollectionSelect: (collection: FlickrCollection) => void
}

export default function CollectionList({ onCollectionSelect }: CollectionListProps): React.JSX.Element {
  const [collections, setCollections] = useState<FlickrCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.flickrAPI.getCollectionTree()
      .then(setCollections)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load collections'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={styles.center}><p style={styles.message}>Loading collections…</p></div>
  }

  if (error) {
    return <div style={styles.center}><p style={styles.message}>{error}</p></div>
  }

  if (collections.length === 0) {
    return <div style={styles.center}><p style={styles.message}>No collections found.</p></div>
  }

  return (
    <div style={styles.scroll}>
      <div style={styles.grid}>
        {collections.map((col) => (
          <CollectionCard key={col.id} collection={col} onClick={() => onCollectionSelect(col)} />
        ))}
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
        <StackIcon />
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    padding: '24px',
    boxSizing: 'border-box'
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
    height: '110px',
    background: '#f0ede8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
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
