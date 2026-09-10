import { globalShortcut, type BrowserWindow } from 'electron'
import type { HotkeyAction, HotkeyBinding } from '../core/hotkey-config'
import { DEFAULT_HOTKEY_BINDINGS, mergeHotkeyBindings } from '../core/hotkey-config'

export type { HotkeyAction }

type Handler = (action: HotkeyAction) => void

let registered = false
let handler: Handler | null = null
let currentBindings: HotkeyBinding[] = mergeHotkeyBindings(DEFAULT_HOTKEY_BINDINGS)

export function setHotkeyHandler(fn: Handler | null) {
  handler = fn
}

export function getHotkeyBindings() {
  return currentBindings
}

export function applyHotkeyBindings(bindings: HotkeyBinding[], globalActive: boolean) {
  currentBindings = mergeHotkeyBindings(bindings)
  if (registered) {
    globalShortcut.unregisterAll()
    registered = false
  }
  if (globalActive) setGlobalHotkeysActive(true)
}

/** 主窗失焦时注册；聚焦时注销，避免与应用内快捷键重复 */
export function setGlobalHotkeysActive(active: boolean) {
  if (!active) {
    if (registered) {
      globalShortcut.unregisterAll()
      registered = false
    }
    return
  }
  if (registered) return
  for (const item of currentBindings) {
    const accel = item.global?.trim()
    if (!accel) continue
    try {
      globalShortcut.register(accel, () => handler?.(item.action))
    } catch {
      /* 被占用则跳过 */
    }
  }
  registered = true
}

export function bindMainWindowHotkeyLifecycle(getMain: () => BrowserWindow | null) {
  const attach = (win: BrowserWindow) => {
    win.on('focus', () => setGlobalHotkeysActive(false))
    win.on('blur', () => setGlobalHotkeysActive(true))
    if (win.isFocused()) setGlobalHotkeysActive(false)
    else setGlobalHotkeysActive(true)
  }
  const win = getMain()
  if (win) attach(win)
  return attach
}

export function unregisterAllHotkeys() {
  globalShortcut.unregisterAll()
  registered = false
}
