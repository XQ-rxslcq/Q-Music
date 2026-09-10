import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseFile } from 'music-metadata'
import { fromMediaUrl, toMediaUrl } from '../core/media-url'
import { detectFfmpeg, loadSiblingLyrics, readTextFileSmart, trimAudio } from './media-tools'
import { bootstrapPortableApp, readConfig, writeConfig, type BootstrapResult } from './bootstrap'
import {
  addMusicRoot,
  backgroundFileUrl,
  importBackgroundImage,
  loadCategories,
  loadGains,
  loadHotkeys,
  loadLyricsMap,
  loadLyricsRoot,
  loadRoots,
  loadTheme,
  loadTracks,
  removeMusicRoot,
  resolveLyricsRootAbsolute,
  saveCategories,
  saveGains,
  saveHotkeys,
  saveLyricsMap,
  saveLyricsRoot,
  saveTheme,
  saveTracks,
} from './store'
import {
  applyFilenameMetaToAll,
  applyFilenameMetaVerified,
  importAudioFile,
  renameTrackFile,
  rescanAllRoots,
  trackToPlayable,
} from './library-service'
import { toRelativeIfUnderRoot } from '../core/app-paths'
import type { Category, ThemeSettings, TrackRecord } from '../core/library'
import { searchLyricsLrclib } from './lyrics-search'
import { resolveLyricsFileForTrack, saveLyricsForTrack } from './lyrics-save'
import {
  applyDesktopLyricsLayout,
  destroyDesktopLyrics,
  getDesktopLyricsLocked,
  getDesktopLyricsLiveBounds,
  getDesktopLyricsVisible,
  pushDesktopLyrics,
  setDesktopLyricsBoundsListener,
  setDesktopLyricsVisible,
} from './desktop-lyrics-window'
import {
  applyHotkeyBindings,
  bindMainWindowHotkeyLifecycle,
  setHotkeyHandler,
  unregisterAllHotkeys,
  type HotkeyAction,
} from './hotkeys'
import { createAppTray, destroyAppTray, refreshTrayMenu } from './tray'
import { mergeDesktopLyrics } from '../core/desktop-lyrics'
import type { HotkeyBinding } from '../core/hotkey-config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let isQuitting = false

type AppWithQuitFlag = Electron.App & { isQuitting?: boolean }
function setAppQuitting(v: boolean) {
  isQuitting = v
  ;(app as AppWithQuitFlag).isQuitting = v
}

// 尽早初始化：相对 exe/项目根拼接 data/，并把 userData 指过去（换路径拷贝即用）
const boot: BootstrapResult = bootstrapPortableApp(__dirname)

/**
 * 打包后默认单开：第二次启动唤起已有主窗（托盘隐藏则恢复），保留页面状态。
 * 若主窗已销毁则新建（相当于首页）。开发模式不限制。
 */
const enforceSingleInstance = app.isPackaged && !boot.config.allowMultiInstance
const isPrimaryInstance = !enforceSingleInstance || app.requestSingleInstanceLock()
if (!isPrimaryInstance) {
  app.exit(0)
} else if (enforceSingleInstance) {
  app.on('second-instance', () => {
    showOrCreateMainWindow()
  })
}

function showOrCreateMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    // 主窗已彻底关掉：新建（首页）
    if (app.isReady()) createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  try {
    mainWindow.moveTop()
  } catch {
    // ignore
  }
  void syncDesktopLyricsWindow().catch(() => undefined)
}

function getPreloadAndDev() {
  return {
    preloadPath: resolvePreloadPath(),
    mainDir: __dirname,
    devUrl: process.env.VITE_DEV_SERVER_URL,
  }
}

async function syncDesktopLyricsWindow(theme = loadTheme(boot.appRoot)) {
  const { preloadPath, mainDir, devUrl } = getPreloadAndDev()
  applyDesktopLyricsLayout(theme.desktopLyrics)
  await setDesktopLyricsVisible(Boolean(theme.desktopLyrics.visible), {
    preloadPath,
    mainDir,
    appPath: app.getAppPath(),
    devUrl,
    settings: theme.desktopLyrics,
  })
}

