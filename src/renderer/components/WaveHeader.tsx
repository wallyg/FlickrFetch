import React from 'react'
import WaveBand from './WaveBand'

// Side gutter of the Discover landing screens; WaveHeader bleeds out by exactly this much.
export const DISCOVER_GUTTER = 20

// Header block for the Discover landing screens: ghosted brand waves sit behind the title and
// controls, so the header keeps the height it already had. Bleeds to the edges of the page gutter.
export default function WaveHeader({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={styles.wrap}>
      <WaveBand ghost height="100%" />
      <div style={styles.content}>{children}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: 'relative', margin: `0 -${DISCOVER_GUTTER}px`, padding: `0 ${DISCOVER_GUTTER}px 16px`, background: 'var(--ff-cream)', overflow: 'hidden' },
  content: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }
}
