/**
 * 全局快捷键注册策略（纯逻辑，便于单测）
 * - 失焦时不要 unregisterAll（Windows 上重注极易失败）
 * - 仅当预期加速键全部未注册时才全量重注
 */

export function shouldRefreshGlobalHotkeys(opts: {
  hasHandler: boolean
  expectedAccels: string[]
  registeredAccels: string[]
}): boolean {
  if (!opts.hasHandler) return false
  const expected = opts.expectedAccels.map((a) => a.trim().toLowerCase()).filter(Boolean)
  if (!expected.length) return false
  const have = new Set(opts.registeredAccels.map((a) => a.trim().toLowerCase()).filter(Boolean))
  return expected.some((a) => !have.has(a))
}

/** Electron 加速键变体（Windows 上 CommandOrControl 偶发失败；数字兼注册小键盘 numN） */
export function accelVariants(accel: string): string[] {
  const a = accel.trim()
  if (!a) return []
  const out = [a]
  if (/CommandOrControl/i.test(a)) {
    out.push(a.replace(/CommandOrControl/gi, 'Control'))
    out.push(a.replace(/CommandOrControl/gi, 'Ctrl'))
  }
  // 顶行数字 ↔ 小键盘：Electron 小键盘键名为 num0–num9（QQ 等原生 RegisterHotKey 用 VK_NUMPAD*）
  const expanded: string[] = []
  for (const item of out) {
    expanded.push(item)
    const m = item.match(/^(.*\+)(\d)$/i)
    if (m) {
      expanded.push(`${m[1]}num${m[2]}`)
      continue
    }
    const n = item.match(/^(.*\+)num(\d)$/i)
    if (n) expanded.push(`${n[1]}${n[2]}`)
  }
  return [...new Set(expanded)]
}
