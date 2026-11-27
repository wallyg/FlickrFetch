import React, { useEffect, useState } from 'react'
import type { AuditCategory, AuditOverview, HealthCondition, HealthOverview } from '../../shared/types'
import { Ring, COLORS, dash, pctLabel } from './DashboardParts'
import { quietBtn, chip } from '../ui/kit'
import { asButton } from '../ui/a11y'
import { ruleById } from '../../shared/cleanupRules'

// The front page of Cleanup: one scorecard per report (counting only the checks that Need attention), the best
// places to start across all of them, and a summary of the Optional checks. Everything here opens the matching list.

const TAG_NAMES: Record<AuditCategory, string> = {
  glued: 'Names stuck together', typo: 'Possible typos', notwin: 'Accented tags with no plain twin',
  noaccent: 'Plain tags that may need accents', junk: 'Odd characters', runon: 'Run-ons', spelling: 'Typed more than one way',
  usedonce: 'Tags used only once', generic: 'Generic tags', numbers: 'Numbers only', filename: 'File-name tags', missing: 'Photos missing a tag', plural: 'Singular and plural', possessive: 'Possessive on its own'
}
const TAG_SHORT: Record<AuditCategory, string> = {
  glued: 'stuck together', typo: 'typo', notwin: 'no plain twin', noaccent: 'needs accents', junk: 'odd characters', runon: 'run-on', spelling: 'spelling',
  usedonce: 'used once', generic: 'generic', numbers: 'numbers only', filename: 'file name', missing: 'missing a tag', plural: 'singular and plural', possessive: 'possessive on its own'
}
const PHOTO_NAMES = (c: HealthCondition): string => ruleById(`photos:${c}`)?.name ?? c
const PHOTO_PHRASE = (c: HealthCondition): string => ruleById(`photos:${c}`)?.phrase ?? c

interface Props {
  refreshKey: number
  offCount: number
  onGoTags: () => void
  onGoPhotos: () => void
  onOpenTags: (category: AuditCategory) => void
  onOpenPhotos: (condition: HealthCondition, year?: string) => void
  onTune: () => void
}

// The last numbers fetched, by refreshKey, so switching away and back does not read the whole library list again
let lastOverview: { key: number; audit: AuditOverview; health: HealthOverview } | null = null
// Called when a finding is marked fine, planned or put back: the counts and scores change without a new scan
export function forgetOverview(): void { lastOverview = null }

