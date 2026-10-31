import React, { useState, useEffect, useCallback } from 'react'
import type { FlickrPhoto, PhotoSize } from '../../shared/types'

interface PhotoDetailProps {
  photo: FlickrPhoto
  onClose: () => void
}

type DownloadState = 'idle' | 'downloading' | 'done' | 'error'

function formatDate(dateTaken: string): string {
  if (!dateTaken) return ''
  const d = new Date(dateTaken.replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function PhotoDetail({ photo, onClose }: PhotoDetailProps): React.JSX.Element {
  const [sizes, setSizes] = useState<PhotoSize[]>([])
  const [previewUrl, setPreviewUrl] = useState(photo.thumbnailUrl)
  const [loadingSizes, setLoadingSizes] = useState(true)
  const [downloadState, setDownloadState] = useState<DownloadState>('idle')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Close on ESC
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // Subscribe to download progress events
  useEffect(() => {
    const unsubscribe = window.flickrAPI.onDownloadProgress((percent) => {
      setDownloadProgress(percent)
    })
    return unsubscribe
  }, [])

  // Load sizes when modal opens
  useEffect(() => {
    window.flickrAPI.getSizes(photo.id)
      .then((result) => {
        setSizes(result)
        // Use "Large" or "Medium 800" or "Medium 640" as preview
        const preview =
          result.find((s) => s.label === 'Large') ||
          result.find((s) => s.label === 'Medium 800') ||
          result.find((s) => s.label === 'Medium 640') ||
          result.find((s) => s.label === 'Medium')
        if (preview) setPreviewUrl(preview.source)
      })
      .catch(() => { /* keep thumbnail as fallback */ })
      .finally(() => setLoadingSizes(false))
  }, [photo.id])

  const original = sizes.find((s) => s.label === 'Original') || sizes[sizes.length - 1]

  const handleDownload = async (): Promise<void> => {
    setDownloadState('downloading')
    setDownloadProgress(0)
    setError(null)
    setSavedPath(null)

    try {
      const { filePath } = await window.flickrAPI.downloadPhoto(photo.id, photo.title)
      if (filePath) {
        setSavedPath(filePath)
        setDownloadState('done')
      } else {
        // User cancelled the save dialog
        setDownloadState('idle')
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Download failed'
      const cleaned = raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      if (cleaned.toLowerCase().includes('cancel') || cleaned.toLowerCase().includes('aborted')) {
        setDownloadState('idle')
        setDownloadProgress(0)
      } else {
        setError(cleaned)
        setDownloadState('error')
      }
    }
  }

  const filename = savedPath ? savedPath.split('/').pop() : null

  return (
    <div style={styles.overlay}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>

        {/* Close button */}
        <button style={styles.closeButton} onClick={onClose} aria-label="Close">✕</button>

        {/* Preview image */}
        <div style={styles.imageWrap}>
          <img
            src={previewUrl}
            alt={photo.title}
            style={styles.image}
          />
        </div>

        {/* Photo info */}
        <div style={styles.info}>
          <h2 style={styles.title}>{photo.title || 'Untitled'}</h2>
          {photo.dateTaken && (
            <p style={styles.date}>{formatDate(photo.dateTaken)}</p>
          )}
          {!loadingSizes && original && (
            <p style={styles.dimensions}>
              {original.width} × {original.height}
              {original.label === 'Original' ? ' · Original' : ''}
            </p>
          )}
        </div>

        {/* Download area */}
        <div style={styles.downloadArea}>
          {downloadState === 'idle' && (
            <button style={styles.downloadButton} onClick={handleDownload}>
              Download Original
            </button>
          )}

          {downloadState === 'downloading' && (
            <div style={styles.progressWrap}>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${downloadProgress}%` }} />
              </div>
              <div style={styles.progressRow}>
                <p style={styles.progressLabel}>{downloadProgress}%</p>
                <button
                  style={styles.cancelButton}
                  onClick={() => window.flickrAPI.cancelDownload()}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {downloadState === 'done' && savedPath && (
            <div style={styles.successWrap}>
              <p style={styles.successText}>✓ Saved as <strong>{filename}</strong></p>
              <div style={styles.successButtons}>
                <button style={styles.finderButton} onClick={() => window.flickrAPI.showInFinder(savedPath)}>
                  Show in Finder
                </button>
                <button style={styles.downloadAgainButton} onClick={() => setDownloadState('idle')}>
                  Download again
                </button>
              </div>
            </div>
          )}

          {downloadState === 'error' && (
            <div style={styles.errorWrap}>
              <p style={styles.errorText}>⚠️ {error}</p>
              <button style={styles.downloadButton} onClick={() => setDownloadState('idle')}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: '560px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)'
  },
  closeButton: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  imageWrap: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: '12px 12px 0 0',
    overflow: 'hidden',
    maxHeight: '360px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  image: {
    width: '100%',
    maxHeight: '360px',
    objectFit: 'contain',
    display: 'block'
  },
  info: {
    padding: '20px 24px 12px'
  },
  title: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#111',
    margin: '0 0 6px 0',
    lineHeight: '1.3'
  },
  date: {
    fontSize: '13px',
    color: '#888',
    margin: '0 0 4px 0'
  },
  dimensions: {
    fontSize: '12px',
    color: '#aaa',
    margin: 0
  },
  downloadArea: {
    padding: '12px 24px 24px'
  },
  downloadButton: {
    backgroundColor: '#FF0084',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%'
  },
  progressWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  progressTrack: {
    height: '8px',
    backgroundColor: '#eee',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF0084',
    borderRadius: '4px',
    transition: 'width 0.2s ease'
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  progressLabel: {
    fontSize: '13px',
    color: '#888',
    margin: 0
  },
  cancelButton: {
    background: 'none',
    border: 'none',
    fontSize: '13px',
    color: '#888',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0
  },
  successWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  successText: {
    fontSize: '14px',
    color: '#2a7a2a',
    margin: 0
  },
  successButtons: {
    display: 'flex',
    gap: '8px'
  },
  finderButton: {
    flex: 1,
    backgroundColor: '#FF0084',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  downloadAgainButton: {
    flex: 1,
    backgroundColor: 'transparent',
    color: '#888',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  errorWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  errorText: {
    fontSize: '13px',
    color: '#cc0000',
    margin: 0
  }
}
