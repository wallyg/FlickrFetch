import React, { useEffect, useRef, useState } from 'react'
import { useRememberScroll } from '../hooks/useRememberScroll'
import type { AuditCategory, HealthCondition, TagMode } from '../../shared/types'
import { CLEANUP_RULES } from '../../shared/cleanupRules'
import EmptyState from './EmptyState'
import Icon from '../ui/Icon'
import ClickNote from '../ui/ClickNote'
import AuditPanel from './AuditPanel'
import HealthPanel from './HealthPanel'
import BackupPanel from './BackupPanel'
import AlbumsPanel from './AlbumsPanel'
import LibraryOverview from './LibraryOverview'
import { LibraryDataChip, ScanNotices, ScanProgressCard } from './TagScanParts'
import { useTagScan } from '../hooks/useTagScan'
import { useCleanupRules } from '../hooks/useCleanupRules'
import { segGroup as segGroupBase, segBtn, selectedOn, quietBtn, primaryBtn as mainBtn } from '../ui/kit'

// The Cleanup tab: reports on the quality of your library. Overview is the front page; Tags finds likely tag
// problems; Photos finds photos with missing titles, descriptions, tags or locations. Each check can be On
// (needs attention), Optional or Off (Tune checks). All of it reads the local library list, and none of it
// changes Flickr or your files.

interface Props {
  onViewPhotos: (tags: string[], mode: TagMode) => void
  onDownload: (photos: { id: string; title: string }[], title: string, note: string) => void   // the usual download confirmation
  settingsKey: number          // goes up when Settings has been closed, so the checks are read again
  onOpenSettings: () => void   // opens Settings on its Health Check tab (Tune checks)
  onShowOnMap?: (lat: number, lon: number) => void   // opens the Map tab on a place (a suggested location, or a geotag that looks wrong)
  backupRequest?: { list: 'smaller'; nonce: number } | null   // a finished download asking for one Backup list
}

type View = 'overview' | 'tags' | 'photos' | 'albums' | 'backup'

