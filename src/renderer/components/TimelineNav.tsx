import React from 'react'
import { quietBtn } from '../ui/kit'

// The top of a Timeline screen: a back button that says where it goes, and arrows that step to the previous or
// next month or day with the title between them.

export interface Step { label: string; onClick: () => void }

interface Props {
  backLabel: string
  onBack: () => void
  title: string
  prev: Step | null     // null = nothing earlier, the arrow stays but is greyed
  next: Step | null
}

export default function TimelineNav({ backLabel, onBack, title, prev, next }: Props): React.JSX.Element {
  return (
    <>
      <button style={styles.btn} onClick={onBack} title="Esc does the same">‹ {backLabel}</button>
      <button style={{ ...styles.btn, ...(prev ? {} : styles.off) }} disabled={!prev} onClick={prev?.onClick} title={prev ? `Go to ${prev.label}` : 'Nothing earlier'}>‹ {prev?.label ?? ''}</button>
      <b style={{ color: 'var(--ff-navy)', fontSize: 16 }}>{title}</b>
      <button style={{ ...styles.btn, ...(next ? {} : styles.off) }} disabled={!next} onClick={next?.onClick} title={next ? `Go to ${next.label}` : 'Nothing later'}>{next?.label ?? ''} ›</button>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  btn: { ...quietBtn, padding: '2px 8px', fontSize: 12, whiteSpace: 'nowrap' },
  off: { opacity: 0.4, cursor: 'default' }
}
