import React, { useCallback, useEffect, useState } from 'react'
import Icon from '../ui/Icon'
import SelectBar from './SelectBar'
import BatchEditButton from './BatchEditButton'
import { forgetOverview } from './LibraryOverview'
import { askFineReason } from '../ui/fineReason'
import { quietBtn, linkBtn } from '../ui/kit'
import { DEBOUNCE, useDebouncedValue } from '../ui/useDebounce'
import type { DuplicateGroup, DuplicatePhoto, DuplicateSort } from '../../shared/types'

// The list under Photos > Possible duplicates (#157): one card per group of photos with the same date and time taken, uploaded at different times,
// shown side by side so it is clear which to keep. "Not duplicates" marks every photo in the group as fine. Nothing here deletes anything:
// the result is a list to deal with on Flickr.

const PAGE = 30

interface Props {
  status: 'open' | 'fine'
  search: string
  sort: DuplicateSort
  selected: Set<string>
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  refreshKey: number
  onChanged: () => void   // a group moved between Open and Marked fine: the counts need reading again
}

const PRIVACY = ['Public', 'Friends', 'Family', 'Friends and family', 'Private']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2005-09-09 05:24:01" -> "9 Sep 2005, 05:24:01" (read as written: the camera's own clock, no time zone)
function takenText(taken: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}:\d{2})/.exec(taken)
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}, ${m[4]}` : taken
}
function uploadedText(sec: number): string {
  const d = new Date(sec * 1000)
  const two = (n: number): string => String(n).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}
function gapText(s: number): string {
  const n = (x: number, unit: string): string => `${x} ${unit}${x === 1 ? '' : 's'}`
  if (s < 3600) return n(Math.max(1, Math.round(s / 60)), 'minute')
  if (s < 2 * 86400) return n(Math.round(s / 3600), 'hour')
  if (s < 90 * 86400) return n(Math.round(s / 86400), 'day')
  if (s < 2 * 365 * 86400) return n(Math.round(s / (30.44 * 86400)), 'month')
  return `${(s / (365.25 * 86400)).toFixed(1)} years`
}
const sameTitle = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

export default function DuplicatesList({ status, search, sort, selected, setSelected, refreshKey, onChanged }: Props): React.JSX.Element {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [total, setTotal] = useState(0)
  const [photoTotal, setPhotoTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const typed = useDebouncedValue(search, search ? DEBOUNCE.typing : 0)   // typing waits a moment so every key does not search; clearing the box is at once

  const load = useCallback(async (offset: number, stale: () => boolean): Promise<void> => {
    if (offset === 0) { setLoading(true); setFailed(false) }
    try {
      const page = await window.flickrAPI.getDuplicateGroups({ status, search: typed, sort, offset, limit: PAGE })
      if (stale()) return
      setGroups(prev => (offset === 0 ? page.groups : [...prev, ...page.groups]))
      setTotal(page.total); setPhotoTotal(page.photos)
    } catch {
      if (!stale()) setFailed(true)
    } finally {
      if (!stale()) setLoading(false)
    }
  }, [status, typed, sort])

  useEffect(() => {
    let dead = false
    void load(0, () => dead)
    return () => { dead = true }
  }, [load, refreshKey, attempt])

  const mark = async (g: DuplicateGroup, next: 'open' | 'fine'): Promise<void> => {
    setNotice(null)
    try {
      await Promise.all(g.photos.map(p => window.flickrAPI.setHealthStatus({ photoId: p.photoId, condition: 'duplicates', status: next })))
    } catch {
      // Some of the photos may have been marked and some not: read the list again so it shows what is true
      setNotice('Some photos in that group could not be updated. The list has been reloaded.')
      setAttempt(n => n + 1)
      onChanged()
      return
    }
    if (next === 'fine') askFineReason({ checkId: 'photos:duplicates', key: g.photos[0].photoId, label: g.photos[0].title || takenText(g.taken) })
    forgetOverview()
    setGroups(prev => prev.filter(x => x.taken !== g.taken))
    setSelected(prev => { const n = new Set(prev); g.photos.forEach(p => n.delete(p.photoId)); return n })
    setTotal(t => Math.max(0, t - 1))
    onChanged()
  }
  const toggle = (id: string, on: boolean): void => setSelected(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n })
  const shown = groups.reduce((n, g) => n + g.photos.length, 0)

  if (loading && groups.length === 0) return <div style={styles.muted}>Looking for duplicates…</div>
  if (failed) return <div style={styles.muted}>This could not be loaded. <button style={styles.link} onClick={() => setAttempt(n => n + 1)}>Try again</button></div>
  if (groups.length === 0) return <div style={styles.muted}>{status === 'open' ? 'No possible duplicates left to review.' : 'Nothing here.'}</div>

  return (
    <>
      <SelectBar count={selected.size} shown={shown} ids={() => [...selected]} onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(groups.flatMap(g => g.photos.map(p => p.photoId))))} />
      <div style={styles.summary}>{total.toLocaleString()} group{total === 1 ? '' : 's'} · {photoTotal.toLocaleString()} photos{notice ? ` · ${notice}` : ''}</div>
      <div style={styles.list}>
        {groups.map(g => {
          const first = g.photos[0]
          return (
            <section key={g.taken} style={{ ...styles.group, ...(status === 'fine' ? { opacity: 0.7 } : {}) }}>
              <div style={styles.ghead}>
                <span style={styles.gtitle}>Taken {takenText(g.taken)}</span>
                <span style={styles.muted}>{g.photos.length} photos · first to last upload {gapText(g.gapSeconds)} apart</span>
                <span style={styles.gact}>
                  {status === 'open'
                    ? <button style={styles.btn} onClick={() => void mark(g, 'fine')}>Not duplicates</button>
                    : <button style={styles.btn} onClick={() => void mark(g, 'open')}>Undo</button>}
                  <BatchEditButton inline key={g.taken} style={styles.btn} label={`Open in Flickr's organizer (${g.photos.length})`} getIds={async () => g.photos.map(p => p.photoId)} />
                </span>
              </div>
              <div style={styles.tiles}>
                {g.photos.map((p: DuplicatePhoto, i) => (
                  <div key={p.photoId} style={{ ...styles.tile, ...(selected.has(p.photoId) ? styles.tileOn : {}) }}>
                    <div style={styles.top}>
                      <input type="checkbox" style={styles.tick} checked={selected.has(p.photoId)} aria-label="Select this photo" onChange={e => toggle(p.photoId, e.target.checked)} />
                      {p.thumbUrl ? <img src={p.thumbUrl} alt="" loading="lazy" style={styles.thumb} /> : <div style={styles.thumb} />}
                    </div>
                    <div style={styles.title}>{p.title || '(no title)'}</div>
                    <div style={styles.muted}>Uploaded {uploadedText(p.uploadedAt)}</div>
                    <div style={styles.muted}>{p.tags} tag{p.tags === 1 ? '' : 's'}{p.albums === null ? '' : ` · ${p.albums} album${p.albums === 1 ? '' : 's'}`} · {PRIVACY[p.privacy] ?? 'Private'}</div>
                    <div style={styles.foot}>
                      {i === 0 && <span style={{ ...styles.badge, ...styles.badgeFirst }}>First upload</span>}
                      {i > 0 && !sameTitle(p.title, first.title) && <span style={styles.badge}>Different title</span>}
                      <button style={styles.open} onClick={() => window.flickrAPI.openExternal(p.flickrUrl)}>Open on Flickr <Icon name="external" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
        {groups.length < total && <button style={styles.more} onClick={() => void load(groups.length, () => false)}>Show more ({(total - groups.length).toLocaleString()} left)</button>}
      </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  muted: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  summary: { fontSize: 12, color: 'var(--ff-text-secondary)', margin: '0 0 8px' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 },
  group: { background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 },
  ghead: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 8 },
  gtitle: { fontSize: 14, fontWeight: 700, color: 'var(--ff-text)' },
  gact: { marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  btn: { ...quietBtn },
  tiles: { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' },
  tile: { border: '1px solid var(--ff-border)', borderRadius: 8, padding: 8, minWidth: 0, background: 'var(--ff-surface)' },
  tileOn: { borderColor: 'var(--ff-blue)', background: 'color-mix(in srgb, var(--ff-blue) 6%, transparent)' },
  top: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  tick: { marginTop: 3, flexShrink: 0, cursor: 'pointer' },
  thumb: { flex: 1, minWidth: 0, height: 90, borderRadius: 6, objectFit: 'cover', background: 'var(--ff-border)' },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--ff-text)', marginTop: 6, overflowWrap: 'anywhere' },
  foot: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  badge: { fontSize: 11, borderRadius: 8, padding: '1px 8px', background: 'var(--ff-border)', color: 'var(--ff-text-secondary)' },
  badgeFirst: { background: 'var(--ff-success-bg)', color: 'var(--ff-success)' },
  open: { ...linkBtn, marginLeft: 'auto' },
  link: { background: 'none', border: 'none', color: 'var(--ff-blue)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline', padding: 0 },
  more: { width: '100%', padding: 8, background: 'none', border: '1px dashed var(--ff-line-strong)', borderRadius: 8, color: 'var(--ff-text-secondary)', fontSize: 13, cursor: 'pointer', marginBottom: 12 }
}
