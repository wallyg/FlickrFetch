// The words and decisions about Flickr's size limit on free accounts (#126, Phase 1). Since May 2025 a free account is offered originals and large
// sizes only up to 1024 px (Creative Commons photos and Flickr Commons are exempt), so a download that asks for the Original can come down smaller.
// Nothing here blocks a download: it only tells the owner what happened. Pro accounts never see any of it.

/** A free account is one Flickr said is not Pro. When the answer is unknown (the lookup failed), nothing is assumed, so no note is shown.
 * `pretend` is the development-only switch. */
export function isFreeAccount(isPro: boolean | undefined, pretend = false): boolean {
  return isPro === false || pretend
}

/** What the Confirm Download box says about quality and whether it adds the short note: only for a free account asking for the Original. */
export function limitNotice(isFree: boolean, downloadSize: string, qualityName: string): { quality: string; callout: string | null } {
  if (!isFree || downloadSize !== 'original') return { quality: qualityName, callout: null }
  return {
    quality: 'Original (up to 1024 px on your account)',
    callout: 'Flickr limits downloads from free accounts to 1024 px, except Creative Commons photos. Titles, tags and the other details are still saved in every file.'
  }
}

/** The part of a finished download's summary line: how many came down smaller than the Original that was asked for. Nothing when none did. */
export function smallerPart(count: number | undefined): string | null {
  const n = count ?? 0
  return n > 0 ? `${n.toLocaleString()} saved smaller than the original` : null
}

/** The small tag on a row of Download History: "Smaller size" when the Original was asked for and Flickr gave less, "Original" when it came down in full.
 * Nothing for a size the owner chose on purpose, or for a download from before sizes were recorded (3.6). */
export function sizeTag(r: { sizeLabel?: string; sizeLimited?: boolean }): 'Smaller size' | 'Original' | null {
  if (r.sizeLimited) return 'Smaller size'
  return r.sizeLabel === 'Original' ? 'Original' : null
}

/** The early notice for a free account (#255): shown once on My Flickr and once on Discover until it is dismissed. Plain and calm; Pro accounts never see it. */
export const FREE_BANNER_TEXT: Record<'mine' | 'discover', string> = {
  mine: 'Flickr limits downloads from free accounts to 1024 px, except Creative Commons photos, so some originals will come down smaller. Titles, tags and the other details are still saved in every file.',
  discover: 'On a free account, Flickr can also give you a smaller size than the original for photos downloaded here, except Creative Commons photos. Titles, tags and the other details are still saved.'
}
