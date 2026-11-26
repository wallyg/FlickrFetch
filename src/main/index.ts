import './dataFolder'   // first on purpose: it chooses the data folder before the sign-in and settings modules look for their files
import { app, BrowserWindow, ipcMain, shell, dialog, Menu, Notification, clipboard } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join, basename } from 'path'
import { tmpdir } from 'os'
import { readFileSync, mkdirSync, rmSync, createWriteStream } from 'fs'
import archiver from 'archiver'
import { startOAuthFlow, verifyOAuth, loadToken, clearToken } from './auth'
import { SignInRevokedError } from './signInCheck'
import { getUserInfo, getPhotos, getPhotoSizes, getPhotoInfo, getPhotoExif, getAlbums, getAlbumPhotos, getPublicAlbumPhotos, getCollectionTree, getDiscoverCollectionTree, resolveVideoUrl, getRecentlyUpdated, findDiscoverUser, getPublicPhotos, getUserPublicAlbums, getContacts, getUserGroups, getGroupPhotos, getInterestingness } from './flickr'
import { downloadPhoto, downloadToFolder, describeSize } from './downloader'
import { noteSize, resetSizeTally, smallerSoFar } from './sizeTally'
import { changedSinceSaved } from './smartFilter'
import { endExifTool } from './exiftool'
import { loadSettings, saveSettings, resetSettings, ensureDownloadFolder } from './settings'
import { registerTagIpc } from './tagIndex'
import { registerAuditIpc } from './tagAudit'
import { registerHealthIpc } from './photoHealth'
import { registerFineIpc } from './fineReasons'
import { registerAlbumsIpc } from './albumChecks'
import { registerMapIpc } from './mapPoints'
import { registerTileIpc } from './mapTiles'
import { registerDatesIpc } from './dateViews'
import { registerShareIpc } from './share'
import { registerBatchIpc, batchUrl } from './batchEdit'
import { registerBackupIpc } from './backupReport'
import { safeFolderName } from './safeName'
import { buildFilename } from './fileNaming'
import { selectedPlace } from './batchFolder'
import { privacyLevelOf } from '../shared/privacy'
import { collectionAlbums } from '../shared/collections'
import { ownerNsid, forgetOwnerNsid } from './owner'
import { openDatabase, closeDatabase, writeBatchLog, writePhotoRecord, getPhotoRecord, getPhotoRecordsBatch, getBatchLog, clearBatchLog, searchPhotoRecords, deletePhotoRecord, deletePhotoRecords, clearPhotoRecords, writeDiscoverRecord, getDiscoverRecordsBatch, searchDiscoverRecords, deleteDiscoverRecord, deleteDiscoverRecords, clearDiscoverRecords } from './database'
import type { AppSettings, BatchProgress, DownloadSize, CameraExif, PhotoSearchParams, MetadataSettings, DiscoverUser, DiscoverContact, DiscoverGroup } from '../shared/types'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms))
  ])
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
    minWidth: 560,    // provisional (24 Nov 2026): the owner wants to go narrow; first try 728 pt was fine, then "narrower". Raise it if screens break below this.
    minHeight: 520,
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

  // The window only ever shows the app itself. A link or script that tries to open or go to a web page is sent to the browser instead,
  // so a web page can never load inside the window (where it would be handed the app's own functions).
  const appUrl = process.env['ELECTRON_RENDERER_URL']
  const external = (url: string): void => { if (/^https?:\/\//i.test(url)) void shell.openExternal(url) }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' } })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://') || (appUrl && url.startsWith(appUrl))) return
    event.preventDefault()
    external(url)
  })

  // If the page itself dies (not just a screen error, which the app handles), say so and offer to start it again instead of leaving a blank window.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit' || !mainWindow) return
    void dialog.showMessageBox(mainWindow, {
      type: 'warning', message: 'FlickrFetch stopped working', detail: 'Your photos and settings are safe, and downloads in progress keep going. Reload to start the window again.',
      buttons: ['Reload', 'Quit'], defaultId: 0, cancelId: 1
    }).then(r => { if (r.response === 0) mainWindow?.webContents.reload(); else app.quit() }).catch(() => { /* the window is already gone */ })
  })

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
      throw new Error('Flickr is asking us to slow down. Wait 30 seconds, then try again.')
    }
    if (status === 401) {
      process.stderr.write('[flickrfetch] auth:start was refused with HTTP 401 (check the API key and secret)\n')
      throw new Error('Flickr turned down the sign-in. Try again in a little while.')
    }
    throw new Error('Couldn\'t reach Flickr. Check your internet connection, then try again.')
  }
})

// Step 2: Exchange the verifier code the user typed in for an access token
ipcMain.handle('auth:verify', async (_event, verifierCode: string) => {
  try {
    const tokenData = await verifyOAuth(verifierCode.trim())
    const user = await getUserInfo(tokenData)
    process.stderr.write(`[flickrfetch] auth:verify SUCCESS: ${user.username}\n`)
    return { user }
  } catch (err: unknown) {
    process.stderr.write(`[flickrfetch] auth:verify ERROR: ${err instanceof Error ? err.message : String(err)}\n`)
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 401) {
      throw new Error('That code is not right. Check it and try again.')
    }
    throw new Error('Couldn\'t check the code. Press Reopen Flickr to start again.')
  }
})

