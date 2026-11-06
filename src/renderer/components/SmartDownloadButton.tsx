import React, { useState, useRef, useEffect } from 'react'

type SmartMode = 'all' | 'updated' | 'never-downloaded'

interface SmartDownloadButtonProps {
  label: string         // primary button label, e.g. "Download Album" or "Download All"
  onDownload: (mode: SmartMode) => void
  disabled?: boolean
}

export default function SmartDownloadButton({ label, onDownload, disabled }: SmartDownloadButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function choose(mode: SmartMode) {
    setOpen(false)
    onDownload(mode)
  }

  return (
    <div ref={ref} style={styles.wrapper}>
      <button
        style={{ ...styles.mainBtn, ...(disabled ? styles.disabled : {}) }}
        disabled={disabled}
        onClick={() => choose('all')}
      >
        {label}
      </button>
      <button
        style={{ ...styles.arrowBtn, ...(disabled ? styles.disabled : {}) }}
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        aria-label="More download options"
      >
        ▾
      </button>

      {open && (
        <div style={styles.dropdown}>
          <button style={styles.item} onClick={() => choose('all')}>
            <span style={styles.itemTitle}>Download All</span>
            <span style={styles.itemDesc}>All photos in this source</span>
          </button>
          <div style={styles.divider} />
          <button style={styles.item} onClick={() => choose('updated')}>
            <span style={styles.itemTitle}>Download Updated</span>
            <span style={styles.itemDesc}>Photos changed since last download</span>
          </button>
          <button style={styles.item} onClick={() => choose('never-downloaded')}>
            <span style={styles.itemTitle}>Download Never Downloaded</span>
            <span style={styles.itemDesc}>Only photos not yet downloaded</span>
          </button>
        </div>
      )}
    </div>
  )
}

const BTN_BG = 'var(--ff-pink-action)'

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative', display: 'inline-flex',
  },
  mainBtn: {
    background: BTN_BG, color: '#fff',
    border: 'none', borderRadius: '6px 0 0 6px',
    padding: '7px 14px', fontSize: 13, fontWeight: 500,
    cursor: 'pointer',
    lineHeight: 1,
  },
  arrowBtn: {
    background: BTN_BG, color: '#fff',
    border: 'none', borderLeft: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '0 6px 6px 0',
    padding: '7px 8px', fontSize: 11,
    cursor: 'pointer',
    lineHeight: 1,
  },
  disabled: {
    opacity: 0.5, cursor: 'not-allowed',
  },
  dropdown: {
    position: 'absolute', top: '100%', right: 0, zIndex: 200,
    marginTop: 4,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    minWidth: 240,
    overflow: 'hidden',
  },
  item: {
    display: 'flex', flexDirection: 'column', gap: 2,
    width: '100%', padding: '10px 14px',
    background: 'none', border: 'none', textAlign: 'left',
    cursor: 'pointer',
  },
  itemTitle: {
    fontSize: 13, fontWeight: 500, color: '#111827',
  },
  itemDesc: {
    fontSize: 11, color: '#9ca3af',
  },
  divider: {
    height: 1, background: '#f3f4f6', margin: '2px 0',
  },
}
