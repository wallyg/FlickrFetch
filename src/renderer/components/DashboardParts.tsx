import React from 'react'
import { segGroup, segBtn as segBtnBase, selectedOn, headingCard } from '../ui/kit'
import { asButton } from '../ui/a11y'

// Small building blocks shared by the Audit and Health dashboards: a bar row, rings.

export interface BarPart { value: number; color: string; title?: string }

// One labelled row: name, a bar made of coloured parts (scaled against `max`), and the figures. `squeeze` draws the bar on a square-root
// scale, so a small row still shows next to a huge one; the figures carry the exact counts (#220).
export function BarRow({ name, parts, max, number, onClick, squeeze, title }: { name: string; parts: BarPart[]; max: number; number: React.ReactNode; onClick?: () => void; squeeze?: boolean; title?: string }): React.JSX.Element {
  const total = parts.reduce((n, p) => n + p.value, 0)
  const share = max > 0 ? total / max : 0
  const width = max > 0 ? Math.max(total > 0 ? 1.5 : 0, (squeeze ? Math.sqrt(share) : share) * 100) : 0
  return (
    <div style={{ ...styles.row, cursor: onClick ? 'pointer' : 'default' }} title={title} {...(onClick ? { ...asButton(onClick), 'data-row-link': '' } : {})}>
      <div style={styles.rowName}>{name}</div>
      <div style={styles.barTrack}>
        <div style={{ display: 'flex', width: `${width}%`, height: '100%' }}>
          {parts.filter(p => p.value > 0).map((p, i) => (
            <i key={i} title={p.title} style={{ display: 'block', height: '100%', width: `${(p.value / total) * 100}%`, background: p.color }} />
          ))}
        </div>
      </div>
      <div style={styles.rowNum}>{number}{onClick ? <span style={{ color: 'var(--ff-text-secondary)' }}> ›</span> : null}</div>
    </div>
  )
}

// "786 tags · 2,140 photos": the figures of a row, tags first (a photos-only row passes no tags)
export function Counts({ tags, photos }: { tags?: number; photos: number }): React.JSX.Element {
  return <>{tags !== undefined && <><b>{tags.toLocaleString()}</b> {tags === 1 ? 'tag' : 'tags'} · </>}<b>{photos.toLocaleString()}</b> {photos === 1 ? 'photo' : 'photos'}</>
}

// The ring's key: label first, then tags, then photos, then the share of the whole (a photos-only report has no tags column)
export interface StatusRow { color: string; label: string; tags?: number; photos: number; share: string; tip: string }
export function StatusLegend({ rows, withTags }: { rows: StatusRow[]; withTags: boolean }): React.JSX.Element {
  const cell: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const head: React.CSSProperties = { ...cell, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ff-text-secondary)' }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `10px minmax(90px, auto) ${withTags ? 'minmax(70px, auto) ' : ''}minmax(70px, auto) auto`, columnGap: 8, rowGap: 2, alignItems: 'baseline', marginTop: 8, fontSize: 13, color: 'var(--ff-text)' }}>
      <span /><span />
      {withTags && <span style={head}>Tags</span>}
      <span style={head}>Photos</span>
      <span style={head}>Share</span>
      {rows.map(r => (
        <React.Fragment key={r.label}>
          <i title={r.tip} style={{ ...dash.legendSwatch, background: r.color }} />
          <span title={r.tip}>{r.label}</span>
          {withTags && <b style={cell} title={r.tip}>{(r.tags ?? 0).toLocaleString()}</b>}
          <b style={cell} title={r.tip}>{r.photos.toLocaleString()}</b>
          <span style={{ ...cell, color: 'var(--ff-text-secondary)' }}>{r.share}</span>
        </React.Fragment>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }): React.JSX.Element {
  return (
    <div style={styles.legend}>
      {items.map(i => <span key={i.label}><em style={{ ...styles.swatch, background: i.color }} />{i.label}</span>)}
    </div>
  )
}

// A ring showing `fraction` (0 to 1) in `color`, with a label in the middle
export function Ring({ fraction, color, label }: { fraction: number; color: string; label: string }): React.JSX.Element {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <svg width="130" height="130" viewBox="0 0 42 42" role="img" aria-label={label}>
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--ff-warm)" strokeWidth="6" />
      <circle cx="21" cy="21" r="15.9" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset="25" />
      <text x="21" y="22.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--ff-navy)">{label}</text>
    </svg>
  )
}