// Return the current auth state (user info if logged in, null if not)
ipcMain.handle('auth:getState', async () => {
  const tokenData = loadToken()
  if (!tokenData) return { user: null }

  try {
    const user = await getUserInfo(tokenData)
    return { user }
  } catch (err) {
    // Only a sign-in that Flickr has taken back signs the user out here; getUserInfo reports nothing else
    if (!(err instanceof SignInRevokedError)) throw err
    clearToken()
    forgetOwnerNsid()
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
  const controller = new AbortController()
  activeDownloadController = controller
  try {
    const [sizes, photoInfo] = await Promise.all([
      getPhotoSizes(photoId, tokenData),
      getPhotoInfo(photoId, tokenData)
    ])
    const { fileNaming, metadata, downloadSize: globalDownloadSize } = loadSettings()
    const effectiveSize = downloadSize ?? globalDownloadSize
    const filename = buildFilename(fileNaming, photoId, photoTitle, photoInfo, undefined, effectiveSize)
    const filePath = await downloadPhoto(sizes, filename, mainWindow, controller.signal, photoInfo, metadata, effectiveSize)
    if (filePath && track) writePhotoRecord(photoId, lastUpdate, photoTitle, thumbnailUrl, describeSize(sizes, effectiveSize))
    return { filePath }
  } finally {
    if (activeDownloadController === controller) activeDownloadController = null   // (not another download's, started since)
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
// Merged with what is saved, so a panel that only knows some settings (the Settings window) cannot erase the others
ipcMain.handle('settings:set', (_event, settings: Partial<AppSettings>) => saveSettings({ ...loadSettings(), ...settings }))
ipcMain.handle('settings:reset', () => resetSettings())
ipcMain.handle('video:resolveUrl', (_event, sourceUrl: string) => resolveVideoUrl(sourceUrl))

// Tags tab: local tag index (scan, browse, count)
registerTagIpc(() => mainWindow)
registerAuditIpc(() => mainWindow)
registerHealthIpc(() => mainWindow)
registerFineIpc(() => mainWindow)
registerAlbumsIpc(() => mainWindow)
registerMapIpc()
registerTileIpc()
registerDatesIpc(() => mainWindow)
registerShareIpc(() => mainWindow)
registerBatchIpc()
registerBackupIpc()

// Folder picker dialog
ipcMain.handle('shell:pickFolder', async () => {
  if (!mainWindow) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  })
  return canceled ? null : filePaths[0]
})

// Batch downloads
async function zipFolder(
  sourceDir: string,
  zipPath: string,
  manifest: { source: string; exportedAt: string; photos: { id: string; title: string; filename: string }[] }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })
    output.on('close', resolve)
    output.on('error', reject)
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })
    archive.finalize()
  })
}

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
  folderName?: string          // 'selected' downloads: the folder inside the download folder ('' = the download folder itself)
  targetFolder?: string        // 'selected' downloads started by Try again: the exact folder the first try used
  sort?: string                // photostream order, so file numbers follow the order that was chosen
  // Discover-specific
  discoverNsid?: string        // user NSID for discover-user batch
  discoverGroupId?: string     // group ID for discover-group batch
  discoverFolder?: string      // target subfolder override
  // Collections
  collectionPath?: string[]    // folders for collection batch downloads: the collection, then any sub-collection the album sits in
  // Export
  zipMode?: boolean             // zip all downloads into a single archive
}

let batchQueue: BatchJob[] = []
let activeBatchController: AbortController | null = null
let activeBatchAlbumId: string | null = null
let lastBatchProgress: BatchProgress | null = null
let batchIdCounter = 0
let isPaused = false
let resumeResolve: (() => void) | null = null

async function waitIfPaused(): Promise<void> {
  if (!isPaused) return
  await new Promise<void>(resolve => { resumeResolve = resolve })
}

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
  resetSizeTally()   // the count of photos that came down smaller starts again for each batch (#126)
  try {
    if (job.type === 'selected') {
      await runSelectedBatch(job.photos!, job.albumTitle, job.track ?? true, job.zipMode, job.folderName, job.targetFolder)
    } else if (job.type === 'discover-selected') {
      await runDiscoverSelectedBatch(job.photos!, job.albumTitle, job.discoverFolder!, job.track ?? true)
    } else if (job.type === 'discover-user') {
      await runDiscoverUserBatch(job.discoverNsid!, job.albumTitle, job.discoverFolder!, job.track ?? true, job.smartMode)
    } else if (job.type === 'discover-group') {
      await runDiscoverGroupBatch(job.discoverGroupId!, job.albumTitle, job.discoverFolder!, job.track ?? true, job.smartMode)
    } else if (job.albumId === '__photostream__') {
      await runPhotostreamBatch(job.albumTitle, job.track ?? true, job.smartMode, job.privacyFilter, job.sort, job.zipMode)
    } else {
      await runAlbumBatch(job.albumId!, job.albumTitle, job.mediaType, job.privacyFilter, job.track ?? true, job.smartMode, job.collectionPath, job.zipMode)
    }
  } catch (err) {
    process.stderr.write(`[flickrfetch] batch error: ${err}\n`)
    mainWindow?.webContents.send('batch:progress', {
      current: 0, total: 0, albumTitle: job.albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null,
      status: 'error', error: String(err), queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount }))
    } satisfies BatchProgress)
  }
  activeBatchController = null
  activeBatchAlbumId = null   // a batch that failed must not stay marked as running
  runNextBatch()
}

