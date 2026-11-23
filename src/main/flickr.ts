import axios from 'axios'
import { FLICKR_API_KEY } from './config'
import { getOAuthHeader } from './auth'
import { cleanTag, foldAccents } from '../shared/tags'
import type { FlickrTokenData, FlickrUser, FlickrPhoto, PhotoPage, PhotoSize, PhotoInfo, FlickrAlbum, AlbumPage, FlickrCollection, FlickrSet, CameraExif, PhotoSearchParams, DiscoverUser, DiscoverContact, DiscoverGroup } from '../shared/types'

const FLICKR_API_BASE = 'https://www.flickr.com/services/rest/'
const USER_AGENT = 'FlickrFetch/0.1.0 (Electron desktop app; https://github.com/flickrfetch)'
const DEFAULT_AVATAR = 'https://www.flickr.com/images/buddyicon.gif'

interface FlickrPersonResponse {
  id: string
  nsid: string
  iconfarm: number
  iconserver: string
  ispro: number
  datecreate?: string
  photos?: { firstdate?: string | { _content: string }; firstdatetaken?: string; count?: number }
}

function buildAvatarUrl(person: FlickrPersonResponse): string {
  if (!person.iconserver || person.iconserver === '0') {
    return DEFAULT_AVATAR
  }
  return `https://farm${person.iconfarm}.staticflickr.com/${person.iconserver}/buddyicons/${person.nsid}.jpg`
}

export async function getUserInfo(tokenData: FlickrTokenData): Promise<FlickrUser> {
  let avatarUrl = DEFAULT_AVATAR
  let isPro = false
  let memberSince = new Date().getFullYear()

  try {
    const url =
      `${FLICKR_API_BASE}` +
      `?method=flickr.people.getInfo` +
      `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
      `&user_id=${encodeURIComponent(tokenData.nsid)}` +
      `&format=json` +
      `&nojsoncallback=1`

    const authHeader = getOAuthHeader(url, 'GET', tokenData)
    const response = await axios.get(url, {
      headers: { ...authHeader, 'User-Agent': USER_AGENT }
    })

    if (response.data.stat === 'ok') {
      const person: FlickrPersonResponse = response.data.person
      avatarUrl = buildAvatarUrl(person)
      isPro = person.ispro === 1
      const rawDate = person.datecreate || person.photos?.firstdate
      const dateTs = rawDate && typeof rawDate === 'object' ? rawDate._content : rawDate
      if (dateTs && dateTs !== '0') {
        memberSince = new Date(parseInt(dateTs, 10) * 1000).getFullYear()
      }
    }
  } catch {
    // fall through with defaults
  }

  return {
    nsid: tokenData.nsid,
    username: tokenData.username,
    realname: tokenData.realname,
    avatarUrl,
    isPro,
    memberSince
  }
}

export async function getPhotoInfo(photoId: string, tokenData: FlickrTokenData): Promise<PhotoInfo> {
  const url =
    `${FLICKR_API_BASE}` +
    `?method=flickr.photos.getInfo` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&photo_id=${encodeURIComponent(photoId)}` +
    `&format=json` +
    `&nojsoncallback=1`

  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, {
    headers: { ...authHeader, 'User-Agent': USER_AGENT }
  })

  if (response.data.stat !== 'ok') {
    throw new Error(`Flickr API error: ${response.data.message ?? 'unknown error'}`)
  }

  const photo = response.data.photo

  // Tags: filter out machine tags (Flickr internal), use raw (user-typed) value
  const rawTags = photo.tags?.tag
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags
        .filter((t: { machine_tag: number }) => !t.machine_tag)
        .map((t: { raw: string }) => t.raw)
    : []

  // Date: skip if Flickr marked it as unknown
  const dateTaken =
    photo.dates?.takenunknown === '1' ? null : (photo.dates?.taken ?? null)

  // GPS: only if both coords are present and valid
  let latitude: number | null = null
  let longitude: number | null = null
  if (photo.location?.latitude != null && photo.location?.longitude != null) {
    const lat = parseFloat(photo.location.latitude)
    const lon = parseFloat(photo.location.longitude)
    if (!isNaN(lat) && !isNaN(lon)) {
      latitude = lat
      longitude = lon
    }
  }

  const isPrivate =
    photo.visibility?.ispublic === 0 &&
    photo.visibility?.isfriend === 0 &&
    photo.visibility?.isfamily === 0

  let locationName: string | undefined
  if (photo.location) {
    const seen = new Set<string>()
    const parts: string[] = []
    for (const field of ['locality', 'region', 'country']) {
      const val: string | undefined = photo.location[field]?._content
      if (val && !seen.has(val)) { seen.add(val); parts.push(val) }
    }
    if (parts.length > 0) locationName = parts.join(', ')
  }

  return {
    id: photo.id,
    title: photo.title?._content ?? '',
    description: photo.description?._content ?? '',
    tags,
    dateTaken,
    latitude,
    longitude,
    locationName,
    ownerName: photo.owner?.realname || photo.owner?.username || '',
    ownerPathAlias: photo.owner?.path_alias || photo.owner?.nsid || '',
    license: photo.license ?? '0',
    isPrivate,
  }
}

