import React from 'react'
import Icon from './Icon'

// An explanation that appears on the one hover card (HoverCard, drawn by HoverCardHost): at once on hover, and from the keyboard (Tab to the control,
// or to the small mark). Wrap the thing that explains itself. By default a small (i) is added after it, and the card sits against the (i); with
// mark={false} the wrapped control itself (a button, a group of tabs) opens the card. block = the wrapper fills its row.

export default function HoverNote({ text, children, block, mark = true }: { text?: string; children?: React.ReactNode; block?: boolean; mark?: boolean }): React.JSX.Element {
  if (!text) return <>{children}</>
  return (
    <span data-tip={text} style={{ display: block ? 'block' : 'inline-block' }}>
      {children}
      {mark && <span data-tip-anchor="" tabIndex={0} role="button" aria-label="How this works" style={{ display: 'inline-block', marginLeft: 4, color: 'var(--ff-text-secondary)', cursor: 'help' }}><Icon name="info" /></span>}
    </span>
  )
}
