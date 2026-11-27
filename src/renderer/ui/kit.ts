import type { CSSProperties } from 'react'

// The button and switch looks shared by the 3.5 pages, so every screen follows one rule:
//   primaryBtn  the one main action on a screen (pink)
//   quietBtn    everything else you can press (white with a grey edge)
//   selectedOn  added on top of a chip, segment or list row that is chosen (soft pink with a pink edge)
//   linkBtn     text-only actions (blue)
//   doThisBtn   the action on a row or card (outlined blue)
//   putAsideBtn dismiss or defer: grey underlined text
//   dangerBtn   delete or clear: the Secondary shape in red
// Titles are navy; navy is not used as a button colour.

// A marker the global hover and pressed wash looks for (index.html). A custom property is written into the style attribute word for word, so the wash
// finds every button built from these looks however the browser would otherwise write out its border.
const BOXED = { '--ff-box': '1' } as CSSProperties

export const primaryBtn: CSSProperties = {
  ...BOXED,
  background: 'var(--ff-pink-action)', color: 'var(--ff-white)', border: '1px solid var(--ff-pink-action)',
  borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
}

export const quietBtn: CSSProperties = {
  ...BOXED,
  background: 'var(--ff-surface)', color: 'var(--ff-text)', border: '1px solid var(--ff-line-strong)',
  borderRadius: 6, padding: '4px 12px', fontSize: 13, cursor: 'pointer'
}

// A small quiet button with an icon in front (the icon takes the blue; the label stays dark)
export const pillBtn: CSSProperties = {
  ...quietBtn, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', fontSize: 12, whiteSpace: 'nowrap'
}

// The same, a size smaller, for a button that sits in a row of text or a narrow bar (the download bar, History, Settings lines)
export const smallBtn: CSSProperties = { ...quietBtn, padding: '2px 8px', fontSize: 12 }

// The action on a row or card: outlined blue (Health Check rows, Backup, Album fit, the On This Day card)
export const doThisBtn: CSSProperties = { ...quietBtn, borderColor: 'var(--ff-blue)', color: 'var(--ff-blue)', fontWeight: 700 }

export const doThisSmallBtn: CSSProperties = { ...doThisBtn, padding: '2px 8px', fontSize: 12 }

// Dismiss or defer ("This one is fine", "Not now", "Undo")
export const putAsideBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--ff-text-secondary)', textDecoration: 'underline', cursor: 'pointer' }

// Delete or Clear: the Secondary shape with red words and edge
export const dangerBtn: CSSProperties = { ...quietBtn, color: 'var(--ff-error-ink)', borderColor: 'var(--ff-error-ink)' }

export const linkBtn: CSSProperties = {
  background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: 12, cursor: 'pointer', padding: 0
}

// Works on a chip (has its own border) and on a segment inside a rounded group
export const selectedOn: CSSProperties = {
  background: 'var(--ff-tint)', color: 'var(--ff-pink-action)', fontWeight: 700,
  boxShadow: 'inset 0 0 0 1px var(--ff-pink)'
}

// Text boxes, number boxes and selects: one look (#237). The edge is the quiet button's edge, the corner is the button's corner.
// fieldBox is the standard size, fieldCompact sits inside a row of text or a settings line; selectBox and selectCompact add the pointer.
export const fieldBox: CSSProperties = {
  border: '1px solid var(--ff-line-strong)', borderRadius: 6, padding: '4px 8px', fontSize: 13, background: 'var(--ff-surface)', color: 'var(--ff-text)'
}
export const fieldCompact: CSSProperties = { ...fieldBox, padding: '2px 6px' }
export const selectBox: CSSProperties = { ...fieldBox, cursor: 'pointer' }
export const selectCompact: CSSProperties = { ...fieldCompact, cursor: 'pointer' }

// Marks a tab button, so its keyboard focus ring sits inside the tab instead of against the bar around it (index.html). Spread it into a tab's style.
export const tabMark = { '--ff-tab': '1' } as CSSProperties

export const chip: CSSProperties = {
  ...BOXED,
  border: '1px solid var(--ff-border)', borderRadius: 12, padding: '2px 12px', fontSize: 13,
  background: 'var(--ff-surface)', color: 'var(--ff-text)', cursor: 'pointer'
}

export const segGroup: CSSProperties = {
  display: 'inline-flex', gap: 2, padding: 2, border: '1px solid var(--ff-line-strong)', borderRadius: 8, background: 'var(--ff-surface)'
}

export const segBtn: CSSProperties = {
  border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 13, color: 'var(--ff-text-secondary)', background: 'var(--ff-surface)', cursor: 'pointer'
}

export const railItem: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: 'var(--ff-text)'
}

// The selected row changes colour and background only: a bolder weight made long names wrap onto a second line when selected
export const railSel: CSSProperties = { background: 'var(--ff-tint)', color: 'var(--ff-pink-action)' }

// A small text box for filtering a list
export const filterInput: CSSProperties = { ...fieldBox, width: '100%', boxSizing: 'border-box' }