// Follow Flickr's video redirect chain and return the final streamable CDN URL.
// Flickr "play" URLs redirect to vp.flickr.com with the secret as implicit auth.
// We fetch only bytes 0-0 so we don't download the video, just resolve the final URL.
export async function resolveVideoUrl(sourceUrl: string): Promise<string> {
  try {
    const response = await axios.get(sourceUrl, {
      maxRedirects: 10,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Range': 'bytes=0-0',
      },
      validateStatus: (s) => s < 400 || s === 416,
    })
    const finalUrl = (response.request as { res?: { responseUrl?: string } })?.res?.responseUrl
    return finalUrl ?? sourceUrl
  } catch {
    return sourceUrl
  }
}

export async function getPhotoSizes(photoId: string, tokenData: FlickrTokenData): Promise<PhotoSize[]> {
  const url =
    `${FLICKR_API_BASE}` +
    `?method=flickr.photos.getSizes` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&photo_id=${encodeURIComponent(photoId)}` +
    `&format=json` +
    `&nojsoncallback=1`

  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, {
    headers: { ...authHeader, 'User-Agent': USER_AGENT }
  })

  if (response.data.stat !== 'ok') {
    throw new Error(`Flickr API error: ${response.data.message ?? 'unknown error'}`)
  }

  return (response.data.sizes.size as Record<string, string>[]).map((s) => ({
    label: s.label,
    width: Number(s.width),
    height: Number(s.height),
    source: s.source,
    media: (s.media === 'video' ? 'video' : 'photo') as 'photo' | 'video'
  }))
}

export async function getAlbums(tokenData: FlickrTokenData, page: number = 1): Promise<AlbumPage> {
  const url =
    `${FLICKR_API_BASE}` +
    `?method=flickr.photosets.getList` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&user_id=${encodeURIComponent(tokenData.nsid)}` +
    `&primary_photo_extras=${encodeURIComponent('url_q')}` +
    `&per_page=500` +
    `&page=${page}` +
    `&format=json` +
    `&nojsoncallback=1`

  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, {
    headers: { ...authHeader, 'User-Agent': USER_AGENT }
  })

  if (response.data.stat !== 'ok') {
    throw new Error(`Flickr API error: ${response.data.message ?? 'unknown error'}`)
  }

  const data = response.data.photosets
  const albums = (data.photoset as Record<string, unknown>[]).map((s) => {
    const extras = s.primary_photo_extras as Record<string, string> | undefined
    const server = s.server as string
    const primary = s.primary as string
    const secret = s.secret as string
    const coverPhotoUrl = extras?.url_q
      ?? `https://live.staticflickr.com/${server}/${primary}_${secret}_q.jpg`
    const title = (s.title as { _content: string })?._content ?? 'Untitled'
    const description = (s.description as { _content: string })?._content ?? ''
    return {
      id: String(s.id),
      title,
      description,
      photoCount: Number(s.photos),
      videoCount: Number(s.videos ?? 0),
      coverPhotoUrl
    }
  })

  return {
    albums,
    page: Number(data.page),
    pages: Number(data.pages),
    total: Number(data.total)
  }
}

