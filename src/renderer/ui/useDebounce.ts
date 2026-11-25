import { useEffect, useRef, useState } from 'react'

// How long the app waits after the last key press before it acts on what was typed, in one place (#92). Before this, the same
// setTimeout and clearTimeout pair was written out by hand in many screens, each with its own number.
export const DEBOUNCE = {
  typing: 200,          // a search box that filters a list
  tags: 250,            // a tag box that filters a list
  dates: 150,           // a date field
  albumSearch: 150,     // the album box suggestions
  flickrSearch: 600     // a search that asks Flickr (slower, so it waits longer)
} as const

/** The value, once it has stopped changing for `ms` milliseconds. With 0 it is the value itself, in the same render: a box that is cleared, or a
 * list that is switched, must not run one more search with the old words. */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return ms === 0 ? value : settled
}

/** Runs `fn` once `ms` after the last change in `deps`: the same wait-then-act that was written out by hand as setTimeout and clearTimeout in an effect.
 * It always runs the latest `fn`, so it sees the newest values. */
export function useDebouncedEffect(fn: () => void, deps: readonly unknown[], ms: number): void {
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    const t = setTimeout(() => latest.current(), ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, ms])
}
