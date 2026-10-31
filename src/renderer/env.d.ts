import type { FlickrUser, PhotoPage, PhotoSize, AppSettings, AlbumPage, FlickrCollection, BatchProgress } from '../shared/types'

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
      getPhotos: (page: number, sort?: string) => Promise<PhotoPage>
      getSizes: (photoId: string) => Promise<PhotoSize[]>
      downloadPhoto: (photoId: string, title: string) => Promise<{ filePath: string | null }>
      onDownloadProgress: (callback: (percent: number) => void) => () => void
      showInFinder: (filePath: string) => void
      openExternal: (url: string) => void
      cancelDownload: () => void
      getAlbums: (page: number) => Promise<AlbumPage>
      getAlbumPhotos: (albumId: string, page: number) => Promise<PhotoPage>
      getCollectionTree: () => Promise<FlickrCollection[]>
      getSettings: () => Promise<AppSettings>
      setSettings: (settings: AppSettings) => Promise<void>
      pickFolder: () => Promise<string | null>
      startBatch: (albumId: string, albumTitle: string, photoCount?: number, videoCount?: number, force?: boolean) => Promise<{ alreadyQueued: boolean }>
      startSelectedBatch: (photos: { id: string; title: string }[], displayTitle: string) => Promise<void>
      cancelBatch: () => void
      skipBatch: () => void
      removeFromQueue: (id: string) => Promise<void>
      confirm: (message: string, detail?: string) => Promise<boolean>
      onBatchProgress: (cb: (progress: BatchProgress) => void) => () => void
      onShowAbout: (cb: (data: { version: string }) => void) => () => void
    }
  }
}

export {}