export async function getPublicAlbumPhotos(albumId: string, ownerNsid: string, tokenData: FlickrTokenData, page: number = 1): Promise<PhotoPage> {
  const url =
    `${FLICKR_API_BASE}` +
    `?method=flickr.photosets.getPhotos` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&photoset_id=${encodeURIComponent(albumId)}` +
    `&user_id=${encodeURIComponent(ownerNsid)}` +
    `&extras=${encodeURIComponent('url_q,url_m,date_taken,date_upload,last_update,media,tags,license')}` +
    `&per_page=100` +
    `&page=${page}` +
    `&format=json` +
    `&nojsoncallback=1`

  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, {
    headers: { ...authHeader, 'User-Agent': USER_AGENT }
  })

  if (response.data.stat !== 'ok') {
    throw new Error(`Flickr API error: ${response.data.message ?? 'unknown error'}`)
  }

  const data = response.data.photoset
  const photos: FlickrPhoto[] = (data.photo as Record<string, string>[]).map((p) => ({
    id: p.id,
    title: p.title || 'Untitled',
    thumbnailUrl: p.url_q || '',
    url_m: p.url_m || undefined,
    width_m: p.width_m ? Number(p.width_m) : undefined,
    height_m: p.height_m ? Number(p.height_m) : undefined,
    dateTaken: p.datetaken || '',
    media: (p.media === 'video' ? 'video' : 'photo') as 'photo' | 'video',
    tags: p.tags ? (p.tags as string).split(' ').filter(Boolean) : [],
    lastUpdate: p.lastupdate ? Number(p.lastupdate) : undefined,
    license: p.license,
  }))

  return { photos, page: Number(data.page), pages: Number(data.pages), total: Number(data.total) }
}

export async function getAlbumPhotos(albumId: string, tokenData: FlickrTokenData, page: number = 1, mediaType?: 'photo' | 'video'): Promise<PhotoPage> {
  const mediaParam = mediaType ? `&media=${mediaType === 'photo' ? 'photos' : 'videos'}` : ''
  const url =
    `${FLICKR_API_BASE}` +
    `?method=flickr.photosets.getPhotos` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&photoset_id=${encodeURIComponent(albumId)}` +
    `&user_id=${encodeURIComponent(tokenData.nsid)}` +
    `&extras=${encodeURIComponent('url_q,url_m,date_taken,date_upload,last_update,media,ispublic,isfriend,isfamily,tags,license')}` +
    `&per_page=100` +
    `&page=${page}` +
    `${mediaParam}` +
    `&format=json` +
    `&nojsoncallback=1`

  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, {
    headers: { ...authHeader, 'User-Agent': USER_AGENT }
  })

  if (response.data.stat !== 'ok') {
    throw new Error(`Flickr API error: ${response.data.message ?? 'unknown error'}`)
  }

  const data = response.data.photoset
  const photos: FlickrPhoto[] = (data.photo as Record<string, string>[]).map((p) => ({
    id: p.id,
    title: p.title || 'Untitled',
    thumbnailUrl: p.url_q || '',
    url_m: p.url_m || undefined,
    width_m: p.width_m ? Number(p.width_m) : undefined,
    height_m: p.height_m ? Number(p.height_m) : undefined,
    dateTaken: p.datetaken || '',
    media: (p.media === 'video' ? 'video' : 'photo') as 'photo' | 'video',
    datePosted: p.dateupload || undefined,
    ispublic: p.ispublic != null ? Number(p.ispublic) : undefined,
    isfriend: p.isfriend != null ? Number(p.isfriend) : undefined,
    isfamily: p.isfamily != null ? Number(p.isfamily) : undefined,
    tags: p.tags ? (p.tags as string).split(' ').filter(Boolean) : [],
    lastUpdate: p.lastupdate ? Number(p.lastupdate) : undefined,
    license: p.license,
  }))

  return {
    photos,
    page: Number(data.page),
    pages: Number(data.pages),
    total: Number(data.total)
  }
}

function parseCollection(raw: Record<string, unknown>): FlickrCollection {
  const subCollections = (raw.collection as Record<string, unknown>[] | undefined) ?? []
  const sets = (raw.set as Record<string, unknown>[] | undefined) ?? []
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    iconUrl: String(raw.iconlarge ?? raw.iconsmall ?? ''),
    coverUrls: [],
    collections: subCollections.map(parseCollection),
    sets: sets.map((s): FlickrSet => ({
      id: String(s.id),
      title: String(s.title ?? 'Untitled'),
      description: String(s.description ?? '')
    }))
  }
}

// Walk a collection tree and fill in iconUrl + coverUrls from the cover map.
// For sub-collections: take one cover from each sub-collection first (spread),
// so the mosaic represents different sub-collections rather than 4 from the same one.
function collectCovers(col: FlickrCollection, coverMap: Map<string, string>, limit: number): string[] {
  const urls: string[] = []

  // Direct sets first
  for (const s of col.sets) {
    if (urls.length >= limit) break
    const url = coverMap.get(s.id)
    if (url) urls.push(url)
  }

  if (urls.length >= limit) return urls

  // One from each sub-collection (spread), then fill extras
  const subFirsts = col.collections
    .map(sub => collectCovers(sub, coverMap, limit)[0])
    .filter((u): u is string => u !== undefined)

  for (const url of subFirsts) {
    if (urls.length >= limit) break
    urls.push(url)
  }

  return urls
}

function enrichCollectionCovers(collections: FlickrCollection[], coverMap: Map<string, string>): FlickrCollection[] {
  return collections.map((col) => {
    const coverUrls = collectCovers(col, coverMap, 4)
    const firstCover = coverUrls[0] ?? ''
    return {
      ...col,
      iconUrl: firstCover || col.iconUrl,
      coverUrls,
      sets: col.sets.map((s) => ({ ...s, coverPhotoUrl: coverMap.get(s.id) ?? '' })),
      collections: enrichCollectionCovers(col.collections, coverMap)
    }
  })
}