async function runAlbumBatch(albumId: string, albumTitle: string, mediaType?: 'photo' | 'video', privacyFilter?: string, track = true, smartMode?: 'updated' | 'never-downloaded', collectionPath?: string[], zipMode = false): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return

  activeBatchAlbumId = albumId
  const { fileNaming, downloadFolder, showDockProgress, notifyOnComplete, conflictBehavior, downloadSize, openFinderOnComplete, metadata } = loadSettings()
  const safeAlbumTitle = safeFolderName(albumTitle)
  const safeCollectionParts = (collectionPath ?? []).map(safeFolderName).filter(Boolean)
  const zipParentDir = join(downloadFolder, ...safeCollectionParts)
  const albumFolder = join(zipParentDir, safeAlbumTitle)

  const tempDir = zipMode ? join(tmpdir(), `ff-zip-${Date.now()}`) : null
  if (tempDir) mkdirSync(tempDir, { recursive: true })
  const downloadDir = tempDir ?? albumFolder
  if (!tempDir) ensureDownloadFolder(albumFolder)
  else ensureDownloadFolder(zipParentDir)

  const sendProgress = (p: Omit<BatchProgress, 'queuedCount' | 'queuedAlbums'>): void => {
    const full = { ...p, saveFolder: tempDir ? undefined : albumFolder, zipMode: !!tempDir, smallerCount: smallerSoFar(), paused: isPaused, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
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
  const allPhotos: { id: string; title: string; ispublic?: number; isfriend?: number; isfamily?: number; lastUpdate?: number; thumbnailUrl?: string }[] = []

  do {
    const result = await getAlbumPhotos(albumId, tokenData, page, mediaType)
    allPhotos.push(...result.photos.map((p) => ({ id: p.id, title: p.title, ispublic: p.ispublic, isfriend: p.isfriend, isfamily: p.isfamily, lastUpdate: p.lastUpdate })))
    pages = result.pages
    page++
  } while (page <= pages)

  let privacyFiltered = (!privacyFilter || privacyFilter === 'all')
    ? allPhotos
    : allPhotos.filter(p => privacyLevelOf(p) === privacyFilter)

  const preSmartTotal = privacyFiltered.length

  // Smart mode filtering (requires DB records)
  if (smartMode) {
    const recordMap = getPhotoRecordsBatch(privacyFiltered.map(p => p.id))
    if (smartMode === 'never-downloaded') {
      privacyFiltered = privacyFiltered.filter(p => !recordMap.has(p.id))
    } else if (smartMode === 'updated') {
      privacyFiltered = privacyFiltered.filter(p => changedSinceSaved(recordMap.get(p.id), p))
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
  const written = new Set<string>()   // names saved so far in this batch: two photos with one name never replace each other
  let skippedCount = 0
  let skippedSizeUnavailableCount = 0
  let failedCount = 0
  const failedPhotos: { id: string; title: string }[] = []
  let downloadedCount = 0
  const manifestPhotos: { id: string; title: string; filename: string }[] = []

  try {
    for (let i = 0; i < filteredBatch.length; i++) {
      if (activeBatchController?.signal.aborted) {
        activeBatchAlbumId = null
        sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
        if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'album', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled', failedPhotos })
        return
      }
      await waitIfPaused()

      const photo = filteredBatch[i]
      sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })

      try {
        const [sizes, photoInfo] = await Promise.all([
          withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
          withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
        ])
        const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, albumSeqNum++, downloadSize)
        const outcome = await downloadToFolder(sizes, filename, downloadDir, activeBatchController?.signal, photoInfo, conflictBehavior, downloadSize, metadata, written)
        if (outcome.status === 'downloaded') {
          downloadedCount++
          if (!zipMode) lastFilePath = outcome.filePath
          { const size = noteSize(describeSize(sizes, downloadSize)); if (track) writePhotoRecord(photo.id, photo.lastUpdate ?? 0, photo.title, photo.thumbnailUrl, size) }
          if (zipMode) manifestPhotos.push({ id: photo.id, title: photo.title, filename: basename(outcome.filePath) })
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
          if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'album', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled', failedPhotos })
          return
        }
        failedCount++
        failedPhotos.push({ id: photo.id, title: photo.title })
        process.stderr.write(`[flickrfetch] batch skip ${photo.id}: ${err}\n`)
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      }
    }

    if (tempDir && downloadedCount > 0) {
      const { filePath: chosenPath, canceled } = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: join(zipParentDir, safeAlbumTitle + '.zip'),
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
      })
      if (!canceled && chosenPath) {
        await zipFolder(tempDir, chosenPath, { source: albumTitle, exportedAt: new Date().toISOString(), photos: manifestPhotos })
        lastFilePath = chosenPath
      }
    }
  } finally {
    if (tempDir) { try { rmSync(tempDir, { recursive: true, force: true }) } catch { /* ignore */ } }
  }

  activeBatchAlbumId = null
  const finalStatus = failedCount > 0 || skippedCount > 0 || skippedSizeUnavailableCount > 0 ? 'partial' : 'complete'
  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: zipMode ? lastFilePath : null, status: 'done', skippedCount, skippedSizeUnavailableCount, failedCount, failedPhotos, smartFilteredCount: preSmartTotal - total })
  if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'album', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: finalStatus, failedPhotos })
  if (notifyOnComplete && Notification.isSupported()) {
    const body = zipMode
      ? `Saved ${downloadedCount} photos from "${albumTitle}" as a ZIP archive`
      : (skippedCount + skippedSizeUnavailableCount + failedCount) > 0
        ? `Saved ${downloadedCount}, skipped ${skippedCount + skippedSizeUnavailableCount + failedCount} from "${albumTitle}"`
        : `Saved ${total} photos from "${albumTitle}"`
    new Notification({ title: 'FlickrFetch', body }).show()
  }
  if (openFinderOnComplete && lastFilePath) {
    shell.showItemInFolder(lastFilePath)
  }
}

