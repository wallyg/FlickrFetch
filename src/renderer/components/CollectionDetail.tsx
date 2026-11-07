import React, { useState } from 'react'
import type { FlickrCollection, FlickrSet } from '../../shared/types'
import { GridIcon, ListIcon, loadAlbumViewMode, saveAlbumViewMode, type AlbumViewMode, type GridSize } from './PhotoGridShared'

interface CollectionDetailProps {
  collection: FlickrCollection
  onCollectionSelect: (collection: FlickrCollection) => void
  onSetSelect: (set: FlickrSet) => void
}

export default function CollectionDetail({ collection, onCollectionSelect, onSetSelect }: CollectionDetailProps): React.JSX.Element {
  const hasSubCollections = collection.collections.length > 0
  const hasSets = collection.sets.length > 0
  const [viewMode, setViewMode] = useState<AlbumViewMode>(loadAlbumViewMode)

  const setAndSaveViewMode = (mode: AlbumViewMode): void => {
    setViewMode(mode)
    saveAlbumViewMode(mode)
  }

  if (!hasSubCollections && !hasSets) {
    return <div style={styles.center}><p style={styles.message}>This collection is empty.</p></div>
  }

  return (
    <div style={styles.scroll}>
      {hasSubCollections && (
        <section>
          {hasSets && <p style={styles.sectionLabel}>Sub-collections</p>}
          <div style={styles.grid}>
            {collection.collections.map((sub) => (
              <SubCollectionCard key={sub.id} collection={sub} onClick={() => onCollectionSelect(sub)} />
            ))}
          </div>
        </section>
      )}

      {hasSets && (
        <section>
          <div style={styles.albumsHeader}>
            {hasSubCollections && <p style={{ ...styles.sectionLabel, margin: 0 }}>Albums</p>}
            <div style={styles.sizerGroup}>
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
          {viewMode === 'list' ? (
            <div style={styles.albumList}>
              {collection.sets.map((set) => (
                <AlbumRow key={set.id} set={set} onClick={() => onSetSelect(set)} />
              ))}
            </div>
          ) : (
            <div style={{ ...styles.albumGrid, gridTemplateColumns: viewMode === 'small' ? 'repeat(auto-fill, minmax(130px, 1fr))' : viewMode === 'large' ? 'repeat(auto-fill, minmax(240px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {collection.sets.map((set) => (
                <AlbumGridCard key={set.id} set={set} gridSize={viewMode as GridSize} onClick={() => onSetSelect(set)} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function SubCollectionCard({ collection, onClick }: { collection: FlickrCollection; onClick: () => void }): React.JSX.Element {
  const albumCount = collection.sets.length
  const subCount = collection.collections.length
  const hasCover = collection.coverUrls && collection.coverUrls.length > 0
  return (
    <button style={styles.card} onClick={onClick}>
      <div style={styles.iconArea}>
        {hasCover ? (
          <div style={styles.collage}>
            {[0, 1, 2, 3].map(i => collection.coverUrls[i % collection.coverUrls.length]).map((url, i) => (
              <img key={i} src={url} alt="" style={styles.collageCell} />
            ))}
          </div>
        ) : (
          <StackIcon />
        )}
      </div>
      <div style={styles.cardInfo}>
        <span style={styles.cardTitle}>{collection.title}</span>
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

function AlbumGridCard({ set, gridSize, onClick }: { set: FlickrSet; gridSize: GridSize; onClick: () => void }): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const height = gridSize === 'small' ? '130px' : gridSize === 'large' ? '240px' : '180px'
  return (
    <button
      style={{ ...styles.albumCard, ...(hovered ? styles.albumCardHover : {}) }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ ...styles.albumCardIcon, height }}>
        {set.coverPhotoUrl
          ? <img src={set.coverPhotoUrl} alt="" style={styles.albumCardCover} />
          : <StackIcon />
        }
      </div>
      <div style={styles.albumCardInfo}>
        <span style={styles.albumCardTitle}>{set.title}</span>
      </div>
    </button>
  )
}

function AlbumRow({ set, onClick }: { set: FlickrSet; onClick: () => void }): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      style={{ ...styles.albumRow, ...(hovered ? styles.albumRowHover : {}) }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.albumThumb}>
        {set.coverPhotoUrl
          ? <img src={set.coverPhotoUrl} alt="" style={styles.albumThumbImg} />
          : <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="3" width="14" height="12" rx="2" fill="#d4cfc8" /><rect x="3" y="1" width="14" height="12" rx="2" fill="#e8e4de" stroke="#ccc" strokeWidth="0.75" /></svg>
        }
      </div>
      <span style={styles.albumRowTitle}>{set.title}</span>
      <span style={styles.albumRowChevron}>›</span>
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
    color: '#888',
    fontSize: '15px'
  },
  scroll: {
    height: '100%',
    overflowY: 'auto',
    padding: '24px',
    boxSizing: 'border-box'
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '0 0 12px 0'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
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
  cardInfo: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  cardTitle: {
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
  },
  albumsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  sizerGroup: {
    display: 'flex',
    gap: '2px',
    marginLeft: 'auto',
  },
  densityBtn: {
    background: 'none',
    border: 'none',
    padding: '4px 5px',
    cursor: 'pointer',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    color: '#bbb',
  },
  densityBtnActive: {
    backgroundColor: '#ece8e2',
    color: '#333',
  },
  albumGrid: {
    display: 'grid',
    gap: '12px',
  },
  albumCard: {
    display: 'block',
    width: '100%',
    background: '#fff',
    border: '1px solid #e8e4de',
    borderRadius: '10px',
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left' as const,
    padding: 0,
  },
  albumCardHover: {
    background: '#faf8f5',
  },
  albumCardIcon: {
    width: '100%',
    background: '#f0ede8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumCardCover: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  albumCardInfo: {
    padding: '8px 10px',
  },
  albumCardTitle: {
    fontSize: '12px',
    fontWeight: '600' as const,
    color: '#111',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    display: 'block',
  },
  albumList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  albumRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 14px',
    background: '#fff',
    border: '1px solid #e8e4de',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'background 0.1s'
  },
  albumRowHover: {
    background: '#faf8f5'
  },
  albumThumb: {
    width: '44px',
    height: '44px',
    borderRadius: '6px',
    overflow: 'hidden',
    background: '#f0ede8',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  albumRowTitle: {
    flex: 1,
    fontSize: '13px',
    color: '#111',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  albumRowChevron: {
    fontSize: '16px',
    color: '#ccc',
    flexShrink: 0
  }
}
