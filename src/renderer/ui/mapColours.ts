// The Map is drawn on a canvas, which cannot use var(--ff-...) itself. These read the brand colours from the page's tokens each time the map is
// drawn, so the brand guide (index.html) stays the one place the colours are written down (#242).
export interface MapColours { water: string; land: string; edge: string; navy: string; blue: string; pink: string; white: string }

export function mapColours(): MapColours {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string): string => cs.getPropertyValue(name).trim()
  return { water: v('--ff-map-water'), land: v('--ff-map-land'), edge: v('--ff-map-edge'), navy: v('--ff-navy'), blue: v('--ff-blue'), pink: v('--ff-pink'), white: v('--ff-white') }
}
