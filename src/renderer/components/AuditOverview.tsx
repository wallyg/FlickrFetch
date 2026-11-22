import React, { useEffect, useState } from 'react'
import type { AuditCategory, AuditOverview as Overview } from '../../shared/types'
import { BarRow, Legend, RingParts, COLORS, dash, pctLabel } from './DashboardParts'
import type { RingPart } from './DashboardParts'
import { chip } from '../ui/kit'

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
  const [metric, setMetric] = useState<'tags' | 'photos'>('tags')
  const [more, setMore] = useState(false)
  const [hot, setHot] = useState<number | null>(null)
  useEffect(() => { void window.flickrAPI.getAuditOverview().then(setData) }, [refreshKey])

  if (!data) return <div style={dash.wrap}><span style={dash.muted}>Checking your tags…</span></div>
  if (!data.hasIndex) return <div style={dash.wrap}><span style={dash.muted}>Build your library list first (Tags tab).</span></div>

  const fmt = (n: number): string => n.toLocaleString()
  const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '0%')
  const onRows = data.byType.filter(r => r.state === 'on')
  const optionalRows = data.byType.filter(r => r.state === 'optional')
  const maxTypes = Math.max(1, ...onRows.map(r => r.open + r.plan + r.fine + r.fixed))
  const maxPhotos = Math.max(1, ...onRows.map(r => r.photos))
  const sorted = [...onRows].sort((a, b) => (b.open + b.plan) - (a.open + a.plan))
  const maxOptional = Math.max(1, ...optionalRows.map(r => r.open + r.plan))
  const cleanFraction = data.totalTags > 0 ? 1 - data.flaggedTags / data.totalTags : 1
  const worked = data.plan + data.fine + data.fixed
  const clean = data.totalTags - data.flaggedTags
  const ringParts: RingPart[] = [
    { fraction: cleanFraction, color: COLORS.fixed, n: clean, short: 'tags are fine', title: `${fmt(clean)} tags (${pct(clean, data.totalTags)}) have no flagged problem` },
    { fraction: 1 - cleanFraction, color: COLORS.open, n: data.flaggedTags, short: 'need attention', title: `${fmt(data.flaggedTags)} tags (${pct(data.flaggedTags, data.totalTags)}) need attention` }
  ]
  const biggest = more ? data.biggest : data.biggest.slice(0, 5)

  return (
    <div style={dash.wrap}>
      <div style={dash.card}>
        <h3 style={dash.cardTitle}>How clean is your tag list?</h3>
        <div style={dash.ringWrap}>
          <RingParts label={pctLabel(cleanFraction)} parts={ringParts} active={hot} onActive={setHot} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
              <div style={dash.big}><b style={dash.bigNum}>{fmt(data.totalTags)}</b>tags in your library</div>
              <div style={dash.big}><b style={dash.bigNum}>{fmt(data.flaggedTags)}</b>need attention ({pct(data.flaggedTags, data.totalTags)})</div>
              <div style={dash.big}><b style={dash.bigNum}>{fmt(data.flaggedPhotos)}</b>photos carry one ({pct(data.flaggedPhotos, data.totalPhotos)})</div>
              <div style={dash.big}><b style={dash.bigNum}>{fmt(worked)}</b>worked on: {fmt(data.fixed)} fixed, {fmt(data.plan)} in plan, {fmt(data.fine)} marked fine</div>
            </div>
            <div style={{ ...dash.muted, marginTop: 10 }}>Counts only the checks set to Issue. Warnings are listed further down and never lower this. Hover the ring for the split.</div>
          </div>
        </div>
      </div>

      <div style={{ ...dash.card, marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={dash.cardTitle}>Issues by type <span style={dash.hint}>(each kind of problem, by tags affected; click a row to open its list)</span></h3>
          <div style={dash.seg}>
            {([['tags', 'Tags'], ['photos', 'Photos affected']] as const).map(([k, label]) => (
              <button key={k} style={{ ...dash.segBtn, ...(metric === k ? dash.segOn : {}) }} onClick={() => setMetric(k)}>{label}</button>
            ))}
          </div>
        </div>
        {sorted.length === 0 && <span style={dash.muted}>No check is set to Issue (see Tune checks).</span>}
        {sorted.map(r => metric === 'tags' ? (
          <BarRow key={r.category} name={NAMES[r.category]} max={maxTypes} number={fmt(r.open + r.plan)} onClick={() => onOpenList(r.category)}
            parts={[
              { value: r.open, color: COLORS.open, title: `${fmt(r.open)} open` },
              { value: r.plan, color: COLORS.plan, title: `${fmt(r.plan)} in plan` },
              { value: r.fine, color: COLORS.fine, title: `${fmt(r.fine)} marked fine` },
              { value: r.fixed, color: COLORS.fixed, title: `${fmt(r.fixed)} fixed` }
            ]} />
        ) : (
          <BarRow key={r.category} name={NAMES[r.category]} max={maxPhotos} number={fmt(r.photos)} onClick={() => onOpenList(r.category)}
            parts={[{ value: r.photos, color: COLORS.neutral, title: `${fmt(r.photos)} photos carry a tag with this problem` }]} />
        ))}
        {metric === 'tags'
          ? <Legend items={[{ label: 'Open', color: COLORS.open }, { label: 'In plan', color: COLORS.plan }, { label: 'Marked fine', color: COLORS.fine }, { label: 'Fixed', color: COLORS.fixed }]} />
          : <div style={{ ...dash.muted, marginTop: 8 }}>Photos that carry at least one tag with that problem. A photo can appear under more than one type.</div>}
      </div>

      <div style={{ ...dash.card, marginTop: 14 }}>
        <h3 style={dash.cardTitle}>Biggest Issues to address <span style={dash.hint}>(by photos affected; click for the list)</span></h3>
        {data.biggest.length === 0 && <span style={dash.muted}>Nothing flagged.</span>}
        {biggest.map(b => (
          <div key={`${b.category}|${b.display}`} style={dash.item} onClick={() => onOpenList(b.category)}>
            <span>{b.display}<span style={dash.pill}>{SHORT[b.category].toLowerCase()}</span></span>
            <span style={dash.muted}>{fmt(b.count)} photo{b.count === 1 ? '' : 's'}</span>
          </div>
        ))}
        {data.biggest.length > 5 && (
          <button style={{ ...chip, fontSize: 12, padding: '2px 10px', marginTop: 8 }} onClick={() => setMore(m => !m)}>{more ? 'Show fewer' : `Show ${data.biggest.length - 5} more`}</button>
        )}
      </div>

      {optionalRows.length > 0 && (
        <div style={{ ...dash.card, marginTop: 14 }}>
          <h3 style={dash.cardTitle}>Warnings to review <span style={dash.hint}>(could be better; never lowers the score above; click a row to open its list)</span></h3>
          {optionalRows.map(r => (
            <BarRow key={r.category} name={NAMES[r.category]} max={maxOptional} number={fmt(r.open + r.plan)} onClick={() => onOpenList(r.category)}
              parts={[{ value: r.open + r.plan, color: 'var(--ff-slate)', title: `${fmt(r.open + r.plan)} tags` }]} />
          ))}
        </div>
      )}
    </div>
  )
}
