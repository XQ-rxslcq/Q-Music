/** 背景轮换：纯逻辑（间隔秒、顺序、下一张），便于单测 */

export type BgRotateSettings = {
  /** 轮换间隔（秒），默认 300，范围 5–86400 */
  intervalSec: number
  /** 上次切换时间（ms epoch）；0 表示尚未切换 */
  lastSwitchedAt: number
  /** 图片相对路径顺序；缺省则按文件名 */
  order: string[]
}

export const DEFAULT_BG_ROTATE: BgRotateSettings = {
  intervalSec: 300,
  lastSwitchedAt: 0,
  order: [],
}

export function clampBgRotateIntervalSec(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return DEFAULT_BG_ROTATE.intervalSec
  return Math.min(86400, Math.max(5, Math.round(v)))
}

/** @deprecated 兼容旧字段名 */
export function clampBgRotateIntervalMin(n: unknown): number {
  return clampBgRotateIntervalSec(n)
}

export function mergeBgRotate(partial?: Partial<BgRotateSettings> & { intervalMin?: number } | null): BgRotateSettings {
  const raw = partial || {}
  // 旧版 intervalMin（分钟）→ 秒；新字段优先
  let intervalSec = DEFAULT_BG_ROTATE.intervalSec
  if (typeof raw.intervalSec === 'number' && Number.isFinite(raw.intervalSec)) {
    intervalSec = clampBgRotateIntervalSec(raw.intervalSec)
  } else if (typeof raw.intervalMin === 'number' && Number.isFinite(raw.intervalMin)) {
    intervalSec = clampBgRotateIntervalSec(raw.intervalMin * 60)
  }
  const order = Array.isArray(raw.order)
    ? raw.order.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
    : []
  return {
    intervalSec,
    lastSwitchedAt:
      typeof raw.lastSwitchedAt === 'number' && Number.isFinite(raw.lastSwitchedAt)
        ? Math.max(0, raw.lastSwitchedAt)
        : DEFAULT_BG_ROTATE.lastSwitchedAt,
    order,
  }
}

/** 是否到达轮换时刻（intervalSec 秒） */
export function isBgRotateDue(lastSwitchedAt: number, intervalSec: number, nowMs: number): boolean {
  const interval = clampBgRotateIntervalSec(intervalSec) * 1000
  if (lastSwitchedAt <= 0) return true
  return nowMs - lastSwitchedAt >= interval
}

/** 按自定义顺序排列磁盘上的图片；order 中没有的追加在末尾 */
export function orderBgRotateRels(diskRels: string[], order: string[]): string[] {
  if (!diskRels.length) return []
  const set = new Set(diskRels)
  const out: string[] = []
  for (const r of order) {
    if (set.has(r)) {
      out.push(r)
      set.delete(r)
    }
  }
  const rest = [...set].sort((a, b) => a.localeCompare(b, 'zh'))
  return [...out, ...rest]
}

/** 移动顺序：delta = -1 上移 / +1 下移 */
export function moveBgRotateOrder(order: string[], rel: string, delta: -1 | 1): string[] {
  const list = [...order]
  const i = list.indexOf(rel)
  if (i < 0) return list
  const j = i + delta
  if (j < 0 || j >= list.length) return list
  ;[list[i], list[j]] = [list[j]!, list[i]!]
  return list
}

/** 按列表顺序取下一张；空列表返回 null */
export function nextBgRotateRel(rels: string[], currentRel: string | null): string | null {
  if (!rels.length) return null
  if (!currentRel) return rels[0] ?? null
  const i = rels.indexOf(currentRel)
  if (i < 0) return rels[0] ?? null
  return rels[(i + 1) % rels.length] ?? null
}