async function runSelectedBatch(photos: { id: string; title: string; thumbnailUrl?: string }[], albumTitle: string, track = true, zipMode = false, folderName?: string, retryFolder?: string): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return

  const { fileNaming, downloadFolder, showDockProgress, notifyOnComplete, conflictBehavior, downloadSize, openFinderOnComplete, metadata } = loadSettings()
  const { baseTitle, folder: targetFolder, zipName, photostream } = selectedPlace({ downloadFolder, albumTitle, folderName, targetFolder: retryFolder })

  const tempDir = zipMode ? join(tmpdir(), `ff-zip-${Date.now()}`) : null
  if (tempDir) mkdirSync(tempDir, { recursive: true })
  const downloadDir = tempDir ?? targetFolder
  if (!tempDir) ensureDownloadFolder(targetFolder)
  else ensureDownloadFolder(downloadFolder)

  const sendProgress = (p: Omit<BatchProgress, 'queuedCount' | 'queuedAlbums'>): void => {
    const full = { ...p, saveFolder: tempDir ? undefined : targetFolder, zipMode: !!tempDir, smallerCount: smallerSoFar(), paused: isPaused, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
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
  const written = new Set<string>()   // names saved so far in this batch: two photos with one name never replace each other
  let skippedCount = 0
  let skippedSizeUnavailableCount = 0
  let failedCount = 0
  const failedPhotos: { id: string; title: string }[] = []
  let downloadedCount = 0
  const manifestPhotos: { id: string; title: string; filename: string }[] = []

  try {
    for (let i = 0; i < photos.length; i++) {
      if (activeBatchController?.signal.aborted) {
        sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
        if (track) writeBatchLog({ createdAt: Date.now(), source: baseTitle, sourceType: 'selected', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled', failedPhotos })
        return
      }
      await waitIfPaused()

      const photo = photos[i]
      sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })

      try {
        const [sizes, photoInfo] = await Promise.all([
          withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
          withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
        ])
        const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, selSeqNum++, downloadSize)
        const outcome = await downloadToFolder(sizes, filename, downloadDir, activeBatchController?.signal, photoInfo, conflictBehavior, downloadSize, metadata, written)
        if (outcome.status === 'downloaded') {
          downloadedCount++
          if (!zipMode) lastFilePath = outcome.filePath
          { const size = noteSize(describeSize(sizes, downloadSize)); if (track) writePhotoRecord(photo.id, 0, photo.title, photo.thumbnailUrl, size) }
          if (zipMode) manifestPhotos.push({ id: photo.id, title: photo.title, filename: basename(outcome.filePath) })
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
          if (track) writeBatchLog({ createdAt: Date.now(), source: baseTitle, sourceType: 'selected', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled', failedPhotos })
          return
        }
        failedCount++
        failedPhotos.push({ id: photo.id, title: photo.title })
        process.stderr.write(`[flickrfetch] batch skip ${photo.id}: ${err}\n`)
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      }
    }

    if (tempDir && downloadedCount > 0) {
      const dateStr = new Date().toISOString().slice(0, 10)
      const defaultZipName = photostream ? `Photostream — ${dateStr}.zip` : zipName + '.zip'
      const { filePath: chosenPath, canceled } = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: join(downloadFolder, defaultZipName),
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
      })
      if (!canceled && chosenPath) {
        await zipFolder(tempDir, chosenPath, { source: baseTitle, exportedAt: new Date().toISOString(), photos: manifestPhotos })
        lastFilePath = chosenPath
      }
    }
  } finally {
    if (tempDir) { try { rmSync(tempDir, { recursive: true, force: true }) } catch { /* ignore */ } }
  }

  const finalStatus = failedCount > 0 || skippedCount > 0 || skippedSizeUnavailableCount > 0 ? 'partial' : 'complete'
  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: zipMode ? lastFilePath : null, status: 'done', skippedCount, skippedSizeUnavailableCount, failedCount, failedPhotos })
  if (track) writeBatchLog({ createdAt: Date.now(), source: baseTitle, sourceType: 'selected', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: finalStatus, failedPhotos })
  if (notifyOnComplete && Notification.isSupported()) {
    const body = zipMode
      ? `Saved ${downloadedCount} photos from "${baseTitle}" as a ZIP archive`
      : (skippedCount + skippedSizeUnavailableCount + failedCount) > 0
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

async function runDiscoverSelectedBatch(photos: { id: string; title: string; thumbnailUrl?: string }[], albumTitle: string, targetFolder: string, track = true): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return
  const { fileNaming, showDockProgress, notifyOnComplete, conflictBehavior, downloadSize, openFinderOnComplete, metadata } = loadSettings()
  const forcedMetadata = discoverMetadata(metadata)
  ensureDownloadFolder(targetFolder)

  const sendProgress = (p: Omit<BatchProgress, 'queuedCount' | 'queuedAlbums'>): void => {
    const full = { ...p, smallerCount: smallerSoFar(), paused: isPaused, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
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
  const written = new Set<string>()   // names saved so far in this batch: two photos with one name never replace each other
  let skippedCount = 0
  let skippedSizeUnavailableCount = 0
  let failedCount = 0
  const failedPhotos: { id: string; title: string }[] = []
  let downloadedCount = 0

  for (let i = 0; i < photos.length; i++) {
    if (activeBatchController?.signal.aborted) {
      sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
      if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'discover', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled', failedPhotos })
      return
    }
    await waitIfPaused()
    const photo = photos[i]
    sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
    try {
      const [sizes, photoInfo] = await Promise.all([
        withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
        withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
      ])
      const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, seqNum++, downloadSize)
      const outcome = await downloadToFolder(sizes, filename, targetFolder, activeBatchController?.signal, photoInfo, conflictBehavior, downloadSize, forcedMetadata, written)
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
        if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'discover', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled', failedPhotos })
        return
      }
      failedCount++
      failedPhotos.push({ id: photo.id, title: photo.title })
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
    }
  }

  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'done', skippedCount, skippedSizeUnavailableCount, failedCount, failedPhotos, discoverFolder: targetFolder })
  const finalStatus = failedCount > 0 || skippedCount > 0 || skippedSizeUnavailableCount > 0 ? 'partial' : 'complete'
  if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: 'discover', total, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: finalStatus, failedPhotos })
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
    const full = { ...p, smallerCount: smallerSoFar(), paused: isPaused, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
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
      filteredPhotos = filteredPhotos.filter(p => changedSinceSaved(recordMap.get(p.id), p))
    }
  }

  const total = filteredPhotos.length
  sendProgress({ current: 0, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'running', allTitles: filteredPhotos.map(p => p.title) })

  let seqNum = 1
  let lastFilePath: string | null = null
  const written = new Set<string>()   // names saved so far in this batch: two photos with one name never replace each other
  let skippedCount = 0
  let skippedSizeUnavailableCount = 0
  let failedCount = 0
  const failedPhotos: { id: string; title: string }[] = []
  let downloadedCount = 0

  for (let i = 0; i < filteredPhotos.length; i++) {
    if (activeBatchController?.signal.aborted) {
      sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
      if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: batchSourceType, total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled', failedPhotos })
      return
    }
    await waitIfPaused()
    const photo = filteredPhotos[i]
    sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
    try {
      const [sizes, photoInfo] = await Promise.all([
        withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
        withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
      ])
      const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, seqNum++, downloadSize)
      const outcome = await downloadToFolder(sizes, filename, targetFolder, activeBatchController?.signal, photoInfo, conflictBehavior, downloadSize, forcedMetadata, written)
      if (outcome.status === 'downloaded') {
        downloadedCount++
        lastFilePath = outcome.filePath
        if (track) writeDiscoverRecord(photo.id, photo.lastUpdate ?? 0, photo.title, photo.thumbnailUrl, albumTitle.replace(/^↓\s*/, ''))
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
        if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: batchSourceType, total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled', failedPhotos })
        return
      }
      failedCount++
      failedPhotos.push({ id: photo.id, title: photo.title })
      process.stderr.write(`[flickrfetch] discover batch skip ${photo.id}: ${err}\n`)
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
    }
  }

  const finalStatus = failedCount > 0 || skippedCount > 0 || skippedSizeUnavailableCount > 0 ? 'partial' : 'complete'
  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'done', skippedCount, skippedSizeUnavailableCount, failedCount, failedPhotos, smartFilteredCount: preSmartTotal - total })
  if (track) writeBatchLog({ createdAt: Date.now(), source: albumTitle, sourceType: batchSourceType, total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: finalStatus, failedPhotos })
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

