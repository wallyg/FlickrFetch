import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AuditOverview from './AuditOverview'
import { dash, SectionSwitch } from './DashboardParts'
import RuleRail, { RailHead, RailRow } from './RuleRail'
import { forgetOverview } from './LibraryOverview'
import { GLUE_BOUNDARY_SOURCE } from '../../shared/tags'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import type { AuditCategory, AuditFinding, AuditPlanRow, AuditSort, AuditStatus, AuditSummary, TagMode } from '../../shared/types'
import { quietBtn, primaryBtn, selectedOn, filterInput } from '../ui/kit'
import BackToTop from '../ui/BackToTop'

// The Audit view of the Tags tab: likely tag problems by type, each with an editable fix.
// Nothing here changes Flickr or your files. "Add to plan" builds a checklist to work through;
// "This one is fine" hides a finding for good (and can be undone).

interface AuditPanelProps {
  refreshKey: number   // changes when the tag list is rescanned
  onViewPhotos: (tags: string[], mode: TagMode) => void
  toolbarLeft?: HTMLElement | null    // where the Overview | Lists switch goes (the Cleanup toolbar)
  toolbarRight?: HTMLElement | null   // where the Plan button goes
  stateOf: (id: string) => CleanupRuleState   // Off / Warning / Issue for each check
  openRequest?: { category: AuditCategory; nonce: number } | null   // the front page asking for one list
}

const PAGE = 100

const CATEGORY_INFO: Record<AuditCategory, { name: string; blurb: string; label: string }> = {
  glued: {
    name: 'Names stuck together',
    blurb: 'A lowercase letter runs straight into a capital, with no gap. Usually two or three tags pasted together after a comma or quote went missing. The red mark shows where they probably join.',
    label: 'Becomes these tags'
  },
  typo: {
    name: 'Possible typos',
    blurb: 'A rare tag one letter away from a popular one, where the odd word is not a real word and appears almost nowhere else in your tags.',
    label: 'Rename to'
  },
  notwin: {
    name: 'Accented tags with no plain twin',
    blurb: 'You usually keep both spellings (Québec and Quebec). These accented tags have no plain version, and Flickr search cannot find accented tags, so searches miss these photos.',
    label: 'Keep both'
  },
  noaccent: {
    name: 'Plain tags that may need accents',
    blurb: 'A tag with no accents whose words your other tags usually accent. Judged only from your own spellings, so check each one. The accented version does not exist as a tag yet.',
    label: 'Keep both'
  },
  junk: {
    name: 'Odd characters',
    blurb: 'Stray quote marks, web code, garbled characters, or punctuation at the start or end of a spelling.',
    label: 'Retype as'
  },
  runon: {
    name: 'Run-ons',
    blurb: 'A tag typed with no spaces or punctuation that spells out two or more of your popular tags.',
    label: 'Split into'
  },
  spelling: {
    name: 'Typed more than one way',
    blurb: 'Flickr treats these as one tag, but each photo keeps the spelling it was typed with. Pick the one to use everywhere.',
    label: 'Use this spelling'
  }
}
const ALL_CATEGORIES: AuditCategory[] = ['glued', 'typo', 'junk', 'runon', 'notwin', 'noaccent', 'spelling']
const STATUS_LABELS: { key: AuditStatus; label: string }[] = [
  { key: 'open', label: 'Open' }, { key: 'plan', label: 'In plan' }, { key: 'fine', label: 'Marked fine' }, { key: 'fixed', label: 'Fixed' }
]

const GLUE_AT = new RegExp(GLUE_BOUNDARY_SOURCE)

function GluedName({ text }: { text: string }): React.JSX.Element {
  const parts = text.split(' ').map((word, i) => {
    const bits = word.split(GLUE_AT)
    return (
      <React.Fragment key={i}>
        {i > 0 ? ' ' : ''}
        {bits.map((b, j) => <React.Fragment key={j}>{j > 0 && <span style={styles.glue} />}{b}</React.Fragment>)}
      </React.Fragment>
    )
  })
  return <>{parts}</>
}

