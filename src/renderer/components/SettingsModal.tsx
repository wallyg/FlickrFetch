import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import DateStampEditor from './DateStampEditor'
import { DATE_EXAMPLE_TAKEN, DEFAULT_DATE_PATTERN, formatDateStamp } from '../../shared/dateStamp'
import CloseButton from '../ui/CloseButton'
import Dialog from '../ui/Dialog'
import { fieldBox, tabMark, primaryBtn, putAsideBtn, quietBtn, smallBtn, headingScreen } from '../ui/kit'
import Icon from '../ui/Icon'
import HealthCheckSettings from './HealthCheckSettings'
import AlbumCheckSettings from './AlbumCheckSettings'
import InfoTip from '../ui/InfoTip'
import MapCacheControls from './MapCacheControls'
import RequestStatsNote from './RequestStatsNote'
import { cacheLimitMb } from '../../shared/mapGeo'
import type {
  FileNamingConfig, FileNamingCore, FileNamingSep, DateFormat, PartPosition,
  AppSettings, CaseTransform, DownloadSize, ConflictBehavior, MetadataSettings
} from '../../shared/types'

export type SettingsTab = 'general' | 'downloads' | 'naming' | 'metadata' | 'health' | 'albums'
type Tab = SettingsTab

const SIZE_TOKEN_MAP: Record<DownloadSize, string> = {
  original: 'o', xlarge: 'xl', large: 'l', medium: 'm', small: 's', square: 'sq'
}

function RadioDot({ active, size = 16 }: { active: boolean; size?: number }): React.JSX.Element {
  const r = size / 2 - 1.25
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, marginTop: size === 16 ? '1px' : '0' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="white" stroke={active ? 'var(--ff-pink)' : 'var(--ff-text-muted)'} strokeWidth="1.5" />
      {active && <circle cx={size / 2} cy={size / 2} r={r - 3.5} fill="var(--ff-pink)" />}
    </svg>
  )
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }): React.JSX.Element {
  return (
    <div style={s.toggleRow} onClick={() => onChange(!value)} role="switch" aria-checked={value}>
      <div style={s.toggleInfo}>
        <span style={s.toggleLabel}>{label}</span>
        {desc && <span style={s.toggleDesc}>{desc}</span>}
      </div>
      <div style={{ ...s.toggle, backgroundColor: value ? 'var(--ff-pink)' : 'var(--ff-line-strong)' }}>
        <div style={{ ...s.toggleKnob, transform: value ? 'translateX(20px)' : 'none' }} />
      </div>
    </div>
  )
}

function PosToggle({ value, onChange }: { value: PartPosition; onChange: (v: PartPosition) => void }): React.JSX.Element {
  return (
    <div style={s.posGroup}>
      {(['off', 'prefix', 'suffix'] as PartPosition[]).map((v, idx, arr) => (
        <button
          key={v}
          style={{
            ...s.posBtn,
            ...(value === v ? s.posBtnActive : {}),
            ...(idx === arr.length - 1 ? { borderRight: 'none' } : {})
          }}
          onClick={() => onChange(v)}
        >
          {v === 'off' ? 'Off' : v === 'prefix' ? 'Prefix' : 'Suffix'}
        </button>
      ))}
    </div>
  )
}

