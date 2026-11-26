import React, { useEffect, useState } from 'react'
import { isFreeAccount, FREE_BANNER_TEXT } from '../../shared/downloadLimits'
import { quietBtn } from '../ui/kit'

// A calm, dismissible notice for free Flickr accounts about the 1024 px size limit (#255). It sits above the page, says it once, and stays away once closed.
// The dismissal is remembered on this computer (a convenience, not something that has to survive anywhere else).
const KEY = (kind: string): string => `ff-free-banner-${kind}`

export default function FreeAccountBanner({ kind, isPro }: { kind: 'mine' | 'discover'; isPro: boolean | undefined }): React.JSX.Element | null {
  const [pretend, setPretend] = useState(false)   // the development-only switch in Settings
  const [closed, setClosed] = useState(() => { try { return localStorage.getItem(KEY(kind)) === '1' } catch { return false } })
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.flickrAPI.getSettings().then(s => setPretend(s.devPretendFree === true)).catch(() => {})
  }, [])
  if (closed || !isFreeAccount(isPro, import.meta.env.DEV && pretend)) return null
  return (
    <div role="note" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--ff-info-bg)', borderBottom: '1px solid var(--ff-info-line)', padding: '8px 24px', fontSize: 13, color: 'var(--ff-text)' }}>
      <span style={{ flex: 1, minWidth: 0 }}>{FREE_BANNER_TEXT[kind]}</span>
      <button style={{ ...quietBtn, flexShrink: 0 }} onClick={() => { setClosed(true); try { localStorage.setItem(KEY(kind), '1') } catch { /* it shows again next time */ } }}>Dismiss</button>
    </div>
  )
}
