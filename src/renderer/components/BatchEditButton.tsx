import React, { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import { quietBtn, linkBtn } from '../ui/kit'
import HoverNote from '../ui/HoverNote'

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
const HINT_SHOW_MS = 14000   // longer when it carries the "close the earlier editor" hint
const FADE_MS = 600

// Flickr's editor can refuse a second list while an earlier editor tab is still open (seen in testing). FlickrFetch only hands the
// photo ids to the browser, so from the second press in a session the note says what to try.
let openedBefore = false

export default function BatchEditButton({ getIds, label = "Fix in Flickr's batch editor", style, inline }: Props): React.JSX.Element {
  const [ids, setIds] = useState<string[] | null>(null)
  const [part, setPart] = useState(0)          // the part opened last
  const [parts, setParts] = useState(0)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<'hidden' | 'shown' | 'fading'>('hidden')
  const [hint, setHint] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clearTimers = (): void => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => clearTimers, [])

  const open = async (p: number, known?: string[]): Promise<void> => {
    setBusy(true)
    try {
      const all = known ?? await getIds()
      setIds(all)
      const repeat = openedBefore
      const r = await window.flickrAPI.openBatchEditor(all, p)
      if (r.count > 0) openedBefore = true
      setPart(p); setParts(r.parts); setHint(repeat && r.count > 0); setNote('shown')
      clearTimers()
      if (p + 1 >= r.parts) {
        const stay = repeat ? HINT_SHOW_MS : SHOW_MS
        timers.current = [setTimeout(() => setNote('fading'), stay), setTimeout(() => setNote('hidden'), stay + FADE_MS)]
      }
    } finally { setBusy(false) }
  }

  const n = ids?.length ?? 0
  return (
    <div style={{ display: 'flex', flexDirection: inline ? 'row' : 'column', flexWrap: 'wrap', gap: inline ? 10 : 6, alignItems: inline ? 'center' : 'flex-start' }}>
      <HoverNote mark={false} block={style?.width === '100%'} text={"Opens Flickr's batch editor with these photos loaded, so you can change them there. FlickrFetch does not edit anything.\nIt takes 500 photos at a time."}>
        <button style={style ?? quietBtn} disabled={busy} onClick={() => void open(0)}>
          {busy ? 'Opening…' : label} <span aria-hidden><Icon name="external" /></span>
        </button>
      </HoverNote>
      {ids && note !== 'hidden' && (
        <div role="status" style={{ ...noteStyle, opacity: note === 'fading' ? 0 : 1 }}>
          {n === 0 ? 'Nothing to open here.' : parts > 1
            ? <>Opened part {part + 1} of {parts} ({Math.min(500, n - part * 500).toLocaleString()} of {n.toLocaleString()} photos). </>
            : <>Opened {n.toLocaleString()} photo{n === 1 ? '' : 's'} in Flickr’s batch editor. </>}
          {n > 0 && hint && <>If it did not load, close the earlier editor tab, wait a few seconds and press again. </>}
          {n > 0 && part + 1 < parts && <button style={linkBtn} onClick={() => void open(part + 1, ids)}>Open part {part + 2}</button>}
        </div>
      )}
    </div>
  )
}

const noteStyle: React.CSSProperties = { fontSize: 12, color: 'var(--ff-text-secondary)', lineHeight: 1.5, maxWidth: 360, padding: '2px 14px 2px 4px', transition: `opacity ${FADE_MS}ms ease` }
