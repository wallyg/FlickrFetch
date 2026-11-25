import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import { ruleById, logicOf } from '../../shared/cleanupRules'
import SelectBar from './SelectBar'
import { askFineReason } from '../ui/fineReason'
import { ALBUM_CONDITIONS } from '../../shared/healthChecks'
import type { AlbumCondition, AlbumItem, AlbumKind, AlbumListPage, AlbumSort, AlbumSummary, MisfitReason } from '../../shared/types'
import { dash, SectionSwitch, RingParts, pctLabel, COLORS } from './DashboardParts'
import type { RingPart } from './DashboardParts'
import { MissingRow, JudgedBy, actionStyles } from './AlbumFitRows'
import RuleRail, { RailHead, RailRow, ListHead, SortBox } from './RuleRail'
import { quietBtn, primaryBtn, filterInput, doThisBtn } from '../ui/kit'
import { asButton } from '../ui/a11y'
import BatchEditButton from './BatchEditButton'
import BackToTop from '../ui/BackToTop'
import { useFindShortcut } from '../hooks/useFindShortcut'
import { DEBOUNCE, useDebouncedValue } from '../ui/useDebounce'

// The Albums report in Health Check: photos that are in no album, and albums that look wrong (empty, one photo, no description,
// same title, in no collection), worked out from the local album list. Nothing here changes Flickr.

interface Props {
  refreshKey: number       // changes when the library is rescanned or a check is switched
  onFullRescan: () => void // the albums are read as part of a Rebuild
  toolbarLeft?: HTMLElement | null   // where the Summary | Lists switch goes (the Health Check toolbar)
  stateOf: (id: string) => CleanupRuleState   // Off / Warning / Issue for each check
}

const PAGE = 100
// The checks in the two groups of the summary and the rail
const ALBUM_GROUP_ALBUMS: AlbumCondition[] = ['empty', 'noCollection', 'oneItem', 'noDesc', 'dupTitle']
const ALBUM_GROUP_PHOTOS: AlbumCondition[] = ['noAlbum', 'misfit', 'missing']
const REASONS: [MisfitReason, string][] = [['date', 'Date'], ['place', 'Distance'], ['tag', 'Tag'], ['wrong', "Another place's album"], ['double', 'Two places']]
const INFO = (c: AlbumCondition): { name: string; blurb: string } => {
  const r = ruleById(`albums:${c}`)
  return { name: r?.name ?? c, blurb: r?.blurb ?? '' }
}

