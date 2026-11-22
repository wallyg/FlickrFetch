import { useState } from 'react'

// How big the photo squares are on the date pages (On This Day). Remembered between visits.
const KEY = 'ff-date-tile-size'
export const TILE_MIN = 90
export const TILE_MAX = 300
export const TILE_DEFAULT = 120

export function useTileSize(): [number, (n: number) => void] {
  const [size, setSize] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(KEY))
      return v >= TILE_MIN && v <= TILE_MAX ? v : TILE_DEFAULT
    } catch { return TILE_DEFAULT }
  })
  const update = (n: number): void => {
    setSize(n)
    try { localStorage.setItem(KEY, String(n)) } catch { /* not remembered, still works */ }
  }
  return [size, update]
}
