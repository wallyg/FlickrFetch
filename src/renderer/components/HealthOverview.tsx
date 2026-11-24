import React, { useEffect, useState } from 'react'
import type { HealthCondition, HealthOverview as Overview } from '../../shared/types'
import { BarRow, RingParts, COLORS, dash, pctLabel } from './DashboardParts'
import type { RingPart } from './DashboardParts'
import { asButton } from '../ui/a11y'
import { selectedOn, chip as chipBase } from '../ui/kit'
import { ruleById } from '../../shared/cleanupRules'
import { HEALTH_CONDITIONS } from '../../shared/healthChecks'

// The dashboard side of the metadata health report: how complete the library is, which gaps are
// biggest, how they spread across the years, and where they bunch up.

const NAMES = (c: HealthCondition): string => ruleById(`photos:${c}`)?.name ?? c
const PHRASES = (c: HealthCondition): string => ruleById(`photos:${c}`)?.phrase ?? c
type Metric = 'anyGap' | HealthCondition
// One colour per check, the same everywhere on this page; the light version is for "also missing something else"
// (the golden angle spreads the hues, so neighbouring checks never look alike and every check keeps its own colour)
const colorOf = (c: HealthCondition): string => `hsl(${Math.round((HEALTH_CONDITIONS.indexOf(c) * 137.5 + 38) % 360)} 68% 46%)`
const lightOf = (c: HealthCondition): string => `color-mix(in srgb, ${colorOf(c)} 45%, white)`

