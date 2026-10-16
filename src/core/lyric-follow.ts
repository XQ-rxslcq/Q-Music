/** 详情页歌词跟随：居中滚动 + 用户拖动后的中心带宽判定 */

/**
 * 当前句中心是否落在视口竖直中心 ±halfBandRatio（总带宽 2*halfBandRatio）内。
 * 默认 halfBandRatio=0.2 → 上下各 20%，合计 40%。
 */
export function isLineCenterInBand(
  viewTop: number,
  viewHeight: number,
  lineTop: number,
  lineHeight: number,
  halfBandRatio = 0.2,
): boolean {
  if (viewHeight <= 0) return false
  const viewCenter = viewTop + viewHeight / 2
  const lineCenter = lineTop + lineHeight / 2
  const band = viewHeight * Math.max(0, halfBandRatio)
  return Math.abs(lineCenter - viewCenter) <= band
}

/**
 * 计算把行中心对齐到视口中心所需的 scrollTop（已夹到可滚范围）。
 * 文首/文末不够居中时自然贴边，但仍保证行在可视区内（若行高度 ≤ 视口）。
 */
export function computeCenterScrollTop(
  scrollTop: number,
  viewHeight: number,
  scrollHeight: number,
  lineOffsetTop: number,
  lineHeight: number,
): number {
  const maxScroll = Math.max(0, scrollHeight - viewHeight)
  if (viewHeight <= 0) return Math.max(0, Math.min(maxScroll, scrollTop))
  const lineCenterInContent = lineOffsetTop + lineHeight / 2
  const target = lineCenterInContent - viewHeight / 2
  return Math.max(0, Math.min(maxScroll, target))
}

/** DOM：当前行是否在中心 40% 带内 */
export function isActiveLineInCenterBand(
  container: HTMLElement,
  line: HTMLElement,
  halfBandRatio = 0.2,
): boolean {
  const c = container.getBoundingClientRect()
  const l = line.getBoundingClientRect()
  return isLineCenterInBand(c.top, c.height, l.top, l.height, halfBandRatio)
}

/** DOM：把行滚到视口竖直中心（可贴边） */
export function scrollLineToVerticalCenter(
  container: HTMLElement,
  line: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
): void {
  const next = computeCenterScrollTop(
    container.scrollTop,
    container.clientHeight,
    container.scrollHeight,
    line.offsetTop,
    line.offsetHeight,
  )
  container.scrollTo({ top: next, behavior })
}
