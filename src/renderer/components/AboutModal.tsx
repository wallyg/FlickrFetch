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
              <p style={styles.slogan}>Your Flickr,{'\n'}Your Files.</p>
              <p style={styles.version}>v{version}</p>
            </div>

            {/* Right column — about content */}
            <div style={styles.rightCol}>
              <div style={styles.section}>
                <p style={styles.sectionLabel}>Privacy</p>
                <p style={styles.sectionText}>
                  Your photos and credentials never leave your Mac. FlickrFetch communicates
                  directly with Flickr's API — no data passes through any third-party server.
                </p>
              </div>

              <div style={styles.section}>
                <p style={styles.sectionLabel}>Flickr Attribution</p>
                <p style={styles.sectionText}>
                  FlickrFetch is an independent app, not affiliated with, endorsed by, or
                  sponsored by Flickr or SmugMug Inc.
                </p>
              </div>

              <div style={styles.linkRow}>
                <a href="#" style={styles.externalLink}
                  onClick={(e) => { e.preventDefault(); window.flickrAPI.openExternal('mailto:wallyg@gmail.com?subject=FlickrFetch Feedback') }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0063DC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Email
                </a>
                <a href="#" style={styles.externalLink}
                  onClick={(e) => { e.preventDefault(); window.flickrAPI.openExternal('https://github.com/wallyg/FlickrFetch') }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#0063DC">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .322.216.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  GitHub
                </a>
                <a href="#" style={styles.externalLink}
                  onClick={(e) => { e.preventDefault(); window.flickrAPI.openExternal('https://www.flickr.com/photos/wallyg/') }}>
                  <span style={{ ...styles.linkIcon, color: '#FF0084', fontSize: '14px' }}>●</span> Flickr Profile
                </a>
              </div>

              <div style={styles.whatsNewRow}>
                <button style={styles.whatsNewLink} onClick={() => setShowChangelog(true)}>
                  What's New in v{version} →
                </button>
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
    width: '540px',
    maxWidth: '90vw',
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
    minHeight: '240px'
  },
  leftCol: {
    width: '160px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px 24px',
    borderRight: '1px solid rgba(0,0,0,0.07)',
    textAlign: 'center'
  },
  logo: {
    width: '164px',
    marginBottom: '10px',
    objectFit: 'contain' as const
  },
  slogan: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#888',
    letterSpacing: '0.02em',
    margin: '0 0 6px',
    textAlign: 'center' as const,
    whiteSpace: 'pre' as const,
    lineHeight: 1.5,
  },
  version: {
    fontSize: '12px',
    color: '#777',
    margin: 0,
    fontWeight: '500'
  },
  rightCol: {
    flex: 1,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 24px 20px',
    minWidth: 0
  },
  section: {
    marginBottom: '16px'
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#333',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    margin: '0 0 4px 0'
  },
  sectionText: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
    lineHeight: '1.6'
  },
  linkRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    marginTop: '4px'
  },
  externalLink: {
    fontSize: '12px',
    color: '#FF0084',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  linkIcon: {
    fontSize: '11px',
    color: '#0063DC'
  },
  whatsNewRow: {
    marginTop: 'auto',
    paddingTop: '20px'
  },
  whatsNewLink: {
    background: 'none',
    border: 'none',
    color: '#FF0084',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit'
  },
  footer: {
    borderTop: '1px solid rgba(0,0,0,0.08)',
    padding: '12px 24px',
    backgroundColor: '#FEF4EA'
  },
  copyright: {
    fontSize: '11px',
    color: '#888',
    margin: 0,
    textAlign: 'center' as const
  }
}
