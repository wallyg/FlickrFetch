import React, { useEffect, useRef, useState } from 'react'
import { quietBtn, linkBtn } from '../ui/kit'

// "Fix in Flickr's batch editor": opens Flickr's own editor with these photos already in its tray. FlickrFetch changes nothing
// on Flickr. A long list goes in parts of 500 (the most the editor takes at once), one part per click. The note under the
// button confirms what was opened and fades away by itself; while parts are still waiting it stays, because "Open part N" is a button.

interface Props {
  getIds: () => Promise<string[]>        // asked for at click time, so a long list is only gathered when it is wanted
  label?: string
  style?: React.CSSProperties
  inline?: boolean                       // the note sits beside the button instead of under it (for a row of buttons)
}

const SHOW_MS = 6000    // how long the note stays once there is nothing left to click
const FADE_MS = 600

export default function BatchEditButton({ getIds, label = "Fix in Flickr's batch editor", style, inline }: Props): React.JSX.Element {
  const [ids, setIds] = useState<string[] | null>(null)
  const [part, setPart] = useState(0)          // the part opened last
  const [parts, setParts] = useState(0)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<'hidden' | 'shown' | 'fading'>('hidden')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clearTimers = (): void => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => clearTimers, [])

  const open = async (p: number, known?: string[]): Promise<void> => {
    setBusy(true)
    try {
      const all = known ?? await getIds()
      setIds(all)
      const r = await window.flickrAPI.openBatchEditor(all, p)
      setPart(p); setParts(r.parts); setNote('shown')
      clearTimers()
      if (p + 1 >= r.parts) {
        timers.current = [setTimeout(() => setNote('fading'), SHOW_MS), setTimeout(() => setNote('hidden'), SHOW_MS + FADE_MS)]
      }
    } finally { setBusy(false) }
  }

  const n = ids?.length ?? 0
  return (
    <div style={{ display: 'flex', flexDirection: inline ? 'row' : 'column', flexWrap: 'wrap', gap: inline ? 10 : 6, alignItems: inline ? 'center' : 'flex-start' }}>
      <button style={style ?? quietBtn} disabled={busy} onClick={() => void open(0)}
        title={"Opens Flickr's batch editor with these photos loaded, so you can change them there. FlickrFetch does not edit anything.\nIt takes 500 photos at a time."}>
        {busy ? 'Opening…' : label} <span aria-hidden>↗</span>
      </button>
      {ids && note !== 'hidden' && (
        <div role="status" style={{ ...noteStyle, opacity: note === 'fading' ? 0 : 1 }}>
          {n === 0 ? 'Nothing to open here.' : parts > 1
            ? <>Opened part {part + 1} of {parts} ({Math.min(500, n - part * 500).toLocaleString()} of {n.toLocaleString()} photos). </>
            : <>Opened {n.toLocaleString()} photo{n === 1 ? '' : 's'} in Flickr’s batch editor.</>}
          {n > 0 && part + 1 < parts && <button style={linkBtn} onClick={() => void open(part + 1, ids)}>Open part {part + 2}</button>}
        </div>
      )}
    </div>
  )
}

const noteStyle: React.CSSProperties = { fontSize: 12, color: 'var(--ff-text-secondary)', lineHeight: 1.5, maxWidth: 360, padding: '2px 14px 2px 4px', transition: `opacity ${FADE_MS}ms ease` }
