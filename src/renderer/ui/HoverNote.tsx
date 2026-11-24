import React, { useId, useState } from 'react'
import RichNote from './RichNote'

// A wider tooltip for long explanations: it appears at once (the browser's own tooltip waits a second and cannot wrap long text well),
// stays inside a readable width, keeps line breaks, and opens from the keyboard too (Tab to the control, or to the small mark).
// Wrap the thing that explains itself. By default a small (i) is added after it; with mark={false} the wrapped control itself
// (a button, a group of tabs) opens the note. block = the wrapper fills its row.

export default function HoverNote({ text, children, block, mark = true }: { text?: string; children?: React.ReactNode; block?: boolean; mark?: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!text) return <>{children}</>
  return (
    <span style={{ position: 'relative', display: block ? 'block' : 'inline-block' }}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}>
      {children}
      {mark && <span tabIndex={0} role="button" aria-label="How this works" style={{ marginLeft: 4, color: 'var(--ff-text-muted)', cursor: 'help', fontWeight: 400 }}>ⓘ</span>}
      {open && <span id={id} role="tooltip" style={bubble}><RichNote text={text} /></span>}
    </span>
  )
}

const bubble: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 40, width: 'max-content', maxWidth: 'min(440px, 80vw)',
  background: 'var(--ff-navy)', color: '#fff', fontSize: 12, fontWeight: 400, lineHeight: 1.5, padding: '10px 12px', borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.25)', textAlign: 'left', pointerEvents: 'none'
}
