/** 时间格式化（秒 → m:ss） */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** mm:ss 或 m:ss.xxx / 纯秒 → 秒 */
export function parseTimeInput(input: string): number | null {
  const t = input.trim()
  if (!t) return null
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  const m = t.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/)
  if (!m) return null
  const minutes = Number(m[1])
  const seconds = Number(m[2])
  const frac = m[3] ? Number(`0.${m[3]}`) : 0
  if (seconds >= 60) return null
  return minutes * 60 + seconds + frac
}
