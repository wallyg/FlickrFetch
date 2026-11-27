import React, { useCallback, useEffect, useState } from 'react'
import Icon from '../ui/Icon'
import type { TodaySummary } from '../../shared/types'
import { itemsLabel } from '../../shared/counts'
import { linkBtn } from '../ui/kit'

// How On This Day tells you there is something today (#301): a count on its tab, and a small note the first time you
// look each day. Neither takes any room on the screen: the count sits in the tab bar and the note floats over the
// content, then fades by itself. Both can be switched off in Settings.

const LOOK_AGAIN_MS = 5 * 60 * 1000   // a window left open past midnight changes to the new day within minutes
const NOTE_SHOWN_MS = 10_000          // how long the note stays before it fades
const NOTE_FADE_MS = 600

/** Today's summary, read again when a scan finishes, when the window gets focus, and every few minutes. */
export function useTodaySummary(refreshKey: number): TodaySummary | null {
  const [s, setS] = useState<TodaySummary | null>(null)
  const load = useCallback(() => { void window.flickrAPI.getTodaySummary().then(setS).catch(() => { /* keep what is shown */ }) }, [])
  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => {
    window.addEventListener('focus', load)
    const timer = setInterval(load, LOOK_AGAIN_MS)
    return () => { window.removeEventListener('focus', load); clearInterval(timer) }
  }, [load])
  return s
}

/** The number on the tab, or null when today has no photos or the notice is switched off. */
export function todayCount(s: TodaySummary | null): number | null {
  return s && s.cardEnabled && s.total > 0 ? s.total : null
}

/** The sentence for the count's hover card. */
export function todayHint(s: TodaySummary): string {
  return `${itemsLabel(s.total, s.videos)} from this day in past years`
}

/** The count on the On This Day tab. */
export function TabCount({ summary }: { summary: TodaySummary | null }): React.JSX.Element | null {
  const n = todayCount(summary)
  if (n === null || !summary) return null
  return <span style={styles.count} title={todayHint(summary)}>{n.toLocaleString()}</span>
}

/** The note: once a day, over the content, fading after a few seconds. Pointing at it or tabbing into it keeps it. */
export function OnThisDayNote({ summary, onOpen }: { summary: TodaySummary | null; onOpen: () => void }): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false)
  const [fading, setFading] = useState(false)
  const [held, setHeld] = useState(false)
  const date = summary ? `${summary.month}-${summary.day}` : ''
  const due = !!summary && todayCount(summary) !== null && !summary.cardHidden && !dismissed

  // A new day starts a new note
  useEffect(() => { setDismissed(false); setFading(false) }, [date])

  const finish = useCallback((): void => {
    setDismissed(true)
    void window.flickrAPI.hideOnThisDayCardToday()   // once a day: it does not come back until tomorrow
  }, [])

  useEffect(() => {
    if (!due || held) return
    const t1 = setTimeout(() => setFading(true), NOTE_SHOWN_MS)
    const t2 = setTimeout(finish, NOTE_SHOWN_MS + NOTE_FADE_MS)
    return () => { clearTimeout(t1); clearTimeout(t2); setFading(false) }
  }, [due, held, finish])

  if (!due || !summary) return null
  return (
    <div style={styles.anchor}>
      <div
        style={{ ...styles.note, opacity: fading ? 0 : 1 }}
        role="status"
        onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}
      >
        <span style={styles.text}>{todayHint(summary)}</span>
        <button style={styles.see} onClick={() => { finish(); onOpen() }}>See them</button>
        <button style={styles.close} onClick={finish} aria-label="Dismiss until tomorrow" title="Dismiss until tomorrow"><Icon name="close" /></button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  count: { marginLeft: 6, background: 'var(--ff-pink-action)', color: 'var(--ff-white)', borderRadius: 12, padding: '0 6px', fontSize: 11, fontWeight: 700, lineHeight: '16px', display: 'inline-block', verticalAlign: 'middle' },
  anchor: { position: 'relative', height: 0, zIndex: 'var(--ff-z-toast)' as unknown as number },
  note: { position: 'absolute', top: 8, left: 24, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: '6px 8px 6px 12px', boxShadow: '0 2px 8px color-mix(in srgb, var(--ff-navy) 18%, transparent)', transition: `opacity ${NOTE_FADE_MS}ms ease`, maxWidth: 'calc(100vw - 48px)' },
  text: { fontSize: 13, color: 'var(--ff-text)' },
  see: { ...linkBtn, fontSize: 13, whiteSpace: 'nowrap' },
  close: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ff-text-secondary)', display: 'inline-flex', alignItems: 'center' }
}
