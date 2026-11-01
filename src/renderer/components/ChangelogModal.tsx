import React from 'react'
import changelog from '../data/changelog'

interface ChangelogModalProps {
  onClose: () => void
}

export default function ChangelogModal({ onClose }: ChangelogModalProps): React.JSX.Element {
  const handleKey = React.useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  React.useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>What's New</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
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
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    width: '480px',
    maxWidth: '90vw',
    maxHeight: '70vh',
    boxShadow: '0 16px 56px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid #e8e4de',
    flexShrink: 0
  },
  title: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#111',
    margin: 0
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '15px',
    color: '#aaa',
    cursor: 'pointer',
    padding: '4px'
  },
  content: {
    overflowY: 'auto' as const,
    padding: '0 24px 20px'
  },
  release: {
    borderTop: '1px solid #e8e4de',
    paddingTop: '16px',
    paddingBottom: '4px',
    marginBottom: '4px'
  },
  releaseFirst: {
    borderTop: 'none',
    paddingTop: '16px'
  },
  releaseMajor: {
    borderTop: '2px solid #e0dbd2',
    marginTop: '8px'
  },
  releaseVersionMajor: {
    fontWeight: '800',
    fontSize: '14px'
  },
  milestone: {
    fontSize: '13px',
    color: '#444',
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
    color: '#222',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  latestBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#FF0084',
    backgroundColor: 'rgba(255,0,132,0.1)',
    borderRadius: '4px',
    padding: '1px 6px',
    letterSpacing: '0.02em'
  },
  releaseDate: {
    fontSize: '11px',
    color: '#bbb'
  },
  bullets: {
    margin: 0,
    paddingLeft: '16px',
    listStyleType: 'disc'
  },
  bullet: {
    fontSize: '13px',
    color: '#555',
    lineHeight: '1.7',
    paddingLeft: '2px'
  }
}
