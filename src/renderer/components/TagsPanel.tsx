import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import type { TagRow, TagLetterGroup, TagListQuery, TagTextOperator, TagMode } from '../../shared/types'
import EmptyState from './EmptyState'
import { ScanLine, ScanProgressCard } from './TagScanParts'
import { useTagScan } from '../hooks/useTagScan'
import { quietBtn, selectedOn, segGroup, segBtn, primaryBtn as mainBtn, fieldBox, selectBox, linkBtn } from '../ui/kit'
import BackToTop from '../ui/BackToTop'

// The Tags tab: browse every tag you have used, narrow by letter or by typing, pick some,
// and jump to the photos that have them. Everything here reads the local tag index, so it is
// instant; Flickr is only asked when you build or refresh the index.

interface TagsPanelProps {
  active: boolean   // true while the Tags tab is the one on screen
  onViewPhotos: (tags: string[], mode: TagMode) => void
  onOpenCleanup: () => void   // the audit and the photo health report live in the Cleanup tab
}

const ROW_HEIGHT = 38
const PAGE_SIZE = 200
const OVERSCAN = 8
const BIG_LIST = 250   // a letter with more tags than this offers the next letter level

const OPERATOR_LABELS: Record<TagTextOperator, string> = {
  contains: 'Contains',
  startsWith: 'Starts with',
  endsWith: 'Ends with',
  exact: 'Exact match'
}

// What the letter strip selection means as a list query.
// levels: [] = all; ['#'] = digits; ['other']; ['s'], ['s','t'], ['s','t','other'], ['s',''] ...
function levelsToQuery(levels: string[]): Partial<TagListQuery> {
  if (levels.length === 0) return {}
  // # opens a row of digits: ['#'] = all digit tags; ['#','5'] = tags starting with 5; ['#','5','0'] = starting 50...
  if (levels[0] === '#') return levels.length === 1 ? { digits: true } : levelsToQuery(levels.slice(1))
  // Other opens a row of writing systems; Accented Latin opens one more row by plain letter (é under e)
  if (levels[0] === 'other') {
    if (levels.length === 1) return { other: true }
    return { other: true, script: levels[1], ...(levels[1] === 'latin' && levels[2] ? { base: levels[2] } : {}) }
  }
  const last = levels[levels.length - 1]
  if (last === 'other') return { prefix: levels.slice(0, -1).join(''), afterPrefix: 'other' }
  if (last === '') return { text: levels.slice(0, -1).join(''), operator: 'exact' }
  return { prefix: levels.join('') }
}

// Hover text for the "N spellings" badge. Flickr doesn't say how often each spelling is used, so this is a plain list.
function spellingTip(row: TagRow): string {
  const shown = row.spellings.slice(0, 12)
  const more = row.spellings.length - shown.length
  return `Typed ${row.variants} ways:\n${shown.map(s => `• ${s}`).join('\n')}${more > 0 ? `\n…and ${more} more` : ''}`
}

