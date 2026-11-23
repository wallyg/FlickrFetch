import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import type { HealthCondition, HealthPhoto, HealthSort, HealthSummary } from '../../shared/types'
import HealthOverview from './HealthOverview'
import { dash, SectionSwitch } from './DashboardParts'
import RuleRail, { RailHead, RailRow, ListHead, SortBox } from './RuleRail'
import { forgetOverview } from './LibraryOverview'
import { quietBtn, primaryBtn, selectedOn, filterInput } from '../ui/kit'
import BatchEditButton from './BatchEditButton'
import BackToTop from '../ui/BackToTop'
import { ruleById } from '../../shared/cleanupRules'
import { useFindShortcut } from '../hooks/useFindShortcut'
import { HEALTH_CONDITIONS } from '../../shared/healthChecks'

// The Health view of the Tags tab: photos with missing or weak metadata, by problem, as a to-do list
// to fix on Flickr. Nothing here changes Flickr or your files.

interface HealthPanelProps {
  refreshKey: number       // changes when the library is rescanned
  onFullRescan: () => void // for libraries scanned before this report existed
  toolbarLeft?: HTMLElement | null   // where the Overview | Lists switch goes (the Cleanup toolbar)
  stateOf: (id: string) => CleanupRuleState   // Off / Warning / Issue for each check
  openRequest?: { condition: HealthCondition; year?: string; nonce: number } | null   // the front page asking for one list
  needsRebuild?: boolean   // the library list was built before 3.6, so some checks cannot count yet
}

const PAGE = 100

const INFO = (c: HealthCondition): { name: string; blurb: string } => {
  const r = ruleById(`photos:${c}`)
  return { name: r?.name ?? c, blurb: r?.blurb ?? '' }
}
const CONDITIONS = HEALTH_CONDITIONS