export async function getCollectionTree(tokenData: FlickrTokenData): Promise<FlickrCollection[]> {
  const treeUrl =
    `${FLICKR_API_BASE}` +
    `?method=flickr.collections.getTree` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&user_id=${encodeURIComponent(tokenData.nsid)}` +
    `&format=json` +
    `&nojsoncallback=1`

  const authHeader = getOAuthHeader(treeUrl, 'GET', tokenData)
  const response = await axios.get(treeUrl, {
    headers: { ...authHeader, 'User-Agent': USER_AGENT }
  })

  if (response.data.stat !== 'ok') {
    throw new Error(`Flickr API error: ${response.data.message ?? 'unknown error'}`)
  }

  const topLevel = (response.data.collections?.collection as Record<string, unknown>[] | undefined) ?? []
  const tree = topLevel.map(parseCollection)

  // Fetch album covers so we can show them on collection cards and sets
  try {
    const first = await getAlbums(tokenData, 1)
    const allAlbums = [...first.albums]
    for (let p = 2; p <= first.pages; p++) {
      const next = await getAlbums(tokenData, p)
      allAlbums.push(...next.albums)
    }
    const coverMap = new Map<string, string>(allAlbums.map((a) => [a.id, a.coverPhotoUrl]))
    return enrichCollectionCovers(tree, coverMap)
  } catch {
    return tree
  }
}

// Flickr's tag search cannot find tags typed with some accented letters (é, ã, ñ, ç…) when it is
// given the accented spelling: "québec" returns nothing while "quebec" finds the photos. Tags with
// macrons (ō) or non-Latin letters (日本) are found as typed. So each accented tag in a search is
// checked once (a one-photo probe) and, if Flickr doesn't understand it as typed, sent without its
// accents. The answer is remembered for half an hour and forgotten after a tag rescan. The plain-letter
// search also returns photos tagged with the plain spelling ("Montreal" as well as "Montréal"), so those
// searches ask for each photo's tags and the extras are dropped again here, leaving exactly the photos
// that carry the tags that were asked for.
const FOLD_MEMORY_MS = 30 * 60 * 1000
const foldChoice = new Map<string, { folded: boolean; at: number }>()   // "owner|tag" -> sent without accents?
const droppedExtras = new Map<string, number>()

export function clearTagSearchMemory(): void {
  foldChoice.clear()
  droppedExtras.clear()
}

export async function signedGet(url: string, tokenData: FlickrTokenData): Promise<{ data: Record<string, any> }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  return axios.get(url, { headers: { ...authHeader, 'User-Agent': USER_AGENT }, timeout: 30000 })
}

async function searchUnderstandsTag(tokenData: FlickrTokenData, ownerId: string, tag: string): Promise<boolean> {
  const url = `${FLICKR_API_BASE}?method=flickr.photos.search` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}&user_id=${encodeURIComponent(ownerId)}` +
    `&tags=${encodeURIComponent(tag)}&per_page=1&format=json&nojsoncallback=1`
  const r = await signedGet(url, tokenData)
  return r.data.stat === 'ok' && Number(r.data.photos?.total) > 0
}

// Decide, tag by tag, which spelling to send. `folded` is true when any tag was sent without accents.
async function resolveTagQuery(tokenData: FlickrTokenData, ownerId: string, tagQuery: string | undefined): Promise<{ query: string | undefined; folded: boolean }> {
  if (!tagQuery) return { query: tagQuery, folded: false }
  const sent: string[] = []
  let folded = false
  for (const tag of tagQuery.split(',').map(t => t.trim()).filter(Boolean)) {
    const plain = foldAccents(tag)
    if (plain === tag) { sent.push(tag); continue }
    const key = `${ownerId}|${tag}`
    let choice = foldChoice.get(key)
    if (!choice || Date.now() - choice.at > FOLD_MEMORY_MS) {
      choice = { folded: !(await searchUnderstandsTag(tokenData, ownerId, tag)), at: Date.now() }
      foldChoice.set(key, choice)
    }
    if (choice.folded) { sent.push(plain); folded = true } else sent.push(tag)
  }
  return folded ? { query: sent.join(','), folded } : { query: tagQuery, folded: false }
}

interface TagSearchResult { response: { data: Record<string, any> }; folded: boolean } // eslint-disable-line @typescript-eslint/no-explicit-any

// buildUrl(tags, withTags): withTags asks Flickr to include each photo's tags (needed to trim extras)
async function searchWithTagFallback(
  tokenData: FlickrTokenData, ownerId: string, tagQuery: string | undefined, buildUrl: (tags: string | undefined, withTags: boolean) => string
): Promise<TagSearchResult> {
  const { query, folded } = await resolveTagQuery(tokenData, ownerId, tagQuery)
  return { response: await signedGet(buildUrl(query, folded), tokenData), folded }
}

// Keep only photos that really carry the requested tag(s); returns the total Flickr should be
// reported with, which settles on the exact figure once every page has been read.
function trimToRequestedTags<T extends Record<string, string>>(
  records: T[], search: PhotoSearchParams | undefined, sort: string, page: number, flickrTotal: number, folded: boolean
): { records: T[]; total: number } {
  if (!folded || !search?.tagQuery) return { records, total: flickrTotal }
  const wanted = search.tagQuery.split(',').map(cleanTag).filter(Boolean)
  const kept = records.filter(r => {
    const have = new Set((r.tags ?? '').split(' ').filter(Boolean).map(cleanTag))
    return search.tagMode === 'all' ? wanted.every(t => have.has(t)) : wanted.some(t => have.has(t))
  })
  const key = JSON.stringify([search, sort])
  if (droppedExtras.size > 100) droppedExtras.clear()
  const dropped = (page === 1 ? 0 : droppedExtras.get(key) ?? 0) + (records.length - kept.length)
  droppedExtras.set(key, dropped)
  return { records: kept, total: Math.max(flickrTotal - dropped, kept.length) }
}

