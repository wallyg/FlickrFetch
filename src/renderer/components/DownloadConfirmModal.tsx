import React, { useState, useEffect } from 'react'
import CloseButton from '../ui/CloseButton'
import Dialog from '../ui/Dialog'
import Icon from '../ui/Icon'
import type { AppSettings, MetadataSettings } from '../../shared/types'
import { isFreeAccount, limitNotice } from '../../shared/downloadLimits'
import { primaryBtn, quietBtn, linkBtn, segGroup, segBtn, selectedOn } from '../ui/kit'

const SIZE_LABELS: Record<string, string> = {
  original: 'Original',
  xlarge: 'Extra large',
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
  { key: 'embedDateTaken',   label: 'Date taken' },
  { key: 'embedCreator',     label: 'Creator' },
  { key: 'embedGps',         label: 'GPS location' },
  { key: 'embedLicense',     label: 'CC license' },
  { key: 'embedPhotoUrl',    label: 'Photo page URL' },
  { key: 'embedPhotoId',     label: 'Flickr photo ID' },
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
  isPro: boolean | undefined   // true or false as Flickr says; undefined when it could not be asked. Only a known free account sees the note (#126)
  onCancel: () => void
  onOpenSettings: () => void
}

export default function DownloadConfirmModal({ pending, settingsKey, isPro, onCancel, onOpenSettings }: DownloadConfirmModalProps): React.JSX.Element {
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
  const isFree = isFreeAccount(isPro, import.meta.env.DEV && settings?.devPretendFree === true)   // the switch in Settings pretends, in development builds only
  const { quality, callout } = limitNotice(isFree, settings?.downloadSize ?? 'original', SIZE_LABELS[settings?.downloadSize ?? 'original'] ?? 'Original')
  const totalCount = pending.photoCount + pending.videoCount

  return (
    <Dialog label="Confirm download" size="medium" onClose={onCancel} cardStyle={{ overflow: 'hidden' }}>

        <div style={s.header}>
          <h2 style={s.title}>Confirm download</h2>
          <CloseButton onClick={onCancel} />
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

          {callout && <p style={s.limitNote} role="note">{callout}</p>}

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
                          <span style={{ ...s.metaCheck, color: 'var(--ff-success)' }}><Icon name="check" /></span>
                          <span style={{ ...s.metaLabel, color: 'var(--ff-text)' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--ff-text-secondary)', margin: '0 0 4px' }}>None</p>
                  )}
                  {offFields.length > 0 && (
                    <p style={s.offFields}>
                      Not embedding: {offFields.map(f => f.label).join(', ')}
                    </p>
                  )}
                </>
              )
            })() : (
              <p style={{ fontSize: '13px', color: 'var(--ff-text-secondary)', margin: 0 }}>Loading…</p>
            )}
          </div>
        </div>

        <div style={s.formatRow}>
          <span style={s.formatLabel}>Export as</span>
          <div style={segGroup} role="radiogroup" aria-label="Export as">
            <button style={{ ...segBtn, ...(exportFormat === 'files' ? selectedOn : {}) }} role="radio" aria-checked={exportFormat === 'files'} onClick={() => setExportFormat('files')}>Individual files</button>
            <button style={{ ...segBtn, ...(exportFormat === 'zip' ? selectedOn : {}) }} role="radio" aria-checked={exportFormat === 'zip'} onClick={() => setExportFormat('zip')}>ZIP archive</button>
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
          <button style={s.settingsLink} onClick={onOpenSettings}>Change settings</button>
          <div style={s.footerBtns}>
            <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
            <button style={s.confirmBtn} onClick={handleConfirm}>
              {exportFormat === 'zip' ? 'Download as ZIP' : 'Start download'}
            </button>
          </div>
        </div>
</Dialog>
  )
}

const s: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 16px 0',
  },
  title: {
    margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--ff-navy)',
  },
  body: {
    padding: '16px 16px 0',
  },
  batchTitle: {
    margin: '0 0 4px', fontSize: '14px', fontWeight: '700', color: 'var(--ff-text)',
  },
  countLine: {
    margin: '0 0 4px', fontSize: '13px', color: 'var(--ff-text-secondary)',
  },
  countNote: {
    margin: '0 0 0', fontSize: '11px', color: 'var(--ff-text-secondary)',
  },
  limitNote: {
    fontSize: '12px', lineHeight: 1.5, color: 'var(--ff-text-secondary)', backgroundColor: 'var(--ff-tint)', borderRadius: '8px', padding: '8px 12px', margin: '8px 0 0',
  },
  summaryCard: {
    backgroundColor: 'var(--ff-cream)', borderRadius: '8px', padding: '8px 12px',
    marginTop: '12px',
  },
  settingsRow: {
    display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px',
  },
  settingLabel: {
    fontSize: '12px', color: 'var(--ff-text-secondary)', width: '52px', flexShrink: 0,
  },
  settingValue: {
    fontSize: '14px', color: 'var(--ff-text)', fontWeight: '400', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1,
  },
  metaSection: {
    marginTop: '16px', borderTop: '1px solid var(--ff-border)', paddingTop: '12px',
  },
  metaHeading: {
    margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: 'var(--ff-text-secondary)',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  },
  metaGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
    gap: '6px 8px', marginBottom: '8px',
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
  offFields: {
    margin: '0', fontSize: '11px', color: 'var(--ff-text-secondary)', lineHeight: '1.4',
  },
  formatRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 16px 0',
  },
  formatLabel: {
    fontSize: '13px', color: 'var(--ff-text-secondary)', fontWeight: '400', flexShrink: 0,
  },
  trackRow: {
    padding: '12px 16px 0',
  },
  trackLabel: {
    display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--ff-text-secondary)',
    cursor: 'pointer', fontWeight: '400',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px 16px', borderTop: '1px solid var(--ff-border)', marginTop: '12px',
  },
  footerBtns: {
    display: 'flex', gap: '8px',
  },
  settingsLink: { ...linkBtn, fontSize: '13px' },
  cancelBtn: { ...quietBtn },
  confirmBtn: { ...primaryBtn },
}
