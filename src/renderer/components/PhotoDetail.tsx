import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { FlickrPhoto, PhotoSize, PhotoInfo, DownloadSize, CameraExif } from '../../shared/types'

const PANEL_WIDTH_KEY = 'flickrfetch:detail-panel-width'
const PANEL_MIN = 240
const PANEL_MAX = 480
const PANEL_DEFAULT = 300

function loadPanelWidth(): number {
  try {
    const v = localStorage.getItem(PANEL_WIDTH_KEY)
    if (v) { const n = parseInt(v, 10); if (n >= PANEL_MIN && n <= PANEL_MAX) return n }
  } catch (_) {}
  return PANEL_DEFAULT
}

type DownloadState = 'idle' | 'downloading' | 'done' | 'error'

const LICENSE_NAMES: Record<string, string> = {
  '1': 'CC BY-NC-SA 2.0',
  '2': 'CC BY-NC 2.0',
  '3': 'CC BY-NC-ND 2.0',
  '4': 'CC BY 2.0',
  '5': 'CC BY-SA 2.0',
  '6': 'CC BY-ND 2.0',
  '7': 'No known copyright restrictions',
  '8': 'US Government Work',
  '9': 'CC0 1.0',
  '10': 'Public Domain Mark 1.0',
}

const DOWNLOAD_SIZE_OPTIONS: { value: DownloadSize; label: string; flickrLabels: string[] }[] = [
  { value: 'original', label: 'Original',    flickrLabels: ['Original'] },
  { value: 'xlarge',   label: 'Extra Large', flickrLabels: ['Large 2048', 'Large 1600'] },
  { value: 'large',    label: 'Large',       flickrLabels: ['Large'] },
  { value: 'medium',   label: 'Medium',      flickrLabels: ['Medium 800', 'Medium 640', 'Medium'] },
  { value: 'small',    label: 'Small',       flickrLabels: ['Small 320', 'Small'] },
  { value: 'square',   label: 'Square',      flickrLabels: ['Large Square', 'Square'] },
]

function getSizeOptionLabel(opt: typeof DOWNLOAD_SIZE_OPTIONS[number], sizes: PhotoSize[]): string {
  const photoSizes = sizes.filter(s => s.media === 'photo')
  for (const lbl of opt.flickrLabels) {
    const found = photoSizes.find(s => s.label === lbl)
    if (found) return `${opt.label} (${found.width} × ${found.height})`
  }
  return opt.label
}

function formatDate(dateTaken: string | null): string {
  if (!dateTaken) return ''
  const d = new Date(dateTaken.replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatUnixDate(unixStr: string | undefined): string {
  if (!unixStr) return ''
  const d = new Date(parseInt(unixStr, 10) * 1000)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function getPrivacyBadge(photo: FlickrPhoto): { label: string; bg: string; color: string } {
  if (photo.ispublic === 1) return { label: 'Public', bg: '#e8f8ea', color: '#27ae60' }
  if (photo.ispublic === undefined) return { label: 'Unknown', bg: '#f5f5f5', color: '#999' }
  if (photo.isfriend === 1 && photo.isfamily === 1) return { label: 'Friends & Family', bg: '#fff3e0', color: '#e67e22' }
  if (photo.isfriend === 1) return { label: 'Friends', bg: '#e8f4fd', color: '#2980b9' }
  if (photo.isfamily === 1) return { label: 'Family', bg: '#f0e8fd', color: '#8e44ad' }
  return { label: 'Private', bg: '#fce8e8', color: '#c0392b' }
}

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const handleCopy = (): void => {
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
      .catch(() => {})
  }
  return (
    <button style={styles.copyBtn} onClick={handleCopy} title="Copy to clipboard">
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="13 4 6 11 3 8" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="5" width="9" height="9" rx="1"/>
          <path d="M10 5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1"/>
        </svg>
      )}
    </button>
  )
}

interface PhotoDetailProps {
  photo: FlickrPhoto
  index: number
  total: number
  hasMore: boolean
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  sourceName: string
}