// A ring in several coloured parts (each part is a share of the whole, in order from the top). Hovering a part
// (or whatever the page passes as `active`, such as a legend row) makes it stand out and puts its figure in the middle.
export interface RingPart { fraction: number; color: string; n: number; short: string; title: string }
export function RingParts({ parts, label, sub, size = 130, active, onActive }: {
  parts: RingPart[]; label: string; sub?: string; size?: number; active: number | null; onActive: (i: number | null) => void
}): React.JSX.Element {
  let offset = 25
  const cur = active !== null ? parts[active] : null
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" role="img" aria-label={sub ? `${label} ${sub}` : label} style={{ flexShrink: 0 }}>
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--ff-warm)" strokeWidth="6" />
      {parts.map((p, i) => {
        const len = Math.max(0, Math.min(1, p.fraction)) * 100
        const el = (
          <circle
            key={i} cx="21" cy="21" r="15.9" fill="none" stroke={p.color}
            strokeWidth={active === i ? 7.4 : 6} opacity={active === null || active === i ? 1 : 0.35}
            strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={offset}
            style={{ cursor: 'default', transition: 'opacity 0.12s, stroke-width 0.12s' }}
            onMouseEnter={() => onActive(i)} onMouseLeave={() => onActive(null)}
          >
            <title>{p.title}</title>
          </circle>
        )
        offset -= len
        return el
      })}
      {cur ? (
        <>
          <text x="21" y="21.6" textAnchor="middle" fontSize="6" fontWeight="700" fill="var(--ff-navy)" style={{ pointerEvents: 'none' }}>{cur.n.toLocaleString()}</text>
          <text x="21" y="26" textAnchor="middle" fontSize="3" fill="var(--ff-text-secondary)" style={{ pointerEvents: 'none' }}>{cur.short}</text>
        </>
      ) : sub ? (
        <>
          <text x="21" y="21.2" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="var(--ff-navy)" style={{ pointerEvents: 'none' }}>{label}</text>
          <text x="21" y="26" textAnchor="middle" fontSize="3.2" fill="var(--ff-text-secondary)" style={{ pointerEvents: 'none' }}>{sub}</text>
        </>
      ) : (
        <text x="21" y="22.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--ff-navy)" style={{ pointerEvents: 'none' }}>{label}</text>
      )}
    </svg>
  )
}

// A share as a label for the middle of a ring: never rounds up to 100% while something is still left
export function pctLabel(fraction: number): string {
  const p = Math.max(0, Math.min(1, fraction)) * 100
  if (fraction < 1 && Math.round(p) === 100) return `${Math.floor(p * 10) / 10}%`
  return `${Math.round(p)}%`
}

// open = an Issue (red; pink is only for selection), warn = a Warning (amber), fine = No problems (grey). There is no green: nothing is "fixed" (#220)
// The Issue mark is the darker red ink, so it stays clear of amber for red-green colour-blind viewers (#238)
export const COLORS = { open: 'var(--ff-error-ink)', warn: 'var(--ff-warning)', fine: 'var(--ff-fine-fill)' }

export const dash: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 24px 16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginTop: 12 },
  card: { background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 12, padding: '12px 16px', minWidth: 0 },
  cardTitle: { ...headingCard, margin: '0 0 8px' },
  hint: { fontWeight: 400, color: 'var(--ff-text-secondary)' },
  muted: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  ringWrap: { display: 'flex', alignItems: 'center', gap: 16 },
  big: { fontSize: 12, color: 'var(--ff-text-secondary)', lineHeight: 1.5 },
  bigNum: { display: 'block', fontSize: 18, fontWeight: 700, color: 'var(--ff-text)' },
  item: { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: '1px solid var(--ff-warm)', fontSize: 13, cursor: 'pointer', color: 'var(--ff-text)' },
  pill: { fontSize: 11, borderRadius: 8, padding: '0px 8px', background: 'var(--ff-warm)', color: 'var(--ff-text-secondary)', marginLeft: 6 },   // a label, not a selection: pink is only for what is selected
  legendRow: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, padding: '2px 0', color: 'var(--ff-text)' },
  legendSwatch: { display: 'inline-block', width: 10, height: 10, borderRadius: 4, flex: 'none', transform: 'translateY(1px)' },
  switchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 24px 0' },
  seg: { ...segGroup },
  segBtn: { ...segBtnBase, padding: '4px 12px' },
  segOn: { ...selectedOn }
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'grid', gridTemplateColumns: 'minmax(120px, 1.1fr) minmax(70px, 1fr) auto', gap: 8, alignItems: 'center', padding: '6px 0', borderRadius: 6 },
  rowName: { fontSize: 13, color: 'var(--ff-text)' },
  barTrack: { height: 14, borderRadius: 6, background: 'var(--ff-warm)', overflow: 'hidden' },
  rowNum: { textAlign: 'right', fontSize: 13, color: 'var(--ff-text)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  legend: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: 'var(--ff-text-secondary)' },
  swatch: { display: 'inline-block', width: 10, height: 10, borderRadius: 4, marginRight: 4, verticalAlign: -1, fontStyle: 'normal' }
}

// The Summary | Lists switch at the top of the Tags and Photos reports
export function SectionSwitch({ section, onChange }: { section: 'overview' | 'lists'; onChange: (s: 'overview' | 'lists') => void }): React.JSX.Element {
  return (
    <div style={dash.seg}>
      {(['overview', 'lists'] as const).map(v => (
        <button key={v} style={{ ...dash.segBtn, ...(section === v ? dash.segOn : {}) }} onClick={() => onChange(v)}>{v === 'overview' ? 'Summary' : 'Lists'}</button>
      ))}
    </div>
  )
}
