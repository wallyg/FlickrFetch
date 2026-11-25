import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { AlbumKind, AlbumKindRow } from '../../shared/types'
import { filterInput } from '../ui/kit'

// Settings > Album Checks (part of Health Check). What an album is about decides how May not fit and May be missing judge its photos:
// Date (trips and events), Place (one area), Subject (a clear tag) or Anything (leave it alone). The app picks one for every album;
// a choice here replaces the pick for that album only, and Reset goes back to it. The choice stays on this computer.

const LABEL: Record<AlbumKind, string> = { date: 'Date', place: 'Place', tag: 'Subject (tag)', anything: 'Anything (leave alone)' }
const PAGE = 60

export default function AlbumKindList(): React.JSX.Element {
  const [rows, setRows] = useState<AlbumKindRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [changedOnly, setChangedOnly] = useState(false)
  const [shown, setShown] = useState(PAGE)

  const load = useCallback(() => {
    setFailed(false)
    void window.flickrAPI.getAlbumKinds().then(setRows).catch(() => setFailed(true))
  }, [])
  useEffect(load, [load])

  const set = async (albumId: string, kind: AlbumKind | 'auto'): Promise<void> => {
    await window.flickrAPI.setAlbumKind({ albumId, kind })
    load()
  }

  const changed = useMemo(() => (rows ?? []).filter(r => r.overridden).length, [rows])
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (rows ?? []).filter(r => (!changedOnly || r.overridden) && (!q || r.title.toLowerCase().includes(q)))
  }, [rows, search, changedOnly])
  useEffect(() => { setShown(PAGE) }, [search, changedOnly])

  if (failed) return <div style={styles.muted}>This could not be loaded. <button style={styles.link} onClick={load}>Try again</button></div>
  if (!rows) return <div style={styles.muted}>Reading your albums…</div>
  if (rows.length === 0) return <div style={styles.muted}>No albums yet. A Rebuild reads them.</div>

  return (
    <div style={styles.box}>
      <div style={styles.muted}>The app picks how each album is judged. Change one here and only that album changes. {rows.length.toLocaleString()} albums, {changed.toLocaleString()} changed by you.</div>
      <div style={styles.bar}>
        <input style={{ ...filterInput, maxWidth: 260 }} placeholder="Find an album…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Find an album" />
        <label style={styles.check}><input type="checkbox" checked={changedOnly} onChange={e => setChangedOnly(e.target.checked)} /> Only the ones I changed</label>
      </div>
      {list.length === 0 ? <div style={styles.muted}>No album matches.</div> : (
        <div>
          {list.slice(0, shown).map(r => (
            <div key={r.albumId} style={styles.row}>
              <div style={{ minWidth: 0 }}>
                <div style={styles.title}>{r.title || '(no title)'} <span style={styles.count}>{r.photos.toLocaleString()} photo{r.photos === 1 ? '' : 's'}</span></div>
                <div style={styles.muted}>App&apos;s pick: {LABEL[r.pick].replace(' (leave alone)', ', left alone').toLowerCase()}, because {r.why}.</div>
              </div>
              <div style={styles.choice}>
                <select style={styles.select} value={r.kind} aria-label={`How ${r.title || 'this album'} is judged`} onChange={e => void set(r.albumId, e.target.value as AlbumKind)}>
                  {(['date', 'place', 'tag', 'anything'] as AlbumKind[]).map(k => <option key={k} value={k}>{LABEL[k]}{k === r.pick ? " (app's pick)" : ''}</option>)}
                </select>
                {r.overridden && <button style={styles.link} onClick={() => void set(r.albumId, 'auto')}>Reset</button>}
              </div>
            </div>
          ))}
          {list.length > shown && <button style={styles.link} onClick={() => setShown(n => n + PAGE)}>Show more ({(list.length - shown).toLocaleString()} left)</button>}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  box: { display: 'flex', flexDirection: 'column', gap: 8 },
  muted: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  bar: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ff-text)', cursor: 'pointer' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: '1px solid var(--ff-warm)' },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--ff-text)', overflowWrap: 'anywhere' },
  count: { fontWeight: 400, color: 'var(--ff-text-secondary)' },
  choice: { display: 'flex', alignItems: 'center', gap: 8, flex: 'none' },
  select: { border: '1px solid var(--ff-border)', borderRadius: 6, padding: '3px 6px', fontSize: 12, background: 'var(--ff-surface)', color: 'var(--ff-text)' },
  link: { background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--ff-blue)', textDecoration: 'underline', cursor: 'pointer' }
}
