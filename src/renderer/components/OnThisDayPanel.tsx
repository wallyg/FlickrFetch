import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BatchEditButton from './BatchEditButton'
import type { DayPhoto, DayView, PrivacyScope } from '../../shared/types'
import { MONTHS, pad2, hourLabel, PhotoTile } from './DateViewParts'
import ShareDialog from './ShareDialog'
import DateFilterBar, { dateExtra, extraNote, openTitle, rangeOpts, type MediaChoice, type RangeOpts } from './DateFilterBar'
import type { PrivacyFilter } from './PhotoGridShared'
import type { PickedAlbum } from './AlbumBox'
import { primaryBtn, quietBtn, linkBtn, pillBtn, selectedOn } from '../ui/kit'
import BackToTop from '../ui/BackToTop'
import { asButton } from '../ui/a11y'
import { itemsLabel } from '../../shared/counts'
import { useTileSize, TILE_MIN, TILE_MAX } from '../hooks/useTileSize'
import { OpenIcon, DownloadIcon } from '../ui/icons'

const iconBlue: React.CSSProperties = { color: 'var(--ff-blue)', display: 'inline-flex' }

// On This Day: photos taken on this date in other years, grouped by year. Built from the local photo list
// (dates, titles, thumbnails, privacy), so it opens instantly. Nothing here changes Flickr or your files.

interface Props {
  refreshKey: number   // changes when the library is rescanned
  jumpTo: { month: number; day: number; year?: number; nonce: number } | null   // set by See in On This Day in the Timeline
  onOpenRange: (from: string, to: string, opts: RangeOpts) => void
  onDownload: (photos: { id: string; title: string }[], title: string, note: string) => void
  onFullRescan: () => void
}

const PREVIEW = 8   // photos shown per year before "Show all"

