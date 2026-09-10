export type PlayMode = 'sequence' | 'loop' | 'single' | 'shuffle'

export type TrackLike = { id: string }

export function mergeTracksById<T extends TrackLike>(prev: T[], incoming: T[]): T[] {
  const map = new Map(prev.map((t) => [t.id, t]))
  for (const t of incoming) map.set(t.id, t)
  return [...map.values()]
}

export function shuffleIndices(n: number, avoid?: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  if (avoid != null && arr.length > 1 && arr[0] === avoid) {
    ;[arr[0], arr[1]] = [arr[1], arr[0]]
  }
  return arr
}

export type NextIndexInput = {
  mode: PlayMode
  queueLength: number
  from: number
  direction: 1 | -1
  shuffleOrder: number[]
}

export type NextIndexResult = {
  index: number
  /** 是否应停止播放（顺序模式到末尾） */
  stop?: boolean
  /** 是否应从头重播当前曲（单曲） */
  replay?: boolean
  /** 需要替换的洗牌序 */
  shuffleOrder?: number[]
}

export function resolveNextIndex(input: NextIndexInput): NextIndexResult {
  const { mode, queueLength, from, direction } = input
  if (queueLength <= 0) return { index: from, stop: true }

  if (mode === 'single') {
    if (direction === 1) return { index: from, replay: true }
    return { index: from }
  }

  if (mode === 'shuffle') {
    let order =
      input.shuffleOrder.length === queueLength
        ? input.shuffleOrder
        : shuffleIndices(queueLength, from)
    const pos = order.indexOf(from)
    const nextPos = (pos < 0 ? 0 : pos) + direction
    if (nextPos < 0 || nextPos >= order.length) {
      order = shuffleIndices(queueLength, from)
      return { index: order[0] ?? from, shuffleOrder: order }
    }
    return {
      index: order[nextPos] ?? from,
      shuffleOrder: order !== input.shuffleOrder ? order : undefined,
    }
  }

  const n = from + direction
  if (mode === 'loop') {
    if (n < 0) return { index: queueLength - 1 }
    if (n >= queueLength) return { index: 0 }
    return { index: n }
  }

  // sequence
  if (n < 0) return { index: 0 }
  if (n >= queueLength) return { index: from, stop: true }
  return { index: n }
}

export function removeQueueIndex<T>(
  queue: T[],
  removeAt: number,
  currentIndex: number,
): { queue: T[]; index: number } {
  if (removeAt < 0 || removeAt >= queue.length) return { queue, index: currentIndex }
  const next = queue.filter((_, i) => i !== removeAt)
  let index = currentIndex
  if (next.length === 0) index = 0
  else if (removeAt < currentIndex) index = currentIndex - 1
  else if (removeAt === currentIndex) index = Math.min(currentIndex, next.length - 1)
  return { queue: next, index }
}

/** 将指定曲目移到「当前曲之后」播放 */
export function moveQueueItemToPlayNext<T>(
  queue: T[],
  itemIndex: number,
  currentIndex: number,
): { queue: T[]; index: number } {
  if (itemIndex < 0 || itemIndex >= queue.length) return { queue, index: currentIndex }
  if (itemIndex === currentIndex) return { queue, index: currentIndex }
  if (itemIndex === currentIndex + 1) return { queue, index: currentIndex }

  const item = queue[itemIndex]
  const rest = queue.filter((_, i) => i !== itemIndex)
  const playIndex = itemIndex < currentIndex ? currentIndex - 1 : currentIndex
  const insertAt = playIndex + 1
  const next = [...rest.slice(0, insertAt), item, ...rest.slice(insertAt)]
  return { queue: next, index: playIndex }
}

/** 追加入队，已存在的 id 跳过（重复只取一） */
export function appendUniquePreserveOrder<T extends TrackLike>(queue: T[], incoming: T[]): T[] {
  const seen = new Set(queue.map((t) => t.id))
  const next = [...queue]
  for (const t of incoming) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    next.push(t)
  }
  return next
}

/** 队列去重，保留第一次出现 */
export function dedupeQueuePreserveFirst<T extends TrackLike>(queue: T[]): T[] {
  const seen = new Set<string>()
  return queue.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })
}

export function excludeCategoryFromQueue<T extends { categoryIds?: string[] }>(
  queue: T[],
  categoryId: string,
): T[] {
  return queue.filter((t) => !(t.categoryIds ?? []).includes(categoryId))
}

export function pickByCategories<T extends { categoryIds?: string[] }>(
  tracks: T[],
  categoryIds: string[],
): T[] {
  if (!categoryIds.length) return []
  const set = new Set(categoryIds)
  return tracks.filter((t) => (t.categoryIds ?? []).some((id) => set.has(id)))
}
