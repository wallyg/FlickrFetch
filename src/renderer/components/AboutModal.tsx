import React, { useState } from 'react'
import logoTrayImg from '../assets/logo-tray.png'
import ChangelogModal from './ChangelogModal'

interface AboutModalProps {
  version: string
  onClose: () => void
}

export default function AboutModal({ version, onClose }: AboutModalProps): React.JSX.Element {
  const [showChangelog, setShowChangelog] = useState(false)

  const handleKey = React.useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  React.useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <>
      <div style={styles.overlay}>
        <div style={styles.card}>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>

          <div style={styles.body}>
            {/* Left column — identity */}
            <div style={styles.leftCol}>
              <img src={logoTrayImg} alt="FlickrFetch" style={styles.logo} />
              <span style={styles.versionBadge}>Version {version}</span>
              <a style={styles.whatsNewLink} onClick={() => setShowChangelog(true)}>
                What's New in v{version} ›
              </a>
            </div>

            {/* Right column — about content */}
            <div style={styles.rightCol}>
              <h2 style={styles.heading}>A local backup for your Flickr photos.</h2>
              <p style={styles.subtext}>
                Download and preserve your Flickr photos and videos in their original quality, with metadata intact and control over your local archive.
              </p>

              <div style={styles.section}>
                <div style={styles.iconBadge}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0063DC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div>
                  <p style={styles.sectionLabel}>Privacy</p>
                  <p style={styles.sectionText}>
                    FlickrFetch connects directly to Flickr. No third-party servers or cloud storage are involved.
                  </p>
                </div>
              </div>

              <div style={styles.section}>
                <div style={{ ...styles.iconBadge, backgroundColor: '#FEE8F3' }}>
                  <span style={{ fontSize: '14px', letterSpacing: '-1px', lineHeight: 1 }}>
                    <span style={{ color: '#0063DC' }}>●</span><span style={{ color: '#FF0084' }}>●</span>
                  </span>
                </div>
                <div>
                  <p style={styles.sectionLabel}>Flickr Attribution</p>
                  <p style={styles.sectionText}>
                    This product uses the Flickr API but is not endorsed or certified by SmugMug, Inc.
                  </p>
                </div>
              </div>

              <div style={styles.linkRow}>
                <a href="#" style={styles.linkItem}
                  onClick={(e) => { e.preventDefault(); window.flickrAPI.openExternal('mailto:wallyg@gmail.com?subject=FlickrFetch Feedback') }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0063DC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <span style={styles.linkLabel}>Email</span>
                  <span style={styles.linkSub}>Questions & Feedback</span>
                </a>
                <a href="#" style={styles.linkItem}
                  onClick={(e) => { e.preventDefault(); window.flickrAPI.openExternal('https://www.flickr.com/photos/wallyg/') }}>
                  <span style={{ fontSize: '15px', letterSpacing: '-1px', lineHeight: 1 }}>
                    <span style={{ color: '#0063DC' }}>●</span><span style={{ color: '#FF0084' }}>●</span>
                  </span>
                  <span style={styles.linkLabel}>My Flickr</span>
                  <span style={styles.linkSub}>View My Photos</span>
                </a>
                <a href="#" style={styles.linkItem}
                  onClick={(e) => { e.preventDefault(); window.flickrAPI.openExternal('https://github.com/wallyg/FlickrFetch') }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0063DC">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .322.216.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  <span style={styles.linkLabel}>GitHub Repo</span>
                  <span style={styles.linkSub}>Source, Releases & Issues</span>
                </a>
              </div>
            </div>
          </div>

          <div style={styles.footer}>
            <p style={styles.copyright}>© 2026 Wally Gobetz. All rights reserved.</p>
          </div>
        </div>
      </div>

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200
  },
  card: {
    backgroundColor: '#FEF4EA',
    borderRadius: '16px',
    width: '720px',
    maxWidth: '92vw',
    boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  closeBtn: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    background: 'none',
    border: 'none',
    fontSize: '15px',
    color: '#aaa',
    cursor: 'pointer',
    padding: '4px',
    zIndex: 1
  },
  body: {
    display: 'flex',
    flexDirection: 'row',
    minHeight: '300px'
  },
  leftCol: {
    width: '240px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    borderRight: '1px solid rgba(0,0,0,0.07)',
    gap: '14px'
  },
  logo: {
    width: '210px',
    objectFit: 'contain' as const
  },
  versionBadge: {
    display: 'inline-block',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: '20px',
    padding: '5px 14px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#444'
  },
  rightCol: {
    flex: 1,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    padding: '28px 28px 20px',
    minWidth: 0,
    gap: '14px'
  },
  heading: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#1B2946',
    margin: 0,
    lineHeight: 1.3
  },
  subtext: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
    lineHeight: 1.6
  },
  section: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px'
  },
  iconBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: '#EBF3FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#222',
    margin: '0 0 3px'
  },
  sectionText: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
    lineHeight: 1.55
  },
  whatsNewLink: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#0063DC',
    cursor: 'pointer',
    textDecoration: 'none'
  } as React.CSSProperties,
  linkRow: {
    display: 'flex',
    alignItems: 'stretch',
    marginTop: 'auto',
    borderTop: '1px solid #f0ede8',
    paddingTop: '16px'
  },
  linkItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    textDecoration: 'none',
    padding: '4px 8px',
    borderRadius: '8px',
    cursor: 'pointer'
  } as React.CSSProperties,
  linkLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#0063DC'
  },
  linkSub: {
    fontSize: '10px',
    color: '#999'
  },
  footer: {
    borderTop: '1px solid rgba(0,0,0,0.08)',
    padding: '11px 24px',
    backgroundColor: '#FEF4EA'
  },
  copyright: {
    fontSize: '11px',
    color: '#888',
    margin: 0,
    textAlign: 'center' as const
  }
}
