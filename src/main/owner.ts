import { loadToken } from './auth'

// The signed-in account's Flickr id, read once from the stored sign-in (it is needed to build links
// to your own photos and tags) and forgotten on sign-out.
let cached: string | null = null

export function ownerNsid(): string | null {
  if (!cached) cached = loadToken()?.nsid ?? null
  return cached
}

export function forgetOwnerNsid(): void {
  cached = null
}
