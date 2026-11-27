import React from 'react'
import type { HealthCondition, LibraryStats, Named } from '../../shared/types'
import type { PrivacyFilter } from './PhotoGridShared'
import { BarRow, COLORS, dash } from './DashboardParts'
import { asButton } from '../ui/a11y'
import { ruleById } from '../../shared/cleanupRules'
import { linkBtn, segGroup, segBtn, selectedOn } from '../ui/kit'
import {
  percent, yearInsight, decadeInsight, decadesOf, visibilityInsight, filledInsight, placesInsight, exactInsight, tagsInsight, albumsInsight,
  partsCaptions, shownCount, formatDay, formatMonth, formatHour, formatRange, addDays, lastDayOfMonth, LONG_MONTH_NAMES, DAY_NAME_LIST, type FilledField
} from '../../shared/dashboardInsights'

// The cards of the Health Check dashboard (#220). Each figure is a shortcut: it opens the screen that shows those photos (a view), and from there the
// usual buttons on that screen (Open on Flickr, batch edit) are the way to change them. Cards with nothing to show say nothing.

const fmt = (n: number): string => n.toLocaleString('en-US')
const ALL_FROM = '1900-01-01', ALL_TO = '2999-12-31'

/** Where a click goes. The dashboard's owner (the Health Check panel) fills these in. */
export interface Go {
  range: (from: string, to: string, opts?: { privacy?: PrivacyFilter; media?: 'photo' | 'video' }) => void   // the Photostream on a date range (back comes here)
  tab: (v: 'albums' | 'tags') => void
  album: (id: string, title: string, items: number) => void
  tagPhotos: (tag: string) => void
  map: (lat: number, lon: number) => void
  list: (condition: HealthCondition) => void                                                                // a Photos check's list, to see or fix those items
}

export const unitWord = (stats: LibraryStats): string => (stats.videos > 0 ? 'items' : 'photos')

function Insight({ children, link }: { children: React.ReactNode; link?: { label: string; onClick: () => void } | null }): React.JSX.Element {
  return (
    <div style={styles.insight}>
      {children}{link ? <> <button style={styles.link} onClick={link.onClick}>{link.label}</button></> : null}
    </div>
  )
}

function Card({ title, hint, children, wide, right }: { title: string; hint?: string; children: React.ReactNode; wide?: boolean; right?: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ ...styles.card, ...(wide ? { gridColumn: '1 / -1' } : {}) }} data-card="">
      <div style={styles.head}>
        <h3 style={dash.cardTitle}>{title}{hint ? <span style={dash.hint}> {hint}</span> : null}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}

const Spacer = (): React.JSX.Element => <div style={{ flex: 1, minHeight: 8 }} />

// ── The five totals ───────────────────────────────────────────────────────────────────────────────────────────

export function Totals({ stats, go }: { stats: LibraryStats; go: Go }): React.JSX.Element {
  const years = (d: string): string => d.slice(0, 4)
  const tiles: { label: string; value: string; sub: string; title: string; onClick?: () => void }[] = [
    { label: 'Photos', value: fmt(stats.photos), sub: `${fmt(stats.addedLast12Months)} in the last 12 months`, title: 'Show your photos', onClick: () => go.range(ALL_FROM, ALL_TO, { media: 'photo' }) },
    { label: 'Videos', value: fmt(stats.videos), sub: `${percent(stats.videos, stats.items)} of everything`, title: stats.videos > 0 ? 'Show your videos' : '', onClick: stats.videos > 0 ? () => go.range(ALL_FROM, ALL_TO, { media: 'video' }) : undefined },
    { label: 'Albums', value: fmt(stats.albums), sub: `${fmt(stats.avgItemsPerAlbum)} ${unitWord(stats)} on average`, title: 'Open your albums', onClick: () => go.tab('albums') },
    { label: 'Tags', value: fmt(stats.tags), sub: `${stats.avgTagsPerItem} on each item`, title: 'Open your tags', onClick: () => go.tab('tags') },
    { label: 'Days with photos', value: fmt(stats.daysWithPhotos), sub: stats.records.oldest ? `${years(stats.records.oldest)} to ${years(stats.records.newest)}` : '', title: '' }
  ]
  return (
    <div style={styles.tiles}>
      {tiles.map(t => (
        <div key={t.label} style={{ ...styles.card, ...styles.tile }} data-card="" title={t.title || undefined} {...(t.onClick ? { ...asButton(t.onClick), 'data-row-link': '' } : {})}>
          <span style={styles.tileLabel}>{t.label}</span>
          <b style={styles.tileValue}>{t.value}</b>
          <span style={dash.muted}>{t.sub}</span>
        </div>
      ))}
    </div>
  )
}

