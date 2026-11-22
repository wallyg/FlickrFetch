import React from 'react'

// Small building blocks shared by the Audit and Health dashboards: number tiles, a bar row, a ring.

export function Kpi({ value, label }: { value: string; label: string }): React.JSX.Element {
  return (
    <div style={styles.kpi}>
      <b style={styles.kpiValue}>{value}</b>
      <span style={styles.kpiLabel}>{label}</span>
    </div>
  )
}

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

export const COLORS = { open: 'var(--ff-pink)', plan: '#0063dc', fine: '#cbd0d8', fixed: '#16a34a', neutral: '#0063dc' }

export const dash: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 24px 16px' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginTop: 14 },
  card: { background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 12, padding: '14px 16px', minWidth: 0 },
  cardTitle: { margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--ff-text)' },
  hint: { fontWeight: 400, color: 'var(--ff-text-secondary)' },
  muted: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  ringWrap: { display: 'flex', alignItems: 'center', gap: 16 },
  big: { fontSize: 12, color: 'var(--ff-text-secondary)', lineHeight: 1.5 },
  bigNum: { display: 'block', fontSize: 20, fontWeight: 600, color: 'var(--ff-text)' },
  item: { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderTop: '1px solid #f1efec', fontSize: 13, cursor: 'pointer', color: 'var(--ff-text)' },
  pill: { fontSize: 11, borderRadius: 10, padding: '1px 8px', background: '#e6f1fb', color: '#185fa5', marginLeft: 6 },
  switchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 24px 0' },
  seg: { display: 'inline-flex', border: '1px solid var(--ff-border)', borderRadius: 8, overflow: 'hidden', background: '#fff' },
  segBtn: { background: '#fff', border: 'none', padding: '5px 14px', fontSize: 13, color: 'var(--ff-text-secondary)', cursor: 'pointer' },
  segOn: { background: 'var(--ff-navy)', color: '#fff' }
}

const styles: Record<string, React.CSSProperties> = {
  kpi: { background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 12, padding: '14px 16px' },
  kpiValue: { display: 'block', fontSize: 26, fontWeight: 600, letterSpacing: -0.5, color: 'var(--ff-text)' },
  kpiLabel: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  row: { display: 'grid', gridTemplateColumns: 'minmax(120px, 1.1fr) minmax(70px, 1fr) 64px', gap: 10, alignItems: 'center', padding: '6px 0', borderRadius: 6 },
  rowName: { fontSize: 13, color: 'var(--ff-text)' },
  barTrack: { height: 14, borderRadius: 7, background: '#f1efec', overflow: 'hidden' },
  rowNum: { textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--ff-text)' },
  legend: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: 'var(--ff-text-secondary)' },
  swatch: { display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 5, verticalAlign: -1, fontStyle: 'normal' }
}
