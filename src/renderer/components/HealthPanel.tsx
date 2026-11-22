import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { HealthCondition, HealthPhoto, HealthSummary } from '../../shared/types'
import HealthOverview from './HealthOverview'
import { dash } from './DashboardParts'

// The Health view of the Tags tab: photos with missing or weak metadata, by problem, as a to-do list
// to fix on Flickr. Nothing here changes Flickr or your files.

interface HealthPanelProps {
  refreshKey: number       // changes when the library is rescanned
  onFullRescan: () => void // for libraries scanned before this report existed
}

const PAGE = 100

const INFO: Record<HealthCondition, { name: string; blurb: string }> = {
  title: {
    name: 'No title, or a camera-file title',
    blurb: 'Photos with an empty title, or one left over from the camera or phone (IMG_1234, DSC_0042, GOPR3893, 20240315_101500).'
  },
  description: { name: 'No description', blurb: 'Photos with nothing in the description box.' },
  tags: { name: 'No tags', blurb: 'Photos with no tags at all, so they never turn up in a tag search.' },
  location: { name: 'No location', blurb: 'Photos with no map location.' }
}
const CONDITIONS: HealthCondition[] = ['title', 'description', 'tags', 'location']

export default function HealthPanel({ refreshKey, onFullRescan }: HealthPanelProps): React.JSX.Element {
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [section, setSection] = useState<'overview' | 'lists'>('overview')
  const [condition, setCondition] = useState<HealthCondition>('title')
  const [year, setYear] = useState('')   // set by clicking a cluster on the overview
  const [status, setStatus] = useState<'open' | 'fine'>('open')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<HealthPhoto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)
  const requestRef = useRef(0)

  const loadSummary = useCallback(async () => { setSummary(await window.flickrAPI.getHealthSummary()) }, [])
  useEffect(() => { void loadSummary() }, [loadSummary, refreshKey])

  const loadRows = useCallback(async (offset: number): Promise<void> => {
    const req = ++requestRef.current
    if (offset === 0) setLoading(true)
    const page = await window.flickrAPI.listHealthPhotos({ condition, status, search, year: year || undefined, offset, limit: PAGE })
    if (req !== requestRef.current) return
    setRows(prev => (offset === 0 ? page.rows : [...prev, ...page.rows]))
    setTotal(page.total)
    setLoading(false)
  }, [condition, status, search, year])

  useEffect(() => {
    if (summary && !summary.hasData) return
    const t = setTimeout(() => void loadRows(0), search ? 200 : 0)
    return () => clearTimeout(t)
  }, [loadRows, search, refreshKey, summary?.hasData])

  const mark = async (p: HealthPhoto, next: 'open' | 'fine'): Promise<void> => {
    await window.flickrAPI.setHealthStatus({ photoId: p.photoId, condition, status: next })
    setRows(prev => prev.filter(r => r.photoId !== p.photoId))
    setTotal(t => Math.max(0, t - 1))
    await loadSummary()
  }

  if (summary && !summary.hasData) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyTitle}>One more scan needed</div>
        <div style={styles.muted}>
          Your tag list was built before the metadata report existed. A Full rescan reads every photo once more, this time also noting titles, descriptions, locations and thumbnails. It takes a few minutes and changes nothing on Flickr.
        </div>
        <button style={styles.primaryBtn} onClick={onFullRescan}>Full rescan</button>
      </div>
    )
  }

  const row = summary?.rows.find(r => r.condition === condition)

  return (
    <div style={styles.wrap}>
      <div style={dash.switchRow}>
        <div style={dash.seg}>
          {(['overview', 'lists'] as const).map(v => (
            <button key={v} style={{ ...dash.segBtn, ...(section === v ? dash.segOn : {}) }} onClick={() => setSection(v)}>{v === 'overview' ? 'Overview' : 'Lists'}</button>
          ))}
        </div>
      </div>
      <div style={styles.top}>
        <span style={styles.muted}>
          {summary ? `${summary.photos.toLocaleString()} photos checked. ` : ''}Nothing here changes Flickr or your files. Fix titles, descriptions, tags and locations on Flickr, then Refresh.
        </span>
      </div>
      {section === 'overview' ? (
        <HealthOverview refreshKey={refreshKey} onOpenList={(c, y) => { setCondition(c); setStatus('open'); setYear(y ?? ''); setSection('lists') }} />
      ) : (
      <div style={styles.body}>
        <div style={styles.rail}>
          {CONDITIONS.map(c => {
            const r = summary?.rows.find(x => x.condition === c)
            return (
              <div key={c} style={{ ...styles.railItem, ...(c === condition ? styles.railSel : {}) }} onClick={() => { setCondition(c); setStatus('open'); setYear('') }}>
                <span>{INFO[c].name}</span><b style={{ fontWeight: 600 }}>{(r?.open ?? 0).toLocaleString()}</b>
              </div>
            )
          })}
        </div>

        <div style={styles.main}>
          <div style={styles.statusRow}>
            {(['open', 'fine'] as const).map(s => (
              <button key={s} style={{ ...styles.statusChip, ...(status === s ? styles.statusChipOn : {}) }} onClick={() => setStatus(s)}>
                {s === 'open' ? 'Open' : 'Marked fine'} <span style={{ opacity: 0.7 }}>{(year && s === status ? total : row ? row[s] : 0).toLocaleString()}</span>
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button style={styles.secondaryBtn} title="Save every photo in this list (with the current filter) as a spreadsheet" onClick={async () => { setSaved(await window.flickrAPI.saveHealthCsv({ condition, status, search, year: year || undefined })) }}>Export this list</button>
            {saved && <><span style={styles.muted}>Saved to {saved.split('/').pop()}</span><button style={styles.linkBtn} onClick={() => window.flickrAPI.showInFinder(saved)}>Show in Finder</button></>}
 {year && <button style={styles.statusChip} title="Show every year again" onClick={() => setYear('')}>Taken in {year} ✕</button>}
            <input style={styles.search} placeholder="Filter by title…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ ...styles.muted, margin: '2px 0 10px' }}>{INFO[condition].blurb} Newest photos first.</div>

          <div style={styles.list}>
            {loading && rows.length === 0 ? <div style={styles.muted}>Checking your photos…</div>
              : rows.length === 0 ? <div style={styles.muted}>{status === 'open' ? 'Nothing left to fix here.' : 'Nothing here.'}</div>
              : rows.map(p => (
                <div key={p.photoId} style={{ ...styles.card, ...(p.status === 'fine' ? { opacity: 0.6 } : {}) }}>
                  {p.thumbUrl ? <img src={p.thumbUrl} alt="" loading="lazy" style={styles.thumb} /> : <div style={styles.thumb} />}
                  <div style={styles.cardBody}>
                    <div style={styles.l1}>
                      <span style={styles.title}>{p.title || '(no title)'}</span>
                      {p.kind && <span style={styles.pill}>{p.kind}</span>}
                    </div>
                    <div style={styles.muted}>{p.dateTaken ? `Taken ${p.dateTaken.slice(0, 10)}` : 'No date taken'}</div>
                    <div style={styles.actions}>
                      <button style={styles.secondaryBtn} onClick={() => window.flickrAPI.openExternal(p.flickrUrl)}>Open on Flickr ↗</button>
                      {p.status === 'open'
                        ? <button style={styles.secondaryBtn} onClick={() => void mark(p, 'fine')}>This one is fine</button>
                        : <button style={styles.secondaryBtn} onClick={() => void mark(p, 'open')}>Undo</button>}
                    </div>
                  </div>
                </div>
              ))}
            {rows.length < total && <button style={styles.moreBtn} onClick={() => void loadRows(rows.length)}>Show more ({(total - rows.length).toLocaleString()} left)</button>}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  top: { display: 'flex', alignItems: 'center', padding: '6px 24px' },
  muted: { fontSize: 13, color: 'var(--ff-text-secondary)' },
  empty: { padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', maxWidth: 520, margin: '0 auto' },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--ff-navy)' },
  body: { flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: '4px 24px 12px' },
  rail: { width: 230, flexShrink: 0, alignSelf: 'flex-start', background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 6 },
  railItem: { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 9px', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: 'var(--ff-text)' },
  railSel: { background: '#e6f1fb', color: '#185fa5' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  statusChip: { border: '1px solid var(--ff-border)', borderRadius: 14, padding: '3px 11px', fontSize: 13, background: '#fff', color: 'var(--ff-text)', cursor: 'pointer' },
  statusChipOn: { background: 'var(--ff-navy)', borderColor: 'var(--ff-navy)', color: '#fff' },
  search: { border: '1px solid var(--ff-border)', borderRadius: 6, padding: '5px 10px', fontSize: 13, minWidth: 180, background: '#fff', color: 'var(--ff-text)' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 },
  card: { display: 'flex', gap: 12, background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 10, marginBottom: 8 },
  thumb: { width: 76, height: 76, borderRadius: 6, objectFit: 'cover', background: '#eee', flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0 },
  l1: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--ff-text)', overflowWrap: 'anywhere' },
  pill: { fontSize: 11, borderRadius: 10, padding: '1px 8px', background: '#fef3c7', color: '#92400e' },
  actions: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  primaryBtn: { background: 'var(--ff-pink-action)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  secondaryBtn: { background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '4px 11px', fontSize: 13, color: '#555', cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: 12, cursor: 'pointer' },
  moreBtn: { width: '100%', padding: 8, background: 'none', border: '1px dashed #ccc', borderRadius: 8, color: 'var(--ff-text-secondary)', fontSize: 13, cursor: 'pointer', marginBottom: 12 }
}
