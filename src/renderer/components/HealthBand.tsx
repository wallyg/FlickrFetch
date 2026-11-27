import React, { useState } from 'react'
import type { AlbumSummary, AuditOverview, HealthOverview } from '../../shared/types'
import { RingParts, COLORS, dash, pctLabel } from './DashboardParts'
import type { RingPart } from './DashboardParts'
import { asButton } from '../ui/a11y'
import { percent } from '../../shared/dashboardInsights'

// The top of the Health Check front page: one card each for Tags, Photos and Albums. A ring, and the three groups it is made of with their counts and
// shares. The number in the middle is the share with no Issue (a Warning never lowers it). A card opens that report's summary.

const fmt = (n: number): string => n.toLocaleString('en-US')

interface Counts { whole: number; issue: number; warning: number }
const fine = (c: Counts): number => Math.max(0, c.whole - c.issue - c.warning)

function Band({ title, whole, counts, empty, onOpen, hint }: { title: string; whole: number; counts: Counts | null; empty?: string; onOpen: () => void; hint: string }): React.JSX.Element {
  const [hot, setHot] = useState<number | null>(null)
  if (!counts) {
    return <div style={styles.card} title={hint} {...asButton(onOpen)} data-row-link="" data-card=""><h3 style={dash.cardTitle}>{title}</h3><span style={dash.muted}>{empty}</span></div>
  }
  const share = (n: number): number => (counts.whole > 0 ? n / counts.whole : 0)
  const parts: RingPart[] = [
    { n: counts.issue, color: COLORS.open, short: 'issue', fraction: share(counts.issue), title: `${fmt(counts.issue)} (${percent(counts.issue, counts.whole)}) have an Issue` },
    { n: counts.warning, color: COLORS.warn, short: 'warning', fraction: share(counts.warning), title: `${fmt(counts.warning)} (${percent(counts.warning, counts.whole)}) have a Warning` },
    { n: fine(counts), color: COLORS.fine, short: 'no problems', fraction: share(fine(counts)), title: `${fmt(fine(counts))} (${percent(fine(counts), counts.whole)}) have no problems` }
  ]
  const rows = [
    { label: 'Issue', color: COLORS.open, n: counts.issue }, { label: 'Warning', color: COLORS.warn, n: counts.warning }, { label: 'No problems', color: COLORS.fine, n: fine(counts) }
  ]
  return (
    <div style={styles.card} title={hint} {...asButton(onOpen)} data-row-link="" data-card="">
      <h3 style={dash.cardTitle}>{title} <span style={dash.hint}>{fmt(whole)}</span></h3>
      <div style={styles.body}>
        <RingParts size={92} label={pctLabel(1 - share(counts.issue))} sub="no Issue" parts={parts} active={hot} onActive={setHot} />
        <div style={styles.rows}>
          {rows.map(r => (
            <div key={r.label} style={styles.row}>
              <i style={{ ...dash.legendSwatch, background: r.color }} />
              <span>{r.label}</span>
              <span style={{ flex: 1 }} />
              <b style={styles.num}>{fmt(r.n)}</b>
              <span style={{ ...dash.muted, ...styles.pct }}>{percent(r.n, counts.whole)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function HealthBand({ audit, health, albums, photosTitle, onGoTags, onGoPhotos, onGoAlbums }: {
  audit: AuditOverview; health: HealthOverview; albums: AlbumSummary | null; photosTitle: string
  onGoTags: () => void; onGoPhotos: () => void; onGoAlbums: () => void
}): React.JSX.Element {
  const tags: Counts | null = audit.hasIndex ? { whole: audit.totalTags, issue: audit.flaggedTags, warning: audit.optionalTags } : null
  const photos: Counts | null = health.hasData ? { whole: health.photos, issue: health.withGap, warning: health.warnOnly } : null
  const al: Counts | null = albums?.hasData ? { whole: albums.groups.albums.total, issue: albums.groups.albums.issue, warning: albums.groups.albums.warning } : null
  return (
    <div style={styles.grid}>
      <Band title="Tags" whole={audit.totalTags} counts={tags} empty="Build your library list first." onOpen={onGoTags} hint="Open the Tags summary" />
      <Band title={photosTitle} whole={health.photos} counts={photos} empty="Photo checks need one Rebuild of your library list." onOpen={onGoPhotos} hint="Open the Photos summary" />
      <Band title="Albums" whole={albums?.albums ?? 0} counts={al} empty="Album checks need one Rebuild of your library list." onOpen={onGoAlbums} hint="Open the Albums summary" />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 },
  card: { ...dash.card, cursor: 'pointer' },
  body: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  rows: { flex: '1 1 170px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--ff-text)' },
  row: { display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap' },
  num: { fontVariantNumeric: 'tabular-nums' },
  pct: { minWidth: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
}
