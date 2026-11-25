import React, { useEffect, useRef, useState } from 'react'
import { UpIcon } from './icons'

// A small round "back to the top" button. Put it as the LAST child of the element that scrolls: it watches that
// parent, appears once you are a screen or so down, and sits at the bottom right while you scroll.

export default function BackToTop({ after = 500 }: { after?: number }): React.JSX.Element {
  const anchor = useRef<HTMLDivElement | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const scroller = anchor.current?.parentElement
    if (!scroller) return
    const onScroll = (): void => setShow(scroller.scrollTop > after)
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [after])

  return (
    <div ref={anchor} style={{ position: 'sticky', bottom: 16, height: 0, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none', zIndex: 'var(--ff-z-sticky)' }}>
      {show && (
        <button
          aria-label="Back to the top" title="Back to the top"
          onClick={() => anchor.current?.parentElement?.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ pointerEvents: 'auto', transform: 'translateY(-38px)', width: 38, height: 38, borderRadius: '50%', background: 'var(--ff-surface)', border: '1px solid var(--ff-line-strong)', boxShadow: '0 4px 12px var(--ff-shadow-mid)', color: 'var(--ff-navy)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
        ><UpIcon /></button>
      )}
    </div>
  )
}
