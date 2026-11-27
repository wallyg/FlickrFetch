import React, { useState } from 'react'
import type { DateExtra, DatePrivacy } from '../../shared/types'
import AlbumBox, { type PickedAlbum } from './AlbumBox'
import { Chip, PRIVACY_LABELS, PRIVACY_OPTIONS, sharedStyles, type PrivacyFilter } from './PhotoGridShared'
import { linkBtn } from '../ui/kit'

// The filters of On This Day and the Timeline, built like the Map's and the Photostream's: All / Photos / Videos in the row, a Filters button
// that opens a drawer (the six privacy choices, with a count on each, and the album box), and what is picked shown as chips in their own row
// with Clear all. The privacy words and order are the same on every tab.

export type MediaChoice = 'all' | 'photo' | 'video'

const LEVEL: Record<PrivacyFilter, DatePrivacy | undefined> = { all: undefined, public: 0, friends: 1, family: 2, friendsFamily: 3, private: 4 }
const FILTER_OF: Record<number, PrivacyFilter> = { 0: 'public', 1: 'friends', 2: 'family', 3: 'friendsFamily', 4: 'private' }

/** What the date queries are asked, or nothing when no choice is made. */
export function dateExtra(media: MediaChoice, albums: PickedAlbum[], privacy: PrivacyFilter): DateExtra | undefined {
  const x: DateExtra = {}
  if (media !== 'all') x.media = media
  if (albums.length > 0) x.albumIds = albums.map(a => a.id)
  if (LEVEL[privacy] !== undefined) x.privacy = LEVEL[privacy]
  return Object.keys(x).length > 0 ? x : undefined
}

/** The words added to a count or a download note: " (videos only)", " (friends only)", " (in Trip 2019 or Paris)". */
export function extraNote(media: MediaChoice, albums: PickedAlbum[], privacy: PrivacyFilter): string {
  const p = privacy === 'all' ? '' : privacy === 'friendsFamily' ? ' (friends & family only)' : ` (${PRIVACY_LABELS[privacy].toLowerCase()} only)`
  const m = media === 'photo' ? ' (photos only)' : media === 'video' ? ' (videos only)' : ''
  const a = albums.length > 0 ? ` (in ${albums.map(x => x.title || '(no title)').join(' or ')})` : ''
  return p + m + a
}

/** What "Open in Photostream" can carry over from a date choice: the Photostream has a Photos / Videos filter and one privacy level, but no album filter. */
export interface RangeOpts { privacy?: PrivacyFilter; media?: 'photo' | 'video'; tag?: string }
export function rangeOpts(extra: DateExtra | undefined, tag?: string): RangeOpts {
  return {
    ...(extra?.privacy !== undefined ? { privacy: FILTER_OF[extra.privacy] } : {}),
    ...(extra?.media ? { media: extra.media } : {}),
    ...(tag ? { tag } : {})
  }
}
/** The tooltip of "Open in Photostream": says so when something chosen here cannot be carried over (an album). */
export function openTitle(extra: DateExtra | undefined, what: string, base = 'See these in the Photostream, with the usual detail view and filters'): string {
  return extra?.albumIds?.length ? `The Photostream cannot filter by album, so this opens every photo from ${what} (the Photos / Videos and privacy choices carry over)` : base
}

export default function DateFilterBar({ media, onMedia, privacy, onPrivacy, albums, onAlbums, levels, hasCatalog, onClearAll, onOpenHealth }: {
  media: MediaChoice; onMedia: (m: MediaChoice) => void
  privacy: PrivacyFilter; onPrivacy: (p: PrivacyFilter) => void
  albums: PickedAlbum[]; onAlbums: (a: PickedAlbum[]) => void
  levels: number[]                 // photos at each privacy level, for the counts in the drawer
  hasCatalog: boolean              // false until a Rebuild has saved each photo's privacy
  onClearAll: () => void
  onOpenHealth: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const badge = (privacy !== 'all' ? 1 : 0) + albums.length
  const count = (v: PrivacyFilter): string => {
    if (!hasCatalog) return ''
    const n = v === 'all' ? levels.reduce((a, b) => a + b, 0) : levels[LEVEL[v] as number] ?? 0
    return ` (${n.toLocaleString()})`
  }
  const anything = media !== 'all' || privacy !== 'all' || albums.length > 0
  const toggleAlbum = (a: PickedAlbum): void => onAlbums(albums.some(x => x.id === a.id) ? albums.filter(x => x.id !== a.id) : [...albums, a])
  return (
    <>
      <div style={sharedStyles.segGroup} role="group" aria-label="Photos or videos">
        {(['all', 'photo', 'video'] as MediaChoice[]).map(v => (
          <button key={v} style={{ ...sharedStyles.seg, ...(media === v ? sharedStyles.segActive : {}) }} onClick={() => onMedia(v)} aria-pressed={media === v}>
            {v === 'all' ? 'All' : v === 'photo' ? 'Photos' : 'Videos'}
          </button>
        ))}
      </div>
      <button style={{ ...sharedStyles.moreFiltersBtn, ...(open ? sharedStyles.moreFiltersBtnActive : {}) }} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ flexShrink: 0 }}><path d="M1 2h10L7 6v4l-2-1V6L1 2z" /></svg>
        Filters
        {badge > 0 && !open && <span style={sharedStyles.drawerBadge}>{badge}</span>}
      </button>

      {open && (
        <div style={{ flexBasis: '100%' }}>
          <div style={sharedStyles.drawer}>
            <div style={{ ...sharedStyles.drawerRow, padding: '6px 12px' }}>
              <span style={sharedStyles.drawerLabel}>Privacy</span>
              <div style={{ ...sharedStyles.segGroup, opacity: hasCatalog ? 1 : 0.55 }}>
                {PRIVACY_OPTIONS.map(v => (
                  <button key={v} disabled={!hasCatalog && v !== 'all'} style={{ ...sharedStyles.seg, ...(privacy === v ? sharedStyles.segActive : {}) }} onClick={() => onPrivacy(v)} aria-pressed={privacy === v}>
                    {PRIVACY_LABELS[v]}{count(v)}
                  </button>
                ))}
              </div>
              {!hasCatalog && <span style={{ fontSize: 12, color: 'var(--ff-text-secondary)' }}>Needs one Rebuild of your library list. <button style={linkBtn} onClick={onOpenHealth}>Open Health Check</button></span>}
            </div>
            <div style={{ ...sharedStyles.drawerRow, padding: '6px 12px' }}>
              <span style={sharedStyles.drawerLabel}>Album</span>
              <AlbumBox chosen={albums} onToggle={toggleAlbum} />
              <span style={{ fontSize: 12, color: 'var(--ff-text-secondary)' }}>Pick one or more; photos in any of them show.</span>
            </div>
          </div>
        </div>
      )}

      {anything && (
        <div style={{ flexBasis: '100%' }}>
          <div style={{ ...sharedStyles.chipRow, padding: '2px 0' }}>
            {media !== 'all' && <Chip label={media === 'photo' ? 'Photos only' : 'Videos only'} onDismiss={() => onMedia('all')} />}
            {privacy !== 'all' && <Chip label={`Privacy: ${PRIVACY_LABELS[privacy]}`} onDismiss={() => onPrivacy('all')} />}
            {albums.map(a => <Chip key={a.id} label={`Album: ${a.title || '(no title)'}`} onDismiss={() => toggleAlbum(a)} />)}
            <button style={sharedStyles.clearFiltersLink} onClick={onClearAll}>Clear all</button>
          </div>
        </div>
      )}
    </>
  )
}
