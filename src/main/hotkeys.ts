import { app, globalShortcut } from 'electron'
import type { HotkeyAction, HotkeyBinding } from '../core/hotkey-config'
import { DEFAULT_HOTKEY_BINDINGS, mergeHotkeyBindings } from '../core/hotkey-config'
import { accelVariants, shouldRefreshGlobalHotkeys } from '../core/hotkey-runtime'

export type { HotkeyAction }

type Handler = (action: HotkeyAction) => void

let registered = false
let handler: Handler | null = null
/** 多开时仅「热键所有者」进程注册；其它进程不得 unregister/register */
let registrationEnabled = true
let currentBindings: HotkeyBinding[] = mergeHotkeyBindings(DEFAULT_HOTKEY_BINDINGS)
const failedAccels = new Set<string>()
const liveAccels = new Set<string>()
let healthTimer: NodeJS.Timeout | null = null

export function setHotkeyHandler(fn: Handler | null) {
  handler = fn
}

/** 多开：仅 slot=1（或单开）为 true，避免多进程互相 unregisterAll 抢键 */
export function setHotkeyRegistrationEnabled(enabled: boolean) {
  registrationEnabled = enabled
  if (!enabled) {
    if (healthTimer) {
      clearInterval(healthTimer)
      healthTimer = null
    }
    try {
      globalShortcut.unregisterAll()
    } catch {
      // ignore
    }
    registered = false
    liveAccels.clear()
    failedAccels.clear()
  }
}

export function isHotkeyRegistrationEnabled() {
  return registrationEnabled
}

export function getHotkeyBindings() {
  return currentBindings
}

export function getFailedGlobalAccels(): string[] {
  return [...failedAccels]
}

export function applyHotkeyBindings(bindings: HotkeyBinding[]) {
  currentBindings = mergeHotkeyBindings(bindings)
  if (!registrationEnabled) {
    failedAccels.clear()
    failedAccels.add('（多开）本实例不注册全局快捷键，请用首个实例')
    return [...failedAccels]
  }
  startHealthMonitor()
  return refreshGlobalHotkeys()
}

/**
 * 全局快捷键始终注册（不论主窗是否焦点）。
 * 必须在 setHotkeyHandler 之后调用才有实际效果。
 */
export function refreshGlobalHotkeys(): string[] {
  if (!app.isReady()) return []
  if (!registrationEnabled) {
    return ['（多开）本实例跳过全局快捷键注册']
  }
  try {
    globalShortcut.unregisterAll()
  } catch {
    // ignore
  }
  registered = false
  failedAccels.clear()
  liveAccels.clear()

  if (!handler) {
    return ['（内部）快捷键处理器未就绪']
  }

  for (const item of currentBindings) {
    const accel = item.global?.trim()
    if (!accel) continue
    let ok = false
    for (const variant of accelVariants(accel)) {
      try {
        if (globalShortcut.isRegistered(variant)) {
          globalShortcut.unregister(variant)
        }
        const registeredOk = globalShortcut.register(variant, () => {
          try {
            handler?.(item.action)
          } catch {
            // ignore handler errors
          }
        })
        if (registeredOk) {
          ok = true
          liveAccels.add(variant)
          liveAccels.add(accel)
          break
        }
      } catch {
        // try next variant
      }
    }
    if (!ok) failedAccels.add(accel)
  }
  registered = true
  return [...failedAccels]
}

/** 仅在键丢失时重注 */
export function ensureGlobalHotkeysHealthy(): string[] {
  if (!registrationEnabled || !handler || !app.isReady()) return [...failedAccels]
  const expected = currentBindings.map((b) => b.global?.trim()).filter(Boolean) as string[]
  const registeredList = [...liveAccels].filter((a) => {
    try {
      return globalShortcut.isRegistered(a)
    } catch {
      return false
    }
  })
  for (const accel of expected) {
    for (const v of accelVariants(accel)) {
      try {
        if (globalShortcut.isRegistered(v) && !registeredList.includes(v)) registeredList.push(v)
      } catch {
        // ignore
      }
    }
  }
  if (
    !shouldRefreshGlobalHotkeys({
      hasHandler: Boolean(handler),
      expectedAccels: expected,
      registeredAccels: registeredList,
    })
  ) {
    return [...failedAccels]
  }
  return refreshGlobalHotkeys()
}

function startHealthMonitor() {
  if (!registrationEnabled) return
  if (healthTimer) return
  healthTimer = setInterval(() => {
    try {
      ensureGlobalHotkeysHealthy()
    } catch {
      // ignore
    }
  }, 8000)
  if (typeof healthTimer.unref === 'function') healthTimer.unref()
}

/** @deprecated */
export function setGlobalHotkeysActive(active: boolean): string[] {
  if (!active) {
    try {
      globalShortcut.unregisterAll()
    } catch {
      // ignore
    }
    registered = false
    liveAccels.clear()
    return []
  }
  return refreshGlobalHotkeys()
}

export function unregisterAllHotkeys() {
  if (healthTimer) {
    clearInterval(healthTimer)
    healthTimer = null
  }
  try {
    globalShortcut.unregisterAll()
  } catch {
    // ignore
  }
  registered = false
  failedAccels.clear()
  liveAccels.clear()
}