export default function TagsPanel({ active, onViewPhotos, onOpenCleanup }: TagsPanelProps): React.JSX.Element {
  const { status, progress, scanError, scanning, startScan, startFullRescan } = useTagScan()

  // Browse controls
  const [levels, setLevels] = useState<string[]>([])
  const [text, setText] = useState('')
  const [operator, setOperator] = useState<TagTextOperator>('contains')
  const [sort, setSort] = useState<TagListQuery['sort']>('alpha')
  const [includeMachine, setIncludeMachine] = useState(false)
  const [strips, setStrips] = useState<{ prefix: string; groups: TagLetterGroup[] }[]>([])

  // List (virtualized: only the visible rows are drawn; pages are fetched as you scroll)
  const [total, setTotal] = useState(0)
  const [, setVersion] = useState(0)
  const pagesRef = useRef<Map<number, TagRow[]>>(new Map())
  const requestedRef = useRef<Set<number>>(new Set())
  const queryKeyRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const findRef = useRef<HTMLInputElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(480)

  // Selection (kept when the filter changes, so tags can be gathered from several letters)
  const [selected, setSelected] = useState<Map<string, string>>(new Map())   // clean name → display
  const [selectMode, setSelectMode] = useState<TagMode>('any')
  const [matchCount, setMatchCount] = useState<number | null>(null)

  // Cmd+F (Ctrl+F on Windows) jumps to the find box. The list only draws the rows on screen,
  // so the browser's own find couldn't see most tags anyway; this searches all of them.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f' && findRef.current) {
        e.preventDefault()
        findRef.current.focus()
        findRef.current.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, status?.hasIndex])

  // ── Letter strips ──────────────────────────────────────────────────────────
  const ready = !!status?.hasIndex
  const resultsVersion = status?.lastScanAt ?? 0   // changes after a scan, so lists reload

  const query: TagListQuery = useMemo(() => {
    const base: TagListQuery = { sort, includeMachine }
    const t = text.trim()
    // Typed text narrows within the chosen letter. ("Just this tag" is already an exact match, so typed text wins there.)
    return { ...base, ...levelsToQuery(levels), ...(t ? { text: t, operator } : {}) }
  }, [levels, text, operator, sort, includeMachine])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      // One strip per chosen level (so you can step back up), plus one more for the next level
      // down when the chosen letter still holds a long list.
      const out: { prefix: string; groups: TagLetterGroup[] }[] = []
      let prefix = ''
      for (let depth = 0; ; depth++) {
        const groups = await window.flickrAPI.getTagGroups(prefix, includeMachine)
        out.push({ prefix, groups })
        const key = levels[depth]
        if (key === undefined) break
        const isLast = depth + 1 === levels.length
        const count = groups.find(g => g.key === key)?.count ?? 0
        if (depth === 0 && key === '#') { prefix = '#'; continue }               // a row of digits
        if (depth === 0 && key === 'other') { prefix = 'other'; continue }       // a row of writing systems
        if (levels[0] === 'other') {
          if (depth === 1 && key === 'latin' && (!isLast || count > BIG_LIST)) { prefix = 'other:latin'; continue }   // accented letters by plain letter
          break
        }
        if (!/^[a-z0-9]$/.test(key)) break
        if (isLast && count <= BIG_LIST) break
        prefix = levels[0] === '#' && depth === 1 ? key : prefix + key     // after the digit row, prefixes are the digits themselves
      }
      if (!cancelled) setStrips(out)
    })()
    return () => { cancelled = true }
  }, [ready, levels, includeMachine, resultsVersion])

  // ── List loading ───────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (pageIndex: number, key: number, q: TagListQuery): Promise<void> => {
    if (requestedRef.current.has(pageIndex)) return
    requestedRef.current.add(pageIndex)
    try {
      const res = await window.flickrAPI.listTags({ ...q, offset: pageIndex * PAGE_SIZE, limit: PAGE_SIZE })
      if (key !== queryKeyRef.current) return
      pagesRef.current.set(pageIndex, res.rows)
      if (pageIndex === 0) setTotal(res.total)
      setVersion(v => v + 1)
    } catch {
      requestedRef.current.delete(pageIndex)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    // New query: forget cached pages, go back to the top, fetch the first page
    queryKeyRef.current++
    pagesRef.current = new Map()
    requestedRef.current = new Set()
    setTotal(0)
    setVersion(v => v + 1)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrollTop(0)
    void fetchPage(0, queryKeyRef.current, query)
  }, [ready, query, resultsVersion, fetchPage])

  // Fetch whichever pages the visible rows fall on
  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const lastRow = Math.min(Math.max(total - 1, 0), Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + OVERSCAN)
  useEffect(() => {
    if (!ready || total === 0) return
    for (let p = Math.floor(firstRow / PAGE_SIZE); p <= Math.floor(lastRow / PAGE_SIZE); p++) {
      void fetchPage(p, queryKeyRef.current, query)
    }
  }, [ready, total, firstRow, lastRow, query, fetchPage])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = (): void => setViewHeight(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ready])

  // ── Selection ──────────────────────────────────────────────────────────────
  const toggle = (row: TagRow): void => {
    setSelected(prev => {
      const next = new Map(prev)
      if (next.has(row.name)) next.delete(row.name)
      else next.set(row.name, row.display)
      return next
    })
  }

  useEffect(() => {
    if (selected.size === 0) { setMatchCount(null); return }
    let cancelled = false
    const t = setTimeout(() => {
      window.flickrAPI.countTagPhotos([...selected.keys()], selectMode)
        .then(n => { if (!cancelled) setMatchCount(n) })
        .catch(() => { if (!cancelled) setMatchCount(null) })
    }, 150)
    return () => { cancelled = true; clearTimeout(t) }
  }, [selected, selectMode, resultsVersion])

  const pickLevel = (depth: number, key: string): void => {
    const current = levels[depth]
    // Clicking the chosen chip again steps back up one level
    if (current === key) setLevels(levels.slice(0, depth))
    else setLevels([...levels.slice(0, depth), key])
  }

  const onTextChange = (value: string): void => setText(value)

  // ── Rendering ──────────────────────────────────────────────────────────────
  if (!status) return <div style={styles.center}><span style={styles.muted}>Loading…</span></div>

  if (scanning) return <ScanProgressCard progress={progress} />

  if (!ready) {
    return (
      <div style={styles.center}>
        <EmptyState
          title="Build your tag list"
          body={"Flickr can't list tags by letter or count them, so FlickrFetch reads your photos once and keeps the tags on this computer. It takes a few minutes for a big library, and afterwards browsing is instant.\n\nLater, Update reads only the photos changed since your last update, usually a few seconds. Rebuild reads every photo again, which is worth doing after you delete photos."}
        >
          <button style={styles.primaryBtn} onClick={() => void startScan('full')}>Scan my photos</button>
          {progress?.phase === 'cancelled' && <div style={styles.muted}>Scan cancelled. Nothing was saved.</div>}
          {scanError && <div style={styles.error}>{scanError}</div>}
        </EmptyState>
      </div>
    )
  }

  const rows: React.ReactNode[] = []
  for (let i = firstRow; i <= lastRow && total > 0; i++) {
    const row = pagesRef.current.get(Math.floor(i / PAGE_SIZE))?.[i % PAGE_SIZE]
    const top = i * ROW_HEIGHT
    if (!row) {
      rows.push(<div key={`s${i}`} style={{ ...styles.row, top, opacity: 0.4 }}><span style={styles.muted}>…</span></div>)
      continue
    }
    const isSel = selected.has(row.name)
    rows.push(
      <div key={row.name} style={{ ...styles.row, top, ...(isSel ? styles.rowSelected : {}) }} onClick={() => toggle(row)}>
        <input type="checkbox" checked={isSel} readOnly style={styles.check} />
        <span style={styles.tagName} title={row.display === row.name ? row.name : `${row.display}  (Flickr form: ${row.name})`}>{row.display}</span>
        {row.variants > 1 && (
          <span style={styles.variantChip} title={spellingTip(row)}>{row.variants} spellings</span>
        )}
        <span style={{ flex: 1 }} />
        <span style={styles.count}>{row.count.toLocaleString()} photo{row.count === 1 ? '' : 's'}</span>
      </div>
    )
  }

  const stripLabel = (g: TagLetterGroup, depth: number): string => {
    if (g.key === '') return `${g.label} (just this)`
    if (depth === 0) return g.key === '#' ? '#' : g.key === 'other' ? 'Other' : g.key.toUpperCase()
    return g.key === 'other' ? 'Other' : g.label
  }

  return (
    <div style={styles.wrap}>
      <ScanLine status={status} scanError={scanError} onRefresh={() => void startScan('refresh')} onFullRescan={() => void startFullRescan()} />
      <div style={styles.hint}>
        Looking for typos, stuck-together names or photos with no description? <button style={styles.linkBtn} onClick={onOpenCleanup}>Open Health Check ›</button>
      </div>

      <div style={styles.controls}>
        <div style={styles.searchGroup}>
          <select style={styles.select} value={operator} onChange={e => setOperator(e.target.value as TagTextOperator)}>
            {(Object.keys(OPERATOR_LABELS) as TagTextOperator[]).map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
          </select>
          <input
            ref={findRef}
            style={styles.input}
            type="text"
            placeholder="Find tags… (matches “new york” and “newyork”)"
            value={text}
            onChange={e => onTextChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setText(''); e.currentTarget.blur() } }}
          />
          {text && <button style={styles.clearX} onClick={() => setText('')}><Icon name="close" /></button>}
        </div>
        <div style={styles.optionGroup}>
          <select style={styles.select} value={sort} onChange={e => setSort(e.target.value as NonNullable<TagListQuery['sort']>)}>
            <option value="alpha">A <Icon name="arrowRight" /> Z</option>
            <option value="alphaDesc">Z <Icon name="arrowRight" /> A</option>
            <option value="count">Most photos first</option>
          </select>
          <label style={styles.checkLabel} title={"Machine tags look like namespace:key=value.\nThey are added by apps."}>
            <input type="checkbox" checked={includeMachine} onChange={e => setIncludeMachine(e.target.checked)} /> Machine tags
          </label>
        </div>
      </div>

      {(
        <div style={styles.strips}>
          {strips.map((strip, depth) => (
            <div key={strip.prefix || 'root'} style={styles.stripRow}>
              {depth === 0 && (
                <button style={{ ...styles.chip, ...(levels.length === 0 ? styles.chipActive : {}) }} onClick={() => setLevels([])}>All</button>
              )}
              {strip.groups.map(g => {
                const active = levels[depth] === g.key
                return (
                  <button
                    key={g.key || '_bare'}
                    style={{ ...styles.chip, ...(active ? styles.chipActive : {}) }}
                    onClick={() => pickLevel(depth, g.key)}
                    title={`${g.count.toLocaleString()} tag${g.count === 1 ? '' : 's'}`}
                  >
                    {stripLabel(g, depth)}
                    <span style={styles.chipCount}>{g.count.toLocaleString()}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <div style={styles.listInfo}>
        {total.toLocaleString()} tag{total === 1 ? '' : 's'}
        {text.trim() ? ` ${OPERATOR_LABELS[operator].toLowerCase()} “${text.trim()}”${levels.length ? ' within the chosen letter' : ''}` : levels.length ? '' : ' in total'}
        {levels.length > 0 && strips.length === levels.length + 1
          ? <span style={styles.muted}> · pick the next letter above to narrow further</span> : null}
      </div>

      <div ref={scrollRef} style={styles.list} onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
        {total === 0 ? (
          <div style={styles.emptyList}>No tags match. Try fewer letters, or clear the search.</div>
        ) : (
          <div style={{ position: 'relative', height: total * ROW_HEIGHT }}>{rows}</div>
        )}
        <BackToTop />
      </div>

      {selected.size > 0 && (
        <div style={styles.tray}>
          <div style={styles.trayChips}>
            {[...selected.entries()].map(([name, display]) => (
              <span key={name} style={styles.selChip}>
                {display}
                <button style={styles.selChipX} onClick={() => setSelected(prev => { const n = new Map(prev); n.delete(name); return n })}><Icon name="close" /></button>
              </span>
            ))}
          </div>
          <div style={styles.trayActions}>
            {selected.size > 1 && (
              <div style={styles.segGroup} title={"Any: photos with at least one of these tags.\nAll: photos with every one of them."}>
                {(['any', 'all'] as TagMode[]).map(m => (
                  <button key={m} style={{ ...styles.seg, ...(selectMode === m ? styles.segActive : {}) }} onClick={() => setSelectMode(m)}>{m}</button>
                ))}
              </div>
            )}
            <span style={styles.muted}>{matchCount === null ? '' : `${matchCount.toLocaleString()} photo${matchCount === 1 ? '' : 's'}`}</span>
            <button style={styles.linkBtn} onClick={() => setSelected(new Map())}>Clear</button>
            <button style={styles.primaryBtn} onClick={() => onViewPhotos([...selected.values()], selectMode)}>View photos</button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--ff-cream)', overflow: 'hidden' },
  center: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--ff-cream)' },
  header: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px 6px', fontSize: '13px', color: 'var(--ff-text)' },
  headline: { fontSize: '14px' },
  muted: { color: 'var(--ff-text-secondary)', fontSize: '13px' },
  error: { color: 'var(--ff-error)', fontSize: '13px', maxWidth: '420px' },
  notice: { margin: '0 24px 6px', padding: '8px 12px', background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: '8px', fontSize: '13px', color: 'var(--ff-text-secondary)' },
  hint: { margin: '0 24px 4px', padding: '6px 12px', background: 'var(--ff-info-bg)', border: '1px solid var(--ff-info-line)', borderRadius: '8px', fontSize: '13px', color: 'var(--ff-text-secondary)' },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '6px 24px' },
  searchGroup: { display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 340px', maxWidth: '620px', position: 'relative' },
  optionGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  select: { ...selectBox },
  input: { ...fieldBox, flex: 1, padding: '6px 24px 6px 8px' },
  clearX: { position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ff-text-muted)', fontSize: '12px' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--ff-text-secondary)', cursor: 'pointer' },
  strips: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '4px 24px 2px' },
  stripRow: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  chip: { display: 'inline-flex', alignItems: 'baseline', gap: '4px', border: '1px solid var(--ff-border)', borderRadius: '12px', padding: '2px 8px', fontSize: '13px', fontWeight: 700, background: 'var(--ff-surface)', color: 'var(--ff-text)', cursor: 'pointer' },
  chipActive: { ...selectedOn },
  chipCount: { fontSize: '11px', fontWeight: 400, opacity: 0.65 },
  listInfo: { padding: '8px 24px 4px', fontSize: '13px', color: 'var(--ff-text-secondary)' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 24px 12px', background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: '8px' },
  emptyList: { padding: '40px', textAlign: 'center', color: 'var(--ff-text-secondary)', fontSize: '13px' },
  row: { position: 'absolute', left: 0, right: 0, height: ROW_HEIGHT, display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', borderBottom: '1px solid var(--ff-warm)', cursor: 'pointer', boxSizing: 'border-box' },
  rowSelected: { background: 'var(--ff-tint)' },
  check: { margin: 0, pointerEvents: 'none' },
  tagName: { fontSize: '14px', fontWeight: 700, color: 'var(--ff-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' },
  variantChip: { fontSize: '11px', padding: '0px 6px', borderRadius: '8px', background: 'var(--ff-warning-bg)', color: 'var(--ff-warning-text)', whiteSpace: 'nowrap' },
  count: { fontSize: '13px', color: 'var(--ff-text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  tray: { display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 24px', background: 'var(--ff-surface)', borderTop: '1px solid var(--ff-border)' },
  trayChips: { display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1, maxHeight: '64px', overflowY: 'auto' },
  trayActions: { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 },
  selChip: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--ff-tint)', border: '1px solid var(--ff-pink)', borderRadius: '12px', padding: '2px 4px 2px 8px', fontSize: '13px', color: 'var(--ff-pink-action)' },
  selChipX: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ff-pink-action)', fontSize: '11px' },
  segGroup: { ...segGroup },
  seg: { ...segBtn },
  segActive: { ...selectedOn },
  primaryBtn: { ...mainBtn },
  secondaryBtn: { ...quietBtn, padding: '4px 12px' },
  linkBtn: { ...linkBtn, fontSize: '13px' },
  progressCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '360px', padding: '24px', background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: '12px' },
  cardTitle: { fontSize: '14px', fontWeight: 700, color: 'var(--ff-navy)' },
  barTrack: { width: '100%', height: '8px', background: 'var(--ff-border)', borderRadius: '4px', overflow: 'hidden' },
  barFill: { height: '100%', background: 'var(--ff-pink)', transition: 'width 0.3s' }
}
