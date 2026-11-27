import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import type { AlbumFitPhoto, MapAccuracy, MapCluster, MapFilter, MapView } from '../../shared/types'
import { anchorAfterResize, limitCentre, minZoomFor, placeAt, usableSize, visibleTiles, wheelIntent, worldCopies, worldPixel, wrapLon } from '../../shared/mapGeo'
import { loadOutline } from '../ui/mapOutline'
import { mapColours } from '../ui/mapColours'
import { quietBtn, primaryBtn, selectBox, headingCard, headingDialog } from '../ui/kit'
import { dash } from './DashboardParts'
import AlbumBox from './AlbumBox'
import ScreenTop from '../ui/ScreenTop'
import PhotoPeek from './PhotoPeek'
import { Chip, DateMode, PRIVACY_LABELS, PRIVACY_OPTIONS, PrivacyFilter, formatDateChip, getPresetDates, sharedStyles } from './PhotoGridShared'
import InfoTip from '../ui/InfoTip'

// The Map tab: your photos with a location as dots and numbered circles on a built-in outline of the countries. Drag to move, scroll or the
// + and - buttons to zoom. Click a dot or circle to see its photos, open one on Flickr, or download them. Everything comes from the local
// library list; nothing here changes Flickr. "Show street map" (off until you turn it on) draws OpenStreetMap's street map images under the dots; the
// app's background process fetches and saves them, and only the part of the map you are looking at is ever asked for.

interface Props {
  active: boolean
  onDownload: (photos: { id: string; title: string }[], title: string, note: string) => void
  onFullRescan: () => void
  refreshKey: number
  settingsKey: number   // goes up when the Settings window closes, so a change made there is read again
  target?: { lat: number; lon: number; nonce: number } | null   // Health Check's "Show on the map": open on this place and mark it
}

const MIN_ZOOM = 1, MAX_ZOOM = 18
const PAGE = 60
// The filters use the same controls, wording and look as the Photostream's (see PhotoGridShared), so the two tabs behave alike.
type MediaChoice = 'all' | 'photo' | 'video'
type AccuracyChoice = 'any' | MapAccuracy
const PRIVACY_LEVEL: Record<PrivacyFilter, 0 | 1 | 2 | 3 | 4 | undefined> = { all: undefined, public: 0, friends: 1, family: 2, friendsFamily: 3, private: 4 }
const ACCURACY_LABEL: Record<AccuracyChoice, string> = { any: 'Any', street: 'Street', town: 'Town or better', vague: 'Vague only' }
const ymdOf = (iso: string): number | undefined => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? Number(iso.replace(/-/g, '')) : undefined)
interface Pick { cluster: MapCluster; zoom: number }

type Tile = ImageBitmap | 'loading' | number   // a number is when the picture failed to load; it is tried again a minute later
const MAX_TILES = 400

const radius = (count: number): number => (count <= 1 ? 5 : 11 + 5 * Math.log10(count))
const shortCount = (n: number): string => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n))

