import React from 'react'

// A section of a long screen: small capitals, a thin rule, and on the right the controls or link that belong to the whole section (the dashboard's sections).
export default function SectionRule({ label, controls, link }: { label: string; controls?: React.ReactNode; link?: React.ReactNode }): React.JSX.Element {
  return (
    <div style={styles.row} data-section="">
      <span style={styles.label}>{label}</span>
      <span style={styles.rule} aria-hidden="true" />
      {controls}
      {link}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 12, flexWrap: 'wrap' },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ff-text-secondary)' },
  rule: { flex: 1, minWidth: 24, height: 1, background: 'var(--ff-border)' }
}
