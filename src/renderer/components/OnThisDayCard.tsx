import React, { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import HoverCard from '../ui/HoverCard'
import type { TodaySummary } from '../../shared/types'
import { MONTHS } from './DateViewParts'
import { quietBtn, doThisBtn } from '../ui/kit'
import { BarsIcon } from '../ui/icons'
import { itemsLabel } from '../../shared/counts'

// A one-line notice at the top of My Flickr: how many photos were taken on today's date in other years. Pointing at
// the text opens a small card with the years, the top tags and a few photos. Quiet: it can be hidden for the day,
// and switched off or on in Settings.

export default function OnThisDayCard({ refreshKey, onOpen }: { refreshKey: number; onOpen: () => void }): React.JSX.Element | null {
  const [s, setS] = useState<TodaySummary | null>(null)
  const [hidden, setHidden] = useState(false)
  const [justTurnedOn, setJustTurnedOn] = useState(false)   // so turning the notification on shows something
  const [peek, setPeek] = useState(false)                   // the hover card
  const [pinned, setPinned] = useState(false)               // clicked open: stays until you click elsewhere or press Esc
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const cueRef = useRef<HTMLButtonElement | null>(null)

  const load = useCallback(() => { void window.flickrAPI.getTodaySummary().then(v => { setS(v); setHidden(v.cardHidden) }) }, [])
  useEffect(() => { load() }, [load, refreshKey])
  // An app left open past midnight, or Settings changed: look again when the window gets focus
  useEffect(() => {
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])
  useEffect(() => () => { if (peekTimer.current) clearTimeout(peekTimer.current) }, [])
  // A pinned card closes on a click elsewhere or Esc
  useEffect(() => {
    if (!pinned) return
    const away = (e: MouseEvent): void => { if (!wrapRef.current?.contains(e.target as Node) && !(e.target as Element).closest?.('[data-hover-card]')) { setPinned(false); setPeek(false) } }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') { setPinned(false); setPeek(false) } }
    document.addEventListener('mousedown', away); window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc) }
  }, [pinned])

  if (!s || !s.cardEnabled || hidden || s.total === 0) return null

  const notifyOn = async (): Promise<void> => {
    await window.flickrAPI.setSettings({ onThisDayNotify: true })
    setJustTurnedOn(true)
    load()
  }
  // The card belongs to the small chart icon only: it opens 0.4 s after pointing at the icon (or on a click), stays
  // while the pointer is on the icon or the card, and closes a moment after the pointer leaves so crossing the gap
  // does not lose it. Clicking the icon keeps it open.
  const openPeek = (): void => { if (peekTimer.current) clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => setPeek(true), 400) }
  const closePeek = (): void => {
    if (pinned) return
    if (peekTimer.current) clearTimeout(peekTimer.current)
    peekTimer.current = setTimeout(() => setPeek(false), 450)
  }
  const togglePin = (): void => { if (peekTimer.current) clearTimeout(peekTimer.current); if (pinned) { setPinned(false); setPeek(false) } else { setPinned(true); setPeek(true) } }

  const range = s.firstYear && s.lastYear && s.firstYear !== s.lastYear ? `${s.firstYear} to ${s.lastYear}` : s.lastYear
  const manyYears = s.yearCount > 1
  const maxYear = Math.max(1, ...s.years.map(y => y.count))
  const date = `${MONTHS[s.month - 1]} ${s.day}`

  return (
    <div style={styles.card} role="status">
      <div style={styles.calendar} aria-hidden="true">
        <div style={styles.calMonth}>{MONTHS[s.month - 1].slice(0, 3).toUpperCase()}</div>
        <div style={styles.calDay}>{s.day}</div>
      </div>

      <div ref={wrapRef} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <span style={styles.title}>On this day: {itemsLabel(s.total, s.videos)}</span>
        <button
          ref={cueRef}
          style={{ ...styles.cue, color: peek ? 'var(--ff-blue)' : 'var(--ff-text-secondary)' }}
          onMouseEnter={openPeek} onMouseLeave={closePeek} onFocus={openPeek} onBlur={closePeek}
          onClick={togglePin}
          aria-label="Show the years, tags and photos for this day" aria-expanded={peek} aria-describedby="otd-peek"
        ><BarsIcon /></button>
        {peek && cueRef.current && (
          <HoverCard anchorEl={cueRef.current} id="otd-peek" label="This day across the years" interactive style={styles.peek} onMouseEnter={() => { if (peekTimer.current) clearTimeout(peekTimer.current) }} onMouseLeave={closePeek}>
            <div style={styles.peekHead}>{date}, across the years</div>
            <div style={styles.peekLine}>
              {manyYears ? `${itemsLabel(s.total, s.videos)} from ${s.yearCount} years, ${range}.` : `${itemsLabel(s.total, s.videos)} from ${range}.`}
              {s.topYear && manyYears ? ` Most active: ${s.topYear.year} (${s.topYear.count.toLocaleString()}).` : ''}
            </div>
            {manyYears && s.years.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={styles.bars}>
                  {s.years.map(y => (
                    <i key={y.year} title={`${y.year}: ${y.count.toLocaleString()}`} style={{ ...styles.bar, height: Math.max(3, (y.count / maxYear) * 40), background: s.topYear?.year === y.year ? 'var(--ff-pink)' : '#e6b0cb' }} />
                  ))}
                </div>
                <div style={styles.barLabels}>
                  {s.years.map(y => <span key={y.year} style={{ width: 18, textAlign: 'center' }}>{y.year.slice(2)}</span>)}
                </div>
              </div>
            )}
            {s.topTags.length > 0 && (
              <div style={styles.chips}>
                {s.topTags.map(t => <span key={t.key} style={styles.chip}>{t.name}<span style={{ marginLeft: 5, fontSize: 12, color: 'var(--ff-text-secondary)' }}>({t.count.toLocaleString()})</span></span>)}
              </div>
            )}
            {s.thumbs.length > 0 && (
              <div style={styles.thumbs}>
                {s.thumbs.slice(0, 3).map(u => <img key={u} src={u} alt="" style={styles.thumb} />)}
              </div>
            )}
            <div style={styles.peekFoot}>{pinned ? 'Click anywhere else, or press Esc, to close this.' : 'Click the icon to keep this open. Click See them to open the whole day.'}</div>
          </HoverCard>
        )}
      </div>

      {justTurnedOn && s.notifyEnabled && <span style={styles.confirmed} title="One macOS notification a day while FlickrFetch is open. Turn it off any time in Settings."><Icon name="bell" /> Daily notification on</span>}
      {!s.notifyEnabled && (
        <button style={styles.bell} onClick={() => void notifyOn()} title="Notify me daily: one macOS notification a day while FlickrFetch is open. You can turn it off in Settings." aria-label="Notify me daily"><Icon name="bell" /></button>
      )}
      <button style={styles.seeBtn} onClick={onOpen}>See them ›</button>
      <button style={styles.hideBtn} onClick={() => { setHidden(true); void window.flickrAPI.hideOnThisDayCardToday() }} title="Hide this notice until tomorrow">Hide for today <Icon name="close" /></button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderLeft: '4px solid var(--ff-blue)', borderRadius: 6, padding: '7px 10px 7px 12px', margin: '10px 24px 8px', position: 'relative' },
  calendar: { width: 34, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: 'var(--ff-surface)', boxShadow: '0 1px 4px color-mix(in srgb, var(--ff-navy) 18%, transparent)', textAlign: 'center' },
  calMonth: { background: 'var(--ff-pink)', color: 'var(--ff-white)', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', padding: '2px 0 1px' },
  calDay: { fontSize: 14, fontWeight: 700, color: 'var(--ff-navy)', lineHeight: '20px' },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--ff-navy)' },
  cue: { marginLeft: 6, display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', background: 'none', border: 'none', padding: 4, borderRadius: 6, cursor: 'pointer' },
  seeBtn: { ...doThisBtn, whiteSpace: 'nowrap' },
  hideBtn: { ...quietBtn, color: 'var(--ff-text)', borderColor: 'var(--ff-line-strong)', whiteSpace: 'nowrap' },
  bell: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 2, lineHeight: 1, opacity: 0.7 },
  confirmed: { fontSize: 12, color: 'var(--ff-success)', whiteSpace: 'nowrap' },
  peek: { width: 470, maxWidth: 'min(470px, calc(100vw - 16px))', borderRadius: 12, padding: '12px 14px', cursor: 'default' },
  peekHead: { fontSize: 13, fontWeight: 700, color: 'var(--ff-navy)' },
  peekLine: { fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 2 },
  bars: { display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 },
  bar: { width: 14, display: 'block', borderRadius: '3px 3px 0 0' },
  barLabels: { display: 'flex', gap: 0, fontSize: 11, color: 'var(--ff-text-secondary)', marginTop: 2 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 5, margin: '10px 0 2px' },
  chip: { background: 'var(--ff-warm)', border: '1px solid var(--ff-border)', borderRadius: 12, padding: '1px 9px', fontSize: 12 },
  thumbs: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 },
  thumb: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, background: 'var(--ff-line-strong)', display: 'block' },
  peekFoot: { fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 8 }
}
