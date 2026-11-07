import { app, BrowserWindow, ipcMain, shell, dialog, Menu, Notification } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { startOAuthFlow, verifyOAuth, loadToken, clearToken } from './auth'
import { getUserInfo, getPhotos, getPhotoSizes, getPhotoInfo, getPhotoExif, getAlbums, getAlbumPhotos, getPublicAlbumPhotos, getCollectionTree, resolveVideoUrl, getRecentlyUpdated, findDiscoverUser, getPublicPhotos, getUserPublicAlbums, getContacts, getUserGroups, getGroupPhotos, getInterestingness } from './flickr'
import { downloadPhoto, downloadToFolder } from './downloader'
import { endExifTool } from './exiftool'
import { loadSettings, saveSettings, resetSettings, ensureDownloadFolder } from './settings'
import { openDatabase, closeDatabase, writeBatchLog, writePhotoRecord, getPhotoRecord, getPhotoRecordsBatch, getBatchLog, clearBatchLog, clearAllHistory, searchPhotoRecords, deletePhotoRecord, deletePhotoRecords, clearPhotoRecords, writeDiscoverRecord, getDiscoverRecordsBatch, searchDiscoverRecords, deleteDiscoverRecord, deleteDiscoverRecords, clearDiscoverRecords } from './database'
import type { AppSettings, FileNamingConfig, PhotoInfo, BatchProgress, DownloadSize, CameraExif, PhotoSearchParams, MetadataSettings, DiscoverUser, DiscoverContact, DiscoverGroup } from '../shared/types'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms))
  ])
}

function formatDate(dateTaken: string, format: string): string {
  const [datePart, timePart = '00:00:00'] = dateTaken.split(' ')
  const [year, month, day] = datePart.split('-')
  const [h, m, s] = (timePart.split(':') as [string, string, string])
  switch (format) {
    case 'YYYY-MM-DD HH-MM-SS': return `${year}-${month}-${day} ${h}-${m}-${s}`
    case 'YYYY.MM.DD':          return `${year}.${month}.${day}`
    case 'YYYY.MM.DD HH.MM.SS': return `${year}.${month}.${day} ${h}.${m}.${s}`
    default:                    return `${year}-${month}-${day}`
  }
}

const SIZE_TOKEN_MAP: Record<string, string> = {
  original: 'o',
  xlarge: 'xl',
  large: 'l',
  medium: 'm',
  small: 's',
  square: 'sq'
}

function buildFilename(
  config: FileNamingConfig,
  photoId: string,
  title: string,
  info: PhotoInfo,
  seqNum?: number,
  downloadSize?: string
): string {
  const s = config.separator
  const rawTitle = (title || photoId).replace(/[/\\:*?"<>|]/g, '_').trim().slice(0, 150)
  const safeTitle = config.charSubstitution
    ? rawTitle.replace(/\s+/g, s)
    : rawTitle

  let core: string
  switch (config.core) {
    case 'id':       core = photoId; break
    case 'id-title': core = `${photoId}${s}${safeTitle}`; break
    case 'title-id': core = `${safeTitle}${s}${photoId}`; break
    default:         core = safeTitle
  }

  const pre: string[] = []
  const suf: string[] = []

  if (config.date.position !== 'off' && info.dateTaken) {
    const d = formatDate(info.dateTaken, config.date.format)
    config.date.position === 'prefix' ? pre.push(d) : suf.push(d)
  }
  if (config.sequence.position !== 'off' && seqNum != null) {
    const seq = String(seqNum).padStart(3, '0')
    config.sequence.position === 'prefix' ? pre.push(seq) : suf.push(seq)
  }
  const ct = config.customText.text.trim()
  if (config.customText.position !== 'off' && ct) {
    config.customText.position === 'prefix' ? pre.push(ct) : suf.push(ct)
  }
  if (config.sizeToken?.position && config.sizeToken.position !== 'off' && downloadSize) {
    const token = SIZE_TOKEN_MAP[downloadSize] ?? downloadSize
    config.sizeToken.position === 'prefix' ? pre.push(token) : suf.push(token)
  }

  const assembled = [...pre, core, ...suf].join(s)
  switch (config.caseTransform) {
    case 'lowercase': return assembled.toLowerCase()
    case 'uppercase': return assembled.toUpperCase()
    default: return assembled
  }
}

let mainWindow: BrowserWindow | null = null

function createSplash(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    center: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })

  // Resources folder is next to the app in production, or in the project root in dev
  const resourcesDir = app.isPackaged
    ? process.resourcesPath
    : join(__dirname, '../../resources')

  const splashB64 = readFileSync(join(resourcesDir, 'splash.png')).toString('base64')
  const version = app.getVersion()

  const splashHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 600px; height: 400px; background: transparent; overflow: hidden; }
  .card {
    width: 540px;
    height: 340px;
    margin: 30px;
    background: #FEF4EA;
    border-radius: 20px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.10);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 24px 18px;
    -webkit-app-region: drag;
    overflow: hidden;
  }
  img.splash { width: 100%; height: auto; }
  .meta {
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    color: #bbb;
    margin-top: 12px;
  }
</style>
</head>
<body>
  <div class="card">
    <img class="splash" src="data:image/png;base64,${splashB64}" />
    <p class="meta">v${version} &nbsp;·&nbsp; © 2026 Wally Gobetz</p>
  </div>
