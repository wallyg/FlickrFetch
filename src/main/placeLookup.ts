// Which country or US state a point is in, worked out on this computer from the outlines the Map already ships (countries) and the US states file
// (states-us.json). No web lookup: a point is tested against each outline. The outlines are simplified, so a point on a coast can fall just outside
// its country; for those the nearest outline within a small distance is used.

export interface Topo {
  transform: { scale: [number, number]; translate: [number, number] }
  arcs: number[][][]
  objects: Record<string, { geometries: { type: string; arcs: unknown; properties?: { name?: string } }[] }>
}

type Pt = [number, number]
interface Poly { outer: Pt[]; holes: Pt[][]; box: [number, number, number, number] }
interface Place { name: string; polys: Poly[] }

export interface Lookup {
  /** The name of the place that holds this point, or null when it is in none of them (at sea, or a wrong geotag). */
  find(lon: number, lat: number): string | null
  /** Like find, but a point just off a coast takes the nearest place within `maxDeg` degrees. */
  locate(lon: number, lat: number, maxDeg: number): string | null
}

function decodeArcs(topo: Topo): Pt[][] {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate
  return topo.arcs.map(a => {
    let x = 0, y = 0
    return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty] as Pt })
  })
}

/** Squared distance, in degrees, from a point to the line segment a to b. */
function segmentDistance2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  const cx = ax + t * dx - px, cy = ay + t * dy - py
  return cx * cx + cy * cy
}

export function makeLookup(topo: Topo, objectName: string): Lookup {
  const arcs = decodeArcs(topo)
  const ring = (idx: number[]): Pt[] => {
    const pts: Pt[] = []
    for (const i of idx) {
      const a = i >= 0 ? arcs[i] : [...arcs[~i]].reverse()
      pts.push(...(pts.length ? a.slice(1) : a))
    }
    return pts
  }
  const places: Place[] = topo.objects[objectName].geometries.map(g => {
    const polygons = (g.type === 'MultiPolygon' ? g.arcs : [g.arcs]) as number[][][]
    return {
      name: g.properties?.name ?? '',
      polys: polygons.map(rings => {
        const [outer, ...holes] = rings.map(ring)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const [x, y] of outer) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
        return { outer, holes, box: [minX, minY, maxX, maxY] as [number, number, number, number] }
      })
    }
  })

  const inside = (x: number, y: number, r: Pt[]): boolean => {
    let c = false
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  const find = (lon: number, lat: number): string | null => {
    for (const p of places) {
      for (const poly of p.polys) {
        const b = poly.box
        if (lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3] && inside(lon, lat, poly.outer) && !poly.holes.some(h => inside(lon, lat, h))) return p.name
      }
    }
    return null
  }
  const NUDGES: Pt[] = [[0.02, 0], [-0.02, 0], [0, 0.02], [0, -0.02], [0.05, 0.05], [-0.05, 0.05], [0.05, -0.05], [-0.05, -0.05], [0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]]
  const locate = (lon: number, lat: number, maxDeg: number): string | null => {
    const exact = find(lon, lat)
    if (exact) return exact
    for (const [dx, dy] of NUDGES) { const n = find(lon + dx, lat + dy); if (n) return n }
    // The nearest place is the one whose EDGE is nearest (a bounding box would claim every sea point inside a big country's box)
    let best: { d: number; name: string } | null = null
    for (const p of places) {
      for (const poly of p.polys) {
        const b = poly.box
        if (lon < b[0] - maxDeg || lon > b[2] + maxDeg || lat < b[1] - maxDeg || lat > b[3] + maxDeg) continue
        const r = poly.outer
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          const d = segmentDistance2(lon, lat, r[j][0], r[j][1], r[i][0], r[i][1])
          if (!best || d < best.d) best = { d, name: p.name }
        }
      }
    }
    return best && best.d < maxDeg * maxDeg ? best.name : null
  }
  return { find, locate }
}
