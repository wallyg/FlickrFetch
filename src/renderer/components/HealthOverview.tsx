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
const PALETTE = ['#f59e0b', '#0063dc', '#8b5cf6', '#14b8a6', '#ec4899', '#84cc16', '#f97316', '#06b6d4']
const colorOf = (c: HealthCondition): string => PALETTE[HEALTH_CONDITIONS.indexOf(c) % PALETTE.length]
const lightOf = (c: HealthCondition): string => `color-mix(in srgb, ${colorOf(c)} 45%, white)`

export default function HealthOverview({ refreshKey, onOpenList }: { refreshKey: number; onOpenList: (condition: HealthCondition, year?: string) => void }): React.JSX.Element {
  const [data, setData] = useState<Overview | null>(null)
  const [metric, setMetric] = useState<Metric>('anyGap')
  const [hot, setHot] = useState<number | null>(null)   // the ring part under the mouse
  const [more, setMore] = useState(false)               // Best places to start: five, or all
  useEffect(() => { void window.flickrAPI.getHealthOverview().then(setData) }, [refreshKey])

  if (!data) return <div style={dash.wrap}><span style={dash.muted}>Checking your photos…</span></div>
  if (!data.hasData) return <div style={dash.wrap}><span style={dash.muted}>Rebuild your library list first (the data button, top right).</span></div>

  const fmt = (n: number): string => n.toLocaleString()
  const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : '0%')
  const frac = (n: number): number => (data.photos > 0 ? n / data.photos : 0)
  const mk = (n: number, color: string, short: string, legend: string): RingPart =>
    ({ n, color, short, fraction: frac(n), title: `${fmt(n)} photos (${pct(n, data.photos)} of your library): ${legend.toLowerCase()}` })
  const onlyList = data.byType.map(t => t.condition).filter(c => data.onlyOne[c] > 0).sort((a, b) => data.onlyOne[b] - data.onlyOne[a])
  const otherOnly = onlyList.slice(4).reduce((n, c) => n + data.onlyOne[c], 0)
  const ringParts: (RingPart & { legend: string })[] = [
    { ...mk(data.complete, COLORS.fixed, 'complete', 'Complete'), legend: 'Complete' },
    // The four biggest single gaps get their own part of the ring; the rest are one "other" part
    ...onlyList.slice(0, 4).map(c => ({ ...mk(data.onlyOne[c], colorOf(c), `only ${NAMES(c).toLowerCase().slice(0, 14)}`, `Only ${PHRASES(c)}`), legend: `Only ${PHRASES(c)}` })),
    ...(otherOnly > 0 ? [{ ...mk(otherOnly, '#94a3b8', 'one other gap', 'Only one other kind of gap'), legend: 'Only one other kind of gap' }] : []),
    { ...mk(data.twoOrMore, '#ef4444', '2+ gaps', 'Two or more gaps'), legend: 'Two or more gaps' }
  ].filter((g, i) => i === 0 || g.n > 0)
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
            <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
              <div style={dash.big}><b style={dash.bigNum}>{fmt(data.complete)}</b>photos with nothing missing</div>
              <div style={dash.big}><b style={dash.bigNum}>{fmt(data.withGap)}</b>photos with a gap</div>
              {sortedTypes.length > 1 && <div style={dash.big}><b style={dash.bigNum}>{fmt(data.twoOrMore)}</b>missing more than one thing</div>}
            </div>
            <div style={{ ...dash.muted, marginTop: 10 }}>Out of {fmt(data.photos)} photos, counting only the checks set to Issue. Hover the ring to see what it is made of.</div>
          </div>
        </div>
      </div>

      <div style={{ ...dash.card, marginTop: 14 }}>
        <h3 style={dash.cardTitle}>Issues by type <span style={dash.hint}>(each kind of gap, by photos affected; click a row to open its list; hover a bar for numbers)</span></h3>
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
          The dark part of a bar is photos missing only that. The light part is photos that are also missing something else. All bars use one scale: the width is the share of your whole library.
        </div>}
      </div>

      <div style={dash.grid}>
        <div style={dash.card}>
          <h3 style={dash.cardTitle}>Gaps by year taken <span style={dash.hint}>(share of that year's photos; hover a bar; years with under 100 photos left out)</span></h3>
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
          <h3 style={dash.cardTitle}>Biggest Issues to address <span style={dash.hint}>(years where one gap is unusually common; click for its list)</span></h3>
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
          <h3 style={dash.cardTitle}>Warnings to review <span style={dash.hint}>(could be better; never lowers the score above; click a row to open its list)</span></h3>
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
