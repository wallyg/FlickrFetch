import React, { useEffect, useRef, useState } from 'react'
import type { LocationHintSettings as Settings, LocationHintStats } from '../../shared/types'

// The numbers behind the hints in the Photos checks (a location for a photo with none, how a title could start). Each is saved when
// you finish typing, and the counts underneath are worked out again, so you can see what each one does.

const DEFAULTS: Settings = { minutes: 10, meters: 300 }
const FIELDS: { key: keyof Settings; label: string; hint: string; min: number; max: number; step: number }[] = [
  { key: 'minutes', label: 'Photos beside it: taken within this many minutes', hint: 'A photo with no location is given a suggested spot from photos taken within this many minutes of it. Longer finds more, and is less sure.', min: 1, max: 120, step: 1 },
  { key: 'meters', label: '...and within this many metres of each other', hint: 'A spot is suggested only when those photos agree this closely. Smaller is stricter.', min: 20, max: 2000, step: 10 }
]
const asText = (s: Settings): Record<keyof Settings, string> => ({ minutes: String(s.minutes), meters: String(s.meters) })

export default function LocationHintSettings(): React.JSX.Element {
  const [values, setValues] = useState<Record<keyof Settings, string>>(asText(DEFAULTS))
  const [stats, setStats] = useState<LocationHintStats | null>(null)
  const [busy, setBusy] = useState(false)
  const run = useRef(0)
  const refresh = (): void => {
    const id = ++run.current
    setBusy(true)
    void window.flickrAPI.getLocationHintStats().then(s => { if (id === run.current) { setStats(s); setBusy(false) } }).catch(() => { if (id === run.current) setBusy(false) })
  }
  useEffect(() => { void window.flickrAPI.getSettings().then(s => { setValues(asText({ ...DEFAULTS, ...(s.locationHints ?? {}) })); refresh() }) }, [])
  const commit = (key: keyof Settings, text: string): void => {
    const f = FIELDS.find(x => x.key === key)!
    const n = Math.min(f.max, Math.max(f.min, Number(text)))
    const value = Number.isFinite(n) && text.trim() !== '' ? n : DEFAULTS[key]
    const next = { ...values, [key]: String(value) }
    setValues(next)
    void window.flickrAPI.setSettings({ locationHints: { minutes: Number(next.minutes), meters: Number(next.meters) } }).then(refresh)
  }
  const reset = (): void => { setValues(asText(DEFAULTS)); void window.flickrAPI.setSettings({ locationHints: { ...DEFAULTS } }).then(refresh) }
  const n = (x: number): string => x.toLocaleString()
  return (
    <div style={styles.box}>
      <div style={styles.muted}>The numbers behind the hints in the Photos checks (a suggested location, a suggested title start). Change one at a time and watch the counts.</div>
      {FIELDS.map(f => (
        <label key={f.key} style={styles.row} title={f.hint}>
          <span style={{ flex: 1 }}>{f.label}</span>
          <input type="number" style={styles.input} min={f.min} max={f.max} step={f.step} value={values[f.key]}
            onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            onBlur={e => commit(f.key, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        </label>
      ))}
      <button style={styles.link} onClick={reset}>Reset to the standard numbers</button>
      <div style={styles.stats} aria-live="polite">
        {!stats ? 'Counting…' : (
          <>
            <div>{busy ? 'Recounting… ' : ''}A location is suggested for {n(stats.locations)} of {n(stats.noLocation)} photos with no location.</div>
            <div>A title start is suggested for {n(stats.titles)} photos with no title or a camera-file title.</div>
            <div>{n(stats.farTitles)} photos are geotagged far from the place their title names.</div>
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  box: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 },
  muted: { fontSize: 12, color: 'var(--ff-text-muted)' },
  row: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ff-text)' },
  input: { width: 72, border: '1px solid var(--ff-line-strong)', borderRadius: 6, padding: '3px 6px', fontSize: 13, background: '#fff', color: 'var(--ff-text)' },
  link: { alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, fontSize: 12, color: 'var(--ff-text-secondary)', textDecoration: 'underline', cursor: 'pointer' },
  stats: { fontSize: 12, color: 'var(--ff-text)', background: '#f5f3ee', borderRadius: 6, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }
}
