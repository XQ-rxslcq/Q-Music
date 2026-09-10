/** 快捷键配置（qmdata/hotkeys.json）与冲突检测 / 按键显示 */

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
  | 'show-main'

export type HotkeyBinding = {
  action: HotkeyAction
  /** Electron accelerator；全局始终注册 */
  global: string
  /** 窗内兜底（与 global 同步展示；可空） */
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
  'show-main': '显示 / 最小化主界面',
}

export const DEFAULT_HOTKEY_BINDINGS: HotkeyBinding[] = [
  { action: 'toggle-play', global: 'CommandOrControl+Alt+Space', inApp: '' },
  { action: 'prev', global: 'CommandOrControl+Alt+Left', inApp: '' },
  { action: 'next', global: 'CommandOrControl+Alt+Right', inApp: '' },
  { action: 'vol-up', global: 'CommandOrControl+Alt+Up', inApp: '' },
  { action: 'vol-down', global: 'CommandOrControl+Alt+Down', inApp: '' },
  // 逗号/句号在部分 Windows 环境无法注册，改用方括号
  { action: 'seek-back', global: 'CommandOrControl+Alt+[', inApp: '' },
  { action: 'seek-fwd', global: 'CommandOrControl+Alt+]', inApp: '' },
  { action: 'toggle-desktop-lyrics', global: 'CommandOrControl+Alt+D', inApp: '' },
  { action: 'toggle-desktop-lyrics-lock', global: 'CommandOrControl+Alt+L', inApp: '' },
  { action: 'show-main', global: 'CommandOrControl+Alt+Shift+Q', inApp: '' },
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
  // 旧版默认 , / . 在 Windows 上常注册失败 → 迁到 [ ]
  const seekBack = map.get('seek-back')!
  if (/^CommandOrControl\+Alt\+,$/i.test(seekBack.global.trim())) {
    seekBack.global = 'CommandOrControl+Alt+['
  }
  const seekFwd = map.get('seek-fwd')!
  if (/^CommandOrControl\+Alt\+\.$/i.test(seekFwd.global.trim())) {
    seekFwd.global = 'CommandOrControl+Alt+]'
  }
  // 数字键类不自动改写用户录入，仅由 UI 标「存疑」
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

const TOKEN_LABELS: Record<string, string> = {
  commandorcontrol: 'Ctrl',
  cmdorctrl: 'Ctrl',
  command: 'Cmd',
  control: 'Ctrl',
  ctrl: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Win',
  super: 'Win',
  space: 'Space',
  return: 'Enter',
  enter: 'Enter',
  escape: 'Esc',
  esc: 'Esc',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Del',
  del: 'Del',
  insert: 'Ins',
  home: 'Home',
  end: 'End',
  pageup: 'PgUp',
  pagedown: 'PgDn',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  plus: '+',
  minus: '−',
}

/** 拆成按键块文案，如 Ctrl / Alt / Space */
export function accelToKeycaps(accel: string): string[] {
  const raw = accel.trim()
  if (!raw) return []
  return raw.split('+').map((part) => {
    const t = part.trim()
    if (!t) return ''
    const mapped = TOKEN_LABELS[t.toLowerCase()]
    if (mapped) return mapped
    if (t.length === 1) return t.toUpperCase()
    if (/^f\d{1,2}$/i.test(t)) return t.toUpperCase()
    return t
  }).filter(Boolean)
}

export function formatAccelShort(accel: string): string {
  return accelToKeycaps(accel).join(' + ')
}

/**
 * 中文输入法常用 Ctrl+0–9 选词；部分环境对「带 Ctrl/Alt 的数字键」仍不稳定。
 * Electron register 仍可能返回成功 —— 仅作「存疑」提示，不改写用户录入。
 */
export function isImeHostileAccel(accel: string): boolean {
  return classifyDigitAccelRisk(accel) === 'bare-ctrl-digit'
}

/** 任意「修饰键 + 主键是数字」：启发式存疑（不禁止、不改键） */
export function isDigitAccelRisk(accel: string): boolean {
  return classifyDigitAccelRisk(accel) !== null
}

function classifyDigitAccelRisk(accel: string): 'bare-ctrl-digit' | 'digit-combo' | null {
  const parts = accel
    .trim()
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  if (parts.length < 2) return null
  const key = parts[parts.length - 1]
  if (!/^[0-9]$/.test(key)) return null
  const mods = parts.slice(0, -1)
  const known = new Set([
    'commandorcontrol',
    'cmdorctrl',
    'control',
    'ctrl',
    'alt',
    'shift',
    'meta',
    'cmd',
    'command',
    'super',
  ])
  if (!mods.every((m) => known.has(m))) return null
  const hasCtrl = mods.some(
    (m) =>
      m === 'commandorcontrol' ||
      m === 'cmdorctrl' ||
      m === 'control' ||
      m === 'ctrl' ||
      m === 'meta' ||
      m === 'cmd' ||
      m === 'command',
  )
  if (!hasCtrl) return null
  if (mods.length === 1) return 'bare-ctrl-digit'
  return 'digit-combo'
}

/** @deprecated 不再改写录入；保留导出以免旧调用报错 */
export function upgradeImeHostileAccel(accel: string): string {
  return accel.trim()
}

export function listImeHostileBindings(bindings: HotkeyBinding[]): HotkeyBinding[] {
  return bindings.filter((b) => isDigitAccelRisk(b.global))
}

export type HotkeyUsabilityKind =
  | 'ok'
  | 'empty'
  | 'conflict'
  | 'register-failed'
  | 'digit-doubt'

export type HotkeyUsability = {
  action: HotkeyAction
  accel: string
  kind: HotkeyUsabilityKind
  /** 给 UI / 日志 */
  label: string
  /** 硬失败（冲突 / 注册失败 / 未绑定）为 false */
  usable: boolean
  /** 数字键等启发式存疑：UI 显示 ?，不改键 */
  doubtful: boolean
}

const DIGIT_DOUBT_LABEL = '按键存疑：数字键在中文输入法下，应用外可能无效'

/**
 * 可用性判定（静态启发式 + 注册失败列表）。
 * 数字键：doubtful=true，usable 仍可为 true（不拦截、不改写）。
 */
export function evaluateHotkeyUsability(
  bindings: HotkeyBinding[],
  failedGlobals: string[] = [],
): HotkeyUsability[] {
  const conflicts = findHotkeyConflicts(bindings)
  const failed = new Set(failedGlobals.map((x) => x.trim().toLowerCase()).filter(Boolean))
  return bindings.map((b) => {
    const accel = b.global?.trim() || ''
    if (!accel) {
      return {
        action: b.action,
        accel,
        kind: 'empty',
        label: '未绑定',
        usable: false,
        doubtful: false,
      }
    }
    const conflict = conflicts.find((c) => c.scope === 'global' && c.actions.includes(b.action))
    if (conflict) {
      return {
        action: b.action,
        accel,
        kind: 'conflict',
        label: '不可使用（快捷键冲突）',
        usable: false,
        doubtful: false,
      }
    }
    if (failed.has(accel.toLowerCase())) {
      return {
        action: b.action,
        accel,
        kind: 'register-failed',
        label: '不可使用（注册失败）',
        usable: false,
        doubtful: false,
      }
    }
    if (isDigitAccelRisk(accel)) {
      return {
        action: b.action,
        accel,
        kind: 'digit-doubt',
        label: DIGIT_DOUBT_LABEL,
        usable: true,
        doubtful: true,
      }
    }
    return {
      action: b.action,
      accel,
      kind: 'ok',
      label: '可用',
      usable: true,
      doubtful: false,
    }
  })
}

/** 从键盘事件生成简易 inApp 描述 */
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

/** 窗内事件是否匹配 Electron accelerator（全局键在焦点时的兜底） */
export function matchGlobalAccelInApp(e: KeyboardEvent, accel: string): boolean {
  if (!accel.trim()) return false
  const want = accelToKeycaps(accel).map((x) => x.toLowerCase())
  const keyToken = (() => {
    if (e.key === ' ') return 'Space'
    if (e.key.startsWith('Arrow')) return e.key.replace('Arrow', '')
    if (e.key.length === 1) return e.key.toUpperCase()
    if (e.code?.startsWith('Digit')) return e.code.slice(5)
    if (e.code?.startsWith('Numpad') && /\d/.test(e.code)) return e.code.replace('Numpad', '')
    if (/^Key[A-Z]$/i.test(e.code || '')) return e.code!.slice(3).toUpperCase()
    return e.key
  })()
  const got = accelToKeycaps(
    [
      e.ctrlKey || e.metaKey ? 'Ctrl' : '',
      e.altKey ? 'Alt' : '',
      e.shiftKey ? 'Shift' : '',
      keyToken,
    ]
      .filter(Boolean)
      .join('+'),
  ).map((x) => x.toLowerCase())
  if (want.length !== got.length) return false
  return want.every((w, i) => w === got[i])
}

/** 动作防抖：焦点时 globalShortcut 与窗内 keydown 常各触发一次，切换类会被抵消 */
export function shouldAcceptHotkeyFire(
  action: string,
  nowMs: number,
  lastByAction: Map<string, number>,
  windowMs = 200,
): boolean {
  const prev = lastByAction.get(action) || 0
  if (nowMs - prev < windowMs) return false
  lastByAction.set(action, nowMs)
  return true
}
