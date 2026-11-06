// Shared types used by both main process and renderer

export interface FlickrUser {
  nsid: string
  username: string
  realname: string
  avatarUrl: string
  isPro: boolean
  memberSince: number  // year extracted from datecreate Unix timestamp
}

export interface FlickrTokenData {
  accessToken: string
  accessTokenSecret: string
  nsid: string
  username: string
  realname: string
}

export interface FlickrPhoto {
  id: string
  title: string
  thumbnailUrl: string
  dateTaken: string
  media?: 'photo' | 'video'
  datePosted?: string    // Unix timestamp string from Flickr date_upload extra
  ispublic?: number
  isfriend?: number
  isfamily?: number
  tags?: string[]        // populated when extras=tags is requested (album view)
  lastUpdate?: number    // Flickr last_update unix timestamp (seconds); used for Smart Download Updated
}

export type FileNamingCore = 'title' | 'id' | 'id-title' | 'title-id'
export type FileNamingSep = '.' | '-' | '_' | ' ' | '|'
export type DateFormat = 'YYYY-MM-DD' | 'YYYY-MM-DD HH-MM-SS' | 'YYYY.MM.DD' | 'YYYY.MM.DD HH.MM.SS'
export type PartPosition = 'off' | 'prefix' | 'suffix'
export type CaseTransform = 'none' | 'lowercase' | 'uppercase'
export type DownloadSize = 'original' | 'xlarge' | 'large' | 'medium' | 'small' | 'square'
export type ConflictBehavior = 'skip' | 'rename' | 'overwrite'

export interface FileNamingConfig {
  core: FileNamingCore
  separator: FileNamingSep
  date: { position: PartPosition; format: DateFormat }
  sequence: { position: PartPosition }
  customText: { position: PartPosition; text: string }
  caseTransform: CaseTransform
  charSubstitution: boolean  // replace spaces in title with separator
  sizeToken: { position: PartPosition }  // size indicator as prefix or suffix
}

export interface AppSettings {
  fileNaming: FileNamingConfig
  downloadFolder: string
  showDockProgress: boolean
  notifyOnComplete: boolean
  conflictBehavior: ConflictBehavior
  downloadSize: DownloadSize
  openFinderOnComplete: boolean
  metadata: MetadataSettings
}

export interface BatchProgress {
  current: number       // number completed so far
  total: number
  albumTitle: string
  activeTitle: string   // file currently being fetched/downloaded
  latestTitle: string   // most recently completed
  latestFilePath: string | null
  status: 'running' | 'done' | 'cancelled' | 'error'
  allTitles?: string[]  // full ordered list, sent once in the initial event
  queuedCount?: number   // how many batches are waiting behind this one
  queuedAlbums?: { id: string; title: string; photoCount?: number; videoCount?: number }[]
  error?: string
  skippedCount?: number       // collision skips (file already exists, behavior = skip)
  failedCount?: number        // photos that errored and were skipped
  smartFilteredCount?: number // photos excluded by smart filter (Never Downloaded / Download Updated)
}

export interface BatchLogEntry {
  id: number
  createdAt: number            // ms since epoch
  source: string               // album name / 'Photostream' / 'Selected Photos'
  sourceType: 'album' | 'photostream' | 'selected'
  total: number
  downloaded: number
  skippedCollision: number
  failed: number
  status: 'complete' | 'partial' | 'cancelled' | 'error'
}

export interface PhotoDownloadRecord {
  photoId: string
  lastDownloadedAt: number     // ms since epoch (when we downloaded it)
  flickrLastUpdate: number     // Flickr's last_update timestamp (seconds) at download time
  title: string
  thumbnailUrl: string
}

export interface PhotoRecordQuery {
  title?: string
  photoId?: string
  dateMin?: number  // ms since epoch
  dateMax?: number  // ms since epoch
}

export interface MetadataSettings {
  embedTitle: boolean
  embedDescription: boolean
  embedTags: boolean
  embedDateTaken: boolean
  embedCreator: boolean
  embedGps: boolean
  stripGpsFromPrivate: boolean
  embedLicense: boolean
  embedPhotoUrl: boolean
  embedPhotoId: boolean
}

export interface PhotoInfo {
  id: string
  title: string
  description: string
  tags: string[]
  dateTaken: string | null
  latitude: number | null
  longitude: number | null
  locationName?: string
  ownerName: string
  ownerPathAlias: string
  license: string
  isPrivate: boolean
}

export interface PhotoSize {
  label: string
  width: number
  height: number
  source: string
  media: 'photo' | 'video'
}

export interface PhotoPage {
  photos: FlickrPhoto[]
  page: number
  pages: number
  total: number
}

export interface FlickrAlbum {
  id: string
  title: string
  description: string
  photoCount: number
  videoCount: number
  coverPhotoUrl: string
}

export interface AlbumPage {
  albums: FlickrAlbum[]
  page: number
  pages: number
  total: number
}

export interface FlickrSet {
  id: string
  title: string
  description: string
}

export interface FlickrCollection {
  id: string
  title: string
  description: string
  iconUrl: string
  collections: FlickrCollection[]
  sets: FlickrSet[]
}

export interface CameraExif {
  camera?: string       // make + model, e.g. "Canon EOS 5D Mark IV"
  lens?: string
  aperture?: string     // e.g. "f/2.8"
  shutterSpeed?: string // e.g. "1/500 sec"
  iso?: string          // e.g. "800"
  focalLength?: string  // e.g. "85 mm"
}

export type SearchOperator = 'contains' | 'starts' | 'ends' | 'exact'
export type DateRangeField = 'taken' | 'posted'
export type TagMode = 'any' | 'all'

export interface PhotoSearchParams {
  query?: string
  operator?: SearchOperator
  tagQuery?: string
  tagMode?: TagMode    // 'any' = OR across tags, 'all' = AND; defaults to 'any'
  dateField?: DateRangeField
  dateMin?: string   // YYYY-MM-DD
  dateMax?: string   // YYYY-MM-DD
}

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'error'

export interface AuthState {
  status: AuthStatus
  user: FlickrUser | null
  error: string | null
}
