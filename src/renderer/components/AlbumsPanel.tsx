import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import { ruleById } from '../../shared/cleanupRules'
import { ALBUM_CONDITIONS } from '../../shared/healthChecks'
import type { AlbumCondition, AlbumItem, AlbumSort, AlbumSummary } from '../../shared/types'
import { dash, SectionSwitch } from './DashboardParts'
import RuleRail, { RailHead, RailRow, ListHead, SortBox } from './RuleRail'
import { quietBtn, primaryBtn, filterInput } from '../ui/kit'
import { asButton } from '../ui/a11y'
import BatchEditButton from './BatchEditButton'
import BackToTop from '../ui/BackToTop'
import { useFindShortcut } from '../hooks/useFindShortcut'

// The Albums report in Health Check: photos that are in no album, and albums that look wrong (empty, one photo, no description,
// same title, in no collection), worked out from the local album list. Nothing here changes Flickr.

interface Props {
  refreshKey: number       // changes when the library is rescanned or a check is switched
  onFullRescan: () => void // the albums are read as part of a Rebuild
  toolbarLeft?: HTMLElement | null   // where the Summary | Lists switch goes (the Health Check toolbar)
  stateOf: (id: string) => CleanupRuleState   // Off / Warning / Issue for each check
}

const PAGE = 100
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
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AlbumItem[]>([])
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
    const page = await window.flickrAPI.listAlbumItems({ condition, status, search, sort, offset, limit: PAGE })
    if (req !== requestRef.current) return
    setRows(prev => (offset === 0 ? page.rows : [...prev, ...page.rows]))
    setTotal(page.total)
    setLoading(false)
  }, [condition, status, search, sort])

  useEffect(() => {
    if (!summary?.hasData || section !== 'lists') return
    const t = setTimeout(() => void loadRows(0), search ? 200 : 0)   // typing waits a moment so every key does not search
    return () => clearTimeout(t)
  }, [loadRows, refreshKey, section, summary?.hasData])

  const mark = async (item: AlbumItem, next: 'open' | 'fine'): Promise<void> => {
    await window.flickrAPI.setAlbumStatus({ id: item.id, condition, status: next })
    setRows(prev => prev.filter(r => r.id !== item.id))
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

  return (
    <div style={styles.wrap}>
      {toolbarLeft ? createPortal(switcher, toolbarLeft) : <div style={dash.switchRow}>{switcher}</div>}

      {section === 'overview' ? (
        <div style={dash.wrap}>
          <div style={dash.card}>
            <h3 style={dash.cardTitle}>Your albums <span style={dash.hint}>(from the album list FlickrFetch keeps on this computer)</span></h3>
            {!summary ? <div style={dash.muted}>Counting…</div> : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--ff-text)' }}>{summary.albums.toLocaleString()}</span>
                  <span style={dash.big}>albums for {summary.photos.toLocaleString()} photos and videos</span>
                </div>
                <div style={{ ...dash.muted, marginTop: 6 }}>
                  {countOf('noAlbum') === 0 ? 'Every photo is in at least one album.' : `${countOf('noAlbum').toLocaleString()} photo${countOf('noAlbum') === 1 ? ' is' : 's are'} in no album.`}
                </div>
              </>
            )}
          </div>
          {summary && (
            <div style={dash.grid}>
              {ALBUM_CONDITIONS.filter(c => stateOf(`albums:${c}`) !== 'off').map(c => (
                <div key={c} style={{ ...dash.card, cursor: 'pointer' }} {...asButton(() => open(c))} title="Open this list">
                  <div style={dash.big}>{INFO(c).name}</div>
                  <span style={dash.bigNum}>{countOf(c).toLocaleString()}</span>
                  <div style={{ ...dash.muted, marginTop: 4 }}>{stateOf(`albums:${c}`) === 'on' ? 'Issue' : 'Warning'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.body}>
          <div style={styles.railCol}>
            <div style={styles.rail}>
              <RuleRail
                rules={ALBUM_CONDITIONS.map(c => ({ id: `albums:${c}`, name: INFO(c).name, count: countOf(c) }))}
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
            <ListHead sort={<SortBox<AlbumSort> value={sort} onChange={setSort} options={[
              { value: 'newest', label: condition === 'noAlbum' ? 'Newest taken first' : 'Newest first' },
              { value: 'oldest', label: condition === 'noAlbum' ? 'Oldest taken first' : 'Oldest first' },
              { value: 'title', label: 'Title A to Z' }, { value: 'titleDesc', label: 'Title Z to A' }]} />}>{INFO(condition).blurb}</ListHead>

            <div style={styles.list}>
              {loading && rows.length === 0 ? <div style={styles.muted}>Checking your albums…</div>
                : rows.length === 0 ? <div style={styles.muted}>{status === 'open' ? 'Nothing left to fix here.' : 'Nothing here.'}</div>
                : rows.map(item => (
                  <div key={item.id} style={{ ...styles.card, ...(item.status === 'fine' ? { opacity: 0.6 } : {}) }}>
                    {item.thumbUrl ? <img src={item.thumbUrl} alt="" loading="lazy" style={styles.thumb} /> : <div style={styles.thumb} />}
                    <div style={styles.cardBody}>
                      <div style={styles.title}>{item.title || '(no title)'}</div>
                      <div style={styles.muted}>{item.detail}</div>
                      <div style={styles.actions}>
                        <button style={styles.mainActionBtn} onClick={() => window.flickrAPI.openExternal(item.flickrUrl)}>Open on Flickr ↗</button>
                        {item.status === 'open'
                          ? <button style={quietBtn} onClick={() => void mark(item, 'fine')}>This one is fine</button>
                          : <button style={quietBtn} onClick={() => void mark(item, 'open')}>Undo</button>}
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
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--ff-navy)' },
  body: { flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: '4px 24px 12px' },
  railCol: { width: 230, flexShrink: 0, alignSelf: 'flex-start', maxHeight: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 },
  rail: { flexShrink: 0, background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 6 },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 },
  card: { display: 'flex', gap: 12, background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 10, marginBottom: 8 },
  thumb: { width: 76, height: 76, borderRadius: 6, objectFit: 'cover', background: '#eee', flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--ff-text)', overflowWrap: 'anywhere' },
  actions: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  mainActionBtn: { ...quietBtn, borderColor: 'var(--ff-blue)', color: 'var(--ff-blue)', fontWeight: 600 },
  linkBtn: { background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: 12, cursor: 'pointer' },
  moreBtn: { ...quietBtn, width: '100%', marginBottom: 12 }
}
