import { app, BrowserWindow, ipcMain, shell, dialog, Menu, Notification } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { startOAuthFlow, verifyOAuth, loadToken, clearToken } from './auth'
import { getUserInfo, getPhotos, getPhotoSizes, getPhotoInfo, getAlbums, getAlbumPhotos, getCollectionTree } from './flickr'
import { downloadPhoto, downloadToFolder } from './downloader'
import { loadSettings, saveSettings, ensureDownloadFolder } from './settings'
import type { AppSettings, FileNamingConfig, PhotoInfo, BatchProgress } from '../shared/types'

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

function buildFilename(
  config: FileNamingConfig,
  photoId: string,
  title: string,
  info: PhotoInfo,
  seqNum?: number
): string {
  const s = config.separator
  const safeTitle = (title || photoId).replace(/[/\\:]/g, '_').trim()

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

  return [...pre, core, ...suf].join(s)
}

let mainWindow: BrowserWindow | null = null

function createSplash(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 480,
    height: 360,
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
  html, body { width: 480px; height: 360px; background: transparent; overflow: hidden; }
  .card {
    width: 420px;
    height: 300px;
    margin: 30px;
    background: #FCFAF6;
    border-radius: 20px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.10);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 28px 20px 20px;
    -webkit-app-region: drag;
    overflow: hidden;
  }
  img.splash { width: 280px; height: auto; margin-bottom: 10px; }
  .tagline {
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    color: #999;
    letter-spacing: 0.02em;
    margin-bottom: auto;
  }
  .meta {
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    color: #bbb;
  }
</style>
</head>
<body>
  <div class="card">
    <img class="splash" src="data:image/png;base64,${splashB64}" />
    <p class="tagline">Your Flickr, your files.</p>
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
ipcMain.handle('photos:getPage', async (_event, page: number, sort?: string) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getPhotos(tokenData, page, sort)
})

// Get available sizes for a photo (used by the detail modal for preview + download)
ipcMain.handle('photos:getSizes', async (_event, photoId: string) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  return getPhotoSizes(photoId, tokenData)
})

// Download a photo: opens a save dialog then streams the file to disk
let activeDownloadController: AbortController | null = null

ipcMain.handle('photos:download', async (_event, photoId: string, photoTitle: string) => {
  const tokenData = loadToken()
  if (!tokenData) throw new Error('Not authenticated')
  if (!mainWindow) throw new Error('No window available')
  activeDownloadController = new AbortController()
  try {
    const [sizes, photoInfo] = await Promise.all([
      getPhotoSizes(photoId, tokenData),
      getPhotoInfo(photoId, tokenData)
    ])
    const { fileNaming } = loadSettings()
    const filename = buildFilename(fileNaming, photoId, photoTitle, photoInfo)
    const filePath = await downloadPhoto(sizes, filename, mainWindow, activeDownloadController.signal, photoInfo)
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
  type: 'album' | 'selected'
  albumId?: string
  photos?: { id: string; title: string }[]
  albumTitle: string
  photoCount?: number
  videoCount?: number
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
    if (job.type === 'album') {
      await runAlbumBatch(job.albumId!, job.albumTitle)
    } else {
      await runSelectedBatch(job.photos!, job.albumTitle)
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

async function runAlbumBatch(albumId: string, albumTitle: string): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return

  activeBatchAlbumId = albumId
  const { fileNaming, downloadFolder, showDockProgress, notifyOnComplete } = loadSettings()
  const safeAlbumTitle = albumTitle.replace(/[/\\:*?"<>|]/g, '_').trim()
  const albumFolder = join(downloadFolder, safeAlbumTitle)
  ensureDownloadFolder(albumFolder)

  const sendProgress = (p: Omit<BatchProgress, 'queuedCount' | 'queuedAlbums'>): void => {
    const full = { ...p, queuedCount: batchQueue.length, queuedAlbums: batchQueue.map(j => ({ id: j.id, title: j.albumTitle, photoCount: j.photoCount, videoCount: j.videoCount })) }
    lastBatchProgress = full
    mainWindow?.webContents.send('batch:progress', full)
    if (showDockProgress) {
      if (p.status === 'running' && p.total > 0) {
        mainWindow?.setProgressBar(2)
      } else {
        mainWindow?.setProgressBar(-1)
      }
    }
  }

  let page = 1
  let pages = 1
  const allPhotos: { id: string; title: string }[] = []

  do {
    const result = await getAlbumPhotos(albumId, tokenData, page)
    allPhotos.push(...result.photos.map((p) => ({ id: p.id, title: p.title })))
    pages = result.pages
    page++
  } while (page <= pages)

  const total = allPhotos.length
  sendProgress({
    current: 0, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null,
    status: 'running', allTitles: allPhotos.map((p) => p.title)
  })

  let albumSeqNum = 1
  for (let i = 0; i < allPhotos.length; i++) {
    if (activeBatchController?.signal.aborted) {
      activeBatchAlbumId = null
      sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled' })
      return
    }

    const photo = allPhotos[i]
    sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running' })

    try {
      const [sizes, photoInfo] = await Promise.all([
        withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
        withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
      ])
      const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, albumSeqNum++)
      const filePath = await downloadToFolder(sizes, filename, albumFolder, activeBatchController?.signal, photoInfo)
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: filePath, status: 'running' })
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError' || activeBatchController?.signal.aborted) {
        activeBatchAlbumId = null
        sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled' })
        return
      }
      process.stderr.write(`[flickrfetch] batch skip ${photo.id}: ${err}\n`)
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running' })
    }
  }

  activeBatchAlbumId = null
  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'done' })
  if (notifyOnComplete && Notification.isSupported()) {
    new Notification({ title: 'FlickrFetch', body: `Downloaded ${total} photos from "${albumTitle}"` }).show()
  }
}

