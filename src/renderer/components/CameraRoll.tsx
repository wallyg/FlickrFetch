import React, { useCallback, useEffect, useRef, useState } from 'react'
import BatchEditButton from './BatchEditButton'
import { openTitle, rangeOpts, type RangeOpts } from './DateFilterBar'
import type { CameraRollDay, DayPhoto, PrivacyScope, DateExtra } from '../../shared/types'
import { PhotoTile } from './DateViewParts'
import { itemsLabel } from '../../shared/counts'
import { quietBtn, primaryBtn, linkBtn, segGroup, selectedOn, segBtn as segBtnBase } from '../ui/kit'

// Camera roll: the photos of one month or one day in calendar order, grouped by day, like the camera roll in
// the Photos app. Built from the local photo list, so it opens instantly. Shown inside the Timeline.

interface Props {
  from: string                  // YYYY-MM-DD
  to: string
  title: string                 // "November 2018" or "November 22, 2018"
  scope: PrivacyScope
  extra?: DateExtra             // the Photos / Videos switch and the album choice of the Timeline
  extraText?: string            // the same, in words, for counts and download notes
  onOpenRange: (from: string, to: string, opts: RangeOpts) => void
  onDownload: (photos: { id: string; title: string }[], title: string, note: string) => void
  onSeeOnThisDay: (() => void) | null   // for a single day: the same date across the years
  heading?: React.ReactNode             // replaces the plain title (the Timeline puts its back button and arrows here)
}

const PAGE_DAYS = 14

