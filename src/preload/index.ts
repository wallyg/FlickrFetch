import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { FlickrUser, PhotoPage, PhotoSize, AppSettings, AlbumPage, FlickrCollection, BatchProgress } from '../shared/types'

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
  getPhotos: (page: number, sort?: string): Promise<PhotoPage> => ipcRenderer.invoke('photos:getPage', page, sort),

  // Get all available sizes for a single photo
  getSizes: (photoId: string): Promise<PhotoSize[]> => ipcRenderer.invoke('photos:getSizes', photoId),

  // Download a photo to disk — opens a save dialog, returns the saved path (or null if cancelled)
  downloadPhoto: (photoId: string, title: string): Promise<{ filePath: string | null }> =>
    ipcRenderer.invoke('photos:download', photoId, title),

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

  // Folder picker
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('shell:pickFolder'),

  // Batch downloads
  startBatch: (albumId: string, albumTitle: string, photoCount?: number, videoCount?: number, force?: boolean): Promise<{ alreadyQueued: boolean }> =>
    ipcRenderer.invoke('batch:startAlbum', albumId, albumTitle, photoCount, videoCount, force),
  confirm: (message: string, detail?: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:confirm', message, detail),
  startSelectedBatch: (photos: { id: string; title: string }[], displayTitle: string): Promise<void> =>
    ipcRenderer.invoke('batch:startSelected', photos, displayTitle),
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
  }
})