export async function getPhotos(tokenData: FlickrTokenData, page: number = 1, sort: string = 'date-posted-desc', search?: PhotoSearchParams): Promise<PhotoPage> {
  // Flickr's plain "my photos" call cannot rank by interestingness; its search call can
  const useSearch = !!(search?.query || search?.tagQuery || search?.dateMin || search?.dateMax) || sort.startsWith('interestingness')

  const buildUrl = (tagQuery: string | undefined, withTags: boolean): string => {
    let url: string
    if (useSearch) {
      url =
        `${FLICKR_API_BASE}` +
        `?method=flickr.photos.search` +
        `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
        `&user_id=${encodeURIComponent(tokenData.nsid)}` +
        `&extras=${encodeURIComponent('url_q,url_m,date_taken,date_upload,last_update,media,ispublic,isfriend,isfamily,license' + (withTags ? ',tags' : ''))}` +
        `&sort=${encodeURIComponent(sort)}` +
        `&per_page=100` +
        `&page=${page}` +
        `&format=json` +
        `&nojsoncallback=1`

      if (search?.query) {
        url += `&text=${encodeURIComponent(search.query)}`
      }
      if (tagQuery) {
        url += `&tags=${encodeURIComponent(tagQuery)}&tag_mode=${search?.tagMode ?? 'any'}`
      }
      if (search?.dateField === 'taken') {
        if (search?.dateMin) url += `&min_taken_date=${encodeURIComponent(search.dateMin)}`
        if (search?.dateMax) url += `&max_taken_date=${encodeURIComponent(search.dateMax + ' 23:59:59')}`
      } else if (search?.dateField === 'posted') {
        if (search?.dateMin) {
          const ts = Math.floor(new Date(search.dateMin).getTime() / 1000)
          url += `&min_upload_date=${ts}`
        }
        if (search?.dateMax) {
          const ts = Math.floor(new Date(search.dateMax + 'T23:59:59').getTime() / 1000)
          url += `&max_upload_date=${ts}`
        }
      }
    } else {
      url =
        `${FLICKR_API_BASE}` +
        `?method=flickr.people.getPhotos` +
        `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
        `&user_id=${encodeURIComponent(tokenData.nsid)}` +
        `&extras=${encodeURIComponent('url_q,url_m,date_taken,date_upload,last_update,media,ispublic,isfriend,isfamily,license')}` +
        `&sort=${encodeURIComponent(sort)}` +
        `&per_page=100` +
        `&page=${page}` +
        `&format=json` +
        `&nojsoncallback=1`
    }
    return url
  }

  const { response, folded } = await searchWithTagFallback(tokenData, tokenData.nsid, search?.tagQuery, buildUrl)

  if (response.data.stat !== 'ok') {
    throw new Error(`Flickr API error: ${response.data.message ?? 'unknown error'}`)
  }

  const data = response.data.photos
  const trimmed = trimToRequestedTags(data.photo as Record<string, string>[], search, sort, page, Number(data.total), folded)
  let photos: FlickrPhoto[] = trimmed.records.map((p) => ({
    id: p.id,
    title: p.title || 'Untitled',
    thumbnailUrl: p.url_q || '',
    url_m: p.url_m || undefined,
    width_m: p.width_m ? Number(p.width_m) : undefined,
    height_m: p.height_m ? Number(p.height_m) : undefined,
    dateTaken: p.datetaken || '',
    media: (p.media === 'video' ? 'video' : 'photo') as 'photo' | 'video',
    datePosted: p.dateupload || undefined,
    ispublic: p.ispublic != null ? Number(p.ispublic) : undefined,
    isfriend: p.isfriend != null ? Number(p.isfriend) : undefined,
    isfamily: p.isfamily != null ? Number(p.isfamily) : undefined,
    lastUpdate: p.lastupdate ? Number(p.lastupdate) : undefined,
    license: p.license,
  }))

  // Client-side title operator filtering (starts/ends/exact send broader server query, then narrow by title)
  if (search?.query && search.operator && search.operator !== 'contains') {
    const q = search.query.toLowerCase()
    photos = photos.filter(p => {
      const t = p.title.toLowerCase()
      if (search.operator === 'starts') return t.startsWith(q)
      if (search.operator === 'ends') return t.endsWith(q)
      if (search.operator === 'exact') return t === q
      return true
    })
  }

  return {
    photos,
    page: Number(data.page),
    pages: Number(data.pages),
    total: trimmed.total
  }
}

