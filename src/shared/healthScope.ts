// Which photos the Photos checks look at (#246). Two things can be chosen in Tune checks:
//   videos      "Include videos in the checks": one switch for every Photos check (default on)
//   locVideos   the No location check's own video choice: follow the switch, always include videos, or leave them out
//   locPrivacy  the No location check's own privacy choice: all, public only, or not public only
// Anything missing or unrecognised falls back to the default, and the SQL pieces below only ever come from these fixed choices.

export type LocVideos = 'same' | 'include' | 'leave'
export type LocPrivacy = 'all' | 'public' | 'notPublic'

export interface HealthScope { videos: boolean; locVideos: LocVideos; locPrivacy: LocPrivacy }

export const DEFAULT_SCOPE: HealthScope = { videos: true, locVideos: 'same', locPrivacy: 'all' }

export function normalizeScope(raw: unknown): HealthScope {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    videos: r.videos === false ? false : true,
    locVideos: r.locVideos === 'include' || r.locVideos === 'leave' ? r.locVideos : 'same',
    locPrivacy: r.locPrivacy === 'public' || r.locPrivacy === 'notPublic' ? r.locPrivacy : 'all'
  }
}

/** Are videos looked at by this check? (The No location check, id 'location', can have its own answer.) */
export function includesVideos(condition: string, scope: HealthScope): boolean {
  if (condition === 'location') return scope.locVideos === 'include' || (scope.locVideos === 'same' && scope.videos)
  return scope.videos
}

/** The extra " AND ..." that narrows one check to the chosen photos, on a photo_meta row aliased p. The media column reads 'photo' until a
 * Rebuild has read it, so leaving videos out then changes nothing; privacy is ignored until the library list has saved it (catalog false). */
export function scopeSql(condition: string, scope: HealthScope, catalog: boolean): string {
  let sql = ''
  if (!includesVideos(condition, scope)) sql += " AND COALESCE(p.media, 'photo') <> 'video'"
  if (condition === 'location' && catalog) {
    if (scope.locPrivacy === 'public') sql += ' AND p.privacy = 0'
    else if (scope.locPrivacy === 'notPublic') sql += ' AND p.privacy <> 0'
  }
  return sql
}
