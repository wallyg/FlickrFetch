import React, { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import type { FineReasonSummaryRow } from '../../shared/types'
import { CLEANUP_RULES, DEFAULT_GENERIC_WORDS, logicOf } from '../../shared/cleanupRules'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import { segGroup, segBtn, selectedOn } from '../ui/kit'
import AlbumFitSettings from './AlbumFitSettings'
import MissingTagSettings from './MissingTagSettings'
import LocationHintSettings from './LocationHintSettings'
import { LocationScope } from './HealthScopeSettings'
import DuplicateSettings from './DuplicateSettings'
import RichNote from '../ui/RichNote'

// "Tune checks" (a tab in Settings): every Health Check check can be Off (not shown, not counted), Optional (shown, but never lowers the
// score) or On (a problem that needs attention, counted). Changes take effect at once.

interface Props {
  stateOf: (id: string) => CleanupRuleState
  setState: (id: string, state: CleanupRuleState) => void
  onOpenAlbumTab?: () => void   // the list of how each album is judged has its own tab in Settings
}

const CHOICES: { key: CleanupRuleState; label: string; hint: string }[] = [
  { key: 'off', label: 'Off', hint: 'Not shown and not counted anywhere' },
  { key: 'optional', label: 'Warning', hint: 'Shown as a warning, but never lowers the score' },
  { key: 'on', label: 'Issue', hint: 'A problem that needs attention, counted in the score' }
]

type Report = 'tags' | 'photos' | 'albums'
// The same order as the Health Check tabs
const ORDER: { key: Report; title: string }[] = [{ key: 'photos', title: 'Photos' }, { key: 'albums', title: 'Albums' }, { key: 'tags', title: 'Tags' }]
// What a check's count counts
const PHOTO_ALBUM_CHECKS = ['albums:noAlbum', 'albums:misfit', 'albums:missing']
const unitOf = (id: string): string => id.startsWith('tags:') ? 'tags' : id.startsWith('photos:') || PHOTO_ALBUM_CHECKS.includes(id) ? 'photos' : 'albums'
// The selected choice is coloured by what it means: Issue red, Warning amber, Off grey
const SELECTED: Record<CleanupRuleState, React.CSSProperties> = {
  off: { background: 'var(--ff-warm)', color: 'var(--ff-text)', fontWeight: 700, boxShadow: 'inset 0 0 0 1px var(--ff-slate)' },
  optional: { background: 'var(--ff-warning-bg)', color: 'var(--ff-warning-text)', fontWeight: 700, boxShadow: 'inset 0 0 0 1px var(--ff-warning)' },
  on: { background: 'var(--ff-error-bg)', color: 'var(--ff-error)', fontWeight: 700, boxShadow: 'inset 0 0 0 1px var(--ff-error)' }
}

// Settings closes and opens again as a new screen; this keeps which checks were unfolded and how far down you were
const remembered: { open: Record<string, boolean>; scroll: number } = { open: {}, scroll: 0 }

export default function TuneChecks({ stateOf, setState, onOpenAlbumTab }: Props): React.JSX.Element {
  // How many items each check finds today, to help decide
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [limitText, setLimitText] = useState<string>('65')   // what is typed in the box; it is checked and saved when you click away or press Enter
  const [fine, setFine] = useState<FineReasonSummaryRow[]>([])   // why you marked things fine, by check
  const [fineSaved, setFineSaved] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>(remembered.open)   // which checks are unfolded
  useEffect(() => { remembered.open = open }, [open])
  const [current, setCurrent] = useState<Report>('photos')   // the group in view, for the jump chips
  const heads = useRef<Record<string, HTMLDivElement | null>>({})
  const root = useRef<HTMLDivElement | null>(null)
  useEffect(() => { void window.flickrAPI.getFineSummary().then(setFine).catch(() => { /* only a hint */ }) }, [])
  const [words, setWords] = useState<string>(DEFAULT_GENERIC_WORDS.join('\n'))
  useEffect(() => { void window.flickrAPI.getSettings().then(s => { setLimitText(String(s.healthTagLimit ?? 65)); setWords((s.auditGenericWords ?? DEFAULT_GENERIC_WORDS).join('\n')) }) }, [])
  // The list of generic words: saved when you click away, one word per line
  const saveWords = (text: string): void => {
    const list = text.split('\n').map(w => w.trim()).filter(Boolean)
    void window.flickrAPI.setSettings({ auditGenericWords: list })
  }
  // A number a check lets you change: kept within its range and saved once typing is done; the counts and lists follow when Settings is closed
  const commitNumber = (key: 'healthTagLimit', min: number, max: number, def: number, v: string): void => {
    const n = Math.min(max, Math.max(min, Math.round(Number(v)) || def))
    setLimitText(String(n))
    void window.flickrAPI.setSettings({ [key]: n })
  }
  useEffect(() => {
    void Promise.all([window.flickrAPI.getAuditSummary(), window.flickrAPI.getHealthSummary(), window.flickrAPI.getAlbumSummary()]).then(([a, h, al]) => {
      const c: Record<string, number> = {}
      for (const r of a.rows) c[`tags:${r.category}`] = r.open + r.plan
      for (const r of h.rows) c[`photos:${r.condition}`] = r.open
      for (const r of al.rows) c[`albums:${r.condition}`] = r.photos ?? r.open   // May not fit and May be missing count photos, as the Albums summary does
      setCounts(c)
    }).catch(() => { /* counts are only a hint */ })
  }, [])

  // The chip of the group at the top of the scrolling area stays marked
  useEffect(() => {
    let box: HTMLElement | null = root.current?.parentElement ?? null
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
    if (!box) return
    const area = box
    requestAnimationFrame(() => { area.scrollTop = remembered.scroll; onScroll() })   // back to where you were
    const onScroll = (): void => {
      remembered.scroll = area.scrollTop
      const top = area.getBoundingClientRect().top + 70
      let found: Report = ORDER[0].key
      for (const g of ORDER) { const el = heads.current[g.key]; if (el && el.getBoundingClientRect().top <= top) found = g.key }
      setCurrent(found)
    }
    area.addEventListener('scroll', onScroll)
    return () => area.removeEventListener('scroll', onScroll)
  }, [])
  const jump = (k: Report): void => { setCurrent(k); heads.current[k]?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  const group = (report: Report, title: string): React.JSX.Element => (
    <div>
      <div ref={el => { heads.current[report] = el }} style={styles.groupHead}>{title}</div>
      <div style={styles.rules}>
        {CLEANUP_RULES.filter(r => r.report === report).map(r => {
          const isOpen = open[r.id] === true
          const now = stateOf(r.id)
          const note = logicOf(r.id)
          const mine = fine.filter(x => x.checkId === r.id)
          return (
            <div key={r.id} style={styles.rule}>
              <div style={styles.ruleTop}>
                <button style={styles.ruleToggle} aria-expanded={isOpen} onClick={() => setOpen(o => ({ ...o, [r.id]: !isOpen }))}>
                  <span aria-hidden="true" style={styles.chev}><Icon name={isOpen ? 'chevronDown' : 'chevronRight'} /></span>
                  <span style={{ fontWeight: 700 }}>{r.name}</span>
                  {counts[r.id] !== undefined && <span style={styles.count}> · {counts[r.id].toLocaleString()} {unitOf(r.id)}</span>}
                  {now !== r.defaultState && <span style={styles.changed}>changed</span>}
                </button>
                <div style={segGroup} role="radiogroup" aria-label={`${r.name}: how it is treated`}>
                  {CHOICES.map(c => (
                    <button key={c.key} role="radio" aria-checked={now === c.key} title={c.hint}
                      style={{ ...segBtn, minWidth: 66, textAlign: 'center', ...(now === c.key ? SELECTED[c.key] : {}) }} onClick={() => setState(r.id, c.key)}>{c.label}</button>
                  ))}
                </div>
              </div>
              {isOpen && (
                <div style={styles.ruleBody}>
                  <div style={styles.blurb}>{r.blurb}</div>
                  {note && <div style={styles.logic}><RichNote text={note} /></div>}
                  {r.number && (
                    <label style={styles.numberRow}>
                      {r.number.label}
                      <input type="number" style={styles.numberInput} min={r.number.min} max={r.number.max} value={limitText}
                        onChange={e => setLimitText(e.target.value)}
                        onBlur={e => commitNumber(r.number!.key, r.number!.min, r.number!.max, r.number!.def, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
                      <span style={styles.small}>({r.number.min} to {r.number.max}; Flickr allows 75)</span>
                    </label>
                  )}
                  {mine.length > 0 && <div style={styles.small}>Your reasons for marking fine: {mine.map(x => `${x.reason} (${x.count})`).join(', ')}</div>}
                  {r.id === 'albums:misfit' && <AlbumFitSettings />}
                  {r.id === 'tags:missing' && <MissingTagSettings />}
                  {r.id === 'photos:location' && <LocationScope />}
                  {r.id === 'photos:location' && <LocationHintSettings />}
                  {r.id === 'photos:duplicates' && <DuplicateSettings />}
                  {r.list && (
                    <div style={{ marginTop: 6 }}>
                      <div style={styles.small}>{r.list.help}</div>
                      <textarea style={styles.wordsBox} rows={5} value={words} spellCheck={false} aria-label={r.list.label}
                        onChange={e => setWords(e.target.value)} onBlur={e => saveWords(e.target.value)} />
                      <button style={styles.resetBtn} onClick={() => { const d = DEFAULT_GENERIC_WORDS.join('\n'); setWords(d); saveWords(d) }}>Reset to the standard list</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {report === 'albums' && (
          <div style={styles.rule}>
            <div style={styles.ruleTop}>
              <span style={{ fontWeight: 700, padding: '4px 0 4px 18px' }}>How each album is judged</span>
              {onOpenAlbumTab && <button style={styles.resetBtn} onClick={onOpenAlbumTab}>Open the Album Checks tab</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div ref={root} style={styles.body}>
      <div style={styles.chips} role="navigation" aria-label="Jump to a group of checks">
        {ORDER.map(g => (
          <button key={g.key} style={{ ...styles.chip, ...(current === g.key ? selectedOn : {}) }} onClick={() => jump(g.key)}>
            {g.title} <span style={styles.chipN}>{CLEANUP_RULES.filter(r => r.report === g.key).length}</span>
          </button>
        ))}
      </div>
      {ORDER.map(g => group(g.key, g.title))}
      {fine.length > 0 && (
        <div style={styles.small}>
          You have given {fine.reduce((n, x) => n + x.count, 0).toLocaleString()} reasons for marking things fine. They stay on this computer.{' '}
          <button style={styles.resetBtn} onClick={async () => setFineSaved(await window.flickrAPI.saveFineReasonsCsv())}>Save them as a spreadsheet</button>
          {fineSaved && <> Saved to {fineSaved.split('/').pop()}.</>}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  body: { display: 'flex', flexDirection: 'column', gap: 26 },
  groupHead: { fontSize: 14, fontWeight: 700, color: 'var(--ff-text)', margin: '2px 0 4px', scrollMarginTop: 48 },
  rules: { display: 'flex', flexDirection: 'column', gap: 8 },
  rule: { padding: '8px 14px', border: '1px solid var(--ff-border)', borderRadius: 8, background: 'var(--ff-cream)', fontSize: 13 },
  ruleTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  ruleToggle: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 4, textAlign: 'left', background: 'none', border: 'none', padding: '4px 0', font: 'inherit', color: 'inherit', cursor: 'pointer' },
  chev: { width: 14, color: 'var(--ff-text-muted)', flex: 'none' },
  changed: { marginLeft: 6, fontSize: 11, padding: '0 7px', borderRadius: 8, background: 'var(--ff-warm)', color: 'var(--ff-text-secondary)' },
  ruleBody: { padding: '4px 0 6px 18px', display: 'flex', flexDirection: 'column', gap: 6 },
  logic: { fontSize: 12, color: 'var(--ff-text)', lineHeight: 1.5 },
  small: { fontSize: 12, color: 'var(--ff-text-muted)' },
  chips: { position: 'sticky', top: 0, zIndex: 'var(--ff-z-sticky)', display: 'flex', gap: 8, padding: '6px 0 8px', background: 'var(--ff-white)' },
  chip: { border: '1px solid var(--ff-line-strong)', background: 'var(--ff-white)', borderRadius: 12, padding: '3px 12px', fontSize: 13, color: 'var(--ff-text-secondary)', cursor: 'pointer' },
  chipN: { color: 'var(--ff-text-muted)', fontWeight: 400 },
  count: { fontWeight: 400, color: 'var(--ff-text-secondary)' },
  numberRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--ff-text)' },
  numberInput: { width: 64, border: '1px solid var(--ff-line-strong)', borderRadius: 6, padding: '3px 6px', fontSize: 13, background: 'var(--ff-surface)', color: 'var(--ff-text)' },
  wordsBox: { display: 'block', width: '100%', maxWidth: 320, marginTop: 4, border: '1px solid var(--ff-line-strong)', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', background: 'var(--ff-surface)', color: 'var(--ff-text)', resize: 'vertical' },
  resetBtn: { marginTop: 4, border: 'none', background: 'none', padding: 0, fontSize: 12, color: 'var(--ff-text-secondary)', textDecoration: 'underline', cursor: 'pointer' },
  blurb: { fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 2 },
}
