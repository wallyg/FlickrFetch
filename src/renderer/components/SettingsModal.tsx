import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type {
  FileNamingConfig, FileNamingCore, FileNamingSep, DateFormat, PartPosition,
  AppSettings, CaseTransform, DownloadSize, ConflictBehavior, MetadataSettings
} from '../../shared/types'

type Tab = 'general' | 'downloads' | 'naming' | 'metadata'

const DATE_EXAMPLES: Record<DateFormat, string> = {
  'YYYY-MM-DD':          '2024-03-15',
  'YYYY-MM-DD HH-MM-SS': '2024-03-15 14-22-05',
  'YYYY.MM.DD':          '2024.03.15',
  'YYYY.MM.DD HH.MM.SS': '2024.03.15 14.22.05',
}

const SIZE_TOKEN_MAP: Record<DownloadSize, string> = {
  original: 'o', xlarge: 'xl', large: 'l', medium: 'm', small: 's', square: 'sq'
}

function RadioDot({ active, size = 16 }: { active: boolean; size?: number }): React.JSX.Element {
  const r = size / 2 - 1.25
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, marginTop: size === 16 ? '1px' : '0' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="white" stroke={active ? 'var(--ff-pink)' : '#ccc'} strokeWidth="1.5" />
      {active && <circle cx={size / 2} cy={size / 2} r={r - 3.5} fill="var(--ff-pink)" />}
    </svg>
  )
}

