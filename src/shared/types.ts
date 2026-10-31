// Shared types used by both main process and renderer

export interface FlickrUser {
  nsid: string
  username: string
  realname: string
  avatarUrl: string
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
}

export type FileNamingCore = 'title' | 'id' | 'id-title' | 'title-id'
export type FileNamingSep = '.' | '-' | '_' | ' ' | '|'
export type DateFormat = 'YYYY-MM-DD' | 'YYYY-MM-DD HH-MM-SS' | 'YYYY.MM.DD' | 'YYYY.MM.DD HH.MM.SS'
export type PartPosition = 'off' | 'prefix' | 'suffix'

export interface FileNamingConfig {
  core: FileNamingCore
  separator: FileNamingSep
  date: { position: PartPosition; format: DateFormat }
  sequence: { position: PartPosition }
  customText: { position: PartPosition; text: string }
}

export interface AppSettings {
  fileNaming: FileNamingConfig
  downloadFolder: string
  showDockProgress: boolean
  notifyOnComplete: boolean
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
}

export interface PhotoInfo {
  id: string
  title: string
  description: string
  tags: string[]
  dateTaken: string | null
  latitude: number | null
  longitude: number | null
  ownerName: string
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

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'error'

export interface AuthState {
  status: AuthStatus
  user: FlickrUser | null
  error: string | null
}
