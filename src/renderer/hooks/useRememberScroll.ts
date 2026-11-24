import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

// Screens that are hidden (not removed) when you click to another tab keep their filters and choices, but the browser forgets how far a list
// was scrolled once its pane is hidden. This remembers the scroll position of every scrolling box under `ref` while it is on screen and puts it
// back whenever `key` changes (the tab you are on), so each screen is as you left it.
export function useRememberScroll(ref: RefObject<HTMLElement | null>, key: string): void {
  const saved = useRef(new Map<Element, number>())
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const remember = (e: Event): void => {
      const box = e.target
      if (box instanceof Element && root.contains(box)) saved.current.set(box, box.scrollTop)
    }
    root.addEventListener('scroll', remember, true)   // scroll does not bubble, so listen on the way down
    return () => root.removeEventListener('scroll', remember, true)
  }, [ref])
  useLayoutEffect(() => {
    saved.current.forEach((top, box) => {
      if (!box.isConnected) saved.current.delete(box)
      else if (box.scrollTop !== top) box.scrollTop = top
    })
  }, [key])
}