function dayHeading(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function CameraRoll({ from, to, title, scope, extra, extraText, onOpenRange, onDownload, onSeeOnThisDay, heading }: Props): React.JSX.Element {
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const xk = JSON.stringify(extra ?? null)   // a stable key, so a new but equal choice does not reload the roll
  const extraOf = (): DateExtra => (JSON.parse(xk) as DateExtra | null) ?? {}
  const [days, setDays] = useState<CameraRollDay[]>([])
  const [totalDays, setTotalDays] = useState(0)
  const [totalPhotos, setTotalPhotos] = useState(0)
  const [totalVideos, setTotalVideos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Map<string, DayPhoto>>(new Map())
  const reqRef = useRef(0)

  const load = useCallback(async (offset: number): Promise<void> => {
    const req = ++reqRef.current
    if (offset === 0) setLoading(true)
    const v = await window.flickrAPI.getCameraRoll({ from, to, scope, order, offset, limit: PAGE_DAYS, ...extraOf() })
    if (req !== reqRef.current) return
    setDays(prev => (offset === 0 ? v.days : [...prev, ...v.days]))
    setTotalDays(v.totalDays); setTotalPhotos(v.totalPhotos); setTotalVideos(v.totalVideos)
    setLoading(false)
  }, [from, to, scope, order, xk]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSelected(new Map()); void load(0) }, [load])

  const scopeNote = (scope === 'public' ? ' (public only)' : scope === 'notpublic' ? ' (not public only)' : '') + (extraText ?? '')
  const toggle = (p: DayPhoto): void => setSelected(prev => { const n = new Map(prev); if (n.has(p.id)) n.delete(p.id); else n.set(p.id, p); return n })
  const downloadDay = async (date: string, label: string): Promise<void> => {
    const photos = await window.flickrAPI.getDatePhotoIds({ kind: 'range', from: date, to: date, scope, ...extraOf() })
    if (photos.length) onDownload(photos, `Camera roll, ${label}`, `Photos taken on ${label}${scopeNote}`)
  }
  const downloadAll = async (): Promise<void> => {
    const photos = await window.flickrAPI.getDatePhotoIds({ kind: 'range', from, to, scope, ...extraOf() })
    if (photos.length) onDownload(photos, `Camera roll, ${title}`, `Photos taken in ${title}${scopeNote}`)
  }

  return (
    <div>
      <div style={styles.bar}>
        {heading ?? <b style={{ color: 'var(--ff-navy)', fontSize: 14 }}>{title}</b>}
        <span style={styles.muted}>{itemsLabel(totalPhotos, totalVideos)} on {totalDays.toLocaleString()} day{totalDays === 1 ? '' : 's'}{scopeNote}</span>
        <div style={{ flex: 1 }} />
        <div style={styles.seg}>
          {(['asc', 'desc'] as const).map(o => (
            <button key={o} style={{ ...styles.segBtn, ...(order === o ? styles.segOn : {}) }} onClick={() => setOrder(o)}>{o === 'asc' ? 'Oldest first' : 'Newest first'}</button>
          ))}
        </div>
        {onSeeOnThisDay && <button style={styles.btn} onClick={onSeeOnThisDay} title="This date in every year">See in On This Day</button>}
        <button style={styles.btn} title={extra?.albumIds?.length ? openTitle(extra, 'that period') : undefined} onClick={() => onOpenRange(from, to, rangeOpts(extra))}>Open in Photostream</button>
        <BatchEditButton inline style={styles.btn} getIds={async () => (await window.flickrAPI.getDatePhotoIds({ kind: 'range', from, to, scope, ...extraOf() })).map(p => p.id)} />
        <button style={{ ...styles.btn, ...styles.primary }} disabled={totalPhotos === 0} onClick={() => void downloadAll()}>Download all {totalPhotos.toLocaleString()}</button>
      </div>

      {selected.size > 0 && (
        <div style={{ ...styles.bar, background: 'var(--ff-tint)', border: '1px solid #ffc2de', borderRadius: 8, padding: '6px 10px' }}>
          <span style={styles.muted}>{selected.size} selected</span>
          <button style={styles.btn} onClick={() => onDownload([...selected.values()].map(p => ({ id: p.id, title: p.title })), `Camera roll, ${title} (selected)`, 'Only the photos you selected')}>Download selected</button>
          <BatchEditButton inline style={styles.btn} getIds={async () => [...selected.values()].map(p => p.id)} />
          <button style={styles.link} onClick={() => setSelected(new Map())}>Clear</button>
        </div>
      )}

      {loading && days.length === 0 ? <div style={styles.muted}>Loading your photos…</div>
        : days.length === 0 ? <div style={styles.muted}>No photos here{scopeNote}.</div>
        : days.map(d => (
          <div key={d.date} style={{ margin: '14px 0 4px' }}>
            <div style={styles.dayHead}>
              <b style={{ fontSize: 14, color: 'var(--ff-navy)' }}>{dayHeading(d.date)}</b>
              <span style={styles.muted}>{itemsLabel(d.count, d.videos)}</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12 }}>
                <button style={styles.link} onClick={() => onOpenRange(d.date, d.date, rangeOpts(extra))}>Open in Photostream</button>
                <button style={styles.link} onClick={() => void downloadDay(d.date, dayHeading(d.date))}>Download this day</button>
              </span>
            </div>
            <div style={styles.tiles}>{d.photos.map(p => <PhotoTile key={p.id} photo={p} selected={selected.has(p.id)} onClick={() => toggle(p)} />)}</div>
            {d.count > d.photos.length && <div style={styles.muted}>Showing the first {d.photos.length} of {d.count.toLocaleString()}. Open in Photostream or Download this day for all of them.</div>}
          </div>
        ))}

      {days.length < totalDays && (
        <button style={styles.more} onClick={() => void load(days.length)}>Show more days ({(totalDays - days.length).toLocaleString()} left)</button>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 8px' },
  muted: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  seg: { ...segGroup },
  segBtn: { ...segBtnBase },
  segOn: { ...selectedOn },
  btn: { ...quietBtn },
  primary: { ...primaryBtn },
  link: { ...linkBtn },
  dayHead: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 },
  more: { width: '100%', margin: '16px 0 8px', padding: 10, background: 'none', border: '1px dashed var(--ff-line-strong)', borderRadius: 8, color: 'var(--ff-text-secondary)', fontSize: 13, cursor: 'pointer' }
}