function buildThemePayload() {
  const theme = loadTheme(boot.appRoot)
  let bgImageUrl: string | null = null
  const abs = backgroundFileUrl(boot.appRoot, theme.bgImageRel)
  if (abs) bgImageUrl = toMediaUrl(abs)
  return { theme, bgImageUrl }
}

function getLogDir() {
  return boot.logsDir
}

function getLogFile() {
  return path.join(getLogDir(), 'main.log')
}

function ensureLogDir() {
  try {
    fs.mkdirSync(getLogDir(), { recursive: true })
  } catch {
    // ignore
  }
}

function log(...args: unknown[]) {
  const line = `[${new Date().toISOString()}] ${args
    .map((a) =>
      typeof a === 'string'
        ? a
        : a instanceof Error
          ? `${a.message}\n${a.stack}`
          : JSON.stringify(a),
    )
    .join(' ')}`
  console.log(line)
  try {
    ensureLogDir()
    fs.appendFileSync(getLogFile(), line + '\n', 'utf8')
  } catch {
    // ignore file log failures
  }
}

process.on('uncaughtException', (err) => {
  log('uncaughtException', err)
})
process.on('unhandledRejection', (reason) => {
  log('unhandledRejection', reason instanceof Error ? reason : String(reason))
})

log('bootstrap', {
  appRoot: boot.appRoot,
  dataDir: boot.dataDir,
  firstRun: boot.firstRun,
  packaged: app.isPackaged,
  portableEnv: process.env.PORTABLE_EXECUTABLE_DIR || null,
})

const AUDIO_EXT = new Set([
  '.mp3',
  '.m4a',
  '.aac',
  '.flac',
  '.wav',
  '.ogg',
  '.opus',
  '.webm',
])

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'qmusic',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
])

function resolvePreloadPath() {
  return path.join(__dirname, 'preload.cjs')
}

function resolveRendererEntry() {
  // 打包后若把 renderer 与 main 放在同级，可再兼容 index.html
  const candidates = [
    path.join(__dirname, '../dist-renderer/index.html'),
    path.join(__dirname, '../dist/index.html'),
    path.join(__dirname, 'index.html'),
  ]
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0]
}

function resolveAppIcon(): string | undefined {
  const candidates = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../assets/icon.png'),
    path.join(boot.appRoot, 'assets', 'icon.png'),
    path.join(boot.appRoot, 'build', 'icon.ico'),
  ]
  return candidates.find((p) => fs.existsSync(p))
}

