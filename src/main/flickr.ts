import axios from 'axios'
import { FLICKR_API_KEY } from './config'
import { getOAuthHeader } from './auth'
import type { FlickrTokenData, FlickrUser, FlickrPhoto, PhotoPage, PhotoSize, PhotoInfo, FlickrAlbum, AlbumPage, FlickrCollection, FlickrSet } from '../shared/types'

const FLICKR_API_BASE = 'https://www.flickr.com/services/rest/'
const USER_AGENT = 'FlickrFetch/0.1.0 (Electron desktop app; https://github.com/flickrfetch)'
const DEFAULT_AVATAR = 'https://www.flickr.com/images/buddyicon.gif'

interface FlickrPersonResponse {
  id: string
  nsid: string
  iconfarm: number
  iconserver: string
}

function buildAvatarUrl(person: FlickrPersonResponse): string {
  if (!person.iconserver || person.iconserver === '0') {
    return DEFAULT_AVATAR
  }
  return `https://farm${person.iconfarm}.staticflickr.com/${person.iconserver}/buddyicons/${person.nsid}.jpg`
}

export async function getUserInfo(tokenData: FlickrTokenData): Promise<FlickrUser> {
  // We already have name and NSID from the OAuth token exchange.
  // Only call getInfo to get the avatar URL — fall back to default if it fails.
  let avatarUrl = DEFAULT_AVATAR

  try {
    // Build the URL as a single string so the same URL is used for both
    // the OAuth signature calculation and the actual HTTP request.
    const url =
      `${FLICKR_API_BASE}` +
      `?method=flickr.people.getInfo` +
      `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
      `&user_id=${encodeURIComponent(tokenData.nsid)}` +
      `&format=json` +
      `&nojsoncallback=1`

    // DEBUG
    process.stderr.write(`[flickrfetch] getInfo url: ${url}\n`)

    const authHeader = getOAuthHeader(url, 'GET', tokenData)
    const response = await axios.get(url, {
      headers: { ...authHeader, 'User-Agent': USER_AGENT }
    })

    process.stderr.write(`[flickrfetch] getInfo stat: ${response.data.stat}\n`)
    process.stderr.write(`[flickrfetch] getInfo response: ${JSON.stringify(response.data).substring(0, 400)}\n`)

    if (response.data.stat === 'ok') {
      avatarUrl = buildAvatarUrl(response.data.person)
    }
  } catch (err) {
    process.stderr.write(`[flickrfetch] getInfo failed, using default avatar: ${err}\n`)
  }

  return {
    nsid: tokenData.nsid,
    username: tokenData.username,
    realname: tokenData.realname,
    avatarUrl
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

  return {
    id: photo.id,
    title: photo.title?._content ?? '',
    description: photo.description?._content ?? '',
    tags,
    dateTaken,
    latitude,
    longitude,
    ownerName: photo.owner?.realname || photo.owner?.username || ''
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

export async function getAlbumPhotos(albumId: string, tokenData: FlickrTokenData, page: number = 1): Promise<PhotoPage> {
  const url =
    `${FLICKR_API_BASE}` +
    `?method=flickr.photosets.getPhotos` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&photoset_id=${encodeURIComponent(albumId)}` +
    `&user_id=${encodeURIComponent(tokenData.nsid)}` +
    `&extras=${encodeURIComponent('url_q,date_taken,date_upload,media,ispublic,isfriend,isfamily')}` +
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
    dateTaken: p.datetaken || '',
    media: (p.media === 'video' ? 'video' : 'photo') as 'photo' | 'video',
    datePosted: p.dateupload || undefined,
    ispublic: p.ispublic != null ? Number(p.ispublic) : undefined,
    isfriend: p.isfriend != null ? Number(p.isfriend) : undefined,
    isfamily: p.isfamily != null ? Number(p.isfamily) : undefined
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
    collections: subCollections.map(parseCollection),
    sets: sets.map((s): FlickrSet => ({
      id: String(s.id),
      title: String(s.title ?? 'Untitled'),
      description: String(s.description ?? '')
    }))
  }
}

// Walk a collection tree and fill in iconUrl from the cover map (first set in each collection)
function enrichCollectionCovers(collections: FlickrCollection[], coverMap: Map<string, string>): FlickrCollection[] {
  return collections.map((col) => {
    const firstSetCover = col.sets.length > 0 ? coverMap.get(col.sets[0].id) ?? '' : ''
    return {
      ...col,
      iconUrl: firstSetCover || col.iconUrl,
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

  // Fetch album covers so we can show them on collection cards instead of broken auth-gated icons
  try {
    const albumsData = await getAlbums(tokenData, 1)
    const coverMap = new Map<string, string>(albumsData.albums.map((a) => [a.id, a.coverPhotoUrl]))
    return enrichCollectionCovers(tree, coverMap)
  } catch {
    return tree
  }
}

export async function getPhotos(tokenData: FlickrTokenData, page: number = 1, sort: string = 'date-posted-desc'): Promise<PhotoPage> {
  const url =
    `${FLICKR_API_BASE}` +
    `?method=flickr.people.getPhotos` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&user_id=${encodeURIComponent(tokenData.nsid)}` +
    `&extras=${encodeURIComponent('url_q,date_taken,date_upload,media,ispublic,isfriend,isfamily')}` +
    `&sort=${encodeURIComponent(sort)}` +
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
    isfamily: p.isfamily != null ? Number(p.isfamily) : undefined
  }))

  return {
    photos,
    page: Number(data.page),
    pages: Number(data.pages),
    total: Number(data.total)
  }
}
