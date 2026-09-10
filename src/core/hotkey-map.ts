/** @deprecated 使用 hotkey-config；保留 re-export 兼容旧测试 */
export {
  DEFAULT_HOTKEY_BINDINGS as GLOBAL_HOTKEY_MAP_RAW,
  type HotkeyAction,
  type HotkeyBinding,
  findHotkeyConflicts,
  mergeHotkeyBindings,
} from './hotkey-config'
import { DEFAULT_HOTKEY_BINDINGS, type HotkeyAction } from './hotkey-config'

/** 仅全局加速器列表（供主进程注册） */
export const GLOBAL_HOTKEY_MAP: ReadonlyArray<{ accel: string; action: HotkeyAction }> =
  DEFAULT_HOTKEY_BINDINGS.filter((b) => b.global).map((b) => ({
    accel: b.global,
    action: b.action,
  }))

export function actionsInHotkeyMap(
  map: ReadonlyArray<{ accel: string; action: HotkeyAction }> = GLOBAL_HOTKEY_MAP,
): HotkeyAction[] {
  return map.map((m) => m.action)
}

export function hasUniqueAccelerators(
  map: ReadonlyArray<{ accel: string; action: HotkeyAction }> = GLOBAL_HOTKEY_MAP,
): boolean {
  const set = new Set(map.map((m) => m.accel).filter(Boolean))
  return set.size === map.filter((m) => m.accel).length
}
