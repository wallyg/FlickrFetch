import React, { useEffect, useState } from 'react'
import type { AuditCategory, AuditOverview as Overview } from '../../shared/types'
import { BarRow, Counts, RingParts, StatusLegend, COLORS, dash, pctLabel } from './DashboardParts'
import type { RingPart, StatusRow } from './DashboardParts'

// The dashboard side of the tag audit: how many tags and photos are affected, and which problems are biggest.
// Clicking a row opens that problem's list. Every list is the same row: name, bar, tags, photos (#220).

const NAMES: Record<AuditCategory, string> = {
  glued: 'Names stuck together', typo: 'Possible typos', notwin: 'Accented tags with no plain twin',
  noaccent: 'Plain tags that may need accents', junk: 'Odd characters', runon: 'Run-ons', spelling: 'Typed more than one way',
  usedonce: 'Tags used only once', generic: 'Generic tags', numbers: 'Numbers only', filename: 'File-name tags', missing: 'Photos missing a tag', plural: 'Singular and plural', possessive: 'Possessive on its own'
}

export default function AuditOverview({ refreshKey, onOpenList }: { refreshKey: number; onOpenList: (category: AuditCategory) => void }): React.JSX.Element {
  const [data, setData] = useState<Overview | null>(null)
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
  const tagsOf = (r: Overview['byType'][number]): number => r.open + r.plan
  const onRows = data.byType.filter(r => r.state === 'on' && tagsOf(r) > 0).sort((a, b) => tagsOf(b) - tagsOf(a))
  const optionalRows = data.byType.filter(r => r.state === 'optional' && tagsOf(r) > 0).sort((a, b) => tagsOf(b) - tagsOf(a))
  const issue = data.flaggedTags, warn = data.optionalTags
  const fineN = Math.max(0, data.totalTags - issue - warn)   // includes the tags you marked fine
  const issueP = data.flaggedPhotos, warnP = data.optionalPhotos
  const fineP = Math.max(0, data.totalPhotos - issueP - warnP)   // each photo is counted once, under its worst
  const share = (n: number): number => (data.totalTags > 0 ? n / data.totalTags : 0)
  const part = (n: number, color: string, short: string, what: string): RingPart => ({ n, color, short, fraction: share(n), title: `${fmt(n)} tags (${pct(n, data.totalTags)}) ${what}` })
  const ringParts: RingPart[] = [
    part(issue, COLORS.open, 'issue', 'have an Issue'),
    part(warn, COLORS.warn, 'warning', 'have a Warning'),
    part(fineN, COLORS.fine, 'no problems', 'have no problems')
  ]
  const legend: StatusRow[] = [
    { color: COLORS.open, label: 'Issue', tags: issue, photos: issueP, share: pct(issue, data.totalTags), tip: data.plan > 0 ? `${fmt(data.plan)} of these tags are already in your plan` : 'Tags that need attention' },
    { color: COLORS.warn, label: 'Warning', tags: warn, photos: warnP, share: pct(warn, data.totalTags), tip: 'Warnings never lower the score' },
    { color: COLORS.fine, label: 'No problems', tags: fineN, photos: fineP, share: pct(fineN, data.totalTags), tip: data.fine > 0 ? `Includes ${fmt(data.fine)} tags you marked fine` : 'No problem found' }
  ]
  const maxOn = Math.max(1, ...onRows.map(tagsOf))
  const maxOptional = Math.max(1, ...optionalRows.map(tagsOf))

  return (
    <div style={dash.wrap}>
      <div style={dash.card}>
        <h3 style={dash.cardTitle}>How clean is your tag list?</h3>
        <div style={dash.ringWrap}>
          <RingParts label={pctLabel(1 - share(issue))} parts={ringParts} active={hot} onActive={setHot} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={dash.big}><b style={{ ...dash.bigNum, display: 'inline', marginRight: 6 }}>{fmt(data.totalTags)}</b>tags in your library</div>
            <StatusLegend rows={legend} withTags />
            <div style={{ ...dash.muted, marginTop: 8 }}>Each photo is counted once, under its worst.{data.fine > 0 ? ` "No problems" includes ${fmt(data.fine)} tags you marked fine.` : ''}</div>
          </div>
        </div>
      </div>

      <div style={{ ...dash.card, marginTop: 12 }}>
        <h3 style={dash.cardTitle}>Issues by type</h3>
        {onRows.length === 0 && <span style={dash.muted}>No check is set to Issue, or nothing was found (see Tune checks).</span>}
        {onRows.map(r => (
          <BarRow key={r.category} name={NAMES[r.category]} max={maxOn} squeeze number={<Counts tags={tagsOf(r)} photos={r.photos} />} onClick={() => onOpenList(r.category)}
            parts={[{ value: tagsOf(r), color: COLORS.open, title: `${fmt(tagsOf(r))} tags` }]} />
        ))}
        {onRows.length > 1 && <div style={{ ...dash.muted, marginTop: 8 }}>Bar length is tags, on a squeezed scale so small rows stay visible. Compare the numbers, not the bars.</div>}
      </div>

      {optionalRows.length > 0 && (
        <div style={{ ...dash.card, marginTop: 12 }}>
          <h3 style={dash.cardTitle}>Warnings by type <span style={dash.hint}>(never lowers the score)</span></h3>
          {optionalRows.map(r => (
            <BarRow key={r.category} name={NAMES[r.category]} max={maxOptional} squeeze number={<Counts tags={tagsOf(r)} photos={r.photos} />} onClick={() => onOpenList(r.category)}
              parts={[{ value: tagsOf(r), color: COLORS.warn, title: `${fmt(tagsOf(r))} tags` }]} />
          ))}
        </div>
      )}
    </div>
  )
}
