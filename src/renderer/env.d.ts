import type { AuditCategory, DuplicateQuery, DuplicatePage, DuplicateStats, FineReasonRequest, FineReasonSummaryRow, LocationHintStats, MissingTagStats, AlbumFitStats, AlbumFitPhoto, AlbumKindRow, MapAlbumHit, MapCacheInfo, MapCellPage, MapCellQuery, MapView, MapViewQuery, AlbumKindRequest, AlbumExportQuery, AlbumListPage, AlbumListQuery, AlbumSetRequest, AlbumSummary, BackupQuery, BackupSummary, FlickrUser, PhotoPage, PhotoSize, PhotoInfo, AppSettings, AlbumPage, FlickrCollection, BatchProgress, DownloadSize, CameraExif, PhotoSearchParams, BatchLogEntry, PhotoDownloadRecord, PhotoRecordQuery, DiscoverDownloadRecord, DiscoverUser, DiscoverContact, DiscoverGroup, TagIndexStatus, TagLetterGroup, TagListQuery, TagListPage, TagScanProgress, AuditSummary, AuditListQuery, AuditListPage, AuditSetRequest, AuditPlanRow, AuditExportQuery, HealthSummary, HealthListQuery, HealthListPage, HealthSetRequest, HealthExportQuery, AuditOverview, HealthOverview, DayView, DayQuery, DayPhoto, DayPhotosQuery, DatePhotoIdsQuery, PrivacyScope, TimelineMonths, TimelineDays, TodaySummary, CameraRollQuery, CameraRollView } from '../shared/types'


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
      downloadPhoto: (photoId: string, title: string, downloadSize?: DownloadSize, track?: boolean, thumbnailUrl?: string, lastUpdate?: number) => Promise<{ filePath: string | null }>
      onDownloadProgress: (callback: (percent: number) => void) => () => void
      showInFinder: (filePath: string) => void
      openExternal: (url: string) => void
      showPhotoMenu: (photoId: string) => void
      cancelDownload: () => void
      getAlbums: (page: number) => Promise<AlbumPage>
      getAlbumPhotos: (albumId: string, page: number) => Promise<PhotoPage>
      getCollectionTree: () => Promise<FlickrCollection[]>
      startCollectionBatch: (collection: FlickrCollection) => Promise<{ queued: number }>
      getTagIndexStatus: () => Promise<TagIndexStatus>
      startTagScan: (mode: 'full' | 'refresh') => Promise<{ started: boolean }>
      cancelTagScan: () => void
      getTagGroups: (prefix: string, includeMachine: boolean) => Promise<TagLetterGroup[]>
      listTags: (query: TagListQuery) => Promise<TagListPage>
      countTagPhotos: (names: string[], mode: 'any' | 'all') => Promise<number>
      onTagScanProgress: (callback: (progress: TagScanProgress) => void) => () => void
      getHealthPhotoIds: (query: HealthExportQuery) => Promise<string[]>
      getAuditPhotoIds: (tag: string, category?: AuditCategory) => Promise<string[]>
      getPhotoCards: (ids: string[]) => Promise<AlbumFitPhoto[]>
      setFineReason: (req: FineReasonRequest) => Promise<void>
      getFineSummary: () => Promise<FineReasonSummaryRow[]>
      saveFineReasonsCsv: () => Promise<string | null>
      getDuplicateGroups: (q: DuplicateQuery) => Promise<DuplicatePage>
      getDuplicateStats: () => Promise<DuplicateStats>
      getLocationHintStats: () => Promise<LocationHintStats>
      getMissingTagStats: () => Promise<MissingTagStats>
      openBatchEditor: (ids: string[], part: number) => Promise<{ parts: number; count: number }>
      getAlbumSummary: () => Promise<AlbumSummary>
      listAlbumItems: (query: AlbumListQuery) => Promise<AlbumListPage>
      getAlbumPhotoIds: (query: AlbumExportQuery) => Promise<string[]>
      setAlbumStatus: (req: AlbumSetRequest) => Promise<void>
      getAlbumFitStats: () => Promise<AlbumFitStats>
      getAlbumFitPhotoIds: (albumId: string) => Promise<string[]>
      getAlbumFitPhotos: (albumId: string) => Promise<AlbumFitPhoto[]>
      getAlbumKinds: () => Promise<AlbumKindRow[]>
      getMapView: (query: MapViewQuery) => Promise<MapView>
      getMapCell: (query: MapCellQuery) => Promise<MapCellPage>
      getMapAlbums: (query: string) => Promise<MapAlbumHit[]>
      getMapCacheInfo: () => Promise<MapCacheInfo>
      clearMapCache: () => Promise<void>
      getMapTile: (z: number, x: number, y: number) => Promise<Uint8Array | null | 'dropped'>
      setAlbumKind: (req: AlbumKindRequest) => Promise<void>
      saveAlbumCsv: (query: AlbumExportQuery) => Promise<string | null>
      getBackupSummary: () => Promise<BackupSummary>
      listBackupPhotos: (query: BackupQuery) => Promise<HealthListPage>
      getBackupPhotos: (query: Omit<BackupQuery, 'offset' | 'limit'>) => Promise<{ id: string; title: string }[]>
      getAuditSummary: () => Promise<AuditSummary>
      getAuditOverview: () => Promise<AuditOverview>
      listAuditFindings: (query: AuditListQuery) => Promise<AuditListPage>
      setAuditStatus: (req: AuditSetRequest) => Promise<void>
      getAuditPlan: () => Promise<AuditPlanRow[]>
      copyAuditPlan: () => Promise<boolean>
      saveAuditPlanCsv: () => Promise<string | null>
      saveAuditListCsv: (query: AuditExportQuery) => Promise<string | null>
      getHealthSummary: () => Promise<HealthSummary>
      getHealthOverview: () => Promise<HealthOverview>
      listHealthPhotos: (query: HealthListQuery) => Promise<HealthListPage>
      setHealthStatus: (req: HealthSetRequest) => Promise<void>
      saveHealthCsv: (query: HealthExportQuery) => Promise<string | null>
      getDayView: (q: DayQuery) => Promise<DayView>
      getDayPhotos: (q: DayPhotosQuery) => Promise<DayPhoto[]>
      getDatePhotoIds: (q: DatePhotoIdsQuery) => Promise<{ id: string; title: string }[]>
      getTimelineMonths: (scope: PrivacyScope) => Promise<TimelineMonths>
      getTimelineDays: (year: number, month: number, scope: PrivacyScope) => Promise<TimelineDays>
      getCameraRoll: (q: CameraRollQuery) => Promise<CameraRollView>
      getTodaySummary: () => Promise<TodaySummary>
      hideOnThisDayCardToday: () => Promise<void>
      onOpenOnThisDay: (cb: () => void) => () => void
      fetchShareImage: (url: string) => Promise<string | null>
      saveShareImage: (dataUrl: string, defaultName: string) => Promise<string | null>
      copyShareImage: (dataUrl: string) => Promise<boolean>
      getSettings: () => Promise<AppSettings>
      setSettings: (settings: Partial<AppSettings>) => Promise<void>
      resetSettings: () => Promise<AppSettings>
      resolveVideoUrl: (sourceUrl: string) => Promise<string>
      pickFolder: () => Promise<string | null>
      startBatch: (albumId: string, albumTitle: string, photoCount?: number, videoCount?: number, force?: boolean, mediaType?: 'photo' | 'video', privacyFilter?: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded', zipMode?: boolean) => Promise<{ alreadyQueued: boolean }>
      startSelectedBatch: (photos: { id: string; title: string }[], displayTitle: string, track?: boolean, zipMode?: boolean) => Promise<void>
      startPhotostreamBatch: (albumTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded', privacyFilter?: string, sort?: string, zipMode?: boolean) => Promise<void>
      cancelBatch: () => void
      skipBatch: () => void
      pauseBatch: () => void
      resumeBatch: () => void
      removeFromQueue: (id: string) => Promise<void>
      confirm: (message: string, detail?: string, confirmLabel?: string) => Promise<boolean>
      onBatchProgress: (cb: (progress: BatchProgress) => void) => () => void
      onShowAbout: (cb: (data: { version: string }) => void) => () => void
      onOpenSettings: (cb: () => void) => () => void
      onOpenHistory: (cb: () => void) => () => void
      onMenuSignOut: (cb: () => void) => () => void
      onUpdateAvailable: (cb: (info: { version: string }) => void) => () => void
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
      discoverGetCollectionTree: (nsid: string) => Promise<FlickrCollection[]>
      discoverGetInterestingness: (page: number) => Promise<PhotoPage>
      discoverDownloadPhoto: (photoId: string, title: string, downloadSize?: string, thumbnailUrl?: string, lastUpdate?: number, source?: string) => Promise<{ filePath: string | null }>
      startDiscoverUserBatch: (nsid: string, username: string, displayTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded') => Promise<void>
      startDiscoverGroupBatch: (groupId: string, groupName: string, displayTitle: string, track?: boolean, smartMode?: 'updated' | 'never-downloaded') => Promise<void>
      startDiscoverSelectedBatch: (photos: { id: string; title: string }[], displayTitle: string, folderParts: string[], track?: boolean) => Promise<void>
      retryDiscoverSelectedBatch: (photos: { id: string; title: string }[], albumTitle: string, targetFolder: string) => Promise<void>
      getDiscoverRecordsBatch: (photoIds: string[]) => Promise<Record<string, DiscoverDownloadRecord>>
      searchDiscoverRecords: (query: PhotoRecordQuery) => Promise<DiscoverDownloadRecord[]>
      deleteDiscoverRecord: (photoId: string) => Promise<void>
      deleteDiscoverRecords: (photoIds: string[]) => Promise<void>
      clearDiscoverRecords: (beforeMs?: number, afterMs?: number) => Promise<void>
    }
  }
}

export {}
