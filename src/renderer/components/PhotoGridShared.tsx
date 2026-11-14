import React, { useState } from 'react'
import type { FlickrPhoto, LicenseFilter } from '../../shared/types'
export type { LicenseFilter }

// ── Shared types ──────────────────────────────────────────────────────────────
export type MediaFilter = 'all' | 'photo' | 'video'
export type GridSize = 'small' | 'medium' | 'large'
export type AlbumViewMode = GridSize | 'list'
export type PhotoViewMode = 'list' | 'grid' | 'justified'
export type DownloadFilter = 'all' | 'not-downloaded' | 'downloaded'
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

// ── Album view mode persistence ───────────────────────────────────────────────
const ALBUM_VIEW_KEY = 'ff-album-view-mode'
export function loadAlbumViewMode(): AlbumViewMode {
  try { const v = localStorage.getItem(ALBUM_VIEW_KEY); if (v === 'list' || v === 'small' || v === 'medium' || v === 'large') return v } catch { /* ignore */ }
  return 'medium'
}
export function saveAlbumViewMode(mode: AlbumViewMode): void {
  try { localStorage.setItem(ALBUM_VIEW_KEY, mode) } catch { /* ignore */ }
}

// ── Photo grid view mode persistence ─────────────────────────────────────────
const PHOTO_VIEW_KEY = 'ff-photo-view-mode'
export function loadPhotoViewMode(): PhotoViewMode {
  try {
    const v = localStorage.getItem(PHOTO_VIEW_KEY)
    if (v === 'list') return 'list'
    if (v === 'grid') return 'grid'
    if (v === 'small' || v === 'medium' || v === 'large') return 'grid'
  } catch { /* ignore */ }
  return 'justified'
}
export function savePhotoViewMode(mode: PhotoViewMode): void {
  try { localStorage.setItem(PHOTO_VIEW_KEY, mode) } catch { /* ignore */ }
}

// ── Row height persistence (for justified grid) ───────────────────────────────
const ROW_HEIGHT_KEY = 'ff-justified-row-height'
export const ROW_HEIGHT_DEFAULT = 180
export function loadRowHeight(): number {
  try {
    const v = localStorage.getItem(ROW_HEIGHT_KEY)
    if (v) { const n = Number(v); if (!isNaN(n) && n >= 100 && n <= 300) return n }
  } catch { /* ignore */ }
  return ROW_HEIGHT_DEFAULT
}
export function saveRowHeight(h: number): void {
  try { localStorage.setItem(ROW_HEIGHT_KEY, String(h)) } catch { /* ignore */ }
}

// ── Justified grid layout algorithm ──────────────────────────────────────────
export interface JustifiedRow {
  photos: FlickrPhoto[]
  widths: number[]
  height: number
}

export function computeJustifiedRows(
  photos: FlickrPhoto[],
  containerWidth: number,
  targetHeight: number,
  gap: number = 4
): JustifiedRow[] {
  if (containerWidth <= 0 || photos.length === 0) return []
  const rows: JustifiedRow[] = []
  let rowPhotos: FlickrPhoto[] = []
  let rowAspects: number[] = []
  let rowPhotoWidthSum = 0

  for (const photo of photos) {
    const ar = photo.width_m && photo.height_m && photo.height_m > 0
      ? photo.width_m / photo.height_m : 1
    const photoWidth = ar * targetHeight
    const N = rowPhotos.length
    const wouldBePhotoWidths = rowPhotoWidthSum + photoWidth
    const wouldBeGaps = N * gap
    const wouldBeTotal = wouldBePhotoWidths + wouldBeGaps

    if (N > 0 && wouldBeTotal > containerWidth) {
      const totalGapWidth = (N - 1) * gap
      const scale = (containerWidth - totalGapWidth) / rowPhotoWidthSum
      rows.push({
        photos: [...rowPhotos],
        widths: rowAspects.map(a => a * targetHeight * scale),
        height: targetHeight * scale
      })
      rowPhotos = [photo]
      rowAspects = [ar]
      rowPhotoWidthSum = photoWidth
    } else {
      rowPhotos.push(photo)
      rowAspects.push(ar)
      rowPhotoWidthSum += photoWidth
    }
  }

  if (rowPhotos.length > 0) {
    rows.push({
      photos: rowPhotos,
      widths: rowAspects.map(a => a * targetHeight),
      height: targetHeight
    })
  }

  return rows
}

