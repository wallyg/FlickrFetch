import React, { useEffect, useState } from 'react'
import type { AuditCategory, AuditOverview as Overview } from '../../shared/types'
import { Kpi, BarRow, Legend, Ring, COLORS, dash } from './DashboardParts'

// The dashboard side of the tag audit: how many tags and photos are affected, which problems are
// biggest, and how the clean-up is going. Clicking a row opens that problem's list.

const NAMES: Record<AuditCategory, string> = {
  glued: 'Names stuck together', typo: 'Possible typos', notwin: 'Accented tags with no plain twin',
  noaccent: 'Plain tags that may need accents', junk: 'Odd characters', runon: 'Run-ons', spelling: 'Typed more than one way'
}
const SHORT: Record<AuditCategory, string> = {
  glued: 'Stuck together', typo: 'Typos', notwin: 'No plain twin', noaccent: 'Needs accents', junk: 'Odd characters', runon: 'Run-ons', spelling: 'Spelling'
}

export default function AuditOverview({ refreshKey, onOpenList }: { refreshKey: number; onOpenList: (category: AuditCategory) => void }): React.JSX.Element {
  const [data, setData] = useState<Overview | null>(null)
  useEffect(() => { void window.flickrAPI.getAuditOverview().then(setData) }, [refreshKey])

  if (!data) return <div style={dash.wrap}><span style={dash.muted}>Checking your tags…</span></div>
  if (!data.hasIndex) return <div style={dash.wrap}><span style={dash.muted}>Build your tag list first (on the Browse side).</span></div>

  const fmt = (n: number): string => n.toLocaleString()
  const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '0%')
  const maxTypes = Math.max(1, ...data.byType.map(r => r.open + r.plan + r.fine + r.fixed))
  const maxPhotos = Math.max(1, ...data.byType.map(r => r.photos))
  const sorted = [...data.byType].sort((a, b) => (b.open + b.plan) - (a.open + a.plan))
  const cleanFraction = data.totalTags > 0 ? 1 - data.flaggedTags / data.totalTags : 1
  const worked = data.plan + data.fine + data.fixed

  return (
    <div style={dash.wrap}>
      <div style={dash.kpis}>
        <Kpi value={fmt(data.totalTags)} label="tags in your library" />
        <Kpi value={fmt(data.flaggedTags)} label={`tags flagged (${pct(data.flaggedTags, data.totalTags)}), not counting spelling variants`} />
        <Kpi value={fmt(data.flaggedPhotos)} label={`photos carry a flagged tag (${pct(data.flaggedPhotos, data.totalPhotos)} of ${fmt(data.totalPhotos)})`} />
        <Kpi value={fmt(worked)} label={`worked on: ${fmt(data.fixed)} fixed, ${fmt(data.plan)} in plan, ${fmt(data.fine)} marked fine`} />
      </div>

      <div style={dash.grid}>
        <div style={dash.card}>
          <h3 style={dash.cardTitle}>Problems by type <span style={dash.hint}>(click a row to open its list)</span></h3>
          {sorted.map(r => (
            <BarRow key={r.category} name={NAMES[r.category]} max={maxTypes} number={fmt(r.open + r.plan)} onClick={() => onOpenList(r.category)}
              parts={[
                { value: r.open, color: COLORS.open, title: `${fmt(r.open)} open` },
                { value: r.plan, color: COLORS.plan, title: `${fmt(r.plan)} in plan` },
                { value: r.fine, color: COLORS.fine, title: `${fmt(r.fine)} marked fine` },
                { value: r.fixed, color: COLORS.fixed, title: `${fmt(r.fixed)} fixed` }
              ]} />
          ))}
          <Legend items={[{ label: 'Open', color: COLORS.open }, { label: 'In plan', color: COLORS.plan }, { label: 'Marked fine', color: COLORS.fine }, { label: 'Fixed', color: COLORS.fixed }]} />
        </div>

        <div style={dash.card}>
          <h3 style={dash.cardTitle}>How clean is your tag list?</h3>
          <div style={dash.ringWrap}>
            <Ring fraction={cleanFraction} color={COLORS.fixed} label={`${Math.round(cleanFraction * 100)}%`} />
            <div style={dash.big}>
              <b style={dash.bigNum}>{fmt(data.totalTags - data.flaggedTags)} tags</b>have no flagged problem
              <br /><br />
              <b style={dash.bigNum}>{fmt(data.flaggedTags)} tags</b>to review
            </div>
          </div>
        </div>
      </div>

      <div style={dash.grid}>
        <div style={dash.card}>
          <h3 style={dash.cardTitle}>Biggest single issues <span style={dash.hint}>(by photos affected)</span></h3>
          {data.biggest.length === 0 && <span style={dash.muted}>Nothing flagged.</span>}
          {data.biggest.map(b => (
            <div key={`${b.category}|${b.display}`} style={dash.item} onClick={() => onOpenList(b.category)}>
              <span>{b.display}<span style={dash.pill}>{SHORT[b.category].toLowerCase()}</span></span>
              <span style={dash.muted}>{fmt(b.count)} photo{b.count === 1 ? '' : 's'}</span>
            </div>
          ))}
        </div>
        <div style={dash.card}>
          <h3 style={dash.cardTitle}>Photos affected, by type</h3>
          {sorted.map(r => (
            <BarRow key={r.category} name={SHORT[r.category]} max={maxPhotos} number={fmt(r.photos)} onClick={() => onOpenList(r.category)}
              parts={[{ value: r.photos, color: COLORS.neutral, title: `${fmt(r.photos)} photos` }]} />
          ))}
        </div>
      </div>
    </div>
  )
}