export default function OnThisDayPanel({ refreshKey, jumpTo, onOpenRange, onDownload, onFullRescan }: Props): React.JSX.Element {
  const [tileSize, setTileSize] = useTileSize()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())
  const scope: PrivacyScope = 'all'   // the privacy choice is one of the filters now (six levels, as on the other tabs)
  const [privacy, setPrivacy] = useState<PrivacyFilter>('all')
  const [tag, setTag] = useState<{ key: string; label: string } | null>(null)   // show only photos with this tag
  const [media, setMedia] = useState<MediaChoice>('all')   // All, Photos or Videos
  const [albums, setAlbums] = useState<PickedAlbum[]>([])   // only photos in any of these albums
  const extra = useMemo(() => dateExtra(media, albums, privacy), [media, albums, privacy])
  const [data, setData] = useState<DayView | null>(null)
  const [expanded, setExpanded] = useState<Record<string, DayPhoto[]>>({})
  const [selected, setSelected] = useState<Map<string, DayPhoto>>(new Map())
  const [share, setShare] = useState<{ photos: DayPhoto[]; userPicked: boolean } | null>(null)
  const reqRef = useRef(0)
  const dateRef = useRef<HTMLInputElement>(null)
  const handledJump = useRef(0)
  const [pendingYear, setPendingYear] = useState<number | null>(null)

  const load = useCallback(async () => {
    const req = ++reqRef.current
    const v = await window.flickrAPI.getDayView({ month, day, scope, perYear: 12, tag: tag?.key, ...extra })
    if (req !== reqRef.current) return
    setData(v)
  }, [month, day, scope, tag, extra])

  useEffect(() => { void load() }, [load, refreshKey])
  useEffect(() => { setExpanded({}); setSelected(new Map()) }, [month, day, scope, tag, extra])

  // See in On This Day (from a Timeline day) lands here on that date
  useEffect(() => {
    if (!jumpTo || handledJump.current === jumpTo.nonce) return
    handledJump.current = jumpTo.nonce
    changeDay(jumpTo.month, jumpTo.day)
    setPendingYear(jumpTo.year ?? null)
  }, [jumpTo])
  useEffect(() => {
    if (pendingYear === null || !data || data.month !== month || data.day !== day) return
    document.getElementById(`otd-year-${pendingYear}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    setPendingYear(null)
  }, [pendingYear, data, month, day])

  // A tag filter belongs to one day, so changing the day clears it in the same step (one load, not two)
  const changeDay = (m: number, d: number): void => { setTag(null); setMonth(m); setDay(d) }
  const step = (to: { month: number; day: number }): void => changeDay(to.month, to.day)
  const goToday = (): void => { const d = new Date(); changeDay(d.getMonth() + 1, d.getDate()) }

  const showAll = async (year: string): Promise<void> => {
    const all = await window.flickrAPI.getDayPhotos({ month, day, year, scope, offset: 0, limit: 1000, tag: tag?.key, ...extra })
    setExpanded(e => ({ ...e, [year]: all }))
  }
  const toggle = (p: DayPhoto): void => setSelected(prev => { const n = new Map(prev); if (n.has(p.id)) n.delete(p.id); else n.set(p.id, p); return n })

  const dateLabel = `${MONTHS[month - 1]} ${day}`
  const scopeNote = (tag ? ` (tagged ${tag.label})` : '') + extraNote(media, albums, privacy)
  const download = async (year?: string): Promise<void> => {
    const photos = await window.flickrAPI.getDatePhotoIds({ kind: 'day', month, day, year, scope, tag: tag?.key, ...extra })
    if (photos.length === 0) return
    onDownload(photos, `On This Day, ${dateLabel}${year ? ` ${year}` : ''}`, `Photos taken on ${dateLabel}${year ? `, ${year}` : ' in every year'}${scopeNote}`)
  }
  const downloadSelected = (): void => {
    const photos = [...selected.values()].map(p => ({ id: p.id, title: p.title }))
    onDownload(photos, `On This Day, ${dateLabel} (selected)`, 'Only the photos you selected')
  }
  const openYear = (year: string): void => onOpenRange(`${year}-${pad2(month)}-${pad2(day)}`, `${year}-${pad2(month)}-${pad2(day)}`, rangeOpts(extra, tag?.label))

  // Photos for a collage: the ones you ticked, otherwise one per year (newest years first). Videos are left out.
  const isStill = (p: DayPhoto): boolean => p.media !== 'video'
  const pickedStills = [...selected.values()].filter(isStill)
  const startShare = (): void => {
    if (!data) return
    if (pickedStills.length >= 2) setShare({ photos: pickedStills, userPicked: true })
    else setShare({ photos: data.years.map(y => y.photos.find(isStill)).filter((p): p is DayPhoto => !!p).slice(0, 6), userPicked: false })
  }

  // One list that only changes when the photos do, so the collage maker is not restarted by every redraw of the page
  const candidates = useMemo(() => (data ? data.years.flatMap(y => expanded[y.year] ?? y.photos).filter(p => p.media !== 'video') : []), [data, expanded])

  if (!data) return <div style={styles.pad}><span style={styles.muted}>Looking through your photos…</span></div>
  if (!data.hasData) return <div style={styles.pad}><span style={styles.muted}>Build your tag list first (Tags tab). It also keeps the dates On This Day needs.</span></div>

  const ins = data.insights
  const isToday = month === now.getMonth() + 1 && day === now.getDate()
  const byCount = [...data.years].sort((a, b) => b.count - a.count)
  const topYear = byCount[0]
  const maxHour = Math.max(1, ...ins.hourCounts)
  const peakHour = ins.hourCounts.indexOf(maxHour)
  const hasHours = ins.hourCounts.some(n => n > 0)
  const openPicker = (): void => {
    const el = dateRef.current
    if (!el) return
    try { el.showPicker() } catch { el.focus(); el.click() }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.hero}>
        <button style={styles.bigTile} onClick={openPicker} title="Pick any date; only the month and day are used" aria-label="Pick a date">
          <div style={styles.bigMonth}>{MONTHS[month - 1].slice(0, 3).toUpperCase()}</div>
          <div style={styles.bigDay}>{day}</div>
        </button>
        <div style={styles.headText}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span style={styles.title}>On This Day</span>
            <span style={styles.count} title="Uses the date each photo was taken">{itemsLabel(data.total, data.videos)}<span style={styles.countNote}>{scopeNote}</span></span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, position: 'relative', flexWrap: 'wrap' }}>
            <div style={styles.navSeg}>
              <button style={styles.navBtn} onClick={() => step(data.prev)}>‹ {isToday ? 'Yesterday' : 'Previous day'} <span style={styles.muted}>({data.prev.count.toLocaleString()})</span></button>
              <button style={styles.navBtn} onClick={openPicker} title="Pick any date; only the month and day are used">📅 Jump to date…</button>
              <button style={{ ...styles.navBtn, borderRight: 'none' }} onClick={() => step(data.next)}>{isToday ? 'Tomorrow' : 'Next day'} <span style={styles.muted}>({data.next.count.toLocaleString()})</span> ›</button>
            </div>
            {!isToday && <button style={quietBtn} onClick={goToday}>Today</button>}
            <input
              ref={dateRef}
              type="date"
              aria-label="Jump to date"
              tabIndex={-1}
              style={{ position: 'absolute', left: 0, top: '100%', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              onChange={e => { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(e.target.value); if (m) changeDay(Number(m[1]), Number(m[2])) }}
            />
          </div>
        </div>
        <div style={styles.actions}>
          <button style={styles.cta} disabled={data.total - data.videos === 0} onClick={startShare} title={data.videos > 0 ? 'Videos are left out of collages' : undefined}>
            <span style={styles.stack} aria-hidden="true"><s style={{ ...styles.stackCard, left: 0, top: 6, transform: 'rotate(-12deg)' }} /><s style={{ ...styles.stackCard, left: 11, top: 0, transform: 'rotate(3deg)' }} /><s style={{ ...styles.stackCard, left: 22, top: 7, transform: 'rotate(15deg)' }} /></span>
            Make a shareable collage
          </button>
          <BatchEditButton inline style={quietBtn} label="Batch editor" getIds={async () => (await window.flickrAPI.getDatePhotoIds({ kind: 'day', month, day, scope, tag: tag?.key, ...extra })).map(p => p.id)} />
          <button style={quietBtn} disabled={data.total === 0} onClick={() => void download()}>Download all {data.total.toLocaleString()}</button>
        </div>
      </div>

      <div style={styles.row}>
        <DateFilterBar media={media} onMedia={setMedia} privacy={privacy} onPrivacy={setPrivacy} albums={albums} onAlbums={setAlbums}
          levels={data.levels} hasCatalog={data.hasCatalog} onOpenHealth={onFullRescan}
          onClearAll={() => { setMedia('all'); setPrivacy('all'); setAlbums([]); setTag(null) }} />
        {data.hasCatalog && <span style={styles.muted}>🔒 marks photos that are not public. Arrow counts follow the switches.</span>}
        <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }} title={`Photo size: ${tileSize}px`}>
          <span style={styles.muted}>Photo size</span>
          <input type="range" min={TILE_MIN} max={TILE_MAX} step={5} value={tileSize} onChange={e => setTileSize(Number(e.target.value))} style={{ width: 110 }} aria-label="Photo size" />
        </label>
      </div>

      {tag && (
        <div style={styles.row}>
          <span style={{ ...styles.tagChip, ...selectedOn, cursor: 'default' }}>Only photos tagged {tag.label}
            <button style={{ ...linkBtn, marginLeft: 8, color: 'var(--ff-pink-action)' }} onClick={() => setTag(null)} aria-label="Show all photos again">✕</button>
          </span>
          <span style={styles.muted}>Counts, years and the boxes below follow this tag.</span>
        </div>
      )}

      {selected.size > 0 && (
        <div style={{ ...styles.row, justifyContent: 'flex-end' }}>
          <span style={styles.muted}>{selected.size} selected</span>
          <button style={quietBtn} onClick={startShare} disabled={pickedStills.length < 2} title={pickedStills.length < selected.size ? 'Videos are left out of collages' : undefined}>Collage from selected</button>
          <BatchEditButton inline style={quietBtn} label="Batch editor" getIds={async () => [...selected.values()].map(p => p.id)} />
          <button style={quietBtn} onClick={downloadSelected}>Download selected</button>
          <button style={linkBtn} onClick={() => setSelected(new Map())}>Clear</button>
        </div>
      )}

      {data.total === 0 ? (
        <div style={{ ...styles.muted, padding: '24px 4px' }}>
          No photos were taken on {dateLabel}{scopeNote}. Try ‹ Yesterday or Tomorrow ›, or pick another date.
        </div>
      ) : (
        <>
          <div style={styles.insights}>
            <Insight icon="📅" title="Across the years">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {data.years.map(g => (
                  <div key={g.year} style={styles.yearBar} {...asButton(() => document.getElementById(`otd-year-${g.year}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))} title={`${g.count.toLocaleString()} photo${g.count === 1 ? '' : 's'} in ${g.year}. Click to jump there.`}>
                    <span style={{ width: 34, color: '#444' }}>{g.year}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><i style={{ display: 'block', height: 9, borderRadius: 5, width: `${Math.max(3, (g.count / (topYear?.count || 1)) * 100)}%`, background: g === topYear ? 'var(--ff-pink)' : '#e6b0cb' }} /></span>
                    <span style={{ color: 'var(--ff-text-secondary)', minWidth: 58, textAlign: 'right' }}>{g.count.toLocaleString()}{g === topYear && data.years.length > 1 ? ' · most' : ''}</span>
                  </div>
                ))}
              </div>
            </Insight>
            {ins.topTags.length > 0 && (
              <Insight icon="🏷" title="Most-used tags">
                <div style={styles.chips}>{ins.topTags.slice(0, 5).map(t => {
                  const on = tag?.key === t.key
                  return (
                    <button key={t.key} style={{ ...styles.tagChip, ...(on ? selectedOn : {}) }} title={on ? 'Show all photos again' : `Show only photos tagged ${t.name}`} onClick={() => setTag(on ? null : { key: t.key, label: t.name })}>
                      {t.name}<span style={styles.tagCount}>({t.count.toLocaleString()})</span>
                    </button>
                  )
                })}</div>
              </Insight>
            )}
            {hasHours && (
              <Insight icon="🕒" title="Time of day">
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 46 }}>
                  {ins.hourCounts.map((n, h) => <i key={h} title={`${hourLabel(h)}: ${n}`} style={{ flex: 1, display: 'block', height: Math.max(2, (n / maxHour) * 46), borderRadius: '2px 2px 0 0', background: h === peakHour ? 'var(--ff-navy)' : '#b8c4dc' }} />)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ff-text-secondary)', margin: '2px 0 4px' }}><span>12 am</span><span>6 am</span><span>noon</span><span>6 pm</span></div>
                Busiest around {hourLabel(peakHour)} ({maxHour} photo{maxHour === 1 ? '' : 's'}).
              </Insight>
            )}
            <Insight icon="📍" title="Places">
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ff-navy)', lineHeight: 1 }}>{ins.withLocation.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ff-text-secondary)' }}>of {data.total.toLocaleString()}</span></div>
              <div style={{ marginTop: 4 }}>have a map location.</div>
            </Insight>
          </div>

          <div style={styles.sectionRule}><span>Photos by year</span><i style={{ flex: 1, height: 1, background: 'var(--ff-line-strong)' }} /></div>

          {data.years.map((g, yi) => {
            const shown = expanded[g.year] ?? g.photos.slice(0, PREVIEW)
            const ago = new Date().getFullYear() - Number(g.year)
            return (
              <div key={g.year} id={`otd-year-${g.year}`} style={yi === 0 ? { margin: '16px 0 4px' } : { margin: '24px 0 4px', paddingTop: 18, borderTop: '1px solid var(--ff-line-strong)' }}>
                <div style={styles.yearHead}>
                  <b style={{ fontSize: 17 }}>{g.year}</b>
                  <span style={styles.muted}>{ago === 0 ? 'this year' : `${ago} year${ago === 1 ? '' : 's'} ago`} · {itemsLabel(g.count, g.videos)}</span>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
                    <button style={pillBtn} onClick={() => openYear(g.year)} title={openTitle(extra, 'that date')}><span style={iconBlue}><OpenIcon /></span>Open in Photostream</button>
                    <button style={pillBtn} onClick={() => void download(g.year)}><span style={iconBlue}><DownloadIcon /></span>Download these {g.count.toLocaleString()}</button>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))`, gap: 8 }}>
                  {shown.map(p => <PhotoTile key={p.id} photo={p} selected={selected.has(p.id)} onClick={() => toggle(p)} />)}
                  {!expanded[g.year] && g.count > PREVIEW && (
                    <button style={styles.more} onClick={() => void showAll(g.year)}>Show all {g.count.toLocaleString()}</button>
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}

      <BackToTop />

      {share && (
        <ShareDialog
          photos={share.photos}
          candidates={candidates}
          tag={tag?.key}
          userPicked={share.userPicked}
          defaultPublicOnly={privacy === 'public'}
          month={month}
          day={day}
          onClose={() => setShare(null)}
        />
      )}
    </div>
  )
}

function Insight({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ background: 'var(--ff-warm)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: '#444' }}>
      <b style={{ display: 'block', fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--ff-text-secondary)', marginBottom: 8 }}>{icon} {title}</b>
      {children}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { height: '100%', boxSizing: 'border-box', overflowY: 'auto', padding: '10px 24px 24px' },   // the tab pane is a fixed box, so this panel scrolls inside it
  pad: { padding: '40px 24px' },
  muted: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  hero: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '4px 0 14px', borderBottom: '1px solid var(--ff-line-strong)' },
  bigTile: { width: 72, flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 3px 12px rgba(27,41,70,0.22)', textAlign: 'center', border: 'none', padding: 0, cursor: 'pointer' },
  bigMonth: { background: 'var(--ff-pink)', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', padding: '5px 0 4px' },
  bigDay: { fontSize: 38, fontWeight: 700, color: 'var(--ff-navy)', lineHeight: '48px' },
  headText: { flex: '1 1 320px', minWidth: 0 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--ff-navy)', lineHeight: 1.1 },
  count: { fontSize: 16, fontWeight: 700, color: 'var(--ff-text)' },
  countNote: { fontSize: 13, fontWeight: 400, color: 'var(--ff-text-secondary)', marginLeft: 6 },
  actions: { display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  navSeg: { display: 'inline-flex', border: '1px solid var(--ff-line-strong)', borderRadius: 8, background: '#fff', overflow: 'hidden' },
  navBtn: { background: '#fff', border: 'none', borderRight: '1px solid var(--ff-border)', padding: '5px 13px', fontSize: 13, color: 'var(--ff-text)', cursor: 'pointer', whiteSpace: 'nowrap' },
  cta: { ...primaryBtn, display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px 9px 12px', fontSize: 14, borderRadius: 11, boxShadow: '0 2px 8px rgba(208,0,105,0.3)' },
  stack: { position: 'relative', width: 50, height: 40, flexShrink: 0, display: 'block' },
  stackCard: { position: 'absolute', width: 26, height: 31, background: 'linear-gradient(135deg, #f0b15a, #6f93b8)', border: '2px solid #fff', borderBottomWidth: 6, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.4)', display: 'block' },
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '12px 0 10px' },
  insights: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, margin: '4px 0' },
  yearBar: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer' },
  tagCount: { marginLeft: 5, fontWeight: 400, fontSize: 11.5, color: 'var(--ff-text-secondary)', whiteSpace: 'nowrap' },
  chips: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  tagChip: { background: '#fff', border: '1px solid var(--ff-border)', borderRadius: 14, padding: '2px 9px', fontSize: 12, color: 'var(--ff-text)', cursor: 'pointer', textAlign: 'left', maxWidth: '100%' },
  sectionRule: { display: 'flex', alignItems: 'center', gap: 10, margin: '26px 0 2px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ff-text-secondary)' },
  yearHead: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 },
  
  more: { display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #bbb', borderRadius: 8, color: 'var(--ff-text-secondary)', fontSize: 12, minHeight: 120, background: 'transparent', cursor: 'pointer' }
}
