import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PrivacyScope, TimelineDays, TimelineMonths } from '../../shared/types'
import { MONTHS, pad2, ScopeToggle } from './DateViewParts'
import CameraRoll from './CameraRoll'
import TimelineNav, { type Step } from './TimelineNav'
import BackToTop from '../ui/BackToTop'
import { OpenIcon, DownloadIcon, CameraRollIcon } from '../ui/icons'
import { quietBtn, primaryBtn, pillBtn } from '../ui/kit'

// Timeline: every month you took photos, shaded by how many. Click a month to see it day by day; click a day to
// see its photos as a camera roll. A back button says where it goes, and arrows step to the next or previous
// month or day. Built from the local photo list.

interface Props {
  active: boolean
  refreshKey: number
  onOpenRange: (from: string, to: string, publicOnly: boolean) => void
  onDownload: (photos: { id: string; title: string }[], title: string, note: string) => void
  onOpenDay: (month: number, day: number, year: number) => void
  onFullRescan: () => void
}

type Period = { year: number; month: number; day?: number }
type Hover = { year: number; month: number; n: number } | null

const lastDay = (y: number, m: number): number => new Date(y, m, 0).getDate()
const monthKey = (y: number, m: number): number => y * 12 + (m - 1)

export default function TimelinePanel({ active, refreshKey, onOpenRange, onDownload, onOpenDay, onFullRescan }: Props): React.JSX.Element {
  const [scope, setScope] = useState<PrivacyScope>('all')
  const [data, setData] = useState<TimelineMonths | null>(null)
  const [drill, setDrill] = useState<{ year: number; month: number } | null>(null)   // a month is open as a day-by-day calendar
  const [days, setDays] = useState<TimelineDays | null>(null)
  const [roll, setRoll] = useState<Period | null>(null)   // the camera roll is open on a day (or the whole month)
  const [lastOpened, setLastOpened] = useState<{ year: number; month: number } | null>(null)   // outlined when you come back to the grid
  const [hover, setHover] = useState<Hover>(null)
  const reqRef = useRef(0)

  const load = useCallback(async () => {
    const req = ++reqRef.current
    const m = await window.flickrAPI.getTimelineMonths(scope)
    if (req === reqRef.current) setData(m)
  }, [scope])
  useEffect(() => { void load() }, [load, refreshKey])

  useEffect(() => {
    if (!drill) { setDays(null); return }
    let cancelled = false
    void window.flickrAPI.getTimelineDays(drill.year, drill.month, scope).then(d => { if (!cancelled) setDays(d) })
    return () => { cancelled = true }
  }, [drill, scope, refreshKey])

  // Esc steps back one level: camera roll to the calendar, calendar to the months
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (roll) setRoll(null)
      else if (drill) setDrill(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, drill, roll])

  const grid = useMemo(() => {
    const map = new Map<string, number>()
    let max = 1
    const years = new Set<number>()
    const withPhotos: { year: number; month: number }[] = []
    for (const c of data?.cells ?? []) {
      map.set(`${c.year}-${c.month}`, c.count); years.add(c.year); if (c.count > max) max = c.count
      if (c.count > 0) withPhotos.push({ year: c.year, month: c.month })
    }
    withPhotos.sort((a, b) => monthKey(a.year, a.month) - monthKey(b.year, b.month))
    return { map, max, years: [...years].sort((a, b) => b - a), withPhotos }   // newest year first, so the busy recent years are on screen
  }, [data])

  if (!data) return <div style={styles.pad}><span style={styles.muted}>Looking through your photos…</span></div>
  if (!data.hasData) return <div style={styles.pad}><span style={styles.muted}>Build your tag list first (Tags tab). It also keeps the dates the Timeline needs.</span></div>

  const strength = (n: number, max: number): number => (n === 0 ? 0 : 0.14 + 0.86 * Math.sqrt(n / max))
  const shade = (n: number, max: number = grid.max): string => (n === 0 ? '#f1efec' : `rgba(0, 99, 220, ${strength(n, max).toFixed(2)})`)
  const dayMax = Math.max(1, ...(days?.days.map(d => d.count) ?? [1]))   // each month's calendar is shaded against its own busiest day
  const scopeNote = scope === 'public' ? ' (public only)' : scope === 'notpublic' ? ' (not public only)' : ''

  const rangeOf = (p: Period): { from: string; to: string; label: string } => {
    if (p.day) { const d = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`; return { from: d, to: d, label: `${MONTHS[p.month - 1]} ${p.day}, ${p.year}` } }
    return { from: `${p.year}-${pad2(p.month)}-01`, to: `${p.year}-${pad2(p.month)}-${pad2(lastDay(p.year, p.month))}`, label: `${MONTHS[p.month - 1]} ${p.year}` }
  }
  const monthCount = (y: number, m: number): number => grid.map.get(`${y}-${m}`) ?? 0

  const download = async (p: Period): Promise<void> => {
    const r = rangeOf(p)
    const photos = await window.flickrAPI.getDatePhotoIds({ kind: 'range', from: r.from, to: r.to, scope })
    if (photos.length === 0) return
    onDownload(photos, `Timeline, ${r.label}`, `Photos taken in ${r.label}${scopeNote}`)
  }

  const openMonth = (year: number, month: number): void => { setRoll(null); setDrill({ year, month }); setLastOpened({ year, month }) }
  const backToMonths = (): void => { setRoll(null); setDrill(null) }

  // Previous and next month that has photos
  const monthNeighbour = (y: number, m: number, dir: -1 | 1): { year: number; month: number } | null => {
    const k = monthKey(y, m)
    if (dir < 0) { for (let i = grid.withPhotos.length - 1; i >= 0; i--) if (monthKey(grid.withPhotos[i].year, grid.withPhotos[i].month) < k) return grid.withPhotos[i]; return null }
    return grid.withPhotos.find(c => monthKey(c.year, c.month) > k) ?? null
  }
  const monthStep = (y: number, m: number, dir: -1 | 1): Step | null => {
    const n = monthNeighbour(y, m, dir)
    return n ? { label: `${MONTHS[n.month - 1].slice(0, 3)}${n.year !== y ? ` ${n.year}` : ''}`, onClick: () => openMonth(n.year, n.month) } : null
  }

  // The same arrows while a whole month is open as a camera roll: they stay in the camera roll
  const monthRollStep = (y: number, m: number, dir: -1 | 1): Step | null => {
    const n = monthNeighbour(y, m, dir)
    return n ? { label: `${MONTHS[n.month - 1].slice(0, 3)}${n.year !== y ? ` ${n.year}` : ''}`, onClick: () => { openMonth(n.year, n.month); setRoll({ year: n.year, month: n.month }) } } : null
  }

  // Previous and next day that has photos (it crosses into the next or earlier month when the month runs out)
  const dayNeighbour = (r: Period, dir: -1 | 1): { year: number; month: number; day?: number } | null => {
    if (!r.day) return null
    const mine = days && days.year === r.year && days.month === r.month ? days.days.filter(d => d.count > 0).map(d => d.day).sort((a, b) => a - b) : []
    const inMonth = dir < 0 ? [...mine].reverse().find(d => d < (r.day as number)) : mine.find(d => d > (r.day as number))
    if (inMonth) return { year: r.year, month: r.month, day: inMonth }
    const other = monthNeighbour(r.year, r.month, dir)
    return other ? { year: other.year, month: other.month } : null   // day left open: found when that month's days arrive
  }
  const dayStep = (r: Period, dir: -1 | 1): Step | null => {
    const n = dayNeighbour(r, dir)
    if (!n) return null
    const label = n.day ? `${MONTHS[n.month - 1].slice(0, 3)} ${n.day}` : `${MONTHS[n.month - 1].slice(0, 3)} ${n.year}`
    const go = async (): Promise<void> => {
      if (n.day) { setRoll({ year: n.year, month: n.month, day: n.day }); return }
      const d = await window.flickrAPI.getTimelineDays(n.year, n.month, scope)
      const list = d.days.filter(x => x.count > 0).map(x => x.day).sort((a, b) => a - b)
      const day = dir < 0 ? list[list.length - 1] : list[0]
      if (!day) return
      setDrill({ year: n.year, month: n.month }); setLastOpened({ year: n.year, month: n.month })
      setRoll({ year: n.year, month: n.month, day })
    }
    return { label, onClick: () => void go() }
  }

  const rollRange = rangeOf   // same ranges; kept as its own name where the camera roll uses it
  const monthTitle = (y: number, m: number): string => `${MONTHS[m - 1]} ${y}`

  return (
    <div style={styles.wrap}>
      <div style={styles.row}>
        <ScopeToggle scope={data.scope} counts={data.counts} enabled={data.hasCatalog} onChange={s => { setScope(s); setRoll(null) }} />
        {!data.hasCatalog && <span style={styles.muted}>Public and not public need one Rebuild of your library list. <button style={styles.link} onClick={onFullRescan}>Open Health Check</button></span>}
        <span style={{ ...styles.muted, marginLeft: 'auto' }}>{data.total.toLocaleString()} photos{scopeNote} · by date taken</span>
      </div>

      {roll ? (
        <div style={{ marginTop: 10 }}>
          <CameraRoll
            from={rollRange(roll).from}
            to={rollRange(roll).to}
            title={rollRange(roll).label}
            scope={scope}
            onOpenRange={onOpenRange}
            onDownload={onDownload}
            onSeeOnThisDay={roll.day ? () => onOpenDay(roll.month, roll.day as number, roll.year) : null}
            heading={
              <TimelineNav
                backLabel={monthTitle(roll.year, roll.month)}
                onBack={() => setRoll(null)}
                title={rollRange(roll).label}
                prev={roll.day ? dayStep(roll, -1) : monthRollStep(roll.year, roll.month, -1)}
                next={roll.day ? dayStep(roll, 1) : monthRollStep(roll.year, roll.month, 1)}
              />
            }
          />
        </div>
      ) : !drill ? (
        <>
          <div style={{ ...styles.muted, margin: '10px 0 6px', minHeight: 18, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{hover ? <><b style={{ color: 'var(--ff-navy)' }}>{monthTitle(hover.year, hover.month)}</b>: {hover.n.toLocaleString()} photo{hover.n === 1 ? '' : 's'}</> : 'Click a month to see it day by day.'}</span>
            <div style={{ ...styles.key, marginTop: 0, marginLeft: 'auto' }}>
              <span>Fewer</span>
              <span style={{ display: 'inline-flex', gap: 2 }}>
                {[0, 0.05, 0.2, 0.45, 1].map(f => <i key={f} style={{ width: 24, height: 11, borderRadius: 2, display: 'block', background: f === 0 ? '#f1efec' : shade(f * grid.max) }} />)}
              </span>
              <span>More</span>
              <span style={{ marginLeft: 6 }}>Grey means none.</span>
            </div>
          </div>
          <div style={styles.card}>
            <div style={styles.hm}><div />{['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => <div key={i} style={styles.hc}>{m}</div>)}</div>
            {grid.years.map(y => (
              <div key={y} style={styles.hm}>
                <div style={styles.hl}>{y}</div>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                  const n = monthCount(y, m)
                  const came = lastOpened?.year === y && lastOpened.month === m
                  return (
                    <div
                      key={m}
                      title={`${n.toLocaleString()} photo${n === 1 ? '' : 's'}, ${monthTitle(y, m)}`}
                      style={{ height: 18, borderRadius: 3, background: shade(n), cursor: n ? 'pointer' : 'default', outline: came ? '2px solid var(--ff-pink)' : 'none', outlineOffset: 1 }}
                      onMouseEnter={() => setHover({ year: y, month: m, n })}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => { if (n) openMonth(y, m) }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div style={styles.bar}>
            <TimelineNav
              backLabel="Timeline"
              onBack={backToMonths}
              title={monthTitle(drill.year, drill.month)}
              prev={monthStep(drill.year, drill.month, -1)}
              next={monthStep(drill.year, drill.month, 1)}
            />
            <span style={styles.muted}>{monthCount(drill.year, drill.month).toLocaleString()} photo{monthCount(drill.year, drill.month) === 1 ? '' : 's'}{scopeNote}</span>
            <div style={{ flex: 1 }} />
            <button style={styles.pill} title={scope === 'notpublic' ? 'The Photostream cannot show only not-public photos, so this opens every photo from that month' : 'See these in the Photostream'} onClick={() => onOpenRange(rangeOf(drill).from, rangeOf(drill).to, scope === 'public')}><span style={styles.icon}><OpenIcon /></span>{scope === 'notpublic' ? 'Open all in Photostream' : 'Open in Photostream'}</button>
            <button style={styles.pill} onClick={() => setRoll({ year: drill.year, month: drill.month })} title="The month's photos in date order, grouped by day"><span style={styles.icon}><CameraRollIcon /></span>Camera roll</button>
            <button style={{ ...styles.pill, ...styles.primary }} onClick={() => void download(drill)}><DownloadIcon />Download these {monthCount(drill.year, drill.month).toLocaleString()}</button>
          </div>
          <div style={styles.card}>
            <div style={styles.cal}>
              {'SMTWTFS'.split('').map((w, i) => <div key={i} style={styles.hc}>{w}</div>)}
              {Array.from({ length: new Date(drill.year, drill.month - 1, 1).getDay() }, (_, i) => <div key={`b${i}`} />)}
              {Array.from({ length: lastDay(drill.year, drill.month) }, (_, i) => i + 1).map(d => {
                const n = days && days.year === drill.year && days.month === drill.month ? (days.days.find(x => x.day === d)?.count ?? 0) : 0
                return (
                  <div
                    key={d}
                    title={`${n.toLocaleString()} photo${n === 1 ? '' : 's'}, ${MONTHS[drill.month - 1]} ${d}, ${drill.year}`}
                    style={{ height: 46, borderRadius: 6, background: shade(n, dayMax), position: 'relative', padding: '3px 5px', fontSize: 11, color: strength(n, dayMax) > 0.55 ? '#fff' : 'var(--ff-navy)', cursor: n ? 'pointer' : 'default' }}
                    onClick={() => { if (n) setRoll({ year: drill.year, month: drill.month, day: d }) }}
                  >
                    {d}
                    {n > 0 && <b style={{ position: 'absolute', right: 6, bottom: 3, fontSize: 13 }}>{n.toLocaleString()}</b>}
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ ...styles.muted, marginTop: 8 }}>Click a day to see its photos. Each day is shaded against this month's busiest day.</div>
        </div>
      )}

      <BackToTop />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { height: '100%', boxSizing: 'border-box', overflowY: 'auto', padding: '10px 24px 24px' },   // the tab pane is a fixed box, so this panel scrolls inside it
  pad: { padding: '40px 24px' },
  muted: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  link: { background: 'none', border: 'none', color: 'var(--ff-blue)', fontSize: 13, cursor: 'pointer', padding: 0 },
  card: { background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 12, padding: '14px 16px' },
  hm: { display: 'grid', gridTemplateColumns: '44px repeat(12, 1fr)', gap: 3, marginBottom: 3, alignItems: 'center' },
  hl: { fontSize: 11, color: 'var(--ff-text-secondary)' },
  hc: { fontSize: 10, color: 'var(--ff-text-secondary)', textAlign: 'center' },
  cal: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, maxWidth: 560 },
  btn: { ...quietBtn },
  pill: { ...pillBtn },
  icon: { color: 'var(--ff-blue)', display: 'inline-flex' },
  primary: { ...primaryBtn, padding: '4px 12px', fontSize: 12.5 },
  bar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 10px' },
  key: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 10 }
}