</body>
</html>`

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)
  return splash
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC Handlers

// Step 1: Get a request token and open the Flickr authorize page in the browser
ipcMain.handle('auth:start', async () => {
  try {
    const authorizeUrl = await startOAuthFlow()
    shell.openExternal(authorizeUrl)
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 429) {
      throw new Error('Flickr is rate-limiting requests. Please wait 30 seconds and try again.')
    }
    if (status === 401) {
      throw new Error('Invalid API key or secret. Please check your config.ts.')
    }
    throw new Error('Could not connect to Flickr. Check your internet connection and try again.')
  }
})

// Step 2: Exchange the verifier code the user typed in for an access token
ipcMain.handle('auth:verify', async (_event, verifierCode: string) => {
  process.stderr.write(`[flickrfetch] auth:verify called, code: "${verifierCode.trim()}"\n`)
  try {
    const tokenData = await verifyOAuth(verifierCode.trim())
    const user = await getUserInfo(tokenData)
    process.stderr.write(`[flickrfetch] auth:verify SUCCESS: ${user.username}\n`)
    return { user }
  } catch (err: unknown) {
    process.stderr.write(`[flickrfetch] auth:verify ERROR: ${err instanceof Error ? err.message : String(err)}\n`)
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 401) {
      throw new Error('Invalid code — please check you entered it correctly and try again.')
    }
    throw new Error('Could not verify code. Please try connecting again.')
  }
})

// Return the current auth state (user info if logged in, null if not)
ipcMain.handle('auth:getState', async () => {
  const tokenData = loadToken()
  if (!tokenData) return { user: null }

  try {
    const user = await getUserInfo(tokenData)
    return { user }
  } catch {
    clearToken()
    return { user: null }
  }
})

// Fetch a page of the authenticated user's photos
ipcMain.handle('photos:getPage', async (_event, page: number, sort?: string, search?: PhotoSearchParams) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getPhotos(tokenData, page, sort, search)
})

// Get available sizes for a photo (used by the detail modal for preview + download)
ipcMain.handle('photos:getSizes', async (_event, photoId: string) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getPhotoSizes(photoId, tokenData)
})

// Get sizes + full info + EXIF for a photo in one parallel call (used by photo detail view)
ipcMain.handle('photos:getDetail', async (_event, photoId: string) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  const [sizes, info, exif] = await Promise.all([
    getPhotoSizes(photoId, tokenData),
    getPhotoInfo(photoId, tokenData),
    getPhotoExif(photoId, tokenData).catch((): CameraExif => ({}))
  ])
  return { sizes, info, exif }
})

// Download a photo: opens a save dialog then streams the file to disk
let activeDownloadController: AbortController | null = null

ipcMain.handle('photos:download', async (_event, photoId: string, photoTitle: string, downloadSize?: DownloadSize, track = true, thumbnailUrl = '', lastUpdate = 0) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  if (!mainWindow) throw new Error('No window available')
  activeDownloadController = new AbortController()
  try {
    const [sizes, photoInfo] = await Promise.all([
      getPhotoSizes(photoId, tokenData),
      getPhotoInfo(photoId, tokenData)
    ])
    const { fileNaming, metadata, downloadSize: globalDownloadSize } = loadSettings()
    const effectiveSize = downloadSize ?? globalDownloadSize
    const filename = buildFilename(fileNaming, photoId, photoTitle, photoInfo, undefined, effectiveSize)
    const filePath = await downloadPhoto(sizes, filename, mainWindow, activeDownloadController.signal, photoInfo, metadata, effectiveSize)
    if (filePath && track) writePhotoRecord(photoId, lastUpdate, photoTitle, thumbnailUrl)
    return { filePath }
  } finally {
    activeDownloadController = null
  }
})

ipcMain.on('photos:cancelDownload', () => {
  activeDownloadController?.abort()
  activeDownloadController = null
})

// Albums
ipcMain.handle('albums:getList', async (_event, page: number = 1) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getAlbums(tokenData, page)
})

ipcMain.handle('albums:getPhotos', async (_event, albumId: string, page: number) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getAlbumPhotos(albumId, tokenData, page)
})

// Collections
ipcMain.handle('collections:getTree', async () => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getCollectionTree(tokenData)
})

// Settings
ipcMain.handle('settings:get', () => loadSettings())
ipcMain.handle('settings:set', (_event, settings: AppSettings) => saveSettings(settings))
ipcMain.handle('settings:reset', () => resetSettings())
ipcMain.handle('video:resolveUrl', (_event, sourceUrl: string) => resolveVideoUrl(sourceUrl))

// Folder picker dialog
ipcMain.handle('shell:pickFolder', async () => {
  if (!mainWindow) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  })
  return canceled ? null : filePaths[0]
})

// Batch downloads
interface BatchJob {
  id: string
  type: 'album' | 'selected' | 'album-smart' | 'discover-user' | 'discover-group' | 'discover-selected'
  albumId?: string
  photos?: { id: string; title: string }[]
  albumTitle: string
  photoCount?: number
  videoCount?: number
  mediaType?: 'photo' | 'video'
  privacyFilter?: string
  track?: boolean
  smartMode?: 'updated' | 'never-downloaded'
  // Discover-specific
  discoverNsid?: string        // user NSID for discover-user batch
  discoverGroupId?: string     // group ID for discover-group batch
  discoverFolder?: string      // target subfolder override
}

let batchQueue: BatchJob[] = []
let activeBatchController: AbortController | null = null
let activeBatchAlbumId: string | null = null
let lastBatchProgress: BatchProgress | null = null
let batchIdCounter = 0


function enqueueBatch(job: Omit<BatchJob, 'id'>): void {
  const jobWithId: BatchJob = { ...job, id: String(++batchIdCounter) }
  batchQueue.push(jobWithId)
  // If a batch is already running, immediately push a progress update so the
  // renderer sees the new queue count without waiting for the next file download.
  if (activeBatchController !== null && lastBatchProgress) {
    mainWindow?.webContents.send('batch:progress', {
      ...lastBatchProgress,
      queuedCount: batchQueue.length,
      queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount }))
    } satisfies BatchProgress)
  }
  runNextBatch()
}

async function runNextBatch(): Promise<void> {
  if (activeBatchController !== null) return
  const job = batchQueue.shift()
  if (!job) return

  activeBatchController = new AbortController()
  try {
    if (job.type === 'selected') {
      await runSelectedBatch(job.photos!, job.albumTitle, job.track ?? true)
    } else if (job.type === 'discover-selected') {
      await runDiscoverSelectedBatch(job.photos!, job.albumTitle, job.discoverFolder!, job.track ?? true)
    } else if (job.type === 'discover-user') {
      await runDiscoverUserBatch(job.discoverNsid!, job.albumTitle, job.discoverFolder!, job.track ?? true, job.smartMode)
    } else if (job.type === 'discover-group') {
      await runDiscoverGroupBatch(job.discoverGroupId!, job.albumTitle, job.discoverFolder!, job.track ?? true, job.smartMode)
    } else if (job.albumId === '__photostream__') {
      await runPhotostreamBatch(job.albumTitle, job.track ?? true, job.smartMode, job.privacyFilter)
    } else {
      await runAlbumBatch(job.albumId!, job.albumTitle, job.mediaType, job.privacyFilter, job.track ?? true, job.smartMode)
    }
  } catch (err) {
    process.stderr.write(`[flickrfetch] batch error: ${err}\n`)
    mainWindow?.webContents.send('batch:progress', {
      current: 0, total: 0, albumTitle: job.albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null,
      status: 'error', error: String(err), queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount }))
    } satisfies BatchProgress)
  }
  activeBatchController = null
  runNextBatch()
}

async function runAlbumBatch(albumId: string, albumTitle: string, mediaType?: 'photo' | 'video', privacyFilter?: string, track = true, smartMode?: 'updated' | 'never-downloaded'): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return

  activeBatchAlbumId = albumId
  const { fileNaming, downloadFolder, showDockProgress, notifyOnComplete, conflictBehavior, downloadSize, openFinderOnComplete, metadata } = loadSettings()
  const safeAlbumTitle = albumTitle.replace(/[/\\:*?"<>|]/g, '_').trim()
  const albumFolder = join(downloadFolder, safeAlbumTitle)
  ensureDownloadFolder(albumFolder)

  const sendProgress = (p: Omit<BatchProgress, 'queuedCount' | 'queuedAlbums'>): void => {
    const full = { ...p, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
    lastBatchProgress = full
    mainWindow?.webContents.send('batch:progress', full)
    if (showDockProgress) {
      if (p.status === 'running' && p.total > 0) {
        mainWindow?.setProgressBar(p.current / p.total)
      } else {
        mainWindow?.setProgressBar(-1)
      }
    }
  }

  let page = 1
  let pages = 1
  const allPhotos: { id: string; title: string; ispublic?: number; isfriend?: number; isfamily?: number; lastUpdate?: number }[] = []

  do {
    const result = await getAlbumPhotos(albumId, tokenData, page, mediaType)
    allPhotos.push(...result.photos.map((p) => ({ id: p.id, title: p.title, ispublic: p.ispublic, isfriend: p.isfriend, isfamily: p.isfamily, lastUpdate: p.lastUpdate })))
    pages = result.pages
    page++
  } while (page <= pages)

  const getPrivacyLevel = (p: { ispublic?: number; isfriend?: number; isfamily?: number }): string => {
    if (p.ispublic === 1) return 'public'
    if (p.isfriend === 1) return 'friends'
    if (p.isfamily === 1) return 'family'
    return 'private'
  }

  let privacyFiltered = (!privacyFilter || privacyFilter === 'all')
    ? allPhotos
    : allPhotos.filter(p => getPrivacyLevel(p) === privacyFilter)

  const preSmartTotal = privacyFiltered.length

  // Smart mode filtering (requires DB records)
  if (smartMode) {
    const recordMap = getPhotoRecordsBatch(privacyFiltered.map(p => p.id))
    if (smartMode === 'never-downloaded') {
      privacyFiltered = privacyFiltered.filter(p => !recordMap.has(p.id))
    } else if (smartMode === 'updated') {
      privacyFiltered = privacyFiltered.filter(p => {
        const rec = recordMap.get(p.id)
        return rec != null && (p.lastUpdate ?? 0) > rec.flickrLastUpdate
      })
    }
  }

  const filteredBatch = privacyFiltered
  const total = filteredBatch.length
  sendProgress({
    current: 0, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null,
    status: 'running', allTitles: filteredBatch.map((p) => p.title)
  })

  let albumSeqNum = 1
  let lastFilePath: string | null = null
  let skippedCount = 0
  let skippedSizeUnavailableCount = 0
  let failedCount = 0
  let downloadedCount = 0

  for (let i = 0; i < filteredBatch.length; i++) {
    if (activeBatchController?.signal.aborted) {
      activeBatchAlbumId = null
      sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
      if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'album', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled' })
      return
    }

    const photo = filteredBatch[i]
    sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })

    try {
      const [sizes, photoInfo] = await Promise.all([
        withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
        withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
      ])
      const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, albumSeqNum++, downloadSize)
      const outcome = await downloadToFolder(sizes, filename, albumFolder, activeBatchController?.signal, photoInfo, conflictBehavior, downloadSize, metadata)
      if (outcome.status === 'downloaded') {
        downloadedCount++
        lastFilePath = outcome.filePath
        if (track) writePhotoRecord(photo.id, photo.lastUpdate ?? 0, photo.title, photo.thumbnailUrl)
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: outcome.filePath, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      } else if (outcome.reason === 'size-unavailable') {
        skippedSizeUnavailableCount++
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      } else {
        skippedCount++
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError' || activeBatchController?.signal.aborted) {
        activeBatchAlbumId = null
        sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
        if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'album', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled' })
        return
      }
      failedCount++
      process.stderr.write(`[flickrfetch] batch skip ${photo.id}: ${err}\n`)
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
    }
  }

  activeBatchAlbumId = null
  const finalStatus = failedCount > 0 || skippedCount > 0 || skippedSizeUnavailableCount > 0 ? 'partial' : 'complete'
  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'done', skippedCount, skippedSizeUnavailableCount, failedCount, smartFilteredCount: preSmartTotal - total })
  if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'album', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: finalStatus })
  if (notifyOnComplete && Notification.isSupported()) {
    const body = (skippedCount + skippedSizeUnavailableCount + failedCount) > 0
      ? `Saved ${downloadedCount}, skipped ${skippedCount + skippedSizeUnavailableCount + failedCount} from "${albumTitle}"`
      : `Saved ${total} photos from "${albumTitle}"`
    new Notification({ title: 'FlickrFetch', body }).show()
  }
  if (openFinderOnComplete && lastFilePath) {
    shell.showItemInFolder(lastFilePath)
  }
}

async function runSelectedBatch(photos: { id: string; title: string }[], albumTitle: string, track = true): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return

  const { fileNaming, downloadFolder, showDockProgress, notifyOnComplete, conflictBehavior, downloadSize, openFinderOnComplete, metadata } = loadSettings()
  const baseTitle = albumTitle.replace(/ \(\d+ selected\)$/, '')
  const targetFolder = baseTitle === 'Photostream'
    ? downloadFolder
    : join(downloadFolder, baseTitle.replace(/[/\\:*?"<>|]/g, '_').trim())
  ensureDownloadFolder(targetFolder)

  const sendProgress = (p: Omit<BatchProgress, 'queuedCount' | 'queuedAlbums'>): void => {
    const full = { ...p, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
    lastBatchProgress = full
    mainWindow?.webContents.send('batch:progress', full)
    if (showDockProgress) {
      if (p.status === 'running' && p.total > 0) {
        mainWindow?.setProgressBar(p.current / p.total)
      } else {
        mainWindow?.setProgressBar(-1)
      }
    }
  }

  const total = photos.length
  sendProgress({
    current: 0, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null,
    status: 'running', allTitles: photos.map((p) => p.title)
  })

  let selSeqNum = 1
  let lastFilePath: string | null = null
  let skippedCount = 0
  let skippedSizeUnavailableCount = 0
  let failedCount = 0
  let downloadedCount = 0

  for (let i = 0; i < photos.length; i++) {
    if (activeBatchController?.signal.aborted) {
      sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
      if (track) writeBatchLog({ createdAt: Date.now(), source: baseTitle, sourceType: 'selected', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled' })
      return
    }

    const photo = photos[i]
    sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })

    try {
      const [sizes, photoInfo] = await Promise.all([
        withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
        withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
      ])
      const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, selSeqNum++, downloadSize)
      const outcome = await downloadToFolder(sizes, filename, targetFolder, activeBatchController?.signal, photoInfo, conflictBehavior, downloadSize, metadata)
      if (outcome.status === 'downloaded') {
        downloadedCount++
        lastFilePath = outcome.filePath
        if (track) writePhotoRecord(photo.id, 0, photo.title, photo.thumbnailUrl)
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: outcome.filePath, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      } else if (outcome.reason === 'size-unavailable') {
        skippedSizeUnavailableCount++
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      } else {
        skippedCount++
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError' || activeBatchController?.signal.aborted) {
        sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
        if (track) writeBatchLog({ createdAt: Date.now(), source: baseTitle, sourceType: 'selected', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled' })
        return
      }
      failedCount++
      process.stderr.write(`[flickrfetch] batch skip ${photo.id}: ${err}\n`)
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
    }
  }

  const finalStatus = failedCount > 0 || skippedCount > 0 || skippedSizeUnavailableCount > 0 ? 'partial' : 'complete'
  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'done', skippedCount, skippedSizeUnavailableCount, failedCount })
  if (track) writeBatchLog({ createdAt: Date.now(), source: baseTitle, sourceType: 'selected', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: finalStatus })
  if (notifyOnComplete && Notification.isSupported()) {
    const body = (skippedCount + skippedSizeUnavailableCount + failedCount) > 0
      ? `Saved ${downloadedCount}, skipped ${skippedCount + skippedSizeUnavailableCount + failedCount} from "${baseTitle}"`
      : `Saved ${total} photos from "${baseTitle}"`
    new Notification({ title: 'FlickrFetch', body }).show()
  }
  if (openFinderOnComplete && lastFilePath) {
    shell.showItemInFolder(lastFilePath)
  }
}

function discoverMetadata(metadata: MetadataSettings): MetadataSettings {
  return { ...metadata, embedCreator: true, embedLicense: true, embedPhotoUrl: true, embedPhotoId: true }
}

async function runDiscoverSelectedBatch(photos: { id: string; title: string }[], albumTitle: string, targetFolder: string, track = true): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return
  const { fileNaming, showDockProgress, notifyOnComplete, conflictBehavior, downloadSize, openFinderOnComplete, metadata } = loadSettings()
  const forcedMetadata = discoverMetadata(metadata)
  ensureDownloadFolder(targetFolder)

  const sendProgress = (p: Omit<BatchProgress, 'queuedCount' | 'queuedAlbums'>): void => {
    const full = { ...p, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
    lastBatchProgress = full
    mainWindow?.webContents.send('batch:progress', full)
    if (showDockProgress) {
      if (p.status === 'running' && p.total > 0) mainWindow?.setProgressBar(p.current / p.total)
      else mainWindow?.setProgressBar(-1)
    }
  }

  const total = photos.length
  sendProgress({ current: 0, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', allTitles: photos.map(p => p.title) })

  let seqNum = 1
  let lastFilePath: string | null = null
  let skippedCount = 0
  let skippedSizeUnavailableCount = 0
  let failedCount = 0
  let downloadedCount = 0

  for (let i = 0; i < photos.length; i++) {
    if (activeBatchController?.signal.aborted) {
      sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
      if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'discover', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled' })
      return
    }
    const photo = photos[i]
    sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
    try {
      const [sizes, photoInfo] = await Promise.all([
        withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
        withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
      ])
      const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, seqNum++, downloadSize)
      const outcome = await downloadToFolder(sizes, filename, targetFolder, activeBatchController?.signal, photoInfo, conflictBehavior, downloadSize, forcedMetadata)
      if (outcome.status === 'downloaded') {
        downloadedCount++
        lastFilePath = outcome.filePath
        if (track) writeDiscoverRecord(photo.id, 0, photo.title, photo.thumbnailUrl ?? '', albumTitle)
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: outcome.filePath, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      } else if (outcome.reason === 'size-unavailable') {
        skippedSizeUnavailableCount++
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      } else {
        skippedCount++
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError' || activeBatchController?.signal.aborted) {
        sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
        if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'discover', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled' })
        return
      }
      failedCount++
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
    }
  }

  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'done', skippedCount, skippedSizeUnavailableCount, failedCount })
  const finalStatus = failedCount > 0 || skippedCount > 0 || skippedSizeUnavailableCount > 0 ? 'partial' : 'complete'
  if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'discover', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: finalStatus })
  if (notifyOnComplete && Notification.isSupported()) {
    const body = (skippedCount + skippedSizeUnavailableCount + failedCount) > 0
      ? `Saved ${downloadedCount}, skipped ${skippedCount + skippedSizeUnavailableCount + failedCount} from "${albumTitle}"`
      : `Saved ${total} photos from "${albumTitle}"`
    new Notification({ title: 'FlickrFetch', body }).show()
  }
  if (openFinderOnComplete && lastFilePath) shell.showItemInFolder(lastFilePath)
}

async function runDiscoverPublicBatch(
  fetchPage: (page: number) => Promise<{ photos: { id: string; title: string; lastUpdate?: number; thumbnailUrl: string }[]; pages: number }>,
  albumTitle: string,
  targetFolder: string,
  track: boolean,
  smartMode?: 'updated' | 'never-downloaded',
  batchSourceType: 'discover_people' | 'discover_groups' = 'discover_people'
): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return

  const { fileNaming, showDockProgress, notifyOnComplete, conflictBehavior, downloadSize, openFinderOnComplete, metadata } = loadSettings()
  const forcedMetadata = discoverMetadata(metadata)
  ensureDownloadFolder(targetFolder)

  const sendProgress = (p: Omit<BatchProgress, 'queuedCount' | 'queuedAlbums'>): void => {
    const full = { ...p, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
    lastBatchProgress = full
    mainWindow?.webContents.send('batch:progress', full)
    if (showDockProgress) {
      if (p.status === 'running' && p.total > 0) mainWindow?.setProgressBar(p.current / p.total)
      else mainWindow?.setProgressBar(-1)
    }
  }

  const allPhotos: { id: string; title: string; lastUpdate?: number; thumbnailUrl: string }[] = []
  let page = 1
  let pages = 1
  do {
    const result = await fetchPage(page)
    allPhotos.push(...result.photos)
    pages = result.pages
    page++
  } while (page <= pages)

  let filteredPhotos = allPhotos
  const preSmartTotal = filteredPhotos.length

  if (smartMode === 'never-downloaded' || smartMode === 'updated') {
    const recordMap = getDiscoverRecordsBatch(filteredPhotos.map(p => p.id))
    if (smartMode === 'never-downloaded') {
      filteredPhotos = filteredPhotos.filter(p => !recordMap.has(p.id))
    } else {
      filteredPhotos = filteredPhotos.filter(p => {
        const rec = recordMap.get(p.id)
        return rec != null && (p.lastUpdate ?? 0) > rec.flickrLastUpdate
      })
    }
  }

  const total = filteredPhotos.length
  sendProgress({ current: 0, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', allTitles: filteredPhotos.map(p => p.title) })

  let seqNum = 1
  let lastFilePath: string | null = null
  let skippedCount = 0
  let skippedSizeUnavailableCount = 0
  let failedCount = 0
  let downloadedCount = 0

  for (let i = 0; i < filteredPhotos.length; i++) {
    if (activeBatchController?.signal.aborted) {
      sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
      if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: batchSourceType, total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled' })
      return
    }
    const photo = filteredPhotos[i]
    sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
    try {
      const [sizes, photoInfo] = await Promise.all([
        withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
        withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
      ])
      const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, seqNum++, downloadSize)
      const outcome = await downloadToFolder(sizes, filename, targetFolder, activeBatchController?.signal, photoInfo, conflictBehavior, downloadSize, forcedMetadata)
      if (outcome.status === 'downloaded') {
        downloadedCount++
        lastFilePath = outcome.filePath
        if (track) writeDiscoverRecord(photo.id, photo.lastUpdate ?? 0, photo.title, photo.thumbnailUrl, albumTitle)
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: outcome.filePath, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      } else if (outcome.reason === 'size-unavailable') {
        skippedSizeUnavailableCount++
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      } else {
        skippedCount++
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError' || activeBatchController?.signal.aborted) {
        sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
        if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: batchSourceType, total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled' })
        return
      }
      failedCount++
      process.stderr.write(`[flickrfetch] discover batch skip ${photo.id}: ${err}\n`)
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
    }
  }

  const finalStatus = failedCount > 0 || skippedCount > 0 || skippedSizeUnavailableCount > 0 ? 'partial' : 'complete'
  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'done', skippedCount, skippedSizeUnavailableCount, failedCount, smartFilteredCount: preSmartTotal - total })
  if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: batchSourceType, total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: finalStatus })
  if (notifyOnComplete && Notification.isSupported()) {
    const body = (skippedCount + skippedSizeUnavailableCount + failedCount) > 0
      ? `Saved ${downloadedCount}, skipped ${skippedCount + skippedSizeUnavailableCount + failedCount} from "${albumTitle}"`
      : `Saved ${total} photos from "${albumTitle}"`
    new Notification({ title: 'FlickrFetch', body }).show()
  }
  if (openFinderOnComplete && lastFilePath) shell.showItemInFolder(lastFilePath)
}

async function runDiscoverUserBatch(nsid: string, albumTitle: string, targetFolder: string, track: boolean, smartMode?: 'updated' | 'never-downloaded'): Promise<void> {
  const tokenData = loadToken()
  if (!tokenData) return
  await runDiscoverPublicBatch(
    page => getPublicPhotos(nsid, tokenData, page).then(r => ({ photos: r.photos.map(p => ({ id: p.id, title: p.title, lastUpdate: p.lastUpdate, thumbnailUrl: p.thumbnailUrl })), pages: r.pages })),
    albumTitle, targetFolder, track, smartMode, 'discover_people'
  )
}

async function runDiscoverGroupBatch(groupId: string, albumTitle: string, targetFolder: string, track: boolean, smartMode?: 'updated' | 'never-downloaded'): Promise<void> {
  const tokenData = loadToken()
  if (!tokenData) return
  await runDiscoverPublicBatch(
    page => getGroupPhotos(groupId, tokenData, page).then(r => ({ photos: r.photos.map(p => ({ id: p.id, title: p.title, lastUpdate: p.lastUpdate, thumbnailUrl: p.thumbnailUrl })), pages: r.pages })),
    albumTitle, targetFolder, track, smartMode, 'discover_groups'
  )
}

async function runPhotostreamBatch(albumTitle: string, track = true, smartMode?: 'updated' | 'never-downloaded', privacyFilter?: string, sort?: string): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return

  const { fileNaming, downloadFolder, showDockProgress, notifyOnComplete, conflictBehavior, downloadSize, openFinderOnComplete, metadata } = loadSettings()
  ensureDownloadFolder(downloadFolder)

  const sendProgress = (p: Omit<BatchProgress, 'queuedCount' | 'queuedAlbums'>): void => {
    const full = { ...p, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
    lastBatchProgress = full
    mainWindow?.webContents.send('batch:progress', full)
    if (showDockProgress) {
      if (p.status === 'running' && p.total > 0) {
        mainWindow?.setProgressBar(p.current / p.total)
      } else {
        mainWindow?.setProgressBar(-1)
      }
    }
  }

  // Collect all photos from photostream
  const allPhotos: { id: string; title: string; lastUpdate?: number }[] = []

  if (smartMode === 'updated') {
    // Use recentlyUpdated API — 90-day window
    const minDate = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)
    let page = 1
    let pages = 1
    do {
      const result = await getRecentlyUpdated(tokenData, minDate, page)
      allPhotos.push(...result.photos.map(p => ({ id: p.id, title: p.title, lastUpdate: p.lastUpdate })))
      pages = result.pages
      page++
    } while (page <= pages)
  } else {
    // Load all pages of photostream
    let page = 1
    let pages = 1
    do {
      const result = await getPhotos(tokenData, page, sort)
      allPhotos.push(...result.photos.map(p => ({ id: p.id, title: p.title, lastUpdate: p.lastUpdate })))
      pages = result.pages
      page++
    } while (page <= pages)
  }

  let filteredPhotos = allPhotos

  // Apply privacy filter
  if (privacyFilter && privacyFilter !== 'all') {
    // Privacy info not available in photostream batch — skip filter
  }

  const preSmartTotal = filteredPhotos.length

  // Smart mode filtering
  if (smartMode === 'never-downloaded' || smartMode === 'updated') {
    const recordMap = getPhotoRecordsBatch(filteredPhotos.map(p => p.id))
    if (smartMode === 'never-downloaded') {
      filteredPhotos = filteredPhotos.filter(p => !recordMap.has(p.id))
    } else {
      filteredPhotos = filteredPhotos.filter(p => {
        const rec = recordMap.get(p.id)
        return rec != null && (p.lastUpdate ?? 0) > rec.flickrLastUpdate
      })
    }
  }

  const total = filteredPhotos.length
  sendProgress({
    current: 0, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null,
    status: 'running', allTitles: filteredPhotos.map(p => p.title)
  })

  let seqNum = 1
  let lastFilePath: string | null = null
  let skippedCount = 0
  let failedCount = 0
  let downloadedCount = 0

  for (let i = 0; i < filteredPhotos.length; i++) {
    if (activeBatchController?.signal.aborted) {
      sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, failedCount })
      if (track) writeBatchLog({ createdAt: Date.now(), source: 'Photostream', sourceType: 'photostream', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled' })
      return
    }

    const photo = filteredPhotos[i]
    sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running', skippedCount, failedCount })

    try {
      const [sizes, photoInfo] = await Promise.all([
        withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
        withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
      ])
      const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, seqNum++, downloadSize)
      const outcome = await downloadToFolder(sizes, filename, downloadFolder, activeBatchController?.signal, photoInfo, conflictBehavior, downloadSize, metadata)
      if (outcome.status === 'downloaded') {
        downloadedCount++
        lastFilePath = outcome.filePath
        if (track) writePhotoRecord(photo.id, photo.lastUpdate ?? 0, photo.title, photo.thumbnailUrl)
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: outcome.filePath, status: 'running', skippedCount, failedCount })
      } else {
        skippedCount++
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', skippedCount, failedCount })
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError' || activeBatchController?.signal.aborted) {
        sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, failedCount })
        if (track) writeBatchLog({ createdAt: Date.now(), source: 'Photostream', sourceType: 'photostream', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled' })
        return
      }
      failedCount++
      process.stderr.write(`[flickrfetch] batch skip ${photo.id}: ${err}\n`)
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running', skippedCount, failedCount })
    }
  }

  const finalStatus = failedCount > 0 || skippedCount > 0 ? 'partial' : 'complete'
  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'done', skippedCount, failedCount, smartFilteredCount: preSmartTotal - total })
  if (track) writeBatchLog({ createdAt: Date.now(), source: 'Photostream', sourceType: 'photostream', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: finalStatus })
  if (notifyOnComplete && Notification.isSupported()) {
    const body = (skippedCount + failedCount) > 0
      ? `Saved ${downloadedCount}, skipped ${skippedCount + failedCount} from Photostream`
      : `Saved ${total} photos from Photostream`
    new Notification({ title: 'FlickrFetch', body }).show()
  }
  if (openFinderOnComplete && lastFilePath) {
    shell.showItemInFolder(lastFilePath)
  }
}

// Discover IPC handlers
ipcMain.handle('discover:findUser', async (_event, query: string): Promise<DiscoverUser> => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return findDiscoverUser(query, tokenData)
})

ipcMain.handle('discover:getPublicPhotos', async (_event, nsid: string, page: number = 1) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getPublicPhotos(nsid, tokenData, page)
})

ipcMain.handle('discover:getUserAlbums', async (_event, nsid: string, page: number = 1) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getUserPublicAlbums(nsid, tokenData, page)
})

ipcMain.handle('discover:getAlbumPhotos', async (_event, ownerNsid: string, albumId: string, page: number = 1) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getPublicAlbumPhotos(albumId, ownerNsid, tokenData, page)
})

ipcMain.handle('discover:getContacts', async (): Promise<DiscoverContact[]> => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getContacts(tokenData)
})

ipcMain.handle('discover:getMyGroups', async (): Promise<DiscoverGroup[]> => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getUserGroups(tokenData)
})

ipcMain.handle('discover:getGroupPhotos', async (_event, groupId: string, page: number = 1) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getGroupPhotos(groupId, tokenData, page)
})

ipcMain.handle('discover:getInterestingness', async (_event, page: number = 1) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getInterestingness(tokenData, page)
})

ipcMain.handle('discover:downloadPhoto', async (_event, photoId: string, photoTitle: string, downloadSize?: DownloadSize, thumbnailUrl = '', lastUpdate = 0, source = '') => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  if (!mainWindow) throw new Error('No window')
  const { metadata } = loadSettings()
  const forcedMetadata = discoverMetadata(metadata)
  const [sizes, photoInfo] = await Promise.all([
    getPhotoSizes(photoId, tokenData),
    getPhotoInfo(photoId, tokenData)
  ])
  const filePath = await downloadPhoto(sizes, photoTitle, mainWindow, activeDownloadController?.signal, photoInfo, forcedMetadata, downloadSize)
  if (filePath && lastUpdate !== undefined) writeDiscoverRecord(photoId, lastUpdate, photoTitle, thumbnailUrl, source)
  return { filePath }
})

ipcMain.handle('batch:startDiscoverUser', (_event, nsid: string, username: string, displayTitle: string, track = true, smartMode?: 'updated' | 'never-downloaded') => {
  const { downloadFolder } = loadSettings()
  const safeUsername = username.replace(/[/\\:*?"<>|]/g, '_').trim()
  const discoverFolder = join(downloadFolder, 'Users', safeUsername)
  enqueueBatch({ type: 'discover-user', albumTitle: displayTitle, discoverNsid: nsid, discoverFolder, track, smartMode })
})

ipcMain.handle('batch:startDiscoverGroup', (_event, groupId: string, groupName: string, displayTitle: string, track = true, smartMode?: 'updated' | 'never-downloaded') => {
  const { downloadFolder } = loadSettings()
  const safeGroupName = groupName.replace(/[/\\:*?"<>|]/g, '_').trim()
  const discoverFolder = join(downloadFolder, 'Groups', safeGroupName)
  enqueueBatch({ type: 'discover-group', albumTitle: displayTitle, discoverGroupId: groupId, discoverFolder, track, smartMode })
})

ipcMain.handle('batch:startDiscoverSelected', (_event, photos: { id: string; title: string }[], displayTitle: string, folderParts: string[], track = true) => {
  const { downloadFolder } = loadSettings()
  const safeParts = folderParts.map((s: string) => s.replace(/[/\\:*?"<>|]/g, '_').trim()).filter(Boolean)
  const discoverFolder = join(downloadFolder, ...safeParts)
  ensureDownloadFolder(discoverFolder)
  enqueueBatch({ type: 'discover-selected', photos, albumTitle: displayTitle, discoverFolder, track })
})

ipcMain.handle('batch:startAlbum', (_event, albumId: string, albumTitle: string, photoCount?: number, videoCount?: number, force?: boolean, mediaType?: 'photo' | 'video', privacyFilter?: string, track = true, smartMode?: 'updated' | 'never-downloaded') => {
  if (!force) {
    const isDuplicate =
      (activeBatchController !== null && activeBatchAlbumId === albumId) ||
      batchQueue.some(j => j.type === 'album' && j.albumId === albumId)
    if (isDuplicate) return { alreadyQueued: true }
  }
  enqueueBatch({ type: 'album', albumId, albumTitle, photoCount, videoCount, mediaType, privacyFilter, track, smartMode })
  return { alreadyQueued: false }
})

ipcMain.handle('batch:startSelected', (_event, photos: { id: string; title: string }[], albumTitle: string, track = true) => {
  enqueueBatch({ type: 'selected', photos, albumTitle, track })
})

ipcMain.handle('batch:startPhotostream', (_event, albumTitle: string, track = true, smartMode?: 'updated' | 'never-downloaded', privacyFilter?: string, sort?: string) => {
  enqueueBatch({ type: 'album', albumId: '__photostream__', albumTitle, track, smartMode, privacyFilter })
  // Note: photostream jobs are run via runPhotostreamBatch — dispatched below
})

ipcMain.on('batch:cancel', () => {
  batchQueue = []
  activeBatchController?.abort()
})

ipcMain.on('batch:skipCurrent', () => {
  activeBatchController?.abort()
})

ipcMain.handle('batch:removeFromQueue', (_event, id: string) => {
  batchQueue = batchQueue.filter(j => j.id !== id)
  if (lastBatchProgress) {
    mainWindow?.webContents.send('batch:progress', {
      ...lastBatchProgress,
      queuedCount: batchQueue.length,
      queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount }))
    } satisfies BatchProgress)
  }
})

// Open the saved file's location in Finder
ipcMain.on('shell:showInFinder', (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

// Open an external URL (mailto, https, etc.) in the default app
ipcMain.on('shell:openExternal', (_event, url: string) => {
  shell.openExternal(url)
})

// Native confirmation dialog
ipcMain.handle('shell:confirm', async (_event, message: string, detail?: string) => {
  if (!mainWindow) return false
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Cancel', 'Queue Again'],
    defaultId: 1,
    message,
    detail
  })
  return response === 1
})

// Sign out: clear the stored token
ipcMain.handle('auth:signout', () => {
  clearToken()
})

// Download history DB
ipcMain.handle('db:getBatchLog', () => getBatchLog())
ipcMain.handle('db:getPhotoRecord', (_event, photoId: string) => getPhotoRecord(photoId))
ipcMain.handle('db:getPhotoRecordsBatch', (_event, photoIds: string[]) => {
  const map = getPhotoRecordsBatch(photoIds)
  return Object.fromEntries(map)
})
ipcMain.handle('db:clearHistory', () => clearAllHistory())
ipcMain.handle('db:searchPhotoRecords', (_event, query: { title?: string; photoId?: string; dateMin?: number; dateMax?: number }) => searchPhotoRecords(query))
ipcMain.handle('db:deletePhotoRecord', (_event, photoId: string) => deletePhotoRecord(photoId))
ipcMain.handle('db:deletePhotoRecords', (_event, photoIds: string[]) => deletePhotoRecords(photoIds))
ipcMain.handle('db:clearPhotoRecords', (_event, beforeMs?: number, afterMs?: number) => clearPhotoRecords(beforeMs, afterMs))
ipcMain.handle('db:searchDiscoverRecords', (_event, query: { title?: string; photoId?: string; dateMin?: number; dateMax?: number }) => searchDiscoverRecords(query))
ipcMain.handle('db:deleteDiscoverRecord', (_event, photoId: string) => deleteDiscoverRecord(photoId))
ipcMain.handle('db:deleteDiscoverRecords', (_event, photoIds: string[]) => deleteDiscoverRecords(photoIds))
ipcMain.handle('db:clearDiscoverRecords', (_event, beforeMs?: number, afterMs?: number) => clearDiscoverRecords(beforeMs, afterMs))

// Pin userData to the app name used at launch so upgrades don't change the path
app.setPath('userData', join(app.getPath('appData'), 'flickr-fetch'))

app.whenReady().then(() => {
  try {
    openDatabase()
  } catch (err) {
    process.stderr.write(`[flickrfetch] DB open failed, continuing without history: ${err}\n`)
  }
  // Build the macOS app menu with a proper About item
  const appName = app.getName()
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: appName,
      submenu: [
        {
          label: 'About FlickrFetch',
          click: () => {
            mainWindow?.webContents.send('app:showAbout', { version: app.getVersion() })
          }
        },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'Cmd+,',
          click: () => mainWindow?.webContents.send('app:openSettings')
        },
        {
          label: 'History',
          accelerator: 'Cmd+Shift+H',
          click: () => mainWindow?.webContents.send('app:openHistory')
        },
        {
          label: 'Open Downloads Folder',
          accelerator: 'Cmd+Shift+O',
          click: async () => {
            const settings = loadSettings()
            await ensureDownloadFolder(settings.downloadFolder)
            shell.openPath(settings.downloadFolder)
          }
        },
        { type: 'separator' },
        {
          label: 'Sign Out',
          click: () => mainWindow?.webContents.send('app:signOut')
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'FlickrFetch on GitHub',
          click: () => shell.openExternal('https://github.com/wallyg/FlickrFetch')
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

  const splash = createSplash()
  createWindow()

  mainWindow!.once('ready-to-show', () => {
    setTimeout(() => {
      splash.close()
      mainWindow!.show()
    }, 1500)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      mainWindow!.once('ready-to-show', () => mainWindow!.show())
    }
  })
})

app.on('will-quit', async (event) => {
  event.preventDefault()
  closeDatabase()
  await endExifTool()
  app.exit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
