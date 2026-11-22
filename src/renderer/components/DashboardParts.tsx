import React from 'react'
import { segGroup, segBtn as segBtnBase, selectedOn } from '../ui/kit'

// Small building blocks shared by the Audit and Health dashboards: a bar row, rings.

export interface BarPart { value: number; color: string; title?: string }

// One labelled row: name, a bar made of coloured parts (scaled against `max`), and a number
export function BarRow({ name, parts, max, number, onClick }: { name: string; parts: BarPart[]; max: number; number: string; onClick?: () => void }): React.JSX.Element {
  const total = parts.reduce((n, p) => n + p.value, 0)
  const width = max > 0 ? Math.max(total > 0 ? 1.5 : 0, (total / max) * 100) : 0
  return (
    <div style={{ ...styles.row, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={styles.rowName}>{name}</div>
      <div style={styles.barTrack}>
        <div style={{ display: 'flex', width: `${width}%`, height: '100%' }}>
          {parts.filter(p => p.value > 0).map((p, i) => (
            <i key={i} title={p.title} style={{ display: 'block', height: '100%', width: `${(p.value / total) * 100}%`, background: p.color }} />
          ))}
        </div>
      </div>
      <div style={styles.rowNum}>{number}</div>
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
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1efec" strokeWidth="6" />
      <circle cx="21" cy="21" r="15.9" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset="25" />
      <text x="21" y="22.5" textAnchor="middle" fontSize="7" fontWeight="600" fill="#1b2946">{label}</text>
    </svg>
  )
}

// A ring in several coloured parts (each part is a share of the whole, in order from the top). Hovering a part
// (or whatever the page passes as `active`, such as a legend row) makes it stand out and puts its figure in the middle.
export interface RingPart { fraction: number; color: string; n: number; short: string; title: string }
export function RingParts({ parts, label, active, onActive }: {
  parts: RingPart[]; label: string; active: number | null; onActive: (i: number | null) => void
}): React.JSX.Element {
  let offset = 25
  const cur = active !== null ? parts[active] : null
  return (
    <svg width="130" height="130" viewBox="0 0 42 42" role="img" aria-label={label} style={{ flexShrink: 0 }}>
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1efec" strokeWidth="6" />
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
          <text x="21" y="21.6" textAnchor="middle" fontSize="6" fontWeight="700" fill="#1b2946" style={{ pointerEvents: 'none' }}>{cur.n.toLocaleString()}</text>
          <text x="21" y="26" textAnchor="middle" fontSize="3" fill="#667085" style={{ pointerEvents: 'none' }}>{cur.short}</text>
        </>
      ) : (
        <text x="21" y="22.5" textAnchor="middle" fontSize="7" fontWeight="600" fill="#1b2946" style={{ pointerEvents: 'none' }}>{label}</text>
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

export const COLORS = { open: 'var(--ff-pink)', plan: '#0063dc', fine: '#cbd0d8', fixed: '#16a34a', neutral: '#0063dc' }

export const dash: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 24px 16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginTop: 14 },
  card: { background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 12, padding: '14px 16px', minWidth: 0 },
  cardTitle: { margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--ff-text)' },
  hint: { fontWeight: 400, color: 'var(--ff-text-secondary)' },
  muted: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  ringWrap: { display: 'flex', alignItems: 'center', gap: 16 },
  big: { fontSize: 12, color: 'var(--ff-text-secondary)', lineHeight: 1.5 },
  bigNum: { display: 'block', fontSize: 20, fontWeight: 600, color: 'var(--ff-text)' },
  item: { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderTop: '1px solid #f1efec', fontSize: 13, cursor: 'pointer', color: 'var(--ff-text)' },
  pill: { fontSize: 11, borderRadius: 10, padding: '1px 8px', background: 'var(--ff-tint)', color: 'var(--ff-pink-action)', marginLeft: 6 },
  switchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 24px 0' },
  seg: { ...segGroup },
  segBtn: { ...segBtnBase, padding: '4px 14px' },
  segOn: { ...selectedOn }
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'grid', gridTemplateColumns: 'minmax(120px, 1.1fr) minmax(70px, 1fr) 64px', gap: 10, alignItems: 'center', padding: '6px 0', borderRadius: 6 },
  rowName: { fontSize: 13, color: 'var(--ff-text)' },
  barTrack: { height: 14, borderRadius: 7, background: '#f1efec', overflow: 'hidden' },
  rowNum: { textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--ff-text)' },
  legend: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: 'var(--ff-text-secondary)' },
  swatch: { display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 5, verticalAlign: -1, fontStyle: 'normal' }
}
