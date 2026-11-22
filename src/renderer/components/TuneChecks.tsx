import React, { useEffect, useState } from 'react'
import { CLEANUP_RULES } from '../../shared/cleanupRules'
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
  useEffect(() => {
    void Promise.all([window.flickrAPI.getAuditSummary(), window.flickrAPI.getHealthSummary()]).then(([a, h]) => {
      const c: Record<string, number> = {}
      for (const r of a.rows) c[`tags:${r.category}`] = r.open + r.plan
      for (const r of h.rows) c[`photos:${r.condition}`] = r.open
      setCounts(c)
    }).catch(() => { /* counts are only a hint */ })
  }, [])

  const group = (report: 'tags' | 'photos', title: string, unit: string): React.JSX.Element => (
    <div>
      <div style={styles.groupHead}>{title}</div>
      <div style={styles.rules}>
      {CLEANUP_RULES.filter(r => r.report === report).map(r => (
        <div key={r.id} style={styles.rule}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{r.name}{counts[r.id] !== undefined && <span style={styles.count}> · {counts[r.id].toLocaleString()} {unit}</span>}</div>
            <div style={styles.blurb}>{r.blurb}</div>
            {r.example && <div style={styles.example}>e.g. {r.example}</div>}
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
  blurb: { fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 2 },
}
