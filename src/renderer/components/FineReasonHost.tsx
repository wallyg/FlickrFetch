import React, { useEffect, useRef, useState } from 'react'
import { onFineAsk, type FineAsk } from '../ui/fineReason'
import { fineReasonsFor, ruleById } from '../../shared/cleanupRules'
import { quietBtn } from '../ui/kit'

// The bar that appears at the bottom after "This one is fine": a few quick reasons for that check, an Other box, and Skip. It stays
// about 12 seconds (longer while you hover it or type), saves the reason with the decision on this computer, and never blocks anything.

const SHOW_MS = 12000

export default function FineReasonHost(): React.JSX.Element | null {
  const [ask, setAsk] = useState<FineAsk | null>(null)
  const [other, setOther] = useState<string | null>(null)   // null: not typing; text: the Other box is open
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hold = useRef(false)

  const clear = (): void => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  const arm = (ms = SHOW_MS): void => { clear(); timer.current = setTimeout(() => { if (hold.current) arm(4000); else setAsk(null) }, ms) }
  useEffect(() => onFineAsk(a => { setAsk(a); setOther(null); setDone(false); hold.current = false; arm() }), [])
  useEffect(() => clear, [])

  if (!ask) return null
  const rule = ruleById(ask.checkId)
  const save = (reason: string, note?: string): void => {
    void window.flickrAPI.setFineReason({ checkId: ask.checkId, key: ask.key, label: ask.label, reason, note })
    setDone(true); clear(); timer.current = setTimeout(() => setAsk(null), 1600)
  }
  return (
    <div role="status" style={styles.bar} onMouseEnter={() => { hold.current = true }} onMouseLeave={() => { hold.current = false }}>
      {done ? <span>Noted. Thank you.</span> : (
        <>
          <span style={styles.lead}>Marked fine{rule ? ` (${rule.name})` : ''}. Why?</span>
          {other === null ? (
            <>
              {fineReasonsFor(ask.checkId).map(r => <button key={r} style={styles.chip} onClick={() => save(r)}>{r}</button>)}
              <button style={styles.chip} onClick={() => { setOther(''); hold.current = true }}>Other…</button>
              <button style={styles.skip} onClick={() => { clear(); setAsk(null) }}>Skip</button>
            </>
          ) : (
            <>
              <input autoFocus style={styles.input} placeholder="In a few words" value={other} maxLength={200} onChange={e => setOther(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && other.trim()) save('Other', other); if (e.key === 'Escape') { setOther(null); hold.current = false } }} aria-label="Your reason" />
              <button style={styles.chip} disabled={!other.trim()} onClick={() => save('Other', other)}>Save</button>
              <button style={styles.skip} onClick={() => { setOther(null); hold.current = false }}>Back</button>
            </>
          )}
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bar: { position: 'fixed', left: '50%', bottom: 22, transform: 'translateX(-50%)', zIndex: 100, maxWidth: 'min(860px, calc(100vw - 48px))', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '9px 14px', background: 'var(--ff-navy)', color: 'var(--ff-white)', borderRadius: 12, fontSize: 13, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
  lead: { fontWeight: 600, marginRight: 4 },
  chip: { ...quietBtn, background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.35)', color: 'var(--ff-white)', fontSize: 12, padding: '4px 10px' },
  skip: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', fontSize: 12, textDecoration: 'underline', cursor: 'pointer', marginLeft: 4 },
  input: { width: 300, border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '4px 8px', fontSize: 13, background: 'var(--ff-surface)', color: 'var(--ff-text)' }
}