async function runPhotostreamBatch(albumTitle: string, track = true, smartMode?: 'updated' | 'never-downloaded', privacyFilter?: string, requestedSort?: string, zipMode = false): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return
  // Flickr's search call (needed for the interestingness order) stops at about 4,000 photos, so a full download uses posting order
  const sort = requestedSort?.startsWith('interestingness') ? 'date-posted-desc' : requestedSort

  const { fileNaming, downloadFolder, showDockProgress, notifyOnComplete, conflictBehavior, downloadSize, openFinderOnComplete, metadata } = loadSettings()

  const tempDir = zipMode ? join(tmpdir(), `ff-zip-${Date.now()}`) : null
  if (tempDir) mkdirSync(tempDir, { recursive: true })
  const downloadDir = tempDir ?? downloadFolder
  ensureDownloadFolder(downloadFolder)

  const sendProgress = (p: Omit<BatchProgress, 'queuedCount' | 'queuedAlbums'>): void => {
    const full = { ...p, saveFolder: tempDir ? undefined : downloadFolder, zipMode: !!tempDir, smallerCount: smallerSoFar(), paused: isPaused, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
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
  const allPhotos: { id: string; title: string; lastUpdate?: number; thumbnailUrl?: string }[] = []

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
      filteredPhotos = filteredPhotos.filter(p => changedSinceSaved(recordMap.get(p.id), p))
    }
  }

  const total = filteredPhotos.length
  sendProgress({
    current: 0, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null,
    status: 'running', allTitles: filteredPhotos.map(p => p.title)
  })

  let seqNum = 1
  let lastFilePath: string | null = null
  const written = new Set<string>()   // names saved so far in this batch: two photos with one name never replace each other
  let skippedCount = 0
  let skippedSizeUnavailableCount = 0
  let failedCount = 0
  const failedPhotos: { id: string; title: string }[] = []
  let downloadedCount = 0
  const manifestPhotos: { id: string; title: string; filename: string }[] = []

  try {
    for (let i = 0; i < filteredPhotos.length; i++) {
      if (activeBatchController?.signal.aborted) {
        sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled', skippedCount, skippedSizeUnavailableCount, failedCount })
        if (track) writeBatchLog({ createdAt: Date.now(), source: 'Photostream', sourceType: 'photostream', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled', failedPhotos })
        return
      }
      await waitIfPaused()

      const photo = filteredPhotos[i]
      sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })

      try {
        const [sizes, photoInfo] = await Promise.all([
          withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
          withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
        ])
        const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, seqNum++, downloadSize)
        const outcome = await downloadToFolder(sizes, filename, downloadDir, activeBatchController?.signal, photoInfo, conflictBehavior, downloadSize, metadata, written)
        if (outcome.status === 'downloaded') {
          downloadedCount++
          if (!zipMode) lastFilePath = outcome.filePath
          { const size = noteSize(describeSize(sizes, downloadSize)); if (track) writePhotoRecord(photo.id, photo.lastUpdate ?? 0, photo.title, photo.thumbnailUrl, size) }
          if (zipMode) manifestPhotos.push({ id: photo.id, title: photo.title, filename: basename(outcome.filePath) })
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
          if (track) writeBatchLog({ createdAt: Date.now(), source: 'Photostream', sourceType: 'photostream', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: 'cancelled', failedPhotos })
          return
        }
        failedCount++
        failedPhotos.push({ id: photo.id, title: photo.title })
        process.stderr.write(`[flickrfetch] batch skip ${photo.id}: ${err}\n`)
        sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running', skippedCount, skippedSizeUnavailableCount, failedCount })
      }
    }

    if (tempDir && downloadedCount > 0) {
      const dateStr = new Date().toISOString().slice(0, 10)
      const { filePath: chosenPath, canceled } = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: join(downloadFolder, `Photostream — ${dateStr}.zip`),
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
      })
      if (!canceled && chosenPath) {
        await zipFolder(tempDir, chosenPath, { source: 'Photostream', exportedAt: new Date().toISOString(), photos: manifestPhotos })
        lastFilePath = chosenPath
      }
    }
  } finally {
    if (tempDir) { try { rmSync(tempDir, { recursive: true, force: true }) } catch { /* ignore */ } }
  }

  const finalStatus = failedCount > 0 || skippedCount > 0 || skippedSizeUnavailableCount > 0 ? 'partial' : 'complete'
  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: zipMode ? lastFilePath : null, status: 'done', skippedCount, skippedSizeUnavailableCount, failedCount, failedPhotos, smartFilteredCount: preSmartTotal - total })
  if (track) writeBatchLog({ createdAt: Date.now(), source: 'Photostream', sourceType: 'photostream', total: preSmartTotal, downloaded: downloadedCount, skippedCollision: skippedCount, failed: failedCount, status: finalStatus, failedPhotos })
  if (notifyOnComplete && Notification.isSupported()) {
    const body = zipMode
      ? `Saved ${downloadedCount} photos from Photostream as a ZIP archive`
      : (skippedCount + skippedSizeUnavailableCount + failedCount) > 0
        ? `Saved ${downloadedCount}, skipped ${skippedCount + skippedSizeUnavailableCount + failedCount} from Photostream`
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

ipcMain.handle('discover:getPublicPhotos', async (_event, nsid: string, page: number = 1, sort?: string, search?: PhotoSearchParams) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getPublicPhotos(nsid, tokenData, page, sort, search)
})

