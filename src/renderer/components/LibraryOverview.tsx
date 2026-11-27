import React, { useEffect, useState } from 'react'
import type { AlbumSummary, AuditOverview, HealthCondition, HealthOverview, LibraryStats } from '../../shared/types'
import { dash } from './DashboardParts'
import { createPortal } from 'react-dom'
import Icon from '../ui/Icon'
import { quietBtn, segGroup, segBtn, selectedOn } from '../ui/kit'
import SectionRule from '../ui/SectionRule'
import TopSizeSeg from './TopSizeSeg'
import HealthBand from './HealthBand'
import { Totals, VisibilityCard, FilledCard, YearCard, PartsCards, GuessedNote, PlacesCard, ExactCard, RankedCard, BusiestCard, MoreRecordsCard, cardGrid, partsGrid, printGrid, type Go } from './DashboardCards'
import { normalizeScope } from '../../shared/healthScope'

// The front page of Health Check, a dashboard of your library (#220): how healthy each report is, then the library in numbers (totals, who can see it,
// what is filled in), when and where the photos were taken, what is in it (tags and albums), and records. Every figure is a shortcut to the screen that
// shows those photos. Everything is read from the local library list; nothing is asked of Flickr.

interface Props {
  refreshKey: number
  offCount: number
  onGoTags: () => void
  onGoPhotos: () => void
  onGoAlbums: () => void
  onOpenPhotos: (condition: HealthCondition, year?: string) => void
  onTune: () => void
  go: Omit<Go, 'list'>
  toolbarRight?: HTMLElement | null   // where Save as PDF goes: the Health Check toolbar
}

interface Loaded { audit: AuditOverview; health: HealthOverview; stats: LibraryStats | null; albums: AlbumSummary | null; videosInChecks: boolean }
const noop = (): void => { /* a print-only copy of a view has no switches to answer */ }
// The last numbers fetched, by refreshKey, so switching away and back does not read the whole library list again
let lastOverview: { key: number; data: Loaded } | null = null
// Called when a finding is marked fine, planned or put back: the counts and scores change without a new scan
export function forgetOverview(): void { lastOverview = null }

