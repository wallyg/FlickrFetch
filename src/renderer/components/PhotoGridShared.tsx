import React, { useState } from 'react'
import type { FlickrPhoto } from '../../shared/types'

// ── Shared types ──────────────────────────────────────────────────────────────
export type MediaFilter = 'all' | 'photo' | 'video'
export type GridSize = 'small' | 'medium' | 'large'
export type PrivacyFilter = 'all' | 'public' | 'friends' | 'family' | 'friendsFamily' | 'private'
export type PrivacyLevel = 'public' | 'friends' | 'family' | 'friendsFamily' | 'private'

// ── Shared constants ──────────────────────────────────────────────────────────
export const PRIVACY_OPTIONS: PrivacyFilter[] = ['all', 'public', 'friends', 'family', 'friendsFamily', 'private']
export const PRIVACY_LABELS: Record<PrivacyFilter, string> = { all: 'All', public: 'Public', friends: 'Friends', family: 'Family', friendsFamily: 'Friends & Family', private: 'Private' }
export const GRID_COLUMNS: Record<GridSize, string> = {
  small:  'repeat(auto-fill, minmax(110px, 1fr))',
  medium: 'repeat(auto-fill, minmax(160px, 1fr))',
  large:  'repeat(auto-fill, minmax(220px, 1fr))'
}

// ── Shared utilities ──────────────────────────────────────────────────────────
export function getPrivacyLevel(photo: FlickrPhoto): PrivacyLevel {
  if (photo.ispublic === undefined || photo.ispublic === 1) return 'public'
  if (photo.isfriend === 1 && photo.isfamily === 1) return 'friendsFamily'
  if (photo.isfriend === 1) return 'friends'
  if (photo.isfamily === 1) return 'family'
  return 'private'
}

// ── Shared components ─────────────────────────────────────────────────────────
export function GridIcon({ size }: { size: GridSize }): React.JSX.Element {
  if (size === 'small') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      {[0, 3.5, 7, 10.5].flatMap(x => [0, 3.5, 7, 10.5].map(y =>
        <rect key={`${x}-${y}`} x={x} y={y} width="2.5" height="2.5" rx="0.4" />
      ))}
    </svg>
  )
  if (size === 'medium') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      {[0, 5, 10].flatMap(x => [0, 5, 10].map(y =>
        <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx="0.6" />
      ))}
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      {[0, 8].flatMap(x => [0, 8].map(y =>
        <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" rx="1" />
      ))}
    </svg>
  )
}

export function PrivacyIcon({ level }: { level: PrivacyLevel }): React.JSX.Element | null {
  if (level === 'public') return null
  if (level === 'private') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
  if (level === 'family' || level === 'friendsFamily') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

export function Tooltip({ text, children }: { text: string; children: React.ReactNode }): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#333', color: '#fff', fontSize: '11px', lineHeight: '1.5',
          padding: '5px 9px', borderRadius: '5px', maxWidth: '220px', whiteSpace: 'normal',
          zIndex: 100, pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          textAlign: 'left' as const
        }}>
          {text}
        </span>
      )}
    </span>
  )
}

export const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  backgroundColor: '#e8e4de', borderRadius: '12px',
  padding: '2px 8px 2px 10px', fontSize: '11px', color: '#444', whiteSpace: 'nowrap'
}
export const chipDismissStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: '0 0 0 2px',
  fontSize: '10px', color: '#888', cursor: 'pointer', lineHeight: 1
}

export function Chip({ label, onDismiss }: { label: string; onDismiss: () => void }): React.JSX.Element {
  return (
    <span style={chipStyle}>
      {label}
      <button style={chipDismissStyle} onClick={onDismiss}>✕</button>
    </span>
  )
}

// ── Date helpers (used by both views: server-side in photostream, client-side in albums) ──
export type DateMode = 'all' | 'last7' | 'last30' | 'thisYear' | 'lastYear' | 'since' | 'between'

export function getPresetDates(mode: DateMode): { min: string; max: string } {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  switch (mode) {
    case 'last7': { const d = new Date(now); d.setDate(d.getDate() - 7); return { min: d.toISOString().slice(0, 10), max: today } }
    case 'last30': { const d = new Date(now); d.setDate(d.getDate() - 30); return { min: d.toISOString().slice(0, 10), max: today } }
    case 'thisYear': return { min: `${now.getFullYear()}-01-01`, max: today }
    case 'lastYear': { const y = now.getFullYear() - 1; return { min: `${y}-01-01`, max: `${y}-12-31` } }
    default: return { min: '', max: '' }
  }
}

export function formatDateChip(min: string, max: string, field: import('../../shared/types').DateRangeField): string {
  const fmt = (d: string) => { const [y, m, day] = d.split('-'); return `${m}/${day}/${y.slice(2)}` }
  const label = field === 'posted' ? 'Posted' : 'Taken'
  if (min && max) return `${label}: ${fmt(min)} – ${fmt(max)}`
  if (min) return `${label}: after ${fmt(min)}`
  if (max) return `${label}: before ${fmt(max)}`
  return ''
}

