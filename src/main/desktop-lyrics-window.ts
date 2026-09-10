import { BrowserWindow, screen } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { DesktopLyricsBounds, DesktopLyricsSettings } from '../core/desktop-lyrics'
import { DEFAULT_DESKTOP_LYRICS, mergeDesktopLyrics } from '../core/desktop-lyrics'

export type DesktopLyricsPayload = {
  settings: DesktopLyricsSettings
  lines: Array<{ timeMs: number; text: string }>
  currentTime: number
  duration?: number
  title?: string
  artist?: string
  playing?: boolean
}

let overlay: BrowserWindow | null = null
let lastPayload: DesktopLyricsPayload = {
  settings: { ...DEFAULT_DESKTOP_LYRICS },
  lines: [],
  currentTime: 0,
  duration: 0,
}

type BoundsListener = (bounds: DesktopLyricsBounds) => void
let onBoundsCommit: BoundsListener | null = null

export function setDesktopLyricsBoundsListener(fn: BoundsListener | null) {
  onBoundsCommit = fn
}

function defaultBounds(settings: DesktopLyricsSettings) {
  const wa = screen.getPrimaryDisplay().workArea
  if (settings.orientation === 'vertical') {
    const w = Math.min(220, Math.floor(wa.width * 0.18))
    return {
      x: wa.x + wa.width - w - 12,
      y: wa.y + 24,
      width: w,
      height: Math.max(280, wa.height - 48),
    }
  }
  const h = settings.lineCount === 2 ? 140 : 100
  return {
    x: wa.x + 40,
    y: wa.y + wa.height - h - 28,
    width: Math.max(320, wa.width - 80),
    height: h,
  }
}

function resolveBounds(settings: DesktopLyricsSettings): DesktopLyricsBounds {
  if (settings.bounds && settings.bounds.width > 80 && settings.bounds.height > 40) {
    return { ...settings.bounds }
  }
  return defaultBounds(settings)
}

function resolveOverlayUrl(
  devUrl: string | undefined,
  mainDir: string,
  appPath?: string,
): { type: 'url' | 'file'; value: string } {
  if (devUrl) {
    const base = devUrl.replace(/\/$/, '')
    return { type: 'url', value: `${base}/desktop-lyrics.html` }
  }
  const candidates = [
    appPath ? path.join(appPath, 'dist-renderer', 'desktop-lyrics.html') : '',
    path.join(mainDir, '../dist-renderer/desktop-lyrics.html'),
    path.join(mainDir, '../dist/desktop-lyrics.html'),
    path.join(mainDir, 'desktop-lyrics.html'),
  ].filter(Boolean)
  for (const p of candidates) {
    if (fs.existsSync(p)) return { type: 'file', value: p }
  }
  return { type: 'file', value: candidates[0] }
}

export function getDesktopLyricsVisible() {
  return Boolean(overlay && !overlay.isDestroyed() && overlay.isVisible())
}

export function getDesktopLyricsLocked() {
  return Boolean(lastPayload.settings.locked)
}

/** 浮层当前几何（无窗则 null） */
export function getDesktopLyricsLiveBounds(): DesktopLyricsBounds | null {
  if (!overlay || overlay.isDestroyed()) return null
  return liveBoundsOf(overlay)
}

export function pushDesktopLyrics(payload: Partial<DesktopLyricsPayload>) {
  lastPayload = {
    ...lastPayload,
    ...payload,
    settings: payload.settings ? mergeDesktopLyrics(payload.settings) : lastPayload.settings,
    lines: payload.lines ?? lastPayload.lines,
  }
  if (overlay && !overlay.isDestroyed()) {
    overlay.webContents.send('desktop-lyrics:payload', lastPayload)
  }
}

function applyLockMode(win: BrowserWindow, locked: boolean) {
  win.setMovable(!locked)
  win.setResizable(!locked)
  try {
    if (locked) win.setIgnoreMouseEvents(true, { forward: true })
    else win.setIgnoreMouseEvents(false)
  } catch {
    win.setIgnoreMouseEvents(locked)
  }
}

