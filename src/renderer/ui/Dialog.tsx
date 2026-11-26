import React, { useEffect, useId, useRef } from 'react'
import { isTopDialog, nextFocusIndex, popDialog, pushDialog } from './dialogStack'

// The one shell for every dialog (#236): the dimmed backdrop, the card, and the behaviour a dialog must have.
//   - Esc closes the dialog on top (and only that one); clicking the backdrop closes it too.
//   - Focus moves into the dialog when it opens, Tab stays inside it, and focus goes back to where it was when it closes.
//   - Sizes: small 360 (a question), medium 480, wide 640 (Settings, long text), large 720; or give a width of your own.
// The dialog's own contents (header, body, buttons) stay in the component; use <CloseButton> in its header.

export type DialogSize = 'small' | 'medium' | 'wide' | 'large'
const WIDTH: Record<DialogSize, number> = { small: 360, medium: 480, wide: 640, large: 720 }
const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/** Esc closes this screen if it is the one on top (a dialog or a side panel). */
export function useEscapeToClose(onClose: () => void, active = true): void {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (!active) return
    const id = pushDialog()
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' && isTopDialog(id)) { e.stopPropagation(); ref.current() } }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); popDialog(id) }
  }, [active])
}

export default function Dialog({ label, onClose, size = 'medium', width, cardStyle, children }: {
  label: string                    // what a screen reader calls it
  onClose: () => void
  size?: DialogSize
  width?: number | string          // instead of a size
  cardStyle?: React.CSSProperties  // what this dialog needs beyond the shell (padding, a fixed height, its own scrolling)
  children: React.ReactNode
}): React.JSX.Element {
  const card = useRef<HTMLDivElement | null>(null)
  const downOnBackdrop = useRef(false)
  const labelId = useId()
  useEscapeToClose(onClose)

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const el = card.current
    if (el && !el.contains(document.activeElement)) el.focus()
    return () => { if (before && document.contains(before)) before.focus() }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key !== 'Tab' || !card.current) return
    const items = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(n => n.offsetParent !== null)
    const at = items.indexOf(document.activeElement as HTMLElement)
    const to = nextFocusIndex(at, items.length, e.shiftKey)
    if (to < 0) { e.preventDefault(); card.current.focus(); return }
    // let the browser handle the ordinary steps; take over only at the two ends so focus cannot leave
    if ((!e.shiftKey && at === items.length - 1) || (e.shiftKey && (at <= 0))) { e.preventDefault(); items[to].focus() }
  }

  return (
    <div style={overlay} onMouseDown={e => { downOnBackdrop.current = e.target === e.currentTarget }} onClick={e => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose() }} onKeyDown={onKeyDown}>
      <div ref={card} data-dialog role="dialog" aria-modal="true" aria-label={label} id={labelId} tabIndex={-1}
        style={{ ...cardBase, width: width ?? WIDTH[size], ...cardStyle }}>
        {children}
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'var(--ff-scrim)', zIndex: 'var(--ff-z-dialog)', display: 'flex', alignItems: 'center', justifyContent: 'center'
}
const cardBase: React.CSSProperties = {
  background: 'var(--ff-surface)', borderRadius: 12, maxWidth: '92vw', maxHeight: '90vh', boxShadow: '0 12px 40px var(--ff-shadow-strong)'
}
