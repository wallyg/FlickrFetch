// The flat map (Web Mercator, the one every web map uses): turning a place into a position on the map and back. Used by the map screen and by the
// code that groups photos into circles, so both always agree on where a photo sits. 256 px is the whole world at zoom 0 and each zoom doubles it.

export const MAX_LAT = 85.0511

export function worldPixel(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const size = 256 * 2 ** zoom
  const la = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
  const x = ((lon + 180) / 360) * size
  const y = (0.5 - Math.log(Math.tan(Math.PI / 4 + (la * Math.PI) / 360)) / (2 * Math.PI)) * size
  return { x, y }
}

export function placeAt(x: number, y: number, zoom: number): { lat: number; lon: number } {
  const size = 256 * 2 ** zoom
  const lon = (x / size) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / size
  const lat = (Math.atan(Math.sinh(n)) * 180) / Math.PI
  return { lat: Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)), lon }
}

// Street map pictures ("tiles") are 256 px squares. At tile zoom z the world is 2^z tiles across. The map's own zoom can sit between two
// whole numbers, so tiles are picked at the nearest whole zoom and drawn a little larger or smaller to fit.
export const MAX_TILE_ZOOM = 19

export interface TileSpot { z: number; x: number; y: number; px: number; py: number; size: number }

export function tileZoomFor(zoom: number): number {
  return Math.max(0, Math.min(MAX_TILE_ZOOM, Math.round(zoom)))
}

// Every tile that touches the window, with where its top left corner lands in the window (corner = where the window's top left sits on the
// flat map at this zoom). The world repeats sideways, so a window that reaches past the edge gets the tiles from the other side too: x is the
// tile's column in the world (wrapped), px is where it is drawn.
export function visibleTiles(corner: { x: number; y: number }, width: number, height: number, zoom: number): TileSpot[] {
  const z = tileZoomFor(zoom)
  const size = 256 * 2 ** (zoom - z)
  const count = 2 ** z
  const x0 = Math.floor(corner.x / size), x1 = Math.floor((corner.x + width) / size)
  const y0 = Math.max(0, Math.floor(corner.y / size)), y1 = Math.min(count - 1, Math.floor((corner.y + height) / size))
  const out: TileSpot[] = []
  for (let y = y0; y <= y1; y++) {
    for (let tx = x0; tx <= x1; tx++) out.push({ z, x: ((tx % count) + count) % count, y, px: tx * size - corner.x, py: y * size - corner.y, size })
  }
  return out
}

/** A longitude brought back into -180 up to (not including) 180: the map repeats every 360 degrees. */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

/** Which copies of the world (0 is the middle one, -1 the one to its left, 1 the one to its right) show in a window that starts at
    cornerX and is width wide, when the world is world pixels across. Draw everything once for each. */
export function worldCopies(cornerX: number, width: number, world: number): number[] {
  const lo = Math.floor(cornerX / world), hi = Math.max(lo, Math.ceil((cornerX + width) / world) - 1)
  const out: number[] = []
  for (let k = lo; k <= hi; k++) out.push(k)
  return out
}

/** The nearest zoom at which the whole height of the world fits the window exactly, so the map never shows blank space above the north pole or
    below the south. Never below the map's own lowest zoom (1). */
export function minZoomFor(height: number, floor = 1): number {
  return Math.max(floor, Math.log2(Math.max(1, height) / 256))
}

/** Keep a view inside the map: it can run past the sides (the world repeats) but not past the top or bottom. If the world is shorter than the
    window it sits in the middle. Longitude comes back into -180 to 180. */
export function limitCentre(centre: { lat: number; lon: number }, zoom: number, height: number): { lat: number; lon: number } {
  const world = 256 * 2 ** zoom
  const c = worldPixel(centre.lat, centre.lon, zoom)
  const y = world <= height ? world / 2 : Math.max(height / 2, Math.min(world - height / 2, c.y))
  const out = placeAt(c.x, y, zoom)
  return { lat: out.lat, lon: wrapLon(centre.lon) }
}

/** Where the middle of the view should be after the map's box changes size (the photo tray opens or closes, the window is resized). The top left
    corner of the map stays where it is, so what you were looking at stays put and the new room appears at the right and bottom. If a circle is
    picked and was in view before, it is kept in view (at least `margin` px from every edge), so the tray never slides over it. */
export function anchorAfterResize(a: {
  centre: { lat: number; lon: number }; zoom: number; prev: { w: number; h: number }; next: { w: number; h: number }
  focus?: { lat: number; lon: number }; margin?: number
}): { lat: number; lon: number } {
  const world = 256 * 2 ** a.zoom
  const c0 = worldPixel(a.centre.lat, a.centre.lon, a.zoom)
  let cx = c0.x - a.prev.w / 2, cy = c0.y - a.prev.h / 2
  if (a.focus) {
    const m = a.margin ?? 40
    const f = worldPixel(a.focus.lat, a.focus.lon, a.zoom)
    const fx = f.x + Math.round((c0.x - f.x) / world) * world   // the copy of the world nearest the middle of the old view
    const sx = fx - cx, sy = f.y - cy
    const wasInView = sx >= 0 && sx <= a.prev.w && sy >= 0 && sy <= a.prev.h
    if (wasInView) {
      if (a.next.w < 2 * m) cx = fx - a.next.w / 2
      else if (sx > a.next.w - m) cx += sx - (a.next.w - m)
      else if (sx < m) cx -= m - sx
      if (a.next.h < 2 * m) cy = f.y - a.next.h / 2
      else if (sy > a.next.h - m) cy += sy - (a.next.h - m)
      else if (sy < m) cy -= m - sy
    }
  }
  const out = placeAt(cx + a.next.w / 2, cy + a.next.h / 2, a.zoom)
  return limitCentre(out, a.zoom, a.next.h)
}

export type WheelIntent = { kind: 'zoom'; amount: number } | { kind: 'pan'; dx: number; dy: number }

/** What a scroll on the map means. A two-finger swipe on a trackpad moves the map in any direction; a pinch (the browser sends it as ctrl + scroll)
    or Cmd or Option + scroll zooms; a notched mouse wheel (reported in lines, not pixels) zooms. Zoom is in zoom levels. */
export function wheelIntent(e: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): WheelIntent {
  const px = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1   // lines and pages to pixels
  if (e.ctrlKey) return { kind: 'zoom', amount: -e.deltaY * px * 0.01 }
  if (e.metaKey || e.altKey || e.deltaMode !== 0) return { kind: 'zoom', amount: -e.deltaY * px * 0.0025 }
  return { kind: 'pan', dx: e.deltaX, dy: e.deltaY }
}

// How much room the saved street pictures may take on this computer (a setting; the number is in megabytes).
export const MAP_CACHE_MIN_MB = 20
export const MAP_CACHE_MAX_MB = 5000
export const MAP_CACHE_DEFAULT_MB = 300

/** The limit to use for whatever is saved: a whole number between the smallest and largest allowed, or the default when there is none. */
export function cacheLimitMb(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MAP_CACHE_DEFAULT_MB
  return Math.max(MAP_CACHE_MIN_MB, Math.min(MAP_CACHE_MAX_MB, Math.round(value)))
}
