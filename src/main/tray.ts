/** 系统托盘：关窗隐藏、右键控制播放与桌面歌词 */

import { Tray, Menu, nativeImage, app, type BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import type { HotkeyAction } from '../core/hotkey-config'

export type TrayHandlers = {
  getMain: () => BrowserWindow | null
  sendAction: (action: HotkeyAction | 'show-main' | 'quit-app') => void
  getPlaying: () => boolean
  getDesktopLyricsVisible: () => boolean
  getDesktopLyricsLocked: () => boolean
}

let tray: Tray | null = null
let handlers: TrayHandlers | null = null

function resolveTrayIcon(appRoot: string, mainDir: string): Electron.NativeImage {
  const candidates = [
    path.join(appRoot, 'assets', 'icon.png'),
    path.join(mainDir, '../assets/icon.png'),
    path.join(mainDir, '../build/icon.png'),
    path.join(app.getAppPath(), 'assets', 'icon.png'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) return img.resize({ width: 16, height: 16 })
    }
  }
  return nativeImage.createEmpty()
}

function buildMenu() {
  const h = handlers
  if (!h) return Menu.buildFromTemplate([])
  const playing = h.getPlaying()
  const dlOn = h.getDesktopLyricsVisible()
  const dlLocked = h.getDesktopLyricsLocked()
  return Menu.buildFromTemplate([
    {
      label: playing ? '暂停' : '播放',
      click: () => h.sendAction('toggle-play'),
    },
    { label: '上一首', click: () => h.sendAction('prev') },
    { label: '下一首', click: () => h.sendAction('next') },
    { type: 'separator' },
    { label: '音量 +', click: () => h.sendAction('vol-up') },
    { label: '音量 −', click: () => h.sendAction('vol-down') },
    { type: 'separator' },
    {
      label: dlOn ? '隐藏桌面歌词' : '显示桌面歌词',
      click: () => h.sendAction('toggle-desktop-lyrics'),
    },
    {
      label: dlLocked ? '解锁桌面歌词' : '锁定桌面歌词',
      enabled: dlOn,
      click: () => h.sendAction('toggle-desktop-lyrics-lock'),
    },
    { type: 'separator' },
    { label: '打开主界面', click: () => h.sendAction('show-main') },
    { label: '退出 Q-Music', click: () => h.sendAction('quit-app') },
  ])
}

export function createAppTray(opts: {
  appRoot: string
  mainDir: string
  handlers: TrayHandlers
}) {
  handlers = opts.handlers
  if (tray && !tray.isDestroyed()) {
    tray.destroy()
    tray = null
  }
  const icon = resolveTrayIcon(opts.appRoot, opts.mainDir)
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0ABYBzVMKoBWDQMHBgYGBj/MzAw/B8YGBgYRg0YNgAAf/sD/QVxQXkAAAAASUVORK5CYII=',
  ) : icon)
  tray.setToolTip('Q-Music')
  tray.on('click', () => handlers?.sendAction('show-main'))
  tray.on('right-click', () => {
    tray?.popUpContextMenu(buildMenu())
  })
  tray.setContextMenu(buildMenu())
  return tray
}

export function refreshTrayMenu() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildMenu())
}

export function destroyAppTray() {
  if (tray && !tray.isDestroyed()) tray.destroy()
  tray = null
  handlers = null
}
