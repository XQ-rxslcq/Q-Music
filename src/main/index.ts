import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseFile } from 'music-metadata'
import { fromMediaUrl, toMediaUrl } from '../core/media-url'
import { detectFfmpeg, loadSiblingLyrics, readTextFileSmart, trimAudio } from './media-tools'
import {
  bootstrapPortableApp,
  peekSingleInstancePolicy,
  readConfig,
  readQueueState,
  relocateQmdata,
  writeConfig,
  writeQueueState,
  type BootstrapResult,
} from './bootstrap'
import { defaultQmdataDir, ensureQmdataSuffix } from '../core/app-paths'
import {
  addMusicRoot,
  backgroundFileUrl,
  importBackgroundImage,
  importBgRotateImage,
  listBgRotateRels,
  loadCategories,
  loadGains,
  loadHotkeys,
  loadLyricsMap,
  loadLyricsRoot,
  loadRoots,
  loadTheme,
  loadTracks,
  loadWorkbenchTags,
  addWorkbenchTag,
  removeWorkbenchTag,
  setTrackWorkbenchTags,
  removeBgRotateImage,
  removeMusicRoot,
  resolveLyricsRootAbsolute,
  resolveRootAbsolute,
  saveCategories,
  saveGains,
  saveHotkeys,
  saveLyricsMap,
  saveLyricsRoot,
  saveTheme,
  saveTracks,
  tickBgRotate,
} from './store'
import { mergeBgRotate } from '../core/library-model'
import {
  applyFilenameMetaToAll,
  applyFilenameMetaVerified,
  backfillTrackFileTimes,
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
  getFailedGlobalAccels,
  refreshGlobalHotkeys,
  setHotkeyHandler,
  setHotkeyRegistrationEnabled,
  unregisterAllHotkeys,
  type HotkeyAction,
} from './hotkeys'
import { createAppTray, destroyAppTray, refreshTrayMenu, setTrayToolTip } from './tray'
import {
  resolveInstanceIdentity,
  releaseInstanceSlot,
  identityForSlot,
  watchInstanceSlots,
  type InstanceIdentity,
} from './instance-slot'
import { resolveShowMainHotkeyAction } from '../core/show-main'
import { buildWindowTitleFromTrack } from '../core/window-title'
import { evaluateHotkeyUsability, shouldAcceptHotkeyFire } from '../core/hotkey-config'
import { mergeDesktopLyrics, nextDesktopLyricsCycle } from '../core/desktop-lyrics'
import type { HotkeyBinding } from '../core/hotkey-config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let instanceId: InstanceIdentity = {
  slot: 1,
  displayName: 'Q-Music',
  appUserModelId: 'com.qmusic.app',
}

type AppWithQuitFlag = Electron.App & { isQuitting?: boolean }
function setAppQuitting(v: boolean) {
  isQuitting = v
  ;(app as AppWithQuitFlag).isQuitting = v
}

// Windows 默认 Overlay 滚动条会忽略 ::-webkit-scrollbar；关掉才能用自定义细圆角条
app.commandLine.appendSwitch('disable-overlay-scrollbar')

// 二次启动：先轻量读配置 + 抢锁，失败立刻退出（不做 bootstrap）
const peek = peekSingleInstancePolicy(__dirname)
const enforceSingleInstance = app.isPackaged && !peek.allowMultiInstance
const multiInstance = !enforceSingleInstance
// 多开：每个进程都是独立实例；单开：抢锁，失败则退出
const isPrimaryInstance = multiInstance || app.requestSingleInstanceLock()
if (!isPrimaryInstance) {
  process.exit(0)
}

// 多开领取槽位；显示名仅在「同时存活 ≥ 2」时才变成 Q-Music (n)
instanceId = resolveInstanceIdentity(multiInstance)
let lastNowPlaying: { title?: string | null; artist?: string | null } | null = null
let stopSlotWatch: (() => void) | null = null

function applyInstanceIdentity(next: InstanceIdentity) {
  const prev = instanceId.displayName
  instanceId = next
  try {
    app.setName(next.displayName)
    if (process.platform === 'win32') {
      app.setAppUserModelId(next.appUserModelId)
    }
  } catch {
    // ignore
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (process.platform === 'win32') {
        mainWindow.setAppDetails({
          appId: next.appUserModelId,
          relaunchDisplayName: next.displayName,
        })
      }
    } catch {
      // ignore
    }
    const full = buildWindowTitleFromTrack(next.displayName, lastNowPlaying)
    mainWindow.setTitle(full)
    setTrayToolTip(full)
    if (prev !== next.displayName) {
      mainWindow.webContents.send('app:displayName', next.displayName)
    }
  }
}

