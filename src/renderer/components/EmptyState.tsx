import React from 'react'

interface EmptyStateProps {
  title: string
  body?: string
  children?: React.ReactNode // optional actions (buttons)
}

// One look for "nothing here" screens: a short headline, one line of explanation, optional action.
export default function EmptyState({ title, body, children }: EmptyStateProps): React.JSX.Element {
  return (
    <div style={styles.wrap}>
      <div style={styles.title}>{title}</div>
      {body && <div style={styles.body}>{body}</div>}
      {children && <div style={styles.actions}>{children}</div>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '6px', padding: '56px 24px' },
  title: { fontSize: '15px', fontWeight: 700, color: 'var(--ff-navy)' },
  body: { fontSize: '13px', lineHeight: 1.5, color: 'var(--ff-text-secondary)', maxWidth: '360px', whiteSpace: 'pre-line' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '10px' }
}
