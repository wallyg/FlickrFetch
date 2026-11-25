import React, { useEffect, useRef, useState } from 'react'
import { fieldCompact } from '../ui/kit'
import type { DuplicateSettings as Settings, DuplicateStats } from '../../shared/types'

// The number behind Possible duplicates (Tune checks). Saved when you finish typing; the counts underneath are worked out again with it.

const DEFAULTS: Settings = { gapMinutes: 10 }

export default function DuplicateSettings(): React.JSX.Element {
  const [text, setText] = useState(String(DEFAULTS.gapMinutes))
  const [stats, setStats] = useState<DuplicateStats | null>(null)
  const [busy, setBusy] = useState(false)
  const run = useRef(0)
  const refresh = (): void => {
    const id = ++run.current
    setBusy(true)
    void window.flickrAPI.getDuplicateStats().then(s => { if (id === run.current) { setStats(s); setBusy(false) } }).catch(() => { if (id === run.current) setBusy(false) })
  }
  useEffect(() => { void window.flickrAPI.getSettings().then(s => { setText(String(s.duplicates?.gapMinutes ?? DEFAULTS.gapMinutes)); refresh() }) }, [])
  const commit = (v: string): void => {
    const n = Math.min(10080, Math.max(1, Math.round(Number(v))))
    const value = Number.isFinite(n) && v.trim() !== '' ? n : DEFAULTS.gapMinutes
    setText(String(value))
    void window.flickrAPI.setSettings({ duplicates: { gapMinutes: value } }).then(refresh)
  }
  const n = (x: number): string => x.toLocaleString()
  return (
    <div style={styles.box}>
      <label style={styles.row} title="Two photos with the same date and time taken are possible duplicates only when they were uploaded at least this far apart. Longer finds fewer, surer groups; shorter lets in more bursts.">
        <span style={{ flex: 1 }}>Uploaded at least this many minutes apart</span>
        <input type="number" style={styles.input} min={1} max={10080} step={1} value={text} onChange={e => setText(e.target.value)}
          onBlur={e => commit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      </label>
      <button style={styles.link} onClick={() => { setText(String(DEFAULTS.gapMinutes)); void window.flickrAPI.setSettings({ duplicates: { ...DEFAULTS } }).then(refresh) }}>Reset to the standard number</button>
      <div style={styles.stats} aria-live="polite">{!stats ? 'Counting…' : <div>{busy ? 'Recounting… ' : ''}{n(stats.groups)} groups, {n(stats.photos)} photos.</div>}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  box: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 },
  row: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ff-text)' },
  input: { ...fieldCompact, width: 80 },
  link: { alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, fontSize: 12, color: 'var(--ff-text-secondary)', textDecoration: 'underline', cursor: 'pointer' },
  stats: { fontSize: 12, color: 'var(--ff-text)', background: 'var(--ff-warm)', borderRadius: 6, padding: '6px 10px' }
}
