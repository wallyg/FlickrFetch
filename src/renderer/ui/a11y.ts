import type { KeyboardEvent } from 'react'

// For a clickable box that is not a <button>: makes it reachable with Tab and usable with Enter or Space,
// and tells screen readers it is a button. Spread it onto the element: <div {...asButton(fn)}>.
export function asButton(onClick: () => void): { role: 'button'; tabIndex: number; onClick: () => void; onKeyDown: (e: KeyboardEvent) => void } {
  return {
    role: 'button', tabIndex: 0, onClick,
    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }
  }
}
