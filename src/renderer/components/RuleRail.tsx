import React from 'react'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import { asButton } from '../ui/a11y'
import { railItem, railSel } from '../ui/kit'

// The left column of a Health Check list view: the checks grouped under Issues and Warnings (Off ones are left out),
// and single rows such as the Open / Fix choices. Shared by the Tags and Photos lists.

export interface RailRule { id: string; name: string; count: number; pending?: boolean }   // pending: needs a Rebuild before it can count

export function RailHead({ children, first }: { children: React.ReactNode; first?: boolean }): React.JSX.Element {
  // A clear section title: small capitals in navy, with a thin line above every one after the first
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--ff-navy)',
      padding: `${first ? 6 : 12}px 9px 5px`, ...(first ? {} : { marginTop: 8, borderTop: '1px solid var(--ff-border)' })
    }}>{children}</div>
  )
}

// The list's heading line: what the check means on the left, how the list is ordered on the right
export function ListHead({ children, sort }: { children: React.ReactNode; sort: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, margin: '2px 0 10px' }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ff-text-secondary)' }}>{children}</div>
      {sort}
    </div>
  )
}

export function SortBox<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }): React.JSX.Element {
  return (
    <label style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ff-text-secondary)' }}>
      Sort
      <select value={value} onChange={e => onChange(e.target.value as T)} title="How this list is ordered" aria-label="Sort this list"
        style={{ border: '1px solid var(--ff-border)', borderRadius: 6, padding: '5px 8px', fontSize: 13, background: '#fff', color: 'var(--ff-text)' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function RailRow({ selected, dim, label, count, pending, onSelect }: { selected: boolean; dim?: boolean; label: string; count: number; pending?: boolean; onSelect: () => void }): React.JSX.Element {
  return (
    <div style={{ ...railItem, ...(selected ? railSel : {}), opacity: dim && !selected ? 0.55 : 1 }} {...asButton(onSelect)} aria-current={selected ? 'true' : undefined}>
      <span>{label}</span>
      {pending ? <b style={{ fontWeight: 600 }} title="This check needs a Rebuild before it can count">–</b> : <b style={{ fontWeight: 600 }}>{count.toLocaleString()}</b>}
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
            {list.map(r => <RailRow key={r.id} selected={r.id === selectedId} dim={r.count === 0 || r.pending} label={r.name} count={r.count} pending={r.pending} onSelect={() => onSelect(r.id)} />)}
          </React.Fragment>
        )
      })}
      {rules.some(r => r.pending && stateOf(r.id) !== 'off') && <div style={{ fontSize: 12, color: 'var(--ff-text-secondary)', padding: '10px 9px 4px', lineHeight: 1.45 }}>A dash means that check needs a Rebuild first.</div>}
      {rules.every(r => stateOf(r.id) === 'off') && <div style={{ fontSize: 13, color: 'var(--ff-text-secondary)', padding: 8 }}>{offText}</div>}
    </>
  )
}