export default function SettingsModal({ onClose, updateVersion, initialTab }: { onClose: () => void; updateVersion?: string; initialTab?: SettingsTab }): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'general')
  const [resetCount, setResetCount] = useState(0)   // goes up on Restore defaults, so the Health Check tab reads its choices again

  // General tab
  const [showDockProgress, setShowDockProgress] = useState(true)
  const [notifyOnComplete, setNotifyOnComplete] = useState(true)
  const [onThisDayCard, setOnThisDayCard] = useState(true)
  const [onThisDayNotify, setOnThisDayNotify] = useState(false)
  const [mapStreet, setMapStreet] = useState<boolean | undefined>(undefined)   // undefined = never asked
  const [mapCacheMb, setMapCacheMb] = useState(cacheLimitMb(undefined))
  const [pretendFree, setPretendFree] = useState(false)   // development builds only (#126)

  // Downloads tab
  const [downloadFolder, setDownloadFolder] = useState('')
  const [conflictBehavior, setConflictBehavior] = useState<ConflictBehavior>('rename')
  const [downloadSize, setDownloadSize] = useState<DownloadSize>('original')
  const [openFinderOnComplete, setOpenFinderOnComplete] = useState(false)

  // Metadata tab
  const [embedTitle, setEmbedTitle] = useState(true)
  const [embedDescription, setEmbedDescription] = useState(true)
  const [embedTags, setEmbedTags] = useState(true)
  const [embedDateTaken, setEmbedDateTaken] = useState(true)
  const [embedCreator, setEmbedCreator] = useState(true)
  const [embedGps, setEmbedGps] = useState(true)
  const [stripGpsFromPrivate, setStripGpsFromPrivate] = useState(false)
  const [embedLicense, setEmbedLicense] = useState(true)
  const [embedPhotoUrl, setEmbedPhotoUrl] = useState(true)
  const [embedPhotoId, setEmbedPhotoId] = useState(true)
  const [writeSidecarJson, setWriteSidecarJson] = useState(false)
  const [keepDescriptionHtml, setKeepDescriptionHtml] = useState(false)

  // Naming tab
  const [core, setCore] = useState<FileNamingCore>('title')
  const [sep, setSep] = useState<FileNamingSep>('.')
  const [datePos, setDatePos] = useState<PartPosition>('off')
  const [dateFmt, setDateFmt] = useState<DateFormat>(DEFAULT_DATE_PATTERN)
  const [seqPos, setSeqPos] = useState<PartPosition>('off')
  const [customPos, setCustomPos] = useState<PartPosition>('off')
  const [customText, setCustomText] = useState('')
  const [caseTransform, setCaseTransform] = useState<CaseTransform>('none')
  const [charSubstitution, setCharSubstitution] = useState(false)
  const [subStripParens, setSubStripParens] = useState(false)
  const [subStripBrackets, setSubStripBrackets] = useState(false)
  const [sizeTokenPos, setSizeTokenPos] = useState<PartPosition>('off')

  const [showFade, setShowFade] = useState(false)
  const hasLoadedRef = useRef(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [crash, setCrash] = useState(false)   // development only: fails on purpose to show the error screen
  const [resetDone, setResetDone] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const checkFade = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    setShowFade(el.scrollHeight > el.clientHeight + 4 && el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }, [])

  useEffect(() => { requestAnimationFrame(checkFade) }, [activeTab, checkFade])


  const applySettings = useCallback((settings: AppSettings) => {
    setShowDockProgress(settings.showDockProgress ?? true)
    setNotifyOnComplete(settings.notifyOnComplete ?? true)
    setOnThisDayCard(settings.onThisDayCard ?? true)
    setOnThisDayNotify(settings.onThisDayNotify ?? false)
    setMapStreet(settings.mapStreet)
    setMapCacheMb(cacheLimitMb(settings.mapCacheMb))
    setPretendFree(settings.devPretendFree === true)
    setDownloadFolder(settings.downloadFolder)
    setConflictBehavior(settings.conflictBehavior ?? 'rename')
    setDownloadSize(settings.downloadSize ?? 'original')
    setOpenFinderOnComplete(settings.openFinderOnComplete ?? false)
    const fn = settings.fileNaming
    setCore(fn.core)
    setSep(fn.separator)
    setDatePos(fn.date.position)
    setDateFmt(fn.date.format)
    setSeqPos(fn.sequence.position)
    setCustomPos(fn.customText.position)
    setCustomText(fn.customText.text)
    setCaseTransform(fn.caseTransform ?? 'none')
    setCharSubstitution(fn.charSubstitution ?? false)
    setSubStripParens(fn.subStripParens ?? false)
    setSubStripBrackets(fn.subStripBrackets ?? false)
    setSizeTokenPos(fn.sizeToken?.position ?? 'off')
    const m = settings.metadata
    if (m) {
      setEmbedTitle(m.embedTitle ?? true)
      setEmbedDescription(m.embedDescription ?? true)
      setEmbedTags(m.embedTags ?? true)
      setEmbedDateTaken(m.embedDateTaken ?? true)
      setEmbedCreator(m.embedCreator ?? true)
      setEmbedGps(m.embedGps ?? true)
      setStripGpsFromPrivate(m.stripGpsFromPrivate ?? false)
      setEmbedLicense(m.embedLicense ?? true)
      setEmbedPhotoUrl(m.embedPhotoUrl ?? true)
      setEmbedPhotoId(m.embedPhotoId ?? true)
      setWriteSidecarJson(m.writeSidecarJson ?? false)
      setKeepDescriptionHtml(m.keepDescriptionHtml ?? false)
    }
  }, [])

  const handleReset = useCallback(async () => {
    const defaults = await window.flickrAPI.resetSettings()
    applySettings(defaults)
    setResetCount(c => c + 1)
    setConfirmReset(false)
    setResetDone(true)
    setTimeout(() => setResetDone(false), 2000)
  }, [applySettings])

  // Nothing is saved until the settings have been read, so a failed read says so (and can be tried again) instead of silently dropping changes
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadTry, setLoadTry] = useState(0)
  useEffect(() => {
    window.flickrAPI.getSettings().then((settings: AppSettings) => {
      applySettings(settings)
      hasLoadedRef.current = true
      setLoadFailed(false)
    }).catch(() => setLoadFailed(true))
  }, [loadTry])

  // A change made less than 300 ms before the window closes is still saved: the pending save runs when this unmounts
  const saveRef = useRef<() => void>(() => {})
  const saveDueRef = useRef(false)
  useEffect(() => () => { if (saveDueRef.current) saveRef.current() }, [])

  // Auto-save with 300ms debounce whenever any setting changes after initial load
  useEffect(() => {
    if (!hasLoadedRef.current) return
    const save = (): void => {
      saveDueRef.current = false
      const fileNaming: FileNamingConfig = {
        core, separator: sep,
        date: { position: datePos, format: dateFmt },
        sequence: { position: seqPos },
        customText: { position: customPos, text: customText.trim() },
        caseTransform,
        charSubstitution,
        subStripParens, subStripBrackets,
        sizeToken: { position: sizeTokenPos }
      }
      const metadata: MetadataSettings = {
        embedTitle, embedDescription, embedTags, embedDateTaken, embedCreator,
        embedGps, stripGpsFromPrivate, embedLicense, embedPhotoUrl, embedPhotoId,
        writeSidecarJson, keepDescriptionHtml
      }
      window.flickrAPI.setSettings({
        fileNaming, downloadFolder, showDockProgress, notifyOnComplete,
        conflictBehavior, downloadSize, openFinderOnComplete, metadata, onThisDayCard, onThisDayNotify,
        mapCacheMb, ...(mapStreet !== undefined ? { mapStreet } : {})
      })
    }
    saveRef.current = save
    saveDueRef.current = true
    const timer = setTimeout(save, 300)
    return () => clearTimeout(timer)
  }, [
    core, sep, datePos, dateFmt, seqPos, customPos, customText,
    caseTransform, charSubstitution, subStripParens, subStripBrackets,
    sizeTokenPos, downloadFolder, showDockProgress, notifyOnComplete,
    conflictBehavior, downloadSize, openFinderOnComplete, onThisDayCard, onThisDayNotify, mapStreet, mapCacheMb,
    embedTitle, embedDescription, embedTags,
    embedDateTaken, embedCreator, embedGps, stripGpsFromPrivate,
    embedLicense, embedPhotoUrl, embedPhotoId, writeSidecarJson, keepDescriptionHtml
  ])

  const previewTitle = 'NYC Highline (2024)'
  const previewId = '12345678'

  const preview = useMemo(() => {
    let titleStr = previewTitle
    if (subStripParens)    titleStr = titleStr.replace(/[()]/g, '')
    if (subStripBrackets)  titleStr = titleStr.replace(/[\[\]]/g, '')
    const rawTitle = titleStr.replace(/[/\\:*?"<>|]/g, '_').trim()
    const safeTitle = charSubstitution ? rawTitle.replace(/\s+/g, sep) : rawTitle

    let coreStr: string
    switch (core) {
      case 'id':       coreStr = previewId; break
      case 'id-title': coreStr = `${previewId}${sep}${safeTitle}`; break
      case 'title-id': coreStr = `${safeTitle}${sep}${previewId}`; break
      default:         coreStr = safeTitle
    }
    const pre: string[] = []
    const suf: string[] = []
    if (datePos === 'prefix') pre.push(formatDateStamp(dateFmt, DATE_EXAMPLE_TAKEN))
    if (datePos === 'suffix') suf.push(formatDateStamp(dateFmt, DATE_EXAMPLE_TAKEN))
    if (seqPos === 'prefix') pre.push('001')
    if (seqPos === 'suffix') suf.push('001')
    const ct = (customText.trim() || 'MyText').replace(/[/\\:*?"<>|]/g, '_')   // as in the saved name: characters a file name cannot hold become _
    if (customPos === 'prefix') pre.push(ct)
    if (customPos === 'suffix') suf.push(ct)
    if (sizeTokenPos !== 'off') {
      const token = SIZE_TOKEN_MAP[downloadSize]
      if (sizeTokenPos === 'prefix') pre.push(token)
      else suf.push(token)
    }
    const assembled = [...pre, coreStr, ...suf].join(sep)
    const final = caseTransform === 'lowercase' ? assembled.toLowerCase()
      : caseTransform === 'uppercase' ? assembled.toUpperCase()
      : assembled
    return final + '.jpg'
  }, [core, sep, datePos, dateFmt, seqPos, customPos, customText, caseTransform, charSubstitution, subStripParens, subStripBrackets, sizeTokenPos, downloadSize])

  const handlePickFolder = async (): Promise<void> => {
    const folder = await window.flickrAPI.pickFolder()
    if (folder) { setDownloadFolder(folder) }
  }

  if (crash) throw new Error('Test error from Settings (development only)')

  return (
    <Dialog label="Settings" size="wide" onClose={onClose} cardStyle={{ height: 660, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={s.header}>
          <h2 style={s.title}>Settings</h2>
          <CloseButton onClick={onClose} />
        </div>

        {updateVersion && (
          <div style={s.updateBanner}>
            <span style={s.updateText}><Icon name="arrowUp" /> FlickrFetch {updateVersion} is available</span>
            <button style={s.updateBtn} onClick={() => window.flickrAPI.openExternal('https://github.com/wallyg/FlickrFetch/releases/latest')}>
              Get update
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div style={s.tabBar}>
          {(['general', 'downloads', 'naming', 'metadata', 'health', 'albums'] as Tab[]).map(tab => (
            <button
              key={tab}
              style={{ ...s.tabBtn, ...(activeTab === tab ? s.tabBtnActive : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'general' ? 'General' : tab === 'downloads' ? 'Downloads' : tab === 'naming' ? 'File naming' : tab === 'metadata' ? 'Metadata' : tab === 'health' ? 'Health Check' : 'Album Checks'}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div ref={contentRef} style={s.content} onScroll={checkFade}>

          {/* ── GENERAL TAB ── */}
          {activeTab === 'general' && (
            <>
              <div style={s.section}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Notifications and Dock</p>
                </div>
                <div style={s.toggleList}>
                  <Toggle
                    value={showDockProgress}
                    onChange={v => { setShowDockProgress(v) }}
                    label="Show dock progress"
                    desc="Show download progress on the Dock icon"
                  />
                  <Toggle
                    value={notifyOnComplete}
                    onChange={v => { setNotifyOnComplete(v) }}
                    label="Notify when complete"
                    desc="A macOS notification when a download finishes"
                  />
                </div>
              </div>

              <div style={s.section}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>On This Day</p>
                </div>
                <div style={s.toggleList}>
                  <Toggle
                    value={onThisDayCard}
                    onChange={v => { setOnThisDayCard(v) }}
                    label="Show the On This Day card"
                    desc="A small card in the corner of My Flickr when you have photos from today's date in earlier years"
                  />
                  <Toggle
                    value={onThisDayNotify}
                    onChange={v => { setOnThisDayNotify(v) }}
                    label="Daily On This Day notification"
                    desc="One macOS notification a day while FlickrFetch is open"
                  />
                </div>
              </div>

              <div style={{ ...s.section, borderTop: '1px solid var(--ff-border)' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Street map</p>
                  <InfoTip text={"# About the street map\n- Draws streets from OpenStreetMap, a free community map\n- Asks it for the map images of the area you are looking at, so it learns roughly where you look\n- Sends nothing else: no photos, account or name\n- Saves those map images on this computer (not your photos), so places you have seen load fast and work offline" } />
                </div>
                <div style={s.toggleList}>
                  <Toggle
                    value={mapStreet === true}
                    onChange={v => { setMapStreet(v) }}
                    label="Show street map"
                    desc="Draws streets under your photos on the Map tab."
                  />
                </div>
                <MapCacheControls limitMb={mapCacheMb} onLimit={setMapCacheMb} reloadKey={resetCount} />
              </div>

              <div style={{ ...s.section, borderTop: '1px solid var(--ff-border)' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Flickr requests</p>
                </div>
                <RequestStatsNote />
              </div>
            </>
          )}

          {loadFailed && (
            <div style={{ ...s.section, color: 'var(--ff-error)', fontSize: 13 }} role="alert">
              Couldn't read your settings, so changes are not being saved. <button style={{ background: 'none', border: 'none', color: 'var(--ff-blue)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', padding: 0 }} onClick={() => setLoadTry(n => n + 1)}>Try again</button>
            </div>
          )}

          {/* ── HEALTH CHECK TAB ── */}
          {activeTab === 'health' && <div style={s.section}><HealthCheckSettings reloadKey={resetCount} onOpenAlbumTab={() => setActiveTab('albums')} /></div>}
          {activeTab === 'albums' && <div style={s.section}><AlbumCheckSettings onOpenHealth={() => setActiveTab('health')} /></div>}

          {/* ── DOWNLOADS TAB ── */}
          {activeTab === 'downloads' && (
            <>
              {/* Download folder */}
              <div style={s.section}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Download folder</p>
                  <InfoTip text={"Where batch downloads are saved.\n\nSingle-photo downloads use your Mac's Save dialog instead."} />
                </div>
                <div style={s.folderRow}>
                  <span style={s.folderPath}>{downloadFolder || '—'}</span>
                  <button style={s.changeBtn} onClick={handlePickFolder}>Change…</button>
                </div>
              </div>

              {/* Download size */}
              <div style={{ ...s.section, borderTop: '1px solid var(--ff-border)' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Photo resolution</p>
                  <InfoTip text={"Which image size to download.\n\nVideos always download at their highest quality."} />
                </div>
                <div style={s.optionList}>
                  {([
                    ['original', 'Original',  'Highest resolution — always best for archiving'],
                    ['xlarge',   'X-Large',   'Up to 2048px on the long side'],
                    ['large',    'Large',     'Up to 1600px on the long side'],
                    ['medium',   'Medium',    'Up to ~800px on the long side'],
                    ['small',    'Small',     'Up to 320px on the long side'],
                    ['square',   'Square',    '150 × 150 px thumbnail'],
                  ] as [DownloadSize, string, string][]).map(([val, label, desc]) => (
                    <div
                      key={val}
                      style={{ ...s.radioRow, ...(downloadSize === val ? s.radioRowActive : {}) }}
                      onClick={() => { setDownloadSize(val) }}
                      role="radio" aria-checked={downloadSize === val}
                    >
                      <RadioDot active={downloadSize === val} />
                      <div>
                        <div style={s.radioLabel}>{label}</div>
                        <div style={s.radioDesc}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {import.meta.env.DEV && (
                <div style={{ ...s.section, borderTop: '1px solid var(--ff-border)' }}>
                  <p style={s.sectionTitle}>Development only</p>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <input type="checkbox" checked={pretendFree} onChange={e => { setPretendFree(e.target.checked); void window.flickrAPI.setSettings({ devPretendFree: e.target.checked }) }} />
                    Act as a free account in the download box (to see the size note)
                  </label>
                  <p style={s.radioDesc}>Only in <code>npm run dev</code>. Your account is Pro; this does not change any download.</p>
                  <button style={{ ...quietBtn, marginTop: 8, alignSelf: 'flex-start' }} onClick={() => setCrash(true)}>Show the error screen</button>
                  <p style={s.radioDesc}>Makes this screen fail on purpose, so you can see the error screen and its Reload button. Only in <code>npm run dev</code>.</p>
                </div>
              )}

              {/* Conflict behavior */}
              <div style={{ ...s.section, borderTop: '1px solid var(--ff-border)' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>If file already exists</p>
                  <InfoTip text="What to do when a file with the same name is already in the folder." />
                </div>
                <div style={s.optionList}>
                  {([
                    ['rename',    'Add a number',  'Append _2, _3, etc. to make the name unique'],
                    ['skip',      'Skip',          'Don\'t download if a file with that name already exists'],
                    ['overwrite', 'Overwrite',     'Replace the existing file'],
                  ] as [ConflictBehavior, string, string][]).map(([val, label, desc]) => (
                    <div
                      key={val}
                      style={{ ...s.radioRow, ...(conflictBehavior === val ? s.radioRowActive : {}) }}
                      onClick={() => { setConflictBehavior(val) }}
                      role="radio" aria-checked={conflictBehavior === val}
                    >
                      <RadioDot active={conflictBehavior === val} />
                      <div>
                        <div style={s.radioLabel}>{label}</div>
                        <div style={s.radioDesc}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Open Finder */}
              <div style={{ ...s.section, borderTop: '1px solid var(--ff-border)' }}>
                <div style={s.toggleList}>
                  <Toggle
                    value={openFinderOnComplete}
                    onChange={v => { setOpenFinderOnComplete(v) }}
                    label="Show in Finder when done"
                    desc="Reveal the downloaded files in Finder after a batch completes"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── FILE NAMING TAB ── */}
          {activeTab === 'naming' && (
            <>
              {/* Core */}
              <div style={s.section}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Core</p>
                  <InfoTip text="The main part of every filename. The other parts go before or after it." />
                </div>
                <div style={s.coreGrid}>
                  {([
                    ['title',    'Title only',  'NYC - Highline'],
                    ['id-title', 'ID + Title',  '12345678 + Title'],
                    ['title-id', 'Title + ID',  'Title + 12345678'],
                    ['id',       'ID only',     '12345678'],
                  ] as [FileNamingCore, string, string][]).map(([val, label, example]) => (
                    <div
                      key={val}
                      style={{ ...s.coreOption, ...(core === val ? s.coreOptionActive : {}) }}
                      onClick={() => { setCore(val) }}
                      role="radio" aria-checked={core === val}
                    >
                      <RadioDot active={core === val} />
                      <div>
                        <div style={s.coreLabel}>{label}</div>
                        <div style={s.coreExample}>{example}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Separator */}
              <div style={{ ...s.section, borderTop: '1px solid var(--ff-border)' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Separator</p>
                  <InfoTip text={"Goes between the parts of a file name.\n\nWith a dot: 2024-03-15.NYC - Highline.jpg."} />
                </div>
                <div style={s.sepRow}>
                  {(['.', '-', '_', ' ', '|'] as FileNamingSep[]).map(v => (
                    <button
                      key={v}
                      style={{ ...s.sepPill, ...(sep === v ? s.sepPillActive : {}) }}
                      onClick={() => { setSep(v) }}
                    >
                      {v === ' ' ? 'Space' : v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional parts */}
              <div style={{ ...s.section, borderTop: '1px solid var(--ff-border)' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Optional parts</p>
                  <InfoTip text="Each part goes before (prefix) or after (suffix) the core, joined by the separator." />
                </div>

                {/* Date stamp */}
                <div style={s.optRow}>
                  <div style={s.optLabelGroup}>
                    <span style={s.optName}>Date stamp</span>
                  </div>
                  <PosToggle value={datePos} onChange={v => { setDatePos(v) }} />
                </div>
                {datePos !== 'off' && (
                  <div style={s.subOpts}>
                    <DateStampEditor value={dateFmt} onChange={setDateFmt} position={datePos === 'suffix' ? 'suffix' : 'prefix'} />
                  </div>
                )}

                {/* Auto-number */}
                <div style={{ ...s.optRow, marginTop: '6px' }}>
                  <div style={s.optLabelGroup}>
                    <span style={s.optName}>Auto-number</span>
                    <InfoTip text="A counter (001, 002, 003…) that starts again at 001 for each download." />
                  </div>
                  <PosToggle value={seqPos} onChange={v => { setSeqPos(v) }} />
                </div>

                {/* Custom label */}
                <div style={{ ...s.optRow, marginTop: '6px' }}>
                  <div style={s.optLabelGroup}>
                    <span style={s.optName}>Custom label</span>
                  </div>
                  <PosToggle value={customPos} onChange={v => { setCustomPos(v) }} />
                </div>
                {customPos !== 'off' && (
                  <div style={s.subOpts}>
                    <input
                      type="text"
                      value={customText}
                      onChange={e => { setCustomText(e.target.value) }}
                      placeholder="e.g. Vacation, Japan 2024…"
                      style={s.textInput}
                    />
                  </div>
                )}

                {/* Size token */}
                <div style={{ ...s.optRow, marginTop: '6px' }}>
                  <div style={s.optLabelGroup}>
                    <span style={s.optName}>Size code</span>
                    <InfoTip text="Adds a short size code to the file name: o (original), xl, l, m, s or sq (square). Useful when downloading different sizes of the same photo." />
                  </div>
                  <PosToggle value={sizeTokenPos} onChange={v => { setSizeTokenPos(v) }} />
                </div>
              </div>

              {/* Clean-up */}
              <div style={{ ...s.section, borderTop: '1px solid var(--ff-border)' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Clean-up</p>
                  <InfoTip text="Changes how the file name is written." />
                </div>

                {/* Case */}
                <div style={s.optRow}>
                  <div style={s.optLabelGroup}>
                    <span style={s.optName}>Case</span>
                  </div>
                  <div style={s.posGroup}>
                    {(['none', 'lowercase', 'uppercase'] as CaseTransform[]).map((v, idx, arr) => (
                      <button
                        key={v}
                        style={{
                          ...s.posBtn,
                          ...(caseTransform === v ? s.posBtnActive : {}),
                          ...(idx === arr.length - 1 ? { borderRight: 'none' } : {})
                        }}
                        onClick={() => { setCaseTransform(v) }}
                      >
                        {v === 'none' ? 'None' : v === 'lowercase' ? 'lower' : 'UPPER'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Char substitution */}
                <div style={{ ...s.optRow, marginTop: '6px' }}>
                  <div style={s.optLabelGroup}>
                    <span style={s.optName}>Replace spaces</span>
                    <InfoTip text={'Replaces each space in the title with your separator. With a dot, "NYC - Highline" becomes "NYC.-.Highline".'} />
                  </div>
                  <div style={s.posGroup}>
                    <button
                      style={{ ...s.posBtn, ...(charSubstitution ? {} : s.posBtnActive) }}
                      onClick={() => { setCharSubstitution(false) }}
                    >Off</button>
                    <button
                      style={{ ...s.posBtn, borderRight: 'none', ...(charSubstitution ? s.posBtnActive : {}) }}
                      onClick={() => { setCharSubstitution(true) }}
                    >On</button>
                  </div>
                </div>

                {/* Char substitution presets */}
                <div style={{ ...s.optRow, marginTop: '6px', flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={s.optName}>Character substitutions</span>
                    <InfoTip text="Special characters are kept in file names by default. Turn these on to remove them." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                    {([
                      ['subStripParens',    subStripParens,    setSubStripParens,    'Strip parentheses',   'e.g. Title (2024) → Title 2024'],
                      ['subStripBrackets',  subStripBrackets,  setSubStripBrackets,  'Strip square brackets', 'e.g. Title [edit] → Title edit'],
                    ] as [string, boolean, (v: boolean) => void, string, string][]).map(([key, val, setter, label, example]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: 'var(--ff-cream)', border: '1px solid var(--ff-border)' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '400', color: 'var(--ff-text)' }}>{label}</div>
                          <div style={{ fontSize: '11px', color: 'var(--ff-text-secondary)', fontFamily: 'monospace', marginTop: '0px' }}>{example}</div>
                        </div>
                        <div style={s.posGroup}>
                          <button style={{ ...s.posBtn, ...(!val ? s.posBtnActive : {}) }} onClick={() => { setter(false) }}>Off</button>
                          <button style={{ ...s.posBtn, borderRight: 'none', ...(val ? s.posBtnActive : {}) }} onClick={() => { setter(true) }}>On</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'metadata' && (
            <>
              <div style={s.section}>
                <div style={s.sectionLabel}>Core metadata</div>
                {([
                  ['embedTitle',       'Title',       'Photo title embeds as XMP Title and IPTC Object Name.'],
                  ['embedDescription', 'Description', 'Photo description embeds as XMP Description and IPTC Caption.'],
                  ['embedTags',        'Tags',        'Flickr tags embed as XMP Subject and IPTC Keywords.\n\nMachine tags are excluded.'],
                  ['embedDateTaken',   'Date taken',  'Date and time the photo was taken (DateTimeOriginal / CreateDate).'],
                  ['embedCreator',     'Creator',     'Flickr account display name, embedded as XMP Creator and IPTC By-line.'],
                ] as [string, string, string][]).map(([key, label, tip]) => {
                  const stateMap: Record<string, [boolean, (v: boolean) => void]> = {
                    embedTitle:       [embedTitle,       setEmbedTitle],
                    embedDescription: [embedDescription, setEmbedDescription],
                    embedTags:        [embedTags,        setEmbedTags],
                    embedDateTaken:   [embedDateTaken,   setEmbedDateTaken],
                    embedCreator:     [embedCreator,     setEmbedCreator],
                  }
                  const [val, setter] = stateMap[key]
                  return (
                    <React.Fragment key={key}>
                    <div style={s.optRow}>
                      <div style={s.optLabelGroup}>
                        <span style={s.optName}>{label}</span>
                        <InfoTip text={tip} />
                      </div>
                      <div style={s.posGroup}>
                        <button style={{ ...s.posBtn, ...(!val ? s.posBtnActive : {}) }} onClick={() => { setter(false) }}>Off</button>
                        <button style={{ ...s.posBtn, borderRight: 'none', ...(val ? s.posBtnActive : {}) }} onClick={() => { setter(true) }}>On</button>
                      </div>
                    </div>
                    {key === 'embedDescription' && embedDescription && (
                      <div style={{ ...s.optRow, marginTop: '4px', marginLeft: '24px' }}>
                        <div style={s.optLabelGroup}>
                          <span style={s.optName}><span style={s.subArrow} aria-hidden="true"><Icon name="return" /></span>Keep Flickr's HTML</span>
                          <InfoTip text={"Off (recommended): saved as plain text. Line breaks are kept, list items start with a dash, and each link is written as “text (address)”.\n\nOn: saved exactly as Flickr stores it, including tags like <a href=...>.\n\nThe optional sidecar file always keeps the original."} />
                        </div>
                        <div style={s.posGroup}>
                          <button style={{ ...s.posBtn, ...(!keepDescriptionHtml ? s.posBtnActive : {}) }} onClick={() => { setKeepDescriptionHtml(false) }}>Off</button>
                          <button style={{ ...s.posBtn, borderRight: 'none', ...(keepDescriptionHtml ? s.posBtnActive : {}) }} onClick={() => { setKeepDescriptionHtml(true) }}>On</button>
                        </div>
                      </div>
                    )}
                    </React.Fragment>
                  )
                })}
              </div>

              <div style={s.section}>
                <div style={s.sectionLabel}>Location</div>
                <div style={s.optRow}>
                  <div style={s.optLabelGroup}>
                    <span style={s.optName}>Location (GPS)</span>
                    <InfoTip text="Saves the photo's location in the file, when Flickr has one." />
                  </div>
                  <div style={s.posGroup}>
                    <button style={{ ...s.posBtn, ...(!embedGps ? s.posBtnActive : {}) }} onClick={() => { setEmbedGps(false) }}>Off</button>
                    <button style={{ ...s.posBtn, borderRight: 'none', ...(embedGps ? s.posBtnActive : {}) }} onClick={() => { setEmbedGps(true) }}>On</button>
                  </div>
                </div>
                {embedGps && (
                  <div style={{ ...s.optRow, marginTop: '4px', marginLeft: '24px' }}>
                    <div style={s.optLabelGroup}>
                      <span style={s.optName}><span style={s.subArrow} aria-hidden="true"><Icon name="return" /></span>Leave GPS out of private photos</span>
                      <InfoTip text="Private photos are saved without a location, even when GPS is on." />
                    </div>
                    <div style={s.posGroup}>
                      <button style={{ ...s.posBtn, ...(!stripGpsFromPrivate ? s.posBtnActive : {}) }} onClick={() => { setStripGpsFromPrivate(false) }}>Off</button>
                      <button style={{ ...s.posBtn, borderRight: 'none', ...(stripGpsFromPrivate ? s.posBtnActive : {}) }} onClick={() => { setStripGpsFromPrivate(true) }}>On</button>
                    </div>
                  </div>
                )}
              </div>

              <div style={s.section}>
                <div style={s.sectionLabel}>Rights and provenance</div>
                {([
                  ['embedLicense',  'CC license',     'Embeds the Flickr license as XMP Usage Terms (for example "CC BY 2.0").\n\nAlso embeds a link to the license page.'],
                  ['embedPhotoUrl', 'Photo page URL', 'Embeds the Flickr photo page URL (flickr.com/photos/…) as XMP Source.'],
                  ['embedPhotoId',  'Flickr photo ID', 'Embeds the unique Flickr numeric photo ID as XMP Identifier.'],
                ] as [string, string, string][]).map(([key, label, tip]) => {
                  const stateMap: Record<string, [boolean, (v: boolean) => void]> = {
                    embedLicense:  [embedLicense,  setEmbedLicense],
                    embedPhotoUrl: [embedPhotoUrl, setEmbedPhotoUrl],
                    embedPhotoId:  [embedPhotoId,  setEmbedPhotoId],
                  }
                  const [val, setter] = stateMap[key]
                  return (
                    <div key={key} style={s.optRow}>
                      <div style={s.optLabelGroup}>
                        <span style={s.optName}>{label}</span>
                        <InfoTip text={tip} />
                      </div>
                      <div style={s.posGroup}>
                        <button style={{ ...s.posBtn, ...(!val ? s.posBtnActive : {}) }} onClick={() => { setter(false) }}>Off</button>
                        <button style={{ ...s.posBtn, borderRight: 'none', ...(val ? s.posBtnActive : {}) }} onClick={() => { setter(true) }}>On</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={s.section}>
                <div style={s.sectionLabel}>Output files</div>
                <div style={s.optRow}>
                  <div style={s.optLabelGroup}>
                    <span style={s.optName}>Sidecar JSON</span>
                    <InfoTip text="Saves a .json file next to each photo or video with its Flickr details (title, tags, date, GPS, license and more)." />
                  </div>
                  <div style={s.posGroup}>
                    <button style={{ ...s.posBtn, ...(!writeSidecarJson ? s.posBtnActive : {}) }} onClick={() => { setWriteSidecarJson(false) }}>Off</button>
                    <button style={{ ...s.posBtn, borderRight: 'none', ...(writeSidecarJson ? s.posBtnActive : {}) }} onClick={() => { setWriteSidecarJson(true) }}>On</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Scroll fade + chevron — shown whenever content is scrollable and not at the bottom */}
        {showFade && (
          <div style={s.scrollFade}>
            <span style={s.scrollChevron}><Icon name="chevronDown" /></span>
          </div>
        )}

        {/* Live preview — only on naming tab */}
        {activeTab === 'naming' && (
          <div style={s.previewBox}>
            <div style={s.previewLabelRow}>
              <span style={s.previewLabel}>Preview</span>
            </div>
            <span style={s.previewValue}>{preview}</span>
          </div>
        )}

        {/* Footer */}
        <div style={{ ...s.footer, justifyContent: 'space-between' }}>
          <div style={s.footerLeft}>
            {confirmReset ? (
              <div style={s.resetConfirm}>
                <span style={s.resetConfirmText}>Reset all settings to defaults?</span>
                <button style={s.resetCancelBtn} onClick={() => setConfirmReset(false)}>Cancel</button>
                <button style={s.resetConfirmBtn} onClick={handleReset}>Reset</button>
              </div>
            ) : resetDone ? (
              <span style={s.resetDoneText}><Icon name="check" /> Defaults restored</span>
            ) : (
              <button style={s.restoreDefaultsBtn} onClick={() => setConfirmReset(true)}>Restore defaults</button>
            )}
          </div>
          <div style={s.footerRight}>
            <button style={s.cancelBtn} onClick={onClose}>Done</button>
          </div>
        </div>
</Dialog>
  )
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 0', flexShrink: 0 },
  title: { ...headingScreen },
  updateBanner: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 24px', backgroundColor: 'var(--ff-info-bg)', borderBottom: '1px solid var(--ff-info-line)', flexShrink: 0 },
  updateText: { flex: 1, fontSize: '13px', color: 'var(--ff-blue)', fontWeight: '400' },
  updateBtn: { ...smallBtn, flexShrink: 0 },
  tabBar: { display: 'flex', padding: '0 24px', marginTop: '16px', borderBottom: '1px solid var(--ff-border)', flexShrink: 0 },
  tabBtn: { ...tabMark, background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '8px 12px', fontSize: '13px', fontWeight: '400', color: 'var(--ff-text-secondary)', cursor: 'pointer', marginBottom: '0px', transition: 'color 0.15s' },
  tabBtnActive: { color: 'var(--ff-pink)', borderBottom: '2px solid var(--ff-pink)' },
  content: { overflowY: 'auto', flex: 1 },
  section: { padding: '16px 24px' },
  sectionRow: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' },
  sectionTitle: { fontSize: '11px', fontWeight: '700', color: 'var(--ff-text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: 0 },

  // Tooltip

  // Download folder
  folderRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--ff-border)', backgroundColor: 'var(--ff-cream)' },
  folderPath: { flex: 1, fontSize: '12px', color: 'var(--ff-text-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  changeBtn: { ...smallBtn, flexShrink: 0 },

  // Radio option list
  optionList: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
  radioRow: { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', borderRadius: '8px', boxShadow: 'inset 0 0 0 1.5px var(--ff-border)', background: 'var(--ff-cream)', cursor: 'pointer', outline: 'none' },
  radioRowActive: { boxShadow: 'inset 0 0 0 2px var(--ff-pink)', background: 'color-mix(in srgb, var(--ff-pink) 4%, transparent)' },
  radioLabel: { fontSize: '13px', fontWeight: '400', color: 'var(--ff-text)' },
  radioDesc: { fontSize: '11px', color: 'var(--ff-text-secondary)', marginTop: '0px' },

  // Toggles
  toggleList: { display: 'flex', flexDirection: 'column' as const, gap: '8px' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--ff-border)', backgroundColor: 'var(--ff-cream)', cursor: 'pointer' },
  toggleInfo: { display: 'flex', flexDirection: 'column' as const, gap: '2px' },
  toggleLabel: { fontSize: '14px', fontWeight: '400', color: 'var(--ff-text)' },
  toggleDesc: { fontSize: '12px', color: 'var(--ff-text-secondary)' },
  toggle: { position: 'relative' as const, width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 },
  toggleKnob: { position: 'absolute' as const, top: '2px', left: '2px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--ff-surface)', boxShadow: '0 1px 3px var(--ff-shadow-strong)', transition: 'transform 0.2s' },

  // Core grid
  coreGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' },
  coreOption: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', boxShadow: 'inset 0 0 0 1.5px var(--ff-border)', background: 'var(--ff-cream)', cursor: 'pointer', outline: 'none' },
  coreOptionActive: { boxShadow: 'inset 0 0 0 2px var(--ff-pink)', background: 'color-mix(in srgb, var(--ff-pink) 5%, transparent)' },
  radioHidden: { display: 'none' as const },
  radioCircle: { width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid var(--ff-line-strong)', flexShrink: 0, backgroundColor: 'var(--ff-surface)', transition: 'border-color 0.1s, box-shadow 0.1s', marginTop: '0px' },
  radioCircleSm: { width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid var(--ff-line-strong)', flexShrink: 0, backgroundColor: 'var(--ff-surface)', transition: 'border-color 0.1s, box-shadow 0.1s' },
  radioCircleActive: { borderColor: 'var(--ff-pink)', boxShadow: 'inset 0 0 0 4px var(--ff-pink)' },
  coreLabel: { fontSize: '13px', fontWeight: '400', color: 'var(--ff-text)' },
  coreExample: { fontSize: '11px', color: 'var(--ff-text-secondary)', fontFamily: 'monospace', marginTop: '0px' },

  // Separator
  sepRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  sepPill: { padding: '4px 16px', borderRadius: '50px', border: '1.5px solid var(--ff-line-strong)', background: 'var(--ff-cream)', fontSize: '13px', fontFamily: 'monospace', color: 'var(--ff-text-secondary)', cursor: 'pointer' },
  sepPillActive: { borderColor: 'var(--ff-pink)', background: 'color-mix(in srgb, var(--ff-pink) 6%, transparent)', color: 'var(--ff-pink)', fontWeight: '700' },

  // Optional parts
  optRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--ff-border)', background: 'var(--ff-cream)' },
  optLabelGroup: { display: 'flex', alignItems: 'center', gap: '4px', flex: 1 },
  subArrow: { color: 'var(--ff-text-secondary)', marginRight: '6px', fontWeight: '400' },
  optName: { fontSize: '13px', fontWeight: '400', color: 'var(--ff-text)' },
  posGroup: { display: 'flex', border: '1px solid var(--ff-line-strong)', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 },
  posBtn: { background: 'var(--ff-surface)', border: 'none', borderRight: '1px solid var(--ff-line-strong)', padding: '4px 8px', fontSize: '12px', color: 'var(--ff-text)', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  posBtnActive: { background: 'var(--ff-pink)', color: 'var(--ff-white)', fontWeight: '700' },
  subOpts: { margin: '0px 0 0', padding: '8px 12px', background: 'color-mix(in srgb, var(--ff-pink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ff-pink) 12%, transparent)', borderTop: 'none', borderRadius: '0 0 8px 8px', display: 'flex', flexDirection: 'column' as const, gap: '6px' },
  subOptRow: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
  textInput: { ...fieldBox, width: '100%', boxSizing: 'border-box' as const },

  // Scroll fade + chevron
  scrollFade: { height: '40px', background: 'linear-gradient(to top, var(--ff-white) 50%, transparent)', marginTop: '-40px', position: 'relative', zIndex: 1, pointerEvents: 'none', flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '6px' },
  scrollChevron: { fontSize: '11px', color: 'var(--ff-text-secondary)', background: 'var(--ff-shadow-soft)', borderRadius: '8px', padding: '2px 8px', lineHeight: 1 },

  // Preview (more prominent)
  previewBox: { margin: '0 24px 6px', padding: '12px 16px', background: 'var(--ff-warm)', border: '1.5px solid var(--ff-line-strong)', borderRadius: '8px', display: 'flex', flexDirection: 'column' as const, gap: '6px', flexShrink: 0 },
  previewLabelRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  previewLabel: { fontSize: '11px', fontWeight: '700', color: '#b08060', textTransform: 'uppercase' as const, letterSpacing: '0.1em' },
  previewValue: { fontSize: '13px', fontFamily: 'monospace', color: 'var(--ff-text)', wordBreak: 'break-all' as const, fontWeight: '400' },

  // Footer
  footer: { padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexShrink: 0, borderTop: '1px solid var(--ff-border)' },
  footerLeft: { display: 'flex', alignItems: 'center' },
  footerRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  restoreDefaultsBtn: { ...putAsideBtn },
  resetConfirm: { display: 'flex', alignItems: 'center', gap: '8px' },
  resetConfirmText: { fontSize: '12px', color: 'var(--ff-text-secondary)' },
  resetCancelBtn: { ...smallBtn },
  resetConfirmBtn: { background: 'var(--ff-error)', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: '700', color: 'var(--ff-white)', cursor: 'pointer' },
  resetDoneText: { fontSize: '12px', color: 'var(--ff-text-secondary)' },
  cancelBtn: { ...quietBtn },
  saveBtn: { ...primaryBtn },
  saveBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
}