// ── Shared styles (toolbar chrome, filters, grid tiles) ───────────────────────
// Each component imports these and spreads them into a local `styles` object
// alongside its own component-specific keys. Neither component should override
// a key defined here without a documented reason.
export const sharedStyles: Record<string, React.CSSProperties> = {
  // Toolbar chrome
  toolbarWrap: { position: 'sticky' as const, top: 0, zIndex: 10, backgroundColor: '#f5f5f5', borderBottom: '1px solid #f0ede8' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' as const, padding: '10px 16px 8px' },
  drawer: { display: 'flex', flexDirection: 'column' as const, borderTop: '1px solid #ece8e2', backgroundColor: '#faf9f7' },
  drawerRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const, padding: '7px 16px', borderBottom: '1px solid #f0ede8' },
  drawerLabel: { fontSize: '11px', fontWeight: '600', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.04em', minWidth: '52px' },
  // Search / filter controls
  searchGroup: { display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#fff' },
  searchIcon: { display: 'flex', alignItems: 'center', padding: '0 4px 0 8px', color: '#aaa', flexShrink: 0 },
  operatorSelect: { background: '#f5f5f5', border: 'none', borderRight: '1px solid #ddd', padding: '5px 6px', fontSize: '11px', color: '#555', cursor: 'pointer', outline: 'none' },
  searchInput: { border: 'none', outline: 'none', padding: '5px 8px', fontSize: '12px', color: '#333', minWidth: '160px', background: 'transparent' },
  searchClearBtn: { background: 'none', border: 'none', padding: '0 6px', fontSize: '11px', color: '#aaa', cursor: 'pointer' },
  segGroup: { display: 'flex', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' },
  seg: { background: 'none', border: 'none', borderRight: '1px solid #ddd', padding: '5px 10px', fontSize: '12px', color: '#666', cursor: 'pointer', lineHeight: 1 },
  segActive: { backgroundColor: '#111', color: '#fff', fontWeight: '600' },
  sortSelect: { fontSize: '12px', color: '#555', border: '1px solid #ddd', borderRadius: '6px', padding: '5px 8px', background: 'none', cursor: 'pointer' },
  segGroupDensity: { display: 'flex', gap: '2px', marginLeft: 'auto' },
  densityBtn: { background: 'none', border: 'none', padding: '4px 5px', cursor: 'pointer', borderRadius: '5px', display: 'flex', alignItems: 'center', color: '#bbb' },
  densityBtnActive: { backgroundColor: '#ece8e2', color: '#333' },
  moreFiltersBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #ddd', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', color: '#555', cursor: 'pointer' },
  moreFiltersBtnActive: { backgroundColor: '#111', color: '#fff', borderColor: '#111' },
  drawerBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF0084', color: '#fff', borderRadius: '50%', width: '14px', height: '14px', fontSize: '9px', fontWeight: '700' },
  clearFiltersLink: { background: 'none', border: 'none', fontSize: '12px', color: '#FF0084', cursor: 'pointer', padding: '0', textDecoration: 'underline' as const },
  // Active filter chips
  chipRow: { display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' as const, padding: '5px 16px 6px' },
  countLabel: { fontSize: '12px', color: '#777', margin: '0', padding: '0 16px 8px' },
  selectModeCount: { fontSize: '12px', color: '#777', padding: '8px 16px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #f0ede8' },
  // Grid tiles
  tile: { position: 'relative', aspectRatio: '1', overflow: 'hidden', backgroundColor: '#e8e8e8', cursor: 'pointer' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  videoOverlay: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  privacyBadge: { position: 'absolute', top: '5px', left: '5px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, cursor: 'default' },
  selectBadge: { position: 'absolute' as const, top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  selectCheck: { color: '#fff', fontSize: '13px', fontWeight: 'bold', lineHeight: 1 },
  // Drawer date/tag controls
  dateModeSelect: { border: '1px solid #ddd', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: '#444', background: '#fff', cursor: 'pointer' },
  dateInputsInline: { display: 'flex', alignItems: 'center', gap: '5px' },
  dateInput: { border: '1px solid #ddd', borderRadius: '5px', padding: '4px 6px', fontSize: '12px', color: '#444', background: '#fff' },
  dateToLabel: { fontSize: '12px', color: '#888' },
  applyBtn: { backgroundColor: '#111', border: 'none', borderRadius: '5px', padding: '4px 10px', fontSize: '12px', color: '#fff', cursor: 'pointer' },
  comingSoon: { fontSize: '12px', color: '#bbb' },
  tagHint: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ddd', fontSize: '10px', color: '#666', cursor: 'default', fontWeight: '600', flexShrink: 0 } as React.CSSProperties,
  // Empty / error states
  centered: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' },
  mutedText: { color: '#888', fontSize: '15px', margin: 0 },
  emptyFilter: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px 24px', textAlign: 'center' as const },
  emptyFilterMsg: { color: '#888', fontSize: '14px', margin: 0 },
  clearFiltersBtn: { background: 'none', border: '1px solid #ccc', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', color: '#555', cursor: 'pointer' },
}