function liveBoundsOf(win: BrowserWindow): DesktopLyricsBounds {
  const b = win.getBounds()
  return { x: b.x, y: b.y, width: b.width, height: b.height }
}

function geometryChanged(prev: DesktopLyricsSettings, next: DesktopLyricsSettings) {
  return prev.orientation !== next.orientation || prev.lineCount !== next.lineCount
}

function wireBoundsEvents(win: BrowserWindow) {
  const commit = () => {
    if (!win || win.isDestroyed()) return
    const bounds = liveBoundsOf(win)
    lastPayload.settings = { ...lastPayload.settings, bounds }
    onBoundsCommit?.(bounds)
  }
  win.on('moved', commit)
  win.on('resized', commit)
}

export async function setDesktopLyricsVisible(
  visible: boolean,
  opts: {
    preloadPath: string
    mainDir: string
    appPath?: string
    devUrl?: string
    settings?: DesktopLyricsSettings
  },
) {
  const prev = lastPayload.settings
  const settings = mergeDesktopLyrics(opts.settings || lastPayload.settings)
  lastPayload.settings = { ...settings, visible }

  if (!visible) {
    if (overlay && !overlay.isDestroyed()) overlay.hide()
    return { visible: false }
  }

  const locked = settings.locked !== false

  if (!overlay || overlay.isDestroyed()) {
    const b = resolveBounds(settings)
    overlay = new BrowserWindow({
      ...b,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: !locked,
      movable: !locked,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: !locked,
      hasShadow: false,
      show: false,
      title: 'Q-Music Lyrics',
      webPreferences: {
        preload: opts.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    overlay.setAlwaysOnTop(true, 'floating')
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    applyLockMode(overlay, locked)
    wireBoundsEvents(overlay)

    const entry = resolveOverlayUrl(opts.devUrl, opts.mainDir, opts.appPath)
    if (entry.type === 'file' && !fs.existsSync(entry.value)) {
      console.error('[desktop-lyrics] overlay html missing:', entry.value)
    }
    if (entry.type === 'url') await overlay.loadURL(entry.value)
    else await overlay.loadFile(entry.value)

    overlay.once('ready-to-show', () => {
      if (!overlay || overlay.isDestroyed()) return
      overlay.showInactive()
      overlay.webContents.send('desktop-lyrics:payload', lastPayload)
    })
    overlay.on('closed', () => {
      overlay = null
    })
  } else {
    // 调整大小后 React theme 里的 bounds 常滞后；锁定时以窗口实时尺寸为准，避免被旧配置打回
    const live = liveBoundsOf(overlay)
    const forceGeom = geometryChanged(prev, settings)
    lastPayload.settings = {
      ...settings,
      visible: true,
      bounds: forceGeom ? resolveBounds(settings) : live,
    }
    if (forceGeom) overlay.setBounds(resolveBounds(lastPayload.settings))
    applyLockMode(overlay, locked)
    overlay.setFocusable(!locked)
    overlay.showInactive()
    overlay.webContents.send('desktop-lyrics:payload', lastPayload)
  }

  return { visible: true }
}

export function applyDesktopLyricsLayout(settings: DesktopLyricsSettings) {
  const prev = lastPayload.settings
  const merged = mergeDesktopLyrics(settings)
  if (overlay && !overlay.isDestroyed() && overlay.isVisible()) {
    const live = liveBoundsOf(overlay)
    const forceGeom = geometryChanged(prev, merged)
    lastPayload.settings = {
      ...merged,
      bounds: forceGeom ? resolveBounds(merged) : live,
    }
    if (forceGeom) overlay.setBounds(resolveBounds(lastPayload.settings))
    const locked = lastPayload.settings.locked !== false
    applyLockMode(overlay, locked)
    overlay.setFocusable(!locked)
    overlay.webContents.send('desktop-lyrics:payload', lastPayload)
  } else {
    lastPayload.settings = merged
  }
}

export function destroyDesktopLyrics() {
  if (overlay && !overlay.isDestroyed()) overlay.destroy()
  overlay = null
}
