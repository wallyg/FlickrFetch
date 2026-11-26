// Who can see a photo, from Flickr's three flags. One rule, used by the grids (for the Privacy filter and the badge) and by the album download,
// so "Friends & Family" on screen is the same set of photos the download takes.
export type PrivacyLevel = 'public' | 'friends' | 'family' | 'friendsFamily' | 'private'

export function privacyLevelOf(photo: { ispublic?: number; isfriend?: number; isfamily?: number }): PrivacyLevel {
  if (photo.ispublic === undefined || photo.ispublic === 1) return 'public'   // (other people's photos come with no flags: they are public)
  if (photo.isfriend === 1 && photo.isfamily === 1) return 'friendsFamily'
  if (photo.isfriend === 1) return 'friends'
  if (photo.isfamily === 1) return 'family'
  return 'private'
}