// ── Who can see them, what is filled in ───────────────────────────────────────────────────────────────────────

const BLUE_2 = 'color-mix(in srgb, var(--ff-blue) 60%, white)'
const BLUE_3 = 'color-mix(in srgb, var(--ff-blue) 35%, white)'

function Segments({ items, total }: { items: { color: string; n: number; label: string }[]; total: number }): React.JSX.Element {
  return (
    <div style={styles.stack} role="img" aria-label={items.map(i => `${i.label} ${percent(i.n, total)}`).join(', ')}>
      {items.map(i => <i key={i.label} title={`${i.label} ${percent(i.n, total)}`} style={{ display: 'block', height: '100%', width: `${Math.max(0.5, (i.n / Math.max(1, total)) * 100)}%`, background: i.color }} />)}
    </div>
  )
}

function Figure({ color, label, n, total, onClick, title, bar }: { color?: string; label: string; n: number; total: number; onClick?: () => void; title?: string; bar?: boolean }): React.JSX.Element {
  return (
    <div style={styles.figure} title={title} {...(onClick ? { ...asButton(onClick), 'data-row-link': '' } : {})}>
      {color ? <i style={{ ...styles.swatch, background: color }} /> : null}
      <span style={styles.figureBody}>
        <span style={dash.muted}>{label}</span>
        <span><b style={styles.figureValue}>{percent(n, total)}</b><span style={dash.muted}> · {fmt(n)}</span></span>
        {bar ? <span style={styles.thin}><i style={{ display: 'block', height: '100%', width: `${(n / Math.max(1, total)) * 100}%`, background: 'var(--ff-blue)' }} /></span> : null}
      </span>
    </div>
  )
}

export function VisibilityCard({ stats, go }: { stats: LibraryStats; go: Go }): React.JSX.Element {
  const v = stats.visibility, n = stats.items
  const parts = [
    { key: 'public', label: 'Public', n: v.public, color: 'var(--ff-blue)', privacy: 'public' as PrivacyFilter },
    { key: 'ff', label: 'Friends and family', n: v.friendsFamily, color: BLUE_2, privacy: 'friendsFamily' as PrivacyFilter },
    { key: 'one', label: 'Friends or family only', n: v.onlyOne, color: BLUE_3, privacy: undefined },
    { key: 'private', label: 'Private', n: v.private, color: 'var(--ff-navy)', privacy: 'private' as PrivacyFilter }
  ]
  const note = visibilityInsight(stats)
  return (
    <Card title="Who can see them">
      <Segments items={parts} total={n} />
      <div style={styles.figures}>
        {parts.map(p => <Figure key={p.key} color={p.color} label={p.label} n={p.n} total={n} onClick={p.privacy && p.n > 0 ? () => go.range(ALL_FROM, ALL_TO, { privacy: p.privacy }) : undefined} title={p.privacy ? `Show these ${unitWord(stats)}` : 'Friends only and family only are two settings on Flickr, so there is no single view of them'} />)}
      </div>
      <Spacer />
      {note ? <Insight>{note}</Insight> : null}
    </Card>
  )
}

const FIELD_COND: Record<FilledField, HealthCondition> = { title: 'title', tags: 'tags', description: 'description', location: 'location' }
const FIELD_LABEL: Record<FilledField, string> = { title: 'Title', tags: 'Tags', description: 'Description', location: 'Location' }

