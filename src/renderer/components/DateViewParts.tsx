import React from 'react'
import type { DayPhoto, PrivacyScope } from '../../shared/types'
import { segGroup, segBtn, selectedOn } from '../ui/kit'

// Small pieces shared by On This Day and the Timeline.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const pad2 = (n: number): string => String(n).padStart(2, '0')

export function hourLabel(h: number): string {
  return `${(h % 12) || 12} ${h < 12 ? 'am' : 'pm'}`
}

// "Not public" covers private, friends only, family only, and friends and family
export function ScopeToggle({ scope, counts, enabled, onChange }: {
  scope: PrivacyScope
  counts: { all: number; public: number; notPublic: number }
  enabled: boolean
  onChange: (s: PrivacyScope) => void
}): React.JSX.Element {
  const items: { key: PrivacyScope; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: counts.all }, { key: 'public', label: 'Public', n: counts.public }, { key: 'notpublic', label: 'Not public', n: counts.notPublic }
  ]
  return (
    <div
      style={{ ...segGroup, opacity: enabled ? 1 : 0.55 }}
      title={enabled ? 'Not public means private, friends only, family only, or friends and family' : 'Needs one Rebuild of your library list (Health Check tab) to learn which photos are public'}
    >
      {items.map(i => (
        <button
          key={i.key}
          disabled={!enabled && i.key !== 'all'}
          style={{ ...segBtn, padding: '5px 12px', cursor: enabled || i.key === 'all' ? 'pointer' : 'default', ...(scope === i.key ? selectedOn : {}) }}
          onClick={() => onChange(i.key)}
        >
          {i.label}{enabled ? ` (${i.n.toLocaleString()})` : ''}
        </button>
      ))}
    </div>
  )
}

export function PhotoTile({ photo, selected, onClick }: { photo: DayPhoto; selected: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <div
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); window.flickrAPI.showPhotoMenu(photo.id) }}
      title={`${photo.title || '(no title)'}\nClick to select. Right-click for more.`}
      style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#eee', cursor: 'pointer',
        outline: selected ? '3px solid var(--ff-pink)' : 'none', outlineOffset: -3 }}
    >
      {photo.privacy > 0 && (
        <span style={{ position: 'absolute', left: 5, top: 5, zIndex: 2, fontSize: 11, background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '0 5px' }} title="Not public">🔒</span>
      )}
      {selected && (
        <span style={{ position: 'absolute', right: 5, top: 5, zIndex: 2, fontSize: 11, background: 'var(--ff-pink)', color: '#fff', borderRadius: 8, padding: '0 6px' }}>✓</span>
      )}
      <img src={photo.thumbUrl} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
      <span style={{ display: 'block', fontSize: 11, padding: '3px 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: '#fff', color: 'var(--ff-text)' }}>
        {photo.title || '(no title)'}
      </span>
    </div>
  )
}