function refreshInstanceLabel() {
  if (!multiInstance) return
  const next = identityForSlot(instanceId.slot, true, app.getPath('appData'))
  if (
    next.displayName === instanceId.displayName &&
    next.appUserModelId === instanceId.appUserModelId
  ) {
    return
  }
  applyInstanceIdentity(next)
}

try {
  app.setName(instanceId.displayName)
  if (process.platform === 'win32') {
    app.setAppUserModelId(instanceId.appUserModelId)
  }
} catch {
  // ignore
}

const boot: BootstrapResult = bootstrapPortableApp(__dirname)

if (enforceSingleInstance) {
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

/** 快捷键专用：已在最前则最小化，否则唤起 */
function toggleMainWindowFromHotkey(opts?: { assumeFocused?: boolean }) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (app.isReady()) createWindow()
    return
  }
  const focused =
    Boolean(opts?.assumeFocused) ||
    mainWindow.isFocused() ||
    BrowserWindow.getFocusedWindow() === mainWindow
  const action = resolveShowMainHotkeyAction({
    exists: true,
    visible: mainWindow.isVisible(),
    minimized: mainWindow.isMinimized(),
    focused,
  })
  log('hotkey:show-main', {
    action,
    focused,
    assumeFocused: Boolean(opts?.assumeFocused),
    visible: mainWindow.isVisible(),
    minimized: mainWindow.isMinimized(),
  })
  if (action === 'minimize') {
    mainWindow.minimize()
    return
  }
  showOrCreateMainWindow()
}

const hotkeyFireAt = new Map<string, number>()

function dispatchHotkeyAction(action: HotkeyAction, opts?: { assumeFocused?: boolean }) {
  if (!shouldAcceptHotkeyFire(action, Date.now(), hotkeyFireAt, 220)) {
    log('hotkey:debounce-skip', action)
    return
  }
  log('hotkey:fire', action)
  if (action === 'show-main') {
    toggleMainWindowFromHotkey(opts)
    return
  }
  if (action === 'toggle-desktop-lyrics') {
    // 快捷键仅显隐；显示即锁定（未锁/锁定由独立锁定快捷键控制）
    const theme = loadTheme(boot.dataDir)
    const step = nextDesktopLyricsCycle(theme.desktopLyrics, 'two')
    const next = {
      ...theme,
      desktopLyrics: mergeDesktopLyrics({
        ...theme.desktopLyrics,
        visible: step.visible,
        locked: step.locked,
      }),
    }
    saveTheme(boot.dataDir, next)
    void syncDesktopLyricsWindow(next)
    mainWindow?.webContents.send('theme:changed', buildThemePayload())
    refreshTrayMenu()
    return
  }
  if (action === 'toggle-desktop-lyrics-lock') {
    const theme = loadTheme(boot.dataDir)
    const next = {
      ...theme,
      desktopLyrics: mergeDesktopLyrics({
        ...theme.desktopLyrics,
        locked: !theme.desktopLyrics.locked,
        visible: true,
      }),
    }
    saveTheme(boot.dataDir, next)
    void syncDesktopLyricsWindow(next)
    mainWindow?.webContents.send('theme:changed', buildThemePayload())
    refreshTrayMenu()
    return
  }
  // 隐藏到托盘时窗口仍在，向渲染进程发播放控制
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('hotkey:action', action)
  }
}

