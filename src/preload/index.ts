import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { FlickrUser, PhotoPage, PhotoSize, PhotoInfo, AppSettings, AlbumPage, FlickrCollection, BatchProgress, CameraExif, PhotoSearchParams, BatchLogEntry, PhotoDownloadRecord, PhotoRecordQuery, DiscoverDownloadRecord, DiscoverUser, DiscoverContact, DiscoverGroup } from '../shared/types'

// Expose a safe, limited API surface to the renderer process.
// The renderer cannot access Node.js or Electron directly — only these methods.
contextBridge.exposeInMainWorld('flickrAPI', {
  // Ask the main process to start the OAuth flow (opens browser to Flickr auth page)
  startAuth: (): Promise<void> => ipcRenderer.invoke('auth:start'),

  // Send the 9-digit verifier code the user typed to exchange for an access token
  verifyAuth: (code: string): Promise<{ user: FlickrUser }> =>
    ipcRenderer.invoke('auth:verify', code),

  // Ask the main process for the current auth state (reads stored token)
  getAuthState: (): Promise<{ user: FlickrUser | null }> => ipcRenderer.invoke('auth:getState'),

  // Tell the main process to clear the stored token
  signOut: (): Promise<void> => ipcRenderer.invoke('auth:signout'),

  // Fetch a page of the user's photos from Flickr
  getPhotos: (page: number, sort?: string, search?: PhotoSearchParams): Promise<PhotoPage> => ipcRenderer.invoke('photos:getPage', page, sort, search),

  // Get all available sizes for a single photo
  getSizes: (photoId: string): Promise<PhotoSize[]> => ipcRenderer.invoke('photos:getSizes', photoId),

  // Get sizes + full info + EXIF for a photo in one call (used by photo detail view)
  getPhotoDetail: (photoId: string): Promise<{ sizes: PhotoSize[]; info: PhotoInfo; exif: CameraExif }> =>
    ipcRenderer.invoke('photos:getDetail', photoId),

  // Download a photo to disk — opens a save dialog, returns the saved path (or null if cancelled)
  downloadPhoto: (photoId: string, title: string, downloadSize?: string, track = true, thumbnailUrl = '', lastUpdate = 0): Promise<{ filePath: string | null }> =>
    ipcRenderer.invoke('photos:download', photoId, title, downloadSize, track, thumbnailUrl, lastUpdate),

  // Listen for download progress events (0–100). Returns a cleanup function.
  onDownloadProgress: (cb: (percent: number) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, data: { percent: number }) => cb(data.percent)
    ipcRenderer.on('download:progress', handler)
    return () => ipcRenderer.removeListener('download:progress', handler)
  },

  // Reveal a file in Finder after download
  showInFinder: (filePath: string): void => ipcRenderer.send('shell:showInFinder', filePath),

  // Open an external URL in the default browser/mail app
  openExternal: (url: string): void => ipcRenderer.send('shell:openExternal', url),

  // Cancel an in-progress download
  cancelDownload: (): void => ipcRenderer.send('photos:cancelDownload'),

  // Albums
  getAlbums: (page: number): Promise<AlbumPage> => ipcRenderer.invoke('albums:getList', page),
  getAlbumPhotos: (albumId: string, page: number): Promise<PhotoPage> =>
    ipcRenderer.invoke('albums:getPhotos', albumId, page),

  // Collections
  getCollectionTree: (): Promise<FlickrCollection[]> => ipcRenderer.invoke('collections:getTree'),

  // App settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: AppSettings): Promise<void> => ipcRenderer.invoke('settings:set', settings),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset'),
  resolveVideoUrl: (sourceUrl: string): Promise<string> => ipcRenderer.invoke('video:resolveUrl', sourceUrl),

  // Folder picker
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('shell:pickFolder'),

  // Batch downloads
  startBatch: (albumId: string, albumTitle: string, photoCount?: number, videoCount?: number, force?: boolean, mediaType?: 'photo' | 'video', privacyFilter?: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded'): Promise<{ alreadyQueued: boolean }> =>
    ipcRenderer.invoke('batch:startAlbum', albumId, albumTitle, photoCount, videoCount, force, mediaType, privacyFilter, track, smartMode),
  confirm: (message: string, detail?: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:confirm', message, detail),
  startSelectedBatch: (photos: { id: string; title: string }[], displayTitle: string, track?: boolean): Promise<void> =>
    ipcRenderer.invoke('batch:startSelected', photos, displayTitle, track),
  startPhotostreamBatch: (albumTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded', privacyFilter?: string, sort?: string): Promise<void> =>
    ipcRenderer.invoke('batch:startPhotostream', albumTitle, track, smartMode, privacyFilter, sort),

  // Download history DB
  getBatchLog: (): Promise<BatchLogEntry[]> => ipcRenderer.invoke('db:getBatchLog'),
  getPhotoRecord: (photoId: string): Promise<PhotoDownloadRecord | null> => ipcRenderer.invoke('db:getPhotoRecord', photoId),
  getPhotoRecordsBatch: (photoIds: string[]): Promise<Record<string, PhotoDownloadRecord>> => ipcRenderer.invoke('db:getPhotoRecordsBatch', photoIds),
  clearHistory: (): Promise<void> => ipcRenderer.invoke('db:clearHistory'),
  searchPhotoRecords: (query: PhotoRecordQuery): Promise<PhotoDownloadRecord[]> => ipcRenderer.invoke('db:searchPhotoRecords', query),
  deletePhotoRecord: (photoId: string): Promise<void> => ipcRenderer.invoke('db:deletePhotoRecord', photoId),
  deletePhotoRecords: (photoIds: string[]): Promise<void> => ipcRenderer.invoke('db:deletePhotoRecords', photoIds),
  clearPhotoRecords: (beforeMs?: number, afterMs?: number): Promise<void> => ipcRenderer.invoke('db:clearPhotoRecords', beforeMs, afterMs),
  cancelBatch: (): void => ipcRenderer.send('batch:cancel'),
  skipBatch: (): void => ipcRenderer.send('batch:skipCurrent'),
  removeFromQueue: (id: string): Promise<void> => ipcRenderer.invoke('batch:removeFromQueue', id),
  onBatchProgress: (cb: (progress: BatchProgress) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, data: BatchProgress) => cb(data)
    ipcRenderer.on('batch:progress', handler)
    return () => ipcRenderer.removeListener('batch:progress', handler)
  },

  onShowAbout: (cb: (data: { version: string }) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, data: { version: string }) => cb(data)
    ipcRenderer.on('app:showAbout', handler)
    return () => ipcRenderer.removeListener('app:showAbout', handler)
  },

  onOpenSettings: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:openSettings', handler)
    return () => ipcRenderer.removeListener('app:openSettings', handler)
  },

  onOpenHistory: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:openHistory', handler)
    return () => ipcRenderer.removeListener('app:openHistory', handler)
  },

  onMenuSignOut: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:signOut', handler)
    return () => ipcRenderer.removeListener('app:signOut', handler)
  },

  // Discover
  discoverFindUser: (query: string): Promise<DiscoverUser> =>
    ipcRenderer.invoke('discover:findUser', query),
  discoverGetPublicPhotos: (nsid: string, page: number): Promise<PhotoPage> =>
    ipcRenderer.invoke('discover:getPublicPhotos', nsid, page),
  discoverGetUserAlbums: (nsid: string, page: number): Promise<AlbumPage> =>
    ipcRenderer.invoke('discover:getUserAlbums', nsid, page),
  discoverGetContacts: (): Promise<DiscoverContact[]> =>
    ipcRenderer.invoke('discover:getContacts'),
  discoverGetMyGroups: (): Promise<DiscoverGroup[]> =>
    ipcRenderer.invoke('discover:getMyGroups'),
  discoverGetGroupPhotos: (groupId: string, page: number): Promise<PhotoPage> =>
    ipcRenderer.invoke('discover:getGroupPhotos', groupId, page),
  discoverGetInterestingness: (page: number): Promise<PhotoPage> =>
    ipcRenderer.invoke('discover:getInterestingness', page),
  discoverDownloadPhoto: (photoId: string, title: string, downloadSize?: string, thumbnailUrl?: string, lastUpdate?: number): Promise<{ filePath: string | null }> =>
    ipcRenderer.invoke('discover:downloadPhoto', photoId, title, downloadSize, thumbnailUrl ?? '', lastUpdate ?? 0),
  discoverGetAlbumPhotos: (ownerNsid: string, albumId: string, page: number): Promise<PhotoPage> =>
    ipcRenderer.invoke('discover:getAlbumPhotos', ownerNsid, albumId, page),
  startDiscoverUserBatch: (nsid: string, username: string, displayTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded'): Promise<void> =>
    ipcRenderer.invoke('batch:startDiscoverUser', nsid, username, displayTitle, track, smartMode),
  startDiscoverGroupBatch: (groupId: string, groupName: string, displayTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded'): Promise<void> =>
    ipcRenderer.invoke('batch:startDiscoverGroup', groupId, groupName, displayTitle, track, smartMode),
  startDiscoverSelectedBatch: (photos: { id: string; title: string }[], displayTitle: string, folderParts: string[], track?: boolean): Promise<void> =>
    ipcRenderer.invoke('batch:startDiscoverSelected', photos, displayTitle, folderParts, track),
  searchDiscoverRecords: (query: PhotoRecordQuery): Promise<DiscoverDownloadRecord[]> => ipcRenderer.invoke('db:searchDiscoverRecords', query),
  deleteDiscoverRecord: (photoId: string): Promise<void> => ipcRenderer.invoke('db:deleteDiscoverRecord', photoId),
  deleteDiscoverRecords: (photoIds: string[]): Promise<void> => ipcRenderer.invoke('db:deleteDiscoverRecords', photoIds),
  clearDiscoverRecords: (beforeMs?: number, afterMs?: number): Promise<void> => ipcRenderer.invoke('db:clearDiscoverRecords', beforeMs, afterMs),

})