export async function getPhotoExif(photoId: string, tokenData: FlickrTokenData): Promise<CameraExif> {
  const url =
    `${FLICKR_API_BASE}` +
    `?method=flickr.photos.getExif` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&photo_id=${encodeURIComponent(photoId)}` +
    `&format=json` +
    `&nojsoncallback=1`

  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, {
    headers: { ...authHeader, 'User-Agent': USER_AGENT }
  })

  if (response.data.stat !== 'ok') return {}

  const photo = response.data.photo
  const result: CameraExif = {}

  if (photo.camera) result.camera = String(photo.camera)

  const exifList: Array<{ tag: string; raw?: { _content: string }; clean?: { _content: string } }> =
    Array.isArray(photo.exif) ? photo.exif : []

  for (const entry of exifList) {
    const val = entry.clean?._content || entry.raw?._content
    if (!val) continue
    const tag = entry.tag
    if (!result.lens && (tag === 'LensModel' || tag === 'Lens' || tag === 'LensInfo')) {
      result.lens = val
    } else if (!result.aperture && (tag === 'FNumber' || tag === 'Aperture')) {
      result.aperture = val.startsWith('f/') || val.startsWith('F/') ? val : `f/${val}`
    } else if (!result.shutterSpeed && (tag === 'ExposureTime' || tag === 'ShutterSpeedValue')) {
      result.shutterSpeed = val
    } else if (!result.iso && (tag === 'ISO' || tag === 'ISOSpeedRatings')) {
      result.iso = val
    } else if (!result.focalLength && tag === 'FocalLength') {
      result.focalLength = val
    }
  }

  return result
}

// ---- Discover ----

function buildAvatarUrlFromParts(nsid: string, iconfarm: string | number, iconserver: string): string {
  if (iconfarm && iconserver && iconserver !== '0') {
    return `https://farm${iconfarm}.staticflickr.com/${iconserver}/buddyicons/${nsid}.jpg`
  }
  return DEFAULT_AVATAR
}

function mapPublicPhotos(photos: Record<string, string>[]): FlickrPhoto[] {
  return photos.map(p => ({
    id: p.id,
    title: p.title || 'Untitled',
    thumbnailUrl: p.url_q || '',
    url_m: p.url_m || undefined,
    width_m: p.width_m ? Number(p.width_m) : undefined,
    height_m: p.height_m ? Number(p.height_m) : undefined,
    dateTaken: p.datetaken || '',
    media: (p.media === 'video' ? 'video' : 'photo') as 'photo' | 'video',
    datePosted: p.dateupload || undefined,
    lastUpdate: p.lastupdate ? Number(p.lastupdate) : undefined,
    tags: p.tags ? (p.tags as string).split(' ').filter(Boolean) : [],
    license: p.license,
  }))
}

