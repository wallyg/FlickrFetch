import React, { useState, useEffect, useRef } from 'react'
import type { BatchProgress } from '../../shared/types'

interface DownloadQueueBarProps {
  progress: BatchProgress | null
  completedBatches?: BatchProgress[]
  onDismiss: () => void
  onStackedDismiss?: (idx: number) => void
  onDismissAll?: () => void
}

const TOAST_MS = 2500
const CANCEL_DISMISS_MS = 10000

export default function DownloadQueueBar({ progress, completedBatches = [], onDismiss, onStackedDismiss, onDismissAll }: DownloadQueueBarProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-expand and reset folder when a new batch starts
  useEffect(() => {
    if (progress?.allTitles && progress.allTitles.length > 0) {
      setExpanded(true)
      setCancelling(false)
      setFolderPath(null)
    }
  }, [progress?.allTitles])

  // Persist folder path — only update when non-null; never clear it
  useEffect(() => {
    if (progress?.latestFilePath) {
      setFolderPath(progress.latestFilePath.substring(0, progress.latestFilePath.lastIndexOf('/')))
    }
  }, [progress?.latestFilePath])

  // Toast (not expand) when another batch is queued
  const prevQueuedCount = useRef(0)
  useEffect(() => {
    const count = progress?.queuedCount ?? 0
    if (count > prevQueuedCount.current) {
      const queued = progress?.queuedAlbums ?? []
      const newest = queued[queued.length - 1]
      setToastMsg(newest ? `Queued: ${newest.title}` : 'Added to queue')
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToastMsg(null), TOAST_MS)
    }
    prevQueuedCount.current = count
  }, [progress?.queuedCount, progress?.queuedAlbums])

  // Clear cancelling once cancelled status lands
  useEffect(() => {
    if (progress?.status === 'cancelled') setCancelling(false)
  }, [progress?.status])

  // Auto-dismiss after cancelled — always, at 6s
  useEffect(() => {
    if (progress?.status === 'cancelled') {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      dismissTimer.current = setTimeout(onDismiss, CANCEL_DISMISS_MS)
    }
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current) }
  }, [progress?.status, onDismiss])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [])

  const status = progress?.status ?? null
  const current = progress?.current ?? 0
  const total = progress?.total ?? 0
  const albumTitle = progress?.albumTitle ?? ''
  const activeTitle = progress?.activeTitle ?? ''
  const skipped = progress?.skippedCount ?? 0
  const failed = progress?.failedCount ?? 0
  const smartFiltered = progress?.smartFilteredCount ?? 0
  const downloaded = total - skipped - failed
  const percent = total > 0 ? Math.round((current / total) * 100) : 0
  const isRunning = status === 'running'
  const isDone = status === 'done'
  const isCancelled = status === 'cancelled'
  const doneWithIssues = isDone && (skipped > 0 || failed > 0)

  // Color-coded left border by status
  const borderColor = isRunning ? '#FF0084'
    : doneWithIssues ? '#ff8c00'
    : isDone ? '#4caf50'
    : isCancelled ? '#cc6600'
    : completedBatches.length > 0 ? (completedBatches.some(b => ((b.skippedCount ?? 0) + (b.failedCount ?? 0)) > 0) ? '#ff8c00' : '#4caf50')
    : 'transparent'

  const handleCancel = (): void => {
    setCancelling(true)
    window.flickrAPI.cancelBatch()
  }

  const handleDismiss = (): void => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    onDismiss()
  }

  return (
    <div style={{ ...styles.wrapper, borderLeft: `4px solid ${borderColor}` }}>

      {/* Toast: brief confirmation when a batch is queued */}
      {toastMsg && (
        <div style={styles.toast}>{toastMsg}</div>
      )}

      {/* Expanded panel: batch-level checklist */}
      {expanded && (
        <div style={styles.panel}>

          {/* Current / most recent batch */}
          <div style={styles.batchRow}>
            <span style={isRunning ? styles.dotActive : isDone ? styles.dotDone : styles.dotCancelled}>
              {isDone ? '✓' : isCancelled ? '✕' : '→'}
            </span>
            <div style={styles.batchInfo}>
              <div style={styles.batchTitleRow}>
                <span style={styles.batchTitle}>{albumTitle}</span>
                {folderPath && (
                  <button
                    style={styles.finderLink}
                    onClick={() => window.flickrAPI.showInFinder(folderPath)}
                  >
                    Open in Finder
                  </button>
                )}
              </div>
              <span style={styles.batchMeta}>
                {isRunning && `${current.toLocaleString()} of ${total.toLocaleString()}`}
                {isDone && (() => {
                  const parts: string[] = [`${downloaded.toLocaleString()} saved`]
                  if (skipped > 0) parts.push(`${skipped.toLocaleString()} skipped`)
                  if (failed > 0) parts.push(`${failed.toLocaleString()} failed`)
                  if (smartFiltered > 0) parts.push(`${smartFiltered.toLocaleString()} already downloaded`)
                  return parts.join(' · ')
                })()}
                {isCancelled && `${current.toLocaleString()} of ${total.toLocaleString()} before cancel`}
              </span>
              {/* Live filename ticker */}
              {isRunning && activeTitle && (
                <span style={styles.activeTicker}>↓ {activeTitle}</span>
              )}
            </div>
          </div>

          {/* Queued batches */}
          {(progress?.queuedAlbums ?? []).length > 0 && (
            <>
              <div style={styles.divider} />
              {(progress?.queuedAlbums ?? []).map((album, i) => {
                const parts: string[] = []
                if (album.photoCount) parts.push(`${album.photoCount.toLocaleString()} photo${album.photoCount !== 1 ? 's' : ''}`)
                if (album.videoCount) parts.push(`${album.videoCount.toLocaleString()} video${album.videoCount !== 1 ? 's' : ''}`)
                return (
                  <div key={i} style={styles.batchRow}>
                    <span style={styles.dotQueued}>○</span>
                    <div style={styles.batchInfo}>
                      <span style={styles.batchTitleQueued}>{album.title}</span>
                      {parts.length > 0 && <span style={styles.batchMeta}>{parts.join(' · ')}</span>}
                    </div>
                    <button
                      style={styles.removeQueueBtn}
                      title="Remove from queue"
                      onClick={() => window.flickrAPI.removeFromQueue(album.id)}
                    >✕</button>
                  </div>
                )
              })}
            </>
          )}

          {/* Stacked completed batches */}
          {completedBatches.length > 0 && (
            <>
              <div style={styles.divider} />
              {completedBatches.map((b, i) => {
                const bSkipped = b.skippedCount ?? 0
                const bFailed = b.failedCount ?? 0
                const bSmartFiltered = b.smartFilteredCount ?? 0
                const bDownloaded = (b.total ?? 0) - bSkipped - bFailed
                const bHasIssues = bSkipped > 0 || bFailed > 0 || bSmartFiltered > 0
                const bFolder = b.latestFilePath ? b.latestFilePath.substring(0, b.latestFilePath.lastIndexOf('/')) : null
                const bParts = [`${bDownloaded.toLocaleString()} saved`]
                if (bSkipped > 0) bParts.push(`${bSkipped.toLocaleString()} skipped`)
                if (bFailed > 0) bParts.push(`${bFailed.toLocaleString()} failed`)
                if (bSmartFiltered > 0) bParts.push(`${bSmartFiltered.toLocaleString()} already downloaded`)
                return (
                  <div key={i} style={styles.batchRow}>
                    <span style={bHasIssues ? styles.dotSkipped : styles.dotDone}>✓</span>
                    <div style={styles.batchInfo}>
                      <div style={styles.batchTitleRow}>
                        <span style={styles.batchTitle}>{b.albumTitle}</span>
                        {bFolder && (
                          <button style={styles.finderLink} onClick={() => window.flickrAPI.showInFinder(bFolder)}>
                            Open in Finder
                          </button>
                        )}
                      </div>
                      <span style={styles.batchMeta}>{bParts.join(' · ')}</span>
                    </div>
                    <button style={styles.removeQueueBtn} title="Dismiss" onClick={() => onStackedDismiss?.(i)}>✕</button>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div style={styles.bar}>
        <div style={styles.left}>
          <button style={styles.expandBtn} onClick={() => setExpanded((v) => !v)} title={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '▾' : '▸'}
          </button>
          {isRunning && (
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${percent}%` }} />
            </div>
          )}
          <span style={{ ...styles.label, ...(isRunning ? styles.labelRunning : {}) }}>
            {cancelling && 'Cancelling…'}
            {!cancelling && isRunning && `${current.toLocaleString()} of ${total.toLocaleString()} · ${albumTitle}${progress?.queuedCount ? ` · +${progress.queuedCount} queued` : ''}`}
            {!cancelling && isDone && (() => {
              const parts: string[] = [`✓ ${downloaded.toLocaleString()} saved`]
              if (skipped > 0) parts.push(`${skipped.toLocaleString()} skipped`)
              if (failed > 0) parts.push(`${failed.toLocaleString()} failed`)
              if (smartFiltered > 0) parts.push(`${smartFiltered.toLocaleString()} already downloaded`)
              parts.push(albumTitle)
              return parts.join(' · ')
            })()}
            {!cancelling && isCancelled && `Cancelled · ${current.toLocaleString()} of ${total.toLocaleString()} · ${albumTitle}`}
            {!progress && completedBatches.length > 0 && (() => {
              const newest = completedBatches[0]
              const ns = newest.skippedCount ?? 0
              const nf = newest.failedCount ?? 0
              const nsf = newest.smartFilteredCount ?? 0
              const nd = (newest.total ?? 0) - ns - nf
              const parts = [`✓ ${nd.toLocaleString()} saved`]
              if (ns > 0) parts.push(`${ns.toLocaleString()} skipped`)
              if (nf > 0) parts.push(`${nf.toLocaleString()} failed`)
              if (nsf > 0) parts.push(`${nsf.toLocaleString()} already downloaded`)
              parts.push(newest.albumTitle)
              return parts.join(' · ')
            })()}
          </span>
        </div>
        <div style={styles.right}>
          {isRunning && !cancelling && (progress?.queuedCount ?? 0) > 0 && (
            <button style={styles.skipBtn} onClick={() => window.flickrAPI.skipBatch()}>
              Skip
            </button>
          )}
          {(isRunning || cancelling) && (
            <button style={styles.cancelBtn} onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : (progress?.queuedCount ?? 0) > 0 ? 'Cancel all' : 'Cancel'}
            </button>
          )}
          {(isDone || isCancelled) && !cancelling && folderPath && (
            <button style={styles.finderLinkBar} onClick={() => window.flickrAPI.showInFinder(folderPath)}>
              Open in Finder
            </button>
          )}
          {completedBatches.length >= 2 && (
            <button style={styles.dismissAllBtn} onClick={onDismissAll}>Dismiss all</button>
          )}
          {(isDone || isCancelled) && !cancelling && (
            <button style={styles.dismissBtn} onClick={handleDismiss} title="Dismiss">✕</button>
          )}
          {!progress && completedBatches.length > 0 && completedBatches.length < 2 && (
            <button style={styles.dismissBtn} onClick={() => onStackedDismiss?.(0)} title="Dismiss">✕</button>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flexShrink: 0,
    borderTop: '1px solid #e0dbd4',
    backgroundColor: '#FCFAF6'
  },
  toast: {
    padding: '7px 20px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#555',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e8e4de'
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    gap: '12px'
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: 0
  },
  expandBtn: {
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontSize: '12px',
    color: '#555',
    cursor: 'pointer',
    padding: '3px 8px',
    flexShrink: 0,
    fontWeight: '500'
  },
  progressTrack: {
    width: '120px',
    height: '6px',
    backgroundColor: '#e0dbd4',
    borderRadius: '3px',
    overflow: 'hidden',
    flexShrink: 0
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF0084',
    borderRadius: '3px',
    transition: 'width 0.3s ease'
  },
  label: {
    fontSize: '13px',
    color: '#666',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  labelRunning: {
    color: '#333',
    fontWeight: '500'
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0
  },
  skipBtn: {
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#999',
    cursor: 'pointer',
    padding: '4px 10px'
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#666',
    cursor: 'pointer',
    padding: '4px 12px'
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    fontSize: '15px',
    color: '#999',
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1
  },
  panel: {
    borderTop: '1px solid #e8e4de',
    backgroundColor: '#fff',
    maxHeight: '280px',
    overflowY: 'auto'
  },
  batchRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '11px 20px'
  },
  dotActive: {
    fontSize: '14px',
    color: '#FF0084',
    flexShrink: 0,
    marginTop: '2px',
    fontWeight: '700'
  },
  dotDone: {
    fontSize: '13px',
    color: '#4caf50',
    flexShrink: 0,
    marginTop: '2px'
  },
  dotCancelled: {
    fontSize: '13px',
    color: '#cc6600',
    flexShrink: 0,
    marginTop: '2px'
  },
  dotSkipped: {
    fontSize: '13px',
    color: '#ff8c00',
    flexShrink: 0,
    marginTop: '2px'
  },
  dotQueued: {
    fontSize: '13px',
    color: '#ccc',
    flexShrink: 0,
    marginTop: '2px'
  },
  batchInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
    flex: 1
  },
  batchTitleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px'
  },
  batchTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#222',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0
  },
  batchTitleQueued: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#999',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  batchMeta: {
    fontSize: '12px',
    color: '#aaa'
  },
  activeTicker: {
    fontSize: '11px',
    color: '#bbb',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  finderLink: {
    background: 'none',
    border: 'none',
    fontSize: '11px',
    color: '#0063DC',
    cursor: 'pointer',
    padding: '0',
    flexShrink: 0,
    whiteSpace: 'nowrap'
  },
  finderLinkBar: {
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#0063DC',
    cursor: 'pointer',
    padding: '4px 10px',
    flexShrink: 0,
    whiteSpace: 'nowrap'
  },
  removeQueueBtn: {
    background: 'none',
    border: 'none',
    fontSize: '12px',
    color: '#ccc',
    cursor: 'pointer',
    padding: '2px 4px',
    flexShrink: 0,
    lineHeight: 1
  },
  dismissAllBtn: {
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#666',
    cursor: 'pointer',
    padding: '4px 10px'
  },
  divider: {
    height: '1px',
    backgroundColor: '#f0ede8',
    margin: '0 20px'
  }
}
