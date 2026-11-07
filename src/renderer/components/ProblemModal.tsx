import React from 'react'

interface ProblemModalProps {
  onClose: () => void
}

export default function ProblemModal({ onClose }: ProblemModalProps): React.JSX.Element {
  const handleKey = React.useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  React.useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.card}>
        <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        <h2 style={s.heading}>The Problem FlickrFetch Solves</h2>
        <div style={s.body}>
          <p style={s.para}>
            Flickr is one of the longest-running photo communities on the internet, and for many
            photographers it holds years — sometimes decades — of work. But getting your photos off
            Flickr in any meaningful way has always been harder than it should be.
          </p>
          <p style={s.para}>
            Flickr's native export tools let you download your photos, but the files you get are
            largely stripped of context. The titles, descriptions, tags, album names, dates, and
            license information you spent years adding live on Flickr's servers — not in the files
            themselves. Download a photo through Flickr's interface and you get a JPEG. The story
            behind it stays behind.
          </p>
          <p style={s.para}>
            This matters because metadata embedded in a file travels with it. It survives a move
            to a new photo library, a backup drive, or a different platform. Metadata that only
            exists in Flickr's database disappears the moment Flickr does — or the moment you leave.
          </p>
          <p style={s.para}>
            FlickrFetch was built to close that gap. It downloads photos and videos from your Flickr
            library and embeds the metadata directly into each file using industry-standard EXIF and
            IPTC fields — title, description, tags, GPS coordinates, capture date, album, license,
            and more. The result is a true archive: files that are self-describing, portable, and
            not dependent on Flickr remaining online or your account remaining active.
          </p>
          <p style={{ ...s.para, fontWeight: 600, color: 'var(--ff-navy)', marginBottom: 0 }}>
            For photographers who built their archive on Flickr, FlickrFetch is the difference
            between a backup and an archive.
          </p>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    width: '640px',
    maxWidth: '92vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
    position: 'relative',
    padding: '36px 40px 32px',
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
  },
  heading: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--ff-navy)',
    margin: '0 0 20px',
    lineHeight: 1.25,
    fontFamily: "'Lato', -apple-system, sans-serif",
    paddingRight: '24px',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  para: {
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#444',
    margin: 0,
    fontFamily: "'Lato', -apple-system, sans-serif",
  },
}