export async function findDiscoverUser(query: string, tokenData: FlickrTokenData): Promise<DiscoverUser> {
  let nsid: string | null = null

  // Try flickr.urls.lookupUser (handles path aliases and URL input)
  try {
    const cleanQuery = query.trim().replace(/^https?:\/\/www\.flickr\.com\/photos\//i, '').replace(/\/$/, '')
    const lookupUrl = `${FLICKR_API_BASE}?method=flickr.urls.lookupUser` +
      `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
      `&url=${encodeURIComponent('https://www.flickr.com/photos/' + encodeURIComponent(cleanQuery) + '/')}` +
      `&format=json&nojsoncallback=1`
    const authHeader = getOAuthHeader(lookupUrl, 'GET', tokenData)
    const r = await axios.get(lookupUrl, { headers: { ...authHeader, 'User-Agent': USER_AGENT } })
    if (r.data.stat === 'ok') nsid = r.data.user.id
  } catch { /* fall through */ }

  // Fall back to flickr.people.findByUsername
  if (!nsid) {
    const findUrl = `${FLICKR_API_BASE}?method=flickr.people.findByUsername` +
      `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
      `&username=${encodeURIComponent(query.trim())}` +
      `&format=json&nojsoncallback=1`
    const authHeader = getOAuthHeader(findUrl, 'GET', tokenData)
    const r = await axios.get(findUrl, { headers: { ...authHeader, 'User-Agent': USER_AGENT } })
    if (r.data.stat !== 'ok') throw new Error(r.data.message ?? 'User not found')
    nsid = r.data.user.nsid
  }

  const infoUrl = `${FLICKR_API_BASE}?method=flickr.people.getInfo` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&user_id=${encodeURIComponent(nsid!)}` +
    `&format=json&nojsoncallback=1`
  const authHeader2 = getOAuthHeader(infoUrl, 'GET', tokenData)
  const r2 = await axios.get(infoUrl, { headers: { ...authHeader2, 'User-Agent': USER_AGENT } })
  if (r2.data.stat !== 'ok') throw new Error(r2.data.message ?? 'Could not get user info')

  const person = r2.data.person
  return {
    nsid: nsid!,
    username: person.username._content || '',
    realname: person.realname?._content || '',
    avatarUrl: buildAvatarUrlFromParts(nsid!, person.iconfarm, person.iconserver),
    photoCount: person.photos?.count?._content ? Number(person.photos.count._content) : undefined,
  }
}

export async function getDiscoverCollectionTree(nsid: string, tokenData: FlickrTokenData): Promise<FlickrCollection[]> {
  const treeUrl =
    `${FLICKR_API_BASE}` +
    `?method=flickr.collections.getTree` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&user_id=${encodeURIComponent(nsid)}` +
    `&format=json` +
    `&nojsoncallback=1`

  const authHeader = getOAuthHeader(treeUrl, 'GET', tokenData)
  const response = await axios.get(treeUrl, {
    headers: { ...authHeader, 'User-Agent': USER_AGENT }
  })

  if (response.data.stat !== 'ok') {
    throw new Error(`Flickr API error: ${response.data.message ?? 'unknown error'}`)
  }

  const topLevel = (response.data.collections?.collection as Record<string, unknown>[] | undefined) ?? []
  const tree = topLevel.map(parseCollection)

  try {
    const first = await getUserPublicAlbums(nsid, tokenData, 1)
    const allAlbums = [...first.albums]
    for (let p = 2; p <= first.pages; p++) {
      const next = await getUserPublicAlbums(nsid, tokenData, p)
      allAlbums.push(...next.albums)
    }
    const coverMap = new Map<string, string>(allAlbums.map((a) => [a.id, a.coverPhotoUrl]))
    return enrichCollectionCovers(tree, coverMap)
  } catch {
    return tree
  }
}

export async function getPublicPhotos(nsid: string, tokenData: FlickrTokenData, page: number = 1, sort: string = 'date-posted-desc', search?: PhotoSearchParams): Promise<PhotoPage> {
  const buildUrl = (tagQuery: string | undefined, withTags: boolean): string => {
    let url = `${FLICKR_API_BASE}?method=flickr.photos.search` +
      `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
      `&user_id=${encodeURIComponent(nsid)}` +
      `&extras=${encodeURIComponent('url_q,url_m,date_taken,date_upload,last_update,media,license' + (withTags ? ',tags' : ''))}` +
      `&sort=${encodeURIComponent(sort)}` +
      `&per_page=100&page=${page}&format=json&nojsoncallback=1`

    if (search?.query) url += `&text=${encodeURIComponent(search.query)}`
    if (tagQuery) url += `&tags=${encodeURIComponent(tagQuery)}&tag_mode=${search?.tagMode ?? 'any'}`
    if (search?.dateField === 'taken') {
      if (search?.dateMin) url += `&min_taken_date=${encodeURIComponent(search.dateMin)}`
      if (search?.dateMax) url += `&max_taken_date=${encodeURIComponent(search.dateMax + ' 23:59:59')}`
    } else if (search?.dateField === 'posted') {
      if (search?.dateMin) url += `&min_upload_date=${Math.floor(new Date(search.dateMin + 'T00:00:00').getTime() / 1000)}`
      if (search?.dateMax) url += `&max_upload_date=${Math.floor(new Date(search.dateMax + 'T23:59:59').getTime() / 1000)}`
    }
    return url
  }

  const { response, folded } = await searchWithTagFallback(tokenData, nsid, search?.tagQuery, buildUrl)
  if (response.data.stat !== 'ok') throw new Error(response.data.message ?? 'unknown error')
  const data = response.data.photos
  const trimmed = trimToRequestedTags(data.photo as Record<string, string>[], search, sort, page, Number(data.total), folded)
  let photos = mapPublicPhotos(trimmed.records)

  if (search?.query && search.operator && search.operator !== 'contains') {
    const q = search.query.toLowerCase()
    photos = photos.filter(p => {
      const t = p.title.toLowerCase()
      if (search.operator === 'starts') return t.startsWith(q)
      if (search.operator === 'ends') return t.endsWith(q)
      if (search.operator === 'exact') return t === q
      return true
    })
  }

  const operatorFiltered = !!(search?.query && search.operator && search.operator !== 'contains')
  return {
    photos,
    page: Number(data.page),
    pages: operatorFiltered ? 1 : Number(data.pages),
    total: operatorFiltered ? photos.length : trimmed.total,
  }
}

export async function getUserPublicAlbums(nsid: string, tokenData: FlickrTokenData, page: number = 1): Promise<AlbumPage> {
  const url = `${FLICKR_API_BASE}?method=flickr.photosets.getList` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&user_id=${encodeURIComponent(nsid)}` +
    `&per_page=50&page=${page}&format=json&nojsoncallback=1`
  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, { headers: { ...authHeader, 'User-Agent': USER_AGENT } })
  if (response.data.stat !== 'ok') throw new Error(response.data.message ?? 'unknown error')
  const data = response.data.photosets
  const albums: FlickrAlbum[] = (data.photoset as Record<string, unknown>[]).map(s => ({
    id: s.id as string,
    title: (s.title as { _content: string })._content || 'Untitled',
    description: (s.description as { _content: string })._content || '',
    photoCount: Number(s.count_photos) || 0,
    videoCount: Number(s.count_videos) || 0,
    coverPhotoUrl: `https://farm${s.farm}.staticflickr.com/${s.server}/${s.primary}_${s.secret}_q.jpg`,
  }))
  return { albums, page: Number(data.page), pages: Number(data.pages), total: Number(data.total) }
}

export async function getContacts(tokenData: FlickrTokenData): Promise<DiscoverContact[]> {
  const url = `${FLICKR_API_BASE}?method=flickr.contacts.getList` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&per_page=200&format=json&nojsoncallback=1`
  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, { headers: { ...authHeader, 'User-Agent': USER_AGENT } })
  if (response.data.stat !== 'ok') throw new Error(response.data.message ?? 'unknown error')
  const contacts = response.data.contacts.contact as Record<string, string>[]
  return contacts.map(c => ({
    nsid: c.nsid,
    username: c.username || '',
    realname: c.realname || '',
    avatarUrl: buildAvatarUrlFromParts(c.nsid, c.iconfarm, c.iconserver),
  }))
}

export async function getUserGroups(tokenData: FlickrTokenData): Promise<DiscoverGroup[]> {
  const url = `${FLICKR_API_BASE}?method=flickr.people.getGroups` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&user_id=${encodeURIComponent(tokenData.nsid)}` +
    `&format=json&nojsoncallback=1`
  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, { headers: { ...authHeader, 'User-Agent': USER_AGENT } })
  if (response.data.stat !== 'ok') throw new Error(response.data.message ?? 'unknown error')
  const groups = response.data.groups.group as Record<string, unknown>[]
  return groups.map(g => ({
    id: g.id as string,
    nsid: g.nsid as string,
    name: g.name as string,
    memberCount: g.members ? Number(g.members) : undefined,
    photoCount: g.pool_count ? Number(g.pool_count) : undefined,
    iconUrl: buildAvatarUrlFromParts(g.nsid as string, g.iconfarm as number, g.iconserver as string),
  }))
}

