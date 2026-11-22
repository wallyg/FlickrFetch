import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { TodaySummary } from '../../shared/types'
import { MONTHS } from './DateViewParts'
import { quietBtn } from '../ui/kit'
import { BarsIcon } from '../ui/icons'

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
    const away = (e: MouseEvent): void => { if (!wrapRef.current?.contains(e.target as Node)) { setPinned(false); setPeek(false) } }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') { setPinned(false); setPeek(false) } }
    document.addEventListener('mousedown', away); window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc) }
  }, [pinned])

  if (!s || !s.cardEnabled || hidden || s.total === 0) return null

  const notifyOn = async (): Promise<void> => {
    const current = await window.flickrAPI.getSettings()
    await window.flickrAPI.setSettings({ ...current, onThisDayNotify: true })
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
        <span style={styles.title}>On this day: {s.total.toLocaleString()} photo{s.total === 1 ? '' : 's'}</span>
        <button
          style={{ ...styles.cue, color: peek ? 'var(--ff-blue)' : 'var(--ff-text-secondary)' }}
          onMouseEnter={openPeek} onMouseLeave={closePeek} onFocus={openPeek} onBlur={closePeek}
          onClick={togglePin}
          aria-label="Show the years, tags and photos for this day" aria-expanded={peek} aria-describedby="otd-peek"
          title={peek ? undefined : 'Details'}
        ><BarsIcon /></button>
        {peek && (
          <div id="otd-peek" style={styles.peek} role="tooltip" onMouseEnter={() => { if (peekTimer.current) clearTimeout(peekTimer.current) }} onMouseLeave={closePeek}>
            <div style={styles.peekHead}>{date}, across the years</div>
            <div style={styles.peekLine}>
              {manyYears ? `${s.total.toLocaleString()} photos from ${s.yearCount} years, ${range}.` : `${s.total.toLocaleString()} photo${s.total === 1 ? '' : 's'} from ${range}.`}
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
                {s.topTags.map(t => <span key={t.key} style={styles.chip}>{t.name}<span style={{ marginLeft: 5, fontSize: 11.5, color: 'var(--ff-text-secondary)' }}>({t.count.toLocaleString()})</span></span>)}
              </div>
            )}
            {s.thumbs.length > 0 && (
              <div style={styles.thumbs}>
                {s.thumbs.slice(0, 3).map(u => <img key={u} src={u} alt="" style={styles.thumb} />)}
              </div>
            )}
            <div style={styles.peekFoot}>{pinned ? 'Click anywhere else, or press Esc, to close this.' : 'Click the icon to keep this open. Click See them to open the whole day.'}</div>
          </div>
        )}
      </div>

      {justTurnedOn && s.notifyEnabled && <span style={styles.confirmed} title="One macOS notification a day while FlickrFetch is open. Turn it off any time in Settings.">🔔 Daily notification on</span>}
      {!s.notifyEnabled && (
        <button style={styles.bell} onClick={() => void notifyOn()} title="Notify me daily: one macOS notification a day while FlickrFetch is open. You can turn it off in Settings." aria-label="Notify me daily">🔔</button>
      )}
      <button style={styles.seeBtn} onClick={onOpen}>See them ›</button>
      <button style={styles.hideBtn} onClick={() => { setHidden(true); void window.flickrAPI.hideOnThisDayCardToday() }} title="Hide this notice until tomorrow">Hide for today ✕</button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #D8E0EE', borderLeft: '4px solid var(--ff-blue)', borderRadius: 6, padding: '7px 10px 7px 12px', margin: '10px 24px 8px', position: 'relative' },
  calendar: { width: 34, flexShrink: 0, borderRadius: 7, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 4px rgba(27,41,70,0.18)', textAlign: 'center' },
  calMonth: { background: 'var(--ff-pink)', color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', padding: '2px 0 1px' },
  calDay: { fontSize: 15, fontWeight: 700, color: 'var(--ff-navy)', lineHeight: '20px' },
  title: { fontSize: 13.5, fontWeight: 700, color: 'var(--ff-navy)' },
  cue: { marginLeft: 6, display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', background: 'none', border: 'none', padding: 4, borderRadius: 6, cursor: 'pointer' },
  seeBtn: { ...quietBtn, borderColor: 'var(--ff-blue)', color: 'var(--ff-blue)', fontWeight: 600, whiteSpace: 'nowrap' },
  hideBtn: { ...quietBtn, color: '#374151', borderColor: '#C4C9D2', whiteSpace: 'nowrap' },
  bell: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 2, lineHeight: 1, opacity: 0.7 },
  confirmed: { fontSize: 12, color: 'var(--ff-success)', whiteSpace: 'nowrap' },
  peek: { position: 'absolute', left: 0, top: 'calc(100% + 10px)', width: 470, maxWidth: '80vw', background: '#fff', border: '1px solid var(--ff-line-strong)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: '12px 14px', zIndex: 30, cursor: 'default' },
  peekHead: { fontSize: 13, fontWeight: 700, color: 'var(--ff-navy)' },
  peekLine: { fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 2 },
  bars: { display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 },
  bar: { width: 14, display: 'block', borderRadius: '3px 3px 0 0' },
  barLabels: { display: 'flex', gap: 0, fontSize: 10, color: 'var(--ff-text-secondary)', marginTop: 2 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 5, margin: '10px 0 2px' },
  chip: { background: 'var(--ff-warm)', border: '1px solid var(--ff-border)', borderRadius: 14, padding: '1px 9px', fontSize: 12 },
  thumbs: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 },
  thumb: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 7, background: '#ddd', display: 'block' },
  peekFoot: { fontSize: 11.5, color: 'var(--ff-text-secondary)', marginTop: 8 }
}
