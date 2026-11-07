import type { FlickrUser, PhotoPage, PhotoSize, PhotoInfo, AppSettings, AlbumPage, FlickrCollection, BatchProgress, DownloadSize, CameraExif, PhotoSearchParams, BatchLogEntry, PhotoDownloadRecord, PhotoRecordQuery, DiscoverDownloadRecord, DiscoverUser, DiscoverContact, DiscoverGroup } from '../shared/types'

declare module '*.png' {
  const src: string
  export default src
}

// Tells TypeScript about the window.flickrAPI object injected by the preload script
declare global {
  interface Window {
    flickrAPI: {
      startAuth: () => Promise<void>
      verifyAuth: (code: string) => Promise<{ user: FlickrUser }>
      getAuthState: () => Promise<{ user: FlickrUser | null }>
      signOut: () => Promise<void>
      getPhotos: (page: number, sort?: string, search?: PhotoSearchParams) => Promise<PhotoPage>
      getSizes: (photoId: string) => Promise<PhotoSize[]>
      getPhotoDetail: (photoId: string) => Promise<{ sizes: PhotoSize[]; info: PhotoInfo; exif: CameraExif }>
      downloadPhoto: (photoId: string, title: string, downloadSize?: DownloadSize, track?: boolean, thumbnailUrl?: string) => Promise<{ filePath: string | null }>
      onDownloadProgress: (callback: (percent: number) => void) => () => void
      showInFinder: (filePath: string) => void
      openExternal: (url: string) => void
      cancelDownload: () => void
      getAlbums: (page: number) => Promise<AlbumPage>
      getAlbumPhotos: (albumId: string, page: number) => Promise<PhotoPage>
      getCollectionTree: () => Promise<FlickrCollection[]>
      getSettings: () => Promise<AppSettings>
      setSettings: (settings: AppSettings) => Promise<void>
      resetSettings: () => Promise<AppSettings>
      resolveVideoUrl: (sourceUrl: string) => Promise<string>
      pickFolder: () => Promise<string | null>
      startBatch: (albumId: string, albumTitle: string, photoCount?: number, videoCount?: number, force?: boolean, mediaType?: 'photo' | 'video', privacyFilter?: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded') => Promise<{ alreadyQueued: boolean }>
      startSelectedBatch: (photos: { id: string; title: string }[], displayTitle: string, track?: boolean) => Promise<void>
      startPhotostreamBatch: (albumTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded', privacyFilter?: string, sort?: string) => Promise<void>
      cancelBatch: () => void
      skipBatch: () => void
      pauseBatch: () => void
      resumeBatch: () => void
      removeFromQueue: (id: string) => Promise<void>
      confirm: (message: string, detail?: string) => Promise<boolean>
      onBatchProgress: (cb: (progress: BatchProgress) => void) => () => void
      onShowAbout: (cb: (data: { version: string }) => void) => () => void
      onOpenSettings: (cb: () => void) => () => void
      onOpenHistory: (cb: () => void) => () => void
      onMenuSignOut: (cb: () => void) => () => void
      getBatchLog: () => Promise<BatchLogEntry[]>
      getPhotoRecord: (photoId: string) => Promise<PhotoDownloadRecord | null>
      getPhotoRecordsBatch: (photoIds: string[]) => Promise<Record<string, PhotoDownloadRecord>>
      clearHistory: () => Promise<void>
      searchPhotoRecords: (query: PhotoRecordQuery) => Promise<PhotoDownloadRecord[]>
      deletePhotoRecord: (photoId: string) => Promise<void>
      deletePhotoRecords: (photoIds: string[]) => Promise<void>
      clearPhotoRecords: (beforeMs?: number, afterMs?: number) => Promise<void>
      discoverFindUser: (query: string) => Promise<DiscoverUser>
      discoverGetPublicPhotos: (nsid: string, page: number, sort?: string, search?: PhotoSearchParams) => Promise<PhotoPage>
      discoverGetUserAlbums: (nsid: string, page: number) => Promise<AlbumPage>
      discoverGetContacts: () => Promise<DiscoverContact[]>
      discoverGetMyGroups: () => Promise<DiscoverGroup[]>
      discoverGetGroupPhotos: (groupId: string, page: number) => Promise<PhotoPage>
      discoverGetAlbumPhotos: (ownerNsid: string, albumId: string, page: number) => Promise<PhotoPage>
      discoverGetInterestingness: (page: number) => Promise<PhotoPage>
      discoverDownloadPhoto: (photoId: string, title: string, downloadSize?: string, thumbnailUrl?: string, lastUpdate?: number, source?: string) => Promise<{ filePath: string | null }>
      startDiscoverUserBatch: (nsid: string, username: string, displayTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded') => Promise<void>
      startDiscoverGroupBatch: (groupId: string, groupName: string, displayTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded') => Promise<void>
      startDiscoverSelectedBatch: (photos: { id: string; title: string }[], displayTitle: string, folderParts: string[], track?: boolean) => Promise<void>
      searchDiscoverRecords: (query: PhotoRecordQuery) => Promise<DiscoverDownloadRecord[]>
      deleteDiscoverRecord: (photoId: string) => Promise<void>
      deleteDiscoverRecords: (photoIds: string[]) => Promise<void>
      clearDiscoverRecords: (beforeMs?: number, afterMs?: number) => Promise<void>
    }
  }
}

export {}