function createWindow() {
  log('createWindow:start')
  const preloadPath = resolvePreloadPath()
  const icon = resolveAppIcon()
  log('boot-check', {
    preloadPath,
    preloadExists: fs.existsSync(preloadPath),
    packaged: app.isPackaged,
    userData: app.getPath('userData'),
    icon,
  })
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    title: 'Q-Music',
    icon,
    frame: false,
    movable: true,
    maximizable: true,
    minimizable: true,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: '#141820',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  mainWindow = win

  const showFallback = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      log('createWindow:show-fallback')
      win.show()
    }
  }, 2500)

  win.once('ready-to-show', () => {
    clearTimeout(showFallback)
    log('createWindow:ready-to-show')
    win.center()
    // 勿用临时 alwaysOnTop：Windows 上关闭后常残留置顶感，未点本窗前其它窗无法盖住
    win.show()
    win.focus()
  })

  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) log('renderer-console', { level, message, line, sourceId })
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log('did-fail-load', { code, desc, url })
  })
  win.webContents.on('did-finish-load', () => {
    log('did-finish-load', win.webContents.getURL())
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    log('render-process-gone', details)
  })
  win.on('unresponsive', () => log('window:unresponsive'))
  win.on('close', (e) => {
    if (!isQuitting && !(app as AppWithQuitFlag).isQuitting) {
      e.preventDefault()
      win.hide()
      // × 藏到托盘：桌面歌词保持显示（最小化同理不打断）
      log('window:close → hide (tray)')
    }
  })
  win.on('closed', () => {
    stopWindowDrag()
    if (mainWindow === win) mainWindow = null
    log('window:closed')
  })
  // 切到其他软件再回来时，通知渲染进程刷新拖动命中区
  win.on('focus', () => notifyChromeRefresh(win))
  win.on('restore', () => {
    notifyChromeRefresh(win)
    void syncDesktopLyricsWindow().catch(() => undefined)
  })
  win.on('show', () => {
    notifyChromeRefresh(win)
    void syncDesktopLyricsWindow().catch(() => undefined)
  })
  const initialHotkeys = loadHotkeys(boot.appRoot)
  applyHotkeyBindings(initialHotkeys, !win.isFocused())

  const dispatchHotkeyAction = (action: HotkeyAction) => {
    if (action === 'toggle-desktop-lyrics') {
      const theme = loadTheme(boot.appRoot)
      const next = {
        ...theme,
        desktopLyrics: mergeDesktopLyrics({
          ...theme.desktopLyrics,
          visible: !theme.desktopLyrics.visible,
        }),
      }
      saveTheme(boot.appRoot, next)
      void syncDesktopLyricsWindow(next)
      mainWindow?.webContents.send('theme:changed', buildThemePayload())
      refreshTrayMenu()
      return
    }
    if (action === 'toggle-desktop-lyrics-lock') {
      const theme = loadTheme(boot.appRoot)
      const next = {
        ...theme,
        desktopLyrics: mergeDesktopLyrics({
          ...theme.desktopLyrics,
          locked: !theme.desktopLyrics.locked,
        }),
      }
      saveTheme(boot.appRoot, next)
      void syncDesktopLyricsWindow(next)
      mainWindow?.webContents.send('theme:changed', buildThemePayload())
      refreshTrayMenu()
      return
    }
    mainWindow?.webContents.send('hotkey:action', action)
  }

  bindMainWindowHotkeyLifecycle(() => mainWindow)
  setHotkeyHandler(dispatchHotkeyAction)

  createAppTray({
    appRoot: boot.appRoot,
    mainDir: __dirname,
    handlers: {
      getMain: () => mainWindow,
      getPlaying: () => false,
      getDesktopLyricsVisible: () =>
        Boolean(loadTheme(boot.appRoot).desktopLyrics.visible) || getDesktopLyricsVisible(),
      getDesktopLyricsLocked: () => getDesktopLyricsLocked(),
      sendAction: (action) => {
        if (action === 'show-main') {
          showOrCreateMainWindow()
          return
        }
        if (action === 'quit-app') {
          setAppQuitting(true)
          destroyDesktopLyrics()
          // 真正退出时关掉「下次启动还弹歌词」的残留偏好
          try {
            const theme = loadTheme(boot.appRoot)
            if (theme.desktopLyrics?.visible) {
              saveTheme(boot.appRoot, {
                ...theme,
                desktopLyrics: mergeDesktopLyrics({ ...theme.desktopLyrics, visible: false }),
              })
            }
          } catch {
            // ignore
          }
          app.quit()
          return
        }
        dispatchHotkeyAction(action)
      },
    },
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    log('loadURL', devUrl)
    void win.loadURL(devUrl).catch((err) => log('loadURL failed', err))
    if (process.env.QMUSIC_DEBUG === '1') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    const html = resolveRendererEntry()
    log('loadFile', html, { exists: fs.existsSync(html) })
    void win.loadFile(html).catch((err) => log('loadFile failed', err))
  }

  void syncDesktopLyricsWindow().catch((err) => log('desktop-lyrics sync failed', err))
}

function getWin(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) {
  return BrowserWindow.fromWebContents(event.sender)
}

/** JS 拖窗：切走再回来 CSS drag 会失效，故用主进程读光标 + 锁定宽高 */
type DragState = {
  win: BrowserWindow
  ox: number
  oy: number
  width: number
  height: number
  timer: ReturnType<typeof setInterval>
}
let activeDrag: DragState | null = null

function stopWindowDrag() {
  if (activeDrag?.timer) clearInterval(activeDrag.timer)
  activeDrag = null
}

