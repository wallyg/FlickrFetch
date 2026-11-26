import React, { useEffect, useState } from 'react'
import InfoTip from '../ui/InfoTip'
import type { RequestStats } from '../../shared/types'

// Settings > General: how many requests this computer has sent to Flickr. Flickr allows about 3,600 an hour for the whole app (all users
// together) and does not say how much is used, so this is only this computer's share, counted since FlickrFetch opened.
export default function RequestStatsNote(): React.JSX.Element | null {
  const [stats, setStats] = useState<RequestStats | null>(null)
  useEffect(() => {
    let alive = true
    const read = (): void => { window.flickrAPI.getRequestStats().then(s => { if (alive) setStats(s) }).catch(() => {}) }
    read()
    const timer = setInterval(read, 5000)
    return () => { alive = false; clearInterval(timer) }
  }, [])
  if (!stats) return null
  const tip = '# About this count\n- Counts the requests this computer sent to Flickr since FlickrFetch opened\n- Flickr allows about 3,600 an hour for the whole app, shared by everyone who uses it, and does not say how much is used\n- If Flickr asks us to slow down, FlickrFetch waits and tries again by itself'
  return (
    <div style={{ padding: '4px 0 2px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--ff-text)' }}>
        <b>{stats.lastHour.toLocaleString()}</b> request{stats.lastHour === 1 ? '' : 's'} to Flickr from this computer in the last hour
        <span style={{ color: 'var(--ff-text-secondary)' }}> · {stats.sinceOpen.toLocaleString()} since FlickrFetch opened</span>
        <InfoTip text={tip} />
      </p>
      {stats.top.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ff-text-secondary)' }}>
          Asked for most: {stats.top.slice(0, 3).map(t => `${t.method.replace(/^flickr\./, '')} (${t.count.toLocaleString()})`).join(', ')}
        </p>
      )}
      {stats.slowDowns > 0 && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ff-text-secondary)' }}>
          Flickr asked us to slow down {stats.slowDowns.toLocaleString()} time{stats.slowDowns === 1 ? '' : 's'}; each time FlickrFetch waited and tried again.
        </p>
      )}
    </div>
  )
}
