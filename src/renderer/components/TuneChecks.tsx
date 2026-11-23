import React, { useEffect, useState } from 'react'
import { CLEANUP_RULES, DEFAULT_GENERIC_WORDS } from '../../shared/cleanupRules'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import { segGroup, segBtn, selectedOn } from '../ui/kit'

// "Tune checks" (a tab in Settings): every Health Check check can be Off (not shown, not counted), Optional (shown, but never lowers the
// score) or On (a problem that needs attention, counted). Changes take effect at once.

interface Props {
  stateOf: (id: string) => CleanupRuleState
  setState: (id: string, state: CleanupRuleState) => void
}

const CHOICES: { key: CleanupRuleState; label: string; hint: string }[] = [
  { key: 'off', label: 'Off', hint: 'Not shown and not counted anywhere' },
  { key: 'optional', label: 'Warning', hint: 'Shown as a warning, but never lowers the score' },
  { key: 'on', label: 'Issue', hint: 'A problem that needs attention, counted in the score' }
]

export default function TuneChecks({ stateOf, setState }: Props): React.JSX.Element {
  // How many items each check finds today, to help decide
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [limitText, setLimitText] = useState<string>('65')   // what is typed in the box; it is checked and saved when you click away or press Enter
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
      for (const r of al.rows) c[`albums:${r.condition}`] = r.open
      setCounts(c)
    }).catch(() => { /* counts are only a hint */ })
  }, [])

  const group = (report: 'tags' | 'photos' | 'albums', title: string, unit: string): React.JSX.Element => (
    <div>
      <div style={styles.groupHead}>{title}</div>
      <div style={styles.rules}>
      {CLEANUP_RULES.filter(r => r.report === report).map(r => (
        <div key={r.id} style={styles.rule}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{r.name}{counts[r.id] !== undefined && <span style={styles.count}> · {counts[r.id].toLocaleString()} {unit}</span>}</div>
            <div style={styles.blurb}>{r.blurb}</div>
            {r.example && <div style={styles.example}>e.g. {r.example}</div>}
            {r.number && (
              <label style={styles.numberRow}>
                {r.number.label}
                <input type="number" style={styles.numberInput} min={r.number.min} max={r.number.max} value={limitText}
                  onChange={e => setLimitText(e.target.value)}
                  onBlur={e => commitNumber(r.number!.key, r.number!.min, r.number!.max, r.number!.def, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
                <span style={styles.example}>({r.number.min} to {r.number.max}; Flickr allows 75)</span>
              </label>
            )}
            {r.list && (
              <div style={{ marginTop: 6 }}>
                <div style={styles.example}>{r.list.help}</div>
                <textarea style={styles.wordsBox} rows={5} value={words} spellCheck={false} aria-label={r.list.label}
                  onChange={e => setWords(e.target.value)} onBlur={e => saveWords(e.target.value)} />
                <button style={styles.resetBtn} onClick={() => { const d = DEFAULT_GENERIC_WORDS.join('\n'); setWords(d); saveWords(d) }}>Reset to the standard list</button>
              </div>
            )}
          </div>
          <div style={segGroup}>
            {CHOICES.map(c => (
              <button key={c.key} title={c.hint} style={{ ...segBtn, minWidth: 66, textAlign: 'center', ...(stateOf(r.id) === c.key ? selectedOn : {}) }} onClick={() => setState(r.id, c.key)}>{c.label}</button>
            ))}
          </div>
        </div>
      ))}
      </div>
    </div>
  )

  return (
    <div style={styles.body}>
      {group('tags', 'Tags', 'tags')}
      {group('photos', 'Photos', 'photos')}
      {group('albums', 'Albums', 'items')}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  body: { display: 'flex', flexDirection: 'column', gap: 26 },
  example: { fontSize: 12, color: 'var(--ff-text-muted)', marginTop: 1 },
  groupHead: { fontSize: 14, fontWeight: 700, color: 'var(--ff-text)', margin: '2px 0 4px' },
  rules: { display: 'flex', flexDirection: 'column', gap: 8 },
  rule: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '11px 14px', border: '1px solid #eeebe6', borderRadius: 8, background: '#fafaf8', fontSize: 13 },
  count: { fontWeight: 400, color: 'var(--ff-text-secondary)' },
  numberRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--ff-text)' },
  numberInput: { width: 64, border: '1px solid var(--ff-line-strong)', borderRadius: 6, padding: '3px 6px', fontSize: 13, background: '#fff', color: 'var(--ff-text)' },
  wordsBox: { display: 'block', width: '100%', maxWidth: 320, marginTop: 4, border: '1px solid var(--ff-line-strong)', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', background: '#fff', color: 'var(--ff-text)', resize: 'vertical' },
  resetBtn: { marginTop: 4, border: 'none', background: 'none', padding: 0, fontSize: 12, color: 'var(--ff-text-secondary)', textDecoration: 'underline', cursor: 'pointer' },
  blurb: { fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 2 },
}
