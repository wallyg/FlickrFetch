import React, { useState } from 'react'
import DiscoverPeople from '../components/DiscoverPeople'
import DiscoverGroups from '../components/DiscoverGroups'
import DiscoverExplore from '../components/DiscoverExplore'

type DiscoverTab = 'people' | 'groups' | 'explore'

export default function DiscoverPage({ isActive }: { isActive: boolean }): React.JSX.Element {
  const [tab, setTab] = useState<DiscoverTab>('people')
  const [peopleVisited, setPeopleVisited] = useState(false)
  const [groupsVisited, setGroupsVisited] = useState(false)
  const [exploreVisited, setExploreVisited] = useState(false)

  const handleTabClick = (t: DiscoverTab): void => {
    setTab(t)
    if (t === 'people') setPeopleVisited(true)
    if (t === 'groups') setGroupsVisited(true)
    if (t === 'explore') setExploreVisited(true)
  }

  return (
    <div style={s.wrapper}>
      <div style={s.tabBar}>
        <div style={s.tabGroup}>
          {(['people', 'groups', 'explore'] as DiscoverTab[]).map(t => (
            <button
              key={t}
              style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
              onClick={() => handleTabClick(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={s.content}>
        {/* Mount and unmount People lazily — keep alive once visited */}
        {(tab === 'people' || peopleVisited) && (
          <div style={tab === 'people' ? s.paneVisible : s.paneHidden}>
            <DiscoverPeople isActive={isActive} />
          </div>
        )}
        {(tab === 'groups' || groupsVisited) && (
          <div style={tab === 'groups' ? s.paneVisible : s.paneHidden}>
            <DiscoverGroups />
          </div>
        )}
        {(tab === 'explore' || exploreVisited) && (
          <div style={tab === 'explore' ? s.paneVisible : s.paneHidden}>
            <DiscoverExplore />
          </div>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  tabBar: {
    display: 'flex', alignItems: 'center',
    paddingLeft: '24px', paddingRight: '16px',
    borderBottom: '1px solid #e8e4de',
    background: '#fff',
    flexShrink: 0,
  },
  tabGroup: { display: 'flex', gap: '0' },
  tab: {
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    padding: '10px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
    color: '#888', marginBottom: '-1px', outline: 'none',
  },
  tabActive: { borderBottom: '2px solid #FF0084', color: '#FF0084' },
  content: { flex: 1, overflowY: 'auto', position: 'relative' },
  paneVisible: { display: 'block' },
  paneHidden: { display: 'none' },
}
