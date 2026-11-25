import React, { useEffect, useRef, useState } from 'react'
import type { AlbumFitSettings as Settings, AlbumFitStats } from '../../shared/types'

// The numbers behind the Album fit lists (Tune checks). Each is saved when you finish typing, and the counts underneath are worked out
// again with the new number, so you can see what each one does and calibrate.

const DEFAULTS: Settings = { share: 95, gapDays: 45, isolated: 2, farTimes: 2.5, farKm: 0.5, titleShare: 75, titleMin: 5, nearShare: 80, nearMin: 3, nearMinutes: 30, nearMeters: 300, bothOnly: 0, titleMode: 1, titleAutoMin: 30, wrongOn: 1, doubleOn: 1, vouchShare: 50 }
interface Field { key: keyof Settings; label: string; hint: string; min: number; max: number; step: number; toggle?: boolean }
const NOT_FIT: Field[] = [
  { key: 'share', label: 'Share of an album in its cluster (%)', hint: 'Outliers are called out only when at least this much of the album sits in its dates or tags. Higher is stricter: fewer albums are judged.', min: 70, max: 100, step: 1 },
  { key: 'gapDays', label: 'Days between photos of one visit', hint: 'Photos closer together than this belong to one visit. Higher merges visits, so fewer photos count as on their own.', min: 3, max: 365, step: 1 },
  { key: 'isolated', label: 'On its own: a run of this many photos or fewer', hint: 'A photo away from every visit, with this few neighbours, is flagged. Higher flags more.', min: 0, max: 20, step: 1 },
  { key: 'farTimes', label: 'Out of place: times the album\'s own spread', hint: 'A photo further from the middle of its album than this many times the album\'s own spread is flagged. Lower flags more.', min: 1, max: 10, step: 0.1 },
  { key: 'farKm', label: '...and at least this many km beyond it', hint: 'Stops tiny differences in a very tight album from being flagged. Lower flags more.', min: 0, max: 20, step: 0.1 },
  { key: 'wrongOn', label: 'Flag a photo filed in another place\'s album', hint: 'The title (or the photos taken right beside it) says another place, in an album for a different place, and the two albums do not overlap. Needs titles that start with a place.', min: 0, max: 1, step: 1, toggle: true },
  { key: 'doubleOn', label: 'Flag a photo in two albums for different places', hint: 'A photo in two place albums whose areas do not overlap: one of them is probably wrong. Trip and theme albums are not judged this way.', min: 0, max: 1, step: 1, toggle: true },
  { key: 'vouchShare', label: 'Cleared by nearby photos: share of them in the album (%)', hint: 'A photo is left alone when at least this share of the photos taken right beside it are in the same album. 0 turns this off. Higher clears fewer photos.', min: 0, max: 100, step: 5 }
]
const BELONG: Field[] = [
  { key: 'titleMode', label: 'Use titles that start with a place, when enough of my photos have one', hint: 'Titles like "City: Subject" or "City - Neighbourhood: Subject" (a colon or a pipe after the place) help find albums and wrong albums. Automatic uses them only when enough of your titles have a place; 0 never uses them.', min: 0, max: 1, step: 1, toggle: true },
  { key: 'titleAutoMin', label: '...automatic needs this share of photos to have one (%)', hint: 'Below this share the title rules switch themselves off, and the nearby-photos rule carries on alone.', min: 0, max: 100, step: 5 },
  { key: 'titleShare', label: 'Title place: share of its photos in the album (%)', hint: 'A photo whose title starts with a place ("City - Neighbourhood:") is suggested for the album that holds at least this share of the photos with the same start. Higher is stricter.', min: 50, max: 100, step: 5 },
  { key: 'titleMin', label: '...and the place is used on at least this many photos', hint: 'A place used on fewer photos is too thin to go by. Higher is stricter.', min: 2, max: 50, step: 1 },
  { key: 'nearShare', label: 'Nearby photos: share of them in the album (%)', hint: 'A photo is suggested for the album that holds at least this share of the photos taken right beside it. Higher is stricter.', min: 50, max: 100, step: 5 },
  { key: 'nearMin', label: '...out of at least this many nearby photos', hint: 'Fewer nearby photos than this and the photo is not judged this way. Higher is stricter.', min: 1, max: 20, step: 1 },
  { key: 'nearMinutes', label: 'Nearby means within this many minutes', hint: 'Shared with May not fit. Longer finds more neighbours.', min: 1, max: 240, step: 1 },
  { key: 'nearMeters', label: '...and this many metres', hint: 'Shared with May not fit. Longer finds more neighbours.', min: 20, max: 2000, step: 10 },
  { key: 'bothOnly', label: 'Only when the title and the nearby photos agree', hint: 'Suggest a photo only when both signals point to the same album. Far fewer suggestions, and almost always right.', min: 0, max: 1, step: 1, toggle: true }
]
const ALL: Field[] = [...NOT_FIT, ...BELONG]
const asText = (s: Settings): Record<keyof Settings, string> => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])) as Record<keyof Settings, string>

