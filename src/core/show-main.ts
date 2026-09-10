/** 主界面「显示」快捷键：已在最前则最小化，否则唤起 */

export type MainWindowHotkeyState = {
  exists: boolean
  visible: boolean
  minimized: boolean
  focused: boolean
}

export type ShowMainHotkeyAction = 'create' | 'show' | 'minimize'

/**
 * 快捷键「显示主界面」行为：
 * - 无窗口 → 创建
 * - 已显示且未最小化且在最前 → 最小化
 * - 其它（藏托盘 / 最小化 / 失焦）→ 显示并前置
 */
export function resolveShowMainHotkeyAction(state: MainWindowHotkeyState): ShowMainHotkeyAction {
  if (!state.exists) return 'create'
  if (state.visible && !state.minimized && state.focused) return 'minimize'
  return 'show'
}
