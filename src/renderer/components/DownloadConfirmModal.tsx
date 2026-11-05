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

// Fields in photo detail panel order (matches the right-panel metadata order)
const META_FIELDS: { key: keyof MetadataSettings; label: string }[] = [
  { key: 'embedTitle',       label: 'Title' },
  { key: 'embedDateTaken',   label: 'Date Taken' },
  { key: 'embedCreator',     label: 'Creator' },
  { key: 'embedGps',         label: 'GPS Location' },
  { key: 'embedDescription', label: 'Description' },
  { key: 'embedTags',        label: 'Tags' },
  { key: 'embedLicense',     label: 'CC License' },
  { key: 'embedPhotoUrl',    label: 'Photo URL' },
  { key: 'embedPhotoId',     label: 'Photo ID' },
]

export interface PendingDownload {
  title: string
  photoCount: number
  videoCount: number
  onConfirm: () => void
}

interface DownloadConfirmModalProps {
  pending: PendingDownload
  settingsKey: number
  onCancel: () => void
  onOpenSettings: () => void
}

export default function DownloadConfirmModal({ pending, settingsKey, onCancel, onOpenSettings }: DownloadConfirmModalProps): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.flickrAPI.getSettings().then(setSettings).catch(() => {})
  }, [settingsKey])

  const handleConfirm = (): void => {
    pending.onConfirm()
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

          <div style={s.settingsRow}>
            <span style={s.settingLabel}>Quality</span>
            <span style={s.settingValue}>{quality}</span>
          </div>
          {folderDisplay && (
            <div style={s.settingsRow}>
              <span style={s.settingLabel}>Save to</span>
              <span style={s.settingValue} title={folder}>{folderDisplay}</span>
            </div>
          )}

          <div style={s.metaSection}>
            <p style={s.metaHeading}>Metadata embedding</p>
            {meta ? (
              <div style={s.metaGrid}>
                {META_FIELDS.map(({ key, label }) => {
                  const on = meta[key] as boolean
                  return (
                    <div key={key} style={s.metaItem}>
                      <span style={{ ...s.metaCheck, color: on ? '#27ae60' : '#ccc' }}>{on ? '✓' : '✗'}</span>
                      <span style={{ ...s.metaLabel, color: on ? '#333' : '#bbb' }}>{label}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#bbb', margin: 0 }}>Loading…</p>
            )}
          </div>
        </div>

        <div style={s.footer}>
          <button style={s.settingsLink} onClick={onOpenSettings}>Change Settings</button>
          <div style={s.footerBtns}>
            <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
            <button style={s.confirmBtn} onClick={handleConfirm}>Start Download</button>
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
    margin: 0, fontSize: '16px', fontWeight: '700', color: '#1B2946',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '15px', color: '#aaa',
    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
  body: {
    padding: '14px 20px 0',
  },
  batchTitle: {
    margin: '0 0 6px', fontSize: '14px', fontWeight: '600', color: '#111',
  },
  countLine: {
    margin: '0 0 10px', fontSize: '13px', color: '#666',
  },
  settingsRow: {
    display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '5px',
  },
  settingLabel: {
    fontSize: '12px', color: '#999', width: '52px', flexShrink: 0,
  },
  settingValue: {
    fontSize: '13px', color: '#444', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1,
  },
  metaSection: {
    marginTop: '14px', borderTop: '1px solid #f0ede8', paddingTop: '12px',
  },
  metaHeading: {
    margin: '0 0 8px', fontSize: '11px', fontWeight: '600', color: '#999',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  },
  metaGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridAutoFlow: 'column',
    gridTemplateRows: 'repeat(3, auto)', gap: '5px 8px', paddingBottom: '4px',
  },
  metaItem: {
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  metaCheck: {
    fontSize: '12px', fontWeight: '700', flexShrink: 0,
  },
  metaLabel: {
    fontSize: '12px',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px 18px', borderTop: '1px solid #f0ede8', marginTop: '14px',
  },
  footerBtns: {
    display: 'flex', gap: '8px',
  },
  settingsLink: {
    background: 'none', border: 'none', fontSize: '13px', color: '#0063DC',
    cursor: 'pointer', padding: 0,
  },
  cancelBtn: {
    background: 'none', border: '1px solid #ccc', borderRadius: '7px',
    fontSize: '13px', color: '#555', cursor: 'pointer', padding: '7px 16px',
  },
  confirmBtn: {
    background: '#0063DC', border: 'none', borderRadius: '7px',
    fontSize: '13px', color: '#fff', fontWeight: '600', cursor: 'pointer',
    padding: '7px 20px',
  },
}