export default function AlbumFitSettings(): React.JSX.Element {
  const [values, setValues] = useState<Record<keyof Settings, string>>(asText(DEFAULTS))
  const [stats, setStats] = useState<AlbumFitStats | null>(null)
  const [busy, setBusy] = useState(false)
  const run = useRef(0)

  const refresh = (): void => {
    const id = ++run.current
    setBusy(true)
    void window.flickrAPI.getAlbumFitStats().then(s => { if (id === run.current) { setStats(s); setBusy(false) } }).catch(() => { if (id === run.current) setBusy(false) })
  }
  useEffect(() => {
    void window.flickrAPI.getSettings().then(s => {
      setValues(asText({ ...DEFAULTS, ...(s.albumFit ?? {}) }))
      refresh()
    })
  }, [])

  // Kept within its range and saved when typing is done; then the counts are worked out again
  const commit = (key: keyof Settings, text: string): void => {
    const f = ALL.find(x => x.key === key)!
    const n = Math.min(f.max, Math.max(f.min, Number(text)))
    const value = Number.isFinite(n) && text.trim() !== '' ? n : DEFAULTS[key]
    const next = { ...values, [key]: String(value) }
    setValues(next)
    const all = Object.fromEntries(Object.entries(next).map(([k, v]) => [k, Number(v)])) as unknown as Settings
    void window.flickrAPI.setSettings({ albumFit: all }).then(refresh)
  }
  const reset = (): void => {
    setValues(asText(DEFAULTS))
    void window.flickrAPI.setSettings({ albumFit: { ...DEFAULTS } }).then(refresh)
  }
  const n = (x: number): string => x.toLocaleString()
  const fields = (list: Field[]): React.JSX.Element => (
    <div style={styles.grid}>
      {list.map(f => f.toggle ? (
        <label key={f.key} style={styles.toggleRow} title={f.hint}>
          <input type="checkbox" checked={values[f.key] === '1'} onChange={e => commit(f.key, e.target.checked ? '1' : '0')} />
          <span style={{ flex: 1 }}>{f.label}</span>
        </label>
      ) : (
        <label key={f.key} style={styles.row} title={f.hint}>
          <span style={{ flex: 1 }}>{f.label}</span>
          <input type="number" style={styles.input} min={f.min} max={f.max} step={f.step} value={values[f.key]}
            onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            onBlur={e => commit(f.key, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        </label>
      ))}
    </div>
  )
  // One line of the counts: what it is, the number, and the small print
  const stat = (label: string, value: string, detail?: string): React.JSX.Element => (
    <div key={label} style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <span><b style={{ fontWeight: 700 }}>{value}</b>{detail && <span style={styles.statDetail}>{value ? ' ' : ''}{detail}</span>}</span>
    </div>
  )

  return (
    <div style={styles.box}>
      <div style={styles.muted}>Change one number at a time and watch the counts above it.{busy ? ' Recounting…' : ''}</div>
      <div style={styles.head}>May not fit its album</div>
      <div style={styles.stats} aria-live="polite">
        {!stats ? 'Counting…' : (
          <>
            {stat('Albums judged', n(stats.judged), `${n(stats.byKind.date)} by date · ${n(stats.byKind.place)} by place · ${n(stats.byKind.tag)} by tag · ${n(stats.byKind.anything)} left alone`)}
            {stat('Flagged', `${n(stats.misfitPhotos)} photos`, `in ${n(stats.misfitAlbums)} albums`)}
            {stat('By reason', '', `${n(stats.byReason.date)} date · ${n(stats.byReason.place)} distance · ${n(stats.byReason.tag)} tag · ${n(stats.byReason.wrong)} another place's album · ${n(stats.byReason.double)} two places`)}
            {stat('Title rules', stats.titlesOn ? 'On' : 'Off', `${n(stats.titledPercent)}% of photos have a title that starts with a place`)}
            {stats.misfitMarked > 0 && stat('Marked fine', `${n(stats.misfitMarked)} photo${stats.misfitMarked === 1 ? '' : 's'}`, `${n(stats.misfitMarkedStill)} still flagged at these numbers, ${n(stats.misfitMarked - stats.misfitMarkedStill)} no longer`)}
          </>
        )}
      </div>
      {fields(NOT_FIT)}
      <div style={styles.head}>May be missing from an album</div>
      <div style={styles.stats} aria-live="polite">
        {!stats ? 'Counting…' : (
          <>
            {stat('Suggested', `${n(stats.missingPhotos)} photos`, `in ${n(stats.missingAlbums)} albums · ${n(stats.missingBoth)} backed by both the title and the nearby photos`)}
            {stats.missingMarked > 0 && stat('Marked fine', `${n(stats.missingMarked)} album${stats.missingMarked === 1 ? '' : 's'}`, `${n(stats.missingMarkedStill)} still suggested at these numbers, ${n(stats.missingMarked - stats.missingMarkedStill)} no longer`)}
          </>
        )}
      </div>
      {fields(BELONG)}
      <button style={styles.link} onClick={reset}>Reset to the standard numbers</button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  box: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 },
  muted: { fontSize: 12, color: 'var(--ff-text-muted)' },
  head: { fontSize: 12, fontWeight: 700, color: 'var(--ff-text)', marginTop: 6 },
  grid: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ff-text)' },
  input: { width: 72, border: '1px solid var(--ff-line-strong)', borderRadius: 6, padding: '3px 6px', fontSize: 13, background: 'var(--ff-surface)', color: 'var(--ff-text)' },
  link: { alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, fontSize: 12, color: 'var(--ff-text-secondary)', textDecoration: 'underline', cursor: 'pointer' },
  stats: { fontSize: 12, color: 'var(--ff-text)', background: 'var(--ff-warm)', borderRadius: 6, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 3 },
  statRow: { display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, alignItems: 'baseline' },
  statLabel: { color: 'var(--ff-text-secondary)' },
  statDetail: { color: 'var(--ff-text-secondary)' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ff-text)', cursor: 'pointer' }
}
