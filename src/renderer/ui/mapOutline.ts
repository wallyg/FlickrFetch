/// <reference types="vite/client" />
import { worldPixel } from '../../shared/mapGeo'

// The built-in outline of the world's countries, drawn under the photo dots. It is a TopoJSON file from Natural Earth (public domain) kept in
// src/renderer/assets and read here with a small decoder of our own, so there is no map library. If the file is missing the map simply has a
// plain background. Each ring comes back as [u, v, u, v, ...] with u and v from 0 to 1 across the whole world (multiply by the map size).

interface Topo {
  transform?: { scale: [number, number]; translate: [number, number] }
  arcs: number[][][]
  objects: Record<string, { geometries: { type: string; arcs: unknown }[] }>
}

const loaders = import.meta.glob('../assets/countries-*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>
let cached: Promise<Float32Array[]> | null = null

export function loadOutline(): Promise<Float32Array[]> {
  if (!cached) {
    const first = Object.values(loaders)[0]
    cached = first ? first().then(t => decode(t as Topo)).catch(() => []) : Promise.resolve([])
  }
  return cached
}

function decode(t: Topo): Float32Array[] {
  const scale = t.transform?.scale ?? [1, 1], shift = t.transform?.translate ?? [0, 0]
  // Each arc is stored as steps from the one before; add them up, then put them on the globe
  const arcs: [number, number][][] = t.arcs.map(arc => {
    let x = 0, y = 0
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + shift[0], y * scale[1] + shift[1]] as [number, number] })
  })
  const ringOf = (indices: number[]): [number, number][] => {
    const out: [number, number][] = []
    for (const i of indices) {
      const a = i >= 0 ? arcs[i] : [...arcs[~i]].reverse()
      for (let k = out.length > 0 ? 1 : 0; k < a.length; k++) out.push(a[k])   // an arc starts where the last one ended
    }
    return out
  }
  const rings: Float32Array[] = []
  const flat = (pts: [number, number][]): Float32Array => {
    const f = new Float32Array(pts.length * 2)
    pts.forEach(([lon, lat], i) => { const w = worldPixel(lat, lon, 0); f[i * 2] = w.x / 256; f[i * 2 + 1] = w.y / 256 })
    return f
  }
  // The file also carries a merged "land" shape; the countries alone are enough (drawing both would paint everything twice).
  for (const obj of t.objects.countries ? [t.objects.countries] : Object.values(t.objects)) {
    for (const g of obj.geometries) {
      if (g.type === 'Polygon') for (const r of g.arcs as number[][]) rings.push(flat(ringOf(r)))
      else if (g.type === 'MultiPolygon') for (const poly of g.arcs as number[][][]) for (const r of poly) rings.push(flat(ringOf(r)))
    }
  }
  return rings
}
