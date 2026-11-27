import React, { useEffect, useState } from 'react'
import type { AuditCategory, AuditOverview as Overview } from '../../shared/types'
import { BarRow, Legend, RingParts, COLORS, dash, pctLabel } from './DashboardParts'
import type { RingPart } from './DashboardParts'
import { chip } from '../ui/kit'
import { asButton } from '../ui/a11y'

// The dashboard side of the tag audit: how many tags and photos are affected, which problems are
// biggest, and how the clean-up is going. Clicking a row opens that problem's list.

const NAMES: Record<AuditCategory, string> = {
  glued: 'Names stuck together', typo: 'Possible typos', notwin: 'Accented tags with no plain twin',
  noaccent: 'Plain tags that may need accents', junk: 'Odd characters', runon: 'Run-ons', spelling: 'Typed more than one way',
  usedonce: 'Tags used only once', generic: 'Generic tags', numbers: 'Numbers only', filename: 'File-name tags', missing: 'Photos missing a tag', plural: 'Singular and plural', possessive: 'Possessive on its own'
}
const SHORT: Record<AuditCategory, string> = {
  glued: 'Stuck together', typo: 'Typos', notwin: 'No plain twin', noaccent: 'Needs accents', junk: 'Odd characters', runon: 'Run-ons', spelling: 'Spelling',
  usedonce: 'Used once', generic: 'Generic', numbers: 'Numbers only', filename: 'File names', missing: 'Missing a tag', plural: 'Singular and plural', possessive: 'Possessive'
}