ipcMain.handle('discover:getUserAlbums', async (_event, nsid: string, page: number = 1) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getUserPublicAlbums(nsid, tokenData, page)
})

ipcMain.handle('discover:getCollectionTree', async (_event, nsid: string) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getDiscoverCollectionTree(nsid, tokenData)
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
  const { fileNaming, metadata, downloadSize: globalDownloadSize } = loadSettings()
  const forcedMetadata = discoverMetadata(metadata)
  // Cancel works here too, and the file is named from the File naming settings, as for your own photos
  const controller = new AbortController()
  activeDownloadController = controller
  try {
    const [sizes, photoInfo] = await Promise.all([
      getPhotoSizes(photoId, tokenData),
      getPhotoInfo(photoId, tokenData)
    ])
    const effectiveSize = downloadSize ?? globalDownloadSize
    const filename = buildFilename(fileNaming, photoId, photoTitle, photoInfo, undefined, effectiveSize)
    const filePath = await downloadPhoto(sizes, filename, mainWindow, controller.signal, photoInfo, forcedMetadata, effectiveSize)
    if (filePath) writeDiscoverRecord(photoId, lastUpdate, photoTitle, thumbnailUrl, source)
    return { filePath }
  } finally {
    if (activeDownloadController === controller) activeDownloadController = null
  }
})

