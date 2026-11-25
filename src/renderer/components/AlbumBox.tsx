import React, { useEffect, useState } from 'react'
import type { MapAlbumHit } from '../../shared/types'
import { sharedStyles } from './PhotoGridShared'
import { DEBOUNCE, useDebouncedValue } from '../ui/useDebounce'

// The album box used by the Map, On This Day and the Timeline: type to find an album, click it in the list to pick it. A picked album stays in the
// list with a tick, so the click answers on the spot; click it again to take it off. The picks are also shown (as chips) by whoever uses the box.
// It only reads the local library list.

export interface PickedAlbum { id: string; title: string }

export default function AlbumBox({ chosen, onToggle, minWidth = 200 }: { chosen: PickedAlbum[]; onToggle: (a: PickedAlbum) => void; minWidth?: number }): React.JSX.Element {
  const [text, setText] = useState('')
  const [hits, setHits] = useState<MapAlbumHit[]>([])
  const [focus, setFocus] = useState(false)
  const typed = useDebouncedValue(text, DEBOUNCE.albumSearch)

  // The albums that match what is typed (looked up only while the box has focus)
  useEffect(() => {
    if (!focus) return
    let alive = true
    void window.flickrAPI.getMapAlbums(typed).then(h => { if (alive) setHits(h) }).catch(() => { if (alive) setHits([]) })
    return () => { alive = false }
  }, [typed, focus])

  const isOn = (id: string): boolean => chosen.some(a => a.id === id)
  return (
    <div style={{ position: 'relative' }}>
      <div style={sharedStyles.searchGroup}>
        <input style={{ ...sharedStyles.searchInput, minWidth }} type="text" placeholder={chosen.length > 0 ? `${chosen.length} picked. Find another…` : 'Find an album…'} value={text} aria-label="Find an album"
          onChange={e => setText(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
      </div>
      {focus && hits.length > 0 && (
        <div style={styles.suggest} role="listbox" aria-label="Albums" aria-multiselectable="true">
          {hits.map(h => (
            <button key={h.id} style={{ ...styles.suggestItem, ...(isOn(h.id) ? styles.suggestOn : {}) }} role="option" aria-selected={isOn(h.id)}
              onMouseDown={e => { e.preventDefault(); onToggle({ id: h.id, title: h.title }) }}>
              <span style={styles.tick} aria-hidden="true">{isOn(h.id) ? '✓' : ''}</span>
              <span style={{ overflowWrap: 'anywhere', flex: 1, textAlign: 'left' }}>{h.title || '(no title)'}</span>
              <span style={styles.suggestCount}>{h.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  suggest: { position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 20, minWidth: 300, maxHeight: 260, overflowY: 'auto', background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.14)', padding: 4 },
  suggestItem: { display: 'flex', alignItems: 'center', width: '100%', gap: 8, textAlign: 'left', border: 'none', background: 'none', padding: '6px 8px', borderRadius: 6, fontSize: 13, color: 'var(--ff-text)', cursor: 'pointer' },
  suggestOn: { background: 'var(--ff-tint)', color: 'var(--ff-pink-action)' },
  tick: { width: 14, flex: 'none', fontWeight: 700 },
  suggestCount: { color: 'var(--ff-text-secondary)', flex: 'none' }
}
