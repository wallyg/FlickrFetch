// A count of the requests this computer has sent to Flickr, and the rule for answering "slow down" (HTTP 429).
// Flickr gives each API key about 3,600 requests an hour, shared by everyone using the key, and does not say how much is used.
// So this can only show what THIS computer used since FlickrFetch opened; it is never the whole key's total.

import type { RequestStats } from '../shared/types'
export type { RequestStats }

const HOUR_MS = 3600 * 1000

export class RequestLog {
  private times: number[] = []
  private methods = new Map<string, number>()
  private total = 0
  private slow = 0

  record(url: string, now = Date.now()): void {
    this.total++
    this.times.push(now)
    if (this.times.length > 20000) this.times = this.times.slice(-10000)
    const method = /[?&]method=([A-Za-z0-9_.]+)/.exec(url)?.[1] ?? 'other'
    this.methods.set(method, (this.methods.get(method) ?? 0) + 1)
  }

  recordSlowDown(): void { this.slow++ }

  stats(now = Date.now()): RequestStats {
    this.times = this.times.filter(t => now - t < HOUR_MS)
    const top = [...this.methods.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([method, count]) => ({ method, count }))
    return { lastHour: this.times.length, sinceOpen: this.total, slowDowns: this.slow, top }
  }
}

export const MAX_SLOW_DOWN_RETRIES = 3
export const MAX_WAIT_MS = 60_000

/** How long to wait before trying again after Flickr says slow down: what Flickr asks for (Retry-After, in seconds) when it says, else 2, 4, 8 seconds. Never more than a minute. */
export function slowDownWaitMs(attempt: number, retryAfter?: string | number | null): number {
  const asked = Number(retryAfter)
  if (retryAfter !== undefined && retryAfter !== null && retryAfter !== '' && Number.isFinite(asked) && asked >= 0) return Math.min(asked * 1000, MAX_WAIT_MS)
  return Math.min(2000 * 2 ** Math.max(0, attempt), MAX_WAIT_MS)
}

export const isSlowDown = (status: number | undefined): boolean => status === 429