ipcMain.handle('batch:startDiscoverUser', (_event, nsid: string, username: string, displayTitle: string, track = true, smartMode?: 'updated' | 'never-downloaded') => {
  const { downloadFolder } = loadSettings()
  const safeUsername = safeFolderName(username)
  const discoverFolder = join(downloadFolder, 'Users', safeUsername)
  enqueueBatch({ type: 'discover-user', albumTitle: displayTitle, discoverNsid: nsid, discoverFolder, track, smartMode })
})

ipcMain.handle('batch:startDiscoverGroup', (_event, groupId: string, groupName: string, displayTitle: string, track = true, smartMode?: 'updated' | 'never-downloaded') => {
  const { downloadFolder } = loadSettings()
  const safeGroupName = safeFolderName(groupName)
  const discoverFolder = join(downloadFolder, 'Groups', safeGroupName)
  enqueueBatch({ type: 'discover-group', albumTitle: displayTitle, discoverGroupId: groupId, discoverFolder, track, smartMode })
})

ipcMain.handle('batch:startDiscoverSelected', (_event, photos: { id: string; title: string }[], displayTitle: string, folderParts: string[], track = true) => {
  const { downloadFolder } = loadSettings()
  const safeParts = folderParts.map((s: string) => safeFolderName(s)).filter(Boolean)
  const discoverFolder = join(downloadFolder, ...safeParts)
  ensureDownloadFolder(discoverFolder)
  enqueueBatch({ type: 'discover-selected', photos, albumTitle: displayTitle, discoverFolder, track })
})

ipcMain.handle('batch:retryDiscoverSelected', (_event, photos: { id: string; title: string }[], albumTitle: string, targetFolder: string) => {
  ensureDownloadFolder(targetFolder)
  enqueueBatch({ type: 'discover-selected', photos, albumTitle, discoverFolder: targetFolder, track: true })
})

ipcMain.handle('batch:startCollection', (_event, collection: import('../shared/types').FlickrCollection) => {
  // Like a single album: one already waiting or downloading is not queued again (a second click would download everything twice)
  let queued = 0, skipped = 0
  for (const { id, title, path } of collectionAlbums(collection)) {
    const already = (activeBatchController !== null && activeBatchAlbumId === id) || batchQueue.some(j => j.type === 'album' && j.albumId === id)
    if (already) { skipped++; continue }
    enqueueBatch({ type: 'album', albumId: id, albumTitle: title, collectionPath: path, track: true })
    queued++
  }
  return { queued, skipped }
})

ipcMain.handle('batch:startAlbum', (_event, albumId: string, albumTitle: string, photoCount?: number, videoCount?: number, force?: boolean, mediaType?: 'photo' | 'video', privacyFilter?: string, track = true, smartMode?: 'updated' | 'never-downloaded', zipMode?: boolean) => {
  if (!force) {
    const isDuplicate =
      (activeBatchController !== null && activeBatchAlbumId === albumId) ||
      batchQueue.some(j => j.type === 'album' && j.albumId === albumId)
    if (isDuplicate) return { alreadyQueued: true }
  }
  enqueueBatch({ type: 'album', albumId, albumTitle, photoCount, videoCount, mediaType, privacyFilter, track, smartMode, zipMode })
  return { alreadyQueued: false }
})

ipcMain.handle('batch:startSelected', (_event, photos: { id: string; title: string }[], albumTitle: string, track = true, zipMode?: boolean, folderName?: string) => {
  enqueueBatch({ type: 'selected', photos, albumTitle, track, zipMode, folderName: typeof folderName === 'string' ? folderName : undefined })
})

