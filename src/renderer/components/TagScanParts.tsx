import React, { useEffect, useRef, useState } from 'react'
import type { TagIndexStatus, TagScanProgress } from '../../shared/types'
import { Tooltip } from './PhotoGridShared'
import { quietBtn } from '../ui/kit'

// Pieces of the library scan shown in both the Tags tab and the Cleanup tab.

export function formatWhen(ms: number | null): string {
  if (!ms) return 'never'
  const mins = Math.round((Date.now() - ms) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// While a scan runs: a card with a progress bar and Cancel
export function ScanProgressCard({ progress }: { progress: TagScanProgress | null }): React.JSX.Element {
  const p = progress
  const pct = p && p.pages > 0 ? Math.min(100, Math.round((p.page / p.pages) * 100)) : 0
  const label = p?.phase === 'finishing' ? 'Finishing up…' : p && p.pages > 0
    ? `Reading photos… ${p.photos.toLocaleString()}${p.total ? ` of ${p.total.toLocaleString()}` : ''}`
    : 'Starting…'
  return (
    <div style={styles.center}>
      <div style={styles.progressCard}>
        <div style={styles.cardTitle}>{progress?.mode === 'refresh' ? 'Updating your tag list' : 'Building your tag list'}</div>
        <div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${pct}%` }} /></div>
        <div style={styles.muted}>{label}</div>
        <button style={styles.secondaryBtn} onClick={() => window.flickrAPI.cancelTagScan()}>Cancel</button>
      </div>
    </div>
  )
}

// Cleanup's one data control: how fresh the library list is, and what to do about it. Opens a small panel with the
// counts, a main Update button and a quieter Rebuild.
export function LibraryDataChip({ status, info, onUpdate, onRebuild }: { status: TagIndexStatus; info: string; onUpdate: () => void; onRebuild: () => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent): void => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  const old = !status.lastScanAt || Date.now() - status.lastScanAt > 7 * 24 * 3600 * 1000
  const when = status.lastScanAt ? new Date(status.lastScanAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never'
  return (
    <span ref={box} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        style={{ ...quietBtn, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 11px', ...(old ? { borderColor: '#f5d28b', background: '#fff8e6' } : {}) }}
        onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Library data: update or rebuild"
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: old ? '#f59e0b' : 'var(--ff-success)' }} />
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
        Updated {formatWhen(status.lastScanAt)}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.6 }}><path d="M5 9l7 7 7-7" /></svg>
      </button>
      {open && (
        <div style={styles.dataPanel} role="dialog" aria-label="Your library list">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ff-navy)' }}>Your library list</div>
          <div style={{ ...styles.muted, fontSize: 12, marginTop: 2 }}>{status.tagCount.toLocaleString()} tags · {status.indexedPhotos.toLocaleString()} photos · updated {when}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12 }}>
            <button style={styles.updateBtn} onClick={() => { setOpen(false); onUpdate() }}>↻ Update now</button>
            <span style={{ ...styles.muted, fontSize: 12 }}>Looks for new and edited photos, usually a few seconds. It does not notice deleted photos.</span>
          </div>
          <div style={{ height: 1, background: 'var(--ff-border)', margin: '14px 0 8px' }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <button style={{ ...styles.linkBtn, whiteSpace: 'nowrap', padding: 0, fontSize: 13 }} onClick={() => { setOpen(false); onRebuild() }}>Rebuild from scratch…</button>
            <span style={{ ...styles.muted, fontSize: 12 }}>Reads every photo again, three to five minutes. Use it after deleting photos, or if the counts look wrong.</span>
          </div>
          <div style={{ ...styles.muted, fontSize: 12, marginTop: 10, whiteSpace: 'pre-line' }}>{info}</div>
        </div>
      )}
    </span>
  )
}

// "Not now" on the upgrade notice hides it until the app is opened again (a Rebuild is what makes it go for good)
let upgradeNoticeHidden = false

// Warnings under the data line: the library list and Flickr disagree, or the last scan failed
export function ScanNotices({ status, scanError, onRebuild }: { status: TagIndexStatus; scanError: string | null; onRebuild: () => void }): React.JSX.Element {
  const libraryGap = status.flickrTotal !== null ? status.flickrTotal - status.indexedPhotos : 0
  const [hidden, setHidden] = useState(upgradeNoticeHidden)
  return (
    <>
      {(libraryGap < 0 || libraryGap > 10) && (
        <div style={styles.notice}>
          Flickr reports {status.flickrTotal?.toLocaleString()} photos but {status.indexedPhotos.toLocaleString()} are in your tag list. Photos may have been added or removed. Update picks up new and changed photos, but only a Rebuild drops deleted ones.
        </div>
      )}
      {status.hasIndex && !status.hasCatalogV3 && !hidden && (
        <div style={{ ...styles.notice, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 260 }}>FlickrFetch has been updated since you last rebuilt your local library list. The new version checks a few more details about each photo, so some checks show zero until you rebuild. Press Rebuild once. It will take just a few minutes.</span>
          <button style={styles.secondaryBtn} onClick={onRebuild}>Rebuild…</button>
          <button style={styles.linkBtn} onClick={() => { upgradeNoticeHidden = true; setHidden(true) }} title="Hide this until you next open FlickrFetch">Not now</button>
        </div>
      )}
      {scanError && <div style={{ ...styles.notice, color: 'var(--ff-error)' }}>{scanError}</div>}
    </>
  )
}

// A short line for a toolbar: sizes and age, with an (i) that explains the report
// The data line: how big the library list is, when it was last updated, Update and Rebuild, plus any warnings
export function ScanLine({ status, scanError, onRefresh, onFullRescan }: {
  status: TagIndexStatus
  scanError: string | null
  onRefresh: () => void
  onFullRescan: () => void
}): React.JSX.Element {
  return (
    <>
      <div style={styles.header}>
        <div style={styles.headline}>
          <strong>{status.tagCount.toLocaleString()}</strong> tags on <strong>{status.indexedPhotos.toLocaleString()}</strong> photos
        </div>
        <div style={{ flex: 1 }} />
        <LibraryDataChip status={status} info={'Tags are read from your photos once and kept on this computer.\n\nNothing here changes Flickr or your files.'} onUpdate={onRefresh} onRebuild={onFullRescan} />
      </div>
      <ScanNotices status={status} scanError={scanError} onRebuild={onFullRescan} />
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--ff-cream)' },
  header: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px 6px', fontSize: '13px', color: 'var(--ff-text)' },
  headline: { fontSize: '14px' },
  muted: { color: 'var(--ff-text-secondary)', fontSize: '13px' },
  notice: { margin: '0 24px 6px', padding: '8px 12px', background: '#fff', border: '1px solid var(--ff-border)', borderRadius: '8px', fontSize: '13px', color: 'var(--ff-text-secondary)' },
  secondaryBtn: { ...quietBtn, padding: '5px 12px' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: '13px', cursor: 'pointer', padding: '4px 6px' },
  progressCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '360px', padding: '28px', background: '#fff', border: '1px solid var(--ff-border)', borderRadius: '12px' },
  cardTitle: { fontSize: '15px', fontWeight: 700, color: 'var(--ff-navy)' },
  barTrack: { width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' },
  barFill: { height: '100%', background: 'var(--ff-pink)', transition: 'width 0.3s' },
  updateBtn: { background: 'var(--ff-pink-action)', color: '#fff', border: '1px solid var(--ff-pink-action)', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  dataPanel: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 370, background: '#fff', border: '1px solid var(--ff-line-strong)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: '14px 16px', zIndex: 20 }
}
