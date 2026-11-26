import React, { useEffect, useState } from 'react'
import Icon from '../ui/Icon'
import type { AlbumFitPhoto, AlbumItem, AlbumKind } from '../../shared/types'
import BatchEditButton from './BatchEditButton'
import { quietBtn, selectCompact, linkBtn, putAsideBtn } from '../ui/kit'
import PhotoStrip from './PhotoStrip'

// The rows of the album fit lists. A May be missing row is quiet until you open it: the album, how many photos may belong,
// a one-line reason and the buttons. "Show the photos" unfolds the album's description, the suggested photos (each can be
// ticked or opened on Flickr) and the full reason. Nothing here changes Flickr.

export const actionStyles: Record<string, React.CSSProperties> = {
  link: { ...linkBtn, fontSize: 13 },    // looks at something on Flickr
  fix: { ...quietBtn, borderColor: 'var(--ff-blue)', color: 'var(--ff-blue)', fontWeight: 700 },                                                  // the one real action: open the editor
  quiet: { ...putAsideBtn }   // puts the row aside
}

const KIND_LABEL: Record<AlbumKind, string> = { date: 'date', place: 'place', tag: 'subject (tag)', anything: 'left alone' }

// "Judged by date (the app's pick). Change": what the album is about decides how its photos are judged. The same choice is in Tune checks, album by album.
export function JudgedBy({ item, onChange }: { item: AlbumItem; onChange: (kind: AlbumKind | 'auto') => void }): React.JSX.Element | null {
  const [editing, setEditing] = useState(false)
  if (!item.albumId || !item.kind) return null
  const kind = item.kind as AlbumKind
  return (
    <div style={styles.judged}>
      {editing ? (
        <>
          <label>Judge this album by{' '}
            <select style={styles.select} value={kind} aria-label="Judge this album by" onChange={e => { onChange(e.target.value as AlbumKind); setEditing(false) }}>
              <option value="date">Date</option><option value="place">Place</option><option value="tag">Subject (tag)</option><option value="anything">Anything (leave alone)</option>
            </select>
          </label>
          {!item.kindGuessed && <button style={styles.small} onClick={() => { onChange('auto'); setEditing(false) }}>Reset to the app&apos;s pick</button>}
          <button style={styles.small} onClick={() => setEditing(false)}>Cancel</button>
        </>
      ) : (
        <>Judged by {KIND_LABEL[kind]} ({item.kindGuessed ? "the app's pick" : 'your choice'}). <button style={styles.small} onClick={() => setEditing(true)}>Change</button></>
      )}
    </div>
  )
}

export function MissingRow({ item, onFine, onKind }: { item: AlbumItem; onFine: (next: 'open' | 'fine') => void; onKind: (kind: AlbumKind | 'auto') => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState<AlbumFitPhoto[] | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const count = item.count ?? 0
  const fine = item.status === 'fine'

  useEffect(() => {
    if (!open || photos) return
    let alive = true
    void window.flickrAPI.getAlbumFitPhotos(item.albumId).then(p => { if (alive) { setPhotos(p); setTicked(new Set(p.map(x => x.photoId))) } }).catch(() => { if (alive) setPhotos([]) })
    return () => { alive = false }
  }, [open, photos, item.albumId])

  const first = item.why.split('. ')[0].replace(/\.$/, '') + '.'
  const toggle = (id: string, on: boolean): void => setTicked(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n })

  return (
    <div style={{ ...styles.card, ...(fine ? { opacity: 0.6 } : {}) }}>
      {item.thumbUrl ? <img src={item.thumbUrl} alt="" loading="lazy" style={styles.thumb} /> : <div style={styles.thumb} />}
      <div style={styles.body}>
        <div style={styles.title}>{item.title || '(no title)'}</div>
        <div style={styles.muted}>{item.detail}</div>
        <div style={{ ...styles.muted, marginTop: 3 }}>{open ? item.why : first}</div>

        {open && (
          <>
            {item.description && <div style={styles.description} title={item.description}>{item.description}</div>}
            {!photos ? <div style={{ ...styles.muted, marginTop: 8 }}>Loading the photos…</div> : (
              <>
                <PhotoStrip photos={photos} ticked={ticked} onToggle={toggle} />
              </>
            )}
            <JudgedBy item={item} onChange={onKind} />
          </>
        )}

        <div style={styles.actions}>
          {!fine && <button style={{ ...quietBtn }} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Hide the photos' : `Show the ${count.toLocaleString()} photo${count === 1 ? '' : 's'}`}</button>}
          {!fine && (open && photos && ticked.size === 0
            ? <span style={styles.muted}>{photos.length === 0 ? 'The photos could not be loaded' : "Tick a photo to open it in Flickr's organizer"}</span>
            : <BatchEditButton inline key={`${item.albumId}|${open && photos ? ticked.size : 'all'}`} style={actionStyles.fix}
                label={open && photos ? `Open ${ticked.size.toLocaleString()} in Flickr's organizer` : `Open all ${count.toLocaleString()} in Flickr's organizer`}
                getIds={() => (open && photos ? Promise.resolve([...ticked]) : window.flickrAPI.getAlbumFitPhotoIds(item.albumId))} />)}
          <button style={actionStyles.link} onClick={() => window.flickrAPI.openExternal(item.flickrUrl)}>Open album <Icon name="external" /></button>
          {fine ? <button style={actionStyles.quiet} onClick={() => onFine('open')}>Undo</button> : <button style={actionStyles.quiet} onClick={() => onFine('fine')}>This one is fine</button>}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { display: 'flex', gap: 12, background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: 10, marginBottom: 8 },
  thumb: { width: 76, height: 76, borderRadius: 6, objectFit: 'cover', background: 'var(--ff-border)', flexShrink: 0 },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--ff-text)', overflowWrap: 'anywhere' },
  muted: { fontSize: 13, color: 'var(--ff-text-secondary)' },
  description: { fontSize: 13, fontStyle: 'italic', color: 'var(--ff-text-secondary)', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  judged: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: 'var(--ff-text-secondary)' },
  select: { ...selectCompact, fontSize: 12 },
  small: { background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--ff-blue)', textDecoration: 'underline', cursor: 'pointer' },
  actions: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }
}
