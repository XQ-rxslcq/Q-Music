/** 快捷键配置（data/hotkeys.json）与冲突检测 */

export type HotkeyAction =
  | 'toggle-play'
  | 'prev'
  | 'next'
  | 'vol-up'
  | 'vol-down'
  | 'seek-back'
  | 'seek-fwd'
  | 'toggle-desktop-lyrics'
  | 'toggle-desktop-lyrics-lock'

export type HotkeyBinding = {
  action: HotkeyAction
  /** Electron accelerator，空字符串表示未绑定 */
  global: string
  /** 窗内 KeyboardEvent.code 或组合描述，空表示用内置默认 */
  inApp: string
}

export const HOTKEY_ACTION_LABELS: Record<HotkeyAction, string> = {
  'toggle-play': '播放 / 暂停',
  prev: '上一首',
  next: '下一首',
  'vol-up': '音量 +',
  'vol-down': '音量 −',
  'seek-back': '快退',
  'seek-fwd': '快进',
  'toggle-desktop-lyrics': '桌面歌词显隐',
  'toggle-desktop-lyrics-lock': '桌面歌词锁定',
}

export const DEFAULT_HOTKEY_BINDINGS: HotkeyBinding[] = [
  { action: 'toggle-play', global: 'CommandOrControl+Alt+Space', inApp: 'Space' },
  { action: 'prev', global: 'CommandOrControl+Alt+Left', inApp: 'Ctrl+ArrowLeft' },
  { action: 'next', global: 'CommandOrControl+Alt+Right', inApp: 'Ctrl+ArrowRight' },
  { action: 'vol-up', global: 'CommandOrControl+Alt+Up', inApp: 'ArrowUp' },
  { action: 'vol-down', global: 'CommandOrControl+Alt+Down', inApp: 'ArrowDown' },
  { action: 'seek-back', global: 'CommandOrControl+Alt+,', inApp: 'ArrowLeft' },
  { action: 'seek-fwd', global: 'CommandOrControl+Alt+.', inApp: 'ArrowRight' },
  { action: 'toggle-desktop-lyrics', global: 'CommandOrControl+Alt+D', inApp: '' },
  { action: 'toggle-desktop-lyrics-lock', global: 'CommandOrControl+Alt+L', inApp: '' },
]

export type HotkeyConflict = {
  scope: 'global' | 'inApp'
  accel: string
  actions: HotkeyAction[]
}

export function mergeHotkeyBindings(raw?: HotkeyBinding[] | null): HotkeyBinding[] {
  const map = new Map(DEFAULT_HOTKEY_BINDINGS.map((b) => [b.action, { ...b }]))
  for (const b of raw || []) {
    if (!b?.action || !map.has(b.action)) continue
    map.set(b.action, {
      action: b.action,
      global: typeof b.global === 'string' ? b.global : map.get(b.action)!.global,
      inApp: typeof b.inApp === 'string' ? b.inApp : map.get(b.action)!.inApp,
    })
  }
  return DEFAULT_HOTKEY_BINDINGS.map((d) => map.get(d.action)!)
}

export function findHotkeyConflicts(bindings: HotkeyBinding[]): HotkeyConflict[] {
  const out: HotkeyConflict[] = []
  for (const scope of ['global', 'inApp'] as const) {
    const byAccel = new Map<string, HotkeyAction[]>()
    for (const b of bindings) {
      const accel = (scope === 'global' ? b.global : b.inApp).trim()
      if (!accel) continue
      const key = accel.toLowerCase()
      const list = byAccel.get(key) || []
      list.push(b.action)
      byAccel.set(key, list)
    }
    for (const [accel, actions] of byAccel) {
      if (actions.length > 1) out.push({ scope, accel, actions })
    }
  }
  return out
}

/** 从键盘事件生成简易 inApp 描述（与默认表一致的风格） */
export function eventToInAppAccel(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = e.key
  if (key === ' ') parts.push('Space')
  else if (key.startsWith('Arrow')) parts.push(key)
  else if (key.length === 1) parts.push(key.toUpperCase())
  else if (key === 'Escape' || key === 'Enter' || key === 'Tab') parts.push(key)
  else parts.push(e.code)
  return parts.join('+')
}

export function matchInAppBinding(e: KeyboardEvent, accel: string): boolean {
  if (!accel.trim()) return false
  return eventToInAppAccel(e).toLowerCase() === accel.trim().toLowerCase()
}
