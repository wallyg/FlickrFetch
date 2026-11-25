import React, { useId, useLayoutEffect, useRef, useState } from 'react'
import RichNote from './RichNote'
import { sideShift } from './noteFit'
import Icon from './Icon'

// A wider tooltip for long explanations: it appears at once (the browser's own tooltip waits a second and cannot wrap long text well),
// stays inside a readable width, keeps line breaks, and opens from the keyboard too (Tab to the control, or to the small mark).
// Wrap the thing that explains itself. By default a small (i) is added after it; with mark={false} the wrapped control itself
// (a button, a group of tabs) opens the note. block = the wrapper fills its row.
// The note sits against the (i), or against the control when there is no (i), never against the left edge of the row (#263). It opens
// below and lines up with its anchor's left edge; it slides sideways only as far as it must to stay inside the window, and near the bottom
// it opens above.

export default function HoverNote({ text, children, block, mark = true }: { text?: string; children?: React.ReactNode; block?: boolean; mark?: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [flip, setFlip] = useState({ dx: 0, y: false })
  const bubbleRef = useRef<HTMLSpanElement | null>(null)
  const id = useId()
  useLayoutEffect(() => {
    const el = bubbleRef.current
    if (!open || !el) return
    const b = el.getBoundingClientRect()
    const a = (el.parentElement as HTMLElement).getBoundingClientRect()
    setFlip({ dx: sideShift(b.left, b.width, window.innerWidth), y: b.bottom > window.innerHeight - 8 && a.top - b.height - 12 > 0 })
  }, [open])
  const close = (): void => { setOpen(false); setFlip({ dx: 0, y: false }) }
  if (!text) return <>{children}</>
  const bubbleEl = open && (
    <span ref={bubbleRef} id={id} role="tooltip" style={{
      ...noteBubble,
      ...(flip.dx !== 0 ? { left: flip.dx } : {}),
      ...(flip.y ? { top: 'auto', bottom: '100%', marginTop: 0, marginBottom: 6 } : {})
    }}><RichNote text={text} /></span>
  )
  return (
    <span style={{ position: mark ? undefined : 'relative', display: block ? 'block' : 'inline-block' }}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)} onMouseLeave={close}
      onFocus={() => setOpen(true)} onBlur={close}
      onKeyDown={e => { if (e.key === 'Escape') close() }}>
      {children}
      {mark && <span tabIndex={0} role="button" aria-label="How this works" style={{ position: 'relative', display: 'inline-block', marginLeft: 4, color: 'var(--ff-text-secondary)', cursor: 'help', fontWeight: 400 }}><Icon name="info" />{bubbleEl}</span>}
      {!mark && bubbleEl}
    </span>
  )
}

export const noteBubble: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 'var(--ff-z-hover)', width: 'max-content', maxWidth: 'min(440px, 80vw)',
  background: 'var(--ff-navy)', color: 'var(--ff-white)', fontSize: 12, fontWeight: 400, lineHeight: 1.5, padding: '10px 12px', borderRadius: 8,
  boxShadow: '0 8px 24px var(--ff-shadow-mid)', textAlign: 'left', pointerEvents: 'none'
}