// ── Download filter cycling ───────────────────────────────────────────────────
export const DOWNLOAD_FILTER_NEXT: Record<DownloadFilter, DownloadFilter> = {
  'all': 'not-downloaded',
  'not-downloaded': 'downloaded',
  'downloaded': 'all',
}
export const DOWNLOAD_FILTER_LABEL: Record<DownloadFilter, string> = {
  'all': 'All photos',
  'not-downloaded': 'Not downloaded',
  'downloaded': 'Downloaded',
}


// ── Photo list row ────────────────────────────────────────────────────────────
function formatRowDate(raw: string): string {
  if (!raw) return ''
  return raw.slice(0, 10)
}

interface PhotoListRowProps {
  photo: FlickrPhoto
  isDownloaded: boolean
  isSelected?: boolean
  selectMode?: boolean
  onClick: (e: React.MouseEvent) => void
}

export function PhotoListRow({ photo, isDownloaded, isSelected, selectMode, onClick }: PhotoListRowProps): React.JSX.Element {
  const privacyLevel = getPrivacyLevel(photo)
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 16px', cursor: 'pointer',
        borderBottom: '1px solid #f0ece6',
        background: isSelected ? 'rgba(255,0,132,0.06)' : 'transparent',
      }}
      onClick={onClick}
    >
      {selectMode && (
        <div style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${isSelected ? 'var(--ff-pink)' : '#ccc'}`,
          background: isSelected ? 'var(--ff-pink)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && <span style={{ color: '#fff', fontSize: '10px', fontWeight: 700 }}>✓</span>}
        </div>
      )}
      {photo.thumbnailUrl
        ? <img src={photo.thumbnailUrl} alt={photo.title} loading="lazy" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
        : <div style={{ width: 40, height: 40, background: '#d0d0d0', borderRadius: '4px', flexShrink: 0 }} />
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {photo.title || '(untitled)'}
        </div>
        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
          {formatRowDate(photo.dateTaken)}
        </div>
      </div>
      {photo.media === 'video' && (
        <span style={{ fontSize: '11px', color: '#888', background: '#f0ece6', borderRadius: '3px', padding: '2px 6px', flexShrink: 0 }}>Video</span>
      )}
      {privacyLevel !== 'public' && (
        <span style={{ flexShrink: 0 }}><PrivacyIcon level={privacyLevel} /></span>
      )}
      <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isDownloaded && (
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 1v8M4 6.5l3 3 3-3" stroke="#22a85d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 11.5h10" stroke="#22a85d" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        )}
      </span>
    </div>
  )
}

// ── Shared components ─────────────────────────────────────────────────────────
export function ListIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="0" y="1.5" width="14" height="2" rx="0.8"/>
      <rect x="0" y="6" width="14" height="2" rx="0.8"/>
      <rect x="0" y="10.5" width="14" height="2" rx="0.8"/>
    </svg>
  )
}

export function JustifiedIcon(): React.JSX.Element {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
      <rect x="0" y="0" width="9" height="4" rx="0.6"/>
      <rect x="10" y="0" width="6" height="4" rx="0.6"/>
      <rect x="0" y="5" width="5" height="4" rx="0.6"/>
      <rect x="6" y="5" width="10" height="4" rx="0.6"/>
      <rect x="0" y="10" width="7" height="4" rx="0.6"/>
      <rect x="8" y="10" width="8" height="4" rx="0.6"/>
    </svg>
  )
}

export function ChevronLeftIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M7.5 1.5L3 6l4.5 4.5"/>
    </svg>
  )
}

export function ChevronRightIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M4.5 1.5L9 6l-4.5 4.5"/>
    </svg>
  )
}

export function GridIcon({ size }: { size?: GridSize }): React.JSX.Element {
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

export function DownloadFilterSelect({ value, onChange }: { value: DownloadFilter; onChange: (v: DownloadFilter) => void }): React.JSX.Element {
  return (
    <select
      style={sharedStyles.sortSelect}
      value={value}
      onChange={e => onChange(e.target.value as DownloadFilter)}
    >
      <option value="all">All photos</option>
      <option value="not-downloaded">Not downloaded</option>
      <option value="downloaded">Downloaded</option>
    </select>
  )
}

const LICENSE_FILTER_OPTIONS: { value: LicenseFilter; label: string }[] = [
  { value: 'all',    label: 'All licenses' },
  { value: 'cc',     label: 'Creative Commons' },
  { value: 'public', label: 'Public Domain' },
  { value: 'gov',    label: 'US Government' },
  { value: 'arr',    label: 'All Rights Reserved' },
]

export const LICENSE_FILTER_IDS: Record<LicenseFilter, string[]> = {
  all:    [],
  cc:     ['1', '2', '3', '4', '5', '6'],
  public: ['7', '9', '10'],
  gov:    ['8'],
  arr:    ['0'],
}

export function matchesLicenseFilter(license: string | undefined, filter: LicenseFilter): boolean {
  if (filter === 'all') return true
  const ids = LICENSE_FILTER_IDS[filter]
  return ids.includes(license ?? '0')
}

export function LicenseFilterSelect({ value, onChange }: { value: LicenseFilter; onChange: (v: LicenseFilter) => void }): React.JSX.Element {
  return (
    <select
      style={{ ...sharedStyles.sortSelect, minWidth: '140px' }}
      value={value}
      onChange={e => onChange(e.target.value as LicenseFilter)}
    >
      {LICENSE_FILTER_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
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
  drawerLabel: { fontSize: '11px', fontWeight: '600', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.04em', minWidth: '90px' },
  // Search / filter controls
  searchGroup: { display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#fff' },
  searchIcon: { display: 'flex', alignItems: 'center', padding: '0 4px 0 8px', color: '#aaa', flexShrink: 0 },
  operatorSelect: { background: '#f5f5f5', border: 'none', borderRight: '1px solid #ddd', padding: '5px 6px', fontSize: '11px', color: '#555', cursor: 'pointer', outline: 'none' },
  searchInput: { border: 'none', outline: 'none', padding: '5px 8px', fontSize: '12px', color: '#333', minWidth: '160px', background: 'transparent' },
  searchClearBtn: { background: 'none', border: 'none', padding: '0 6px', fontSize: '11px', color: '#aaa', cursor: 'pointer' },
  idStatus: { fontSize: '11px', color: '#9ca3af', padding: '0 6px', flexShrink: 0 },
  idStatusErr: { fontSize: '11px', color: '#ef4444', padding: '0 6px', flexShrink: 0 },
  idOpenDetailBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--ff-blue)', padding: '0 6px', flexShrink: 0 } as React.CSSProperties,
  segGroup: { display: 'flex', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' },
  seg: { background: 'none', border: 'none', borderRight: '1px solid #ddd', padding: '5px 10px', fontSize: '12px', color: '#666', cursor: 'pointer', lineHeight: 1 },
  segActive: { backgroundColor: '#111', color: '#fff', fontWeight: '600' },
  sortSelect: { fontSize: '12px', color: '#555', border: '1px solid #ddd', borderRadius: '6px', padding: '5px 8px', background: 'none', cursor: 'pointer' },
  segGroupDensity: { display: 'flex', alignItems: 'center', gap: '2px', marginLeft: 'auto' },
  densityBtn: { background: 'none', border: 'none', padding: '4px 5px', cursor: 'pointer', borderRadius: '5px', display: 'flex', alignItems: 'center', color: '#bbb' },
  densityBtnActive: { backgroundColor: '#ece8e2', color: '#333' },
  rowHeightSlider: { width: '72px', height: '3px', cursor: 'pointer', accentColor: 'var(--ff-blue)', margin: '0 4px' },
  moreFiltersBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #ddd', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', color: '#555', cursor: 'pointer' },
  moreFiltersBtnActive: { backgroundColor: '#111', color: '#fff', borderColor: '#111' },
  drawerBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--ff-pink)', color: '#fff', borderRadius: '50%', width: '14px', height: '14px', fontSize: '9px', fontWeight: '700' },
  clearFiltersLink: { background: 'none', border: 'none', fontSize: '12px', color: 'var(--ff-blue)', cursor: 'pointer', padding: '0', textDecoration: 'underline' as const },
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
  downloadFilterBtn: { background: 'none', border: '1px solid #ddd', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', color: '#555', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  downloadFilterBtnActive: { backgroundColor: '#111', color: '#fff', borderColor: '#111' },
  listContainer: { display: 'flex', flexDirection: 'column' as const },
  tagHint: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ddd', fontSize: '10px', color: '#666', cursor: 'default', fontWeight: '600', flexShrink: 0 } as React.CSSProperties,
  // Empty / error states
  centered: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' },
  mutedText: { color: '#888', fontSize: '15px', margin: 0 },
  emptyFilter: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px 24px', textAlign: 'center' as const },
  emptyFilterMsg: { color: '#888', fontSize: '14px', margin: 0 },
  clearFiltersBtn: { background: 'none', border: '1px solid #ccc', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', color: '#555', cursor: 'pointer' },
}
