import React, { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import { createPortal } from 'react-dom'
import AuditOverview from './AuditOverview'
import { dash, SectionSwitch } from './DashboardParts'
import RuleRail, { RailHead, RailRow, ListHead, SortBox } from './RuleRail'
import { forgetOverview } from './LibraryOverview'
import { useFindShortcut } from '../hooks/useFindShortcut'
import { DEBOUNCE, useDebouncedValue } from '../ui/useDebounce'
import { GLUE_BOUNDARY_SOURCE } from '../../shared/tags'
import { logicOf, ruleById } from '../../shared/cleanupRules'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import type { AlbumFitPhoto, AuditCategory, AuditClue, AuditFinding, AuditPlanRow, AuditSort, AuditStatus, AuditSummary, TagMode } from '../../shared/types'
import { quietBtn, primaryBtn, selectedOn, filterInput, fieldBox, selectBox, linkBtn } from '../ui/kit'
import BatchEditButton from './BatchEditButton'
import PhotoStrip from './PhotoStrip'
import HoverNote from '../ui/HoverNote'
import { askFineReason } from '../ui/fineReason'
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

// The words on the left of each row's box (the name and the description of each check come from the rules, shared with Tune checks)
const ROW_LABEL: Record<AuditCategory, string> = {
  glued: 'Becomes these tags',
  typo: 'Rename to',
  notwin: 'Keep both',
  noaccent: 'Keep both',
  junk: 'Retype as',
  runon: 'Split into',
  spelling: 'Use this spelling',
  usedonce: 'Replace with',
  generic: 'Replace with',
  numbers: 'Replace with',
  possessive: 'Use instead',
  plural: 'Use this tag',
  missing: '',
  filename: 'Replace with'
}
// Only this check says something on a second line (the spellings that were typed); on the others it only repeated what the row already shows.
// Odd characters shows its reason beside the name (and can be filtered by it), Singular and plural its other form beside the box, Photos missing a tag its clues behind Why?
const SHOWS_EVIDENCE: AuditCategory[] = ['spelling']
const CATEGORY_INFO: Record<AuditCategory, { name: string; blurb: string; label: string }> = Object.fromEntries(
  (Object.keys(ROW_LABEL) as AuditCategory[]).map(c => [c, { name: ruleById(`tags:${c}`)?.name ?? c, blurb: ruleById(`tags:${c}`)?.blurb ?? '', label: ROW_LABEL[c] }])
) as Record<AuditCategory, { name: string; blurb: string; label: string }>
// How sure a row is, in plain words. Neutral marks (green, amber and red already mean Fine, Warning and Issue). Shown only on the checks where it differs
// from row to row; on the others every row has the same level, so the mark would say nothing. The exact rule for each check is in its (i) note.
const CONF_VARIES: AuditCategory[] = ['glued', 'typo', 'runon', 'notwin', 'noaccent', 'spelling', 'plural', 'possessive', 'missing']
const CONF_LABEL: Record<string, string> = { high: 'Very likely', medium: 'Possible', low: 'Unlikely' }
const CONFIDENCE_HINT: Record<string, string> = {
  high: 'Very likely a real problem. See the (i) note for how this check decides.',
  medium: 'Possible: worth a look, it could be on purpose. See the (i) note for how this check decides.',
  low: 'Unlikely to be a problem: check before changing it. See the (i) note for how this check decides.'
}
// What each clue means, for the Why? note on a Photos missing a tag row
const CLUE_TEXT: Record<AuditClue['key'], (n: string, top?: string) => string> = {
  habit: (n, top) => `${n} carry a tag that nearly always comes with this one${top ? ` (most often ${top})` : ''}`,
  album: n => `${n} are in an album where nearly every photo has this tag`,
  titlePlace: n => `${n} start their title with a place where nearly every photo has this tag`,
  near: n => `${n} were taken right beside photos that all have it`,
  titleName: n => `${n} have a title that contains its name`
}
// The left column groups the checks by what they are about (Issues first inside each group)
const TAG_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Typos and joined-up words', ids: ['glued', 'runon', 'typo', 'junk', 'plural', 'possessive', 'spelling'].map(c => `tags:${c}`) },
  { title: 'Accents', ids: ['notwin', 'noaccent'].map(c => `tags:${c}`) },
  { title: 'Tags that say nothing', ids: ['generic', 'numbers', 'filename', 'usedonce'].map(c => `tags:${c}`) },
  { title: 'Gaps', ids: ['missing'].map(c => `tags:${c}`) }
]
const ALL_CATEGORIES: AuditCategory[] = ['glued', 'typo', 'junk', 'runon', 'notwin', 'noaccent', 'spelling', 'generic', 'numbers', 'filename', 'usedonce', 'plural', 'possessive', 'missing']
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