function startWindowDrag(win: BrowserWindow) {
  stopWindowDrag()
  if (win.isMaximized()) win.unmaximize()
  const cursor = screen.getCursorScreenPoint()
  const b = win.getBounds()
  activeDrag = {
    win,
    ox: cursor.x - b.x,
    oy: cursor.y - b.y,
    width: b.width,
    height: b.height,
    timer: setInterval(() => {
      if (!activeDrag || activeDrag.win.isDestroyed()) {
        stopWindowDrag()
        return
      }
      const c = screen.getCursorScreenPoint()
      activeDrag.win.setBounds(
        {
          x: Math.round(c.x - activeDrag.ox),
          y: Math.round(c.y - activeDrag.oy),
          width: activeDrag.width,
          height: activeDrag.height,
        },
        false,
      )
    }, 4),
  }
}

function notifyChromeRefresh(win: BrowserWindow) {
  if (win.isDestroyed()) return
  win.webContents.send('window:chrome-refresh')
}

function safeHandle(channel: string, listener: (...args: any[]) => any) {
  try {
    ipcMain.removeHandler(channel)
  } catch {
    // ignore
  }
  ipcMain.handle(channel, listener)
}

function registerWindowChromeIpc() {
  for (const ch of ['window:dragStart', 'window:dragMove', 'window:dragEnd']) {
    try {
      ipcMain.removeHandler(ch)
    } catch {
      // ignore
    }
  }
  ipcMain.removeAllListeners('window:drag-start')
  ipcMain.removeAllListeners('window:drag-end')

  safeHandle('window:minimize', (event) => {
    stopWindowDrag()
    getWin(event)?.minimize()
  })
  safeHandle('window:toggleMaximize', (event) => {
    const win = getWin(event)
    if (!win) return false
    stopWindowDrag()
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })
  safeHandle('window:close', (event) => {
    stopWindowDrag()
    getWin(event)?.close()
  })
  safeHandle('window:isMaximized', (event) => {
    return getWin(event)?.isMaximized() ?? false
  })

  ipcMain.on('window:drag-start', (event) => {
    const win = getWin(event)
    if (win) startWindowDrag(win)
  })
  ipcMain.on('window:drag-end', () => {
    stopWindowDrag()
  })
}

registerWindowChromeIpc()

function defaultMusicDir() {
  try {
    return app.getPath('music')
  } catch {
    return app.getPath('home')
  }
}

async function listAudioFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await listAudioFiles(full)))
    } else if (AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full)
    }
  }
  return out
}

async function readTrackMeta(filePath: string) {
  const base = path.basename(filePath)
  try {
    const meta = await parseFile(filePath, { duration: true })
    const title = meta.common.title || path.parse(base).name
    const artist = meta.common.artist || meta.common.artists?.join(', ') || '未知艺人'
    const album = meta.common.album || ''
    const duration = meta.format.duration ?? 0
    return {
      id: filePath,
      path: filePath,
      title,
      artist,
      album,
      duration,
      fileUrl: toMediaUrl(filePath),
    }
  } catch (err) {
    log('readTrackMeta fallback', filePath, err instanceof Error ? err.message : String(err))
    return {
      id: filePath,
      path: filePath,
      title: path.parse(base).name,
      artist: '未知艺人',
      album: '',
      duration: 0,
      fileUrl: toMediaUrl(filePath),
    }
  }
}

log('boot-early', {
  dirname: __dirname,
  appRoot: boot.appRoot,
  electron: process.versions.electron,
  node: process.versions.node,
  pid: process.pid,
  platform: process.platform,
  viteUrl: process.env.VITE_DEV_SERVER_URL || null,
})

// 规范对外显示名（音频共享 / 任务栏等优先读这个，而不是 package name 里的 q-music）
try {
  app.setName('Q-Music')
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.qmusic.app')
  }
} catch {
  // ignore
}

