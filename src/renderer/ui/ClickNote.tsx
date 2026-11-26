import React, { useEffect, useId, useRef, useState } from 'react'
import HoverCard from './HoverCard'

// A note that opens when you click its button and stays until you click somewhere else, move focus away (Tab), press Escape (focus goes back to
// the button), or click the button again.
// For long explanations that are read rather than glanced at (Health Check's "How it works"); short notes stay hover (HoverNote, InfoTip).
// It is the one hover card (HoverCard), under the button, kept inside the window, and it follows the button when the page scrolls.

const inCard = (t: EventTarget | null): boolean => t instanceof Element && t.closest('[data-hover-card]') !== null

export default function ClickNote({ text, children, style, ariaLabel }: { text: string; children: React.ReactNode; style?: React.CSSProperties; ariaLabel: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent): void => { if (!wrap.current?.contains(e.target as Node) && !inCard(e.target)) setOpen(false) }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <span ref={wrap} style={{ display: 'inline-block' }}
      onBlur={e => { if (!wrap.current?.contains(e.relatedTarget as Node | null) && !inCard(e.relatedTarget)) setOpen(false) }}>
      <button ref={buttonRef} style={style} aria-label={ariaLabel} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(o => !o)}>{children}</button>
      {open && buttonRef.current && <HoverCard anchorEl={buttonRef.current} text={text} interactive id={id} label={ariaLabel} />}
    </span>
  )
}
