import React, { useState, useEffect } from 'react'
import type { AppSettings, MetadataSettings } from '../../shared/types'

const SIZE_LABELS: Record<string, string> = {
  original: 'Original',
  xlarge: 'Extra Large',
  large: 'Large',
  medium: 'Medium',
  small: 'Small',
  square: 'Square',
}

// Fields in Settings → Metadata tab order
const META_FIELDS: { key: keyof MetadataSettings; label: string }[] = [
  { key: 'embedTitle',       label: 'Title' },
  { key: 'embedDescription', label: 'Description' },
  { key: 'embedTags',        label: 'Tags' },
  { key: 'embedDateTaken',   label: 'Date Taken' },
  { key: 'embedCreator',     label: 'Creator' },
  { key: 'embedGps',         label: 'GPS Location' },
  { key: 'embedLicense',     label: 'CC License' },
  { key: 'embedPhotoUrl',    label: 'Photo Page URL' },
  { key: 'embedPhotoId',     label: 'Flickr Photo ID' },
]

export interface PendingDownload {
  title: string
  photoCount: number
  videoCount: number
  note?: string
  onConfirm: (track: boolean, exportFormat: 'files' | 'zip') => void
}

interface DownloadConfirmModalProps {
  pending: PendingDownload
  settingsKey: number
  onCancel: () => void
  onOpenSettings: () => void
}