export default function AuditPanel({ refreshKey, onViewPhotos, toolbarLeft, toolbarRight, stateOf, openRequest }: AuditPanelProps): React.JSX.Element {
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [section, setSection] = useState<'overview' | 'lists'>('overview')
  const [category, setCategory] = useState<AuditCategory>('glued')
  const [status, setStatus] = useState<AuditStatus>('open')
  const [sort, setSort] = useState<AuditSort>('suggested')
  const [search, setSearch] = useState('')
  const [blurbOpen, setBlurbOpen] = useState(false)   // the explanation of a problem type folds to its first sentence
  const [rows, setRows] = useState<AuditFinding[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [plan, setPlan] = useState<AuditPlanRow[] | null>(null)   // null = plan box closed
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)          // last plan spreadsheet
  const [listSaved, setListSaved] = useState<string | null>(null)  // last list spreadsheet
  const requestRef = useRef(0)
  const pickedStart = useRef(false)
  const planRef = useRef<HTMLSpanElement>(null)

  const loadSummary = useCallback(async () => {
    const s = await window.flickrAPI.getAuditSummary()
    setSummary(s)
    return s
  }, [])

  // First look: open on the first type that has something to review
  useEffect(() => {
    setLoading(true)
    void loadSummary().then(s => {
      if (!pickedStart.current) {
        pickedStart.current = true
        const first = s.rows.find(r => ALL_CATEGORIES.includes(r.category) && stateOf(`tags:${r.category}`) === 'on' && r.open > 0)
        if (first) setCategory(first.category)
      }
    })
  }, [loadSummary, refreshKey])

  // If the chosen check gets switched off, move to one that is still on
  useEffect(() => {
    if (stateOf(`tags:${category}`) !== 'off') return
    const next = ALL_CATEGORIES.find(c => stateOf(`tags:${c}`) !== 'off')
    if (next) setCategory(next)
  }, [category, stateOf])

  // The front page asks for one list
  useEffect(() => {
    if (!openRequest) return
    setCategory(openRequest.category); setStatus('open'); setSection('lists')
  }, [openRequest?.nonce])

  const loadRows = useCallback(async (offset: number): Promise<void> => {
    const req = ++requestRef.current
    if (offset === 0) setLoading(true)
    const page = await window.flickrAPI.listAuditFindings({ category, status, search, sort, offset, limit: PAGE })
    if (req !== requestRef.current) return
    setRows(prev => (offset === 0 ? page.rows : [...prev, ...page.rows]))
    setTotal(page.total)
    setLoading(false)
  }, [category, status, sort, search])

  useEffect(() => { setBlurbOpen(false) }, [category])

  useEffect(() => {
    const t = setTimeout(() => void loadRows(0), search ? 200 : 0)   // typing waits a moment so every key does not search
    return () => clearTimeout(t)
  }, [loadRows, refreshKey])

  // When the report is hidden (its toolbar slot is handed away), the panel closes
  useEffect(() => { if (!toolbarRight) setPlan(null) }, [toolbarRight])

  // The plan panel hangs from its button; a click elsewhere or Esc closes it
  useEffect(() => {
    if (!plan) return
    const away = (e: MouseEvent): void => { if (planRef.current && !planRef.current.contains(e.target as Node)) setPlan(null) }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setPlan(null) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [plan !== null])

  const refreshPlan = useCallback(async () => { setPlan(await window.flickrAPI.getAuditPlan()) }, [])

  // The ✕ on a line in the Plan box: back to Open, without hunting for the list it came from
  const removeFromPlan = async (p: AuditPlanRow): Promise<void> => {
    await window.flickrAPI.setAuditStatus({ tag: p.tag, category: p.category, status: 'open' })
    forgetOverview()
    await loadSummary()
    await refreshPlan()
    void loadRows(0)
  }

  const keyOf = (f: AuditFinding): string => `${f.category}|${f.tag}`
  const change = async (f: AuditFinding, next: 'open' | 'plan' | 'fine'): Promise<void> => {
    await window.flickrAPI.setAuditStatus({ tag: f.tag, category: f.category, status: next, replacement: drafts[keyOf(f)] ?? f.replacement })
    forgetOverview()
    setRows(prev => prev.filter(r => keyOf(r) !== keyOf(f)))   // it moves to another status list
    setTotal(t => Math.max(0, t - 1))
    await loadSummary()
    if (plan) await refreshPlan()
  }

  const row = summary?.rows.find(r => r.category === category)
  const planCount = summary ? summary.rows.reduce((n, r) => n + r.plan, 0) : 0
  const info = CATEGORY_INFO[category]

  const sectionSwitch = <SectionSwitch section={section} onChange={setSection} />
  const planPanel = plan && (
    <div style={styles.planPop} role="dialog" aria-label="Your plan">
          <div style={styles.planTitle}>Your plan{planCount > 0 ? ` · ${planCount} to do on Flickr` : ''}</div>
          {plan.length === 0 ? <div style={styles.muted}>Nothing added yet.</div> : (
            <>
              <div style={{ ...styles.muted, marginBottom: 6 }}>
                Do these on Flickr (your Flickr page, Tags section, or the Organizr). After an Update, fixed ones tick themselves off.
              </div>
              {plan.map(p => (
                <div key={`${p.category}|${p.tag}`} style={styles.planLine}>
                  <span style={{ color: p.status === 'fixed' ? 'var(--ff-success)' : 'var(--ff-text-muted)' }}>{p.status === 'fixed' ? '✓' : '○'}</span>
                  <span style={p.status === 'fixed' ? { textDecoration: 'line-through', color: 'var(--ff-text-muted)' } : undefined}>{p.line}</span>
                  <span style={styles.planType} title="The kind of problem this came from">{CATEGORY_INFO[p.category].name}</span>
                  {p.flickrUrl && <button style={styles.viewBtn} onClick={() => { setPlan(null); window.flickrAPI.openExternal(p.flickrUrl) }}>Open on Flickr ↗</button>}
                  <button style={{ ...styles.viewBtn, marginLeft: 0 }} onClick={() => { setPlan(null); onViewPhotos([p.display], 'any') }}>View photos</button>
                  {p.status === 'plan'
                    ? <button style={styles.planRemove} title="Remove from plan" aria-label="Remove from plan" onClick={() => void removeFromPlan(p)}>✕</button>
                    : <span style={{ width: 18 }} />}
                </div>
              ))}
              <div style={styles.actions}>
                <button style={styles.secondaryBtn} onClick={async () => { await window.flickrAPI.copyAuditPlan(); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? '✓ Copied' : 'Copy as checklist'}</button>
                <button style={styles.secondaryBtn} onClick={async () => { setSaved(await window.flickrAPI.saveAuditPlanCsv()) }}>Save as spreadsheet</button>
                {saved && <><span style={styles.muted}>Saved to {saved.split('/').pop()}</span><button style={styles.viewBtn} onClick={() => window.flickrAPI.showInFinder(saved)}>Show in Finder</button></>}
              </div>
            </>
          )}
    </div>
  )
  const planButton = (
    <span ref={planRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        style={{ ...styles.planBtn, display: 'inline-flex', alignItems: 'center', gap: 7, ...(plan ? selectedOn : {}) }}
        aria-expanded={!!plan}
        onClick={() => { if (plan) setPlan(null); else void refreshPlan() }}
      >
        Plan{planCount > 0 && <b style={styles.planBadge}>{planCount}</b>}
      </button>
      {planPanel}
    </span>
  )

  if (summary && !summary.hasIndex) {
    return <div style={styles.empty}>Build your library list first (Health Check tab, or Tags tab), then come back to check it.</div>
  }

  return (
    <div style={styles.wrap}>
      {toolbarLeft ? createPortal(sectionSwitch, toolbarLeft) : <div style={dash.switchRow}>{sectionSwitch}</div>}
      {toolbarRight ? createPortal(planButton, toolbarRight) : <div style={styles.top}><div style={{ flex: 1 }} />{planButton}</div>}

      {section === 'overview' ? (
        <AuditOverview refreshKey={refreshKey} onOpenList={c => { setCategory(c); setStatus('open'); setSection('lists') }} />
      ) : (
      <div style={styles.body}>
        <div style={styles.railCol}>
        <div style={styles.rail}>
          <RuleRail
            rules={ALL_CATEGORIES.map(c => ({ id: `tags:${c}`, name: CATEGORY_INFO[c].name, count: summary?.rows.find(x => x.category === c)?.open ?? 0 }))}
            stateOf={stateOf}
            selectedId={`tags:${category}`}
            onSelect={id => { setCategory(id.slice(5) as AuditCategory); setStatus('open') }}
            offText="Every tag check is switched off (Tune checks)."
          />
        </div>

        <div style={styles.rail}>
          <RailHead first>Show</RailHead>
          {STATUS_LABELS.map(st => <RailRow key={st.key} selected={status === st.key} label={st.label} count={row ? row[st.key] : 0} onSelect={() => setStatus(st.key)} />)}
          <RailHead>Filter</RailHead>
          <input style={filterInput} placeholder="Filter this list…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Filter this list" />
          <RailHead>Sort</RailHead>
          <select style={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value as AuditSort)} title="How this list is ordered" aria-label="Sort this list">
            <option value="suggested">Suggested order</option>
            <option value="most">Most photos</option>
            <option value="fewest">Fewest photos</option>
            <option value="alpha">A to Z</option>
          </select>
          <RailHead>This list</RailHead>
          <button style={{ ...styles.secondaryBtn, width: '100%' }} title="Save every row of this list as a spreadsheet" onClick={async () => { setListSaved(await window.flickrAPI.saveAuditListCsv({ category, status, search, sort })) }}>Export this list</button>
          {listSaved && <div style={{ ...styles.muted, padding: '6px 9px 2px' }}>Saved to {listSaved.split('/').pop()} <button style={{ ...styles.viewBtn, marginLeft: 0 }} onClick={() => window.flickrAPI.showInFinder(listSaved)}>Show in Finder</button></div>}
        </div>
        </div>

        <div style={styles.main}>
          <div style={{ ...styles.muted, margin: '2px 0 10px' }}>
            {blurbOpen ? info.blurb : `${info.blurb.split('. ')[0].replace(/\.$/, '')}.`}{' '}
            {info.blurb.includes('. ') && <button style={styles.viewBtn} onClick={() => setBlurbOpen(o => !o)}>{blurbOpen ? 'Less' : 'More'}</button>}
          </div>

          <div style={styles.list}>
            {loading && rows.length === 0 ? <div style={styles.muted}>Checking your tags…</div>
              : rows.length === 0 ? <div style={styles.muted}>{status === 'open' ? 'Nothing left to review here.' : 'Nothing here.'}</div>
              : rows.map(f => {
                const key = keyOf(f)
                return (
                  <div key={key} style={{ ...styles.card, ...(f.status === 'fine' ? { opacity: 0.6 } : {}) }}>
                    <div style={styles.l1}>
                      <span style={styles.tagName}>{category === 'glued' ? <GluedName text={f.display} /> : f.display}</span>
                      {f.status !== 'fixed' && <span style={{ ...styles.pill, ...(f.confidence === 'high' ? styles.pillHigh : f.confidence === 'low' ? styles.pillLow : styles.pillMed) }}>{f.confidence === 'high' ? 'High' : f.confidence === 'low' ? 'Low' : 'Medium'}</span>}
                      {f.status === 'fixed' && <span style={{ ...styles.pill, ...styles.pillHigh }}>Fixed</span>}
                      <span style={styles.count}>{f.count.toLocaleString()} photo{f.count === 1 ? '' : 's'}</span>
                    </div>
                    <div style={styles.l2}>
                      <label style={styles.muted}>{info.label}</label>
                      <input
                        style={styles.input}
                        value={drafts[key] ?? f.replacement}
                        disabled={f.status === 'fixed'}
                        onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                        aria-label="Edit the replacement tags"
                      />
                    </div>
                    <div style={styles.ev}>{f.evidence}{f.spellings.length > 1 && category === 'spelling' ? ` · ${f.spellings.join(' · ')}` : ''}</div>
                    <div style={styles.actions}>
                      {f.status === 'open' && (
                        <>
                          <button style={styles.primaryBtn} onClick={() => void change(f, 'plan')}>Add to plan</button>
                          <button style={styles.secondaryBtn} onClick={() => void change(f, 'fine')}>This one is fine</button>
                        </>
                      )}
                      {(f.status === 'plan' || f.status === 'fine') && (
                        <button style={styles.secondaryBtn} onClick={() => void change(f, 'open')}>{f.status === 'plan' ? 'Remove from plan' : 'Undo'}</button>
                      )}
                      <button style={styles.secondaryBtn} onClick={() => onViewPhotos([f.display], 'any')}>View photos</button>
                      {f.flickrUrl && <button style={styles.secondaryBtn} title="Open this tag's page on your Flickr account, to fix it there" onClick={() => window.flickrAPI.openExternal(f.flickrUrl)}>Open on Flickr ↗</button>}
                    </div>
                  </div>
                )
              })}
            {rows.length < total && <button style={styles.moreBtn} onClick={() => void loadRows(rows.length)}>Show more ({(total - rows.length).toLocaleString()} left)</button>}
            <BackToTop />
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  top: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 24px' },
  muted: { fontSize: 13, color: 'var(--ff-text-secondary)' },
  empty: { padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--ff-text-secondary)' },
  body: { flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: '4px 24px 12px' },
  railCol: { width: 230, flexShrink: 0, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 12 },
  rail: { background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 6 },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  statusChip: { border: '1px solid var(--ff-border)', borderRadius: 14, padding: '3px 11px', fontSize: 13, background: '#fff', color: 'var(--ff-text)', cursor: 'pointer' },
  statusChipOn: { ...selectedOn },
  sortSelect: { width: '100%', margin: '0 0 2px', border: '1px solid var(--ff-border)', borderRadius: 6, padding: '5px 8px', fontSize: 13, background: '#fff', color: 'var(--ff-text)' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 },
  card: { background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 },
  l1: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tagName: { fontSize: 14, fontWeight: 600, color: 'var(--ff-text)', overflowWrap: 'anywhere' },
  glue: { display: 'inline-block', width: 2, height: 15, background: 'var(--ff-error)', verticalAlign: -3, margin: '0 1px' },
  pill: { fontSize: 11, borderRadius: 10, padding: '1px 8px' },
  pillHigh: { background: 'var(--ff-success-bg)', color: 'var(--ff-success)' },
  pillMed: { background: '#fef3c7', color: '#92400e' },
  pillLow: { background: '#eee', color: '#667085' },
  count: { marginLeft: 'auto', fontSize: 12, color: 'var(--ff-text-secondary)', whiteSpace: 'nowrap' },
  l2: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 220, border: '1px solid var(--ff-border)', borderRadius: 6, padding: '5px 9px', fontSize: 13, background: '#fff', color: 'var(--ff-text)' },
  ev: { fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 6, overflowWrap: 'anywhere' },
  actions: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  primaryBtn: { ...primaryBtn },
  secondaryBtn: { ...quietBtn },
  planBtn: { ...quietBtn, padding: '5px 12px' },
  viewBtn: { whiteSpace: 'nowrap', marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: 12, cursor: 'pointer' },
  moreBtn: { width: '100%', padding: 8, background: 'none', border: '1px dashed #ccc', borderRadius: 8, color: 'var(--ff-text-secondary)', fontSize: 13, cursor: 'pointer', marginBottom: 12 },
  planPop: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 600, maxWidth: 'calc(100vw - 48px)', maxHeight: '62vh', overflowY: 'auto', background: '#fff', border: '1px solid var(--ff-line-strong)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: '14px 16px', zIndex: 20 },
  planBadge: { background: 'var(--ff-pink-action)', color: '#fff', borderRadius: 9, padding: '0 7px', fontSize: 12, fontWeight: 700 },
  planTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--ff-text)' },
  planType: { fontSize: 11, borderRadius: 10, padding: '1px 8px', background: 'var(--ff-tint)', color: 'var(--ff-pink-action)', whiteSpace: 'nowrap', marginLeft: 'auto' },
  planRemove: { background: 'none', border: 'none', color: 'var(--ff-text-muted)', fontSize: 13, cursor: 'pointer', padding: '0 2px', width: 18 },
  planLine: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, padding: '2px 0', color: 'var(--ff-text)' }
}
