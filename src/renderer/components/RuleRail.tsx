import React from 'react'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import { asButton } from '../ui/a11y'
import { railItem, railSel } from '../ui/kit'

// The left column of a Health Check list view: the checks grouped under Issues and Warnings (Off ones are left out),
// and single rows such as the Open / Fix choices. Shared by the Tags and Photos lists.

export interface RailRule { id: string; name: string; count: number }

export function RailHead({ children, first }: { children: React.ReactNode; first?: boolean }): React.JSX.Element {
  return <div style={{ fontSize: 11, color: 'var(--ff-text-muted)', padding: `${first ? 4 : 10}px 9px 4px` }}>{children}</div>
}

export function RailRow({ selected, dim, label, count, onSelect }: { selected: boolean; dim?: boolean; label: string; count: number; onSelect: () => void }): React.JSX.Element {
  return (
    <div style={{ ...railItem, ...(selected ? railSel : {}), opacity: dim && !selected ? 0.55 : 1 }} {...asButton(onSelect)} aria-current={selected ? 'true' : undefined}>
      <span>{label}</span><b style={{ fontWeight: 600 }}>{count.toLocaleString()}</b>
    </div>
  )
}

export default function RuleRail({ rules, stateOf, selectedId, onSelect, offText }: {
  rules: RailRule[]
  stateOf: (id: string) => CleanupRuleState
  selectedId: string
  onSelect: (id: string) => void
  offText: string
}): React.JSX.Element {
  return (
    <>
      {([['on', 'Issues'], ['optional', 'Warnings']] as const).map(([st, heading]) => {
        const list = rules.filter(r => stateOf(r.id) === st)
        if (list.length === 0) return null
        return (
          <React.Fragment key={st}>
            <RailHead first={st === 'on'}>{heading}</RailHead>
            {list.map(r => <RailRow key={r.id} selected={r.id === selectedId} dim={r.count === 0} label={r.name} count={r.count} onSelect={() => onSelect(r.id)} />)}
          </React.Fragment>
        )
      })}
      {rules.every(r => stateOf(r.id) === 'off') && <div style={{ fontSize: 13, color: 'var(--ff-text-secondary)', padding: 8 }}>{offText}</div>}
    </>
  )
}
