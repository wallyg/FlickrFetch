import React, { useEffect, useState } from 'react'
import TuneChecks from './TuneChecks'
import { VideoSwitch } from './HealthScopeSettings'
import { useCleanupRules } from '../hooks/useCleanupRules'
import { segGroup, segBtn, selectedOn } from '../ui/kit'
import InfoTip from '../ui/InfoTip'

// The Health Check tab of Settings: keeping the library list fresh, and which checks are On, Optional or Off.
// Opened from Settings, or straight from the Health Check tab's "Tune checks" button.

type When = 'open' | 'daily' | 'off'
const WHEN_OPTIONS: { key: When; label: string }[] = [
  { key: 'open', label: 'Every time I open it' },
  { key: 'daily', label: 'Once a day' },
  { key: 'off', label: 'Off' }
]
const WHEN_HELP = [
  'Every time I open it: about 30 seconds after you open FlickrFetch it quietly looks for new and edited photos (usually a few seconds), and checks again once a day if you leave the app open.',
  'Once a day: while FlickrFetch is open it updates when the list is more than a day old. If it was closed for a while, it catches up shortly after you open it.',
  'Off: nothing updates by itself. Press Update on the Health Check tab.',
  'Automatic updates never rebuild the whole list and never change anything on Flickr.'
].join('\n\n')
const TUNE_HELP = [
  'Issue: a problem that needs attention. It counts towards your scores.',
  'Warning: listed, but never lowers a score.',
  'Off: hidden everywhere.',
  'Changes apply at once. Nothing here changes Flickr or your files.'
].join('\n\n')

export default function HealthCheckSettings({ reloadKey = 0, onOpenAlbumTab }: { reloadKey?: number; onOpenAlbumTab?: () => void }): React.JSX.Element {
  const rules = useCleanupRules(reloadKey)
  const [when, setWhen] = useState<When>('daily')
  useEffect(() => { void window.flickrAPI.getSettings().then(s => setWhen(s.autoUpdateWhen ?? (s.autoUpdate === false ? 'off' : 'daily'))) }, [reloadKey])
  const change = async (w: When): Promise<void> => {
    setWhen(w)
    await window.flickrAPI.setSettings({ autoUpdateWhen: w })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      <div>
        <div style={styles.head}>Keep the library list up to date</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>Update automatically <InfoTip text={WHEN_HELP} /></div>
        <div style={segGroup} role="radiogroup" aria-label="Update automatically">
          {WHEN_OPTIONS.map(o => (
            <button key={o.key} role="radio" aria-checked={when === o.key} style={{ ...segBtn, ...(when === o.key ? selectedOn : {}) }} onClick={() => void change(o.key)}>{o.label}</button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ ...styles.head, display: 'flex', alignItems: 'center', gap: 7 }}>Tune checks <InfoTip text={TUNE_HELP} /></div>
        <div style={{ ...styles.desc, marginTop: 0, marginBottom: 12 }}>Choose how each check is treated. Changes apply at once.</div>
        <div style={{ marginBottom: 18 }}><VideoSwitch /></div>
        <TuneChecks stateOf={rules.stateOf} setState={(id, st) => void rules.setState(id, st)} onOpenAlbumTab={onOpenAlbumTab} />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  head: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ff-text-secondary)', marginBottom: 12 },
  desc: { display: 'block', fontSize: 12, color: 'var(--ff-text-secondary)', marginTop: 8 }
}