export function FilledCard({ stats, go }: { stats: LibraryStats; go: Go }): React.JSX.Element {
  const n = stats.items
  const note = filledInsight(stats)
  return (
    <Card title="What is filled in">
      <div style={styles.figures}>
        {(Object.keys(FIELD_LABEL) as FilledField[]).map(f => {
          const missing = n - stats.filled[f]
          return <Figure key={f} label={FIELD_LABEL[f]} n={stats.filled[f]} total={n} bar onClick={missing > 0 ? () => go.list(FIELD_COND[f]) : undefined} title={missing > 0 ? `Show the ${fmt(missing)} ${unitWord(stats)} with no ${f === 'tags' ? 'tags' : f}` : undefined} />
        })}
      </div>
      <Spacer />
      {note ? <Insight link={{ label: `Open the ${(ruleById(`photos:${FIELD_COND[note.field]}`)?.name ?? FIELD_LABEL[note.field]).replace(/^No title, or a camera-file title$/, 'No title')} check`, onClick: () => go.list(FIELD_COND[note.field]) }}>{note.text}</Insight> : null}
    </Card>
  )
}

// ── When ──────────────────────────────────────────────────────────────────────────────────────────────────────

export function YearCard({ stats, go, series, span, onSeries, onSpan, thisYear }: { stats: LibraryStats; go: Go; series: 'taken' | 'uploaded'; span: 'year' | 'decade'; onSeries: (s: 'taken' | 'uploaded') => void; onSpan: (s: 'year' | 'decade') => void; thisYear: number }): React.JSX.Element {
  const linkable = series === 'taken'   // a photo's date taken is what the Photostream can search on
  const word = stats.videos > 0 ? 'Photos and videos' : 'Photos'
  const switches = (
    <span style={styles.switches} data-noprint="">
      <span style={segGroup} role="radiogroup" aria-label="Year or decade">
        {(['year', 'decade'] as const).map(s => <button key={s} role="radio" aria-checked={span === s} style={{ ...segBtn, ...(span === s ? selectedOn : {}) }} onClick={() => onSpan(s)}>{s === 'year' ? 'By year' : 'By decade'}</button>)}
      </span>
      <span style={segGroup} role="radiogroup" aria-label="Which date">
        {(['taken', 'uploaded'] as const).map(s => <button key={s} role="radio" aria-checked={series === s} style={{ ...segBtn, ...(series === s ? selectedOn : {}) }} onClick={() => onSeries(s)}>{s === 'taken' ? 'Taken' : 'Uploaded'}</button>)}
      </span>
    </span>
  )
  const note = span === 'year' ? yearInsight(stats, series, thisYear) : decadeInsight(stats, series, thisYear)
  if (span === 'decade') {
    // Taken: every decade from the first to the last (an empty one shows as empty). Uploaded: only decades that took something in.
    const present = decadesOf(stats, series).filter(d => d.count > 0)
    const first = Number((present[0]?.decade ?? '2000s').slice(0, 4)), last = Number((present[present.length - 1]?.decade ?? '2000s').slice(0, 4))
    const decades = series === 'taken' ? Array.from({ length: (last - first) / 10 + 1 }, (_, i) => { const d = `${first + i * 10}s`; return { decade: d, count: present.find(p => p.decade === d)?.count ?? 0 } }) : present
    const max = Math.max(1, ...decades.map(d => d.count))
    return (
      <Card title={`${word} a decade`} wide right={switches}>
        <div style={styles.decades} role="img" aria-label={`Bars of ${word.toLowerCase()} per decade`}>
          {decades.map(d => (
            <div key={d.decade} style={styles.decadeCol} title={`${d.decade}: ${fmt(d.count)} ${unitWord(stats)}, ${percent(d.count, decades.reduce((a, x) => a + x.count, 0))} of the total${linkable && d.count > 0 ? '. Click to show them.' : ''}`}
              {...(linkable && d.count > 0 ? { ...asButton(() => go.range(`${d.decade.slice(0, 4)}-01-01`, `${Number(d.decade.slice(0, 4)) + 9}-12-31`)), 'data-row-link': '' } : {})}>
              <span style={dash.muted}>{fmt(d.count)}</span>
              <div style={{ width: '100%', height: `${Math.max(1, (d.count / max) * 80)}%`, background: d.count === max ? 'var(--ff-navy)' : 'var(--ff-blue)', borderRadius: '4px 4px 0 0' }} />
            </div>
          ))}
        </div>
        <div style={styles.decadeLabels}>{decades.map(d => <span key={d.decade} style={{ flex: 1, textAlign: 'center' }}>{d.decade}</span>)}</div>
        {note ? <Insight>{note}</Insight> : null}
      </Card>
    )
  }
  // One bar a year; everything before 2000 shares a bar
  const before = stats.years.filter(y => y.year < '2000').reduce((n, y) => n + y[series], 0)
  const bars = [...(before > 0 ? [{ label: 'Before 2000', key: 'before', n: before, from: ALL_FROM, to: '1999-12-31' }] : []),
    ...stats.years.filter(y => y.year >= '2000' && y[series] > 0).map(y => ({ label: y.year, key: y.year, n: y[series], from: `${y.year}-01-01`, to: `${y.year}-12-31` }))]
  const max = Math.max(1, ...bars.map(b => b.n))
  const sumBars = bars.reduce((a, b) => a + b.n, 0)
  return (
    <Card title={`${word} a year`} wide right={switches}>
      <div style={styles.years} role="img" aria-label={`Bars of ${word.toLowerCase()} per year`}>
        {bars.map(b => (
          <div key={b.key} style={{ ...styles.yearBar, height: `${Math.max(2, (b.n / max) * 100)}%`, background: b.n === max ? 'var(--ff-navy)' : 'var(--ff-blue)' }} title={`${b.label}: ${fmt(b.n)} ${unitWord(stats)}, ${percent(b.n, sumBars)} of the total${linkable ? '. Click to show them.' : ''}`}
            {...(linkable ? { ...asButton(() => go.range(b.from, b.to)), 'data-bar-link': '' } : {})} />
        ))}
      </div>
      <div style={styles.axis}><span>{bars[0]?.label}</span><span>{bars[Math.floor(bars.length / 2)]?.label}</span><span>{bars[bars.length - 1]?.label}</span></div>
      {before > 0 ? <div style={{ ...dash.muted, marginBottom: 8 }}>The {fmt(before)} {unitWord(stats)} from before 2000 share one bar.</div> : null}
      {note ? <Insight>{note}</Insight> : null}
    </Card>
  )
}

