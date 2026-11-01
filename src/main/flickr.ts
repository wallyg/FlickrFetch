import axios from 'axios'
import { FLICKR_API_KEY } from './config'
import { getOAuthHeader } from './auth'
import type { FlickrTokenData, FlickrUser, FlickrPhoto, PhotoPage, PhotoSize, PhotoInfo, FlickrAlbum, AlbumPage, FlickrCollection, FlickrSet, CameraExif, PhotoSearchParams } from '../shared/types'

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

export async function getAlbumPhotos(albumId: string, tokenData: FlickrTokenData, page: number = 1, mediaType?: 'photo' | 'video'): Promise<PhotoPage> {
  const mediaParam = mediaType ? `&media=${mediaType === 'photo' ? 'photos' : 'videos'}` : ''
  const url =
    `${FLICKR_API_BASE}` +
    `?method=flickr.photosets.getPhotos` +
    `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
    `&photoset_id=${encodeURIComponent(albumId)}` +
    `&user_id=${encodeURIComponent(tokenData.nsid)}` +
    `&extras=${encodeURIComponent('url_q,date_taken,date_upload,media,ispublic,isfriend,isfamily,tags')}` +
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
    dateTaken: p.datetaken || '',
    media: (p.media === 'video' ? 'video' : 'photo') as 'photo' | 'video',
    datePosted: p.dateupload || undefined,
    ispublic: p.ispublic != null ? Number(p.ispublic) : undefined,
    isfriend: p.isfriend != null ? Number(p.isfriend) : undefined,
    isfamily: p.isfamily != null ? Number(p.isfamily) : undefined,
    tags: p.tags ? (p.tags as string).split(' ').filter(Boolean) : []
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

export async function getPhotos(tokenData: FlickrTokenData, page: number = 1, sort: string = 'date-posted-desc', search?: PhotoSearchParams): Promise<PhotoPage> {
  const useSearch = !!(search?.query || search?.tagQuery || search?.dateMin || search?.dateMax)

  let url: string
  if (useSearch) {
    url =
      `${FLICKR_API_BASE}` +
      `?method=flickr.photos.search` +
      `&api_key=${encodeURIComponent(FLICKR_API_KEY)}` +
      `&user_id=${encodeURIComponent(tokenData.nsid)}` +
      `&extras=${encodeURIComponent('url_q,date_taken,date_upload,media,ispublic,isfriend,isfamily')}` +
      `&sort=${encodeURIComponent(sort)}` +
      `&per_page=100` +
      `&page=${page}` +
      `&format=json` +
      `&nojsoncallback=1`

    if (search?.query) {
      url += `&text=${encodeURIComponent(search.query)}`
    }
    if (search?.tagQuery) {
      url += `&tags=${encodeURIComponent(search.tagQuery)}&tag_mode=${search.tagMode ?? 'any'}`
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
      `&extras=${encodeURIComponent('url_q,date_taken,date_upload,media,ispublic,isfriend,isfamily')}` +
      `&sort=${encodeURIComponent(sort)}` +
      `&per_page=100` +
      `&page=${page}` +
      `&format=json` +
      `&nojsoncallback=1`
  }

  const authHeader = getOAuthHeader(url, 'GET', tokenData)
  const response = await axios.get(url, {
    headers: { ...authHeader, 'User-Agent': USER_AGENT }
  })

  if (response.data.stat !== 'ok') {
    throw new Error(`Flickr API error: ${response.data.message ?? 'unknown error'}`)
  }

  const data = response.data.photos
  let photos: FlickrPhoto[] = (data.photo as Record<string, string>[]).map((p) => ({
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
    total: Number(data.total)
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