export default function AuditOverview({ refreshKey, onOpenList }: { refreshKey: number; onOpenList: (category: AuditCategory) => void }): React.JSX.Element {
  const [data, setData] = useState<Overview | null>(null)
  const [metric, setMetric] = useState<'tags' | 'photos'>('tags')
  const [more, setMore] = useState(false)
  const [moreWarn, setMoreWarn] = useState(false)
  const [hot, setHot] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false   // an older answer arriving after a newer request is ignored
    setFailed(false)
    void window.flickrAPI.getAuditOverview().then(d => { if (!stale) setData(d) }).catch(() => { if (!stale) setFailed(true) })
    return () => { stale = true }
  }, [refreshKey, attempt])

  if (!data) return <div style={dash.wrap}><span style={dash.muted}>{failed ? <>Couldn't load this. <button style={{ background: 'none', border: 'none', color: 'var(--ff-blue)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }} onClick={() => setAttempt(n => n + 1)}>Try again</button></> : 'Checking your tags…'}</span></div>
  if (!data.hasIndex) return <div style={dash.wrap}><span style={dash.muted}>Build your library list first (Tags tab).</span></div>

  const fmt = (n: number): string => n.toLocaleString()
  const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '0%')
  const onRows = data.byType.filter(r => r.state === 'on')
  const optionalRows = data.byType.filter(r => r.state === 'optional')
  const maxTypes = Math.max(1, ...onRows.map(r => r.open + r.plan + r.fine + r.fixed))
  const maxPhotos = Math.max(1, ...onRows.map(r => r.photos))
  const sorted = [...onRows].sort((a, b) => (b.open + b.plan) - (a.open + a.plan))
  const maxOptional = Math.max(1, ...optionalRows.map(r => r.open + r.plan))
  const issue = data.flaggedTags, warn = data.optionalTags, dealt = data.fine + data.fixed
  const fineN = Math.max(0, data.totalTags - issue - warn - dealt)
  const share = (n: number): number => (data.totalTags > 0 ? n / data.totalTags : 0)
  const part = (n: number, color: string, short: string, what: string): RingPart => ({ n, color, short, fraction: share(n), title: `${fmt(n)} tags (${pct(n, data.totalTags)}) ${what}` })
  const ringParts: RingPart[] = [
    part(fineN, COLORS.fixed, 'fine', 'are fine'),
    part(dealt, COLORS.plan, 'dealt with', 'are dealt with: marked fine or fixed'),
    part(warn, COLORS.warn, 'warning', 'have a Warning'),
    part(issue, COLORS.open, 'issue', 'have an Issue')
  ]
  const legend: { color: string; n: number; label: string; detail: string; tip: string }[] = [
    { color: COLORS.open, n: issue, label: 'Issue', detail: `${pct(issue, data.totalTags)} · ${fmt(data.flaggedPhotos)} photos`, tip: data.plan > 0 ? `${fmt(data.plan)} of these are already in your plan` : 'Tags that need attention' },
    { color: COLORS.warn, n: warn, label: 'Warning', detail: `${pct(warn, data.totalTags)} · ${fmt(data.optionalPhotos)} photos`, tip: 'Warnings never lower the score' },
    { color: COLORS.plan, n: dealt, label: 'Dealt with', detail: '', tip: `${fmt(data.fine)} marked fine, ${fmt(data.fixed)} fixed on Flickr` },
    { color: COLORS.fixed, n: fineN, label: 'Fine', detail: '', tip: 'No problem found' }
  ]
  const biggest = more ? data.biggest : data.biggest.slice(0, 5)

  return (
    <div style={dash.wrap}>
      <div style={dash.card}>
        <h3 style={dash.cardTitle}>How clean is your tag list?</h3>
        <div style={dash.ringWrap}>
          <RingParts label={pctLabel(1 - share(issue))} parts={ringParts} active={hot} onActive={setHot} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={dash.big}><b style={{ ...dash.bigNum, display: 'inline', marginRight: 6 }}>{fmt(data.totalTags)}</b>tags in your library</div>
            <div style={{ marginTop: 8 }}>
              {legend.map(l => (
                <div key={l.label} style={dash.legendRow} title={l.tip}>
                  <i style={{ ...dash.legendSwatch, background: l.color }} />
                  <b>{fmt(l.n)}</b><span>{l.label}</span>{l.detail && <span style={dash.muted}>· {l.detail}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...dash.card, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={dash.cardTitle}>Issues by type</h3>
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
            parts={[{ value: r.photos, color: COLORS.neutral, title: r.category === 'missing' ? `${fmt(r.photos)} photos may be missing a tag` : `${fmt(r.photos)} photos carry a tag with this problem` }]} />
        ))}
        {metric === 'tags'
          ? <Legend items={[{ label: 'Open', color: COLORS.open }, { label: 'In plan', color: COLORS.plan }, { label: 'Marked fine', color: COLORS.fine }, { label: 'Fixed', color: COLORS.fixed }]} />
          : <div style={{ ...dash.muted, marginTop: 8 }}>Photos that carry at least one tag with that problem. A photo can appear under more than one type.</div>}
      </div>

      <div style={{ ...dash.card, marginTop: 12 }}>
        <h3 style={dash.cardTitle}>Biggest issues to address <span style={dash.hint}>(by photos affected)</span></h3>
        {data.biggest.length === 0 && <span style={dash.muted}>Nothing flagged.</span>}
        {biggest.map(b => (
          <div key={`${b.category}|${b.display}`} style={dash.item} {...asButton(() => onOpenList(b.category))}>
            <span>{b.display}<span style={dash.pill}>{SHORT[b.category].toLowerCase()}</span></span>
            <span style={dash.muted}>{fmt(b.count)} photo{b.count === 1 ? '' : 's'}</span>
          </div>
        ))}
        {data.biggest.length > 5 && (
          <button style={{ ...chip, fontSize: 12, padding: '2px 8px', marginTop: 8 }} onClick={() => setMore(m => !m)}>{more ? 'Show fewer' : `Show ${data.biggest.length - 5} more`}</button>
        )}
      </div>

      {data.biggestWarnings.length > 0 && (
        <div style={{ ...dash.card, marginTop: 12 }}>
          <h3 style={dash.cardTitle}>Biggest warnings to heed <span style={dash.hint}>(by photos affected)</span></h3>
          {(moreWarn ? data.biggestWarnings : data.biggestWarnings.slice(0, 5)).map(b => (
            <div key={`${b.category}|${b.display}`} style={dash.item} {...asButton(() => onOpenList(b.category))}>
              <span>{b.display}<span style={dash.pill}>{SHORT[b.category].toLowerCase()}</span></span>
              <span style={dash.muted}>{fmt(b.count)} photo{b.count === 1 ? '' : 's'}</span>
            </div>
          ))}
          {data.biggestWarnings.length > 5 && (
            <button style={{ ...chip, fontSize: 12, padding: '2px 8px', marginTop: 8 }} onClick={() => setMoreWarn(m => !m)}>{moreWarn ? 'Show fewer' : `Show ${data.biggestWarnings.length - 5} more`}</button>
          )}
        </div>
      )}

      {optionalRows.length > 0 && (
        <div style={{ ...dash.card, marginTop: 12 }}>
          <h3 style={dash.cardTitle}>Warnings by type <span style={dash.hint}>(never lowers the score)</span></h3>
          {optionalRows.map(r => (
            <BarRow key={r.category} name={NAMES[r.category]} max={maxOptional} number={fmt(r.open + r.plan)} onClick={() => onOpenList(r.category)}
              parts={[{ value: r.open + r.plan, color: 'var(--ff-slate)', title: `${fmt(r.open + r.plan)} tags` }]} />
          ))}
        </div>
      )}
    </div>
  )
}
