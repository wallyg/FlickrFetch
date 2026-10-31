import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { FileNamingConfig, FileNamingCore, FileNamingSep, DateFormat, PartPosition, AppSettings } from '../../shared/types'

type Tab = 'general' | 'naming'

const DATE_EXAMPLES: Record<DateFormat, string> = {
  'YYYY-MM-DD':          '2024-03-15',
  'YYYY-MM-DD HH-MM-SS': '2024-03-15 14-22-05',
  'YYYY.MM.DD':          '2024.03.15',
  'YYYY.MM.DD HH.MM.SS': '2024.03.15 14.22.05',
}

function InfoTip({ text }: { text: string }): React.JSX.Element {
  const [show, setShow] = useState(false)
  return (
    <div style={s.tipWrap} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div style={s.tipIcon}>i</div>
      {show && <div style={s.tipBubble}>{text}</div>}
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

export default function SettingsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('general')

  // General tab state
  const [downloadFolder, setDownloadFolder] = useState('')
  const [showDockProgress, setShowDockProgress] = useState(true)
  const [notifyOnComplete, setNotifyOnComplete] = useState(true)

  // File naming tab state
  const [core, setCore] = useState<FileNamingCore>('title')
  const [sep, setSep] = useState<FileNamingSep>('.')
  const [datePos, setDatePos] = useState<PartPosition>('off')
  const [dateFmt, setDateFmt] = useState<DateFormat>('YYYY-MM-DD')
  const [seqPos, setSeqPos] = useState<PartPosition>('off')
  const [customPos, setCustomPos] = useState<PartPosition>('off')
  const [customText, setCustomText] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  useEffect(() => {
    window.flickrAPI.getSettings().then((settings: AppSettings) => {
      setDownloadFolder(settings.downloadFolder)
      setShowDockProgress(settings.showDockProgress ?? true)
      setNotifyOnComplete(settings.notifyOnComplete ?? true)
      const fn = settings.fileNaming
      setCore(fn.core)
      setSep(fn.separator)
      setDatePos(fn.date.position)
      setDateFmt(fn.date.format)
      setSeqPos(fn.sequence.position)
      setCustomPos(fn.customText.position)
      setCustomText(fn.customText.text)
    })
  }, [])

  const preview = useMemo(() => {
    const TITLE = 'NYC - Highline'
    const ID = '12345678'
    let coreStr: string
    switch (core) {
      case 'id':       coreStr = ID; break
      case 'id-title': coreStr = `${ID}${sep}${TITLE}`; break
      case 'title-id': coreStr = `${TITLE}${sep}${ID}`; break
      default:         coreStr = TITLE
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
    return [...pre, coreStr, ...suf].join(sep) + '.jpg'
  }, [core, sep, datePos, dateFmt, seqPos, customPos, customText])

  const handlePickFolder = async (): Promise<void> => {
    const folder = await window.flickrAPI.pickFolder()
    if (folder) { setDownloadFolder(folder); setSaved(false) }
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    const fileNaming: FileNamingConfig = {
      core, separator: sep,
      date: { position: datePos, format: dateFmt },
      sequence: { position: seqPos },
      customText: { position: customPos, text: customText.trim() }
    }
    await window.flickrAPI.setSettings({ fileNaming, downloadFolder, showDockProgress, notifyOnComplete })
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 600)
  }

  return (
    <div style={s.overlay}>
      <div style={s.card} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <h2 style={s.title}>Settings</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={s.tabBar}>
          {(['general', 'naming'] as Tab[]).map(tab => (
            <button
              key={tab}
              style={{ ...s.tabBtn, ...(activeTab === tab ? s.tabBtnActive : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'general' ? 'General' : 'File Naming'}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div style={s.content}>

          {/* ── GENERAL TAB ── */}
          {activeTab === 'general' && (
            <>
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

              <div style={{ ...s.section, borderTop: '1px solid #f0ede8' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Notifications &amp; Dock</p>
                </div>
                <div style={s.toggleList}>
                  <div
                    style={s.toggleRow}
                    onClick={() => { setShowDockProgress(v => !v); setSaved(false) }}
                    role="switch"
                    aria-checked={showDockProgress}
                  >
                    <div style={s.toggleInfo}>
                      <span style={s.toggleLabel}>Show dock progress</span>
                      <span style={s.toggleDesc}>Animate the dock icon during downloads</span>
                    </div>
                    <div style={{ ...s.toggle, backgroundColor: showDockProgress ? '#FF0084' : '#ccc' }}>
                      <div style={{ ...s.toggleKnob, transform: showDockProgress ? 'translateX(20px)' : 'none' }} />
                    </div>
                  </div>
                  <div
                    style={s.toggleRow}
                    onClick={() => { setNotifyOnComplete(v => !v); setSaved(false) }}
                    role="switch"
                    aria-checked={notifyOnComplete}
                  >
                    <div style={s.toggleInfo}>
                      <span style={s.toggleLabel}>Notify when complete</span>
                      <span style={s.toggleDesc}>macOS notification when a batch finishes</span>
                    </div>
                    <div style={{ ...s.toggle, backgroundColor: notifyOnComplete ? '#FF0084' : '#ccc' }}>
                      <div style={{ ...s.toggleKnob, transform: notifyOnComplete ? 'translateX(20px)' : 'none' }} />
                    </div>
                  </div>
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
                    <label
                      key={val}
                      style={{ ...s.coreOption, ...(core === val ? s.coreOptionActive : {}) }}
                      onClick={() => { setCore(val); setSaved(false) }}
                    >
                      <input type="radio" name="core" checked={core === val} onChange={() => setCore(val)} style={s.radio} />
                      <div>
                        <div style={s.coreLabel}>{label}</div>
                        <div style={s.coreExample}>{example}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Separator */}
              <div style={{ ...s.section, borderTop: '1px solid #f0ede8' }}>
                <div style={s.sectionRow}>
                  <p style={s.sectionTitle}>Separator</p>
                  <InfoTip text="Joins all parts together. Example: 2024-03-15·NYC - Highline.jpg (where · is your chosen separator)." />
                </div>
                <div style={s.sepRow}>
                  {(['.', '-', '_', ' ', '|'] as FileNamingSep[]).map(v => (
                    <button
                      key={v}
                      style={{ ...s.sepPill, ...(sep === v ? s.sepPillActive : {}) }}
                      onClick={() => { setSep(v); setSaved(false) }}
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
                  <InfoTip text="Each part wraps around the core using the separator you chose above. Prefix goes before, suffix after." />
                </div>

                {/* Date */}
                <div style={s.optRow}>
                  <span style={s.optName}>Date</span>
                  <PosToggle value={datePos} onChange={v => { setDatePos(v); setSaved(false) }} />
                </div>
                {datePos !== 'off' && (
                  <div style={s.subOpts}>
                    {(['YYYY-MM-DD', 'YYYY-MM-DD HH-MM-SS', 'YYYY.MM.DD', 'YYYY.MM.DD HH.MM.SS'] as DateFormat[]).map(f => (
                      <label key={f} style={s.subOptRow}>
                        <input
                          type="radio"
                          name="dateFmt"
                          checked={dateFmt === f}
                          onChange={() => { setDateFmt(f); setSaved(false) }}
                          style={s.radio}
                        />
                        <span style={s.fmtLabel}>{f}</span>
                        <span style={s.fmtExample}>{DATE_EXAMPLES[f]}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Sequence */}
                <div style={{ ...s.optRow, marginTop: '6px' }}>
                  <span style={s.optName}>Sequence</span>
                  <InfoTip text="001, 002, 003… counter that resets at the start of each batch." />
                  <PosToggle value={seqPos} onChange={v => { setSeqPos(v); setSaved(false) }} />
                </div>

                {/* Custom text */}
                <div style={{ ...s.optRow, marginTop: '6px' }}>
                  <span style={s.optName}>Custom text</span>
                  <PosToggle value={customPos} onChange={v => { setCustomPos(v); setSaved(false) }} />
                </div>
                {customPos !== 'off' && (
                  <div style={s.subOpts}>
                    <input
                      type="text"
                      value={customText}
                      onChange={e => { setCustomText(e.target.value); setSaved(false) }}
                      placeholder="e.g. Vacation, Japan 2024…"
                      style={s.textInput}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Live preview — naming tab only */}
        {activeTab === 'naming' && (
          <div style={s.previewBox}>
            <span style={s.previewLabel}>Preview</span>
            <span style={s.previewValue}>{preview}</span>
          </div>
        )}

        {/* Footer */}
        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...s.saveBtn, ...(saving ? s.saveBtnDisabled : {}) }}
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  card: { backgroundColor: '#fff', borderRadius: '12px', width: '460px', maxWidth: '90vw', maxHeight: '85vh', boxShadow: '0 8px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0', flexShrink: 0 },
  title: { fontSize: '18px', fontWeight: '600', color: '#111', margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: '16px', color: '#888', cursor: 'pointer', padding: '4px' },
  tabBar: { display: 'flex', padding: '0 24px', marginTop: '16px', borderBottom: '1px solid #e8e4de', flexShrink: 0 },
  tabBtn: { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '8px 14px', fontSize: '13px', fontWeight: '500', color: '#888', cursor: 'pointer', marginBottom: '-1px', transition: 'color 0.15s' },
  tabBtnActive: { color: '#FF0084', borderBottom: '2px solid #FF0084' },
  content: { overflowY: 'auto', flex: 1 },
  section: { padding: '18px 24px' },
  sectionRow: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' },
  sectionTitle: { fontSize: '11px', fontWeight: '600', color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: 0 },

  // Tooltip
  tipWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  tipIcon: { width: '15px', height: '15px', borderRadius: '50%', background: '#ece8e2', color: '#888', fontSize: '9px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', userSelect: 'none' as const },
  tipBubble: { position: 'absolute', top: 'calc(100% + 7px)', left: '0', background: '#1a1a1a', color: '#f0ede8', fontSize: '12px', lineHeight: '1.45', padding: '7px 10px', borderRadius: '6px', whiteSpace: 'normal' as const, pointerEvents: 'none', zIndex: 200, width: '200px', textAlign: 'left' as const, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' },

  // Download folder
  folderRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #eee', backgroundColor: '#fafafa' },
  folderPath: { flex: 1, fontSize: '12px', color: '#555', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  changeBtn: { background: 'none', border: '1px solid #ccc', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', color: '#555', cursor: 'pointer', flexShrink: 0 },

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
  coreOption: { display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 11px', borderRadius: '8px', border: '1.5px solid #eeebe6', background: '#fafaf8', cursor: 'pointer' },
  coreOptionActive: { borderColor: '#FF0084', background: 'rgba(255,0,132,0.05)' },
  radio: { accentColor: '#FF0084', flexShrink: 0 },
  coreLabel: { fontSize: '13px', fontWeight: '500', color: '#333' },
  coreExample: { fontSize: '11px', color: '#888', fontFamily: 'monospace', marginTop: '1px' },

  // Separator
  sepRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' as const },
  sepPill: { padding: '5px 16px', borderRadius: '20px', border: '1.5px solid #ddd', background: '#fafaf8', fontSize: '13px', fontFamily: 'monospace', color: '#555', cursor: 'pointer' },
  sepPillActive: { borderColor: '#FF0084', background: 'rgba(255,0,132,0.06)', color: '#FF0084', fontWeight: '600' },

  // Optional parts
  optRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 11px', borderRadius: '8px', border: '1px solid #eeebe6', background: '#fafaf8' },
  optName: { fontSize: '13px', fontWeight: '500', color: '#333', flex: 1 },
  posGroup: { display: 'flex', border: '1px solid #d8d4ce', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 },
  posBtn: { background: 'none', border: 'none', borderRight: '1px solid #d8d4ce', padding: '4px 10px', fontSize: '12px', color: '#777', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  posBtnActive: { background: '#FF0084', color: '#fff', fontWeight: '600' },
  subOpts: { margin: '1px 0 0', padding: '10px 12px', background: 'rgba(255,0,132,0.04)', border: '1px solid rgba(255,0,132,0.12)', borderTop: 'none', borderRadius: '0 0 8px 8px', display: 'flex', flexDirection: 'column' as const, gap: '7px' },
  subOptRow: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
  fmtLabel: { flex: 1, fontSize: '12px', color: '#333' },
  fmtExample: { fontSize: '11px', fontFamily: 'monospace', color: '#888' },
  textInput: { width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e0dcd8', background: '#fff', color: '#111', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },

  // Preview
  previewBox: { margin: '0 24px 4px', padding: '10px 14px', background: '#fafaf8', border: '1px solid #eeebe6', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  previewLabel: { fontSize: '10px', fontWeight: '700', color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.08em', flexShrink: 0 },
  previewValue: { fontSize: '12px', fontFamily: 'monospace', color: '#111', wordBreak: 'break-all', flex: 1 },

  // Footer
  footer: { padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 },
  cancelBtn: { background: 'none', border: '1px solid #ccc', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', color: '#555', cursor: 'pointer' },
  saveBtn: { backgroundColor: '#FF0084', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 28px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  saveBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
}