// A Photos missing a tag row: the tag, how sure, how many photos may need it, why (on hover), and the photos themselves on request
function MissingRow({ f, onChange }: { f: AuditFinding; onChange: (f: AuditFinding, next: 'open' | 'plan' | 'fine') => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState<AlbumFitPhoto[] | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!open || photos) return
    let alive = true
    void window.flickrAPI.getAuditPhotoIds(f.tag, 'missing').then(ids => window.flickrAPI.getPhotoCards(ids))
      .then(p => { if (alive) { setPhotos(p); setTicked(new Set(p.map(x => x.photoId))) } }).catch(() => { if (alive) setPhotos([]) })
    return () => { alive = false }
  }, [open, photos, f.tag])
  const toggle = (id: string, on: boolean): void => setTicked(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n })
  const why = ['# Why these photos', ...(f.clues ?? []).map(c => `- ${CLUE_TEXT[c.key](c.n.toLocaleString(), c.top)}`), 'A photo can have several of these. A tag is suggested only when at least two agree.'].join('\n')
  const picking = open && photos !== null
  return (
    <div style={{ ...styles.card, ...(f.status === 'fine' ? { opacity: 0.6 } : {}) }}>
      <div style={styles.l1}>
        <span style={styles.tagName}>{f.display}</span>
        {CONF_VARIES.includes('missing') && <span title={CONFIDENCE_HINT[f.confidence]} style={{ ...styles.pill, ...(f.confidence === 'high' ? styles.confVery : f.confidence === 'low' ? styles.pillLow : styles.confPossible) }}>{CONF_LABEL[f.confidence]}</span>}
        <span style={styles.count}>{f.count.toLocaleString()} photo{f.count === 1 ? '' : 's'} may need it</span>
      </div>
      <div style={styles.ev}><HoverNote text={why} block={false}>Why these photos?</HoverNote></div>
      {open && (!photos ? <div style={{ ...styles.muted, marginTop: 8 }}>Loading photos…</div> : <PhotoStrip photos={photos} ticked={ticked} onToggle={toggle} />)}
      <div style={styles.actions}>
        {f.status === 'open' && (
          <>
            <button style={styles.secondaryBtn} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Hide the photos' : `Show the ${f.count.toLocaleString()} photo${f.count === 1 ? '' : 's'}`}</button>
            {picking && ticked.size === 0
              ? <span style={styles.muted}>{photos && photos.length === 0 ? 'Couldn\'t load the photos.' : 'Tick a photo to add the tag in Flickr\'s organizer'}</span>
              : <BatchEditButton key={`${f.tag}|${picking ? ticked.size : 'all'}`} label={picking ? `Add "${f.display}" to ${ticked.size.toLocaleString()} in Flickr's organizer` : `Add "${f.display}" in Flickr's organizer`} style={styles.secondaryBtn}
                  getIds={() => (picking ? Promise.resolve([...ticked]) : window.flickrAPI.getAuditPhotoIds(f.tag, 'missing'))} />}
            <button style={styles.secondaryBtn} onClick={() => onChange(f, 'fine')}>This one is fine</button>
          </>
        )}
        {f.status === 'fine' && <button style={styles.secondaryBtn} onClick={() => onChange(f, 'open')}>Undo</button>}
        {f.flickrUrl && <button style={styles.secondaryBtn} title="Open this tag's page on your Flickr account" onClick={() => window.flickrAPI.openExternal(f.flickrUrl)}>Open on Flickr <Icon name="external" /></button>}
      </div>
    </div>
  )
}

