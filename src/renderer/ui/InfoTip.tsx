import React from 'react'
import Icon from './Icon'

// The small (i) that explains something when you point at it, or Tab to it. The explanation appears on the one hover card (HoverCard, drawn by
// HoverCardHost). Used in Settings.

export default function InfoTip({ text }: { text: string }): React.JSX.Element {
  return (
    <span data-tip={text} data-tip-anchor="" tabIndex={0} role="button" aria-label="How this works" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--ff-text-secondary)', cursor: 'help', userSelect: 'none' }}>
      <Icon name="info" size={15} />
    </span>
  )
}
