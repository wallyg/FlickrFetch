import React from 'react'

// The top of every screen that lists photos (#257: Photostream, Timeline, On This Day, Map). Two rows, the same on each:
//   Row 1  where you are (the title, the date, the count)  ...  one main action and a More menu. Left out when a screen has nothing to say there.
//   Row 2  the media switch and the Filters button on the left; the count, sort and photo size on the right.
// A screen fills the slots; it does not lay these rows out itself, so the four cannot drift apart again.
export default function ScreenTop({ context, actions, filters, info }: { context?: React.ReactNode; actions?: React.ReactNode; filters: React.ReactNode; info?: React.ReactNode }): React.JSX.Element {
  return (
    <div style={styles.top}>
      {(context || actions) && (
        <div style={styles.row1}>
          <div style={styles.context}>{context}</div>
          {actions && <div style={styles.actions}>{actions}</div>}
        </div>
      )}
      <div style={styles.row2}>
        <div style={styles.filters}>{filters}</div>
        {info && <div style={styles.info}>{info}</div>}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  top: { display: 'flex', flexDirection: 'column', gap: 8 },
  row1: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  context: { flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actions: { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  row2: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  filters: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  info: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--ff-text-secondary)' }
}
