// What someone types to find a person in Discover: a name, a path alias, a Flickr id (12345678@N00) or any Flickr link to their page or one of their photos.

export type DiscoverQuery = { kind: 'nsid'; nsid: string } | { kind: 'name'; name: string }

export function parseDiscoverQuery(raw: string): DiscoverQuery {
  const q = raw.trim()
  const link = /^(?:https?:\/\/)?(?:www\.)?flickr\.com\/(?:photos|people)\/([^/?#]+)/i.exec(q)
  const piece = link ? link[1] : q.replace(/\/+$/, '')
  let name = piece
  try { name = decodeURIComponent(piece) } catch { /* not valid percent-coding: keep it as typed */ }
  return /^\d+@N\d+$/i.test(name) ? { kind: 'nsid', nsid: name } : { kind: 'name', name }
}