export default function LibraryOverview({ refreshKey, offCount, onGoTags, onGoPhotos, onGoAlbums, onOpenPhotos, onTune, go, toolbarRight }: Props): React.JSX.Element {
  const same = lastOverview?.key === refreshKey ? lastOverview.data : null
  const [data, setData] = useState<Loaded | null>(same)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [series, setSeries] = useState<'taken' | 'uploaded'>('taken')
  const [span, setSpan] = useState<'year' | 'decade'>('year')
  const [busy, setBusy] = useState<'days' | 'months'>('days')
  const [placeView, setPlaceView] = useState<'countries' | 'states'>('countries')
  const [placeN, setPlaceN] = useState(5)
  const [whatN, setWhatN] = useState(5)
  const [pdfNote, setPdfNote] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (lastOverview?.key === refreshKey) { setData(lastOverview.data); return }
    let cancelled = false
    setFailed(false)
    void (async () => {
      try {
        const [audit, health, stats, albums, settings] = await Promise.all([
          window.flickrAPI.getAuditOverview(), window.flickrAPI.getHealthOverview(),
          window.flickrAPI.getLibraryStats().catch(() => null), window.flickrAPI.getAlbumSummary().catch(() => null), window.flickrAPI.getSettings().catch(() => null)
        ])
        const loaded: Loaded = { audit, health, stats, albums, videosInChecks: normalizeScope(settings?.healthScope).videos }
        lastOverview = { key: refreshKey, data: loaded }
        if (!cancelled) setData(loaded)
      } catch { if (!cancelled) setFailed(true) }
    })()
    return () => { cancelled = true }
  }, [refreshKey, attempt])

  // Save as PDF: the page is marked for printing (the print styles in index.html leave the dashboard alone on the page), then the main process asks where to save it
  const savePdf = async (): Promise<void> => {
    setSaving(true); setPdfNote('')
    document.documentElement.setAttribute('data-printing', '')
    await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())))
    try {
      const path = await window.flickrAPI.saveDashboardPdf()
      if (path) { setPdfNote(`Saved ${path.split('/').pop()}`); setTimeout(() => setPdfNote(''), 8000) }
    } catch { setPdfNote('Couldn\'t save the PDF') }
    finally { document.documentElement.removeAttribute('data-printing'); setSaving(false) }
  }

  const pdfButton = (
    <button style={styles.pdfBtn} onClick={() => void savePdf()} disabled={saving} title="Save this page as a PDF: every view, not just the ones chosen on screen" aria-label="Save as PDF" data-noprint=""><Icon name="download" /> PDF</button>
  )

  if (!data) return <div style={dash.wrap}><span style={dash.muted}>{failed ? <>Couldn't load this. <button style={styles.retry} onClick={() => setAttempt(n => n + 1)}>Try again</button></> : 'Checking your library…'}</span></div>

  const { audit, health, stats, albums, videosInChecks } = data
  const goAll: Go = { ...go, list: c => onOpenPhotos(c) }
  const mixed = !!stats && stats.videos > 0
  const photosTitle = videosInChecks && mixed ? 'Photos and videos' : 'Photos'
  const thisYear = new Date().getFullYear()
  const placeList = stats ? (placeView === 'countries' ? stats.places.countries : stats.places.states) : []
  const whatTotal = stats ? Math.max(stats.topTags.length, stats.topAlbums.length) : 0

  return (
    <div style={dash.wrap} id="ff-dashboard">
      <div data-print-only="" style={styles.printHead}>FlickrFetch · Library overview · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      {toolbarRight ? createPortal(pdfButton, toolbarRight) : null}
      <SectionRule label="Health" link={toolbarRight ? undefined : <span data-noprint="">{pdfButton}</span>} />
      <HealthBand audit={audit} health={health} albums={albums} photosTitle={photosTitle} onGoTags={onGoTags} onGoPhotos={onGoPhotos} onGoAlbums={onGoAlbums} />
      <div style={styles.tune} data-noprint="">
        {offCount > 0 ? `${offCount} check${offCount === 1 ? ' is' : 's are'} switched off.` : 'Every check is set to Issue or Warning.'}
        <button style={quietBtn} onClick={onTune}>Tune checks…</button>
        {pdfNote ? <span style={styles.saved} role="status">{pdfNote}</span> : null}
      </div>

      {stats?.hasData ? (
        <>
          <SectionRule label="Your library" />
          <Totals stats={stats} go={goAll} />
          <div style={{ ...cardGrid, marginTop: 12 }}>
            <VisibilityCard stats={stats} go={goAll} />
            <FilledCard stats={stats} go={goAll} />
          </div>

          <SectionRule label="When you take photos" />
          <div data-noprint=""><YearCard stats={stats} go={goAll} series={series} span={span} onSeries={setSeries} onSpan={setSpan} thisYear={thisYear} /></div>
          {/* The PDF has every view, not the one chosen on screen: year and decade, taken and uploaded */}
          <div data-print-only=""><div style={printGrid}>
            {(['taken', 'uploaded'] as const).flatMap(s => (['year', 'decade'] as const).map(sp => <YearCard key={`${s}${sp}`} stats={stats} go={goAll} series={s} span={sp} onSeries={noop} onSpan={noop} thisYear={thisYear} compact />))}
          </div></div>
          <div style={{ ...partsGrid, marginTop: 12 }}>
            <PartsCards stats={stats} />
            <GuessedNote stats={stats} go={goAll} />
          </div>

          {stats.located > 0 ? (
            <>
              <SectionRule label="Where you take photos" controls={
                <span style={styles.controls} data-noprint="">
                  {stats.places.states.length > 0 ? (
                    <span style={segGroup} role="radiogroup" aria-label="Countries or US states">
                      {(['countries', 'states'] as const).map(v => <button key={v} role="radio" aria-checked={placeView === v} style={{ ...segBtn, ...(placeView === v ? selectedOn : {}) }} onClick={() => setPlaceView(v)}>{v === 'countries' ? 'Countries' : 'US states'}</button>)}
                    </span>
                  ) : null}
                  <TopSizeSeg total={placeList.length} value={placeN} onChange={setPlaceN} label="How many places to show" />
                </span>
              } />
              <div style={cardGrid} data-noprint="">
                <PlacesCard stats={stats} go={goAll} view={placeView} n={placeN} />
                <ExactCard stats={stats} go={goAll} />
              </div>
              <div data-print-only=""><div style={printGrid}>
                <PlacesCard stats={stats} go={goAll} view="countries" n={10} />
                {stats.places.states.length > 0 ? <PlacesCard stats={stats} go={goAll} view="states" n={10} /> : null}
                <ExactCard stats={stats} go={goAll} />
              </div></div>
            </>
          ) : null}

          <SectionRule label="What's in it" controls={<TopSizeSeg total={whatTotal} value={whatN} onChange={setWhatN} label="How many tags and albums to show" />} />
          <div style={cardGrid} data-noprint="">
            <RankedCard title="Most-used tags" rows={stats.topTags} n={whatN} kind="tags" stats={stats} go={goAll} />
            <RankedCard title="Biggest albums" rows={stats.topAlbums} n={whatN} kind="albums" stats={stats} go={goAll} />
          </div>
          <div data-print-only=""><div style={printGrid}>
            <RankedCard title="Most-used tags" rows={stats.topTags} n={25} kind="tags" stats={stats} go={goAll} />
            <RankedCard title="Biggest albums" rows={stats.topAlbums} n={25} kind="albums" stats={stats} go={goAll} />
          </div></div>

          <SectionRule label="Records" />
          <div style={cardGrid} data-noprint="">
            <BusiestCard stats={stats} go={goAll} mode={busy} onMode={setBusy} />
            <MoreRecordsCard stats={stats} go={goAll} />
          </div>
          <div data-print-only=""><div style={printGrid}>
            <BusiestCard stats={stats} go={goAll} mode="days" onMode={noop} />
            <BusiestCard stats={stats} go={goAll} mode="months" onMode={noop} />
            <MoreRecordsCard stats={stats} go={goAll} />
          </div></div>
        </>
      ) : null}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  tune: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 8 },
  controls: { display: 'inline-flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  pdfBtn: { ...quietBtn, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  saved: { marginLeft: 'auto', color: 'var(--ff-success-ink)' },
  printHead: { fontSize: 13, color: 'var(--ff-text-secondary)', marginBottom: 8 },
  retry: { background: 'none', border: 'none', color: 'var(--ff-blue)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }
}
