import React from 'react'
import CloseButton from '../ui/CloseButton'
import Dialog from '../ui/Dialog'
import Icon from '../ui/Icon'
import changelog from '../data/changelog'

interface ChangelogModalProps {
  onClose: () => void
}

export default function ChangelogModal({ onClose }: ChangelogModalProps): React.JSX.Element {

  return (
    <Dialog label="What's new" size="medium" onClose={onClose} cardStyle={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '70vh' }}>
        <div style={styles.header}>
          <h2 style={styles.title}>What's new</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div style={styles.content}>
          {changelog.map((release, i) => {
            const isMajor = /^\d+\.0$/.test(release.version)
            return (
              <div
                key={release.version}
                style={{
                  ...styles.release,
                  ...(i === 0 ? styles.releaseFirst : {}),
                  ...(isMajor && i !== 0 ? styles.releaseMajor : {})
                }}
              >
                <div style={styles.releaseHeader}>
                  <span style={{ ...styles.releaseVersion, ...(isMajor ? styles.releaseVersionMajor : {}) }}>
                    {release.version}
                    {i === 0 && <span style={styles.latestBadge}>Latest</span>}
                  </span>
                  <span style={styles.releaseDate}>{release.date}</span>
                </div>
                {release.milestone
                  ? <p style={styles.milestone}>{release.milestone}</p>
                  : (
                    <ul style={styles.bullets}>
                      {release.highlights.map((item, j) => (
                        <li key={j} style={styles.bullet}>{item}</li>
                      ))}
                    </ul>
                  )
                }
              </div>
            )
          })}
        </div>
</Dialog>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--ff-border)',
    flexShrink: 0
  },
  title: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--ff-text)',
    margin: 0
  },
  content: {
    overflowY: 'auto' as const,
    padding: '0 24px 20px'
  },
  release: {
    borderTop: '1px solid var(--ff-border)',
    paddingTop: '16px',
    paddingBottom: '4px',
    marginBottom: '4px'
  },
  releaseFirst: {
    borderTop: 'none',
    paddingTop: '16px'
  },
  releaseMajor: {
    borderTop: '2px solid var(--ff-line-strong)',
    marginTop: '8px'
  },
  releaseVersionMajor: {
    fontWeight: '700',
    fontSize: '14px'
  },
  milestone: {
    fontSize: '13px',
    color: 'var(--ff-text)',
    fontStyle: 'italic',
    margin: 0,
    lineHeight: '1.5'
  },
  releaseHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  releaseVersion: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--ff-text)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  latestBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--ff-pink)',
    backgroundColor: 'color-mix(in srgb, var(--ff-pink) 10%, transparent)',
    borderRadius: '4px',
    padding: '1px 6px',
    letterSpacing: '0.02em'
  },
  releaseDate: {
    fontSize: '11px',
    color: 'var(--ff-text-secondary)'
  },
  bullets: {
    margin: 0,
    paddingLeft: '16px',
    listStyleType: 'disc'
  },
  bullet: {
    fontSize: '13px',
    color: 'var(--ff-text-secondary)',
    lineHeight: '1.7',
    paddingLeft: '2px'
  }
}
