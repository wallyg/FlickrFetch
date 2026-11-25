import type { CSSProperties } from 'react'

// The button and switch looks shared by the 3.5 pages, so every screen follows one rule:
//   primaryBtn  the one main action on a screen (pink)
//   quietBtn    everything else you can press (white with a grey edge)
//   selectedOn  added on top of a chip, segment or list row that is chosen (soft pink with a pink edge)
//   linkBtn     text-only actions (blue)
// Titles are navy; navy is not used as a button colour.

export const primaryBtn: CSSProperties = {
  background: 'var(--ff-pink-action)', color: 'var(--ff-white)', border: '1px solid var(--ff-pink-action)',
  borderRadius: 6, padding: '5px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
}

export const quietBtn: CSSProperties = {
  background: 'var(--ff-surface)', color: 'var(--ff-text)', border: '1px solid var(--ff-line-strong)',
  borderRadius: 6, padding: '4px 11px', fontSize: 13, cursor: 'pointer'
}

// A small quiet button with an icon in front (the icon takes the blue; the label stays dark)
export const pillBtn: CSSProperties = {
  ...quietBtn, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', fontSize: 12, whiteSpace: 'nowrap'
}

export const linkBtn: CSSProperties = {
  background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: 12, cursor: 'pointer', padding: 0
}

// Works on a chip (has its own border) and on a segment inside a rounded group
export const selectedOn: CSSProperties = {
  background: 'var(--ff-tint)', color: 'var(--ff-pink-action)', fontWeight: 700,
  boxShadow: 'inset 0 0 0 1px var(--ff-pink)'
}

export const chip: CSSProperties = {
  border: '1px solid var(--ff-border)', borderRadius: 12, padding: '3px 11px', fontSize: 13,
  background: 'var(--ff-surface)', color: 'var(--ff-text)', cursor: 'pointer'
}

export const segGroup: CSSProperties = {
  display: 'inline-flex', gap: 2, padding: 2, border: '1px solid var(--ff-line-strong)', borderRadius: 8, background: 'var(--ff-surface)'
}

export const segBtn: CSSProperties = {
  border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 13, color: 'var(--ff-text-secondary)', background: 'var(--ff-surface)', cursor: 'pointer'
}

export const railItem: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 9px', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: 'var(--ff-text)'
}

// The selected row changes colour and background only: a bolder weight made long names wrap onto a second line when selected
export const railSel: CSSProperties = { background: 'var(--ff-tint)', color: 'var(--ff-pink-action)' }

// A small text box for filtering a list
export const filterInput: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--ff-border)', borderRadius: 6, padding: '5px 8px',
  fontSize: 13, background: 'var(--ff-surface)', color: 'var(--ff-text)'
}
