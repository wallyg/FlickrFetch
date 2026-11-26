import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import RichNote from './RichNote'
import { placeCard, anchorXFor, type Placement } from './cardPlacement'

// The one hover card (#228): white, soft shadow, drawn at the very top of the page (in <body>, fixed position, above dialogs), so a scrolling area,
// an overflow: hidden box or the tab bar can never cut it off. It is never drawn inside the control it explains. Where it goes is placeCard()
// in cardPlacement.ts. `text` is RichNote text: one plain line for a short name, or headings and bullets for an explanation.
// Everything that explains itself reaches this one card: HoverCardHost (title= and data-tip), ClickNote (click to open).

export const HOVER_CARD_ID = 'ff-hover-card'

export default function HoverCard({ anchorEl, pointerX, text, children, interactive = false, id = HOVER_CARD_ID, label, style: extra, onMouseEnter, onMouseLeave }: {
  anchorEl: Element
  pointerX?: number | null
  text?: string           // RichNote text; or give `children` for a card with its own content (the On This Day peek)
  children?: React.ReactNode
  interactive?: boolean   // a card you can scroll, select text in and point into (a click note, the peek); a hover card lets the pointer through
  id?: string
  label?: string
  style?: React.CSSProperties   // size and padding for a card with its own content; never its place
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const [place, setPlace] = useState<Placement | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (): void => {
      // Measured at its natural size (see `measuring` below), then placed
      const a = anchorEl.getBoundingClientRect()
      const anchor = { left: a.left, top: a.top, width: a.width, height: a.height }
      setPlace(placeCard(anchor, { width: el.offsetWidth, height: el.scrollHeight }, { width: window.innerWidth, height: window.innerHeight }, anchorXFor(anchor, pointerX)))
    }
    measure()
    // Placed again whenever its own size changes (content arriving, a font loading)
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    if (!interactive) return () => watch.disconnect()
    // A click note stays open while the page moves under it: it follows its button
    window.addEventListener('resize', measure)
    document.addEventListener('scroll', measure, true)
    return () => { watch.disconnect(); window.removeEventListener('resize', measure); document.removeEventListener('scroll', measure, true) }
  }, [anchorEl, pointerX, text, interactive])

  const style: React.CSSProperties = {
    position: 'fixed', zIndex: 'var(--ff-z-hover)', width: 'max-content', maxWidth: 'min(440px, calc(100vw - 16px))',
    boxSizing: 'border-box', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
    background: 'var(--ff-surface)', color: 'var(--ff-text)', border: '1px solid var(--ff-border)', borderRadius: 8,
    boxShadow: '0 8px 24px var(--ff-shadow-mid)', padding: '8px 12px',
    fontSize: 12, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', lineHeight: 1.5, textAlign: 'left',
    pointerEvents: interactive ? 'auto' : 'none', userSelect: interactive ? 'text' : 'none',
    ...extra,
    // Until it has been measured it sits invisibly in the corner, so the measuring never flashes it in the wrong place
    ...(place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: 'hidden' as const })
  }
  return createPortal(
    <div ref={ref} id={id} data-hover-card="" role={interactive ? 'region' : 'tooltip'} aria-label={interactive ? label : undefined} tabIndex={interactive ? -1 : undefined} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children ?? <RichNote text={text ?? ''} />}
    </div>,
    document.body
  )
}
