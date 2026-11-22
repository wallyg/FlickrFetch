import React, { useCallback, useEffect, useRef, useState } from 'react'
import AuditOverview from './AuditOverview'
import { dash } from './DashboardParts'
import { GLUE_BOUNDARY_SOURCE } from '../../shared/tags'
import type { AuditCategory, AuditFinding, AuditPlanRow, AuditStatus, AuditSummary, TagMode } from '../../shared/types'

// The Audit view of the Tags tab: likely tag problems by type, each with an editable fix.
// Nothing here changes Flickr or your files. "Add to plan" builds a checklist to work through;
// "This one is fine" hides a finding for good (and can be undone).

interface AuditPanelProps {
  refreshKey: number   // changes when the tag list is rescanned
  onViewPhotos: (tags: string[], mode: TagMode) => void
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
const MAIN_CATEGORIES: AuditCategory[] = ['glued', 'typo', 'notwin', 'noaccent', 'junk', 'runon']
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

export default function AuditPanel({ refreshKey, onViewPhotos }: AuditPanelProps): React.JSX.Element {
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [section, setSection] = useState<'overview' | 'lists'>('overview')
  const [category, setCategory] = useState<AuditCategory>('glued')
  const [status, setStatus] = useState<AuditStatus>('open')
  const [search, setSearch] = useState('')
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
        const first = s.rows.find(r => MAIN_CATEGORIES.includes(r.category) && r.open > 0)
        if (first) setCategory(first.category)
      }
    })
  }, [loadSummary, refreshKey])

  const loadRows = useCallback(async (offset: number): Promise<void> => {
    const req = ++requestRef.current
    if (offset === 0) setLoading(true)
    const page = await window.flickrAPI.listAuditFindings({ category, status, search, offset, limit: PAGE })
    if (req !== requestRef.current) return
    setRows(prev => (offset === 0 ? page.rows : [...prev, ...page.rows]))
    setTotal(page.total)
    setLoading(false)
  }, [category, status, search])

  useEffect(() => {
    const t = setTimeout(() => void loadRows(0), search ? 200 : 0)
    return () => clearTimeout(t)
  }, [loadRows, search, refreshKey])

  const refreshPlan = useCallback(async () => { setPlan(await window.flickrAPI.getAuditPlan()) }, [])

  const keyOf = (f: AuditFinding): string => `${f.category}|${f.tag}`
  const change = async (f: AuditFinding, next: 'open' | 'plan' | 'fine'): Promise<void> => {
    await window.flickrAPI.setAuditStatus({ tag: f.tag, category: f.category, status: next, replacement: drafts[keyOf(f)] ?? f.replacement })
    setRows(prev => prev.filter(r => keyOf(r) !== keyOf(f)))   // it moves to another status list
    setTotal(t => Math.max(0, t - 1))
    await loadSummary()
    if (plan) await refreshPlan()
  }

  const row = summary?.rows.find(r => r.category === category)
  const planCount = summary ? summary.rows.reduce((n, r) => n + r.plan, 0) : 0
  const info = CATEGORY_INFO[category]

  if (summary && !summary.hasIndex) {
    return <div style={styles.empty}>Build your tag list first (on the Browse side), then come back to audit it.</div>
  }

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
        <span style={styles.muted}>Checked against your tag list{summary?.computedAt ? '' : '…'}. Nothing here changes Flickr or your files.</span>
        <div style={{ flex: 1 }} />
        <button style={styles.planBtn} onClick={() => { if (plan) setPlan(null); else void refreshPlan() }}>Plan ({planCount})</button>
      </div>

      {plan && (
        <div style={styles.planBox}>
          <div style={styles.planTitle}>Your plan</div>
          {plan.length === 0 ? <div style={styles.muted}>Nothing added yet.</div> : (
            <>
              <div style={{ ...styles.muted, marginBottom: 6 }}>
                Do these on Flickr (your Flickr page, Tags section, or the Organizr). After a Refresh, fixed ones tick themselves off.
              </div>
              {plan.map(p => (
                <div key={`${p.category}|${p.tag}`} style={styles.planLine}>
                  <span style={{ color: p.status === 'fixed' ? 'var(--ff-success)' : 'var(--ff-text-muted)' }}>{p.status === 'fixed' ? '✓' : '○'}</span>
                  <span style={p.status === 'fixed' ? { textDecoration: 'line-through', color: 'var(--ff-text-muted)' } : undefined}>{p.line}</span>
                  {p.flickrUrl && <button style={styles.viewBtn} onClick={() => window.flickrAPI.openExternal(p.flickrUrl)}>Open on Flickr ↗</button>}
                  <button style={{ ...styles.viewBtn, marginLeft: 0 }} onClick={() => onViewPhotos([p.display], 'any')}>View photos</button>
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
      )}

      {section === 'overview' ? (
        <AuditOverview refreshKey={refreshKey} onOpenList={c => { setCategory(c); setStatus('open'); setSection('lists') }} />
      ) : (
      <div style={styles.body}>
        <div style={styles.rail}>
          {MAIN_CATEGORIES.map(c => {
            const r = summary?.rows.find(x => x.category === c)
            return (
              <div key={c} style={{ ...styles.railItem, ...(c === category ? styles.railSel : {}), opacity: r && r.open === 0 && c !== category ? 0.55 : 1 }} onClick={() => { setCategory(c); setStatus('open') }}>
                <span>{CATEGORY_INFO[c].name}</span><b style={{ fontWeight: 600 }}>{(r?.open ?? 0).toLocaleString()}</b>
              </div>
            )
          })}
          <div style={styles.railHead}>Cosmetic</div>
          <div style={{ ...styles.railItem, ...(category === 'spelling' ? styles.railSel : {}) }} onClick={() => { setCategory('spelling'); setStatus('open') }}>
            <span>{CATEGORY_INFO.spelling.name}</span><b style={{ fontWeight: 600 }}>{(summary?.rows.find(x => x.category === 'spelling')?.open ?? 0).toLocaleString()}</b>
          </div>
        </div>

        <div style={styles.main}>
          <div style={styles.statusRow}>
            {STATUS_LABELS.map(s => (
              <button key={s.key} style={{ ...styles.statusChip, ...(status === s.key ? styles.statusChipOn : {}) }} onClick={() => setStatus(s.key)}>
                {s.label} <span style={{ opacity: 0.7 }}>{(row ? row[s.key] : 0).toLocaleString()}</span>
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button style={styles.secondaryBtn} title="Save every row of this list (with the current filter) as a spreadsheet" onClick={async () => { setListSaved(await window.flickrAPI.saveAuditListCsv({ category, status, search })) }}>Export this list</button>
            {listSaved && <><span style={styles.muted}>Saved to {listSaved.split('/').pop()}</span><button style={{ ...styles.viewBtn, marginLeft: 0 }} onClick={() => window.flickrAPI.showInFinder(listSaved)}>Show in Finder</button></>}
            <input style={styles.search} placeholder="Filter this list…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ ...styles.muted, margin: '2px 0 10px' }}>{info.blurb}</div>

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
  rail: { width: 230, flexShrink: 0, alignSelf: 'flex-start', background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 10, padding: 6 },
  railItem: { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 9px', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: 'var(--ff-text)' },
  railSel: { background: '#e6f1fb', color: '#185fa5' },
  railHead: { fontSize: 11, color: 'var(--ff-text-muted)', padding: '10px 9px 2px' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  statusChip: { border: '1px solid var(--ff-border)', borderRadius: 14, padding: '3px 11px', fontSize: 13, background: '#fff', color: 'var(--ff-text)', cursor: 'pointer' },
  statusChipOn: { background: 'var(--ff-navy)', borderColor: 'var(--ff-navy)', color: '#fff' },
  search: { border: '1px solid var(--ff-border)', borderRadius: 6, padding: '5px 10px', fontSize: 13, minWidth: 200, background: '#fff', color: 'var(--ff-text)' },
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
  primaryBtn: { background: 'var(--ff-navy)', color: '#fff', border: '1px solid var(--ff-navy)', borderRadius: 6, padding: '4px 11px', fontSize: 13, cursor: 'pointer' },
  secondaryBtn: { background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '4px 11px', fontSize: 13, color: '#555', cursor: 'pointer' },
  planBtn: { background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '5px 12px', fontSize: 13, color: '#555', cursor: 'pointer' },
  viewBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: 12, cursor: 'pointer' },
  moreBtn: { width: '100%', padding: 8, background: 'none', border: '1px dashed #ccc', borderRadius: 8, color: 'var(--ff-text-secondary)', fontSize: 13, cursor: 'pointer', marginBottom: 12 },
  planBox: { margin: '0 24px 8px', background: '#fff', border: '1px solid #ccc', borderRadius: 10, padding: '10px 14px', maxHeight: 240, overflowY: 'auto' },
  planTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--ff-text)' },
  planLine: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, padding: '2px 0', color: 'var(--ff-text)' }
}