export default function MapPanel({ active, onDownload, onFullRescan, refreshKey, settingsKey, target }: Props): React.JSX.Element {
  const box = useRef<HTMLDivElement | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState({ w: 800, h: 520 })
  const [centre, setCentre] = useState({ lat: 28, lon: 10 })
  const [zoom, setZoom] = useState(1.6)
  const [media, setMedia] = useState<MediaChoice>('all')
  const [privacy, setPrivacy] = useState<PrivacyFilter>('all')
  const [tagText, setTagText] = useState('')
  const [tagsApplied, setTagsApplied] = useState('')   // the tags typed and confirmed with Enter, like the Photostream
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any')
  const [albums, setAlbums] = useState<{ id: string; title: string }[]>([])
  const [dateField, setDateField] = useState<'taken' | 'posted'>('taken')
  const [dateMode, setDateMode] = useState<DateMode>('all')
  const [dateMin, setDateMin] = useState('')
  const [dateMax, setDateMax] = useState('')
  const [accuracy, setAccuracy] = useState<AccuracyChoice>('any')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const albumRef = useRef<HTMLInputElement | null>(null)
  // Cmd+F on the Map: the album box is its only search box and it sits in the Filters drawer, so open the drawer and put the cursor there (#256)
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setDrawerOpen(true)
        window.requestAnimationFrame(() => { albumRef.current?.focus(); albumRef.current?.select() })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
  const [data, setData] = useState<MapView | null>(null)
  const [failed, setFailed] = useState(false)
  const [outline, setOutline] = useState<Float32Array[]>([])
  const [street, setStreet] = useState(false)
  const asked = useRef(false)   // the one-time note has been answered (the street map has been turned on or off before)
  const [explain, setExplain] = useState(false)
  const [tileTick, setTileTick] = useState(0)
  const tiles = useRef(new Map<string, Tile>())
  const [pick, setPick] = useState<Pick | null>(null)
  const [marker, setMarker] = useState<{ lat: number; lon: number } | null>(null)   // a place sent here from Health Check, drawn as a pink ring
  const handledTarget = useRef(0)
  // What the resize watcher needs to know, kept current each render (the watcher is set up once)
  const sizeRef = useRef(size), centreRef = useRef(centre), zoomRef = useRef(zoom), pickRef = useRef(pick)
  sizeRef.current = size; centreRef.current = centre; zoomRef.current = zoom; pickRef.current = pick
  const zoomLive = useRef(zoom)   // the zoom including changes made since the last render, so quick pinch and scroll events add up
  zoomLive.current = zoom
  const [photos, setPhotos] = useState<AlbumFitPhoto[]>([])
  const [peek, setPeek] = useState<number | null>(null)   // a photo of the side panel opened in the photo view (#259)
  const [total, setTotal] = useState(0)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [busyDownload, setBusyDownload] = useState(false)
  const requestRef = useRef(0)
  const measured = useRef(false)   // false until the box has been measured once: the first measure just sets the size
  const [cursor, setCursor] = useState<'grab' | 'grabbing' | 'pointer'>('grab')
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null)

  useEffect(() => { void loadOutline().then(setOutline) }, [])
  // The street map choice lives in Settings (so it is in one place); read it now and again whenever Settings closes
  useEffect(() => {
    void window.flickrAPI.getSettings().then(s => { setStreet(s.mapStreet === true); asked.current = s.mapStreet !== undefined }).catch(() => { /* stays off */ })
  }, [settingsKey])
  // Health Check sent a place: go there, close up, and mark it (a photo with no location has no dot of its own to look for)
  useEffect(() => {
    if (!target || handledTarget.current === target.nonce) return
    handledTarget.current = target.nonce
    const z = 14
    setZoom(z); setCentre(limitCentre({ lat: target.lat, lon: target.lon }, z, sizeRef.current.h)); setPick(null); setMarker({ lat: target.lat, lon: target.lon })
  }, [target])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const watch = (): void => {
      const next = usableSize(el.clientWidth, el.clientHeight)
      if (!next) return   // the tab is hidden (the box measures 0 by 0): leave the size and the place alone
      const prev = sizeRef.current
      if (next.w === prev.w && next.h === prev.h) return
      if (measured.current) {
        // the box changed size (photo tray opened or closed, window resized): keep what you were looking at where it is
        const pk = pickRef.current, z = zoomRef.current
        const centre = anchorAfterResize({ centre: centreRef.current, zoom: z, prev, next, focus: pk && pk.zoom === z ? { lat: pk.cluster.lat, lon: pk.cluster.lon } : undefined })
        centreRef.current = centre
        setCentre(centre)
      }
      measured.current = true
      sizeRef.current = next
      setSize(next)
    }
    watch()
    const ro = new ResizeObserver(watch)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Everything chosen, as the one filter the map's data code understands
  const range = dateMode === 'all' ? { min: '', max: '' } : dateMode === 'since' ? { min: dateMin, max: '' } : dateMode === 'between' ? { min: dateMin, max: dateMax } : getPresetDates(dateMode)
  const from = ymdOf(range.min), to = ymdOf(range.max)
  const f: MapFilter = useMemo(() => {
    const tags = tagsApplied.split(',').map(t => t.trim()).filter(Boolean)
    const level = PRIVACY_LEVEL[privacy]
    return {
      ...(media !== 'all' ? { media } : {}),
      ...(level !== undefined ? { privacy: level } : {}),
      ...(from !== undefined || to !== undefined ? { dateField, ...(from !== undefined ? { dateFrom: from } : {}), ...(to !== undefined ? { dateTo: to } : {}) } : {}),
      ...(tags.length ? { tags, tagMode } : {}),
      ...(albums.length ? { albumIds: albums.map(a => a.id) } : {}),
      ...(accuracy !== 'any' ? { accuracy } : {})
    }
  }, [media, privacy, from, to, dateField, tagsApplied, tagMode, albums, accuracy])
  const fkey = JSON.stringify(f)
  const hasFilter = Object.keys(f).length > 0
  const drawerBadge = (privacy !== 'all' ? 1 : 0) + (f.tags ? 1 : 0) + (albums.length ? 1 : 0) + (f.dateFrom !== undefined || f.dateTo !== undefined ? 1 : 0) + (accuracy !== 'any' ? 1 : 0)
  const clearAll = (): void => {
    setMedia('all'); setPrivacy('all'); setTagText(''); setTagsApplied(''); setTagMode('any'); setAlbums([])
    setDateField('taken'); setDateMode('all'); setDateMin(''); setDateMax(''); setAccuracy('any')
  }
  const changeDateMode = (mode: DateMode): void => {
    setDateMode(mode)
    if (mode === 'all') { setDateMin(''); setDateMax('') }
    else if (mode !== 'since' && mode !== 'between') { const r = getPresetDates(mode); setDateMin(r.min); setDateMax(r.max) }
  }

  // A circle that was picked may not exist once the filters change
  useEffect(() => { setPick(null) }, [fkey])

  // Where the top left corner of the window sits on the flat map at this zoom
  const corner = useMemo(() => {
    const c = worldPixel(centre.lat, centre.lon, zoom)
    return { x: c.x - size.w / 2, y: c.y - size.h / 2 }
  }, [centre, zoom, size])
  const toScreen = useCallback((lat: number, lon: number): { x: number; y: number } => {
    const p = worldPixel(lat, lon, zoom)
    return { x: p.x - corner.x, y: p.y - corner.y }
  }, [zoom, corner])

  // Ask for the dots and circles of the window, a moment after you stop moving
  useEffect(() => {
    const nw = placeAt(corner.x, corner.y, zoom), se = placeAt(corner.x + size.w, corner.y + size.h, zoom)
    const world = 256 * 2 ** zoom
    const wide = size.w >= world
    const req = ++requestRef.current
    const t = setTimeout(() => {
      window.flickrAPI.getMapView({
        west: wide ? -180 : wrapLon(nw.lon), east: wide ? 180 : wrapLon(se.lon), north: nw.lat, south: se.lat, zoom,
        ...f
      }).then(v => { if (req === requestRef.current) { setData(v); setFailed(false) } }).catch(() => { if (req === requestRef.current) setFailed(true) })
    }, 90)
    return () => clearTimeout(t)
  }, [corner, zoom, size, fkey, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drawing
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr)
    const g = c.getContext('2d')
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const col = mapColours()
    g.fillStyle = col.water; g.fillRect(0, 0, size.w, size.h)
    const world = 256 * 2 ** zoom
    g.fillStyle = col.land; g.strokeStyle = col.edge; g.lineWidth = 0.8
    const copies = worldCopies(corner.x, size.w, world)   // the flat map repeats sideways: draw everything once per copy that shows
    for (const k of copies) {
      for (const ring of outline) {
        g.beginPath()
        for (let i = 0; i < ring.length; i += 2) {
          const x = ring[i] * world - corner.x + k * world, y = ring[i + 1] * world - corner.y
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
        }
        g.closePath(); g.fill(); g.stroke()
      }
    }
    if (street) {
      for (const t of visibleTiles(corner, size.w, size.h, zoom)) {
        const key = `${t.z}/${t.x}/${t.y}`
        const have = tiles.current.get(key)
        if (have instanceof ImageBitmap) { tiles.current.delete(key); tiles.current.set(key, have); g.drawImage(have, t.px, t.py, t.size + 0.5, t.size + 0.5) }
        else if (!have || (typeof have === 'number' && Date.now() - have > 60_000)) {
          tiles.current.set(key, 'loading')
          void window.flickrAPI.getMapTile(t.z, t.x, t.y)
            .then(async bytes => (bytes === 'dropped' ? 'dropped' as const : bytes ? await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' })) : null))
            .then(bmp => {
              // 'dropped' = the app skipped it because you had already moved on: forget it, and it is asked for again if it is still in view
              if (bmp === 'dropped') tiles.current.delete(key)
              else tiles.current.set(key, bmp ?? Date.now())
              setTileTick(n => n + 1)
            })
            .catch(() => { tiles.current.set(key, Date.now()); setTileTick(n => n + 1) })
          // keep the saved-in-memory pictures to the most recently drawn few hundred
          if (tiles.current.size > MAX_TILES) for (const [k, v] of tiles.current) { if (tiles.current.size <= MAX_TILES) break; if (v !== 'loading') { if (typeof v !== 'number') v.close(); tiles.current.delete(k) } }
        }
      }
    }
    g.font = '600 12px Lato, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    for (const cl of data?.clusters ?? []) {
      const base = toScreen(cl.lat, cl.lon)
      const r = radius(cl.count)
      const chosen = pick && pick.cluster.cx === cl.cx && pick.cluster.cy === cl.cy && pick.zoom === zoom
      for (const k of copies) {
        const p = { x: base.x + k * world, y: base.y }
        if (p.x < -40 || p.y < -40 || p.x > size.w + 40 || p.y > size.h + 40) continue
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2)
        g.fillStyle = cl.count === 1 ? col.navy : col.blue; g.globalAlpha = cl.count === 1 ? 1 : 0.88; g.fill(); g.globalAlpha = 1
        g.lineWidth = chosen ? 3 : 1.5; g.strokeStyle = chosen ? col.pink : col.white; g.stroke()
        if (cl.count > 1) { g.fillStyle = col.white; g.fillText(shortCount(cl.count), p.x, p.y + 0.5) }
      }
    }
    if (marker) {
      const base = toScreen(marker.lat, marker.lon)
      for (const k of copies) {
        const x = base.x + k * world, y = base.y
        if (x < -40 || y < -40 || x > size.w + 40 || y > size.h + 40) continue
        g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = col.white; g.stroke()
        g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.lineWidth = 2.5; g.strokeStyle = col.pink; g.stroke()
        g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fillStyle = col.pink; g.fill()
      }
    }
  }, [size, zoom, corner, outline, data, pick, toScreen, street, tileTick, marker])

  // Moving and zooming. Zoom keeps the spot under the pointer still.
  const zoomTo = useCallback((next: number, at?: { x: number; y: number }): void => {
    const z = Math.max(minZoomFor(size.h, MIN_ZOOM), Math.min(MAX_ZOOM, next))
    if (z === zoomLive.current) return
    zoomLive.current = z
    const anchor = at ?? { x: size.w / 2, y: size.h / 2 }
    const before = placeAt(corner.x + anchor.x, corner.y + anchor.y, zoom)
    const after = worldPixel(before.lat, before.lon, z)
    const centrePx = { x: after.x - anchor.x + size.w / 2, y: after.y - anchor.y + size.h / 2 }
    const c = placeAt(centrePx.x, centrePx.y, z)
    setZoom(z); setCentre(limitCentre(c, z, size.h))
  }, [zoom, size, corner])
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const wheel = (e: WheelEvent): void => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const intent = wheelIntent(e)
      if (intent.kind === 'zoom') { zoomTo(zoomLive.current + intent.amount, { x: e.clientX - r.left, y: e.clientY - r.top }); return }
      // a two-finger swipe moves the map; the view cannot go past the top or bottom of the world
      setCentre(prev => { const c = worldPixel(prev.lat, prev.lon, zoom); return limitCentre(placeAt(c.x + intent.dx, c.y + intent.dy, zoom), zoom, size.h) })
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [zoomTo, zoom, size.h])
  // A taller window or a different zoom can leave the view past the top or bottom: bring it back, and never zoom out past the world's height
  useEffect(() => {
    const floor = minZoomFor(size.h, MIN_ZOOM)
    if (zoom < floor) { setZoom(floor); return }
    setCentre(prev => { const n = limitCentre(prev, zoom, size.h); return Math.abs(n.lat - prev.lat) < 1e-9 && Math.abs(n.lon - prev.lon) < 1e-9 ? prev : n })
  }, [zoom, size.h])

  // The dot or circle under a spot in the window, if any
  const hitAt = (mx: number, my: number): MapCluster | null => {
    let best: MapCluster | null = null, bestD = Infinity
    const world = 256 * 2 ** zoom
    for (const cl of data?.clusters ?? []) {
      const p = toScreen(cl.lat, cl.lon)
      for (const k of worldCopies(corner.x, size.w, world)) {   // a dot can be clicked on any copy of the world
        const dist = Math.hypot(p.x + k * world - mx, p.y - my)
        if (dist <= radius(cl.count) + 5 && dist < bestD) { best = cl; bestD = dist }
      }
    }
    return best
  }
  const onDown = (e: React.PointerEvent): void => { (e.target as Element).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, moved: 0 }; setCursor('grabbing') }
  const onMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) {
      const r = (e.target as Element).getBoundingClientRect()
      const next = hitAt(e.clientX - r.left, e.clientY - r.top) ? 'pointer' : 'grab'
      if (next !== cursor) setCursor(next)
      return
    }
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy)
    const c = worldPixel(centre.lat, centre.lon, zoom)
    const next = placeAt(c.x - dx, c.y - dy, zoom)
    setCentre(limitCentre(next, zoom, size.h))
  }
  const onUp = (e: React.PointerEvent): void => {
    const d = drag.current
    drag.current = null
    const r = (e.target as Element).getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const best = hitAt(mx, my)
    setCursor(best ? 'pointer' : 'grab')
    if (!d || d.moved > 5 || !data) return
    if (best) setPick({ cluster: best, zoom }); else setPick(null)
  }
  const onKey = (e: React.KeyboardEvent): void => {
    const step = 80
    const c = worldPixel(centre.lat, centre.lon, zoom)
    const move = (dx: number, dy: number): void => { const n = placeAt(c.x + dx, c.y + dy, zoom); setCentre(limitCentre(n, zoom, size.h)); e.preventDefault() }
    if (e.key === 'ArrowLeft') move(-step, 0); else if (e.key === 'ArrowRight') move(step, 0)
    else if (e.key === 'ArrowUp') move(0, -step); else if (e.key === 'ArrowDown') move(0, step)
    else if (e.key === '+' || e.key === '=') { zoomTo(zoom + 1); e.preventDefault() } else if (e.key === '-') { zoomTo(zoom - 1); e.preventDefault() }
  }

  // The photos behind the chosen dot or circle
  useEffect(() => {
    setPhotos([]); setTotal(0)
    moreReq.current++   // answers for the circle picked before this one are thrown away
    if (!pick) return
    void more(0)
  }, [pick?.cluster.cx, pick?.cluster.cy, pick?.zoom, fkey]) // eslint-disable-line react-hooks/exhaustive-deps
  const moreReq = useRef(0)
  const more = async (offset: number): Promise<number> => {   // how many photos it added (0 when it could not load any)
    if (!pick) return 0
    const req = moreReq.current
    setLoadingPhotos(true)
    try {
      const page = await window.flickrAPI.getMapCell({ zoom: pick.zoom, cx: pick.cluster.cx, cy: pick.cluster.cy, offset, limit: PAGE, ...f })
      const cards = await window.flickrAPI.getPhotoCards(page.ids)
      if (req !== moreReq.current) return 0
      setTotal(page.total)
      setPhotos(prev => (offset === 0 ? cards : [...prev, ...cards]))
      setLoadingPhotos(false)
      return cards.length
    } catch { /* the panel just stays as it was */ }
    if (req === moreReq.current) setLoadingPhotos(false)
    return 0
  }
  const downloadAll = async (): Promise<void> => {
    if (!pick) return
    setBusyDownload(true)
    try {
      const all: { id: string; title: string }[] = []
      for (let off = 0; off < total; off += 500) {
        const page = await window.flickrAPI.getMapCell({ zoom: pick.zoom, cx: pick.cluster.cx, cy: pick.cluster.cy, offset: off, limit: 500, ...f })
        const cards = await window.flickrAPI.getPhotoCards(page.ids.slice(0, 400))
        const rest = page.ids.slice(400)
        const more2 = rest.length ? await window.flickrAPI.getPhotoCards(rest) : []
        for (const c of [...cards, ...more2]) all.push({ id: c.photoId, title: c.title })
      }
      onDownload(all, 'from the map', `${all.length.toLocaleString()} photos taken in this spot on the map.`)
    } catch { /* nothing to start */ }
    setBusyDownload(false)
  }
  const zoomHere = (): void => {
    if (!pick) return
    const next = Math.min(MAX_ZOOM, pick.zoom + 3)
    setCentre(limitCentre({ lat: pick.cluster.lat, lon: pick.cluster.lon }, next, size.h)); setZoom(next); setPick(null)
  }

  const turnStreet = (on: boolean): void => {
    if (on && !asked.current) { setExplain(true); return }
    setStreet(on); asked.current = true; setExplain(false)
    void window.flickrAPI.setSettings({ mapStreet: on })
    if (on) for (const [k, v] of tiles.current) if (typeof v === 'number') tiles.current.delete(k)
  }
  const all = [...tiles.current.values()]
  const streetFailed = street && all.some(v => typeof v === 'number') && !all.some(v => v instanceof ImageBitmap)

  const n = (x: number): string => x.toLocaleString()

  if (data && data.located === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyTitle}>No photo locations yet</div>
        <div style={dash.muted}>The map uses the library list FlickrFetch keeps on this computer. A Rebuild reads it, along with the place each photo was taken.</div>
        <button style={primaryBtn} onClick={onFullRescan}>Rebuild</button>
      </div>
    )
  }

  return (
    <div style={{ ...styles.wrap, display: active ? 'flex' : undefined }}>
      <div style={{ padding: '8px 24px' }}>
      <ScreenTop
        context={<>
          <span style={{ ...headingDialog }}>Map</span>
        <span style={styles.count}>
          {data ? <><b>{n(data.located)}</b> of {n(data.photos)} photos have a location · {hasFilter && <><b>{n(data.matching)}</b> match · </>}<b>{n(data.inView)}</b> in view</> : 'Reading your photos…'}
        </span>
        </>}
        actions={<>
        <label style={styles.field}><input type="checkbox" checked={street} onChange={e => turnStreet(e.target.checked)} /> Show street map</label>
        </>}
        filters={<>
        <div style={sharedStyles.segGroup}>
          {(['all', 'photo', 'video'] as MediaChoice[]).map(v => (
            <button key={v} style={{ ...sharedStyles.seg, ...(media === v ? sharedStyles.segActive : {}) }} onClick={() => setMedia(v)} aria-pressed={media === v}>
              {v === 'all' ? 'All' : v === 'photo' ? 'Photos' : 'Videos'}
            </button>
          ))}
        </div>
        <button style={{ ...sharedStyles.moreFiltersBtn, ...(drawerOpen ? sharedStyles.moreFiltersBtnActive : {}) }} onClick={() => setDrawerOpen(o => !o)} aria-expanded={drawerOpen}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ flexShrink: 0 }}><path d="M1 2h10L7 6v4l-2-1V6L1 2z" /></svg>
          Filters
          {drawerBadge > 0 && !drawerOpen && <span style={sharedStyles.drawerBadge}>{drawerBadge}</span>}
        </button>
        </>}
      />
      </div>

      {drawerOpen && (
        <div style={sharedStyles.drawer}>
          <div style={{ ...sharedStyles.drawerRow, padding: '6px 24px' }}>
            <span style={sharedStyles.drawerLabel}>Privacy</span>
            <div style={sharedStyles.segGroup}>
              {PRIVACY_OPTIONS.map(v => (
                <button key={v} style={{ ...sharedStyles.seg, ...(privacy === v ? sharedStyles.segActive : {}) }} onClick={() => setPrivacy(v)} aria-pressed={privacy === v}>{PRIVACY_LABELS[v]}</button>
              ))}
            </div>
          </div>

          <div style={{ ...sharedStyles.drawerRow, padding: '6px 24px' }}>
            <span style={sharedStyles.drawerLabel}>Tags</span>
            <div style={sharedStyles.searchGroup}>
              <input style={{ ...sharedStyles.searchInput, minWidth: 160 }} type="text" placeholder="paris, travel…" value={tagText} aria-label="Tags"
                onChange={e => setTagText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') setTagsApplied(tagText.trim()) }} />
              {tagText && <button style={styles.xBtn} aria-label="Clear tags" onClick={() => { setTagText(''); setTagsApplied('') }}><Icon name="close" /></button>}
            </div>
            <div style={sharedStyles.segGroup}>
              {(['any', 'all'] as const).map(v => (
                <button key={v} style={{ ...sharedStyles.seg, ...(tagMode === v ? sharedStyles.segActive : {}) }} onClick={() => setTagMode(v)} aria-pressed={tagMode === v}>{v}</button>
              ))}
            </div>
            <InfoTip text={"Type tags, separated by commas, then press Enter.\n\nAny: photos with at least one of the tags.\nAll: photos with every tag."} />
          </div>

          <div style={{ ...sharedStyles.drawerRow, padding: '6px 24px' }}>
            <span style={sharedStyles.drawerLabel}>Album</span>
            <AlbumBox inputRef={albumRef} chosen={albums} onToggle={a => setAlbums(list => (list.some(x => x.id === a.id) ? list.filter(x => x.id !== a.id) : [...list, a]))} />
            <span style={styles.hint}>Pick one or more; photos in any of them show.</span>
          </div>

          <div style={{ ...sharedStyles.drawerRow, padding: '6px 24px' }}>
            <span style={sharedStyles.drawerLabel}>Date</span>
            <div style={sharedStyles.segGroup}>
              {(['taken', 'posted'] as const).map(v => (
                <button key={v} style={{ ...sharedStyles.seg, ...(dateField === v ? sharedStyles.segActive : {}) }} onClick={() => setDateField(v)} aria-pressed={dateField === v}>{v === 'taken' ? 'Taken' : 'Posted'}</button>
              ))}
            </div>
            <select style={sharedStyles.dateModeSelect} value={dateMode} onChange={e => changeDateMode(e.target.value as DateMode)} aria-label="Date range">
              <option value="all">All dates</option>
              <optgroup label="Quick ranges">
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
                <option value="thisYear">This year</option>
                <option value="lastYear">Last year</option>
              </optgroup>
              <optgroup label="Custom">
                <option value="since">Since a date…</option>
                <option value="between">Between two dates…</option>
              </optgroup>
            </select>
            {(dateMode === 'since' || dateMode === 'between') && (
              <div style={sharedStyles.dateInputsInline}>
                <input type="date" style={sharedStyles.dateInput} value={dateMin} onChange={e => setDateMin(e.target.value)} aria-label="From date" />
                {dateMode === 'between' && (<><span style={sharedStyles.dateToLabel}>to</span><input type="date" style={sharedStyles.dateInput} value={dateMax} onChange={e => setDateMax(e.target.value)} aria-label="To date" /></>)}
              </div>
            )}
          </div>

          <div style={{ ...sharedStyles.drawerRow, padding: '6px 24px' }}>
            <span style={sharedStyles.drawerLabel}>Located</span>
            <div style={sharedStyles.segGroup}>
              {(['any', 'street', 'town', 'vague'] as AccuracyChoice[]).map(v => (
                <button key={v} style={{ ...sharedStyles.seg, ...(accuracy === v ? sharedStyles.segActive : {}) }} onClick={() => setAccuracy(v)} aria-pressed={accuracy === v}>{ACCURACY_LABEL[v]}</button>
              ))}
            </div>
            <InfoTip text={"How precisely Flickr placed each photo, on its scale of 1 (the whole world) to 16 (a street).\n\nStreet: 15 or 16.\nTown or better: 11 or more.\nVague only: 10 or less, such as a photo placed just \"Italy\".\n\nPhotos with no precision recorded show only under Any."} />
          </div>
        </div>
      )}

      {hasFilter && (
        <div style={{ ...sharedStyles.chipRow, padding: '4px 24px 6px' }}>
          {media !== 'all' && <Chip label={media === 'photo' ? 'Photos only' : 'Videos only'} onDismiss={() => setMedia('all')} />}
          {privacy !== 'all' && <Chip label={`Privacy: ${PRIVACY_LABELS[privacy]}`} onDismiss={() => setPrivacy('all')} />}
          {f.tags && <Chip label={`Tags (${tagMode}): ${tagsApplied}`} onDismiss={() => { setTagText(''); setTagsApplied('') }} />}
          {albums.map(a => <Chip key={a.id} label={`Album: ${a.title || '(no title)'}`} onDismiss={() => setAlbums(list => list.filter(x => x.id !== a.id))} />)}
          {(f.dateFrom !== undefined || f.dateTo !== undefined) && <Chip label={formatDateChip(range.min, range.max, dateField)} onDismiss={() => changeDateMode('all')} />}
          {accuracy !== 'any' && <Chip label={`Located: ${ACCURACY_LABEL[accuracy]}`} onDismiss={() => setAccuracy('any')} />}
          <button style={sharedStyles.clearFiltersLink} onClick={clearAll}>Clear all</button>
        </div>
      )}
      <div style={styles.body}>
        <div ref={box} style={styles.mapBox}>
          <canvas ref={canvas} style={{ position: 'absolute', left: 0, top: 0, width: size.w, height: size.h, display: 'block', cursor, touchAction: 'none' }}
            tabIndex={0} role="img" aria-label={data ? `Map of ${n(data.located)} photos with a location. Arrow keys move, plus and minus zoom.` : 'Map'}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setCursor('grab') }} onPointerLeave={() => { if (!drag.current) setCursor('grab') }} onKeyDown={onKey}
            onDoubleClick={e => { const r = (e.target as Element).getBoundingClientRect(); zoomTo(zoom + 1, { x: e.clientX - r.left, y: e.clientY - r.top }) }} />
          <div style={styles.zoom}>
            <button style={styles.zoomBtn} onClick={() => zoomTo(zoom + 1)} aria-label="Zoom in">+</button>
            <button style={styles.zoomBtn} onClick={() => zoomTo(zoom - 1)} aria-label="Zoom out">−</button>
          </div>
          {street && <button style={styles.credit} onClick={() => window.flickrAPI.openExternal('https://www.openstreetmap.org/copyright')} title="Street map data from OpenStreetMap">© OpenStreetMap contributors</button>}
          {explain && (
            <div style={styles.explain} role="dialog" aria-label="About the street map">
              <b>About the street map</b>
              <div>Draws streets under your photos, using OpenStreetMap, a free community map.</div>
              <div>To do that, FlickrFetch asks it for the map images of the area you are looking at, so it learns roughly where you look. Nothing else is sent: not your photos, account or name.</div>
              <div>The map images (not your photos) are saved on this computer, so places you have seen load fast and work offline. Turn it off any time, here or in Settings.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={primaryBtn} onClick={() => { asked.current = true; setStreet(true); setExplain(false); void window.flickrAPI.setSettings({ mapStreet: true }) }}>Turn on street map</button>
                <button style={quietBtn} onClick={() => setExplain(false)}>Not now</button>
              </div>
            </div>
          )}
          {marker && <div style={{ ...styles.note, left: 'auto', bottom: 'auto', right: 10, top: 10 }}>The place from Health Check is marked. <button style={sharedStyles.clearFiltersLink} onClick={() => setMarker(null)}>Remove mark</button></div>}
          {streetFailed && <div style={{ ...styles.note, bottom: 34 }}>Couldn't load the street map. Check your connection. Showing the outline instead.</div>}
          {data && hasFilter && data.matching === 0 && <div style={{ ...styles.note, left: '50%', bottom: 'auto', top: 12, transform: 'translateX(-50%)' }}>No photo with a location matches these filters. <button style={sharedStyles.clearFiltersLink} onClick={clearAll}>Clear all</button></div>}
          {failed && <div style={styles.note}>Couldn't read the map. Try moving it again.</div>}
          {outline.length === 0 && <div style={styles.note}>The country outline is not installed, so only your photos are shown.</div>}
        </div>
        {pick && (
          <aside style={styles.side} aria-label="Photos at this spot">
            <div style={styles.sideHead}>
              <b>{n(pick.cluster.count)} photo{pick.cluster.count === 1 ? '' : 's'}</b>
              <button style={styles.close} onClick={() => setPick(null)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <div style={styles.sideActions}>
              {pick.cluster.count > 1 && <button style={quietBtn} onClick={zoomHere}>Zoom in here</button>}
              <button style={quietBtn} disabled={busyDownload || total === 0} onClick={() => void downloadAll()}>{busyDownload ? 'Getting the list…' : `Download these ${n(total || pick.cluster.count)}`}</button>
            </div>
            <div style={styles.grid}>
              {photos.map((p, i) => (
                <button key={p.photoId} style={styles.tile} title={p.title || '(no title)'} aria-label={`Open ${p.title || 'this photo'}`} onClick={() => setPeek(i)}>
                  {p.thumbUrl ? <img src={p.thumbUrl} alt="" loading="lazy" style={styles.thumb} /> : null}
                </button>
              ))}
            </div>
            {loadingPhotos && <div style={dash.muted}>Loading…</div>}
            {photos.length < total && !loadingPhotos && <button style={{ ...quietBtn, width: '100%' }} onClick={() => void more(photos.length)}>Show more ({n(total - photos.length)} left)</button>}
            <div style={{ ...dash.muted, marginTop: 6 }}>Click a photo to see it larger.</div>
          </aside>
        )}
        {peek !== null && photos[peek] && <PhotoPeek photos={photos} start={peek} sourceName="Map" hasMore={photos.length < total} loadMore={() => more(photos.length)} onClose={() => setPeek(null)} />}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  // Fills the tab exactly (its parent is a fixed-size pane, not a flex box, so `flex: 1` did nothing and the map was only as tall as its content:
  // about 300 px, or as tall as the photo tray when that was open)
  wrap: { height: '100%', minHeight: 0, flexDirection: 'column', overflow: 'hidden' },
  bar: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 24px', fontSize: 13, color: 'var(--ff-text-secondary)' },
  count: { color: 'var(--ff-text-secondary)' },
  xBtn: { border: 'none', background: 'none', padding: '0 8px', fontSize: 12, color: 'var(--ff-text-muted)', cursor: 'pointer' },
  hint: { fontSize: 12, color: 'var(--ff-text-secondary)' },
  field: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ff-text-secondary)' },
  select: { ...selectBox },
  body: { flex: 1, minHeight: 0, display: 'flex', gap: 12, padding: '0 24px 12px' },
  mapBox: { position: 'relative', flex: 1, minWidth: 0, minHeight: 300, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--ff-border)' },
  credit: { position: 'absolute', right: 0, bottom: 0, background: 'color-mix(in srgb, var(--ff-surface) 85%, transparent)', border: 'none', borderTopLeftRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--ff-text-secondary)', cursor: 'pointer', textDecoration: 'underline' },
  explain: { position: 'absolute', top: 10, left: 54, maxWidth: 380, background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--ff-text)', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--ff-shadow-menu)' },
  zoom: { position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 4 },
  zoomBtn: { width: 32, height: 32, border: '1px solid var(--ff-line-strong)', borderRadius: 8, background: 'var(--ff-surface)', fontSize: 18, lineHeight: 1, color: 'var(--ff-text)', cursor: 'pointer' },
  note: { position: 'absolute', left: 10, bottom: 10, background: 'color-mix(in srgb, var(--ff-surface) 92%, transparent)', border: '1px solid var(--ff-border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--ff-text-secondary)' },
  side: { width: 300, flex: 'none', overflowY: 'auto', background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  sideHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, color: 'var(--ff-text)' },
  close: { border: 'none', background: 'none', fontSize: 14, color: 'var(--ff-text-muted)', cursor: 'pointer' },
  sideActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
  tile: { display: 'block', width: '100%', aspectRatio: '1 / 1', padding: 0, border: '1px solid var(--ff-border)', borderRadius: 6, overflow: 'hidden', background: 'var(--ff-grey-100)', cursor: 'pointer' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  empty: { padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', maxWidth: 520, margin: '0 auto' },
  emptyTitle: { ...headingCard }
}
