import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import RichNote from './RichNote'
import { noteBubble } from './HoverNote'
import { sideShift } from './noteFit'

// A note that opens when you click its button and stays until you click somewhere else, move focus away (Tab), press Escape (focus goes back to
// the button), or click the button again.
// For long explanations that are read rather than glanced at (Health Check's "How it works"); short notes stay hover (HoverNote, InfoTip).
// It sits under the button, lined up with it, and slides sideways only as far as it must to stay inside the window.

export default function ClickNote({ text, children, style, ariaLabel }: { text: string; children: React.ReactNode; style?: React.CSSProperties; ariaLabel: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [flip, setFlip] = useState({ dx: 0, y: false })
  const wrap = useRef<HTMLSpanElement | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent): void => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  useLayoutEffect(() => {
    const el = bubbleRef.current
    if (!open || !el || !wrap.current) return
    const b = el.getBoundingClientRect()
    const a = wrap.current.getBoundingClientRect()
    setFlip({ dx: sideShift(b.left, b.width, window.innerWidth), y: b.bottom > window.innerHeight - 8 && a.top - b.height - 12 > 0 })
  }, [open])

  const toggle = (): void => { setFlip({ dx: 0, y: false }); setOpen(o => !o) }
  return (
    <span ref={wrap} style={{ position: 'relative', display: 'inline-block' }}
      onBlur={e => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false) }}>
      <button ref={buttonRef} style={style} aria-label={ariaLabel} aria-expanded={open} aria-controls={open ? id : undefined} onClick={toggle}>{children}</button>
      {open && (
        <div ref={bubbleRef} id={id} role="region" tabIndex={-1} aria-label={ariaLabel} style={{
          ...noteBubble, pointerEvents: 'auto', maxHeight: 'min(60vh, 420px)', overflowY: 'auto', userSelect: 'text',
          ...(flip.dx !== 0 ? { left: flip.dx } : {}),
          ...(flip.y ? { top: 'auto', bottom: '100%', marginTop: 0, marginBottom: 6 } : {})
        }}><RichNote text={text} /></div>
      )}
    </span>
  )
}
