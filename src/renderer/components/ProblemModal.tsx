import React from 'react'
import CloseButton from '../ui/CloseButton'
import Dialog from '../ui/Dialog'
import Icon from '../ui/Icon'

interface ProblemModalProps {
  onClose: () => void
}

export default function ProblemModal({ onClose }: ProblemModalProps): React.JSX.Element {

  return (
    <Dialog label="The problem FlickrFetch solves" size="wide" onClose={onClose} cardStyle={{ position: 'relative', padding: '36px 40px 32px', overflowY: 'auto', maxHeight: '85vh' }}>
        <CloseButton onClick={onClose} style={{ position: 'absolute', top: 14, right: 14 }} />
        <h2 style={s.heading}>The problem FlickrFetch solves</h2>
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
            IPTC fields: title, description, tags, GPS coordinates, capture date, license, creator,
            and a link back to the photo on Flickr. You choose which in Settings.
          </p>
          <p style={s.para}>
            The result is a true archive: files that are self-describing, portable, and
            not dependent on Flickr remaining online or your account remaining active.
          </p>
          <p style={{ ...s.para, fontWeight: 700, color: 'var(--ff-navy)', marginBottom: 0 }}>
            For photographers who built their archive on Flickr, FlickrFetch is the difference
            between a backup and an archive.
          </p>
        </div>
</Dialog>
  )
}

const s: Record<string, React.CSSProperties> = {
  heading: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--ff-navy)',
    margin: '0 0 16px',
    lineHeight: 1.25,
    fontFamily: "'Lato', -apple-system, sans-serif",
    paddingRight: '24px',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  para: {
    fontSize: '14px',
    lineHeight: '1.7',
    color: 'var(--ff-text)',
    margin: 0,
    fontFamily: "'Lato', -apple-system, sans-serif",
  },
}
