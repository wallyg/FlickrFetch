import React, { useState } from 'react'
import icon from '../assets/icon-128.png'
import changelog from '../data/changelog'

interface AboutModalProps {
  version: string
  onClose: () => void
}

type Tab = 'about' | 'whats-new'

export default function AboutModal({ version, onClose }: AboutModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('about')

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
        <button style={styles.closeBtn} onClick={onClose}>✕</button>

        <div style={styles.iconWrap}>
          <img src={icon} alt="FlickrFetch" style={styles.icon} />
        </div>

        <h1 style={styles.appName}>FlickrFetch</h1>
        <p style={styles.tagline}>Your Flickr, your files.</p>
        <p style={styles.version}>Version {version}</p>

        {/* Tab bar */}
        <div style={styles.tabBar}>
          <button
            style={{ ...styles.tab, ...(activeTab === 'about' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('about')}
          >
            About
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'whats-new' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('whats-new')}
          >
            What's New
          </button>
        </div>

        <div style={styles.contentArea}>
          {activeTab === 'about' && (
            <div style={styles.tabContent}>
              <div style={styles.section}>
                <p style={styles.sectionText}>
                  <strong>Privacy</strong><br />
                  Your photos and credentials never leave your Mac. FlickrFetch communicates
                  directly with Flickr's API — no data passes through any third-party server.
                </p>
              </div>

              <div style={styles.section}>
                <p style={styles.sectionText}>
                  <strong>Flickr Attribution</strong><br />
                  FlickrFetch is an independent app and is not affiliated with, endorsed by,
                  or sponsored by Flickr or SmugMug Inc.
                </p>
              </div>

              <div style={styles.section}>
                <p style={styles.sectionText}>
                  Found a bug or have a suggestion?{' '}
                  <a
                    href="#"
                    style={styles.link}
                    onClick={(e) => { e.preventDefault(); window.flickrAPI.openExternal('mailto:wallyg@gmail.com?subject=FlickrFetch Feedback') }}
                  >
                    wallyg@gmail.com
                  </a>
                </p>
              </div>
            </div>
          )}

          {activeTab === 'whats-new' && (
            <div style={styles.changelogScroll}>
              {changelog.map((release, i) => (
                <div key={release.version} style={{ ...styles.release, ...(i === 0 ? styles.releaseFirst : {}) }}>
                  <div style={styles.releaseHeader}>
                    <span style={styles.releaseVersion}>
                      {release.version}
                      {i === 0 && <span style={styles.latestBadge}>Latest</span>}
                    </span>
                    <span style={styles.releaseDate}>{release.date}</span>
                  </div>
                  <ul style={styles.bullets}>
                    {release.highlights.map((item, j) => (
                      <li key={j} style={styles.bullet}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <p style={styles.copyright}>© 2026 Wally Gobetz. All rights reserved.</p>
        </div>
      </div>
    </div>
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
    backgroundColor: '#FCFAF6',
    borderRadius: '16px',
    width: '400px',
    maxWidth: '90vw',
    boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
    padding: '32px 32px 24px',
    position: 'relative',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '85vh'
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'none',
    border: 'none',
    fontSize: '16px',
    color: '#aaa',
    cursor: 'pointer',
    padding: '4px'
  },
  iconWrap: {
    marginBottom: '12px',
    flexShrink: 0
  },
  icon: {
    width: '80px',
    height: '80px',
    borderRadius: '18px'
  },
  appName: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111',
    margin: '0 0 4px 0',
    flexShrink: 0
  },
  tagline: {
    fontSize: '14px',
    color: '#888',
    margin: '0 0 4px 0',
    flexShrink: 0
  },
  version: {
    fontSize: '12px',
    color: '#aaa',
    margin: '0 0 20px 0',
    flexShrink: 0
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #e8e4de',
    marginBottom: '0',
    flexShrink: 0,
    gap: 0
  },
  tab: {
    flex: 1,
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '10px 0',
    fontSize: '13px',
    color: '#999',
    cursor: 'pointer',
    marginBottom: '-1px',
    fontWeight: '500'
  },
  tabActive: {
    color: '#FF0084',
    borderBottom: '2px solid #FF0084'
  },
  contentArea: {
    height: '240px',
    overflowY: 'auto' as const,
    minHeight: 0
  },
  tabContent: {
    padding: '18px 0 0',
    textAlign: 'left' as const,
  },
  section: {
    marginBottom: '14px',
    textAlign: 'left'
  },
  sectionText: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
    lineHeight: '1.6'
  },
  link: {
    color: '#FF0084',
    textDecoration: 'none'
  },
  changelogScroll: {
    padding: '16px 0 0',
    textAlign: 'left' as const,
  },
  release: {
    borderTop: '1px solid #e8e4de',
    paddingTop: '14px',
    paddingBottom: '4px',
    marginBottom: '2px'
  },
  releaseFirst: {
    borderTop: 'none',
    paddingTop: '0'
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
    color: '#bbb',
    fontWeight: '400'
  },
  bullets: {
    margin: '0',
    paddingLeft: '16px',
    listStyleType: 'disc'
  },
  bullet: {
    fontSize: '12px',
    color: '#555',
    lineHeight: '1.7',
    paddingLeft: '2px'
  },
  footer: {
    borderTop: '1px solid #e8e4de',
    marginTop: '20px',
    paddingTop: '16px',
    flexShrink: 0
  },
  copyright: {
    fontSize: '11px',
    color: '#bbb',
    margin: 0
  }
}
