import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import type { HealthCondition, HealthPhoto, HealthSummary } from '../../shared/types'
import HealthOverview from './HealthOverview'
import { dash } from './DashboardParts'
import { quietBtn, primaryBtn, selectedOn, railSel as railSelBase, railItem as railItemBase } from '../ui/kit'
import BackToTop from '../ui/BackToTop'

// The Health view of the Tags tab: photos with missing or weak metadata, by problem, as a to-do list
// to fix on Flickr. Nothing here changes Flickr or your files.

interface HealthPanelProps {
  refreshKey: number       // changes when the library is rescanned
  onFullRescan: () => void // for libraries scanned before this report existed
  toolbarLeft?: HTMLElement | null   // where the Overview | Lists switch goes (the Cleanup toolbar)
  stateOf: (id: string) => CleanupRuleState   // Off / Warning / Issue for each check
  openRequest?: { condition: HealthCondition; year?: string; nonce: number } | null   // the front page asking for one list
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

export default function HealthPanel({ refreshKey, onFullRescan, toolbarLeft, stateOf, openRequest }: HealthPanelProps): React.JSX.Element {
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [section, setSection] = useState<'overview' | 'lists'>('overview')
  const [condition, setCondition] = useState<HealthCondition>('title')
  const [year, setYear] = useState('')   // set by clicking a cluster on the overview
  const [status, setStatus] = useState<'open' | 'fine'>('open')
  const [rows, setRows] = useState<HealthPhoto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)
  const requestRef = useRef(0)

  const loadSummary = useCallback(async () => { setSummary(await window.flickrAPI.getHealthSummary()) }, [])
  useEffect(() => { void loadSummary() }, [loadSummary, refreshKey])

  // If the chosen check gets switched off, move to one that is still on
  useEffect(() => {
    if (stateOf(`photos:${condition}`) !== 'off') return
    const next = CONDITIONS.find(c => stateOf(`photos:${c}`) !== 'off')
    if (next) setCondition(next)
  }, [condition, stateOf])

  // The front page asks for one list
  useEffect(() => {
    if (!openRequest) return
    setCondition(openRequest.condition); setStatus('open'); setYear(openRequest.year ?? ''); setSection('lists')
  }, [openRequest?.nonce])

  const loadRows = useCallback(async (offset: number): Promise<void> => {
    const req = ++requestRef.current
    if (offset === 0) setLoading(true)
    const page = await window.flickrAPI.listHealthPhotos({ condition, status, search: '', year: year || undefined, offset, limit: PAGE })
    if (req !== requestRef.current) return
    setRows(prev => (offset === 0 ? page.rows : [...prev, ...page.rows]))
    setTotal(page.total)
    setLoading(false)
  }, [condition, status, year])