export default function LibraryOverview({ refreshKey, offCount, onGoTags, onGoPhotos, onOpenTags, onOpenPhotos, onTune }: Props): React.JSX.Element {
  const same = lastOverview?.key === refreshKey ? lastOverview : null
  const [audit, setAudit] = useState<AuditOverview | null>(same?.audit ?? null)
  const [health, setHealth] = useState<HealthOverview | null>(same?.health ?? null)
  const [more, setMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (lastOverview?.key === refreshKey) { setAudit(lastOverview.audit); setHealth(lastOverview.health); return }
    let cancelled = false
    setFailed(false)
    void Promise.all([window.flickrAPI.getAuditOverview(), window.flickrAPI.getHealthOverview()]).then(([a, h]) => {
      lastOverview = { key: refreshKey, audit: a, health: h }
      if (!cancelled) { setAudit(a); setHealth(h) }
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [refreshKey, attempt])

  if (!audit || !health) return <div style={dash.wrap}><span style={dash.muted}>{failed ? <>Couldn't load this. <button style={{ background: 'none', border: 'none', color: 'var(--ff-blue)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }} onClick={() => setAttempt(n => n + 1)}>Try again</button></> : 'Checking your library…'}</span></div>

  const fmt = (n: number): string => n.toLocaleString()
  const tagsOn = audit.byType.filter(r => r.state === 'on')
  const photosOn = health.byType.filter(t => t.state === 'on')
  const tagClean = audit.totalTags > 0 ? 1 - audit.flaggedTags / audit.totalTags : 1
  const photoClean = health.photos > 0 ? health.complete / health.photos : 1

  // Best places to start, from both reports, biggest first (by photos affected)
  const starts: { key: string; label: string; pill: string; count: number; open: () => void }[] = [
    ...audit.biggest.map(b => ({ key: `t|${b.category}|${b.display}`, label: b.display, pill: `tags · ${TAG_SHORT[b.category]}`, count: b.count, open: () => onOpenTags(b.category) })),
    ...health.clusters.map(c => ({ key: `p|${c.condition}|${c.year}`, label: `${c.year}: ${PHOTO_PHRASE(c.condition)}`, pill: 'photos', count: c.count, open: () => onOpenPhotos(c.condition, c.year) }))
  ].sort((a, b) => b.count - a.count)
  const shown = more ? starts.slice(0, 12) : starts.slice(0, 5)

  const optionalTags = audit.byType.filter(r => r.state === 'optional' && r.open + r.plan > 0)
  const optionalPhotos = health.byType.filter(t => t.state === 'optional' && t.open > 0)

  return (
    <div style={dash.wrap}>
      <div style={styles.cards}>
        <div style={styles.score} {...asButton(onGoTags)}>
          <h3 style={dash.cardTitle}>Tags</h3>
          {tagsOn.length === 0 ? <span style={dash.muted}>No tag check is set to Issue.</span> : (
            <div style={dash.ringWrap}>
              <Ring fraction={tagClean} color={COLORS.fixed} label={pctLabel(tagClean)} />
              <div style={dash.big}><b style={dash.bigNum}>{fmt(audit.flaggedTags)}</b>of {fmt(audit.totalTags)} tags need attention</div>
            </div>
          )}
        </div>
        <div style={styles.score} {...asButton(onGoPhotos)}>
          <h3 style={dash.cardTitle}>Photos</h3>
          {!health.hasData ? <span style={dash.muted}>Photo checks need one Rebuild of your library list.</span>
            : photosOn.length === 0 ? <span style={dash.muted}>No photo check is set to Issue.</span> : (
              <div style={dash.ringWrap}>
                <Ring fraction={photoClean} color={COLORS.fixed} label={pctLabel(photoClean)} />
                <div style={dash.big}><b style={dash.bigNum}>{fmt(health.withGap)}</b>of {fmt(health.photos)} photos need attention</div>
              </div>
            )}
        </div>
      </div>

      <div style={{ ...dash.card, marginTop: 12 }}>
        <h3 style={dash.cardTitle}>Biggest issues to address <span style={dash.hint}>(by photos affected, across tags and photos; click for the list)</span></h3>
        {starts.length === 0 && <span style={dash.muted}>No issues right now.</span>}
        {shown.map(s => (
          <div key={s.key} style={dash.item} {...asButton(s.open)}>
            <span>{s.label}<span style={dash.pill}>{s.pill}</span></span>
            <span style={dash.muted}>{fmt(s.count)} photo{s.count === 1 ? '' : 's'}</span>
          </div>
        ))}
        {starts.length > 5 && (
          <button style={{ ...chip, fontSize: 12, padding: '2px 8px', marginTop: 8 }} onClick={() => setMore(m => !m)}>{more ? 'Show fewer' : 'Show more'}</button>
        )}
      </div>

      <div style={{ ...dash.card, marginTop: 12 }}>
        <h3 style={dash.cardTitle}>Warnings to review <span style={dash.hint}>(could be better; these never lower the scores above)</span></h3>
        {optionalTags.length + optionalPhotos.length === 0 && <span style={dash.muted}>Nothing to show.</span>}
        {optionalPhotos.map(t => (
          <div key={`p${t.condition}`} style={dash.item} {...asButton(() => onOpenPhotos(t.condition))}>
            <span>{PHOTO_NAMES(t.condition)}<span style={dash.pill}>photos</span></span><b>{fmt(t.open)}</b>
          </div>
        ))}
        {optionalTags.map(r => (
          <div key={`t${r.category}`} style={dash.item} {...asButton(() => onOpenTags(r.category))}>
            <span>{TAG_NAMES[r.category]}<span style={dash.pill}>tags</span></span><b>{fmt(r.open + r.plan)}</b>
          </div>
        ))}
        <div style={{ ...dash.muted, marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {offCount > 0 ? `${offCount} check${offCount === 1 ? ' is' : 's are'} switched off.` : 'Every check is set to Issue or Warning.'}
          <button style={quietBtn} onClick={onTune}>Tune checks…</button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 },
  score: { background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', minWidth: 0 }
}
