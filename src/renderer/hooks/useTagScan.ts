import { useCallback, useEffect, useState } from 'react'
import type { TagIndexStatus, TagScanProgress } from '../../shared/types'

// The library scan (tag list, dates, privacy, locations): its status, progress, and the Refresh / Full rescan
// actions. Used by the Tags tab and the Cleanup tab, which both read from it.

export function useTagScan(): {
  status: TagIndexStatus | null
  progress: TagScanProgress | null
  scanError: string | null
  scanning: boolean
  startScan: (mode: 'full' | 'refresh') => Promise<void>
  startFullRescan: () => Promise<void>
} {
  const [status, setStatus] = useState<TagIndexStatus | null>(null)
  const [progress, setProgress] = useState<TagScanProgress | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try { setStatus(await window.flickrAPI.getTagIndexStatus()) } catch { /* shown as empty state */ }
  }, [])
  useEffect(() => { void loadStatus() }, [loadStatus])

  const scanning = !!(status?.scanning || (progress !== null && progress.phase !== 'done' && progress.phase !== 'cancelled' && progress.phase !== 'error'))

  useEffect(() => {
    return window.flickrAPI.onTagScanProgress(p => {
      setProgress(p)
      if (p.phase === 'error') setScanError(p.error ?? 'The scan stopped unexpectedly')
      if (p.phase === 'done' || p.phase === 'cancelled' || p.phase === 'error') void loadStatus()
    })
  }, [loadStatus])

  const startScan = useCallback(async (mode: 'full' | 'refresh'): Promise<void> => {
    setScanError(null)
    setProgress({ mode, phase: 'scanning', page: 0, pages: 0, photos: 0, total: 0 })
    try {
      const r = await window.flickrAPI.startTagScan(mode)
      if (!r.started) setProgress(null)
    } catch (err) {
      setProgress(null)
      setScanError(String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }, [])

  const startFullRescan = useCallback(async (): Promise<void> => {
    const ok = await window.flickrAPI.confirm('Rebuild from scratch?', 'This reads all your photos again to rebuild the tag list and the metadata report.\n\nIt takes a few minutes.', 'Rebuild')
    if (ok) void startScan('full')
  }, [startScan])

  return { status, progress, scanError, scanning, startScan, startFullRescan }
}