export default function HealthOverview({ refreshKey, onOpenList }: { refreshKey: number; onOpenList: (condition: HealthCondition, year?: string) => void }): React.JSX.Element {
  const [data, setData] = useState<Overview | null>(null)
  const [metric, setMetric] = useState<Metric>('anyGap')
  const [hot, setHot] = useState<number | null>(null)   // the ring part under the mouse
  const [more, setMore] = useState(false)               // Best places to start: five, or all
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false   // an older answer arriving after a newer request is ignored
    setFailed(false)
    void window.flickrAPI.getHealthOverview().then(d => { if (!stale) setData(d) }).catch(() => { if (!stale) setFailed(true) })
    return () => { stale = true }
  }, [refreshKey, attempt])

  if (!data) return <div style={dash.wrap}><span style={dash.muted}>{failed ? <>This could not be loaded. <button style={{ background: 'none', border: 'none', color: 'var(--ff-blue)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }} onClick={() => setAttempt(n => n + 1)}>Try again</button></> : 'Checking your photos…'}</span></div>
  if (!data.hasData) return <div style={dash.wrap}><span style={dash.muted}>Rebuild your library list first (the data button, top right).</span></div>

  const fmt = (n: number): string => n.toLocaleString()
  const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : '0%')
  const frac = (n: number): number => (data.photos > 0 ? n / data.photos : 0)
  const mk = (n: number, color: string, short: string, legend: string): RingPart =>
    ({ n, color, short, fraction: frac(n), title: `${fmt(n)} photos (${pct(n, data.photos)} of your library): ${legend.toLowerCase()}` })
  const fineN = Math.max(0, data.photos - data.withGap - data.warnOnly)
  const ringParts: RingPart[] = [
    mk(fineN, COLORS.fixed, 'fine', 'Fine'),
    mk(data.warnOnly, COLORS.warn, 'warning', 'Only a Warning gap'),
    mk(data.withGap, COLORS.open, 'issue', 'An Issue gap')
  ]
  const legend: { color: string; n: number; label: string; detail: string; tip: string }[] = [
    { color: COLORS.open, n: data.withGap, label: 'Issue', detail: pct(data.withGap, data.photos), tip: data.twoOrMore > 0 ? `${fmt(data.twoOrMore)} of these are missing more than one thing` : 'Photos with a gap from a check set to Issue' },
    { color: COLORS.warn, n: data.warnOnly, label: 'Warning', detail: pct(data.warnOnly, data.photos), tip: 'Photos with no Issue, only a gap from a check set to Warning. Warnings never lower the score' },
    { color: COLORS.fixed, n: fineN, label: 'Fine', detail: pct(fineN, data.photos), tip: 'Nothing missing' }
  ]
  const stacked = metric === 'anyGap'   // All gaps: dark = photos with an Issue gap, light = photos with only a Warning gap
  const share = (e: Overview['byYear'][number]): number => (e.total > 0 ? ((metric === 'anyGap' ? e.anyGap : e.by[metric]) + (stacked ? e.warnOnly : 0)) / e.total : 0)
  const reliable = data.byYear.filter(e => e.total >= 100)   // years with fewer photos are left out: their shares would jump around
  const topShare = Math.max(0.0001, ...reliable.map(share))
  const sortedTypes = data.byType.filter(t => t.state === 'on').sort((a, b) => b.open - a.open)
  const optionalTypes = data.byType.filter(t => t.state === 'optional').sort((a, b) => b.open - a.open)
  // Buttons for the four biggest checks; the rest are in a list
  const byBiggest = [...data.byType].sort((a, b) => b.open - a.open).map(t => t.condition)
  const quick = byBiggest.slice(0, 4)
  const rest = byBiggest.slice(4)
  const maxType = Math.max(1, ...data.byType.map(t => t.open))

  const clusters = more ? data.clusters : data.clusters.slice(0, 5)

  return (
    <div style={dash.wrap}>
      <div style={dash.card}>
        <h3 style={dash.cardTitle}>How complete is your library?</h3>
        <div style={dash.ringWrap}>
          <RingParts label={pctLabel(data.photos > 0 ? data.complete / data.photos : 1)} parts={ringParts} active={hot} onActive={setHot} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={dash.big}><b style={{ ...dash.bigNum, display: 'inline', marginRight: 6 }}>{fmt(data.photos)}</b>photos in your library</div>
            <div style={{ marginTop: 8 }}>
              {legend.map(l => (
                <div key={l.label} style={dash.legendRow} title={l.tip}>
                  <i style={{ ...dash.legendSwatch, background: l.color }} />
                  <b>{fmt(l.n)}</b><span>{l.label}</span><span style={dash.muted}>· {l.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...dash.card, marginTop: 14 }}>
        <h3 style={dash.cardTitle}>Issues by type</h3>
        {sortedTypes.length === 0 && <span style={dash.muted}>No check is set to Issue (see Tune checks).</span>}
        {sortedTypes.map(t => {
          const only = data.onlyOne[t.condition]
          return (
            <BarRow key={t.condition} name={NAMES(t.condition)} max={data.photos} number={fmt(t.open)} onClick={() => onOpenList(t.condition)}
              parts={[
                { value: only, color: colorOf(t.condition), title: `${fmt(only)} photos have only this gap` },
                { value: t.open - only, color: lightOf(t.condition), title: `${fmt(t.open - only)} photos have this and something else` }
              ]} />
          )
        })}
        {sortedTypes.length > 1 && <div style={{ ...dash.muted, marginTop: 8 }}>
          Dark: photos missing only that. Light: photos also missing something else. Bar width is the share of your whole library.
        </div>}
      </div>

      <div style={dash.grid}>
        <div style={dash.card}>
          <h3 style={dash.cardTitle}>Gaps by year taken <span style={dash.hint}>(share of that year's photos; years under 100 photos left out)</span></h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <button style={{ ...styles.chip, ...(metric === 'anyGap' ? styles.chipOn : {}) }} onClick={() => setMetric('anyGap')}>All gaps</button>
            {quick.map(c => (
              <button key={c} style={{ ...styles.chip, ...(metric === c ? styles.chipOn : {}) }} onClick={() => setMetric(c)}>{NAMES(c)}</button>
            ))}
            {rest.length > 0 && (
              <select style={{ ...styles.chip, ...(rest.includes(metric as HealthCondition) ? styles.chipOn : {}) }} value={rest.includes(metric as HealthCondition) ? metric : ''} aria-label="Another check"
                onChange={e => { if (e.target.value) setMetric(e.target.value as HealthCondition) }}>
                <option value="">More checks…</option>
                {rest.map(c => <option key={c} value={c}>{NAMES(c)}</option>)}
              </select>
            )}
          </div>
          <div style={styles.years} role="img" aria-label="Bars by year showing the share of photos with the chosen gap">
            {reliable.map(e => {
              const tall = Math.max(2, (share(e) / topShare) * 100)
              if (!stacked) {
                return (
                  <div key={e.year} title={`${e.year}: ${Math.round(share(e) * 100)}% (${fmt(e.by[metric])} of ${fmt(e.total)})`}
                    style={{ ...styles.bar, height: `${tall}%`, background: share(e) === topShare ? 'var(--ff-pink)' : '#0063dc' }} />
                )
              }
              const issueOnly = e.anyGap - e.both
              const parts = issueOnly + e.both + e.warnOnly || 1
              return (
                <div key={e.year} style={{ ...styles.bar, ...styles.stack, height: `${tall}%` }}
                  title={`${e.year}: ${Math.round(share(e) * 100)}% have a gap (${fmt(issueOnly)} with an Issue only, ${fmt(e.both)} with an Issue and warnings, ${fmt(e.warnOnly)} with only warnings, of ${fmt(e.total)} photos)`}>
                  <i style={{ flex: `${(e.warnOnly / parts) * 100} 0 0`, background: STACK.warn, display: 'block' }} />
                  <i style={{ flex: `${(e.both / parts) * 100} 0 0`, background: STACK.both, display: 'block' }} />
                  <i style={{ flex: `${(issueOnly / parts) * 100} 0 0`, background: STACK.issue, display: 'block' }} />
                </div>
              )
            })}
          </div>
          {stacked && (
            <div style={styles.key}>
              <span style={swatch(STACK.issue)} /> Issue only
              <span style={{ ...swatch(STACK.both), marginLeft: 12 }} /> Issue and warnings
              <span style={{ ...swatch(STACK.warn), marginLeft: 12 }} /> Only warnings
            </div>
          )}
          <div style={styles.axis}>
            <span>{reliable[0]?.year}</span>
            <span>{reliable[Math.floor(reliable.length / 2)]?.year}</span>
            <span>{reliable[reliable.length - 1]?.year}</span>
          </div>
        </div>
        <div style={dash.card}>
          <h3 style={dash.cardTitle}>Biggest issues to address <span style={dash.hint}>(years where one gap is unusually common)</span></h3>
          {data.clusters.length === 0 && <span style={dash.muted}>No year stands out.</span>}
          {clusters.map(c => (
            <div key={`${c.condition}|${c.year}`} style={dash.item} {...asButton(() => onOpenList(c.condition, c.year))}>
              <span>{c.year}: {PHRASES(c.condition)}<div style={dash.muted}>{pct(c.count, c.total)} of that year's photos</div></span>
              <b style={{ whiteSpace: 'nowrap' }}>{fmt(c.count)} photos</b>
            </div>
          ))}
          {data.clusters.length > 5 && (
            <button style={{ ...styles.chip, marginTop: 8 }} onClick={() => setMore(m => !m)}>{more ? 'Show fewer' : `Show ${data.clusters.length - 5} more`}</button>
          )}
        </div>
      </div>

      {optionalTypes.length > 0 && (
        <div style={{ ...dash.card, marginTop: 14 }}>
          <h3 style={dash.cardTitle}>Biggest warnings to heed <span style={dash.hint}>(by photos affected; never lowers the score)</span></h3>
          {optionalTypes.map(t => (
            <BarRow key={t.condition} name={NAMES(t.condition)} max={data.photos} number={fmt(t.open)} onClick={() => onOpenList(t.condition)}
              parts={[{ value: t.open, color: 'var(--ff-slate)', title: `${fmt(t.open)} photos` }]} />
          ))}
        </div>
      )}
    </div>
  )
}

const STACK = { issue: '#0063dc', both: '#6a9be8', warn: '#bfd3f6' }   // darker = more serious
const swatch = (c: string): React.CSSProperties => ({ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' })

const styles: Record<string, React.CSSProperties> = {
  years: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 130 },
  bar: { flex: 1, minWidth: 4, borderRadius: '3px 3px 0 0' },
  stack: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  key: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ff-text-secondary)', marginTop: 8 },
  axis: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ff-text-secondary)', marginTop: 4 },
  chip: { ...chipBase, fontSize: 12, padding: '2px 10px' },
  chipOn: { ...selectedOn }
}
