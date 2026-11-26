import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { DateExtra, AuditCategory, DuplicateQuery, DuplicatePage, DuplicateStats, FineReasonRequest, FineReasonSummaryRow, LocationHintStats, MissingTagStats, AlbumFitStats, AlbumFitPhoto, AlbumKindRow, MapAlbumHit, MapCacheInfo, MapCellPage, MapCellQuery, MapView, MapViewQuery, AlbumKindRequest, AlbumExportQuery, AlbumListPage, AlbumListQuery, AlbumSetRequest, AlbumSummary, BackupQuery, BackupSummary, FlickrUser, PhotoPage, PhotoSize, PhotoInfo, AppSettings, AlbumPage, FlickrCollection, BatchProgress, CameraExif, PhotoSearchParams, BatchLogEntry, PhotoDownloadRecord, PhotoRecordQuery, DiscoverDownloadRecord, DiscoverUser, DiscoverContact, DiscoverGroup, AuditSummary, AuditListQuery, AuditListPage, AuditSetRequest, AuditPlanRow, AuditExportQuery, HealthSummary, HealthListQuery, DayView, DayQuery, DayPhoto, DayPhotosQuery, DatePhotoIdsQuery, PrivacyScope, TimelineMonths, TimelineDays, TodaySummary, CameraRollQuery, CameraRollView, HealthListPage, HealthSetRequest, HealthExportQuery, AuditOverview, HealthOverview, TagIndexStatus, TagLetterGroup, TagListQuery, TagListPage, TagScanProgress } from '../shared/types'

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
  showPhotoMenu: (photoId: string): void => ipcRenderer.send('photo:contextMenu', photoId),

  // Cancel an in-progress download
  cancelDownload: (): void => ipcRenderer.send('photos:cancelDownload'),

  // Albums
  getAlbums: (page: number): Promise<AlbumPage> => ipcRenderer.invoke('albums:getList', page),
  getAlbumPhotos: (albumId: string, page: number): Promise<PhotoPage> =>
    ipcRenderer.invoke('albums:getPhotos', albumId, page),

  // Collections
  getCollectionTree: (): Promise<FlickrCollection[]> => ipcRenderer.invoke('collections:getTree'),
  startCollectionBatch: (collection: FlickrCollection): Promise<{ queued: number; skipped: number }> =>
    ipcRenderer.invoke('batch:startCollection', collection),

  // App settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Partial<AppSettings>): Promise<void> => ipcRenderer.invoke('settings:set', settings),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset'),
  resolveVideoUrl: (sourceUrl: string): Promise<string> => ipcRenderer.invoke('video:resolveUrl', sourceUrl),

  // Folder picker
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('shell:pickFolder'),

  // Tags tab: local tag index
  getTagIndexStatus: (): Promise<TagIndexStatus> => ipcRenderer.invoke('tags:getStatus'),
  startTagScan: (mode: 'full' | 'refresh'): Promise<{ started: boolean }> => ipcRenderer.invoke('tags:startScan', mode),
  cancelTagScan: (): void => ipcRenderer.send('tags:cancelScan'),
  getTagGroups: (prefix: string, includeMachine: boolean): Promise<TagLetterGroup[]> => ipcRenderer.invoke('tags:getGroups', prefix, includeMachine),
  listTags: (query: TagListQuery): Promise<TagListPage> => ipcRenderer.invoke('tags:list', query),
  countTagPhotos: (names: string[], mode: 'any' | 'all'): Promise<number> => ipcRenderer.invoke('tags:countPhotos', names, mode),
  onTagScanProgress: (cb: (progress: TagScanProgress) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, data: TagScanProgress) => cb(data)
    ipcRenderer.on('tags:scanProgress', handler)
    return () => ipcRenderer.removeListener('tags:scanProgress', handler)
  },

  // Tag audit
  getAuditSummary: (): Promise<AuditSummary> => ipcRenderer.invoke('audit:summary'),
  getAuditOverview: (): Promise<AuditOverview> => ipcRenderer.invoke('audit:overview'),
  listAuditFindings: (query: AuditListQuery): Promise<AuditListPage> => ipcRenderer.invoke('audit:list', query),
  setAuditStatus: (req: AuditSetRequest): Promise<void> => ipcRenderer.invoke('audit:set', req),
  getAuditPlan: (): Promise<AuditPlanRow[]> => ipcRenderer.invoke('audit:plan'),
  copyAuditPlan: (): Promise<boolean> => ipcRenderer.invoke('audit:copyPlan'),
  saveAuditPlanCsv: (): Promise<string | null> => ipcRenderer.invoke('audit:savePlanCsv'),
  saveAuditListCsv: (query: AuditExportQuery): Promise<string | null> => ipcRenderer.invoke('audit:saveListCsv', query),

  // Metadata health
  getHealthPhotoIds: (query: HealthExportQuery): Promise<string[]> => ipcRenderer.invoke('health:ids', query),
  getAuditPhotoIds: (tag: string, category?: AuditCategory): Promise<string[]> => ipcRenderer.invoke('audit:photoIds', tag, category),
  getPhotoCards: (ids: string[]): Promise<AlbumFitPhoto[]> => ipcRenderer.invoke('photos:cards', ids),
  setFineReason: (req: FineReasonRequest): Promise<void> => ipcRenderer.invoke('fine:setReason', req),
  getFineSummary: (): Promise<FineReasonSummaryRow[]> => ipcRenderer.invoke('fine:summary'),
  saveFineReasonsCsv: (): Promise<string | null> => ipcRenderer.invoke('fine:saveCsv'),
  getDuplicateGroups: (q: DuplicateQuery): Promise<DuplicatePage> => ipcRenderer.invoke('health:duplicates', q),
  getDuplicateStats: (): Promise<DuplicateStats> => ipcRenderer.invoke('health:duplicateStats'),
  getLocationHintStats: (): Promise<LocationHintStats> => ipcRenderer.invoke('health:hintStats'),
  getMissingTagStats: (): Promise<MissingTagStats> => ipcRenderer.invoke('audit:missingStats'),
  openBatchEditor: (ids: string[], part: number): Promise<{ parts: number; count: number }> => ipcRenderer.invoke('batch:open', ids, part),
  getAlbumSummary: (): Promise<AlbumSummary> => ipcRenderer.invoke('albums:summary'),
  listAlbumItems: (query: AlbumListQuery): Promise<AlbumListPage> => ipcRenderer.invoke('albums:list', query),
  getAlbumPhotoIds: (query: AlbumExportQuery): Promise<string[]> => ipcRenderer.invoke('albums:ids', query),
  setAlbumStatus: (req: AlbumSetRequest): Promise<void> => ipcRenderer.invoke('albums:set', req),
  getAlbumFitStats: (): Promise<AlbumFitStats> => ipcRenderer.invoke('albums:fitStats'),
  getAlbumFitPhotoIds: (albumId: string): Promise<string[]> => ipcRenderer.invoke('albums:fitIds', albumId),
  getAlbumFitPhotos: (albumId: string): Promise<AlbumFitPhoto[]> => ipcRenderer.invoke('albums:fitPhotos', albumId),
  getAlbumKinds: (): Promise<AlbumKindRow[]> => ipcRenderer.invoke('albums:kinds'),
  getMapView: (query: MapViewQuery): Promise<MapView> => ipcRenderer.invoke('map:view', query),
  getMapCell: (query: MapCellQuery): Promise<MapCellPage> => ipcRenderer.invoke('map:cell', query),
  getMapAlbums: (query: string): Promise<MapAlbumHit[]> => ipcRenderer.invoke('map:albums', query),
  getMapCacheInfo: (): Promise<MapCacheInfo> => ipcRenderer.invoke('map:cacheInfo'),
  clearMapCache: (): Promise<void> => ipcRenderer.invoke('map:cacheClear'),
  getMapTile: (z: number, x: number, y: number): Promise<Uint8Array | null | 'dropped'> => ipcRenderer.invoke('map:tile', z, x, y),
  setAlbumKind: (req: AlbumKindRequest): Promise<void> => ipcRenderer.invoke('albums:setKind', req),
  saveAlbumCsv: (query: AlbumExportQuery): Promise<string | null> => ipcRenderer.invoke('albums:saveCsv', query),
  getBackupSummary: (): Promise<BackupSummary> => ipcRenderer.invoke('backup:summary'),
  listBackupPhotos: (query: BackupQuery): Promise<HealthListPage> => ipcRenderer.invoke('backup:list', query),
  getBackupPhotos: (query: Omit<BackupQuery, 'offset' | 'limit'>): Promise<{ id: string; title: string }[]> => ipcRenderer.invoke('backup:photos', query),
  getHealthSummary: (): Promise<HealthSummary> => ipcRenderer.invoke('health:summary'),
  getHealthOverview: (): Promise<HealthOverview> => ipcRenderer.invoke('health:overview'),
  listHealthPhotos: (query: HealthListQuery): Promise<HealthListPage> => ipcRenderer.invoke('health:list', query),
  setHealthStatus: (req: HealthSetRequest): Promise<void> => ipcRenderer.invoke('health:set', req),
  saveHealthCsv: (query: HealthExportQuery): Promise<string | null> => ipcRenderer.invoke('health:saveCsv', query),

  // On This Day and the Timeline
  getDayView: (q: DayQuery): Promise<DayView> => ipcRenderer.invoke('dates:day', q),
  getDayPhotos: (q: DayPhotosQuery): Promise<DayPhoto[]> => ipcRenderer.invoke('dates:dayPhotos', q),
  getDatePhotoIds: (q: DatePhotoIdsQuery): Promise<{ id: string; title: string }[]> => ipcRenderer.invoke('dates:photoIds', q),
  getTimelineMonths: (scope: PrivacyScope, extra?: DateExtra): Promise<TimelineMonths> => ipcRenderer.invoke('dates:months', scope, extra),
  getTimelineDays: (year: number, month: number, scope: PrivacyScope, extra?: DateExtra): Promise<TimelineDays> => ipcRenderer.invoke('dates:days', year, month, scope, extra),
  getCameraRoll: (q: CameraRollQuery): Promise<CameraRollView> => ipcRenderer.invoke('dates:camera', q),
  getTodaySummary: (): Promise<TodaySummary> => ipcRenderer.invoke('dates:today'),
  hideOnThisDayCardToday: (): Promise<void> => ipcRenderer.invoke('dates:hideCardToday'),
  onOpenOnThisDay: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('otd:open', handler)
    return () => ipcRenderer.removeListener('otd:open', handler)
  },

  // Collage and card maker
  fetchShareImage: (url: string): Promise<string | null> => ipcRenderer.invoke('share:image', url),
  saveShareImage: (dataUrl: string, defaultName: string): Promise<string | null> => ipcRenderer.invoke('share:savePng', dataUrl, defaultName),
  copyShareImage: (dataUrl: string): Promise<boolean> => ipcRenderer.invoke('share:copyImage', dataUrl),
  shareImage: (dataUrl: string, defaultName: string, x: number, y: number): Promise<boolean> => ipcRenderer.invoke('share:shareImage', dataUrl, defaultName, x, y),

  // Batch downloads
  startBatch: (albumId: string, albumTitle: string, photoCount?: number, videoCount?: number, force?: boolean, mediaType?: 'photo' | 'video', privacyFilter?: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded', zipMode?: boolean): Promise<{ alreadyQueued: boolean }> =>
    ipcRenderer.invoke('batch:startAlbum', albumId, albumTitle, photoCount, videoCount, force, mediaType, privacyFilter, track, smartMode, zipMode),
  confirm: (message: string, detail?: string, confirmLabel?: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:confirm', message, detail, confirmLabel),
  startSelectedBatch: (photos: { id: string; title: string }[], displayTitle: string, track?: boolean, zipMode?: boolean, folderName?: string): Promise<void> =>
    ipcRenderer.invoke('batch:startSelected', photos, displayTitle, track, zipMode, folderName),
  retrySelectedBatch: (photos: { id: string; title: string }[], displayTitle: string, targetFolder: string): Promise<void> =>
    ipcRenderer.invoke('batch:retrySelected', photos, displayTitle, targetFolder),
  startPhotostreamBatch: (albumTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded', privacyFilter?: string, sort?: string, zipMode?: boolean): Promise<void> =>
    ipcRenderer.invoke('batch:startPhotostream', albumTitle, track, smartMode, privacyFilter, sort, zipMode),

  // Download history DB
  getBatchLog: (): Promise<BatchLogEntry[]> => ipcRenderer.invoke('db:getBatchLog'),
  getPhotoRecord: (photoId: string): Promise<PhotoDownloadRecord | null> => ipcRenderer.invoke('db:getPhotoRecord', photoId),
  getPhotoRecordsBatch: (photoIds: string[]): Promise<Record<string, PhotoDownloadRecord>> => ipcRenderer.invoke('db:getPhotoRecordsBatch', photoIds),
  clearBatchHistory: (): Promise<void> => ipcRenderer.invoke('db:clearBatchLog'),
  searchPhotoRecords: (query: PhotoRecordQuery): Promise<PhotoDownloadRecord[]> => ipcRenderer.invoke('db:searchPhotoRecords', query),
  deletePhotoRecord: (photoId: string): Promise<void> => ipcRenderer.invoke('db:deletePhotoRecord', photoId),
  deletePhotoRecords: (photoIds: string[]): Promise<void> => ipcRenderer.invoke('db:deletePhotoRecords', photoIds),
  clearPhotoRecords: (beforeMs?: number, afterMs?: number): Promise<void> => ipcRenderer.invoke('db:clearPhotoRecords', beforeMs, afterMs),
  cancelBatch: (): void => ipcRenderer.send('batch:cancel'),
  skipBatch: (): void => ipcRenderer.send('batch:skipCurrent'),
  pauseBatch: (): void => ipcRenderer.send('batch:pause'),
  resumeBatch: (): void => ipcRenderer.send('batch:resume'),
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

  onUpdateAvailable: (cb: (info: { version: string }) => void): (() => void) => {
    const handler = (_evt: IpcRendererEvent, info: { version: string }) => cb(info)
    ipcRenderer.on('update:available', handler)
    return () => ipcRenderer.removeListener('update:available', handler)
  },

  // Discover
  discoverFindUser: (query: string): Promise<DiscoverUser> =>
    ipcRenderer.invoke('discover:findUser', query),
  discoverGetPublicPhotos: (nsid: string, page: number, sort?: string, search?: PhotoSearchParams): Promise<PhotoPage> =>
    ipcRenderer.invoke('discover:getPublicPhotos', nsid, page, sort, search),
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
  discoverDownloadPhoto: (photoId: string, title: string, downloadSize?: string, thumbnailUrl?: string, lastUpdate?: number, source?: string): Promise<{ filePath: string | null }> =>
    ipcRenderer.invoke('discover:downloadPhoto', photoId, title, downloadSize, thumbnailUrl ?? '', lastUpdate ?? 0, source ?? ''),
  discoverGetAlbumPhotos: (ownerNsid: string, albumId: string, page: number): Promise<PhotoPage> =>
    ipcRenderer.invoke('discover:getAlbumPhotos', ownerNsid, albumId, page),
  discoverGetCollectionTree: (nsid: string): Promise<FlickrCollection[]> =>
    ipcRenderer.invoke('discover:getCollectionTree', nsid),
  startDiscoverUserBatch: (nsid: string, username: string, displayTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded'): Promise<void> =>
    ipcRenderer.invoke('batch:startDiscoverUser', nsid, username, displayTitle, track, smartMode),
  startDiscoverGroupBatch: (groupId: string, groupName: string, displayTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded'): Promise<void> =>
    ipcRenderer.invoke('batch:startDiscoverGroup', groupId, groupName, displayTitle, track, smartMode),
  startDiscoverSelectedBatch: (photos: { id: string; title: string }[], displayTitle: string, folderParts: string[], track?: boolean): Promise<void> =>
    ipcRenderer.invoke('batch:startDiscoverSelected', photos, displayTitle, folderParts, track),
  retryDiscoverSelectedBatch: (photos: { id: string; title: string }[], albumTitle: string, targetFolder: string): Promise<void> =>
    ipcRenderer.invoke('batch:retryDiscoverSelected', photos, albumTitle, targetFolder),
  getDiscoverRecordsBatch: (photoIds: string[]): Promise<Record<string, DiscoverDownloadRecord>> => ipcRenderer.invoke('db:getDiscoverRecordsBatch', photoIds),
  searchDiscoverRecords: (query: PhotoRecordQuery): Promise<DiscoverDownloadRecord[]> => ipcRenderer.invoke('db:searchDiscoverRecords', query),
  deleteDiscoverRecord: (photoId: string): Promise<void> => ipcRenderer.invoke('db:deleteDiscoverRecord', photoId),
  deleteDiscoverRecords: (photoIds: string[]): Promise<void> => ipcRenderer.invoke('db:deleteDiscoverRecords', photoIds),
  clearDiscoverRecords: (beforeMs?: number, afterMs?: number): Promise<void> => ipcRenderer.invoke('db:clearDiscoverRecords', beforeMs, afterMs),

})
