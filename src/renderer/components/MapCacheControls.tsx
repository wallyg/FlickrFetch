import React, { useCallback, useEffect, useState } from 'react'
import { fieldBox, smallBtn } from '../ui/kit'
import { MAP_CACHE_MAX_MB, MAP_CACHE_MIN_MB } from '../../shared/mapGeo'
import type { MapCacheInfo } from '../../shared/types'

// Settings > General > Street map: how much room the saved map images take, the most they may take (a number you type, from 20 MB to
// 5,000 MB), and a button that deletes them all. They simply download again when a place is looked at next.

const size = (bytes: number): string => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 ** 2 ? `${Math.round(bytes / 1024 ** 2)} MB` : bytes > 0 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '0 MB')
const whole = (text: string): number | null => (/^\d{1,5}$/.test(text.trim()) ? Number(text.trim()) : null)

export default function MapCacheControls({ limitMb, onLimit, reloadKey }: { limitMb: number; onLimit: (mb: number) => void; reloadKey: number }): React.JSX.Element {
  const [text, setText] = useState(String(limitMb))
  const [info, setInfo] = useState<MapCacheInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => { setText(String(limitMb)) }, [limitMb])
  const load = useCallback(() => { void window.flickrAPI.getMapCacheInfo().then(setInfo).catch(() => setInfo(null)) }, [])
  useEffect(load, [load, reloadKey])

  const n = whole(text)
  const ok = n !== null && n >= MAP_CACHE_MIN_MB && n <= MAP_CACHE_MAX_MB
  // The number is kept only when you finish typing (leave the box or press Enter), so half-typed numbers such as the 30 on the way to 300 are never saved as the limit
  const commit = (): void => { if (ok && n !== null) onLimit(n); else setText(String(limitMb)) }
  const clear = async (): Promise<void> => {
    setBusy(true)
    try { await window.flickrAPI.clearMapCache() } catch { /* the size shown below says whether it worked */ }
    setConfirm(false); setBusy(false); load()
  }

  return (
    <div style={styles.box}>
      <div style={styles.row}>
        <label style={styles.label} htmlFor="map-cache-limit">Size limit</label>
        <input id="map-cache-limit" style={{ ...styles.input, ...(ok ? {} : styles.bad) }} inputMode="numeric" value={text} onChange={e => setText(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit() }} aria-invalid={!ok} aria-describedby="map-cache-help" />
        <span style={styles.unit}>MB</span>
      </div>
      <div id="map-cache-help" style={ok ? styles.help : { ...styles.help, color: 'var(--ff-error)' }}>
        {ok ? `${MAP_CACHE_MIN_MB.toLocaleString()} to ${MAP_CACHE_MAX_MB.toLocaleString()} MB. When full, the oldest map images go first.` : `Enter ${MAP_CACHE_MIN_MB.toLocaleString()} to ${MAP_CACHE_MAX_MB.toLocaleString()}.`}
      </div>
      <div style={styles.row}>
        <span style={styles.label}>In use</span>
        <b style={styles.value}>{info ? `${size(info.bytes)} (${info.files.toLocaleString()} image${info.files === 1 ? '' : 's'})` : '…'}</b>
        {!confirm
          ? <button style={styles.btn} disabled={busy || !info || info.files === 0} onClick={() => setConfirm(true)}>Clear</button>
          : <>
              <button style={{ ...styles.btn, color: 'var(--ff-error)', borderColor: 'var(--ff-error)' }} disabled={busy} onClick={() => void clear()}>{busy ? 'Clearing…' : 'Delete them'}</button>
              <button style={styles.btn} disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
            </>}
      </div>
      {confirm && <div style={styles.help}>Deletes only the saved map images, not your photos. They download again as you browse.</div>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  box: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  label: { fontSize: 13, color: 'var(--ff-text)', minWidth: 110 },
  input: { ...fieldBox, width: 80 },
  bad: { borderColor: 'var(--ff-error)' },
  unit: { fontSize: 13, color: 'var(--ff-text-secondary)' },
  help: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  value: { fontSize: 13, color: 'var(--ff-text)', fontWeight: 700 },
  btn: { ...smallBtn }
}