export async function getGroupPhotos(groupId: string, tokenData: FlickrTokenData, page: number = 1): Promise<PhotoPage> {
  const url = `${FLICKR_API_BASE}?method=flickr.groups.pools.getPhotos` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&group_id=${encodeURIComponent(groupId)}` +
    `&extras=${encodeURIComponent('url_q,url_m,date_taken,date_upload,last_update,media,ownername,tags,license')}` +
    `&per_page=100&page=${page}&format=json&nojsoncallback=1`
  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, { headers: { ...authHeader, 'User-Agent': USER_AGENT } })
  if (response.data.stat !== 'ok') throw new Error(response.data.message ?? 'unknown error')
  const data = response.data.photos
  return { photos: mapPublicPhotos(data.photo), page: Number(data.page), pages: Number(data.pages), total: Number(data.total) }
}

export async function getInterestingness(tokenData: FlickrTokenData, page: number = 1): Promise<PhotoPage> {
  const url = `${FLICKR_API_BASE}?method=flickr.interestingness.getList` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&extras=${encodeURIComponent('url_q,url_m,date_taken,date_upload,last_update,media,ownername')}` +
    `&per_page=100&page=${page}&format=json&nojsoncallback=1`
  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, { headers: { ...authHeader, 'User-Agent': USER_AGENT } })
  if (response.data.stat !== 'ok') throw new Error(response.data.message ?? 'unknown error')
  const data = response.data.photos
  return { photos: mapPublicPhotos(data.photo), page: Number(data.page), pages: Number(data.pages), total: Number(data.total) }
}

export async function getRecentlyUpdated(tokenData: FlickrTokenData, minDate: number, page: number = 1): Promise<PhotoPage> {
  const url =
    `${FLICKR_API_BASE}` +
    `?method=flickr.photos.recentlyUpdated` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&min_date=${minDate}` +
    `&extras=${encodeURIComponent('url_q,date_taken,date_upload,last_update,media,ispublic,isfriend,isfamily')}` +
    `&per_page=100` +
    `&page=${page}` +
    `&format=json` +
    `&nojsoncallback=1`

  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, {
    headers: { ...authHeader, 'User-Agent': USER_AGENT }
  })

  if (response.data.stat !== 'ok') {
    throw new Error(`Flickr API error: ${response.data.message ?? 'unknown error'}`)
  }

  const data = response.data.photos
  const photos: FlickrPhoto[] = (data.photo as Record<string, string>[]).map((p) => ({
    id: p.id,
    title: p.title || 'Untitled',
    thumbnailUrl: p.url_q || '',
    dateTaken: p.datetaken || '',
    media: (p.media === 'video' ? 'video' : 'photo') as 'photo' | 'video',
    datePosted: p.dateupload || undefined,
    ispublic: p.ispublic != null ? Number(p.ispublic) : undefined,
    isfriend: p.isfriend != null ? Number(p.isfriend) : undefined,
    isfamily: p.isfamily != null ? Number(p.isfamily) : undefined,
    lastUpdate: p.lastupdate ? Number(p.lastupdate) : undefined,
  }))

  return {
    photos,
    page: Number(data.page),
    pages: Number(data.pages),
    total: Number(data.total)
  }
}