  useEffect(() => {
    if (summary && !summary.hasData) return
    void loadRows(0)
  }, [loadRows, refreshKey, summary?.hasData])

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
          Your tag list was built before the metadata report existed. A Rebuild reads every photo once more, this time also noting titles, descriptions, locations and thumbnails. It takes a few minutes and changes nothing on Flickr.
        </div>
        <button style={styles.primaryBtn} onClick={onFullRescan}>Rebuild</button>
      </div>
    )
  }

  const row = summary?.rows.find(r => r.condition === condition)

  const sectionSwitch = (
    <div style={dash.seg}>
      {(['overview', 'lists'] as const).map(v => (
        <button key={v} style={{ ...dash.segBtn, ...(section === v ? dash.segOn : {}) }} onClick={() => setSection(v)}>{v === 'overview' ? 'Summary' : 'Lists'}</button>
      ))}
    </div>
  )

  return (
    <div style={styles.wrap}>
      {toolbarLeft ? createPortal(sectionSwitch, toolbarLeft) : <div style={dash.switchRow}>{sectionSwitch}</div>}

      {section === 'overview' ? (
        <HealthOverview refreshKey={refreshKey} onOpenList={(c, y) => { setCondition(c); setStatus('open'); setYear(y ?? ''); setSection('lists') }} />
      ) : (
      <div style={styles.body}>
        <div style={styles.railCol}>
        <div style={styles.rail}>
          {([['on', 'Issues'], ['optional', 'Warnings']] as const).map(([st, heading]) => {
            const list = CONDITIONS.filter(c => stateOf(`photos:${c}`) === st)
            if (list.length === 0) return null
            return (
              <React.Fragment key={st}>
                <div style={{ ...styles.railHead, paddingTop: st === 'on' ? 4 : 10 }}>{heading}</div>
                {list.map(c => {
                  const r = summary?.rows.find(x => x.condition === c)
                  return (
                    <div key={c} style={{ ...styles.railItem, ...(c === condition ? styles.railSel : {}) }} onClick={() => { setCondition(c); setStatus('open'); setYear('') }}>
                      <span>{INFO[c].name}</span><b style={{ fontWeight: 600 }}>{(r?.open ?? 0).toLocaleString()}</b>
                    </div>
                  )
                })}
              </React.Fragment>
            )
          })}
          {CONDITIONS.every(c => stateOf(`photos:${c}`) === 'off') && <div style={{ ...styles.muted, padding: 8 }}>Every photo check is switched off (Tune checks).</div>}
        </div>

        <div style={styles.rail}>
          <div style={{ ...styles.railHead, paddingTop: 4 }}>Show</div>
          {(['open', 'fine'] as const).map(s => (
            <div key={s} style={{ ...styles.railItem, ...(status === s ? styles.railSel : {}) }} onClick={() => setStatus(s)}>
              <span>{s === 'open' ? 'Open' : 'Marked fine'}</span><b style={{ fontWeight: 600 }}>{(year && s === status ? total : row ? row[s] : 0).toLocaleString()}</b>
            </div>
          ))}
          <div style={styles.railHead}>This list</div>
          <button style={{ ...styles.secondaryBtn, width: '100%' }} title="Save every photo in this list as a spreadsheet" onClick={async () => { setSaved(await window.flickrAPI.saveHealthCsv({ condition, status, search: '', year: year || undefined })) }}>Export this list</button>
          {saved && <div style={{ ...styles.muted, padding: '6px 9px 2px' }}>Saved to {saved.split('/').pop()} <button style={styles.linkBtn} onClick={() => window.flickrAPI.showInFinder(saved)}>Show in Finder</button></div>}
        </div>
        </div>

        <div style={styles.main}>
          {year && <div style={styles.statusRow}><button style={styles.statusChip} title="Show every year again" onClick={() => setYear('')}>Taken in {year} ✕</button></div>}
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
          <BackToTop />
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
  railCol: { width: 230, flexShrink: 0, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 12 },
  railHead: { fontSize: 11, color: 'var(--ff-text-muted)', padding: '10px 9px 4px' },
  rail: { background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 6 },
  railItem: { ...railItemBase },
  railSel: { ...railSelBase },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  statusChip: { border: '1px solid var(--ff-border)', borderRadius: 14, padding: '3px 11px', fontSize: 13, background: '#fff', color: 'var(--ff-text)', cursor: 'pointer' },
  statusChipOn: { ...selectedOn },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 },
  card: { display: 'flex', gap: 12, background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 10, marginBottom: 8 },
  thumb: { width: 76, height: 76, borderRadius: 6, objectFit: 'cover', background: '#eee', flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0 },
  l1: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--ff-text)', overflowWrap: 'anywhere' },
  pill: { fontSize: 11, borderRadius: 10, padding: '1px 8px', background: '#fef3c7', color: '#92400e' },
  actions: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  primaryBtn: { background: 'var(--ff-pink-action)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  secondaryBtn: { ...quietBtn },
  linkBtn: { background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: 12, cursor: 'pointer' },
  moreBtn: { width: '100%', padding: 8, background: 'none', border: '1px dashed #ccc', borderRadius: 8, color: 'var(--ff-text-secondary)', fontSize: 13, cursor: 'pointer', marginBottom: 12 }
}