export default function DownloadConfirmModal({ pending, settingsKey, onCancel, onOpenSettings }: DownloadConfirmModalProps): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [track, setTrack] = useState(true)
  const [exportFormat, setExportFormat] = useState<'files' | 'zip'>('files')

  useEffect(() => {
    window.flickrAPI.getSettings().then(setSettings).catch(() => {})
  }, [settingsKey])

  const handleConfirm = (): void => {
    pending.onConfirm(track, exportFormat)
    onCancel()
  }

  const meta = settings?.metadata
  const folder = settings?.downloadFolder ?? ''
  const folderDisplay = folder.replace(/^\/Users\/[^/]+/, '~')
  const quality = SIZE_LABELS[settings?.downloadSize ?? 'original'] ?? 'Original'
  const totalCount = pending.photoCount + pending.videoCount

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        <div style={s.header}>
          <h2 style={s.title}>Confirm Download</h2>
          <button style={s.closeBtn} onClick={onCancel}>✕</button>
        </div>

        <div style={s.body}>
          <p style={s.batchTitle}>{pending.title}</p>

          <p style={s.countLine}>
            {pending.photoCount > 0 && `${pending.photoCount.toLocaleString()} photo${pending.photoCount !== 1 ? 's' : ''}`}
            {pending.photoCount > 0 && pending.videoCount > 0 && ' · '}
            {pending.videoCount > 0 && `${pending.videoCount.toLocaleString()} video${pending.videoCount !== 1 ? 's' : ''}`}
            {totalCount === 0 && 'No items'}
          </p>
          {pending.note && <p style={s.countNote}>{pending.note}</p>}

          <div style={s.summaryCard}>
            <div style={s.settingsRow}>
              <span style={s.settingLabel}>Quality</span>
              <span style={s.settingValue}>{quality}</span>
            </div>
            {folderDisplay && (
              <div style={{ ...s.settingsRow, marginBottom: 0 }}>
                <span style={s.settingLabel}>Save to</span>
                <span style={s.settingValue} title={folder}>{folderDisplay}</span>
              </div>
            )}
          </div>

          <div style={s.metaSection}>
            <p style={s.metaHeading}>Metadata embedding</p>
            {meta ? (() => {
              const onFields = META_FIELDS.filter(f => meta[f.key] as boolean)
              const offFields = META_FIELDS.filter(f => !(meta[f.key] as boolean))
              return (
                <>
                  {onFields.length > 0 ? (
                    <div style={s.metaGrid}>
                      {onFields.map(({ key, label }) => (
                        <div key={key} style={s.metaItem}>
                          <span style={{ ...s.metaCheck, color: '#27ae60' }}>✓</span>
                          <span style={{ ...s.metaLabel, color: '#222' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: '#bbb', margin: '0 0 4px' }}>None</p>
                  )}
                  {offFields.length > 0 && (
                    <p style={s.offFields}>
                      Not embedding: {offFields.map(f => f.label).join(', ')}
                    </p>
                  )}
                </>
              )
            })() : (
              <p style={{ fontSize: '13px', color: '#bbb', margin: 0 }}>Loading…</p>
            )}
          </div>
        </div>

        <div style={s.formatRow}>
          <span style={s.formatLabel}>Export as</span>
          <div style={s.segGroup}>
            <button style={{ ...s.segBtn, ...(exportFormat === 'files' ? s.segBtnActive : {}) }} onClick={() => setExportFormat('files')}>
              Individual files
            </button>
            <button style={{ ...s.segBtn, ...s.segBtnLast, ...(exportFormat === 'zip' ? s.segBtnActive : {}) }} onClick={() => setExportFormat('zip')}>
              ZIP archive
            </button>
          </div>
        </div>

        <div style={s.trackRow}>
          <label style={s.trackLabel}>
            <input
              type="checkbox"
              checked={track}
              onChange={e => setTrack(e.target.checked)}
              style={{ marginRight: 8, cursor: 'pointer', width: 15, height: 15 }}
            />
            Track this download in history
          </label>
        </div>

        <div style={s.footer}>
          <button style={s.settingsLink} onClick={onOpenSettings}>Change Settings</button>
          <div style={s.footerBtns}>
            <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
            <button style={s.confirmBtn} onClick={handleConfirm}>
              {exportFormat === 'zip' ? 'Download as ZIP' : 'Start Download'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: '12px', width: '420px', maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 20px 0',
  },
  title: {
    margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--ff-navy)',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '15px', color: '#aaa',
    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
  body: {
    padding: '16px 20px 0',
  },
  batchTitle: {
    margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: '#111',
  },
  countLine: {
    margin: '0 0 4px', fontSize: '13px', color: '#666',
  },
  countNote: {
    margin: '0 0 0', fontSize: '11px', color: '#999', fontStyle: 'italic' as const,
  },
  summaryCard: {
    backgroundColor: '#f8f7f5', borderRadius: '8px', padding: '10px 12px',
    marginTop: '12px',
  },
  settingsRow: {
    display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px',
  },
  settingLabel: {
    fontSize: '12px', color: '#999', width: '52px', flexShrink: 0,
  },
  settingValue: {
    fontSize: '14px', color: '#111', fontWeight: '500', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1,
  },
  metaSection: {
    marginTop: '16px', borderTop: '1px solid #f0ede8', paddingTop: '12px',
  },
  metaHeading: {
    margin: '0 0 10px', fontSize: '11px', fontWeight: '600', color: '#999',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  },
  metaGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
    gap: '6px 8px', marginBottom: '8px',
  },
  metaItem: {
    display: 'flex', alignItems: 'center', gap: '5px',
  },
  metaCheck: {
    fontSize: '12px', fontWeight: '700', flexShrink: 0,
  },
  metaLabel: {
    fontSize: '12px',
  },
  offFields: {
    margin: '0', fontSize: '11px', color: '#bbb', lineHeight: '1.4',
  },
  formatRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 20px 0',
  },
  formatLabel: {
    fontSize: '13px', color: '#555', fontWeight: '500', flexShrink: 0,
  },
  segGroup: {
    display: 'flex', borderRadius: '7px', border: '1px solid #ddd', overflow: 'hidden',
  },
  segBtn: {
    padding: '5px 12px', fontSize: '12px', fontWeight: '500',
    background: '#fff', border: 'none', borderRight: '1px solid #ddd',
    cursor: 'pointer', color: '#555',
  },
  segBtnActive: {
    background: 'var(--ff-blue)', color: '#fff',
  },
  segBtnLast: {
    borderRight: 'none',
  },
  trackRow: {
    padding: '12px 20px 0',
  },
  trackLabel: {
    display: 'flex', alignItems: 'center', fontSize: 13, color: '#374151',
    cursor: 'pointer', fontWeight: '500',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px 18px', borderTop: '1px solid #f0ede8', marginTop: '14px',
  },
  footerBtns: {
    display: 'flex', gap: '8px',
  },
  settingsLink: {
    background: 'none', border: 'none', fontSize: '13px', color: 'var(--ff-blue)',
    cursor: 'pointer', padding: 0,
  },
  cancelBtn: {
    background: 'none', border: '1px solid #ccc', borderRadius: '7px',
    fontSize: '13px', color: '#555', cursor: 'pointer', padding: '7px 16px',
  },
  confirmBtn: {
    background: 'var(--ff-pink-action)', border: 'none', borderRadius: '7px',
    fontSize: '13px', color: '#fff', fontWeight: '600', cursor: 'pointer',
    padding: '7px 20px',
  },
}
