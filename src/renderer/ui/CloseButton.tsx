import React from 'react'
import Icon from './Icon'

// The one close mark for every dialog: a drawn cross, always the same size, always named "Close" for screen readers.
export default function CloseButton({ onClick, style }: { onClick: () => void; style?: React.CSSProperties }): React.JSX.Element {
  return (
    <button type="button" aria-label="Close" onClick={onClick} style={{ ...base, ...style }}>
      <Icon name="close" size={16} />
    </button>
  )
}

const base: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0, flexShrink: 0,
  background: 'none', border: 'none', borderRadius: 6, color: 'var(--ff-text-secondary)', cursor: 'pointer'
}
