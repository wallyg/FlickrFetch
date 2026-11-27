import React, { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { quietBtn } from './kit'

// The "More" button at the end of a screen's action group (#257): the one main action stays out front, everything else is one click away here.
// An item that is plain (label and click) closes the menu; anything else you put inside (an item that has its own note, such as "Open in Flickr's organizer")
// stays as you give it, and the menu stays open while its note is showing, until you click elsewhere or press Esc.
export interface MoreItem { key: string; label: string; onClick: () => void; disabled?: boolean; title?: string }

export default function MoreMenu({ items = [], children, label = 'More' }: { items?: MoreItem[]; children?: React.ReactNode; label?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    const onDown = (e: MouseEvent): void => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown) }
  }, [open])
  return (
    <div ref={wrap} style={{ position: 'relative', display: 'inline-block' }}>
      <button style={{ ...quietBtn, display: 'inline-flex', alignItems: 'center', gap: 4 }} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {label} <Icon name="chevronDown" />
      </button>
      {open && (
        <div role="menu" style={styles.menu}>
          {items.map(it => (
            <button key={it.key} role="menuitem" style={styles.item} disabled={it.disabled} title={it.title} onClick={() => { setOpen(false); it.onClick() }}>{it.label}</button>
          ))}
          {children && <div style={styles.custom}>{children}</div>}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  menu: {
    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 'var(--ff-z-menu)', minWidth: 220,
    background: 'var(--ff-surface)', border: '1px solid var(--ff-line-strong)', borderRadius: 8, boxShadow: '0 4px 16px var(--ff-shadow-soft)', padding: 4,
    display: 'flex', flexDirection: 'column', gap: 2
  },
  item: { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 13, color: 'var(--ff-text)', cursor: 'pointer' },
  custom: { padding: '2px 4px' }
}