export default function AlbumsPanel({ refreshKey, onFullRescan, toolbarLeft, stateOf }: Props): React.JSX.Element {
  const [summary, setSummary] = useState<AlbumSummary | null>(null)
  const [section, setSection] = useState<'overview' | 'lists'>('overview')
  const [condition, setCondition] = useState<AlbumCondition>('noAlbum')
  const [status, setStatus] = useState<'open' | 'fine'>('open')
  const [sort, setSort] = useState<AlbumSort>('newest')
  const [reason, setReason] = useState<MisfitReason | ''>('')   // May not fit: show only one kind of reason
  const [reasons, setReasons] = useState<AlbumListPage['reasons']>(undefined)
  const [hot, setHot] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const typed = useDebouncedValue(search, search ? DEBOUNCE.typing : 0)   // typing waits a moment so every key does not search; clearing the box is at once
  const [rows, setRows] = useState<AlbumItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())   // photos ticked for the batch editor (photo rows only)
  useEffect(() => { setSelected(new Set()) }, [condition, status, search, sort, reason])
  useEffect(() => { setReason('') }, [condition, status])
  const photoIdOf = (item: AlbumItem): string => item.id.split('|')[0]
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)
  const requestRef = useRef(0)
  const filterRef = useRef<HTMLInputElement | null>(null)
  useFindShortcut(!!toolbarLeft && section === 'lists', filterRef)

  const loadSummary = useCallback(async () => { setSummary(await window.flickrAPI.getAlbumSummary()) }, [])
  useEffect(() => { void loadSummary() }, [loadSummary, refreshKey])

  // If the chosen check gets switched off, move to one that is still on
  useEffect(() => {
    if (stateOf(`albums:${condition}`) !== 'off') return
    const next = ALBUM_CONDITIONS.find(c => stateOf(`albums:${c}`) !== 'off')
    if (next) setCondition(next)
  }, [condition, stateOf])

  const loadRows = useCallback(async (offset: number): Promise<void> => {
    const req = ++requestRef.current
    if (offset === 0) setLoading(true)
    const page = await window.flickrAPI.listAlbumItems({ condition, status, search: typed, sort, reason: condition === 'misfit' && reason ? reason : undefined, offset, limit: PAGE })
    if (req !== requestRef.current) return
    setRows(prev => (offset === 0 ? page.rows : [...prev, ...page.rows]))
    setTotal(page.total)
    if (page.reasons) setReasons(page.reasons)
    setLoading(false)
  }, [condition, status, typed, sort, reason])

  useEffect(() => {
    if (!summary?.hasData || section !== 'lists') return
    void loadRows(0)
  }, [loadRows, refreshKey, section, summary?.hasData])

  // What an album is organised by decides how its photos are judged; the choice is kept on this computer
  const changeKind = async (albumId: string, kind: AlbumKind | 'auto'): Promise<void> => {
    await window.flickrAPI.setAlbumKind({ albumId, kind })
    await Promise.all([loadRows(0), loadSummary()])
  }

  const mark = async (item: AlbumItem, next: 'open' | 'fine'): Promise<void> => {
    await window.flickrAPI.setAlbumStatus({ id: item.id, condition, status: next })
    if (next === 'fine') askFineReason({ checkId: `albums:${condition}`, key: item.id, label: item.title || '(no title)' })
    setRows(prev => prev.filter(r => r.id !== item.id))
    setSelected(prev => { if (!prev.has(item.id)) return prev; const next = new Set(prev); next.delete(item.id); return next })   // a row that left the list is no longer ticked
    setTotal(t => Math.max(0, t - 1))
    await loadSummary()
  }

  if (summary && !summary.hasData) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyTitle}>Your albums have not been read yet</div>
        <div style={styles.muted}>A Rebuild reads every album once, along with your photos. It takes a few minutes.</div>
        <button style={primaryBtn} onClick={onFullRescan}>Rebuild</button>
      </div>
    )
  }

  const row = summary?.rows.find(r => r.condition === condition)
  const switcher = <SectionSwitch section={section} onChange={setSection} />
  const open = (c: AlbumCondition): void => { setCondition(c); setStatus('open'); setSearch(''); setSection('lists') }
  const countOf = (c: AlbumCondition): number => summary?.rows.find(r => r.condition === c)?.open ?? 0
  // The summary and the rail count photos for the two fit checks (a photo flagged twice counts once); the list has one row per album or per photo in an album
  const countShown = (c: AlbumCondition): number => { const r = summary?.rows.find(x => x.condition === c); return (c === 'misfit' || c === 'missing') && r?.photos !== undefined ? r.photos : r?.open ?? 0 }
  const unitOf = (c: AlbumCondition): string => (c === 'noAlbum' || c === 'misfit' || c === 'missing' ? 'photos' : 'albums')
  const stateDot = (c: AlbumCondition): string => (stateOf(`albums:${c}`) === 'on' ? COLORS.open : COLORS.warn)

  return (
    <div style={styles.wrap}>
      {toolbarLeft ? createPortal(switcher, toolbarLeft) : <div style={dash.switchRow}>{switcher}</div>}

      {section === 'overview' ? (
        <div style={dash.wrap}>
          {!summary ? <div style={dash.card}><div style={dash.muted}>Counting…</div></div> : (
            <>
              {[
                { title: 'Your albums', whole: `${summary.albums.toLocaleString()} albums`, g: summary.groups.albums, checks: ALBUM_GROUP_ALBUMS, unit: 'albums' },
                { title: 'Photos and their albums', whole: `${summary.photos.toLocaleString()} photos`, g: summary.groups.photos, checks: ALBUM_GROUP_PHOTOS, unit: 'photos' }
              ].map((grp, gi) => {
                const fineCount = Math.max(0, grp.g.total - grp.g.issue - grp.g.warning)
                const share = (n: number): number => (grp.g.total > 0 ? n / grp.g.total : 0)
                const parts: RingPart[] = [
                  { fraction: share(fineCount), color: COLORS.fixed, n: fineCount, short: 'fine', title: `${fineCount.toLocaleString()} ${grp.unit} are fine` },
                  { fraction: share(grp.g.warning), color: COLORS.warn, n: grp.g.warning, short: 'warning', title: `${grp.g.warning.toLocaleString()} ${grp.unit} have a Warning` },
                  { fraction: share(grp.g.issue), color: COLORS.open, n: grp.g.issue, short: 'issue', title: `${grp.g.issue.toLocaleString()} ${grp.unit} have an Issue` }
                ]
                const live = grp.checks.filter(c => stateOf(`albums:${c}`) !== 'off').sort((x, y) => (stateOf(`albums:${x}`) === 'on' ? 0 : 1) - (stateOf(`albums:${y}`) === 'on' ? 0 : 1))
                const valueOf = (c: AlbumCondition): string => {
                  const r = summary.rows.find(x => x.condition === c)
                  if ((c === 'misfit' || c === 'missing') && r?.photos !== undefined) return `${r.photos.toLocaleString()} photos, in ${(r.albums ?? 0).toLocaleString()} album${r.albums === 1 ? '' : 's'}`
                  return `${countOf(c).toLocaleString()} ${unitOf(c) === 'photos' ? (countOf(c) === 1 ? 'photo' : 'photos') : (countOf(c) === 1 ? 'album' : 'albums')}`
                }
                return (
                  <div key={grp.title} style={{ ...dash.card, marginTop: gi === 0 ? 0 : 14 }}>
                    <h3 style={dash.cardTitle}>{grp.title} <span style={dash.hint}>{grp.whole}</span></h3>
                    <div style={dash.ringWrap}>
                      <RingParts label={pctLabel(1 - share(grp.g.issue))} parts={parts} active={gi === 0 ? hot : null} onActive={i => setHot(gi === 0 ? i : null)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.legendRow}>
                          <span><i style={{ ...styles.swatch, background: COLORS.open }} /><b>{grp.g.issue.toLocaleString()}</b> Issue</span>
                          <span><i style={{ ...styles.swatch, background: COLORS.warn }} /><b>{grp.g.warning.toLocaleString()}</b> Warning</span>
                          <span><i style={{ ...styles.swatch, background: COLORS.fixed }} /><b>{fineCount.toLocaleString()}</b> Fine</span>
                        </div>
                        {live.length === 0 ? <div style={dash.muted}>Every check in this group is switched off (Tune checks).</div> : live.map(c => (
                          <div key={c} style={styles.checkRow} {...asButton(() => open(c))} title="Open this list">
                            <span style={{ ...styles.dot, background: stateDot(c) }} />
                            <span style={{ flex: 1, minWidth: 0 }}>{INFO(c).name}</span>
                            <span style={dash.muted}>{valueOf(c)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
              {([['Biggest issues to address', summary.issues], ['Biggest warnings to heed', summary.warnings]] as const).map(([title, list]) => list.length === 0 ? null : (
                <div key={title} style={{ ...dash.card, marginTop: 14 }}>
                  <h3 style={dash.cardTitle}>{title} <span style={dash.hint}>(albums with the most photos flagged; click for the list)</span></h3>
                  {list.map(b => (
                    <div key={`${b.condition}|${b.albumId}`} style={dash.item} {...asButton(() => { setCondition(b.condition); setStatus('open'); setSearch(b.title); setSection('lists') })}>
                      <span>{b.title || '(no title)'}<span style={dash.pill}>{b.condition === 'missing' ? 'may be missing' : 'may not fit'}</span></span>
                      <span style={dash.muted}>{b.photos.toLocaleString()} photo{b.photos === 1 ? '' : 's'}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div style={styles.body}>
          <div style={styles.railCol}>
            <div style={styles.rail}>
              <RuleRail
                rules={ALBUM_CONDITIONS.map(c => ({ id: `albums:${c}`, name: INFO(c).name, count: countShown(c) }))}
                groups={[{ title: 'Your albums', ids: ALBUM_GROUP_ALBUMS.map(c => `albums:${c}`) }, { title: 'Photos and their albums', ids: ALBUM_GROUP_PHOTOS.map(c => `albums:${c}`) }]}
                stateOf={stateOf}
                selectedId={`albums:${condition}`}
                onSelect={id => { setCondition(id.slice(7) as AlbumCondition); setStatus('open') }}
                offText="Every album check is switched off (Tune checks)."
              />
            </div>
            <div style={styles.rail}>
              <RailHead first>Show</RailHead>
              {(['open', 'fine'] as const).map(st => <RailRow key={st} selected={status === st} label={st === 'open' ? 'Open' : 'Marked fine'} count={row ? row[st] : 0} onSelect={() => setStatus(st)} />)}
              <RailHead>Filter</RailHead>
              <input ref={filterRef} style={filterInput} placeholder="Filter by title…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Filter by title" />
              <RailHead>This list</RailHead>
              <button style={{ ...quietBtn, width: '100%' }} title="Save every row of this list as a spreadsheet" onClick={async () => { setSaved(await window.flickrAPI.saveAlbumCsv({ condition, status, search, sort })) }}>Export this list</button>
              {condition === 'noAlbum' && (
                <div style={{ marginTop: 6 }}>
                  <BatchEditButton key={`${status}|${search}`} style={{ ...quietBtn, width: '100%' }}
                    getIds={() => window.flickrAPI.getAlbumPhotoIds({ condition, status, search, sort })} />
                </div>
              )}
              {saved && <div style={{ ...styles.muted, padding: '6px 9px 2px' }}>Saved to {saved.split('/').pop()} <button style={styles.linkBtn} onClick={() => window.flickrAPI.showInFinder(saved)}>Show in Finder</button></div>}
            </div>
          </div>

          <div style={styles.main}>
            <ListHead sort={<span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{condition === 'misfit' && reasons && (
              <label style={styles.reasonBox}>Reason
                <select style={styles.reasonSelect} value={reason} aria-label="Show only one kind of reason" onChange={e => setReason(e.target.value as MisfitReason | '')}>
                  <option value="">All ({reasons.all.toLocaleString()})</option>
                  {REASONS.map(([k, label]) => <option key={k} value={k}>{label} ({reasons[k].toLocaleString()})</option>)}
                </select>
              </label>
            )}<SortBox<AlbumSort> value={sort} onChange={setSort} options={[
              { value: 'newest', label: condition === 'noAlbum' ? 'Newest taken first' : 'Newest first' },
              { value: 'oldest', label: condition === 'noAlbum' ? 'Oldest taken first' : 'Oldest first' },
              { value: 'title', label: 'Title A to Z' }, { value: 'titleDesc', label: 'Title Z to A' }]} /></span>} tip={logicOf(`albums:${condition}`)}>{INFO(condition).blurb}</ListHead>

            <SelectBar count={selected.size} shown={rows.filter(r => r.isPhoto).length} ids={() => [...new Set([...selected].map(k => k.split('|')[0]))]} onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(rows.filter(r => r.isPhoto).map(r => r.id)))} />

            <div style={styles.list}>
              {loading && rows.length === 0 ? <div style={styles.muted}>Checking your albums…</div>
                : rows.length === 0 ? <div style={styles.muted}>{status === 'open' ? 'Nothing left to fix here.' : 'Nothing here.'}</div>
                : rows.map(item => condition === 'missing' ? (
                  <MissingRow key={item.id} item={item} onFine={next => void mark(item, next)} onKind={kind => void changeKind(item.albumId, kind)} />
                ) : (
                  <div key={item.id} style={{ ...styles.card, ...(item.status === 'fine' ? { opacity: 0.6 } : {}) }}>
                    {item.isPhoto && <input type="checkbox" style={styles.tick} checked={selected.has(item.id)} aria-label="Select this photo"
                      onChange={e => setSelected(prev => { const next = new Set(prev); if (e.target.checked) next.add(item.id); else next.delete(item.id); return next })} />}
                    {item.thumbUrl ? <img src={item.thumbUrl} alt="" loading="lazy" style={styles.thumb} /> : <div style={styles.thumb} />}
                    <div style={styles.cardBody}>
                      <div style={styles.title}>{item.title || '(no title)'}</div>
                      <div style={styles.muted}>{item.detail}</div>
                      {item.why && <div style={{ ...styles.muted, marginTop: 3 }}>{item.why}</div>}
                      <JudgedBy item={item} onChange={kind => void changeKind(item.albumId, kind)} />
                      <div style={styles.actions}>
                        <button style={actionStyles.link} onClick={() => window.flickrAPI.openExternal(item.flickrUrl)}>{condition === 'misfit' ? 'Open photo ↗' : 'Open on Flickr ↗'}</button>
                        {item.isPhoto && item.status === 'open' && <BatchEditButton inline key={`b${item.id}`} style={actionStyles.fix} label="Open in Flickr's organizer" getIds={async () => [photoIdOf(item)]} />}
                        {condition === 'misfit' && <button style={actionStyles.link} title="Opens the album's page on Flickr. Click Edit there to change the album or take the photo out." onClick={() => window.flickrAPI.openExternal(item.albumUrl)}>Open album ↗</button>}
                        {item.status === 'open'
                          ? <button style={actionStyles.quiet} onClick={() => void mark(item, 'fine')}>This one is fine</button>
                          : <button style={actionStyles.quiet} onClick={() => void mark(item, 'open')}>Undo</button>}
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
  muted: { fontSize: 13, color: 'var(--ff-text-secondary)' },
  empty: { padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', maxWidth: 520, margin: '0 auto' },
  emptyTitle: { fontSize: 14, fontWeight: 700, color: 'var(--ff-navy)' },
  body: { flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: '4px 24px 12px' },
  railCol: { width: 230, flexShrink: 0, alignSelf: 'flex-start', maxHeight: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 },
  rail: { flexShrink: 0, background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: 6 },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 },
  card: { display: 'flex', gap: 12, background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: 10, marginBottom: 8 },
  tick: { alignSelf: 'flex-start', marginTop: 4, flexShrink: 0, cursor: 'pointer' },
  quietAction: { ...quietBtn },
  thumb: { width: 76, height: 76, borderRadius: 6, objectFit: 'cover', background: 'var(--ff-border)', flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--ff-text)', overflowWrap: 'anywhere' },
  actions: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  mainActionBtn: { ...doThisBtn },
  linkBtn: { background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: 12, cursor: 'pointer' },
  moreBtn: { ...quietBtn, width: '100%', marginBottom: 12 },
  legendRow: { display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--ff-text-secondary)', marginBottom: 6 },
  swatch: { display: 'inline-block', width: 10, height: 10, borderRadius: 4, marginRight: 6, verticalAlign: -1 },
  dot: { width: 8, height: 8, borderRadius: '50%', flex: 'none' },
  checkRow: { display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', borderTop: '1px solid var(--ff-warm)', fontSize: 14, cursor: 'pointer', color: 'var(--ff-text)' },
  reasonBox: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ff-text-secondary)' },
  reasonSelect: { border: '1px solid var(--ff-border)', borderRadius: 6, padding: '5px 8px', fontSize: 13, background: 'var(--ff-surface)', color: 'var(--ff-text)' }
}