function MiniBars({ values, labels, title, unit }: { values: number[]; labels: string[]; title: string; unit: string }): React.JSX.Element {
  const max = Math.max(1, ...values)
  const total = values.reduce((a, b) => a + b, 0)
  return (
    <div style={styles.mini} role="img" aria-label={title}>
      {values.map((v, i) => <div key={labels[i]} title={`${labels[i]}: ${fmt(v)} ${unit}, ${percent(v, total)} of those with a date`} style={{ flex: 1, minWidth: 3, height: `${Math.max(1, (v / max) * 100)}%`, background: v === max ? 'var(--ff-navy)' : 'var(--ff-blue)', borderRadius: '3px 3px 0 0' }} />)}
    </div>
  )
}

export function PartsCards({ stats }: { stats: LibraryStats }): React.JSX.Element | null {
  if (stats.months.every(n => n === 0)) return null
  const caps = partsCaptions(stats)
  const hours = Array.from({ length: 24 }, (_, i) => formatHour(i))
  return (
    <>
      <Card title="By month">
        <MiniBars values={stats.months} labels={LONG_MONTH_NAMES} title="Photos by month of the year" unit={unitWord(stats)} />
        <div style={styles.miniAxis}><span>Jan</span><span>Jun</span><span>Dec</span></div>
        <div style={dash.muted}>{caps.month}</div>
      </Card>
      <Card title="By day">
        <MiniBars values={stats.weekdays} labels={DAY_NAME_LIST} title="Photos by day of the week" unit={unitWord(stats)} />
        <div style={styles.miniAxis}><span>Sun</span><span>Wed</span><span>Sat</span></div>
        <div style={dash.muted}>{caps.day}</div>
      </Card>
      <Card title="By time of day">
        <MiniBars values={stats.hours} labels={hours} title="Photos by time of day" unit={unitWord(stats)} />
        <div style={styles.miniAxis}><span>12 am</span><span>12 pm</span><span>11 pm</span></div>
        <div style={dash.muted}>{caps.hour}</div>
      </Card>
    </>
  )
}

