import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import RichNote from './RichNote'
import { noteBubble } from './HoverNote'

// A note that opens when you click its button and stays until you click somewhere else, press Escape, or click the button again.
// For long explanations that are read rather than glanced at (Health Check's "How it works"); short notes stay hover (HoverNote, InfoTip).
// It sits under the button, lined up with it, and lines up with the button's right edge instead near the right edge of the window.

export default function ClickNote({ text, children, style, ariaLabel }: { text: string; children: React.ReactNode; style?: React.CSSProperties; ariaLabel: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [flip, setFlip] = useState({ x: false, y: false })
  const wrap = useRef<HTMLSpanElement | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent): void => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  useLayoutEffect(() => {
    const el = bubbleRef.current
    if (!open || !el || !wrap.current) return
    const b = el.getBoundingClientRect()
    const a = wrap.current.getBoundingClientRect()
    setFlip({ x: b.right > window.innerWidth - 8, y: b.bottom > window.innerHeight - 8 && a.top - b.height - 12 > 0 })
  }, [open])

  const toggle = (): void => { setFlip({ x: false, y: false }); setOpen(o => !o) }
  return (
    <span ref={wrap} style={{ position: 'relative', display: 'inline-block' }}>
      <button style={style} aria-label={ariaLabel} aria-expanded={open} aria-controls={open ? id : undefined} onClick={toggle}>{children}</button>
      {open && (
        <div ref={bubbleRef} id={id} role="region" aria-label={ariaLabel} style={{
          ...noteBubble, pointerEvents: 'auto', maxHeight: 'min(60vh, 420px)', overflowY: 'auto', userSelect: 'text',
          ...(flip.x ? { left: 'auto', right: 0 } : {}),
          ...(flip.y ? { top: 'auto', bottom: '100%', marginTop: 0, marginBottom: 6 } : {})
        }}><RichNote text={text} /></div>
      )}
    </span>
  )
}