export default function HealthPanel({ refreshKey, onFullRescan, toolbarLeft, stateOf, openRequest, needsRebuild }: HealthPanelProps): React.JSX.Element {
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [section, setSection] = useState<'overview' | 'lists'>('overview')
  const [condition, setCondition] = useState<HealthCondition>('title')
  const [year, setYear] = useState('')   // set by clicking a cluster on the overview
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'open' | 'fine'>('open')
  const [sort, setSort] = useState<HealthSort>('newest')
  const [rows, setRows] = useState<HealthPhoto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)
  const requestRef = useRef(0)
  const filterRef = useRef<HTMLInputElement | null>(null)
  useFindShortcut(!!toolbarLeft && section === 'lists', filterRef)   // Cmd+F while this list is showing goes to the Filter box

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
    const page = await window.flickrAPI.listHealthPhotos({ condition, status, search, sort, year: year || undefined, offset, limit: PAGE })
    if (req !== requestRef.current) return
    setRows(prev => (offset === 0 ? page.rows : [...prev, ...page.rows]))
    setTotal(page.total)
    setLoading(false)
  }, [condition, status, year, search, sort])

  useEffect(() => {
    if (summary && !summary.hasData) return
    const t = setTimeout(() => void loadRows(0), search ? 200 : 0)   // typing waits a moment so every key does not search
    return () => clearTimeout(t)
  }, [loadRows, refreshKey, summary?.hasData])

  const mark = async (p: HealthPhoto, next: 'open' | 'fine'): Promise<void> => {
    await window.flickrAPI.setHealthStatus({ photoId: p.photoId, condition, status: next })
    forgetOverview()
    setRows(prev => prev.filter(r => r.photoId !== p.photoId))
    setTotal(t => Math.max(0, t - 1))
    await loadSummary()
  }

  if (summary && !summary.hasData) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyTitle}>One more scan needed</div>
        <div style={styles.muted}>
          Your tag list was built before the metadata report existed. A Rebuild reads every photo once more, this time also noting titles, descriptions, locations and thumbnails. It takes a few minutes.
        </div>
        <button style={styles.primaryBtn} onClick={onFullRescan}>Rebuild</button>
      </div>
    )
  }

  const row = summary?.rows.find(r => r.condition === condition)

  const sectionSwitch = <SectionSwitch section={section} onChange={setSection} />

  return (
    <div style={styles.wrap}>
      {toolbarLeft ? createPortal(sectionSwitch, toolbarLeft) : <div style={dash.switchRow}>{sectionSwitch}</div>}

      {section === 'overview' ? (
        <HealthOverview refreshKey={refreshKey} onOpenList={(c, y) => { setCondition(c); setStatus('open'); setYear(y ?? ''); setSection('lists') }} />
      ) : (
      <div style={styles.body}>
        <div style={styles.railCol}>
        <div style={styles.rail}>
          <RuleRail
            rules={CONDITIONS.map(c => ({ id: `photos:${c}`, name: INFO(c).name, count: summary?.rows.find(x => x.condition === c)?.open ?? 0, pending: !!needsRebuild && !!ruleById(`photos:${c}`)?.needsRebuild }))}
            stateOf={stateOf}
            selectedId={`photos:${condition}`}
            onSelect={id => { setCondition(id.slice(7) as HealthCondition); setStatus('open'); setYear('') }}
            offText="Every photo check is switched off (Tune checks)."
          />
        </div>

        <div style={styles.rail}>
          <RailHead first>Show</RailHead>
          {(['open', 'fine'] as const).map(st => <RailRow key={st} selected={status === st} label={st === 'open' ? 'Open' : 'Marked fine'} count={year && st === status ? total : row ? row[st] : 0} onSelect={() => setStatus(st)} />)}
          <RailHead>Filter</RailHead>
          <input ref={filterRef} style={filterInput} placeholder="Filter by title…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Filter by title" />
          <RailHead>This list</RailHead>
          <button style={{ ...styles.secondaryBtn, width: '100%' }} title="Save every photo in this list as a spreadsheet" onClick={async () => { setSaved(await window.flickrAPI.saveHealthCsv({ condition, status, search, sort, year: year || undefined })) }}>Export this list</button>
          <div style={{ marginTop: 6 }}>
            <BatchEditButton key={`${condition}|${status}|${search}|${year}`} style={{ ...styles.secondaryBtn, width: '100%' }}
              getIds={() => window.flickrAPI.getHealthPhotoIds({ condition, status, search, sort, year: year || undefined })} />
          </div>
          {saved && <div style={{ ...styles.muted, padding: '6px 9px 2px' }}>Saved to {saved.split('/').pop()} <button style={styles.linkBtn} onClick={() => window.flickrAPI.showInFinder(saved)}>Show in Finder</button></div>}
        </div>
        </div>

        <div style={styles.main}>
          {year && <div style={styles.statusRow}><button style={styles.statusChip} title="Show every year again" onClick={() => setYear('')}>Taken in {year} ✕</button></div>}
          <ListHead sort={<SortBox<HealthSort> value={sort} onChange={setSort} options={[
            { value: 'newest', label: 'Newest taken first' }, { value: 'oldest', label: 'Oldest taken first' },
            { value: 'title', label: 'Title A to Z' }, { value: 'titleDesc', label: 'Title Z to A' }]} />}>{INFO(condition).blurb}</ListHead>

          <div style={styles.list}>
            {loading && rows.length === 0 ? <div style={styles.muted}>Checking your photos…</div>
              : rows.length === 0 ? <div style={styles.muted}>{needsRebuild && ruleById(`photos:${condition}`)?.needsRebuild ? 'This check needs a Rebuild before it can find anything. Press Rebuild in the notice at the top.' : status === 'open' ? 'Nothing left to fix here.' : 'Nothing here.'}</div>
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
                      <button style={styles.mainActionBtn} onClick={() => window.flickrAPI.openExternal(p.flickrUrl)}>Open on Flickr ↗</button>
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
  railCol: { width: 230, flexShrink: 0, alignSelf: 'flex-start', maxHeight: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 },   // long lists of checks scroll inside this column
  rail: { flexShrink: 0, background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 6 },
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
  primaryBtn: { ...primaryBtn },
  secondaryBtn: { ...quietBtn },
  // Fixing a photo happens on Flickr, so this is the card's main action: the blue outline used for "See them" on the notice
  mainActionBtn: { ...quietBtn, borderColor: 'var(--ff-blue)', color: 'var(--ff-blue)', fontWeight: 600 },
  linkBtn: { background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: 12, cursor: 'pointer' },
  moreBtn: { width: '100%', padding: 8, background: 'none', border: '1px dashed #ccc', borderRadius: 8, color: 'var(--ff-text-secondary)', fontSize: 13, cursor: 'pointer', marginBottom: 12 }
}
