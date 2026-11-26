import React from 'react'
import { linkBtn } from '../ui/kit'

// The one line a screen shows when what it was loading could not be read, so it never sits on "Loading…" for good.
export default function LoadFailed({ onRetry, what = 'this' }: { onRetry: () => void; what?: string }): React.JSX.Element {
  return (
    <div role="alert" style={{ fontSize: 13, color: 'var(--ff-text-secondary)', padding: '8px 0' }}>
      Couldn&rsquo;t load {what}. <button style={linkBtn} onClick={onRetry}>Try again</button>
    </div>
  )
}
