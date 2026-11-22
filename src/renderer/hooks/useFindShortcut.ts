import { useEffect, type RefObject } from 'react'

// Cmd+F (Ctrl+F on Windows) jumps to a screen's own search box instead of doing nothing. Only the screen that is
// showing (active) answers, so hidden tabs do not steal it.
export function useFindShortcut(active: boolean, ref: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f' && ref.current) {
        e.preventDefault()
        ref.current.focus()
        ref.current.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, ref])
}
