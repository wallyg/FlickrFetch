import React, { useEffect, useState, useCallback } from 'react'
import type { BatchLogEntry } from '../../shared/types'

interface HistoryPanelProps {
  onClose: () => void
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })
}

function sourceLabel(entry: BatchLogEntry): string {
  if (entry.sourceType === 'photostream') return 'Photostream'
  if (entry.sourceType === 'selected') return `Selected — ${entry.source}`
  return entry.source
}

function statusDot(status: BatchLogEntry['status']): string {
  switch (status) {
    case 'complete': return '✓'
    case 'partial': return '⚠'
    case 'cancelled': return '✕'
    case 'error': return '!'
  }
}

function statusColor(status: BatchLogEntry['status']): string {
  switch (status) {
    case 'complete': return '#22c55e'
    case 'partial': return '#f59e0b'
    case 'cancelled': return '#94a3b8'
    case 'error': return '#ef4444'
  }
}

export default function HistoryPanel({ onClose }: HistoryPanelProps) {
  const [entries, setEntries] = useState<BatchLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const log = await window.flickrAPI.getBatchLog()
      setEntries(log)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleClear() {
    if (!confirming) { setConfirming(true); return }
    await window.flickrAPI.clearHistory()
    setConfirming(false)
    setEntries([])
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Download History</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={styles.body}>
          {loading ? (
            <p style={styles.empty}>Loading…</p>
          ) : entries.length === 0 ? (
            <p style={styles.empty}>No download history yet. History is tracked for 90 days.</p>
          ) : (
            <div style={styles.list}>
              {entries.map(entry => (
                <div key={entry.id} style={styles.row}>
                  <div style={styles.rowTop}>
                    <span style={{ ...styles.statusDot, color: statusColor(entry.status) }}>
                      {statusDot(entry.status)}
                    </span>
                    <span style={styles.source}>{sourceLabel(entry)}</span>
                    <span style={styles.date}>{formatDate(entry.createdAt)}</span>
                  </div>
                  <div style={styles.rowCounts}>
                    <span style={styles.countSaved}>{entry.downloaded} saved</span>
                    {entry.skippedCollision > 0 && (
                      <span style={styles.countSkip}>{entry.skippedCollision} skipped</span>
                    )}
                    {entry.failed > 0 && (
                      <span style={styles.countFail}>{entry.failed} failed</span>
                    )}
                    <span style={styles.countTotal}>of {entry.total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <div style={styles.footer}>
            <button
              style={confirming ? styles.confirmBtn : styles.clearBtn}
              onClick={handleClear}
            >
              {confirming ? 'Tap again to confirm — this clears all history' : 'Reset history'}
            </button>
            {confirming && (
              <button style={styles.cancelConfirm} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 400,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
  },
  panel: {
    width: 420, height: '100vh',
    background: '#fff',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 20px 16px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    margin: 0, fontSize: 17, fontWeight: 600, color: '#0E2A4D',
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 22, color: '#6b7280', lineHeight: 1,
    padding: '0 4px',
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '12px 0',
  },
  empty: {
    padding: '24px 20px', color: '#9ca3af', fontSize: 13, lineHeight: 1.5,
  },
  list: {
    display: 'flex', flexDirection: 'column',
  },
  row: {
    padding: '10px 20px',
    borderBottom: '1px solid #f3f4f6',
  },
  rowTop: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  statusDot: {
    fontSize: 12, fontWeight: 700, width: 14, textAlign: 'center',
  },
  source: {
    flex: 1, fontSize: 13, fontWeight: 500, color: '#111827',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  date: {
    fontSize: 11, color: '#9ca3af', flexShrink: 0,
  },
  rowCounts: {
    display: 'flex', gap: 10, paddingLeft: 22, fontSize: 12,
  },
  countSaved: { color: '#22c55e' },
  countSkip:  { color: '#f59e0b' },
  countFail:  { color: '#ef4444' },
  countTotal: { color: '#9ca3af' },
  footer: {
    padding: '12px 20px', borderTop: '1px solid #e5e7eb',
    display: 'flex', gap: 8, alignItems: 'center',
  },
  clearBtn: {
    background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
    padding: '6px 12px', fontSize: 12, color: '#6b7280', cursor: 'pointer',
  },
  confirmBtn: {
    background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6,
    padding: '6px 12px', fontSize: 12, color: '#dc2626', cursor: 'pointer',
  },
  cancelConfirm: {
    background: 'none', border: 'none', fontSize: 12, color: '#6b7280', cursor: 'pointer',
  },
}
