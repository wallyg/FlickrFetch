import React, { useState } from 'react'
import type { AuditCategory, HealthCondition, TagMode } from '../../shared/types'
import { CLEANUP_RULES } from '../../shared/cleanupRules'
import EmptyState from './EmptyState'
import AuditPanel from './AuditPanel'
import HealthPanel from './HealthPanel'
import LibraryOverview from './LibraryOverview'
import { LibraryDataChip, ScanNotices, ScanProgressCard } from './TagScanParts'
import { useTagScan } from '../hooks/useTagScan'
import { useCleanupRules } from '../hooks/useCleanupRules'
import { segGroup as segGroupBase, selectedOn, quietBtn } from '../ui/kit'

// The Cleanup tab: reports on the quality of your library. Overview is the front page; Tags finds likely tag
// problems; Photos finds photos with missing titles, descriptions, tags or locations. Each check can be On
// (needs attention), Optional or Off (Tune checks). All of it reads the local library list, and none of it
// changes Flickr or your files.

interface Props {
  onViewPhotos: (tags: string[], mode: TagMode) => void
  settingsKey: number          // goes up when Settings has been closed, so the checks are read again
  onOpenSettings: () => void   // opens Settings on its Health Check tab (Tune checks)
}

type View = 'overview' | 'tags' | 'photos'

export default function CleanupPanel({ onViewPhotos, settingsKey, onOpenSettings }: Props): React.JSX.Element {
  const scan = useTagScan()
  const rules = useCleanupRules(settingsKey)
  const [view, setView] = useState<View>('overview')
  // A report stays open once visited (just hidden), so it keeps its place: Summary or Lists, the chosen list, the scroll
  const [seen, setSeen] = useState({ tags: false, photos: false })
  const goTo = (v: View): void => { setView(v); if (v !== 'overview') setSeen(s => ({ ...s, [v]: true })) }
  // The front page opens one list in a report: a counter makes each request new
  const [tagReq, setTagReq] = useState<{ category: AuditCategory; nonce: number } | null>(null)
  const [photoReq, setPhotoReq] = useState<{ condition: HealthCondition; year?: string; nonce: number } | null>(null)
  // Slots in the toolbar where the report's own controls (Overview | Lists, Plan) are placed, so everything shares one row
  const [leftSlot, setLeftSlot] = useState<HTMLElement | null>(null)
  const [rightSlot, setRightSlot] = useState<HTMLElement | null>(null)

  if (!scan.status) return <div style={styles.center}><span style={styles.muted}>Loading…</span></div>
  if (!scan.status.hasIndex) {
    return (
      <div style={styles.center}>
        <EmptyState
          title="Build your library list first"
          body={"Health Check looks through a list of your photos and tags that FlickrFetch keeps on this computer. It takes a few minutes the first time, and nothing on Flickr is changed."}
        >
          <button style={styles.primaryBtn} onClick={() => void scan.startScan('full')}>Scan my photos</button>
          {scan.scanError && <div style={styles.error}>{scan.scanError}</div>}
        </EmptyState>
      </div>
    )
  }

  const info = view === 'tags'
    ? 'Checked against your tag list.\n\nNothing here changes Flickr or your files.'
    : view === 'photos'
      ? 'Nothing here changes Flickr or your files.\n\nFix titles, descriptions, tags and locations on Flickr, then press Update.'
      : 'Nothing here changes Flickr or your files.'
  const refreshKey = (scan.status.lastScanAt ?? 0) + rules.version   // a changed check or a new scan means fresh numbers
  const offCount = CLEANUP_RULES.filter(r => rules.stateOf(r.id) === 'off').length
  const rebuild = (): void => void scan.startFullRescan()

  // While a scan runs the progress card is shown and the reports are only hidden, not removed, so each one
  // keeps its place (Summary or Lists, the chosen list, the scroll) for when the scan is over
  return (
    <>
    {scan.scanning && <ScanProgressCard progress={scan.progress} />}
    <div style={{ ...styles.wrap, ...(scan.scanning ? { display: 'none' } : {}) }}>
      <div style={styles.toolbar}>
        <div style={styles.segGroup} title={"Overview: the front page across both reports.\nTags: likely typos, stuck-together names and accent problems in your tags.\nPhotos: photos with a missing title, description, tags or location."}>
          {([['overview', 'Overview'], ['tags', 'Tags'], ['photos', 'Photos']] as const).map(([v, label]) => (
            <button key={v} style={{ ...styles.seg, ...(view === v ? styles.segActive : {}) }} onClick={() => { setTagReq(null); setPhotoReq(null); goTo(v) }}>{label}</button>
          ))}
        </div>
        <span ref={setLeftSlot} style={styles.slot} />
        <div style={{ flex: 1 }} />
        <button style={quietBtn} onClick={onOpenSettings} title="Choose which checks are an Issue, a Warning or Off (opens Settings)">⚙ Tune checks{offCount > 0 ? ` (${offCount} off)` : ''}</button>
        <LibraryDataChip status={scan.status} info={info} onUpdate={() => void scan.startScan('refresh')} onRebuild={rebuild} />
        <span ref={setRightSlot} style={styles.slot} />
      </div>
      <ScanNotices status={scan.status} scanError={scan.scanError} />
      {view === 'overview' && (
        <LibraryOverview
          refreshKey={refreshKey}
          offCount={offCount}
          onGoTags={() => { setTagReq(null); goTo('tags') }}
          onGoPhotos={() => { setPhotoReq(null); goTo('photos') }}
          onOpenTags={category => { setTagReq({ category, nonce: Date.now() }); goTo('tags') }}
          onOpenPhotos={(condition, year) => { setPhotoReq({ condition, year, nonce: Date.now() }); goTo('photos') }}
          onTune={onOpenSettings}
        />
      )}
      {seen.tags && (
        <div style={view === 'tags' ? styles.pane : styles.paneHidden}>
          <AuditPanel refreshKey={refreshKey} onViewPhotos={onViewPhotos} toolbarLeft={view === 'tags' ? leftSlot : null} toolbarRight={view === 'tags' ? rightSlot : null} stateOf={rules.stateOf} openRequest={tagReq} />
        </div>
      )}
      {seen.photos && (
        <div style={view === 'photos' ? styles.pane : styles.paneHidden}>
          <HealthPanel refreshKey={refreshKey} onFullRescan={rebuild} toolbarLeft={view === 'photos' ? leftSlot : null} stateOf={rules.stateOf} openRequest={photoReq} />
        </div>
      )}
    </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--ff-cream)', overflow: 'hidden' },
  center: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--ff-cream)' },
  pane: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  paneHidden: { display: 'none' },
  toolbar: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px', padding: '10px 24px 6px' },
  slot: { display: 'inline-flex', alignItems: 'center' },
  muted: { color: 'var(--ff-text-secondary)', fontSize: '13px' },
  error: { color: 'var(--ff-error)', fontSize: '13px', maxWidth: '420px' },
  segGroup: { ...segGroupBase },
  seg: { background: '#fff', border: 'none', borderRadius: '7px', padding: '4px 14px', fontSize: '13px', cursor: 'pointer', color: 'var(--ff-text-secondary)' },
  segActive: { ...selectedOn },
  primaryBtn: { background: 'var(--ff-pink-action)', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
}