export default function PhotoDetail({
  photo, index, total, hasMore, canGoPrev, canGoNext, onPrev, onNext, onClose, sourceName
}: PhotoDetailProps): React.JSX.Element {
  const [sizes, setSizes] = useState<PhotoSize[]>([])
  const [info, setInfo] = useState<PhotoInfo | null>(null)
  const [exif, setExif] = useState<CameraExif | null>(null)
  const [previewUrl, setPreviewUrl] = useState(photo.thumbnailUrl)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [downloadSize, setDownloadSize] = useState<DownloadSize>('original')
  const [downloadState, setDownloadState] = useState<DownloadState>('idle')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [showScrollFade, setShowScrollFade] = useState(false)
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null)
  const [videoResolving, setVideoResolving] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef<number | null>(null)
  const dragStartWidth = useRef<number>(PANEL_DEFAULT)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartWidth.current = panelWidth
    let latestWidth = panelWidth

    const onMove = (ev: MouseEvent): void => {
      if (dragStartX.current === null) return
      const delta = dragStartX.current - ev.clientX
      latestWidth = Math.min(PANEL_MAX, Math.max(PANEL_MIN, dragStartWidth.current + delta))
      setPanelWidth(latestWidth)
    }
    const onUp = (): void => {
      dragStartX.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      try { localStorage.setItem(PANEL_WIDTH_KEY, String(latestWidth)) } catch (_) {}
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [panelWidth])

  const checkScrollFade = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    setShowScrollFade(el.scrollHeight > el.clientHeight + 4 && el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }, [])

  // Init downloadSize from settings once on mount (session-sticky: persists while navigating)
  useEffect(() => {
    window.flickrAPI.getSettings()
      .then(s => setDownloadSize(s.downloadSize))
      .catch(() => {})
  }, [])

  // Fetch sizes + info when photo changes
  useEffect(() => {
    setLoadingDetail(true)
    setSizes([])
    setInfo(null)
    setExif(null)
    setPreviewUrl(photo.thumbnailUrl)
    setVideoPlaying(false)
    setVideoStreamUrl(null)
    setVideoResolving(false)
    setVideoError(null)
    setDownloadState('idle')
    setSavedPath(null)
    setDownloadError(null)

    window.flickrAPI.getPhotoDetail(photo.id)
      .then(({ sizes: s, info: i, exif: e }) => {
        setSizes(s)
        setInfo(i)
        setExif(e)
        const preview =
          s.find(sz => sz.label === 'Large') ||
          s.find(sz => sz.label === 'Medium 800') ||
          s.find(sz => sz.label === 'Medium 640') ||
          s.filter(sz => sz.media === 'photo')[0]
        if (preview) setPreviewUrl(preview.source)
      })
      .catch(() => {})
      .finally(() => {
        setLoadingDetail(false)
      })
  }, [photo.id, checkScrollFade])

  // Subscribe to download progress
  useEffect(() => {
    const unsub = window.flickrAPI.onDownloadProgress(p => setDownloadProgress(p))
    return unsub
  }, [])

  // Keyboard navigation (←/→/Esc handled here so they work without mouse focus)
  const handleKey = useCallback((e: KeyboardEvent): void => {
    const tag = (document.activeElement as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.key === 'ArrowLeft' && canGoPrev) onPrev()
    if (e.key === 'ArrowRight' && canGoNext) onNext()
    if (e.key === 'Escape') onClose()
  }, [canGoPrev, canGoNext, onPrev, onNext, onClose])

  // Re-check scroll fade after content loads (double RAF ensures DOM is fully painted)
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(checkScrollFade))
    return () => cancelAnimationFrame(id)
  }, [loadingDetail, info, exif, checkScrollFade])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const handleDownload = async (): Promise<void> => {
    setDownloadState('downloading')
    setDownloadProgress(0)
    setDownloadError(null)
    setSavedPath(null)
    try {
      const { filePath } = await window.flickrAPI.downloadPhoto(photo.id, photo.title, downloadSize)
      if (filePath) {
        setSavedPath(filePath)
        setDownloadState('done')
      } else {
        setDownloadState('idle')
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Download failed'
      const cleaned = raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      if (cleaned.toLowerCase().includes('cancel') || cleaned.toLowerCase().includes('abort')) {
        setDownloadState('idle')
        setDownloadProgress(0)
      } else {
        setDownloadError(cleaned)
        setDownloadState('error')
      }
    }
  }

  const privacyBadge = getPrivacyBadge(photo)
  const originalSize = sizes.find(s => s.label === 'Original') ?? sizes.filter(s => s.media === 'photo').at(-1)

  // Find the best video source URL from sizes — widen filter to check label too,
  // since Flickr sometimes tags video sizes with media:'photo'
  const bestVideoSource = useMemo(() => {
    if (photo.media !== 'video') return null
    const pref = ['1080p', '720p', 'Video Original', '360p']
    const vids = sizes.filter(s =>
      s.media === 'video' && s.label !== 'Video Player'
    ).slice()
    vids.sort((a, b) => {
      const ai = pref.indexOf(a.label), bi = pref.indexOf(b.label)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    return vids[0]?.source ?? null
  }, [sizes, photo.media])

  const handleVideoPlay = useCallback(async () => {
    if (!bestVideoSource || videoResolving) return
    setVideoResolving(true)
    setVideoError(null)
    try {
      const url = await window.flickrAPI.resolveVideoUrl(bestVideoSource)
      setVideoStreamUrl(url)
      setVideoPlaying(true)
    } catch {
      setVideoError('Could not load video')
    } finally {
      setVideoResolving(false)
    }
  }, [bestVideoSource, videoResolving])

  return (
    <div style={styles.container}>
      {/* Left: dark image panel */}
      <div style={styles.imagePanel}>
        <button style={styles.backBtnOverlay} onClick={onClose}>← {sourceName}</button>

        {videoPlaying && videoStreamUrl ? (
          <video
            key={photo.id}
            src={videoStreamUrl}
            controls
            autoPlay
            style={styles.videoPlayer}
            onError={() => { setVideoPlaying(false); setVideoError('Video failed to play') }}
          />
        ) : (
          <>
            <img key={photo.id} src={previewUrl} alt={photo.title} style={styles.photo} />
            {photo.media === 'video' && (
              <div
                style={{ ...styles.videoPlayOverlay, cursor: videoResolving ? 'wait' : 'pointer', pointerEvents: 'auto' }}
                onClick={handleVideoPlay}
                title={videoResolving ? 'Loading…' : 'Play video'}
              >
                <div style={styles.videoPlayIcon}>
                  {videoResolving ? (
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>…</span>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
                      <polygon points="4,2 16,9 4,16" />
                    </svg>
                  )}
                </div>
                {videoError && (
                  <p style={styles.videoErrorText}>{videoError}</p>
                )}
              </div>
            )}
          </>
        )}

        {canGoPrev && (
          <button style={{ ...styles.navArrow, left: '12px' }} onClick={onPrev} title="Previous (←)">‹</button>
        )}
        {canGoNext && (
          <button style={{ ...styles.navArrow, right: '12px' }} onClick={onNext} title="Next (→)">›</button>
        )}

        <div style={styles.counter}>
          {index + 1} / {total}{hasMore ? '+' : ''}
        </div>
      </div>

      {/* Drag handle */}
      <div style={styles.dragHandle} onMouseDown={handleDragStart}>
        <div style={styles.dragGrip}>
          {[0,1,2,3,4,5].map(i => <div key={i} style={styles.dragDot} />)}
        </div>
      </div>

      {/* Right: info + download panel */}
      <div style={{ ...styles.infoPanel, width: `${panelWidth}px` }}>
        <div ref={scrollAreaRef} style={styles.scrollArea} onScroll={checkScrollFade}>
          <div style={styles.titleRow}>
            <h2 style={{ ...styles.photoTitle, flex: 1 }}>{photo.title || 'Untitled'}</h2>
            <CopyButton text={photo.title || ''} />
          </div>

          <div style={styles.metaRow}>
            <span style={{ ...styles.badge, backgroundColor: privacyBadge.bg, color: privacyBadge.color }}>
              {privacyBadge.label}
            </span>
          </div>

          {!loadingDetail && originalSize && (
            <div style={{ marginBottom: '4px' }}>
              <p style={{ ...styles.fieldLabel, marginBottom: '2px' }}>Dimensions</p>
              <p style={styles.metaDim}>{originalSize.width} × {originalSize.height}</p>
            </div>
          )}

          {(photo.dateTaken || photo.datePosted) && (
            <div style={styles.section}>
              <p style={styles.fieldLabel}>Dates</p>
              {photo.dateTaken && (
                <div style={styles.dateRow}>
                  <span style={styles.dateLabel}>Taken</span>
                  <span style={styles.fieldValue}>{formatDate(photo.dateTaken)}</span>
                </div>
              )}
              {photo.datePosted && (
                <div style={styles.dateRow}>
                  <span style={styles.dateLabel}>Posted</span>
                  <span style={styles.fieldValue}>{formatUnixDate(photo.datePosted)}</span>
                </div>
              )}
            </div>
          )}

          {info && (
            <div style={styles.section}>
              <p style={styles.fieldLabel}>Location</p>
              {info.latitude != null && info.longitude != null ? (
                <>
                  {info.locationName && (
                    <p style={{ ...styles.fieldValue, marginBottom: '4px' }}>{info.locationName}</p>
                  )}
                  <div style={styles.fieldRow}>
                    <span style={{ ...styles.fieldValue, fontSize: '11px', color: '#aaa', flex: 1 }}>
                      {info.latitude.toFixed(5)}°, {info.longitude.toFixed(5)}°
                    </span>
                    <CopyButton text={`${info.latitude}, ${info.longitude}`} />
                  </div>
                </>
              ) : (
                <p style={styles.noGeoText}>No location data</p>
              )}
            </div>
          )}

          {info?.description && (
            <div style={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                <p style={{ ...styles.fieldLabel, margin: 0, flex: 1 }}>Description</p>
                <CopyButton text={info.description} />
              </div>
              <p style={{ ...styles.fieldValue, margin: 0 }}>{info.description}</p>
            </div>
          )}

          {info && info.tags.length > 0 && (
            <div style={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                <p style={{ ...styles.fieldLabel, margin: 0, flex: 1 }}>Tags</p>
                <CopyButton text={info.tags.join(', ')} />
              </div>
              <div style={styles.tagWrap}>
                {info.tags.map(tag => <span key={tag} style={styles.tag}>{tag}</span>)}
              </div>
            </div>
          )}

          {exif && (exif.camera || exif.lens || exif.aperture || exif.shutterSpeed || exif.iso || exif.focalLength) && (
            <div style={styles.section}>
              <p style={styles.fieldLabel}>Camera</p>
              {exif.camera && <p style={{ ...styles.fieldValue, marginBottom: '6px' }}>{exif.camera}</p>}
              {exif.lens && <p style={{ ...styles.fieldValue, fontSize: '12px', color: '#555', marginBottom: '6px' }}>{exif.lens}</p>}
              <div style={styles.exifGrid}>
                {exif.aperture && <><span style={styles.exifLabel}>Aperture</span><span style={styles.exifVal}>{exif.aperture}</span></>}
                {exif.shutterSpeed && <><span style={styles.exifLabel}>Shutter</span><span style={styles.exifVal}>{exif.shutterSpeed}</span></>}
                {exif.iso && <><span style={styles.exifLabel}>ISO</span><span style={styles.exifVal}>{exif.iso}</span></>}
                {exif.focalLength && <><span style={styles.exifLabel}>Focal length</span><span style={styles.exifVal}>{exif.focalLength}</span></>}
              </div>
            </div>
          )}

          {info && (
            <div style={styles.section}>
              <p style={styles.fieldLabel}>License</p>
              <p style={styles.fieldValue}>{LICENSE_NAMES[info.license] ?? 'All Rights Reserved'}</p>
            </div>
          )}

          {info?.ownerPathAlias && (
            <div style={styles.section}>
              <p style={styles.fieldLabel}>Photo URL</p>
              <div style={styles.fieldRow}>
                <span style={{ ...styles.fieldValue, fontSize: '11px', flex: 1, wordBreak: 'break-all' as const }}>
                  flickr.com/photos/{info.ownerPathAlias}/{info.id}
                </span>
                <CopyButton text={`https://www.flickr.com/photos/${info.ownerPathAlias}/${info.id}`} />
              </div>
            </div>
          )}

          {info?.id && (
            <div style={styles.section}>
              <p style={styles.fieldLabel}>Photo ID</p>
              <div style={styles.fieldRow}>
                <span style={{ ...styles.fieldValue, flex: 1 }}>{info.id}</span>
                <CopyButton text={info.id} />
              </div>
            </div>
          )}
        </div>

        {showScrollFade && (
          <div style={styles.scrollFade}>
            <span style={styles.scrollChevron}>▼</span>
          </div>
        )}

        {/* Download area — fixed at bottom of panel */}
        <div style={styles.downloadArea}>
          {photo.media !== 'video' ? (
            <select
              value={downloadSize}
              onChange={e => setDownloadSize(e.target.value as DownloadSize)}
              style={styles.sizeSelect}
              disabled={downloadState === 'downloading'}
            >
              {DOWNLOAD_SIZE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {loadingDetail ? opt.label : getSizeOptionLabel(opt, sizes)}
                </option>
              ))}
            </select>
          ) : (
            <p style={styles.videoQualityNote}>Downloads at best available quality</p>
          )}

          {downloadState === 'idle' && (
            <button style={styles.downloadBtn} onClick={handleDownload}>Download</button>
          )}

          {downloadState === 'downloading' && (
            <div>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${downloadProgress}%` }} />
              </div>
              <div style={styles.progressRow}>
                <span style={styles.progressLabel}>{downloadProgress}%</span>
                <button style={styles.cancelBtn} onClick={() => window.flickrAPI.cancelDownload()}>Cancel</button>
              </div>
            </div>
          )}

          {downloadState === 'done' && savedPath && (
            <div>
              <p style={styles.successText}>✓ {savedPath.split('/').pop()}</p>
              <div style={styles.successBtns}>
                <button style={styles.finderBtn} onClick={() => window.flickrAPI.showInFinder(savedPath)}>
                  Show in Finder
                </button>
                <button style={styles.againBtn} onClick={() => setDownloadState('idle')}>
                  Download again
                </button>
              </div>
            </div>
          )}

          {downloadState === 'error' && (
            <div>
              <p style={styles.errorText}>⚠️ {downloadError}</p>
              <button style={{ ...styles.downloadBtn, marginTop: '8px' }} onClick={() => setDownloadState('idle')}>
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
  container: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
  },
  imagePanel: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#111',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: '20px',
  },
  photo: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  videoPlayer: {
    maxWidth: '100%',
    maxHeight: '100%',
    display: 'block',
    outline: 'none',
  },
  videoErrorText: {
    position: 'absolute' as const,
    bottom: '20px',
    left: 0,
    right: 0,
    textAlign: 'center' as const,
    color: '#ff6b6b',
    fontSize: '12px',
    margin: 0,
    pointerEvents: 'none' as const,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    border: 'none',
    color: '#fff',
    borderRadius: '50%',
    width: '38px',
    height: '38px',
    fontSize: '24px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    zIndex: 1,
  },
  counter: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#ccc',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '10px',
    userSelect: 'none',
  },
  dragHandle: {
    width: '14px',
    flexShrink: 0,
    cursor: 'col-resize',
    backgroundColor: 'transparent',
    borderLeft: '1px solid #e8e4de',
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '72px',
  },
  infoPanel: {
    flexShrink: 0,
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  backBtnOverlay: {
    position: 'absolute' as const,
    top: '14px',
    left: '14px',
    backgroundColor: 'rgba(0,0,0,0.5)',
    border: 'none',
    color: '#fff',
    borderRadius: '7px',
    fontSize: '13px',
    padding: '7px 13px',
    cursor: 'pointer',
    zIndex: 2,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    marginBottom: '8px',
  },
  photoTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#111',
    margin: 0,
    lineHeight: 1.3,
  },
  dateRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    marginBottom: '4px',
  },
  dateLabel: {
    fontSize: '11px',
    color: '#aaa',
    fontWeight: '500',
    width: '42px',
    flexShrink: 0,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
    flexWrap: 'wrap' as const,
  },
  metaDate: {
    fontSize: '12px',
    color: '#888',
  },
  badge: {
    fontSize: '10px',
    fontWeight: '500',
    padding: '2px 7px',
    borderRadius: '20px',
  },
  metaDim: {
    fontSize: '11px',
    color: '#888',
    margin: '0 0 4px',
  },
  section: {
    marginTop: '14px',
    paddingTop: '14px',
    borderTop: '1px solid #f0ece6',
  },
  fieldLabel: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    margin: '0 0 4px',
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: '13px',
    color: '#333',
    margin: 0,
    lineHeight: 1.5,
    userSelect: 'text' as const,
    wordBreak: 'break-word' as const,
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
  },
  tagWrap: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginTop: '4px',
  },
  tag: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '20px',
    backgroundColor: '#f0ece6',
    color: '#666',
    userSelect: 'text' as const,
  },
  copyBtn: {
    background: 'none',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '2px 5px',
    color: '#999',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
  },
  downloadArea: {
    padding: '12px 16px 14px',
    borderTop: '1px solid #e8e4de',
    flexShrink: 0,
    backgroundColor: '#fff',
  },
  sizeSelect: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '12px',
    marginBottom: '8px',
    backgroundColor: '#fff',
    color: '#333',
  },
  downloadBtn: {
    width: '100%',
    padding: '9px',
    backgroundColor: '#FF0084',
    color: '#fff',
    border: 'none',
    borderRadius: '7px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  progressTrack: {
    height: '6px',
    backgroundColor: '#eee',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '5px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF0084',
    borderRadius: '3px',
    transition: 'width 0.2s ease',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: '12px',
    color: '#888',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    fontSize: '12px',
    color: '#888',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  },
  successText: {
    fontSize: '13px',
    color: '#2a7a2a',
    margin: '0 0 8px',
    wordBreak: 'break-all' as const,
  },
  successBtns: {
    display: 'flex',
    gap: '6px',
  },
  finderBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#FF0084',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  againBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: 'transparent',
    color: '#888',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  errorText: {
    fontSize: '12px',
    color: '#cc0000',
    margin: '0 0 0',
  },
  dragGrip: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '3px',
    padding: '1px',
  },
  dragDot: {
    width: '3px',
    height: '3px',
    borderRadius: '50%',
    backgroundColor: '#b8b4ae',
  },
  videoPlayOverlay: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none' as const,
  },
  videoPlayIcon: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: '3px',
  },
  videoQualityNote: {
    fontSize: '11px',
    color: '#777',
    margin: '0 0 8px',
    textAlign: 'center' as const,
  },
  noGeoText: {
    fontSize: '12px',
    color: '#bbb',
    margin: 0,
    fontStyle: 'italic' as const,
  },
  exifGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '3px 10px',
    marginTop: '2px',
  },
  exifLabel: {
    fontSize: '11px',
    color: '#777',
    whiteSpace: 'nowrap' as const,
  },
  exifVal: {
    fontSize: '11px',
    color: '#444',
  },
  scrollFade: {
    height: '36px',
    background: 'linear-gradient(to top, #fff 50%, transparent)',
    marginTop: '-36px',
    position: 'relative',
    zIndex: 1,
    pointerEvents: 'none',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '5px',
  },
  scrollChevron: {
    fontSize: '9px',
    color: '#888',
    background: 'rgba(0,0,0,0.07)',
    borderRadius: '10px',
    padding: '2px 9px',
    lineHeight: 1,
  },
}
