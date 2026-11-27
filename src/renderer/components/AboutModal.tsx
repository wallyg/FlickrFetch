import React, { useState } from 'react'
import CloseButton from '../ui/CloseButton'
import Dialog from '../ui/Dialog'
import { linkBtn, headingDialog } from '../ui/kit'
import Icon from '../ui/Icon'
import logoTrayImg from '../assets/logo-tray.png'
import ChangelogModal from './ChangelogModal'
import ProblemModal from './ProblemModal'
import WaveBand from './WaveBand'

interface AboutModalProps {
  version: string
  onClose: () => void
}

export default function AboutModal({ version, onClose }: AboutModalProps): React.JSX.Element {
  const [showChangelog, setShowChangelog] = useState(false)
  const [showProblem, setShowProblem] = useState(false)


  return (
    <>
      <Dialog label="About FlickrFetch" size="large" onClose={onClose} cardStyle={{ background: 'var(--ff-cream)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <CloseButton onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 1 }} />

          <div style={styles.body}>
            {/* Left column — identity */}
            <div style={styles.leftCol}>
              <WaveBand height={130} />
              <img src={logoTrayImg} alt="FlickrFetch" style={styles.logo} />
              <a style={styles.whatsNewPill} onClick={() => setShowChangelog(true)}>
                Version {version} · What's new ›
              </a>
            </div>

            {/* Right column — about content */}
            <div style={styles.rightCol}>
              <h2 style={styles.heading}>A local backup for your Flickr photos.</h2>
              <p style={styles.subtext}>
                Download your Flickr photos and videos with your titles, tags, dates, locations and license written into the files. It also checks your library for tidy-ups: typos in tags, missing titles and locations, photos in the wrong album, and possible duplicates.
              </p>

              <a style={styles.deepLink} onClick={() => setShowProblem(true)}>
                The problem FlickrFetch solves ›
              </a>

              <div style={styles.section}>
                <div style={styles.iconBadge}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ff-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div>
                  <p style={styles.sectionLabel}>Privacy</p>
                  <p style={styles.sectionText}>
                    No FlickrFetch servers. The app only talks to Flickr, and to GitHub to check for updates. No analytics or tracking.
                  </p>
                </div>
              </div>

              <div style={styles.section}>
                <div style={{ ...styles.iconBadge, backgroundColor: 'var(--ff-tint)' }}>
                  <span style={{ fontSize: '14px', letterSpacing: '-1px', lineHeight: 1 }}>
                    <span style={{ color: 'var(--ff-blue)' }}>●</span><span style={{ color: 'var(--ff-pink)' }}>●</span>
                  </span>
                </div>
                <div>
                  <p style={styles.sectionLabel}>Flickr attribution</p>
                  <p style={styles.sectionText}>
                    This product uses the Flickr API but is not endorsed or certified by SmugMug, Inc.
                  </p>
                </div>
              </div>

              <div style={styles.linkRow}>
                <a href="#" style={styles.linkItem}
                  onClick={(e) => { e.preventDefault(); window.flickrAPI.openExternal('mailto:wallyg@gmail.com?subject=FlickrFetch Feedback') }}>
                  <span style={styles.linkIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ff-blue)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg></span>
                  <span style={styles.linkLabel}>Email</span>
                  <span style={styles.linkSub}>Questions and feedback</span>
                </a>
                <a href="#" style={styles.linkItem}
                  onClick={(e) => { e.preventDefault(); window.flickrAPI.openExternal('https://www.flickr.com/photos/wallyg/') }}>
                  <span style={{ ...styles.linkIcon, fontSize: '14px', letterSpacing: '-1px', lineHeight: 1 }}>
                    <span style={{ color: 'var(--ff-blue)' }}>●</span><span style={{ color: 'var(--ff-pink)' }}>●</span>
                  </span>
                  <span style={styles.linkLabel}>Author's Flickr</span>
                  <span style={styles.linkSub}>Photos by the author</span>
                </a>
                <a href="#" style={styles.linkItem}
                  onClick={(e) => { e.preventDefault(); window.flickrAPI.openExternal('https://github.com/wallyg/FlickrFetch') }}>
                  <span style={styles.linkIcon}><svg width="16" height="16" viewBox="0 0 24 24" fill="var(--ff-blue)">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .322.216.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg></span>
                  <span style={styles.linkLabel}>GitHub repo</span>
                  <span style={styles.linkSub}>Source code, releases and issues</span>
                </a>
              </div>
            </div>
          </div>

          <div style={styles.footer}>
            <p style={styles.copyright}>© 2026 Wally Gobetz. All rights reserved.</p>
          </div>
</Dialog>

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
      {showProblem && <ProblemModal onClose={() => setShowProblem(false)} />}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
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
    padding: '24px 16px 70px',
    borderRight: '1px solid var(--ff-shadow-soft)',
    gap: '12px',
    position: 'relative',
    overflow: 'hidden'
  },
  logo: {
    width: '210px',
    objectFit: 'contain' as const
  },
  rightCol: {
    flex: 1,
    backgroundColor: 'var(--ff-surface)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 24px 16px',
    minWidth: 0,
    gap: '12px'
  },
  heading: { ...headingDialog, lineHeight: 1.3 },
  subtext: {
    fontSize: '12px',
    color: 'var(--ff-text-secondary)',
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
    borderRadius: '8px',
    backgroundColor: 'var(--ff-info-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--ff-text)',
    margin: '0 0 2px'
  },
  sectionText: {
    fontSize: '12px',
    color: 'var(--ff-text-secondary)',
    margin: 0,
    lineHeight: 1.55
  },
  whatsNewPill: {
    // Rests on the darkest wave at the bottom of the column
    position: 'absolute',
    bottom: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    zIndex: 1,
    boxShadow: '0 1px 4px color-mix(in srgb, var(--ff-navy) 20%, transparent)',
    backgroundColor: 'var(--ff-surface)',
    border: 'none',
    borderRadius: '50px',
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--ff-blue)',
    cursor: 'pointer',
    textDecoration: 'none'
  } as React.CSSProperties,
  deepLink: { ...linkBtn } as React.CSSProperties,
  linkRow: {
    display: 'flex',
    alignItems: 'stretch',
    marginTop: 'auto',
    borderTop: '1px solid var(--ff-border)',
    paddingTop: '16px'
  },
  linkItem: {
    flex: '1 1 0',
    minWidth: 0,
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
    fontWeight: '700',
    color: 'var(--ff-blue)'
  },
  linkIcon: { height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  linkSub: {
    fontSize: '11px',
    color: 'var(--ff-text-secondary)',
    textAlign: 'center' as const,
    minHeight: 30
  },
  footer: {
    borderTop: '1px solid var(--ff-shadow-soft)',
    padding: '12px 24px',
    backgroundColor: 'var(--ff-cream)'
  },
  copyright: {
    fontSize: '11px',
    color: 'var(--ff-text-secondary)',
    margin: 0,
    textAlign: 'center' as const
  }
}