function InfoTip({ text, direction = 'down' }: { text: string; direction?: 'down' | 'up' }): React.JSX.Element {
  const [show, setShow] = useState(false)
  const bubbleStyle: React.CSSProperties = direction === 'up'
    ? { ...s.tipBubble, top: 'auto', bottom: 'calc(100% + 7px)' }
    : s.tipBubble
  return (
    <div style={s.tipWrap} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div style={s.tipIcon}>i</div>
      {show && <div style={bubbleStyle}>{text}</div>}
    </div>
  )
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }): React.JSX.Element {
  return (
    <div style={s.toggleRow} onClick={() => onChange(!value)} role="switch" aria-checked={value}>
      <div style={s.toggleInfo}>
        <span style={s.toggleLabel}>{label}</span>
        {desc && <span style={s.toggleDesc}>{desc}</span>}
      </div>
      <div style={{ ...s.toggle, backgroundColor: value ? 'var(--ff-pink)' : '#ccc' }}>
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

export default function SettingsModal({ onClose, updateVersion }: { onClose: () => void; updateVersion?: string }): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('general')

  // General tab
  const [showDockProgress, setShowDockProgress] = useState(true)
  const [notifyOnComplete, setNotifyOnComplete] = useState(true)

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

  // Naming tab
  const [core, setCore] = useState<FileNamingCore>('title')
  const [sep, setSep] = useState<FileNamingSep>('.')
  const [datePos, setDatePos] = useState<PartPosition>('off')
  const [dateFmt, setDateFmt] = useState<DateFormat>('YYYY-MM-DD')
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
  const [resetDone, setResetDone] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const checkFade = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    setShowFade(el.scrollHeight > el.clientHeight + 4 && el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }, [])

  useEffect(() => { requestAnimationFrame(checkFade) }, [activeTab, checkFade])

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const applySettings = useCallback((settings: AppSettings) => {
    setShowDockProgress(settings.showDockProgress ?? true)
    setNotifyOnComplete(settings.notifyOnComplete ?? true)
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
    }
  }, [])

  const handleReset = useCallback(async () => {
    const defaults = await window.flickrAPI.resetSettings()
    applySettings(defaults)
    setConfirmReset(false)
    setResetDone(true)
    setTimeout(() => setResetDone(false), 2000)
  }, [applySettings])

  useEffect(() => {
    window.flickrAPI.getSettings().then((settings: AppSettings) => {
      applySettings(settings)
      hasLoadedRef.current = true
    })
  }, [])

  // Auto-save with 300ms debounce whenever any setting changes after initial load
  useEffect(() => {
    if (!hasLoadedRef.current) return
    const timer = setTimeout(() => {
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
        embedGps, stripGpsFromPrivate, embedLicense, embedPhotoUrl, embedPhotoId
      }
      window.flickrAPI.setSettings({
        fileNaming, downloadFolder, showDockProgress, notifyOnComplete,
        conflictBehavior, downloadSize, openFinderOnComplete, metadata
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [
    core, sep, datePos, dateFmt, seqPos, customPos, customText,
    caseTransform, charSubstitution, subStripParens, subStripBrackets,
    sizeTokenPos, downloadFolder, showDockProgress, notifyOnComplete,
    conflictBehavior, downloadSize, openFinderOnComplete,
    embedTitle, embedDescription, embedTags,
    embedDateTaken, embedCreator, embedGps, stripGpsFromPrivate,
    embedLicense, embedPhotoUrl, embedPhotoId
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
    if (datePos === 'prefix') pre.push(DATE_EXAMPLES[dateFmt])
    if (datePos === 'suffix') suf.push(DATE_EXAMPLES[dateFmt])
    if (seqPos === 'prefix') pre.push('001')
    if (seqPos === 'suffix') suf.push('001')
    const ct = customText.trim() || 'MyText'
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

  return (
    <div style={s.overlay}>
      <div style={s.card} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <h2 style={s.title}>Settings</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {updateVersion && (
          <div style={s.updateBanner}>
            <span style={s.updateText}>⬆ FlickrFetch {updateVersion} is available</span>
            <button style={s.updateBtn} onClick={() => window.flickrAPI.openExternal('https://github.com/wallyg/FlickrFetch/releases/latest')}>
              Download
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div style={s.tabBar}>
          {(['general', 'downloads', 'naming', 'metadata'] as Tab[]).map(tab => (
            <button
              key={tab}
              style={{ ...s.tabBtn, ...(activeTab === tab ? s.tabBtnActive : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'general' ? 'General' : tab === 'downloads' ? 'Downloads' : tab === 'naming' ? 'File Naming' : 'Metadata'}
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
                  <p style={s.sectionTitle}>Notifications &amp; Dock</p>
                </div>
                <div style={s.toggleList}>
                  <Toggle
                    value={showDockProgress}
                    onChange={v => { setShowDockProgress(v) }}
                    label="Show dock progress"
                    desc="Animate the dock icon during downloads"
                  />
                  <Toggle
                    value={notifyOnComplete}
                    onChange={v => { setNotifyOnComplete(v) }}
                    label="Notify when complete"
                    desc="macOS notification when a batch finishes"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── DOWNLOADS TAB ── */}
          {activeTab === 'downloads' && (
            <>
              {/* Download folder */}
              <div style={s.section}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Download Folder</p>
                  <InfoTip text="Where batch downloads are saved. Single-photo downloads use your Mac's Save dialog instead." />
                </div>
                <div style={s.folderRow}>
                  <span style={s.folderPath}>{downloadFolder || '—'}</span>
                  <button style={s.changeBtn} onClick={handlePickFolder}>Change…</button>
                </div>
              </div>

              {/* Download size */}
              <div style={{ ...s.section, borderTop: '1px solid #f0ede8' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Photo Resolution</p>
                  <InfoTip text="Which image size to download. Original is always recommended for archiving. Videos always download at highest quality regardless." />
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

              {/* Conflict behavior */}
              <div style={{ ...s.section, borderTop: '1px solid #f0ede8' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>If File Already Exists</p>
                  <InfoTip direction="up" text="What to do when a downloaded file has the same name as one already in the folder." />
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
              <div style={{ ...s.section, borderTop: '1px solid #f0ede8' }}>
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
                  <InfoTip text="The required center of every filename. Optional parts wrap around it." />
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

              {/* Part separator */}
              <div style={{ ...s.section, borderTop: '1px solid #f0ede8' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Part Separator</p>
                  <InfoTip text="Joins all parts together. Example: 2024-03-15·NYC - Highline.jpg (where · is your chosen separator)." />
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
              <div style={{ ...s.section, borderTop: '1px solid #f0ede8' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Optional Parts</p>
                  <InfoTip text="Each part wraps around the core using the separator. Prefix goes before, suffix after." />
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
                    {(['YYYY-MM-DD', 'YYYY-MM-DD HH-MM-SS', 'YYYY.MM.DD', 'YYYY.MM.DD HH.MM.SS'] as DateFormat[]).map(f => (
                      <div key={f} style={s.subOptRow} onClick={() => { setDateFmt(f) }} role="radio" aria-checked={dateFmt === f}>
                        <RadioDot active={dateFmt === f} size={14} />
                        <span style={s.fmtLabel}>{f}</span>
                        <span style={s.fmtExample}>{DATE_EXAMPLES[f]}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Auto-number */}
                <div style={{ ...s.optRow, marginTop: '6px' }}>
                  <div style={s.optLabelGroup}>
                    <span style={s.optName}>Auto-number</span>
                    <InfoTip text="001, 002, 003… counter that resets at the start of each batch." />
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
                    <span style={s.optName}>Size indicator</span>
                    <InfoTip direction="up" text="Adds the download size to the filename: orig, xl, lg, med, sm, sq. Useful when downloading different sizes of the same photo." />
                  </div>
                  <PosToggle value={sizeTokenPos} onChange={v => { setSizeTokenPos(v) }} />
                </div>
              </div>

              {/* Title transform */}
              <div style={{ ...s.section, borderTop: '1px solid #f0ede8' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Title Transform</p>
                  <InfoTip direction="up" text="Applied to the entire assembled filename." />
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
                    <InfoTip direction="up" text="Replaces spaces in the title with the part separator. NYC - Highline → NYC.-.-Highline (with . separator)." />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={s.optName}>Character substitutions</span>
                    <InfoTip direction="up" text="Parentheses and square brackets are legal in filenames and kept as-is by default. Turn these on to strip them for cleaner filenames." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '5px' }}>
                    {([
                      ['subStripParens',    subStripParens,    setSubStripParens,    'Strip parentheses',   'e.g. Title (2024) → Title 2024'],
                      ['subStripBrackets',  subStripBrackets,  setSubStripBrackets,  'Strip square brackets', 'e.g. Title [edit] → Title edit'],
                    ] as [string, boolean, (v: boolean) => void, string, string][]).map(([key, val, setter, label, example]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: '#fafaf8', border: '1px solid #eeebe6' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '500', color: '#333' }}>{label}</div>
                          <div style={{ fontSize: '11px', color: '#aaa', fontFamily: 'monospace', marginTop: '1px' }}>{example}</div>
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
                  ['embedTags',        'Tags',        'Flickr tags embed as XMP Subject and IPTC Keywords. Machine tags are excluded.'],
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
                <div style={s.sectionLabel}>Location</div>
                <div style={s.optRow}>
                  <div style={s.optLabelGroup}>
                    <span style={s.optName}>GPS coordinates</span>
                    <InfoTip text="Embeds GPS latitude and longitude from Flickr's location data, if available." />
                  </div>
                  <div style={s.posGroup}>
                    <button style={{ ...s.posBtn, ...(!embedGps ? s.posBtnActive : {}) }} onClick={() => { setEmbedGps(false) }}>Off</button>
                    <button style={{ ...s.posBtn, borderRight: 'none', ...(embedGps ? s.posBtnActive : {}) }} onClick={() => { setEmbedGps(true) }}>On</button>
                  </div>
                </div>
                {embedGps && (
                  <div style={{ ...s.optRow, marginTop: '4px' }}>
                    <div style={s.optLabelGroup}>
                      <span style={{ ...s.optName, color: '#888' }}>Strip GPS from private</span>
                      <InfoTip text="When a photo is private, skip GPS even if GPS embedding is on. Useful for location privacy." />
                    </div>
                    <div style={s.posGroup}>
                      <button style={{ ...s.posBtn, ...(!stripGpsFromPrivate ? s.posBtnActive : {}) }} onClick={() => { setStripGpsFromPrivate(false) }}>Off</button>
                      <button style={{ ...s.posBtn, borderRight: 'none', ...(stripGpsFromPrivate ? s.posBtnActive : {}) }} onClick={() => { setStripGpsFromPrivate(true) }}>On</button>
                    </div>
                  </div>
                )}
              </div>

              <div style={s.section}>
                <div style={s.sectionLabel}>Rights &amp; provenance</div>
                {([
                  ['embedLicense',  'CC license',     'Embeds the Flickr license as XMP Usage Terms (e.g. "CC BY 2.0") and a link to the license URL.'],
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
            </>
          )}
        </div>

        {/* Scroll fade + chevron — shown whenever content is scrollable and not at the bottom */}
        {showFade && (
          <div style={s.scrollFade}>
            <span style={s.scrollChevron}>▼</span>
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
              <span style={s.resetDoneText}>✓ Defaults restored</span>
            ) : (
              <button style={s.restoreDefaultsBtn} onClick={() => setConfirmReset(true)}>Restore defaults</button>
            )}
          </div>
          <div style={s.footerRight}>
            <button style={s.cancelBtn} onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600 },
  card: { backgroundColor: '#fff', borderRadius: '12px', width: '480px', maxWidth: '90vw', height: '660px', maxHeight: '90vh', boxShadow: '0 8px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0', flexShrink: 0 },
  title: { fontSize: '18px', fontWeight: '600', color: '#111', margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: '16px', color: '#888', cursor: 'pointer', padding: '4px' },
  updateBanner: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 24px', backgroundColor: '#edf4ff', borderBottom: '1px solid #cce0ff', flexShrink: 0 },
  updateText: { flex: 1, fontSize: '13px', color: '#0063DC', fontWeight: '500' },
  updateBtn: { background: '#0063DC', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 },
  tabBar: { display: 'flex', padding: '0 24px', marginTop: '16px', borderBottom: '1px solid #e8e4de', flexShrink: 0 },
  tabBtn: { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '8px 14px', fontSize: '13px', fontWeight: '500', color: '#888', cursor: 'pointer', marginBottom: '-1px', transition: 'color 0.15s' },
  tabBtnActive: { color: 'var(--ff-pink)', borderBottom: '2px solid var(--ff-pink)' },
  content: { overflowY: 'auto', flex: 1 },
  section: { padding: '18px 24px' },
  sectionRow: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' },
  sectionTitle: { fontSize: '11px', fontWeight: '600', color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: 0 },

  // Tooltip
  tipWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  tipIcon: { width: '15px', height: '15px', borderRadius: '50%', background: '#ece8e2', color: '#888', fontSize: '9px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', userSelect: 'none' as const },
  tipBubble: { position: 'absolute', top: 'calc(100% + 7px)', left: '0', background: '#1a1a1a', color: '#f0ede8', fontSize: '12px', lineHeight: '1.45', padding: '7px 10px', borderRadius: '6px', whiteSpace: 'normal' as const, pointerEvents: 'none', zIndex: 200, width: '220px', textAlign: 'left' as const, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' },

  // Download folder
  folderRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #eee', backgroundColor: '#fafafa' },
  folderPath: { flex: 1, fontSize: '12px', color: '#555', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  changeBtn: { background: 'none', border: '1px solid #ccc', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', color: '#555', cursor: 'pointer', flexShrink: 0 },

  // Radio option list
  optionList: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
  radioRow: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 12px', borderRadius: '8px', boxShadow: 'inset 0 0 0 1.5px #dedad4', background: '#fafaf8', cursor: 'pointer', outline: 'none' },
  radioRowActive: { boxShadow: 'inset 0 0 0 2px var(--ff-pink)', background: 'rgba(255,0,132,0.04)' },
  radioLabel: { fontSize: '13px', fontWeight: '500', color: '#222' },
  radioDesc: { fontSize: '11px', color: '#999', marginTop: '1px' },

  // Toggles
  toggleList: { display: 'flex', flexDirection: 'column' as const, gap: '8px' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #eee', backgroundColor: '#fafafa', cursor: 'pointer' },
  toggleInfo: { display: 'flex', flexDirection: 'column' as const, gap: '2px' },
  toggleLabel: { fontSize: '14px', fontWeight: '500', color: '#222' },
  toggleDesc: { fontSize: '12px', color: '#888' },
  toggle: { position: 'relative' as const, width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 },
  toggleKnob: { position: 'absolute' as const, top: '2px', left: '2px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'transform 0.2s' },

  // Core grid
  coreGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' },
  coreOption: { display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 11px', borderRadius: '8px', boxShadow: 'inset 0 0 0 1.5px #dedad4', background: '#fafaf8', cursor: 'pointer', outline: 'none' },
  coreOptionActive: { boxShadow: 'inset 0 0 0 2px var(--ff-pink)', background: 'rgba(255,0,132,0.05)' },
  radioHidden: { display: 'none' as const },
  radioCircle: { width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #ccc', flexShrink: 0, backgroundColor: '#fff', transition: 'border-color 0.1s, box-shadow 0.1s', marginTop: '1px' },
  radioCircleSm: { width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid #ccc', flexShrink: 0, backgroundColor: '#fff', transition: 'border-color 0.1s, box-shadow 0.1s' },
  radioCircleActive: { borderColor: 'var(--ff-pink)', boxShadow: 'inset 0 0 0 4px var(--ff-pink)' },
  coreLabel: { fontSize: '13px', fontWeight: '500', color: '#333' },
  coreExample: { fontSize: '11px', color: '#888', fontFamily: 'monospace', marginTop: '1px' },

  // Separator
  sepRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  sepPill: { padding: '5px 16px', borderRadius: '20px', border: '1.5px solid #ddd', background: '#fafaf8', fontSize: '13px', fontFamily: 'monospace', color: '#555', cursor: 'pointer' },
  sepPillActive: { borderColor: 'var(--ff-pink)', background: 'rgba(255,0,132,0.06)', color: 'var(--ff-pink)', fontWeight: '600' },

  // Optional parts
  optRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 11px', borderRadius: '8px', border: '1px solid #eeebe6', background: '#fafaf8' },
  optLabelGroup: { display: 'flex', alignItems: 'center', gap: '5px', flex: 1 },
  optName: { fontSize: '13px', fontWeight: '500', color: '#333' },
  posGroup: { display: 'flex', border: '1px solid #d8d4ce', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 },
  posBtn: { background: 'none', border: 'none', borderRight: '1px solid #d8d4ce', padding: '4px 10px', fontSize: '12px', color: '#777', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  posBtnActive: { background: 'var(--ff-pink)', color: '#fff', fontWeight: '600' },
  subOpts: { margin: '1px 0 0', padding: '10px 12px', background: 'rgba(255,0,132,0.04)', border: '1px solid rgba(255,0,132,0.12)', borderTop: 'none', borderRadius: '0 0 8px 8px', display: 'flex', flexDirection: 'column' as const, gap: '7px' },
  subOptRow: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
  fmtLabel: { flex: 1, fontSize: '12px', color: '#333' },
  fmtExample: { fontSize: '11px', fontFamily: 'monospace', color: '#888' },
  textInput: { width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e0dcd8', background: '#fff', color: '#111', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },

  // Scroll fade + chevron
  scrollFade: { height: '40px', background: 'linear-gradient(to top, #fff 50%, transparent)', marginTop: '-40px', position: 'relative', zIndex: 1, pointerEvents: 'none', flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '6px' },
  scrollChevron: { fontSize: '10px', color: '#888', background: 'rgba(0,0,0,0.07)', borderRadius: '10px', padding: '2px 9px', lineHeight: 1 },

  // Preview (more prominent)
  previewBox: { margin: '0 24px 6px', padding: '12px 16px', background: '#f5f0ea', border: '1.5px solid #e0dbd2', borderRadius: '10px', display: 'flex', flexDirection: 'column' as const, gap: '6px', flexShrink: 0 },
  previewLabelRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  previewLabel: { fontSize: '10px', fontWeight: '700', color: '#b08060', textTransform: 'uppercase' as const, letterSpacing: '0.1em' },
  previewValue: { fontSize: '13px', fontFamily: 'monospace', color: '#111', wordBreak: 'break-all' as const, fontWeight: '500' },

  // Footer
  footer: { padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexShrink: 0, borderTop: '1px solid #f0ede8' },
  footerLeft: { display: 'flex', alignItems: 'center' },
  footerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  restoreDefaultsBtn: { background: 'none', border: 'none', padding: '4px 0', fontSize: '13px', color: '#aaa', cursor: 'pointer', textDecoration: 'underline' },
  resetConfirm: { display: 'flex', alignItems: 'center', gap: '8px' },
  resetConfirmText: { fontSize: '12px', color: '#555' },
  resetCancelBtn: { background: 'none', border: '1px solid #ccc', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#555', cursor: 'pointer' },
  resetConfirmBtn: { background: '#d44', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: '600', color: '#fff', cursor: 'pointer' },
  resetDoneText: { fontSize: '12px', color: '#888' },
  cancelBtn: { background: 'none', border: '1px solid #ccc', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', color: '#555', cursor: 'pointer' },
  saveBtn: { backgroundColor: 'var(--ff-pink-action)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 28px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  saveBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
}
