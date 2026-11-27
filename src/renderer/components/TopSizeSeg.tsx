import React from 'react'
import { segGroup, segBtn, selectedOn } from '../ui/kit'
import { sizeChoices } from '../../shared/dashboardInsights'

// Top 5 / Top 10 / Top 25 for a list: only the sizes that exist ("All 15" when that is everything), and nothing at all for five or fewer.
export default function TopSizeSeg({ total, value, onChange, label }: { total: number; value: number; onChange: (n: number) => void; label: string }): React.JSX.Element | null {
  const choices = sizeChoices(total)
  if (choices.length === 0) return null
  const current = Math.min(value, total)
  return (
    <span style={segGroup} role="radiogroup" aria-label={label} data-noprint="">
      {choices.map(c => (
        <button key={c.n} role="radio" aria-checked={current === c.n} style={{ ...segBtn, ...(current === c.n ? selectedOn : {}) }} onClick={() => onChange(c.n)}>{c.label}</button>
      ))}
    </span>
  )
}
