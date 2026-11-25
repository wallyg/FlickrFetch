import React from 'react'
import AlbumKindList from './AlbumKindList'
import { linkBtn } from '../ui/kit'

// The Album Checks tab of Settings: how each of your albums is judged by the Health Check album checks (May not fit its album, May be missing
// from an album). It is its own tab because the list has one row per album. It belongs to Health Check, and says so at the top.

export default function AlbumCheckSettings({ onOpenHealth }: { onOpenHealth: () => void }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={styles.head}>Health Check · Albums</div>
        <div style={styles.desc}>
          These choices belong to Health Check. They decide how the album checks (May not fit its album, May be missing from an album) judge each of your albums.
          The numbers and the On, Warning and Off choices for those checks are in <button style={linkBtn} onClick={onOpenHealth}>Health Check settings</button>.
        </div>
      </div>
      <AlbumKindList />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  head: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ff-text-secondary)', marginBottom: 8 },
  desc: { fontSize: 13, color: 'var(--ff-text-secondary)', lineHeight: 1.5 }
}