export function GuessedNote({ stats, go }: { stats: LibraryStats; go: Go }): React.JSX.Element | null {
  const g = stats.guessed
  if (g.items === 0) return null
  const day = g.biggestDay ? `, such as ${fmt(g.biggestDay.items)} on ${formatDay(g.biggestDay.day)}` : ''
  return (
    <div style={{ ...styles.insight, gridColumn: '1 / -1' }}>
      <b>{fmt(g.items)} {g.items === 1 ? 'item has' : 'items have'} a guessed or placeholder date</b> and {g.items === 1 ? 'is' : 'are'} left out of these date charts{day}. They are still counted everywhere else.{' '}
      <button style={styles.link} onClick={() => go.list('datePlaceholder')}>Open the Placeholder date check</button>
    </div>
  )
}

// ── Where ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function PlacesCard({ stats, go, view, n }: { stats: LibraryStats; go: Go; view: 'countries' | 'states'; n: number }): React.JSX.Element | null {
  const list = view === 'countries' ? stats.places.countries : stats.places.states
  const total = view === 'countries' ? stats.located : stats.places.states.reduce((a, b) => a + b.items, 0)
  const shown = list.slice(0, shownCount(n, list.length))
  const note = placesInsight(stats, view)
  const max = Math.max(1, ...shown.map(s => s.items))
  return (
    <Card title="Top places" hint={view === 'countries' ? 'countries' : 'US states'}>
      {shown.length === 0 ? <span style={dash.muted}>{view === 'states' ? 'No photos in the US have a location.' : 'No photos have a location yet.'}</span> : shown.map(p => (
        <BarRow key={p.name} name={p.name} max={max} squeeze number={<><b>{fmt(p.items)}</b> <span style={dash.muted}>{percent(p.items, total)}</span></>}
          parts={[{ value: p.items, color: 'var(--ff-blue)' }]} title={`${p.name}: ${fmt(p.items)} ${unitWord(stats)}, ${percent(p.items, total)} of ${view === 'countries' ? 'those with a location' : 'those in the US'}${p.lat !== undefined ? '. Click to see it on the Map.' : ''}`} onClick={p.lat !== undefined && p.lon !== undefined ? () => go.map(p.lat as number, p.lon as number) : undefined} />
      ))}
      <Spacer />
      {note ? <Insight>{note} <span style={dash.muted}>Bars use a squeezed scale, so smaller places show.</span></Insight> : null}
    </Card>
  )
}

export function ExactCard({ stats, go }: { stats: LibraryStats; go: Go }): React.JSX.Element | null {
  const p = stats.precision, n = stats.located
  if (n === 0) return null
  const parts = [
    { label: 'Street', n: p.street, color: 'var(--ff-blue)' }, { label: 'Town', n: p.town, color: BLUE_2 },
    { label: 'Vague', n: p.vague, color: BLUE_3 }, { label: 'Not recorded', n: p.none, color: 'var(--ff-fine)' }
  ]
  const note = exactInsight(stats)
  const stray = stats.places.strayAt
  return (
    <Card title="How exact the locations are">
      <Segments items={parts} total={n} />
      <div style={styles.figures}>
        {parts.map(x => <Figure key={x.label} color={x.color} label={x.label} n={x.n} total={n} onClick={x.label === 'Vague' && x.n > 0 ? () => go.list('locVague') : undefined} title={x.label === 'Vague' ? 'Open the Vague location check' : undefined} />)}
      </div>
      <Spacer />
      {note ? <Insight link={note.stray && stray ? { label: 'Show them on the Map', onClick: () => go.map(stray.lat, stray.lon) } : null}>{note.text}</Insight> : null}
    </Card>
  )
}

