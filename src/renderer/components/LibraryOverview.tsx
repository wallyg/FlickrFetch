import React, { useEffect, useState } from 'react'
import type { AuditCategory, AuditOverview, HealthCondition, HealthOverview } from '../../shared/types'
import { Counts, RingParts, COLORS, dash, pctLabel } from './DashboardParts'
import type { RingPart } from './DashboardParts'
import { quietBtn, chip } from '../ui/kit'
import { asButton } from '../ui/a11y'
import { ruleById } from '../../shared/cleanupRules'

// The front page of Cleanup: one scorecard per report, the biggest issues across both, and the biggest warnings. Every row is the
// same: name, then tags, then photos. Everything here opens the matching list.

const TAG_NAMES: Record<AuditCategory, string> = {
  glued: 'Names stuck together', typo: 'Possible typos', notwin: 'Accented tags with no plain twin',
  noaccent: 'Plain tags that may need accents', junk: 'Odd characters', runon: 'Run-ons', spelling: 'Typed more than one way',
  usedonce: 'Tags used only once', generic: 'Generic tags', numbers: 'Numbers only', filename: 'File-name tags', missing: 'Photos missing a tag', plural: 'Singular and plural', possessive: 'Possessive on its own'
}
const PHOTO_NAMES = (c: HealthCondition): string => ruleById(`photos:${c}`)?.name ?? c

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
  const [hotTags, setHotTags] = useState<number | null>(null)
  const [hotPhotos, setHotPhotos] = useState<number | null>(null)
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
  const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '0%')
  const tagsOn = audit.byType.filter(r => r.state === 'on')
  const photosOn = health.byType.filter(t => t.state === 'on')
  const tagShare = (n: number): number => (audit.totalTags > 0 ? n / audit.totalTags : 0)
  const photoShare = (n: number): number => (health.photos > 0 ? n / health.photos : 0)
  const tagFine = Math.max(0, audit.totalTags - audit.flaggedTags - audit.optionalTags)
  const photoFine = Math.max(0, health.photos - health.withGap - health.warnOnly)
  const tagRing: RingPart[] = [
    { n: audit.flaggedTags, color: COLORS.open, short: 'issue', fraction: tagShare(audit.flaggedTags), title: `${fmt(audit.flaggedTags)} tags (${pct(audit.flaggedTags, audit.totalTags)}) have an Issue` },
    { n: audit.optionalTags, color: COLORS.warn, short: 'warning', fraction: tagShare(audit.optionalTags), title: `${fmt(audit.optionalTags)} tags (${pct(audit.optionalTags, audit.totalTags)}) have a Warning` },
    { n: tagFine, color: COLORS.fine, short: 'no problems', fraction: tagShare(tagFine), title: `${fmt(tagFine)} tags (${pct(tagFine, audit.totalTags)}) have no problems` }
  ]
  const photoRing: RingPart[] = [
    { n: health.withGap, color: COLORS.open, short: 'issue', fraction: photoShare(health.withGap), title: `${fmt(health.withGap)} photos (${pct(health.withGap, health.photos)}) have an Issue` },
    { n: health.warnOnly, color: COLORS.warn, short: 'warning', fraction: photoShare(health.warnOnly), title: `${fmt(health.warnOnly)} photos (${pct(health.warnOnly, health.photos)}) have only a Warning` },
    { n: photoFine, color: COLORS.fine, short: 'no problems', fraction: photoShare(photoFine), title: `${fmt(photoFine)} photos (${pct(photoFine, health.photos)}) have no problems` }
  ]

  // Every row: a check, how many tags and photos it affects. Biggest first, by photos.
  interface Entry { key: string; label: string; pill: 'tags' | 'photos'; tags?: number; photos: number; open: () => void }
  const tagEntries = (state: 'on' | 'optional'): Entry[] => audit.byType.filter(r => r.state === state && r.open + r.plan > 0)
    .map(r => ({ key: `t|${r.category}`, label: TAG_NAMES[r.category], pill: 'tags' as const, tags: r.open + r.plan, photos: r.photos, open: () => onOpenTags(r.category) }))
  const photoEntries = (state: 'on' | 'optional'): Entry[] => health.byType.filter(t => t.state === state && t.open > 0)
    .map(t => ({ key: `p|${t.condition}`, label: PHOTO_NAMES(t.condition), pill: 'photos' as const, photos: t.open, open: () => onOpenPhotos(t.condition) }))
  const bySize = (a: Entry, b: Entry): number => b.photos - a.photos
  const issues = [...tagEntries('on'), ...photoEntries('on')].sort(bySize)
  const warnings = [...tagEntries('optional'), ...photoEntries('optional')].sort(bySize)
  const shown = more ? issues : issues.slice(0, 5)
  const entryRow = (e: Entry): React.JSX.Element => (
    <div key={e.key} style={dash.item} {...asButton(e.open)}>
      <span>{e.label}<span style={dash.pill}>{e.pill}</span></span>
      <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}><Counts tags={e.tags} photos={e.photos} /></span>
    </div>
  )

  return (
    <div style={dash.wrap}>
      <div style={styles.cards}>
        <div style={styles.score} {...asButton(onGoTags)}>
          <h3 style={dash.cardTitle}>Tags</h3>
          {tagsOn.length === 0 ? <span style={dash.muted}>No tag check is set to Issue.</span> : (
            <div style={dash.ringWrap}>
              <RingParts label={pctLabel(1 - tagShare(audit.flaggedTags))} parts={tagRing} active={hotTags} onActive={setHotTags} />
              <div style={dash.big}><b style={dash.bigNum}>{fmt(audit.flaggedTags)}</b>of {fmt(audit.totalTags)} tags have an Issue<br />{fmt(audit.optionalTags)} more have a Warning</div>
            </div>
          )}
        </div>
        <div style={styles.score} {...asButton(onGoPhotos)}>
          <h3 style={dash.cardTitle}>Photos</h3>
          {!health.hasData ? <span style={dash.muted}>Photo checks need one Rebuild of your library list.</span>
            : photosOn.length === 0 ? <span style={dash.muted}>No photo check is set to Issue.</span> : (
              <div style={dash.ringWrap}>
                <RingParts label={pctLabel(1 - photoShare(health.withGap))} parts={photoRing} active={hotPhotos} onActive={setHotPhotos} />
                <div style={dash.big}><b style={dash.bigNum}>{fmt(health.withGap)}</b>of {fmt(health.photos)} photos have an Issue<br />{fmt(health.warnOnly)} more have a Warning</div>
              </div>
            )}
        </div>
      </div>

      <div style={{ ...dash.card, marginTop: 12 }}>
        <h3 style={dash.cardTitle}>Biggest issues to address <span style={dash.hint}>(by photos affected, tags and photos together; click for the list)</span></h3>
        {issues.length === 0 && <span style={dash.muted}>No issues right now.</span>}
        {shown.map(entryRow)}
        {issues.length > 5 && (
          <button style={{ ...chip, fontSize: 12, padding: '2px 8px', marginTop: 8 }} onClick={() => setMore(m => !m)}>{more ? 'Show fewer' : `Show all ${issues.length}`}</button>
        )}
      </div>

      <div style={{ ...dash.card, marginTop: 12 }}>
        <h3 style={dash.cardTitle}>Biggest warnings to review <span style={dash.hint}>(could be better; these never lower the scores above)</span></h3>
        {warnings.length === 0 && <span style={dash.muted}>Nothing to show.</span>}
        {warnings.map(entryRow)}
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
