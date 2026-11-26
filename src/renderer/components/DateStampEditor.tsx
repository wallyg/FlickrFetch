import React, { useEffect, useRef, useState } from 'react'
import { DATE_EXAMPLE_TAKEN, DATE_QUICK_PICKS, DATE_TOKENS, checkDatePattern, formatDateStamp, usesTwelveHour } from '../../shared/dateStamp'
import { fieldBox, selectedOn, smallBtn } from '../ui/kit'

// The date stamp in a file name (Settings > File naming, #266): type a pattern, or click the parts to add them, with a live example.
// Only a pattern that works is passed up and saved; while it does not, the box says why and the last good one stays in use.

const GROUPS = ['Year', 'Month', 'Day', 'Weekday', 'Time'] as const

export default function DateStampEditor({ value, onChange, position }: { value: string; onChange: (pattern: string) => void; position: 'prefix' | 'suffix' }): React.JSX.Element {
  const [text, setText] = useState(value)
  const committed = useRef(value)
  const input = useRef<HTMLInputElement | null>(null)
  useEffect(() => { if (value !== committed.current) { committed.current = value; setText(value) } }, [value])

  const check = checkDatePattern(text)
  const set = (next: string): void => {
    setText(next)
    if (checkDatePattern(next).ok) { committed.current = next; onChange(next) }
  }
  const insert = (token: string): void => {
    const el = input.current
    const at = el?.selectionStart ?? text.length, end = el?.selectionEnd ?? text.length
    const next = text.slice(0, at) + token + text.slice(end)
    set(next)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length) })
  }

  return (
    <div style={styles.box}>
      <div style={styles.line}>
        <label style={styles.label} htmlFor="date-pattern">Pattern</label>
        <input id="date-pattern" ref={input} style={{ ...fieldBox, ...styles.input, ...(check.ok ? {} : { borderColor: 'var(--ff-error-ink)' }) }} value={text} spellCheck={false}
          onChange={e => set(e.target.value)} aria-invalid={!check.ok} aria-describedby="date-pattern-note" />
        <span style={styles.example} aria-live="polite">{check.ok ? formatDateStamp(text, DATE_EXAMPLE_TAKEN) : ''}</span>
      </div>
      <div id="date-pattern-note" style={check.ok ? styles.hint : styles.problem} role={check.ok ? undefined : 'alert'}>
        {check.ok
          ? (position === 'prefix' && usesTwelveHour(text) ? 'A 12-hour time does not sort in time order in a file list (02 PM comes before 10 AM), so avoid it at the start of a name.' : `Shown for ${DATE_EXAMPLE_TAKEN.replace(' ', ' at ')}.`)
          : check.problem}
      </div>

      <div style={styles.groups}>
        {GROUPS.map(g => (
          <div key={g} style={styles.group}>
            <span style={styles.groupName}>{g}</span>
            {DATE_TOKENS.filter(t => t.group === g).map(t => (
              <button key={t.token} type="button" style={styles.token} title={`Adds ${t.token}, for example ${t.example}`} onClick={() => insert(t.token)}>
                <b>{t.token}</b> <span style={styles.tokenExample}>{t.example}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div style={styles.group}>
        <span style={styles.groupName}>Quick picks</span>
        {DATE_QUICK_PICKS.map(p => (
          <button key={p} type="button" style={{ ...styles.token, ...(text === p ? selectedOn : {}) }} aria-pressed={text === p} onClick={() => set(p)}>{p}</button>
        ))}
      </div>

      <div style={styles.hint}>Letters are parts of the date. To write a word, put it in quotes, like 'at'. Separate parts with - . _ or a space. A file name cannot contain / or :. mm is minutes and MM is the month.</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  box: { display: 'flex', flexDirection: 'column', gap: 8 },
  line: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  label: { fontSize: 12, color: 'var(--ff-text-secondary)', width: 52 },
  input: { flex: 1, minWidth: 180, fontFamily: 'monospace' },
  example: { fontSize: 12, fontFamily: 'monospace', color: 'var(--ff-text)' },
  hint: { fontSize: 12, color: 'var(--ff-text-secondary)', lineHeight: 1.5 },
  problem: { fontSize: 12, color: 'var(--ff-error-ink)', lineHeight: 1.5 },
  groups: { display: 'flex', flexDirection: 'column', gap: 6 },
  group: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  groupName: { fontSize: 12, color: 'var(--ff-text-secondary)', width: 64, flexShrink: 0 },
  token: { ...smallBtn, fontFamily: 'inherit' },
  tokenExample: { color: 'var(--ff-text-secondary)', fontWeight: 400 }
}