if (isPrimaryInstance) {
app.whenReady().then(() => {
  log('app:ready', {
    userData: app.getPath('userData'),
    music: defaultMusicDir(),
    logFile: getLogFile(),
    packaged: app.isPackaged,
    firstRun: boot.firstRun,
  })
  Menu.setApplicationMenu(null)

  ipcMain.handle('app:getInitInfo', () => ({
    appRoot: boot.appRoot,
    dataDir: boot.dataDir,
    firstRun: boot.firstRun,
    packaged: app.isPackaged,
    config: boot.config,
  }))

  const PLAY_MODES = new Set(['sequence', 'loop', 'single', 'shuffle'])
  ipcMain.handle('player:getPlayMode', () => {
    const cfg = readConfig(boot.configPath)
    return cfg.playMode || 'loop'
  })
  ipcMain.handle('player:setPlayMode', (_e, mode: string) => {
    const playMode = PLAY_MODES.has(mode) ? (mode as typeof boot.config.playMode) : 'loop'
    const next = { ...readConfig(boot.configPath), playMode }
    writeConfig(boot.configPath, next)
    boot.config = next
    return playMode
  })

  const themePayload = () => buildThemePayload()

  const libraryPayload = () => {
    const roots = loadRoots(boot.appRoot)
    const tracks = loadTracks(boot.appRoot)
    const categories = loadCategories(boot.appRoot)
    const gains = loadGains(boot.appRoot)
    const lyricsRoot = loadLyricsRoot(boot.appRoot)
    const lyricsRootAbs = resolveLyricsRootAbsolute(boot.appRoot)
    const playable = tracks
      .map((t) => trackToPlayable(boot.appRoot, t, roots, toMediaUrl))
      .filter(Boolean)
    return { roots, tracks, categories, playable, gains, lyricsRoot, lyricsRootAbs }
  }

  ipcMain.handle('theme:get', () => themePayload())
  ipcMain.handle('theme:set', (_e, theme: ThemeSettings) => {
    const live = getDesktopLyricsLiveBounds()
    const next =
      live && theme.desktopLyrics
        ? {
            ...theme,
            desktopLyrics: mergeDesktopLyrics({ ...theme.desktopLyrics, bounds: live }),
          }
        : theme
    saveTheme(boot.appRoot, next)
    void syncDesktopLyricsWindow(next).catch((err) => log('desktop-lyrics theme sync', err))
    return themePayload()
  })
  ipcMain.handle('theme:pickBackground', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择背景图片',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    })
    if (result.canceled || !result.filePaths[0]) return themePayload()
    const rel = importBackgroundImage(boot.appRoot, result.filePaths[0])
    const theme = { ...loadTheme(boot.appRoot), bgStyle: 'image' as const, bgImageRel: rel }
    saveTheme(boot.appRoot, theme)
    return themePayload()
  })

  ipcMain.handle('library:get', () => libraryPayload())
  ipcMain.handle('library:addRoot', async () => {
    const result = await dialog.showOpenDialog({
      title: '添加音乐根目录（可多选多个文件夹，会合并进总曲库）',
      defaultPath: defaultMusicDir(),
      properties: ['openDirectory', 'multiSelections'],
    })
    if (!result.canceled) {
      for (const p of result.filePaths) addMusicRoot(boot.appRoot, p)
      await rescanAllRoots(boot.appRoot)
    }
    return libraryPayload()
  })
  ipcMain.handle('library:removeRoot', async (_e, rootId: string) => {
    removeMusicRoot(boot.appRoot, rootId)
    return libraryPayload()
  })
  ipcMain.handle('library:rescan', async () => {
    await rescanAllRoots(boot.appRoot)
    return libraryPayload()
  })
  ipcMain.handle('library:updateTrack', (_e, patch: Partial<TrackRecord> & { id: string }) => {
    const tracks = loadTracks(boot.appRoot)
    const i = tracks.findIndex((t) => t.id === patch.id)
    if (i >= 0) {
      tracks[i] = { ...tracks[i], ...patch }
      saveTracks(boot.appRoot, tracks)
      if (patch.lyricsRel != null) {
        const map = loadLyricsMap(boot.appRoot)
        if (patch.lyricsRel) map[patch.id] = patch.lyricsRel
        else delete map[patch.id]
        saveLyricsMap(boot.appRoot, map)
      }
    }
    return libraryPayload()
  })
  ipcMain.handle('library:setCategories', (_e, cats: Category[]) => {
    saveCategories(boot.appRoot, cats)
    return libraryPayload()
  })
  ipcMain.handle('library:addCategory', (_e, name: string) => {
    const cats = loadCategories(boot.appRoot)
    const id = `cat-${Date.now()}`
    cats.push({ id, name })
    saveCategories(boot.appRoot, cats)
    return libraryPayload()
  })
  ipcMain.handle('library:applyFilenameMeta', () => {
    const result = applyFilenameMetaVerified(boot.appRoot)
    return { ...libraryPayload(), ...result }
  })
  ipcMain.handle('library:applyFilenameMetaForce', () => {
    const result = applyFilenameMetaToAll(boot.appRoot)
    return { ...libraryPayload(), ...result }
  })
  ipcMain.handle(
    'library:importAudio',
    async (
      _e,
      payload: {
        sourcePath: string
        rootId: string
        artist: string
        titleZh: string
        titleEn: string
        titleJa: string
      },
    ) => {
      const res = await importAudioFile(boot.appRoot, payload)
      if (!res.ok) return { ok: false as const, error: res.error, library: libraryPayload() }
      return { ok: true as const, trackId: res.track.id, library: libraryPayload() }
    },
  )
  ipcMain.handle('config:getImportTarget', () => {
    const cfg = readConfig(boot.configPath)
    const roots = loadRoots(boot.appRoot)
    const id = cfg.importTargetRootId || roots[0]?.id || null
    return { importTargetRootId: id, roots }
  })
  ipcMain.handle('config:getAllowMultiInstance', () => {
    const cfg = readConfig(boot.configPath)
    return Boolean(cfg.allowMultiInstance)
  })
  ipcMain.handle('config:setAllowMultiInstance', (_e, allow: boolean) => {
    const next = {
      ...readConfig(boot.configPath),
      allowMultiInstance: Boolean(allow),
    }
    writeConfig(boot.configPath, next)
    boot.config = next
    return { allowMultiInstance: Boolean(next.allowMultiInstance) }
  })
  ipcMain.handle('config:setImportTarget', (_e, rootId: string | null) => {
    const next = { ...readConfig(boot.configPath), importTargetRootId: rootId || null }
    writeConfig(boot.configPath, next)
    boot.config = next
    return { importTargetRootId: next.importTargetRootId }
  })
  ipcMain.handle(
    'library:renameTrack',
    async (
      _e,
      payload: {
        id: string
        artist: string
        titleZh: string
        titleEn: string
        titleJa: string
      },
    ) => {
      const res = await renameTrackFile(boot.appRoot, payload.id, payload)
      if (!res.ok) return { ok: false as const, error: res.error, library: libraryPayload() }
      return { ok: true as const, oldId: res.oldId, trackId: res.track.id, library: libraryPayload() }
    },
  )
  ipcMain.handle('library:getGains', () => loadGains(boot.appRoot))
  ipcMain.handle('library:setGains', (_e, gains: Record<string, number>) => {
    saveGains(boot.appRoot, gains)
    return loadGains(boot.appRoot)
  })
  ipcMain.handle('lyrics:bindToTrack', async (_e, trackId: string) => {
    const result = await dialog.showOpenDialog({
      title: '为当前曲绑定歌词',
      properties: ['openFile'],
      filters: [{ name: 'LRC', extensions: ['lrc', 'txt'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const rel = toRelativeIfUnderRoot(boot.appRoot, result.filePaths[0])
    const map = loadLyricsMap(boot.appRoot)
    map[trackId] = rel
    saveLyricsMap(boot.appRoot, map)
    const tracks = loadTracks(boot.appRoot)
    const i = tracks.findIndex((t) => t.id === trackId)
    if (i >= 0) {
      tracks[i] = { ...tracks[i], lyricsRel: rel }
      saveTracks(boot.appRoot, tracks)
    }
    const content = await readTextFileSmart(result.filePaths[0])
    return { path: result.filePaths[0], content, lyricsRel: rel, library: libraryPayload() }
  })
  ipcMain.handle('lyrics:loadForTrack', async (_e, trackId: string) => {
    const found = await resolveLyricsFileForTrack(boot.appRoot, trackId)
    if (!found.path) return { path: null, content: null }
    try {
      const content = await readTextFileSmart(found.path)
      // 若靠歌词根/旁路找到但 map 未记，写回映射方便下次
      if (found.via && found.via !== 'map') {
        const map = loadLyricsMap(boot.appRoot)
        const rel = toRelativeIfUnderRoot(boot.appRoot, found.path)
        if (map[trackId] !== rel) {
          map[trackId] = rel
          saveLyricsMap(boot.appRoot, map)
          const tracks = loadTracks(boot.appRoot)
          const i = tracks.findIndex((t) => t.id === trackId)
          if (i >= 0) {
            tracks[i] = { ...tracks[i], lyricsRel: rel }
            saveTracks(boot.appRoot, tracks)
          }
        }
      }
      return { path: found.path, content }
    } catch {
      return { path: null, content: null }
    }
  })

  ipcMain.handle('lyrics:getRoot', () => {
    const settings = loadLyricsRoot(boot.appRoot)
    return {
      path: settings.path,
      absPath: resolveLyricsRootAbsolute(boot.appRoot),
    }
  })

  ipcMain.handle('lyrics:pickRoot', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择歌词目录（保存/读取 .lrc，按音频同名匹配）',
      defaultPath: resolveLyricsRootAbsolute(boot.appRoot) || defaultMusicDir(),
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) {
      return {
        path: loadLyricsRoot(boot.appRoot).path,
        absPath: resolveLyricsRootAbsolute(boot.appRoot),
        library: libraryPayload(),
      }
    }
    const stored = toRelativeIfUnderRoot(boot.appRoot, result.filePaths[0])
    saveLyricsRoot(boot.appRoot, { path: stored })
    await rescanAllRoots(boot.appRoot)
    return {
      path: stored,
      absPath: resolveLyricsRootAbsolute(boot.appRoot),
      library: libraryPayload(),
    }
  })

  ipcMain.handle('lyrics:clearRoot', async () => {
    saveLyricsRoot(boot.appRoot, { path: null })
    return {
      path: null,
      absPath: null,
      library: libraryPayload(),
    }
  })

  ipcMain.handle(
    'lyrics:search',
    async (
      _e,
      opts: {
        title?: string
        artist?: string
        q?: string
        track?: {
          title?: string
          titleZh?: string
          titleEn?: string
          titleJa?: string
          artist?: string
          pathRel?: string
        }
      },
    ) => {
      log('ipc lyrics:search', {
        title: opts?.title,
        artist: opts?.artist,
        q: opts?.q,
        trackId: opts?.track ? `${opts.track.artist} / ${opts.track.titleZh || opts.track.title}` : undefined,
      })
      return searchLyricsLrclib({
        title: (opts?.title || '').trim() || undefined,
        artist: (opts?.artist || '').trim() || undefined,
        q: (opts?.q || '').trim() || undefined,
        track: opts?.track,
      })
    },
  )

  ipcMain.handle('lyrics:saveToTrack', async (_e, trackId: string, content: string) => {
    log('ipc lyrics:saveToTrack', trackId)
    if (!trackId || typeof content !== 'string' || !content.trim()) {
      return { ok: false as const, error: '缺少曲目或歌词内容' }
    }
    const res = await saveLyricsForTrack(boot.appRoot, trackId, content)
    if (!res.ok) return res
    return { ...res, library: libraryPayload() }
  })

  protocol.registerFileProtocol('qmusic', (request, callback) => {
    try {
      const filePath = path.normalize(fromMediaUrl(request.url))
      callback({ path: filePath })
    } catch (err) {
      log('protocol error', request.url, err instanceof Error ? err.message : String(err))
      callback({ error: -2 })
    }
  })

  ipcMain.handle('dialog:openFiles', async () => {
    log('ipc dialog:openFiles')
    const result = await dialog.showOpenDialog({
      title: '添加音频文件',
      defaultPath: defaultMusicDir(),
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Audio',
          extensions: ['mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'opus', 'webm'],
        },
      ],
    })
    if (result.canceled) return []
    return Promise.all(result.filePaths.map(readTrackMeta))
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    log('ipc dialog:openDirectory')
    const result = await dialog.showOpenDialog({
      title: '添加音乐文件夹',
      defaultPath: defaultMusicDir(),
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return []
    const files = await listAudioFiles(result.filePaths[0])
    return Promise.all(files.map(readTrackMeta))
  })

  // 窗口铬框 IPC 已在模块加载时 registerWindowChromeIpc()

  ipcMain.handle('lyrics:loadSibling', async (_e, audioPath: string) => {
    log('ipc lyrics:loadSibling', audioPath)
    return loadSiblingLyrics(audioPath)
  })

  ipcMain.handle('lyrics:openFile', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择歌词文件',
      properties: ['openFile'],
      filters: [{ name: 'LRC', extensions: ['lrc', 'txt'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const p = result.filePaths[0]
    const content = await readTextFileSmart(p)
    return { path: p, content }
  })

  ipcMain.handle('desktop-lyrics:setVisible', async (_e, visible: boolean) => {
    const theme = loadTheme(boot.appRoot)
    const next = {
      ...theme,
      desktopLyrics: { ...theme.desktopLyrics, visible: Boolean(visible) },
    }
    saveTheme(boot.appRoot, next)
    await syncDesktopLyricsWindow(next)
    mainWindow?.webContents.send('theme:changed', themePayload())
    return { visible: Boolean(visible) }
  })
  ipcMain.handle(
    'desktop-lyrics:push',
    (
      _e,
      payload: {
        lines?: Array<{ timeMs: number; text: string }>
        currentTime?: number
        duration?: number
        title?: string
        artist?: string
        settings?: ThemeSettings['desktopLyrics']
        playing?: boolean
      },
    ) => {
      pushDesktopLyrics(payload || {})
    },
  )

  ipcMain.handle('hotkeys:get', () => loadHotkeys(boot.appRoot))
  ipcMain.handle('hotkeys:set', (_e, bindings: HotkeyBinding[]) => {
    saveHotkeys(boot.appRoot, bindings)
    const next = loadHotkeys(boot.appRoot)
    const focused = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused())
    applyHotkeyBindings(next, !focused)
    return next
  })

  setDesktopLyricsBoundsListener((bounds) => {
    const theme = loadTheme(boot.appRoot)
    const next = {
      ...theme,
      desktopLyrics: mergeDesktopLyrics({ ...theme.desktopLyrics, bounds }),
    }
    saveTheme(boot.appRoot, next)
    // 同步到渲染进程，避免锁定时用旧 bounds 覆盖刚调好的尺寸
    mainWindow?.webContents.send('theme:changed', buildThemePayload())
  })

  ipcMain.handle('ffmpeg:available', async () => {
    const bin = await detectFfmpeg()
    return Boolean(bin)
  })

  ipcMain.handle(
    'trim:export',
    async (
      _e,
      payload: { inputPath: string; startSec: number; endSec: number; outputPath?: string },
    ) => {
      log('ipc trim:export', payload)
      const result = await trimAudio(payload)
      if (result.ok) {
        // 截取成功后读入曲库元数据
        const track = await readTrackMeta(result.outputPath)
        return { ...result, track }
      }
      return result
    },
  )

  try {
    createWindow()
  } catch (err) {
    log('createWindow threw', err instanceof Error ? err : String(err))
  }

  app.on('activate', () => {
    showOrCreateMainWindow()
  })
}).catch((err) => {
  log('app.whenReady failed', err instanceof Error ? err : String(err))
})

app.on('window-all-closed', () => {
  log('window-all-closed')
  // 托盘常驻：仅真正退出时清理；隐藏主窗不会触发本事件
  if (process.platform !== 'darwin' && isQuitting) {
    unregisterAllHotkeys()
    destroyDesktopLyrics()
    destroyAppTray()
    app.quit()
  }
})

app.on('before-quit', () => {
  setAppQuitting(true)
  destroyDesktopLyrics()
  try {
    const theme = loadTheme(boot.appRoot)
    if (theme.desktopLyrics?.visible) {
      saveTheme(boot.appRoot, {
        ...theme,
        desktopLyrics: mergeDesktopLyrics({ ...theme.desktopLyrics, visible: false }),
      })
    }
  } catch {
    // ignore
  }
})

app.on('will-quit', () => {
  unregisterAllHotkeys()
  destroyDesktopLyrics()
  destroyAppTray()
})
} // isPrimaryInstance