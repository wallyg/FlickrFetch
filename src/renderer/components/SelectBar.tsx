import React from 'react'
import BatchEditButton from './BatchEditButton'
import { quietBtn } from '../ui/kit'

// Shown above a list of photos once some are ticked: how many, select all that are showing, clear, and the button that sends
// the ticked photos to Flickr's batch editor (FlickrFetch changes nothing itself).

export default function SelectBar({ count, shown, onSelectAll, onClear, ids }: {
  count: number; shown: number; onSelectAll: () => void; onClear: () => void; ids: () => string[]
}): React.JSX.Element | null {
  if (count === 0) return null
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '6px 10px', margin: '0 0 8px', background: 'var(--ff-tint)', border: '1px solid var(--ff-border)', borderRadius: 8, fontSize: 13, color: 'var(--ff-text)' }}>
      <b>{count.toLocaleString()} selected</b>
      <BatchEditButton inline key={count} style={{ ...quietBtn, borderColor: 'var(--ff-blue)', color: 'var(--ff-blue)', fontWeight: 600 }} label="Fix selected in Flickr's batch editor" getIds={async () => ids()} />
      {count < shown && <button style={link} onClick={onSelectAll}>Select all {shown.toLocaleString()} showing</button>}
      <button style={link} onClick={onClear}>Clear</button>
    </div>
  )
}

const link: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--ff-blue)', fontSize: 12, cursor: 'pointer' }