// Try again for photos that failed: into the folder the first try used
ipcMain.handle('batch:retrySelected', (_event, photos: { id: string; title: string }[], albumTitle: string, targetFolder: string) => {
  if (typeof targetFolder !== 'string' || targetFolder === '') return
  enqueueBatch({ type: 'selected', photos, albumTitle, track: true, targetFolder })
})

ipcMain.handle('batch:startPhotostream', (_event, albumTitle: string, track = true, smartMode?: 'updated' | 'never-downloaded', privacyFilter?: string, sort?: string, zipMode?: boolean) => {
  enqueueBatch({ type: 'album', albumId: '__photostream__', albumTitle, track, smartMode, privacyFilter, sort, zipMode })
})

ipcMain.on('batch:cancel', () => {
  batchQueue = []
  isPaused = false
  resumeResolve?.()
  resumeResolve = null
  activeBatchController?.abort()
})

ipcMain.on('batch:skipCurrent', () => {
  isPaused = false
  const r = resumeResolve
  resumeResolve = null
  r?.()
  activeBatchController?.abort()
})

ipcMain.on('batch:pause', () => {
  isPaused = true
  if (lastBatchProgress) {
    mainWindow?.webContents.send('batch:progress', { ...lastBatchProgress, paused: true })
  }
})

ipcMain.on('batch:resume', () => {
  isPaused = false
  resumeResolve?.()
  resumeResolve = null
  if (lastBatchProgress) {
    mainWindow?.webContents.send('batch:progress', { ...lastBatchProgress, paused: false })
  }
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
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return   // web and email addresses only
  shell.openExternal(url)
})

// Right-click menu on one of your own photos in a grid
ipcMain.on('photo:contextMenu', (_event, photoId: string) => {
  if (!mainWindow || !/^\d+$/.test(photoId)) return
  const nsid = ownerNsid()
  const url = nsid ? `https://www.flickr.com/photos/${nsid}/${photoId}` : `https://www.flickr.com/photo.gne?id=${photoId}`
  Menu.buildFromTemplate([
    { label: 'Open on Flickr', click: () => { void shell.openExternal(url) } },
    { label: 'Copy Flickr link', click: () => clipboard.writeText(url) },
    { type: 'separator' },
    { label: "Open in Flickr's organizer", click: () => { void shell.openExternal(batchUrl([photoId])) } }
  ]).popup({ window: mainWindow })
})

// Native confirmation dialog
ipcMain.handle('shell:confirm', async (_event, message: string, detail?: string, confirmLabel?: string) => {
  if (!mainWindow) return false
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Cancel', confirmLabel || 'OK'],
    defaultId: 1,
    message,
    detail
  })
  return response === 1
})

// Sign out: clear the stored token
ipcMain.handle('auth:signout', () => {
  clearToken()
  forgetOwnerNsid()
})

// Download history DB
ipcMain.handle('db:getBatchLog', () => getBatchLog())
ipcMain.handle('db:getPhotoRecord', (_event, photoId: string) => getPhotoRecord(photoId))
ipcMain.handle('db:getPhotoRecordsBatch', (_event, photoIds: string[]) => {
  const map = getPhotoRecordsBatch(photoIds)
  return Object.fromEntries(map)
})
// Clears the list of batches only. The record of which photos were downloaded is a separate thing (Photos tab in History) and stays.
ipcMain.handle('db:clearBatchLog', () => clearBatchLog())
ipcMain.handle('db:searchPhotoRecords', (_event, query: { title?: string; photoId?: string; dateMin?: number; dateMax?: number }) => searchPhotoRecords(query))
ipcMain.handle('db:deletePhotoRecord', (_event, photoId: string) => deletePhotoRecord(photoId))
ipcMain.handle('db:deletePhotoRecords', (_event, photoIds: string[]) => deletePhotoRecords(photoIds))
ipcMain.handle('db:clearPhotoRecords', (_event, beforeMs?: number, afterMs?: number) => clearPhotoRecords(beforeMs, afterMs))
ipcMain.handle('db:getDiscoverRecordsBatch', (_event, photoIds: string[]) => {
  const map = getDiscoverRecordsBatch(photoIds)
  return Object.fromEntries(map)
})
ipcMain.handle('db:searchDiscoverRecords', (_event, query: { title?: string; photoId?: string; dateMin?: number; dateMax?: number }) => searchDiscoverRecords(query))
ipcMain.handle('db:deleteDiscoverRecord', (_event, photoId: string) => deleteDiscoverRecord(photoId))
ipcMain.handle('db:deleteDiscoverRecords', (_event, photoIds: string[]) => deleteDiscoverRecords(photoIds))
ipcMain.handle('db:clearDiscoverRecords', (_event, beforeMs?: number, afterMs?: number) => clearDiscoverRecords(beforeMs, afterMs))

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

  if (app.isPackaged) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update:available', { version: info.version })
    })
    autoUpdater.checkForUpdates().catch(() => { /* silently ignore network errors */ })
  }

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
