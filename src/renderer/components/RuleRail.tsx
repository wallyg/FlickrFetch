import React from 'react'
import type { CleanupRuleState } from '../../shared/cleanupRules'
import { asButton } from '../ui/a11y'
import { railItem, railSel } from '../ui/kit'
import HoverNote from '../ui/HoverNote'

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
export function ListHead({ children, sort, tip }: { children: React.ReactNode; sort: React.ReactNode; tip?: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, margin: '2px 0 10px' }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ff-text-secondary)' }}><HoverNote text={tip} block>{children}</HoverNote></div>
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

export function RailRow({ selected, dim, label, count, pending, onSelect, dot }: { selected: boolean; dim?: boolean; label: string; count: number; pending?: boolean; onSelect: () => void; dot?: string }): React.JSX.Element {
  return (
    <div style={{ ...railItem, ...(selected ? railSel : {}), opacity: dim && !selected ? 0.55 : 1 }} {...asButton(onSelect)} aria-current={selected ? 'true' : undefined}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>{dot && <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flex: 'none', display: 'inline-block' }} />}{label}</span>
      {pending ? <b style={{ fontWeight: 600 }} title="This check needs a Rebuild before it can count">–</b> : <b style={{ fontWeight: 600 }}>{count.toLocaleString()}</b>}
    </div>
  )
}

export default function RuleRail({ rules, stateOf, selectedId, onSelect, offText, groups }: {
  rules: RailRule[]
  stateOf: (id: string) => CleanupRuleState
  selectedId: string
  onSelect: (id: string) => void
  offText: string
  groups?: { title: string; ids: string[] }[]   // when given, the checks are grouped by what they are about (Issues first inside each group, marked by a dot) instead of under Issues and Warnings
}): React.JSX.Element {
  let shown = 0
  // A check that no group names still gets drawn, under a last group, so it can never go missing from the column
  const named = new Set((groups ?? []).flatMap(g => g.ids))
  const spare = rules.filter(r => !named.has(r.id))
  const allGroups = groups && spare.length > 0 ? [...groups, { title: 'More checks', ids: spare.map(r => r.id) }] : groups
  return (
    <>
      {allGroups && allGroups.map(g => {
        const list = rules.filter(r => g.ids.includes(r.id) && stateOf(r.id) !== 'off').sort((a, b) => (stateOf(a.id) === 'on' ? 0 : 1) - (stateOf(b.id) === 'on' ? 0 : 1))
        if (list.length === 0) return null
        return (
          <React.Fragment key={g.title}>
            <RailHead first={shown++ === 0}>{g.title}</RailHead>
            {list.map(r => <RailRow key={r.id} selected={r.id === selectedId} dim={r.count === 0 || r.pending} label={r.name} count={r.count} pending={r.pending} dot={stateOf(r.id) === 'on' ? 'var(--ff-error)' : 'var(--ff-warning)'} onSelect={() => onSelect(r.id)} />)}
          </React.Fragment>
        )
      })}
      {!allGroups && ([['on', 'Issues'], ['optional', 'Warnings']] as const).map(([st, heading]) => {
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