async function runSelectedBatch(photos: { id: string; title: string }[], albumTitle: string): Promise<void> {
  if (!mainWindow) return
  const tokenData = loadToken()
  if (!tokenData) return

  const { fileNaming, downloadFolder, showDockProgress, notifyOnComplete } = loadSettings()
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
        mainWindow?.setProgressBar(2)
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
  for (let i = 0; i < photos.length; i++) {
    if (activeBatchController?.signal.aborted) {
      sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled' })
      return
    }

    const photo = photos[i]
    sendProgress({ current: i, total, albumTitle, activeTitle: photo.title, latestTitle: '', latestFilePath: null, status: 'running' })

    try {
      const [sizes, photoInfo] = await Promise.all([
        withTimeout(getPhotoSizes(photo.id, tokenData), 30000),
        withTimeout(getPhotoInfo(photo.id, tokenData), 30000)
      ])
      const filename = buildFilename(fileNaming, photo.id, photo.title, photoInfo, selSeqNum++)
      const filePath = await downloadToFolder(sizes, filename, targetFolder, activeBatchController?.signal, photoInfo)
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: filePath, status: 'running' })
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError' || activeBatchController?.signal.aborted) {
        sendProgress({ current: i, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'cancelled' })
        return
      }
      process.stderr.write(`[flickrfetch] batch skip ${photo.id}: ${err}\n`)
      sendProgress({ current: i + 1, total, albumTitle, activeTitle: '', latestTitle: photo.title, latestFilePath: null, status: 'running' })
    }
  }

  sendProgress({ current: total, total, albumTitle, activeTitle: '', latestTitle: '', latestFilePath: null, status: 'done' })
  if (notifyOnComplete && Notification.isSupported()) {
    new Notification({ title: 'FlickrFetch', body: `Downloaded ${total} photos from "${baseTitle}"` }).show()
  }
}

ipcMain.handle('batch:startAlbum', (_event, albumId: string, albumTitle: string, photoCount?: number, videoCount?: number, force?: boolean) => {
  if (!force) {
    const isDuplicate = activeBatchAlbumId === albumId || batchQueue.some(j => j.type === 'album' && j.albumId === albumId)
    if (isDuplicate) return { alreadyQueued: true }
  }
  enqueueBatch({ type: 'album', albumId, albumTitle, photoCount, videoCount })
  return { alreadyQueued: false }
})

ipcMain.handle('batch:startSelected', (_event, photos: { id: string; title: string }[], albumTitle: string) => {
  enqueueBatch({ type: 'selected', photos, albumTitle })
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

app.whenReady().then(() => {
  // Build the macOS app menu with a proper About item
  const appName = app.getName()
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: appName,
      submenu: [
        {
          label: `About ${appName}`,
          click: () => {
            mainWindow?.webContents.send('app:showAbout', { version: app.getVersion() })
          }
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
    { role: 'windowMenu' }
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