function setupTrayAndHotkeys() {
  // 开发/多开时往往有多个 electron；仅槽位 1 注册全局键，避免互相 unregisterAll 抢键
  const ownGlobals = !multiInstance || instanceId.slot === 1
  setHotkeyRegistrationEnabled(ownGlobals)
  setHotkeyHandler(dispatchHotkeyAction)
  const bindings = loadHotkeys(boot.dataDir)
  // 加载后写回规范化结果（如旧版 seek 键迁移）；数字键原样保留
  try {
    saveHotkeys(boot.dataDir, bindings)
  } catch {
    // ignore
  }
  const failed = applyHotkeyBindings(bindings)
  const usability = evaluateHotkeyUsability(bindings, failed)
  const doubtful = usability.filter((u) => u.doubtful)
  log('hotkeys:registered', {
    ownGlobals,
    slot: instanceId.slot,
    multiInstance,
    failed,
    bindings: bindings.map((b) => ({ action: b.action, global: b.global })),
    usability: usability.map((u) => ({
      action: u.action,
      kind: u.kind,
      usable: u.usable,
      doubtful: u.doubtful,
    })),
  })
  if (failed.length) log('hotkeys:register-failed', failed)
  if (doubtful.length) {
    log('hotkeys:digit-doubt', {
      count: doubtful.length,
      bindings: doubtful.map((u) => ({ action: u.action, global: u.accel })),
      tip: 'digit shortcuts kept as-is; UI shows 按键存疑',
    })
  }

  createAppTray({
    appRoot: boot.appRoot,
    mainDir: __dirname,
    displayName: instanceId.displayName,
    handlers: {
      getMain: () => mainWindow,
      getPlaying: () => false,
      getDesktopLyricsVisible: () =>
        Boolean(loadTheme(boot.dataDir).desktopLyrics.visible) || getDesktopLyricsVisible(),
      getDesktopLyricsLocked: () => getDesktopLyricsLocked(),
      sendAction: (action) => {
        if (action === 'show-main') {
          showOrCreateMainWindow()
          return
        }
        if (action === 'quit-app') {
          setAppQuitting(true)
          destroyDesktopLyrics()
          try {
            const theme = loadTheme(boot.dataDir)
            if (theme.desktopLyrics?.visible) {
              saveTheme(boot.dataDir, {
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
}

function getPreloadAndDev() {
  return {
    preloadPath: resolvePreloadPath(),
    mainDir: __dirname,
    devUrl: process.env.VITE_DEV_SERVER_URL,
  }
}

async function syncDesktopLyricsWindow(theme = loadTheme(boot.dataDir)) {
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
  const theme = loadTheme(boot.dataDir)
  let bgImageUrl: string | null = null
  const abs = backgroundFileUrl(boot.dataDir, theme.bgImageRel)
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
    title: instanceId.displayName,
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
  if (process.platform === 'win32') {
    try {
      win.setAppDetails({
        appId: instanceId.appUserModelId,
        relaunchDisplayName: instanceId.displayName,
      })
    } catch {
      // ignore
    }
  }

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
    ensureWindowOnScreen(win)
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
      // 藏起后重新注册全局键，避免个别环境下失效
      refreshGlobalHotkeys()
    }
  })
  win.on('closed', () => {
    stopWindowDrag()
    if (mainWindow === win) mainWindow = null
    log('window:closed')
  })
  // 切到其他软件再回来时，通知渲染进程刷新按钮态（拖拽区重挂载由渲染进程仅在失焦→聚焦时做）
  win.on('focus', () => notifyChromeRefresh(win))
  win.on('maximize', () => notifyChromeRefresh(win))
  win.on('unmaximize', () => notifyChromeRefresh(win))
  win.on('moved', () => ensureWindowOnScreen(win))
  win.on('restore', () => {
    ensureWindowOnScreen(win)
    notifyChromeRefresh(win)
    void syncDesktopLyricsWindow().catch(() => undefined)
  })
  win.on('show', () => {
    ensureWindowOnScreen(win)
    notifyChromeRefresh(win)
    void syncDesktopLyricsWindow().catch(() => undefined)
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

/** 保证标题栏至少有一块落在当前显示器工作区内，避免拖飞后拖不回来 */
function ensureWindowOnScreen(win: BrowserWindow) {
  if (win.isDestroyed() || win.isMinimized() || win.isMaximized() || win.isFullScreen()) return
  const b = win.getBounds()
  const wa = screen.getDisplayNearestPoint({ x: b.x + Math.round(b.width / 2), y: b.y + 20 }).workArea
  const minVisibleX = 100
  const titleBar = 40
  let { x, y } = b
  if (x + b.width < wa.x + minVisibleX) x = wa.x + minVisibleX - b.width
  if (x > wa.x + wa.width - minVisibleX) x = wa.x + wa.width - minVisibleX
  if (y + titleBar < wa.y) y = wa.y
  if (y > wa.y + wa.height - titleBar) y = wa.y + wa.height - titleBar
  if (x !== b.x || y !== b.y) {
    win.setBounds({ x, y, width: b.width, height: b.height }, false)
  }
}

/** JS 拖窗：切走再回来 CSS drag 会失效，故用主进程读光标 + 锁定宽高 */
type DragState = {
  win: BrowserWindow
  ox: number
  oy: number
  width: number
  height: number
  timer: ReturnType<typeof setInterval>
  /** wait-max：最大化按下后等光标移动再还原；arming：正在 unmaximize；normal：跟手拖 */
  mode: 'wait-max' | 'arming' | 'normal'
  startX: number
  startY: number
}
let activeDrag: DragState | null = null
const MAX_DRAG_SLOP_PX = 6

function stopWindowDrag() {
  if (activeDrag?.timer) clearInterval(activeDrag.timer)
  activeDrag = null
}

function placeRestoredUnderCursor(win: BrowserWindow, cursor: { x: number; y: number }) {
  const maxBounds = win.getBounds()
  const wa = screen.getDisplayMatching(maxBounds).workArea
  let normal: { x: number; y: number; width: number; height: number }
  try {
    normal = win.getNormalBounds()
  } catch {
    normal = { x: wa.x + 80, y: wa.y + 80, width: 1100, height: 720 }
  }
  const [minW, minH] = win.getMinimumSize()
  let width = Math.max(minW || 800, normal.width || 1100)
  let height = Math.max(minH || 560, normal.height || 720)
  // 无边框下 getNormalBounds 有时仍接近工作区，看起来像「还原了但仍是全屏」
  if (width >= wa.width - 8 && height >= wa.height - 8) {
    width = Math.max(minW || 800, Math.min(1100, Math.round(wa.width * 0.72)))
    height = Math.max(minH || 560, Math.min(720, Math.round(wa.height * 0.72)))
  }
  const ratioX =
    maxBounds.width > 0 ? Math.min(1, Math.max(0, (cursor.x - maxBounds.x) / maxBounds.width)) : 0.5
  const titleGrabY = 20
  const x = Math.round(cursor.x - width * ratioX)
  const y = Math.round(cursor.y - titleGrabY)
  return { x, y, width, height, ox: cursor.x - x, oy: cursor.y - y }
}

function tickWindowDrag() {
  if (!activeDrag || activeDrag.win.isDestroyed()) {
    stopWindowDrag()
    return
  }
  const drag = activeDrag
  const win = drag.win
  const c = screen.getCursorScreenPoint()

  if (drag.mode === 'wait-max') {
    if (Math.hypot(c.x - drag.startX, c.y - drag.startY) < MAX_DRAG_SLOP_PX) return
    if (!win.isMaximized()) {
      // 已非最大化：直接按当前尺寸拖
      const b = win.getBounds()
      drag.ox = c.x - b.x
      drag.oy = c.y - b.y
      drag.width = b.width
      drag.height = b.height
      drag.mode = 'normal'
      return
    }
    const placed = placeRestoredUnderCursor(win, c)
    drag.ox = placed.ox
    drag.oy = placed.oy
    drag.width = placed.width
    drag.height = placed.height
    drag.mode = 'arming'

    const applyRestored = () => {
      if (!activeDrag || activeDrag !== drag || win.isDestroyed()) return
      if (drag.mode === 'normal') return
      if (win.isMaximized()) win.unmaximize()
      const now = screen.getCursorScreenPoint()
      // ox/oy 在仍最大化时已按「还原尺寸 + 光标比例」算好；此处只落位
      win.setBounds(
        {
          x: Math.round(now.x - drag.ox),
          y: Math.round(now.y - drag.oy),
          width: drag.width,
          height: drag.height,
        },
        false,
      )
      drag.mode = 'normal'
      notifyChromeRefresh(win)
    }

    win.once('unmaximize', () => {
      // 等系统真正退出最大化后再 setBounds，否则 Windows 会忽略移动
      setImmediate(applyRestored)
    })
    win.unmaximize()
    // 个别环境不触发 unmaximize 事件：超时兜底
    setTimeout(() => {
      if (activeDrag === drag && drag.mode === 'arming') applyRestored()
    }, 40)
    return
  }

  if (drag.mode !== 'normal') return

  win.setBounds(
    {
      x: Math.round(c.x - drag.ox),
      y: Math.round(c.y - drag.oy),
      width: drag.width,
      height: drag.height,
    },
    false,
  )
}

/**
 * 最大化时：先进入 wait-max，光标移出阈值后再 unmaximize，并等事件后再 setBounds 跟手。
 * （按下瞬间 unmaximize + setBounds 在 Win 上常被忽略；渲染进程 blur 也会误结束拖拽。）
 */
function startWindowDrag(win: BrowserWindow) {
  stopWindowDrag()
  const cursor = screen.getCursorScreenPoint()

  if (win.isMaximized()) {
    activeDrag = {
      win,
      ox: 0,
      oy: 0,
      width: 0,
      height: 0,
      mode: 'wait-max',
      startX: cursor.x,
      startY: cursor.y,
      timer: setInterval(() => tickWindowDrag(), 4),
    }
    return
  }

  const b = win.getBounds()
  activeDrag = {
    win,
    ox: cursor.x - b.x,
    oy: cursor.y - b.y,
    width: b.width,
    height: b.height,
    mode: 'normal',
    startX: cursor.x,
    startY: cursor.y,
    timer: setInterval(() => tickWindowDrag(), 4),
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

if (isPrimaryInstance) {
app.whenReady().then(async () => {
  log('app:ready', {
    userData: app.getPath('userData'),
    music: defaultMusicDir(),
    logFile: getLogFile(),
    packaged: app.isPackaged,
    firstRun: boot.firstRun,
  })
  Menu.setApplicationMenu(null)

  if (multiInstance) {
    stopSlotWatch?.()
    stopSlotWatch = watchInstanceSlots(app.getPath('appData'), () => refreshInstanceLabel())
    refreshInstanceLabel()
  }

  ipcMain.handle('app:getInitInfo', () => ({
    appRoot: boot.appRoot,
    dataDir: boot.dataDir,
    firstRun: boot.firstRun,
    packaged: app.isPackaged,
    config: boot.config,
    defaultDataDir: defaultQmdataDir(boot.appRoot),
    displayName: instanceId.displayName,
    instanceSlot: instanceId.slot,
  }))

  /** 同步窗口标题 / 托盘悬停：`Q-Music - 艺人 - 歌名`（规范见 core/window-title） */
  ipcMain.handle(
    'app:setNowPlaying',
    (_e, payload: { title?: string | null; artist?: string | null } | null) => {
      lastNowPlaying = payload
      const full = buildWindowTitleFromTrack(instanceId.displayName, payload)
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(full)
      setTrayToolTip(full)
      return full
    },
  )

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
    const roots = loadRoots(boot.dataDir)
    const tracks = loadTracks(boot.dataDir)
    const categories = loadCategories(boot.dataDir)
    const gains = loadGains(boot.dataDir)
    const lyricsRoot = loadLyricsRoot(boot.dataDir)
    const lyricsRootAbs = resolveLyricsRootAbsolute(boot.dataDir)
    const playable = tracks
      .map((t) => trackToPlayable(boot.dataDir, t, roots, toMediaUrl))
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
    saveTheme(boot.dataDir, next)
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
    const rel = importBackgroundImage(boot.dataDir, result.filePaths[0])
    const theme = { ...loadTheme(boot.dataDir), bgStyle: 'image' as const, bgImageRel: rel }
    saveTheme(boot.dataDir, theme)
    return themePayload()
  })

  const bgRotatePayload = () => {
    const theme = loadTheme(boot.dataDir)
    const rotate = mergeBgRotate(theme.bgRotate)
    const items = listBgRotateRels(boot.dataDir, rotate.order).map((rel) => {
      const abs = backgroundFileUrl(boot.dataDir, rel)
      return {
        rel,
        name: path.basename(rel),
        url: abs ? toMediaUrl(abs) : '',
      }
    })
    return { items, ...themePayload() }
  }

  ipcMain.handle('theme:listBgRotate', () => bgRotatePayload())

  ipcMain.handle('theme:addBgRotate', async () => {
    const result = await dialog.showOpenDialog({
      title: '添加轮换背景图（可多选）',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    })
    if (result.canceled || !result.filePaths.length) return bgRotatePayload()
    const theme = loadTheme(boot.dataDir)
    const rotate = mergeBgRotate(theme.bgRotate)
    const added: string[] = []
    for (const p of result.filePaths) {
      added.push(importBgRotateImage(boot.dataDir, p))
    }
    const disk = listBgRotateRels(boot.dataDir, [])
    const order = [...rotate.order.filter((r) => disk.includes(r)), ...added.filter((r) => !rotate.order.includes(r))]
    const next = {
      ...theme,
      bgStyle: 'rotate' as const,
      bgImageRel:
        theme.bgImageRel && disk.includes(theme.bgImageRel) ? theme.bgImageRel : added[0] || null,
      bgRotate: mergeBgRotate({
        ...rotate,
        order,
        lastSwitchedAt: rotate.lastSwitchedAt || Date.now(),
      }),
    }
    saveTheme(boot.dataDir, next)
    return bgRotatePayload()
  })

  ipcMain.handle('theme:removeBgRotate', (_e, rel: string) => {
    const target = String(rel || '')
    removeBgRotateImage(boot.dataDir, target)
    const theme = loadTheme(boot.dataDir)
    const rotate = mergeBgRotate(theme.bgRotate)
    const order = rotate.order.filter((r) => r !== target)
    const rels = listBgRotateRels(boot.dataDir, order)
    let bgImageRel = theme.bgImageRel
    if (bgImageRel === target || (bgImageRel && !rels.includes(bgImageRel))) {
      bgImageRel = rels[0] || null
    }
    saveTheme(boot.dataDir, {
      ...theme,
      bgImageRel,
      bgRotate: mergeBgRotate({
        ...rotate,
        order: rels,
        lastSwitchedAt: Date.now(),
      }),
    })
    return bgRotatePayload()
  })

  ipcMain.handle('theme:reorderBgRotate', (_e, order: string[]) => {
    const theme = loadTheme(boot.dataDir)
    const rotate = mergeBgRotate(theme.bgRotate)
    const disk = listBgRotateRels(boot.dataDir, [])
    const nextOrder = Array.isArray(order)
      ? order.filter((r) => typeof r === 'string' && disk.includes(r))
      : rotate.order
    for (const r of disk) {
      if (!nextOrder.includes(r)) nextOrder.push(r)
    }
    saveTheme(boot.dataDir, {
      ...theme,
      bgRotate: mergeBgRotate({ ...rotate, order: nextOrder }),
    })
    return bgRotatePayload()
  })

  ipcMain.handle('theme:tickBgRotate', () => {
    const { changed } = tickBgRotate(boot.dataDir)
    return { changed, ...themePayload() }
  })

  ipcMain.handle('library:get', () => libraryPayload())

  ipcMain.handle('workbenchTags:get', () => loadWorkbenchTags(boot.dataDir))
  ipcMain.handle('workbenchTags:add', (_e, name: string) => addWorkbenchTag(boot.dataDir, String(name || '')))
  ipcMain.handle('workbenchTags:remove', (_e, tagId: string) =>
    removeWorkbenchTag(boot.dataDir, String(tagId || '')),
  )
  ipcMain.handle('workbenchTags:setTrack', (_e, trackId: string, tagIds: string[]) =>
    setTrackWorkbenchTags(boot.dataDir, String(trackId || ''), Array.isArray(tagIds) ? tagIds : []),
  )

  ipcMain.handle('library:addRoot', async () => {
    const result = await dialog.showOpenDialog({
      title: '添加音乐根目录（可多选多个文件夹，会合并进总曲库）',
      defaultPath: defaultMusicDir(),
      properties: ['openDirectory', 'multiSelections'],
    })
    if (!result.canceled) {
      for (const p of result.filePaths) addMusicRoot(boot.dataDir, p)
      await rescanAllRoots(boot.dataDir)
    }
    return libraryPayload()
  })
  ipcMain.handle('library:removeRoot', async (_e, rootId: string) => {
    removeMusicRoot(boot.dataDir, rootId)
    return libraryPayload()
  })
  ipcMain.handle('library:openRoot', async (_e, rootId: string) => {
    const root = loadRoots(boot.dataDir).find((r) => r.id === rootId)
    if (!root) return '目录不存在'
    const abs = resolveRootAbsolute(boot.dataDir, root)
    if (!fs.existsSync(abs)) return '路径不存在'
    return shell.openPath(abs)
  })
  ipcMain.handle('shell:openPath', async (_e, target: string) => {
    const abs = path.resolve(String(target || ''))
    if (!abs || !fs.existsSync(abs)) return '路径不存在'
    return shell.openPath(abs)
  })
  ipcMain.handle('library:rescan', async () => {
    await rescanAllRoots(boot.dataDir)
    return libraryPayload()
  })
  ipcMain.handle('library:updateTrack', (_e, patch: Partial<TrackRecord> & { id: string }) => {
    const tracks = loadTracks(boot.dataDir)
    const i = tracks.findIndex((t) => t.id === patch.id)
    if (i >= 0) {
      tracks[i] = { ...tracks[i], ...patch }
      saveTracks(boot.dataDir, tracks)
      if (patch.lyricsRel != null) {
        const map = loadLyricsMap(boot.dataDir)
        if (patch.lyricsRel) map[patch.id] = patch.lyricsRel
        else delete map[patch.id]
        saveLyricsMap(boot.dataDir, map)
      }
    }
    return libraryPayload()
  })
  ipcMain.handle('library:setCategories', (_e, cats: Category[]) => {
    saveCategories(boot.dataDir, cats)
    return libraryPayload()
  })
  ipcMain.handle('library:addCategory', (_e, name: string) => {
    const cats = loadCategories(boot.dataDir)
    const id = `cat-${Date.now()}`
    cats.push({ id, name })
    saveCategories(boot.dataDir, cats)
    return libraryPayload()
  })
  ipcMain.handle('library:applyFilenameMeta', () => {
    const result = applyFilenameMetaVerified(boot.dataDir)
    return { ...libraryPayload(), ...result }
  })
  ipcMain.handle('library:applyFilenameMetaForce', () => {
    const result = applyFilenameMetaToAll(boot.dataDir)
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
      const res = await importAudioFile(boot.dataDir, payload)
      if (!res.ok) return { ok: false as const, error: res.error, library: libraryPayload() }
      return { ok: true as const, trackId: res.track.id, library: libraryPayload() }
    },
  )
  ipcMain.handle('config:getImportTarget', () => {
    const cfg = readConfig(boot.configPath)
    const roots = loadRoots(boot.dataDir)
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
  ipcMain.handle('config:getPersistQueue', () => {
    const cfg = readConfig(boot.configPath)
    return cfg.persistQueue !== false
  })
  ipcMain.handle('config:setPersistQueue', (_e, persist: boolean) => {
    const next = { ...readConfig(boot.configPath), persistQueue: Boolean(persist) }
    writeConfig(boot.configPath, next)
    boot.config = next
    return { persistQueue: next.persistQueue !== false }
  })
  ipcMain.handle('config:getBehavior', () => {
    const cfg = readConfig(boot.configPath)
    return {
      allowMultiInstance: Boolean(cfg.allowMultiInstance),
      persistQueue: cfg.persistQueue !== false,
      desktopLyricsTripleCycle: cfg.desktopLyricsTripleCycle !== false,
      dataDir: boot.dataDir,
      defaultDataDir: defaultQmdataDir(boot.appRoot),
      appRoot: boot.appRoot,
    }
  })
  ipcMain.handle(
    'config:setBehavior',
    (
      _e,
      patch: {
        allowMultiInstance?: boolean
        persistQueue?: boolean
        desktopLyricsTripleCycle?: boolean
      },
    ) => {
    const cur = readConfig(boot.configPath)
    const next = {
      ...cur,
      ...(patch.allowMultiInstance != null ? { allowMultiInstance: Boolean(patch.allowMultiInstance) } : {}),
      ...(patch.persistQueue != null ? { persistQueue: Boolean(patch.persistQueue) } : {}),
      ...(patch.desktopLyricsTripleCycle != null
        ? { desktopLyricsTripleCycle: Boolean(patch.desktopLyricsTripleCycle) }
        : {}),
    }
    writeConfig(boot.configPath, next)
    boot.config = next
    return {
      allowMultiInstance: Boolean(next.allowMultiInstance),
      persistQueue: next.persistQueue !== false,
      desktopLyricsTripleCycle: next.desktopLyricsTripleCycle !== false,
      dataDir: boot.dataDir,
      defaultDataDir: defaultQmdataDir(boot.appRoot),
      appRoot: boot.appRoot,
    }
  },
  )
  ipcMain.handle('config:pickDataDir', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择数据存放位置（将自动使用其下的 qmdata 文件夹）',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: path.dirname(boot.dataDir),
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true as const }
    return { canceled: false as const, path: ensureQmdataSuffix(result.filePaths[0]) }
  })
  ipcMain.handle('config:relocateDataDir', async (_e, targetDir: string) => {
    const dest = ensureQmdataSuffix(targetDir)
    if (!dest) return { ok: false as const, error: '路径为空' }
    const res = relocateQmdata(boot.appRoot, boot.dataDir, dest)
    if (!res.ok) return res
    // 移动成功后重启
    app.relaunch()
    setAppQuitting(true)
    app.exit(0)
    return { ok: true as const, dataDir: dest }
  })
  ipcMain.handle('queue:get', () => {
    const cfg = readConfig(boot.configPath)
    if (cfg.persistQueue === false) return { trackIds: [], currentId: null }
    return readQueueState(boot.dataDir)
  })
  ipcMain.handle(
    'queue:set',
    (_e, state: { trackIds?: string[]; currentId?: string | null }) => {
      const cfg = readConfig(boot.configPath)
      if (cfg.persistQueue === false) {
        writeQueueState(boot.dataDir, { trackIds: [], currentId: null })
        return { trackIds: [], currentId: null }
      }
      const next = {
        trackIds: Array.isArray(state?.trackIds) ? state.trackIds.filter((x) => typeof x === 'string') : [],
        currentId: typeof state?.currentId === 'string' ? state.currentId : null,
      }
      writeQueueState(boot.dataDir, next)
      return next
    },
  )
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
      const res = await renameTrackFile(boot.dataDir, payload.id, payload)
      if (!res.ok) return { ok: false as const, error: res.error, library: libraryPayload() }
      return { ok: true as const, oldId: res.oldId, trackId: res.track.id, library: libraryPayload() }
    },
  )
  ipcMain.handle('library:getGains', () => loadGains(boot.dataDir))
  ipcMain.handle('library:setGains', (_e, gains: Record<string, number>) => {
    saveGains(boot.dataDir, gains)
    return loadGains(boot.dataDir)
  })
  ipcMain.handle('lyrics:bindToTrack', async (_e, trackId: string) => {
    const result = await dialog.showOpenDialog({
      title: '为当前曲绑定歌词',
      properties: ['openFile'],
      filters: [{ name: 'LRC', extensions: ['lrc', 'txt'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const rel = toRelativeIfUnderRoot(boot.appRoot, result.filePaths[0])
    const map = loadLyricsMap(boot.dataDir)
    map[trackId] = rel
    saveLyricsMap(boot.dataDir, map)
    const tracks = loadTracks(boot.dataDir)
    const i = tracks.findIndex((t) => t.id === trackId)
    if (i >= 0) {
      tracks[i] = { ...tracks[i], lyricsRel: rel }
      saveTracks(boot.dataDir, tracks)
    }
    const content = await readTextFileSmart(result.filePaths[0])
    return { path: result.filePaths[0], content, lyricsRel: rel, library: libraryPayload() }
  })
  ipcMain.handle('lyrics:loadForTrack', async (_e, trackId: string) => {
    const found = await resolveLyricsFileForTrack(boot.dataDir, trackId)
    if (!found.path) return { path: null, content: null }
    try {
      const content = await readTextFileSmart(found.path)
      // 若靠歌词根/旁路找到但 map 未记，写回映射方便下次
      if (found.via && found.via !== 'map') {
        const map = loadLyricsMap(boot.dataDir)
        const rel = toRelativeIfUnderRoot(boot.appRoot, found.path)
        if (map[trackId] !== rel) {
          map[trackId] = rel
          saveLyricsMap(boot.dataDir, map)
          const tracks = loadTracks(boot.dataDir)
          const i = tracks.findIndex((t) => t.id === trackId)
          if (i >= 0) {
            tracks[i] = { ...tracks[i], lyricsRel: rel }
            saveTracks(boot.dataDir, tracks)
          }
        }
      }
      return { path: found.path, content }
    } catch {
      return { path: null, content: null }
    }
  })

  ipcMain.handle('lyrics:getRoot', () => {
    const settings = loadLyricsRoot(boot.dataDir)
    return {
      path: settings.path,
      absPath: resolveLyricsRootAbsolute(boot.dataDir),
    }
  })

  ipcMain.handle('lyrics:pickRoot', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择歌词目录（保存/读取 .lrc，按音频同名匹配）',
      defaultPath: resolveLyricsRootAbsolute(boot.dataDir) || defaultMusicDir(),
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) {
      return {
        path: loadLyricsRoot(boot.dataDir).path,
        absPath: resolveLyricsRootAbsolute(boot.dataDir),
        library: libraryPayload(),
      }
    }
    const stored = toRelativeIfUnderRoot(boot.appRoot, result.filePaths[0])
    saveLyricsRoot(boot.dataDir, { path: stored })
    await rescanAllRoots(boot.dataDir)
    return {
      path: stored,
      absPath: resolveLyricsRootAbsolute(boot.dataDir),
      library: libraryPayload(),
    }
  })

  ipcMain.handle('lyrics:clearRoot', async () => {
    saveLyricsRoot(boot.dataDir, { path: null })
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
    const res = await saveLyricsForTrack(boot.dataDir, trackId, content)
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
    const theme = loadTheme(boot.dataDir)
    const next = {
      ...theme,
      desktopLyrics: { ...theme.desktopLyrics, visible: Boolean(visible) },
    }
    saveTheme(boot.dataDir, next)
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

  ipcMain.handle('hotkeys:get', () => loadHotkeys(boot.dataDir))
  ipcMain.handle('hotkeys:dispatch', (_e, action: string) => {
    // 渲染进程按键 = 用户正在窗内操作，显示键应视为已在前台
    dispatchHotkeyAction(action as HotkeyAction, { assumeFocused: true })
    return true
  })
  ipcMain.handle('hotkeys:set', (_e, bindings: HotkeyBinding[]) => {
    saveHotkeys(boot.dataDir, bindings)
    const next = loadHotkeys(boot.dataDir)
    applyHotkeyBindings(next)
    return { bindings: next, failedGlobals: getFailedGlobalAccels() }
  })
  ipcMain.handle('hotkeys:failedGlobals', () => getFailedGlobalAccels())

  setDesktopLyricsBoundsListener((bounds) => {
    const theme = loadTheme(boot.dataDir)
    const next = {
      ...theme,
      desktopLyrics: mergeDesktopLyrics({ ...theme.desktopLyrics, bounds }),
    }
    saveTheme(boot.dataDir, next)
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
    // 老曲库补齐文件时间（仅缺失时做一次 stat），保证首页「修改/创建时间」排序可用
    await backfillTrackFileTimes(boot.dataDir)
      .then((changed) => {
        if (changed) log('library:backfilled file times')
      })
      .catch((err) => log('backfill file times failed', err instanceof Error ? err : String(err)))
    setupTrayAndHotkeys()
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
    const theme = loadTheme(boot.dataDir)
    if (theme.desktopLyrics?.visible) {
      saveTheme(boot.dataDir, {
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
  try {
    stopSlotWatch?.()
  } catch {
    // ignore
  }
  stopSlotWatch = null
  if (multiInstance) {
    releaseInstanceSlot(app.getPath('appData'), instanceId.slot)
  }
})
} // isPrimaryInstance