import React, { useState } from 'react'
import type { AlbumFitPhoto } from '../../shared/types'
import PhotoPeek from './PhotoPeek'

// A strip of photos with a tick box on each: click a photo to see it larger, untick the ones you do not want. Shared by the
// "Show the photos" rows (May be missing from an album, Photos missing a tag). Shows the first SHOWN until "Show all".

const SHOWN = 24

export default function PhotoStrip({ photos, ticked, onToggle }: { photos: AlbumFitPhoto[]; ticked: Set<string>; onToggle: (id: string, on: boolean) => void }): React.JSX.Element {
  const [all, setAll] = useState(false)
  const [peek, setPeek] = useState<number | null>(null)
  const shown = all ? photos : photos.slice(0, SHOWN)
  return (
    <>
      <div style={styles.strip}>
        {shown.map((p, i) => (
          <div key={p.photoId} style={{ ...styles.tile, ...(ticked.has(p.photoId) ? styles.tileOn : {}) }}>
            <button style={styles.tileImg} title={p.title || '(no title)'} aria-label={`Open ${p.title || 'this photo'}`} onClick={() => setPeek(i)}>
              {p.thumbUrl ? <img src={p.thumbUrl} alt="" loading="lazy" style={styles.tileThumb} /> : null}
            </button>
            <input type="checkbox" style={styles.tick} checked={ticked.has(p.photoId)} aria-label={`Include ${p.title || 'this photo'}`} onChange={e => onToggle(p.photoId, e.target.checked)} />
          </div>
        ))}
      </div>
      <div style={styles.hint}>
        Click a photo to see it larger. Untick the ones that do not belong.
        {photos.length > SHOWN && !all && <> <button style={styles.small} onClick={() => setAll(true)}>Show all {photos.length.toLocaleString()}</button></>}
      </div>
      {peek !== null && <PhotoPeek photos={photos} start={peek} sourceName="Suggested photos" onClose={() => setPeek(null)} />}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  strip: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tile: { position: 'relative', width: 72, height: 72, borderRadius: 6, border: '1px solid var(--ff-border)', overflow: 'hidden', background: 'var(--ff-border)' },
  tileOn: { border: '1px solid var(--ff-blue)', boxShadow: '0 0 0 1px var(--ff-blue)' },
  tileImg: { display: 'block', width: '100%', height: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer' },
  tileThumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  tick: { position: 'absolute', top: 4, left: 4, margin: 0, cursor: 'pointer' },
  hint: { fontSize: 12, color: 'var(--ff-text-muted)', marginTop: 6 },
  small: { background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--ff-blue)', textDecoration: 'underline', cursor: 'pointer' }
}
