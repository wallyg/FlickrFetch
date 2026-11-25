import React, { useEffect, useState } from 'react'
import { DEFAULT_SCOPE, normalizeScope, type HealthScope, type LocPrivacy, type LocVideos } from '../../shared/healthScope'
import { segGroup, segBtn, selectedOn } from '../ui/kit'

// Which photos the Photos checks look at (Tune checks, #246): one switch for videos, and the No location check's own privacy and video choice.
// Saved at once. The counts and lists follow when Settings is closed.

// Reads what is saved, changes one part, saves the whole choice (the two controls below can be on screen together)
async function change(patch: Partial<HealthScope>): Promise<HealthScope> {
  const now = normalizeScope((await window.flickrAPI.getSettings()).healthScope)
  const next = { ...now, ...patch }
  await window.flickrAPI.setSettings({ healthScope: next })
  return next
}

function useScope(): [HealthScope, (p: Partial<HealthScope>) => void, boolean | null] {
  const [scope, setScope] = useState<HealthScope>(DEFAULT_SCOPE)
  const [saved, setSaved] = useState<boolean | null>(null)   // has a Rebuild saved the video and privacy details? null until known
  useEffect(() => {
    void window.flickrAPI.getSettings().then(s => setScope(normalizeScope(s.healthScope)))
    void window.flickrAPI.getTagIndexStatus().then(st => setSaved(st.hasCatalog && st.hasCatalogV3)).catch(() => setSaved(null))
  }, [])
  return [scope, p => { setScope(s => ({ ...s, ...p })); void change(p).then(setScope) }, saved]
}

const REBUILD = 'Which photos are videos, and their privacy, is saved by one Rebuild of your library list (Health Check > Update > Rebuild). Until then this has no effect.'

/** The master switch, at the top of Tune checks. */
export function VideoSwitch(): React.JSX.Element {
  const [scope, set, saved] = useScope()
  return (
    <div style={styles.box}>
      <label style={styles.line}>
        <input type="checkbox" checked={scope.videos} onChange={e => set({ videos: e.target.checked })} />
        <span style={{ fontWeight: 600 }}>Include videos in the checks</span>
      </label>
      <span style={styles.desc}>
        {scope.videos ? 'Every Photos check looks at photos and videos.' : 'Videos are left out of every Photos check, and out of the totals. No location can still have its own choice below.'}
        {saved === false && <> {REBUILD}</>}
      </span>
    </div>
  )
}

const VIDEO_CHOICES: { key: LocVideos; label: string; hint: string }[] = [
  { key: 'same', label: 'Same as the switch', hint: 'Follows "Include videos in the checks"' },
  { key: 'include', label: 'Include videos', hint: 'Look at videos for a location even when the other checks leave them out' },
  { key: 'leave', label: 'Leave videos out', hint: 'Do not look at videos for a location' }
]
const PRIVACY_CHOICES: { key: LocPrivacy; label: string; hint: string }[] = [
  { key: 'all', label: 'All', hint: 'Public and not public' },
  { key: 'public', label: 'Public only', hint: 'Only photos anyone can see' },
  { key: 'notPublic', label: 'Not public only', hint: 'Only friends, family and private photos' }
]

/** The No location check's own scope, in its unfolded box. */
export function LocationScope(): React.JSX.Element {
  const [scope, set, saved] = useScope()
  return (
    <div style={styles.box}>
      <div style={styles.line}>
        <span style={styles.label}>Videos</span>
        <div style={segGroup} role="radiogroup" aria-label="No location: videos">
          {VIDEO_CHOICES.map(c => (
            <button key={c.key} role="radio" aria-checked={scope.locVideos === c.key} title={c.hint} style={{ ...segBtn, ...(scope.locVideos === c.key ? selectedOn : {}) }} onClick={() => set({ locVideos: c.key })}>{c.label}</button>
          ))}
        </div>
      </div>
      <div style={styles.line}>
        <span style={styles.label}>Privacy</span>
        <div style={segGroup} role="radiogroup" aria-label="No location: privacy">
          {PRIVACY_CHOICES.map(c => (
            <button key={c.key} role="radio" aria-checked={scope.locPrivacy === c.key} title={c.hint} style={{ ...segBtn, ...(scope.locPrivacy === c.key ? selectedOn : {}) }} onClick={() => set({ locPrivacy: c.key })}>{c.label}</button>
          ))}
        </div>
      </div>
      <span style={styles.desc}>These two choices are for No location only. {saved === false && REBUILD}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  box: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 },
  line: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--ff-text)' },
  label: { width: 56, fontSize: 12, color: 'var(--ff-text-secondary)' },
  desc: { fontSize: 12, color: 'var(--ff-text-secondary)' }
}