// ── What is in it ─────────────────────────────────────────────────────────────────────────────────────────────

export function RankedCard({ title, rows, n, kind, stats, go }: { title: string; rows: Named[]; n: number; kind: 'tags' | 'albums'; stats: LibraryStats; go: Go }): React.JSX.Element | null {
  if (rows.length === 0) return <Card title={title}><span style={dash.muted}>{kind === 'albums' ? 'No albums yet.' : 'No tags yet.'}</span></Card>
  const shown = rows.slice(0, shownCount(n, rows.length))
  const max = Math.max(1, ...shown.map(r => r.items))
  const note = kind === 'tags' ? tagsInsight(stats, n) : albumsInsight(stats, n)
  const open = (r: Named): (() => void) | undefined => (kind === 'tags' ? () => go.tagPhotos(r.name) : r.id ? () => go.album(r.id as string, r.name, r.items) : undefined)
  return (
    <Card title={title}>
      {shown.map(r => <BarRow key={`${r.id ?? ''}${r.name}`} name={r.name} max={max} number={<b>{fmt(r.items)}</b>} parts={[{ value: r.items, color: 'var(--ff-blue)' }]} title={`${r.name}: ${fmt(r.items)} ${kind === 'tags' ? `${unitWord(stats)} carry this tag, ${percent(r.items, stats.items)} of your library` : `${unitWord(stats)}, ${percent(r.items, stats.items)} of your library`}${open(r) ? (kind === 'tags' ? '. Click to show them.' : '. Click to open the album.') : ''}`} onClick={open(r)} />)}
      {shown.length < n && rows.length <= n ? <div style={{ ...dash.muted, marginTop: 4 }}>That is all {fmt(rows.length)} {kind === 'albums' ? (rows.length === 1 ? 'album' : 'albums') : (rows.length === 1 ? 'tag' : 'tags')}.</div> : null}
      <Spacer />
      {note ? <Insight link={kind === 'albums' ? { label: 'Open your albums', onClick: () => go.tab('albums') } : { label: 'Open your tags', onClick: () => go.tab('tags') }}>{note}</Insight> : null}
    </Card>
  )
}

// ── Records ───────────────────────────────────────────────────────────────────────────────────────────────────

export function BusiestCard({ stats, go, mode, onMode }: { stats: LibraryStats; go: Go; mode: 'days' | 'months'; onMode: (m: 'days' | 'months') => void }): React.JSX.Element | null {
  const rows = mode === 'days' ? stats.records.days : stats.records.months
  if (stats.records.days.length === 0) return null
  const open = (label: string): (() => void) => (mode === 'days' ? () => go.range(label, label) : () => go.range(`${label}-01`, lastDayOfMonth(label)))
  return (
    <Card title={`Busiest ${mode}`} hint="by date taken" right={
      <span style={segGroup} role="radiogroup" aria-label="Days or months" data-noprint="">
        {(['days', 'months'] as const).map(m => <button key={m} role="radio" aria-checked={mode === m} style={{ ...segBtn, ...(mode === m ? selectedOn : {}) }} onClick={() => onMode(m)}>{m === 'days' ? 'Days' : 'Months'}</button>)}
      </span>
    }>
      {rows.map((r, i) => (
        <div key={r.label} style={styles.record} title={`Show these ${unitWord(stats)}`} {...asButton(open(r.label))} data-row-link="">
          <span><span style={styles.rank}>{i + 1}</span>{mode === 'days' ? formatDay(r.label) : formatMonth(r.label)}</span>
          <span><b>{fmt(r.items)}</b> {unitWord(stats)} <span style={styles.chevron}>›</span></span>
        </div>
      ))}
    </Card>
  )
}

