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

/** Electron 加速键变体（Windows 上 CommandOrControl 偶发失败） */
export function accelVariants(accel: string): string[] {
  const a = accel.trim()
  if (!a) return []
  const out = [a]
  if (/CommandOrControl/i.test(a)) {
    out.push(a.replace(/CommandOrControl/gi, 'Control'))
    out.push(a.replace(/CommandOrControl/gi, 'Ctrl'))
  }
  return [...new Set(out)]
}