export default function AuditPanel({ refreshKey, onViewPhotos, toolbarLeft, toolbarRight, stateOf, openRequest }: AuditPanelProps): React.JSX.Element {
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [section, setSection] = useState<'overview' | 'lists'>('overview')
  const [category, setCategory] = useState<AuditCategory>('glued')
  const [status, setStatus] = useState<AuditStatus>('open')
  const [sort, setSort] = useState<AuditSort>('suggested')
  const [search, setSearch] = useState('')
  const typed = useDebouncedValue(search, search ? DEBOUNCE.typing : 0)   // typing waits a moment so every key does not search; clearing the box is at once
  const [reason, setReason] = useState('')   // Odd characters: show only one kind of problem
  const [reasons, setReasons] = useState<Record<string, number> | undefined>(undefined)
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
  const filterRef = useRef<HTMLInputElement | null>(null)
  useFindShortcut(!!toolbarLeft && section === 'lists', filterRef)   // Cmd+F while this list is showing goes to the Filter box

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
    pickedStart.current = true   // a list that was asked for beats the first-look choice, even when this panel is only now opening
    setCategory(openRequest.category); setStatus('open'); setSection('lists')
  }, [openRequest?.nonce])

  const loadRows = useCallback(async (offset: number): Promise<void> => {
    const req = ++requestRef.current
    if (offset === 0) setLoading(true)
    const page = await window.flickrAPI.listAuditFindings({ category, status, search: typed, sort, reason: category === 'junk' && reason ? reason : undefined, offset, limit: PAGE })
    if (req !== requestRef.current) return
    setRows(prev => (offset === 0 ? page.rows : [...prev, ...page.rows]))
    setTotal(page.total)
    setReasons(page.reasons)
    setLoading(false)
  }, [category, status, sort, typed, reason])
  useEffect(() => { setReason('') }, [category, status])


  useEffect(() => {
    void loadRows(0)
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
    if (next === 'fine') askFineReason({ checkId: `tags:${f.category}`, key: `${f.category}|${f.tag}`, label: f.display })
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
                  <span style={{ color: p.status === 'fixed' ? 'var(--ff-success)' : 'var(--ff-text-muted)' }}>{p.status === 'fixed' ? <Icon name="check" /> : '○'}</span>
                  <span style={p.status === 'fixed' ? { textDecoration: 'line-through', color: 'var(--ff-text-muted)' } : undefined}>{p.line}</span>
                  <span style={styles.planType} title="The kind of problem this came from">{CATEGORY_INFO[p.category].name}</span>
                  {p.flickrUrl && <button style={styles.viewBtn} onClick={() => { setPlan(null); window.flickrAPI.openExternal(p.flickrUrl) }}>Open on Flickr <Icon name="external" /></button>}
                  <button style={{ ...styles.viewBtn, marginLeft: 0 }} onClick={() => { setPlan(null); onViewPhotos([p.display], 'any') }}>View photos</button>
                  {p.status === 'plan' && <BatchEditButton inline key={`${p.category}|${p.tag}`} style={{ ...styles.viewBtn, marginLeft: 0 }} getIds={() => window.flickrAPI.getAuditPhotoIds(p.tag, p.category)} />}
                  {p.status === 'plan'
                    ? <button style={styles.planRemove} title="Remove from plan" aria-label="Remove from plan" onClick={() => void removeFromPlan(p)}><Icon name="close" /></button>
                    : <span style={{ width: 18 }} />}
                </div>
              ))}
              <div style={styles.actions}>
                <button style={styles.secondaryBtn} onClick={async () => { await window.flickrAPI.copyAuditPlan(); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <><Icon name="check" /> Copied</> : 'Copy as checklist'}</button>
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
            groups={TAG_GROUPS}
          />
        </div>

        <div style={styles.rail}>
          <RailHead first>Show</RailHead>
          {STATUS_LABELS.map(st => <RailRow key={st.key} selected={status === st.key} label={st.label} count={row ? row[st.key] : 0} onSelect={() => setStatus(st.key)} />)}
          <RailHead>Filter</RailHead>
          <input ref={filterRef} style={filterInput} placeholder="Filter this list…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Filter this list" />
          <RailHead>This list</RailHead>
          <button style={{ ...styles.secondaryBtn, width: '100%' }} title="Save every row of this list as a spreadsheet" onClick={async () => { setListSaved(await window.flickrAPI.saveAuditListCsv({ category, status, search, sort, reason: category === 'junk' && reason ? reason : undefined })) }}>Export this list</button>
          {listSaved && <div style={{ ...styles.muted, padding: '6px 9px 2px' }}>Saved to {listSaved.split('/').pop()} <button style={{ ...styles.viewBtn, marginLeft: 0 }} onClick={() => window.flickrAPI.showInFinder(listSaved)}>Show in Finder</button></div>}
        </div>
        </div>

        <div style={styles.main}>
          <ListHead sort={<span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{category === 'junk' && reasons && (
            <label style={styles.reasonBox}>Reason
              <select style={styles.reasonSelect} value={reason} aria-label="Show only one kind of problem" onChange={e => setReason(e.target.value)}>
                <option value="">All ({Object.values(reasons).reduce((n, x) => n + x, 0).toLocaleString()})</option>
                {Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, n]) => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)} ({n.toLocaleString()})</option>)}
              </select>
            </label>
          )}<SortBox<AuditSort> value={sort} onChange={setSort} options={[
            { value: 'suggested', label: 'Suggested order' }, { value: 'most', label: 'Most photos' }, { value: 'fewest', label: 'Fewest photos' },
            { value: 'alpha', label: 'A to Z' }, { value: 'alphaDesc', label: 'Z to A' }]} /></span>} tip={logicOf(`tags:${category}`)}>
            {info.blurb}
          </ListHead>

          <div style={styles.list}>
            {loading && rows.length === 0 ? <div style={styles.muted}>Checking your tags…</div>
              : rows.length === 0 ? <div style={styles.muted}>{status === 'open' ? 'Nothing left to review here.' : 'Nothing here.'}</div>
              : rows.map(f => {
                const key = keyOf(f)
                if (category === 'missing') return <MissingRow key={key} f={f} onChange={(x, st) => void change(x, st)} />
                return (
                  <div key={key} style={{ ...styles.card, ...(f.status === 'fine' ? { opacity: 0.6 } : {}) }}>
                    <div style={styles.l1}>
                      <span style={styles.tagName}>{category === 'glued' ? <GluedName text={f.display} /> : f.display}</span>
                      {f.status !== 'fixed' && CONF_VARIES.includes(category) && <span title={CONFIDENCE_HINT[f.confidence]} style={{ ...styles.pill, ...(f.confidence === 'high' ? styles.confVery : f.confidence === 'low' ? styles.pillLow : styles.confPossible) }}>{CONF_LABEL[f.confidence]}</span>}
                      {category === 'junk' && f.status !== 'fixed' && <span style={styles.reasonLabel}>{f.evidence}</span>}
                      {f.status === 'fixed' && <span style={{ ...styles.pill, ...styles.pillHigh }}>Fixed</span>}
                      <span style={styles.count}>{f.count.toLocaleString()} photo{f.count === 1 ? '' : 's'}</span>
                    </div>
                    <div style={styles.l2}>
                      <label style={styles.muted}>{info.label}</label>
                      <input
                        style={styles.input}
                        value={drafts[key] ?? f.replacement}
                        disabled={f.status === 'fixed'}
                        placeholder={f.replacement === '' ? 'Leave empty to delete this tag' : undefined}
                        onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                        aria-label="Edit the replacement tags"
                      />
                      {category === 'plural' && f.status !== 'fixed' && <span style={styles.muted}>{f.evidence}</span>}
                    </div>
                    {(SHOWS_EVIDENCE.includes(category) || f.status === 'fixed') && <div style={styles.ev}>{f.evidence}{f.spellings.length > 1 && category === 'spelling' ? ` · ${f.spellings.join(' · ')}` : ''}</div>}
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
                      <BatchEditButton key={`${f.tag}|${f.category}`} style={styles.secondaryBtn} getIds={() => window.flickrAPI.getAuditPhotoIds(f.tag, f.category)} />
                      {f.flickrUrl && <button style={styles.secondaryBtn} title="Open this tag's page on your Flickr account, to fix it there" onClick={() => window.flickrAPI.openExternal(f.flickrUrl)}>Open on Flickr <Icon name="external" /></button>}
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
  railCol: { width: 230, flexShrink: 0, alignSelf: 'flex-start', maxHeight: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 },   // long lists of checks scroll inside this column
  rail: { flexShrink: 0, background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: 6 },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  statusChip: { border: '1px solid var(--ff-border)', borderRadius: 12, padding: '3px 11px', fontSize: 13, background: 'var(--ff-surface)', color: 'var(--ff-text)', cursor: 'pointer' },
  statusChipOn: { ...selectedOn },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 },
  card: { background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 },
  l1: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tagName: { fontSize: 14, fontWeight: 700, color: 'var(--ff-text)', overflowWrap: 'anywhere' },
  glue: { display: 'inline-block', width: 2, height: 15, background: 'var(--ff-error)', verticalAlign: -3, margin: '0 1px' },
  pill: { fontSize: 11, borderRadius: 8, padding: '1px 8px' },
  pillHigh: { background: 'var(--ff-success-bg)', color: 'var(--ff-success)' },   // Fixed
  confVery: { background: 'var(--ff-navy)', color: 'var(--ff-white)' },
  confPossible: { background: 'transparent', color: 'var(--ff-navy)', boxShadow: 'inset 0 0 0 1px var(--ff-navy)' },
  pillLow: { background: 'var(--ff-border)', color: 'var(--ff-text-secondary)' },
  reasonLabel: { fontSize: 12, color: 'var(--ff-text-secondary)', background: 'var(--ff-warm)', borderRadius: 8, padding: '1px 8px' },
  reasonBox: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ff-text-secondary)' },
  reasonSelect: { ...selectBox },
  count: { marginLeft: 'auto', fontSize: 12, color: 'var(--ff-text-secondary)', whiteSpace: 'nowrap' },
  l2: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  input: { ...fieldBox, flex: 1, minWidth: 220 },
  ev: { fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 6, overflowWrap: 'anywhere' },
  actions: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  primaryBtn: { ...primaryBtn },
  secondaryBtn: { ...quietBtn },
  planBtn: { ...quietBtn, padding: '5px 12px' },
  viewBtn: { ...linkBtn, whiteSpace: 'nowrap', marginLeft: 'auto' },
  moreBtn: { width: '100%', padding: 8, background: 'none', border: '1px dashed var(--ff-line-strong)', borderRadius: 8, color: 'var(--ff-text-secondary)', fontSize: 13, cursor: 'pointer', marginBottom: 12 },
  planPop: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 600, maxWidth: 'calc(100vw - 48px)', maxHeight: '62vh', overflowY: 'auto', background: 'var(--ff-surface)', border: '1px solid var(--ff-line-strong)', borderRadius: 12, boxShadow: '0 10px 30px var(--ff-shadow-mid)', padding: '14px 16px', zIndex: 'var(--ff-z-menu)' },
  planBadge: { background: 'var(--ff-pink-action)', color: 'var(--ff-white)', borderRadius: 8, padding: '0 7px', fontSize: 12, fontWeight: 700 },
  planTitle: { fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--ff-text)' },
  planType: { fontSize: 11, borderRadius: 8, padding: '1px 8px', background: 'var(--ff-tint)', color: 'var(--ff-pink-action)', whiteSpace: 'nowrap', marginLeft: 'auto' },
  planRemove: { background: 'none', border: 'none', color: 'var(--ff-text-muted)', fontSize: 13, cursor: 'pointer', padding: '0 2px', width: 18 },
  planLine: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, padding: '2px 0', color: 'var(--ff-text)' }
}
