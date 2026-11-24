import React, { useRef, useState } from 'react'
import RichNote from './RichNote'

// The small (i) that explains something when you point at it. It opens below the icon, or above it when the text
// would run past the bottom of the scrolling area it sits in. Used in Settings.

export default function InfoTip({ text, direction }: { text: string; direction?: 'down' | 'up' }): React.JSX.Element {
  const [show, setShow] = useState(false)
  const [flip, setFlip] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)
  const open = (): void => {
    const el = wrap.current
    if (el) {
      let box: HTMLElement | null = el.parentElement
      while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
      const limit = box ? box.getBoundingClientRect().bottom : window.innerHeight
      const lines = text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 30)), 0)
      const need = lines * 18 + 22
      const r = el.getBoundingClientRect()
      const roomBelow = limit - r.bottom - 8
      const roomAbove = r.top - (box ? box.getBoundingClientRect().top : 0) - 8
      setFlip(roomBelow < need && roomAbove > roomBelow)
    }
    setShow(true)
  }
  const up = direction ? direction === 'up' : flip
  return (
    <div ref={wrap} style={styles.wrap} onMouseEnter={open} onMouseLeave={() => setShow(false)}>
      <div style={styles.icon}>i</div>
      {show && <div style={up ? { ...styles.bubble, top: 'auto', bottom: 'calc(100% + 7px)' } : styles.bubble}><RichNote text={text} /></div>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  icon: { width: '15px', height: '15px', borderRadius: '50%', background: '#ece8e2', color: '#888', fontSize: '9px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', userSelect: 'none' },
  bubble: { position: 'absolute', top: 'calc(100% + 7px)', left: '0', background: '#1a1a1a', color: '#f0ede8', fontSize: '12px', lineHeight: '1.45', padding: '7px 10px', borderRadius: '6px', pointerEvents: 'none', zIndex: 200, width: '300px', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }
}
