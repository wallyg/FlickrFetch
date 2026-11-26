import React, { useEffect, useRef, useState } from 'react'
import { fieldCompact, putAsideBtn } from '../ui/kit'
import type { MissingTagSettings as Settings, MissingTagStats } from '../../shared/types'

// The numbers behind "Photos missing a tag" (Tune checks). Each is saved when you finish typing, and the counts underneath are worked out
// again with the new number, so you can see what each one does and calibrate.

const DEFAULTS: Settings = { agree: 2, implication: 98, albumShare: 95, titleShare: 95 }
const FIELDS: { key: keyof Settings; label: string; hint: string; min: number; max: number; step: number }[] = [
  { key: 'agree', label: 'Clues that must agree (1 to 5)', hint: 'A tag is suggested for a photo only when at least this many of the five clues point to it (tag habits, album, title place, photos beside it, a title that names the tag). 1 finds the most and is the least sure; 3 or more finds few and is almost always right.', min: 1, max: 5, step: 1 },
  { key: 'implication', label: 'Tag habit: how often the tags go together (%)', hint: 'Clue 1: photos with one tag carry the other at least this often. Higher is stricter.', min: 80, max: 100, step: 1 },
  { key: 'albumShare', label: 'Album: share of its photos with the tag (%)', hint: 'Clue 2: an album of 30 or more photos where at least this share carry the tag. Higher is stricter.', min: 80, max: 100, step: 1 },
  { key: 'titleShare', label: 'Title place: share of its photos with the tag (%)', hint: 'Clue 3: photos whose title starts with the same place, where at least this share carry the tag. Higher is stricter. Needs titles that start with a place.', min: 80, max: 100, step: 1 }
]
const asText = (s: Settings): Record<keyof Settings, string> => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])) as Record<keyof Settings, string>

export default function MissingTagSettings(): React.JSX.Element {
  const [values, setValues] = useState<Record<keyof Settings, string>>(asText(DEFAULTS))
  const [stats, setStats] = useState<MissingTagStats | null>(null)
  const [busy, setBusy] = useState(false)
  const run = useRef(0)

  const refresh = (): void => {
    const id = ++run.current
    setBusy(true)
    void window.flickrAPI.getMissingTagStats().then(s => { if (id === run.current) { setStats(s); setBusy(false) } }).catch(() => { if (id === run.current) setBusy(false) })
  }
  useEffect(() => {
    void window.flickrAPI.getSettings().then(s => { setValues(asText({ ...DEFAULTS, ...(s.missingTags ?? {}) })); refresh() })
  }, [])

  const commit = (key: keyof Settings, text: string): void => {
    const f = FIELDS.find(x => x.key === key)!
    const n = Math.min(f.max, Math.max(f.min, Number(text)))
    const value = Number.isFinite(n) && text.trim() !== '' ? n : DEFAULTS[key]
    const next = { ...values, [key]: String(value) }
    setValues(next)
    const all = Object.fromEntries(Object.entries(next).map(([k, v]) => [k, Number(v)])) as unknown as Settings
    void window.flickrAPI.setSettings({ missingTags: all }).then(refresh)
  }
  const reset = (): void => { setValues(asText(DEFAULTS)); void window.flickrAPI.setSettings({ missingTags: { ...DEFAULTS } }).then(refresh) }
  const n = (x: number): string => x.toLocaleString()

  return (
    <div style={styles.box}>
      <div style={styles.muted}>The numbers behind this check. Change one at a time and watch the counts.</div>
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
        {!stats ? 'Counting…' : <div>{busy ? 'Recounting… ' : ''}{n(stats.tags)} tags, {n(stats.photos)} photos, {n(stats.suggestions)} suggestions in all.</div>}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  box: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 },
  muted: { fontSize: 12, color: 'var(--ff-text-muted)' },
  row: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ff-text)' },
  input: { ...fieldCompact, width: 72 },
  link: { ...putAsideBtn, alignSelf: 'flex-start' },
  stats: { fontSize: 12, color: 'var(--ff-text)', background: 'var(--ff-warm)', borderRadius: 6, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }
}
