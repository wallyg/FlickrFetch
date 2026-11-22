import React, { useEffect, useState } from 'react'
import type { HealthCondition, HealthOverview as Overview } from '../../shared/types'
import { Kpi, BarRow, Ring, COLORS, dash } from './DashboardParts'

// The dashboard side of the metadata health report: how complete the library is, which gaps are
// biggest, how they spread across the years, and where they bunch up.

const NAMES: Record<HealthCondition, string> = {
  title: 'No title, or a camera-file title', description: 'No description', tags: 'No tags', location: 'No location'
}
const PHRASES: Record<HealthCondition, string> = {
  title: 'no title or a camera-file title', description: 'no description', tags: 'no tags', location: 'no location'
}
type Metric = 'anyGap' | HealthCondition
const METRICS: { key: Metric; label: string }[] = [
  { key: 'anyGap', label: 'Any gap' }, { key: 'description', label: 'No description' }, { key: 'location', label: 'No location' },
  { key: 'title', label: 'No title' }, { key: 'tags', label: 'No tags' }
]

export default function HealthOverview({ refreshKey, onOpenList }: { refreshKey: number; onOpenList: (condition: HealthCondition, year?: string) => void }): React.JSX.Element {
  const [data, setData] = useState<Overview | null>(null)
  const [metric, setMetric] = useState<Metric>('anyGap')
  useEffect(() => { void window.flickrAPI.getHealthOverview().then(setData) }, [refreshKey])

  if (!data) return <div style={dash.wrap}><span style={dash.muted}>Checking your photos…</span></div>
  if (!data.hasData) return <div style={dash.wrap}><span style={dash.muted}>Run a Full rescan first (see the Lists side).</span></div>

  const fmt = (n: number): string => n.toLocaleString()
  const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : '0%')
  const share = (e: Overview['byYear'][number]): number => (e.total > 0 ? e[metric] / e.total : 0)
  const reliable = data.byYear.filter(e => e.total >= 100)   // years with fewer photos are left out: their shares would jump around
  const topShare = Math.max(0.0001, ...reliable.map(share))
  const sortedTypes = [...data.byType].sort((a, b) => b.open - a.open)
  const maxType = Math.max(1, ...data.byType.map(t => t.open))

  return (
    <div style={dash.wrap}>
      <div style={dash.kpis}>
        <Kpi value={fmt(data.photos)} label="photos in your library" />
        <Kpi value={fmt(data.complete)} label={`photos with nothing missing (${pct(data.complete, data.photos)})`} />
        <Kpi value={fmt(data.withGap)} label={`photos with at least one gap (${pct(data.withGap, data.photos)})`} />
        <Kpi value={fmt(data.twoOrMore)} label="photos with two or more gaps" />
      </div>

      <div style={dash.grid}>
        <div style={dash.card}>
          <h3 style={dash.cardTitle}>Gaps by type <span style={dash.hint}>(click a row to open its list)</span></h3>
          {sortedTypes.map(t => (
            <BarRow key={t.condition} name={NAMES[t.condition]} max={data.photos} number={fmt(t.open)} onClick={() => onOpenList(t.condition)}
              parts={[{ value: t.open, color: COLORS.open, title: `${fmt(t.open)} of ${fmt(data.photos)} photos` }]} />
          ))}
          <div style={{ ...dash.muted, marginTop: 8 }}>All bars use one scale: the width is the share of your whole library.</div>
        </div>
        <div style={dash.card}>
          <h3 style={dash.cardTitle}>How complete is your library?</h3>
          <div style={dash.ringWrap}>
            <Ring fraction={data.photos > 0 ? data.complete / data.photos : 1} color={COLORS.fixed} label={pct(data.complete, data.photos)} />
            <div style={dash.big}>
              <b style={dash.bigNum}>{fmt(data.complete)}</b>complete
              <br /><br />
              <b style={dash.bigNum}>{fmt(data.withGap)}</b>with a gap
            </div>
          </div>
        </div>
      </div>

      <div style={dash.grid}>
        <div style={dash.card}>
          <h3 style={dash.cardTitle}>By year taken <span style={dash.hint}>(share of that year's photos; hover a bar; years with under 100 photos left out)</span></h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {METRICS.map(m => (
              <button key={m.key} style={{ ...styles.chip, ...(metric === m.key ? styles.chipOn : {}) }} onClick={() => setMetric(m.key)}>{m.label}</button>
            ))}
          </div>
          <div style={styles.years} role="img" aria-label="Bars by year showing the share of photos with the chosen gap">
            {reliable.map(e => (
              <div key={e.year} title={`${e.year}: ${Math.round(share(e) * 100)}% (${fmt(e[metric])} of ${fmt(e.total)})`}
                style={{ ...styles.bar, height: `${Math.max(2, (share(e) / topShare) * 100)}%`, background: share(e) === topShare ? 'var(--ff-pink)' : '#0063dc' }} />
            ))}
          </div>
          <div style={styles.axis}>
            <span>{reliable[0]?.year}</span>
            <span>{reliable[Math.floor(reliable.length / 2)]?.year}</span>
            <span>{reliable[reliable.length - 1]?.year}</span>
          </div>
        </div>
        <div style={dash.card}>
          <h3 style={dash.cardTitle}>Where the gaps cluster <span style={dash.hint}>(click one for its list)</span></h3>
          {data.clusters.length === 0 && <span style={dash.muted}>No year stands out.</span>}
          {data.clusters.map(c => (
            <div key={`${c.condition}|${c.year}`} style={dash.item} onClick={() => onOpenList(c.condition, c.year)}>
              <span>{c.year}: {PHRASES[c.condition]}<div style={dash.muted}>{pct(c.count, c.total)} of that year's photos</div></span>
              <b style={{ whiteSpace: 'nowrap' }}>{fmt(c.count)} photos</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  years: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 130 },
  bar: { flex: 1, minWidth: 4, borderRadius: '3px 3px 0 0' },
  axis: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ff-text-secondary)', marginTop: 4 },
  chip: { border: '1px solid var(--ff-border)', borderRadius: 12, padding: '2px 10px', fontSize: 12, background: '#fff', color: 'var(--ff-text)', cursor: 'pointer' },
  chipOn: { background: 'var(--ff-navy)', borderColor: 'var(--ff-navy)', color: '#fff' }
}