export function MoreRecordsCard({ stats, go }: { stats: LibraryStats; go: Go }): React.JSX.Element | null {
  const r = stats.records
  const u = unitWord(stats)
  const rows: { label: string; value: string; onClick?: () => void }[] = []
  if (r.streak) rows.push({ label: 'Longest streak, taken', value: `${r.streak.days} days in a row, from ${formatDay(r.streak.from)}`, onClick: () => go.range(r.streak!.from, addDays(r.streak!.from, r.streak!.days - 1)) })
  if (r.quiet) rows.push({ label: 'Longest quiet spell, taken', value: `${fmt(r.quiet.days)} days, ${formatRange(r.quiet.from, r.quiet.to)}` })
  if (r.uploadDay) rows.push({ label: 'Biggest upload day', value: `${formatDay(r.uploadDay.day)} · ${fmt(r.uploadDay.items)} ${u}` })
  if (r.burst) rows.push({ label: 'Fastest burst, taken', value: `${fmt(r.burst.items)} ${u} in an hour, ${formatDay(r.burst.hour.slice(0, 10))}, ${formatHour(Number(r.burst.hour.slice(11, 13)))}`, onClick: () => go.range(r.burst!.hour.slice(0, 10), r.burst!.hour.slice(0, 10)) })
  if (r.oldest) rows.push({ label: 'Oldest, taken', value: formatDay(r.oldest), onClick: () => go.range(r.oldest, r.oldest) })
  if (r.newest) rows.push({ label: 'Newest, taken', value: formatDay(r.newest), onClick: () => go.range(r.newest, r.newest) })
  if (rows.length === 0) return null
  return (
    <Card title="More records">
      {rows.map(x => (
        <div key={x.label} style={styles.record} title={x.onClick ? `Show these ${u}` : undefined} {...(x.onClick ? { ...asButton(x.onClick), 'data-row-link': '' } : {})}>
          <span style={dash.muted}>{x.label}</span>
          <span style={styles.recordValue}><b>{x.value}</b>{x.onClick ? <span style={styles.chevron}> ›</span> : null}</span>
        </div>
      ))}
    </Card>
  )
}

export const cardGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }
export const partsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }

const styles: Record<string, React.CSSProperties> = {
  card: { ...dash.card, display: 'flex', flexDirection: 'column' },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 },
  tile: { gap: 2, cursor: 'default' },
  tileLabel: { fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ff-text-secondary)' },
  tileValue: { fontSize: 24, fontWeight: 700, color: 'var(--ff-text)', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' },
  insight: { marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--ff-info-bg)', border: '1px solid var(--ff-info-line)', fontSize: 12, color: 'var(--ff-text)', lineHeight: 1.5 },
  link: { ...linkBtn, fontSize: 12 },
  stack: { display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden', background: 'var(--ff-warm)' },
  figures: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 16px', marginTop: 12 },
  figure: { display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 6, padding: 2 },
  figureBody: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, fontSize: 12 },
  figureValue: { fontSize: 14, color: 'var(--ff-text)' },
  swatch: { width: 10, height: 10, borderRadius: 4, flex: 'none', marginTop: 4 },
  thin: { display: 'block', height: 6, borderRadius: 6, background: 'var(--ff-warm)', overflow: 'hidden' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  switches: { display: 'inline-flex', gap: 8, flexWrap: 'wrap' },
  years: { display: 'flex', alignItems: 'flex-end', gap: 2, height: 130 },
  yearBar: { flex: 1, minWidth: 4, borderRadius: '3px 3px 0 0' },
  axis: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ff-text-secondary)', margin: '4px 0 8px' },
  decades: { display: 'flex', gap: 8, height: 150, alignItems: 'flex-end' },
  decadeCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', fontSize: 11, borderRadius: 6 },
  decadeLabels: { display: 'flex', gap: 8, fontSize: 11, color: 'var(--ff-text-secondary)', margin: '4px 0 8px' },
  mini: { display: 'flex', alignItems: 'flex-end', gap: 2, height: 90, marginTop: 4 },
  miniAxis: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ff-text-secondary)', margin: '2px 0 8px' },
  record: { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 4px', borderTop: '1px solid var(--ff-warm)', fontSize: 13, borderRadius: 6 },
  recordValue: { textAlign: 'right' },
  rank: { display: 'inline-block', width: 18, color: 'var(--ff-text-secondary)' },
  chevron: { color: 'var(--ff-text-secondary)' }
}

// Used by the Health Check front page to colour its rings
export { COLORS }