export default function CleanupPanel({ onViewPhotos, onDownload, settingsKey, onOpenSettings, onShowOnMap, backupRequest }: Props): React.JSX.Element {
  const scan = useTagScan()
  const rules = useCleanupRules(settingsKey)
  const [view, setView] = useState<View>('overview')
  // A report stays open once visited (just hidden), so it keeps its place: Summary or Lists, the chosen list, the scroll
  const [seen, setSeen] = useState({ tags: false, photos: false, albums: false, backup: false })
  const goTo = (v: View): void => { setView(v); if (v !== 'overview') setSeen(s => ({ ...s, [v]: true })) }
  // The front page opens one list in a report: a counter makes each request new
  const [tagReq, setTagReq] = useState<{ category: AuditCategory; nonce: number } | null>(null)
  const [photoReq, setPhotoReq] = useState<{ condition: HealthCondition; year?: string; nonce: number } | null>(null)
  // A finished download asks for the Backup list of photos that came down smaller (#126)
  useEffect(() => { if (backupRequest) goTo('backup') }, [backupRequest?.nonce])   // eslint-disable-line react-hooks/exhaustive-deps
  // Slots in the toolbar where the report's own controls (Overview | Lists, Plan) are placed, so everything shares one row
  const [leftSlot, setLeftSlot] = useState<HTMLElement | null>(null)
  const [rightSlot, setRightSlot] = useState<HTMLElement | null>(null)
  // When the window is narrow the toolbar keeps to one row: Tune checks becomes just the gear and the data chip drops the word Updated
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  useRememberScroll(wrapRef, `${view}|${scan.scanning}`)   // Overview, Photos, Albums, Tags and Backup each keep their place, also after a scan
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const watch = (): void => setNarrow(el.clientWidth < 1080)
    watch()
    const ro = new ResizeObserver(watch)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scan.status !== null])

  if (!scan.status) return <div style={styles.center}><span style={styles.muted}>Loading…</span></div>
  if (!scan.status.hasIndex) {
    return (
      <div style={styles.center}>
        <EmptyState
          title="Build your library list first"
          body={"Health Check looks through a list of your photos and tags that FlickrFetch keeps on this computer. It takes a few minutes the first time."}
        >
          <button style={styles.primaryBtn} onClick={() => void scan.startScan('full')}>Scan my photos</button>
          {scan.scanError && <div style={styles.error}>{scan.scanError}</div>}
        </EmptyState>
      </div>
    )
  }

  // The (i) on the data chip: how Health Check works (the same for every tab), then one line on what this tab adds
  const info = [
    '# How Health Check works',
    '',
    'FlickrFetch keeps a snapshot of your photos, tags and albums on this computer. Health Check runs a set of audits against that snapshot, so results come quickly.',
    '',
    'Each audit can be Off, a Warning or an Issue (change them in Tune checks).',
    '',
    'Health Check never changes anything unless you choose to. For now you fix things on Flickr, then press Update to refresh the snapshot.',
    '',
    view === 'tags' ? 'Tags: checked against your tag list.'
      : view === 'photos' ? 'Photos: fix titles, descriptions, tags and locations on Flickr, then press Update.'
      : view === 'albums' ? 'Albums: uses the album list the snapshot keeps. A Rebuild reads every album.'
      : view === 'backup' ? 'Backup: also uses FlickrFetch’s own download records.'
      : 'Overview: the front page across all the reports.'
  ].join('\n')
  const refreshKey = (scan.status.lastScanAt ?? 0) + rules.version   // a changed check or a new scan means fresh numbers
  const offCount = CLEANUP_RULES.filter(r => rules.stateOf(r.id) === 'off').length
  const rebuild = (): void => void scan.startFullRescan()

  // While a scan runs the progress card is shown and the reports are only hidden, not removed, so each one
  // keeps its place (Summary or Lists, the chosen list, the scroll) for when the scan is over
  return (
    <>
    {scan.scanning && <ScanProgressCard progress={scan.progress} />}
    <div ref={wrapRef} style={{ ...styles.wrap, ...(scan.scanning ? { display: 'none' } : {}) }}>
      <div ref={toolbarRef} style={styles.toolbar}>
        <div style={styles.segGroup}>
          {([['overview', 'Overview'], ['photos', 'Photos'], ['albums', 'Albums'], ['tags', 'Tags'], ['backup', 'Backup']] as const).map(([v, label]) => (
            <button key={v} style={{ ...styles.seg, ...(view === v ? styles.segActive : {}) }} onClick={() => { setTagReq(null); setPhotoReq(null); goTo(v) }}>{label}</button>
          ))}
        </div>
        <span ref={setLeftSlot} style={styles.slot} />
        <div style={{ flex: 1 }} />
        <button style={quietBtn} onClick={onOpenSettings} aria-label="Tune checks" title="Tune checks: choose which checks are an Issue, a Warning or Off (opens Settings)"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="switches" size={narrow ? 20 : 17} />{narrow ? '' : 'Tune checks'}</span></button>
        <ClickNote text={info} style={quietBtn} ariaLabel="How Health Check works"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="pulse" size={narrow ? 20 : 17} />{narrow ? '' : 'How it works'}</span></ClickNote>
        <LibraryDataChip status={scan.status} compact={narrow} onUpdate={() => void scan.startScan('refresh')} onRebuild={rebuild} />
        <span ref={setRightSlot} style={styles.slot} />
      </div>
      <ScanNotices status={scan.status} scanError={scan.scanError} onRebuild={rebuild} />
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
          <HealthPanel refreshKey={refreshKey} onFullRescan={rebuild} toolbarLeft={view === 'photos' ? leftSlot : null} stateOf={rules.stateOf} openRequest={photoReq} needsRebuild={scan.status.hasIndex && !scan.status.hasCatalogV3} onShowOnMap={onShowOnMap} />
        </div>
      )}
      {seen.albums && (
        <div style={view === 'albums' ? styles.pane : styles.paneHidden}>
          <AlbumsPanel refreshKey={refreshKey} onFullRescan={rebuild} toolbarLeft={view === 'albums' ? leftSlot : null} stateOf={rules.stateOf} />
        </div>
      )}
      {seen.backup && (
        <div style={view === 'backup' ? styles.pane : styles.paneHidden}>
          <BackupPanel refreshKey={refreshKey} toolbarLeft={view === 'backup' ? leftSlot : null} onDownload={onDownload} openRequest={backupRequest} />
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
  toolbar: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px', padding: '8px 24px 6px' },
  slot: { display: 'inline-flex', alignItems: 'center' },
  muted: { color: 'var(--ff-text-secondary)', fontSize: '13px' },
  error: { color: 'var(--ff-error)', fontSize: '13px', maxWidth: '420px' },
  segGroup: { ...segGroupBase },
  seg: { ...segBtn, padding: '4px 12px' },
  segActive: { ...selectedOn },
  primaryBtn: { ...mainBtn },
}
