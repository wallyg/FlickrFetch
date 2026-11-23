import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BackupList, BackupSort, BackupSummary, HealthPhoto } from '../../shared/types'
import { dash, SectionSwitch } from './DashboardParts'
import { RailHead, RailRow, ListHead, SortBox } from './RuleRail'
import { quietBtn, primaryBtn, filterInput } from '../ui/kit'
import { asButton } from '../ui/a11y'
import BackToTop from '../ui/BackToTop'
import { useFindShortcut } from '../hooks/useFindShortcut'

// The Backup report in Health Check: how much of your library has been downloaded, worked out from FlickrFetch's own download
// records and your library list. Nothing is asked of Flickr and nothing is changed.

interface Props {
  refreshKey: number
  toolbarLeft?: HTMLElement | null     // where the Summary | Lists switch goes
  onDownload: (photos: { id: string; title: string }[], title: string, note: string) => void   // opens the usual download confirmation
}

const PAGE = 100
const NAMES: Record<BackupList, string> = { not: 'Not downloaded', new: 'New since last download', changed: 'Changed since download', smaller: 'Saved smaller than the original' }
const LISTS: BackupList[] = ['not', 'new', 'changed', 'smaller']

const when = (ms: number | null): string => ms === null ? 'never' : new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

export default function BackupPanel({ refreshKey, toolbarLeft, onDownload }: Props): React.JSX.Element {
  const [summary, setSummary] = useState<BackupSummary | null>(null)
  const [section, setSection] = useState<'overview' | 'lists'>('overview')
  const [list, setList] = useState<BackupList>('not')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<BackupSort>('uploaded')
  const [rows, setRows] = useState<HealthPhoto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const requestRef = useRef(0)
  const filterRef = useRef<HTMLInputElement | null>(null)
  useFindShortcut(!!toolbarLeft && section === 'lists', filterRef)

  useEffect(() => { void window.flickrAPI.getBackupSummary().then(setSummary) }, [refreshKey])

  const loadRows = useCallback(async (offset: number): Promise<void> => {
    const req = ++requestRef.current
    if (offset === 0) setLoading(true)
    const page = await window.flickrAPI.listBackupPhotos({ list, search, sort, offset, limit: PAGE })
    if (req !== requestRef.current) return
    setRows(prev => (offset === 0 ? page.rows : [...prev, ...page.rows]))
    setTotal(page.total)
    setLoading(false)
  }, [list, search, sort])

  useEffect(() => {
    if (section !== 'lists') return
    const t = setTimeout(() => void loadRows(0), search ? 200 : 0)
    return () => clearTimeout(t)
  }, [loadRows, refreshKey, section])

  const open = (l: BackupList): void => { setList(l); setSearch(''); setSection('lists') }
  const count = (l: BackupList): number => !summary ? 0 : l === 'not' ? summary.notDownloaded : l === 'new' ? summary.newSince : l === 'changed' ? summary.changed : summary.smaller
  const last = summary ? when(summary.lastDownloadAt) : ''

  const blurb: Record<BackupList, string> = {
    not: 'Photos and videos you have not downloaded with FlickrFetch.',
    new: summary?.lastDownloadAt
      ? `Uploaded to Flickr after your last download on ${last}, and not downloaded yet. Any download counts, even a single photo.`
      : 'You have not downloaded anything with FlickrFetch yet.',
    changed: `Downloaded, then changed on Flickr since (edited, retitled, retagged and so on), so your copy may be out of date.${summary && summary.unknownUpdate > 0 ? ` ${summary.unknownUpdate.toLocaleString()} older download${summary.unknownUpdate === 1 ? '' : 's'} did not record Flickr's update time, so they cannot be checked.` : ''}`,
    smaller: `Downloaded at a smaller size because Flickr did not offer the original (free accounts get sizes up to 1024 px). Downloading again gives the same size, so there is no button here.${summary && summary.sizeUnknown > 0 ? ` ${summary.sizeUnknown.toLocaleString()} earlier download${summary.sizeUnknown === 1 ? '' : 's'} did not record their size, so they are not counted.` : ''}`
  }

  const downloadList = async (): Promise<void> => {
    const photos = await window.flickrAPI.getBackupPhotos({ list, search, sort })
    if (photos.length === 0) return
    onDownload(photos, `Backup: ${NAMES[list]}`, `${NAMES[list]}${search ? ` (title contains "${search}")` : ''}`)
  }

  const switcher = <SectionSwitch section={section} onChange={setSection} />
  const fraction = summary && summary.library > 0 ? summary.downloaded / summary.library : 0

  return (
    <div style={styles.wrap}>
      {toolbarLeft ? createPortal(switcher, toolbarLeft) : <div style={dash.switchRow}>{switcher}</div>}

      {section === 'overview' ? (
        <div style={dash.wrap}>
          <div style={dash.card}>
            <h3 style={dash.cardTitle}>How much of your library is downloaded? <span style={dash.hint}>(from FlickrFetch’s own records)</span></h3>
            {!summary ? <div style={dash.muted}>Counting…</div> : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--ff-text)' }}>{summary.downloaded.toLocaleString()}</span>
                  <span style={dash.big}>of {summary.library.toLocaleString()} photos and videos downloaded</span>
                </div>
                <div style={styles.track} aria-hidden="true"><div style={{ ...styles.fill, width: `${Math.max(fraction * 100, summary.downloaded > 0 ? 0.6 : 0)}%` }} /></div>
                <div style={{ ...dash.muted, marginTop: 6 }}>Last download: {last}</div>
              </>
            )}
          </div>
          {summary && (
            <div style={dash.grid}>
              {LISTS.map(l => (
                <div key={l} style={{ ...dash.card, cursor: 'pointer' }} {...asButton(() => open(l))} title="Open this list">
                  <div style={dash.big}>{NAMES[l]}</div>
                  <span style={dash.bigNum}>{count(l).toLocaleString()}</span>
                  <div style={{ ...dash.muted, marginTop: 4 }}>
                    {l === 'not' ? 'Never downloaded' : l === 'new' ? (summary.lastDownloadAt ? `Uploaded after ${last}` : 'Nothing downloaded yet') : l === 'smaller' ? `Flickr did not offer the original${summary.sizeUnknown > 0 ? ` (${summary.sizeUnknown.toLocaleString()} earlier downloads have no recorded size)` : ''}` : `Edited on Flickr after you downloaded them${summary.unknownUpdate > 0 ? ` (${summary.unknownUpdate.toLocaleString()} cannot be checked)` : ''}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.body}>
          <div style={styles.railCol}>
            <div style={styles.rail}>
              <RailHead first>Backup</RailHead>
              {LISTS.map(l => <RailRow key={l} selected={list === l} dim={count(l) === 0} label={NAMES[l]} count={count(l)} onSelect={() => { setList(l); setSearch('') }} />)}
              <RailHead>Filter</RailHead>
              <input ref={filterRef} style={filterInput} placeholder="Filter by title…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Filter by title" />
              {list !== 'smaller' && (
                <>
                  <RailHead>This list</RailHead>
                  <button style={{ ...primaryBtn, width: '100%' }} disabled={total === 0} onClick={() => void downloadList()} title="Opens the usual download confirmation">
                    Download these {total.toLocaleString()}
                  </button>
                </>
              )}
            </div>
          </div>
          <div style={styles.main}>
            <ListHead sort={<SortBox<BackupSort> value={sort} onChange={setSort} options={[
              { value: 'uploaded', label: 'Newest uploaded first' }, { value: 'uploadedOldest', label: 'Oldest uploaded first' },
              { value: 'taken', label: 'Newest taken first' }, { value: 'title', label: 'Title A to Z' }, { value: 'titleDesc', label: 'Title Z to A' }]} />}>{blurb[list]}</ListHead>
            <div style={styles.list}>
              {loading && rows.length === 0 ? <div style={dash.muted}>Checking your library…</div>
                : rows.length === 0 ? <div style={dash.muted}>Nothing here.</div>
                : rows.map(p => (
                  <div key={p.photoId} style={styles.card}>
                    {p.thumbUrl ? <img src={p.thumbUrl} alt="" loading="lazy" style={styles.thumb} /> : <div style={styles.thumb} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.l1}><span style={styles.title}>{p.title || '(no title)'}</span><span style={styles.pill}>{p.kind}</span></div>
                      <div style={dash.muted}>{p.dateTaken ? `Taken ${p.dateTaken.slice(0, 10)}` : 'No date taken'}</div>
                      <div style={styles.actions}>
                        <button style={styles.mainActionBtn} onClick={() => window.flickrAPI.openExternal(p.flickrUrl)}>Open on Flickr ↗</button>
                        {list !== 'smaller' && <button style={quietBtn} onClick={() => onDownload([{ id: p.photoId, title: p.title }], `Backup: ${p.title || p.photoId}`, 'One photo')}>Download this one</button>}
                      </div>
                    </div>
                  </div>
                ))}
              {rows.length < total && <button style={styles.moreBtn} onClick={() => void loadRows(rows.length)}>Show more ({(total - rows.length).toLocaleString()} left)</button>}
            </div>
            <BackToTop />
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  body: { flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: '4px 24px 12px' },
  railCol: { width: 230, flexShrink: 0, alignSelf: 'flex-start', maxHeight: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 },
  rail: { flexShrink: 0, background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 6 },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 },
  card: { display: 'flex', gap: 12, background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 10, marginBottom: 8 },
  thumb: { width: 76, height: 76, borderRadius: 6, objectFit: 'cover', background: '#eee', flexShrink: 0 },
  l1: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--ff-text)', overflowWrap: 'anywhere' },
  pill: { fontSize: 11, borderRadius: 10, padding: '1px 8px', background: '#f1efec', color: 'var(--ff-text-secondary)' },
  actions: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  mainActionBtn: { ...quietBtn, borderColor: 'var(--ff-blue)', color: 'var(--ff-blue)', fontWeight: 600 },
  moreBtn: { ...quietBtn, width: '100%', marginBottom: 12 },
  track: { height: 10, borderRadius: 5, background: '#f1efec', overflow: 'hidden', marginTop: 10 },
  fill: { height: 10, background: 'var(--ff-pink)' }
}
