/**
 * 自定义纵向滚动条：点击轨道直接跳到对应位置（原生条是「朝该方向翻一页」改不了）。
 * 用 fixed 浮层贴在可滚动元素右侧，不改动 DOM 结构以免破坏 React ref。
 */

const HOST = 'q-sb-host'
const RAIL = 'q-sb-rail'
const THUMB = 'q-sb-thumb'
const MIN_THUMB = 28
const RAIL_W = 11

type Binding = {
  el: HTMLElement
  rail: HTMLDivElement
  thumb: HTMLDivElement
  ro: ResizeObserver
  onScroll: () => void
}

const bindings = new Map<HTMLElement, Binding>()
let dragging: {
  el: HTMLElement
  thumb: HTMLDivElement
  startY: number
  startTop: number
} | null = null
let scanTimer = 0

function canScrollY(el: HTMLElement): boolean {
  const s = getComputedStyle(el)
  const oy = s.overflowY
  if (oy !== 'auto' && oy !== 'scroll' && s.overflow !== 'auto' && s.overflow !== 'scroll') {
    return false
  }
  return el.scrollHeight > el.clientHeight + 1
}

function metrics(el: HTMLElement) {
  const max = Math.max(0, el.scrollHeight - el.clientHeight)
  const track = el.clientHeight
  const thumbH = Math.max(MIN_THUMB, Math.round((el.clientHeight / el.scrollHeight) * track))
  const thumbTravel = Math.max(0, track - thumbH)
  const thumbTop = max > 0 ? (el.scrollTop / max) * thumbTravel : 0
  return { max, track, thumbH, thumbTravel, thumbTop }
}

/** 被遮罩盖住时不画滚动条，避免浮在弹窗上 */
function isEffectivelyVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  if (r.width < 8 || r.height < 8) return false
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
    return false
  }
  const x = Math.min(window.innerWidth - 2, Math.max(2, r.left + r.width * 0.5))
  const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + r.height * 0.5))
  const hit = document.elementFromPoint(x, y)
  if (!hit) return false
  if (hit === el || el.contains(hit)) return true
  if (hit.classList?.contains(RAIL) || hit.classList?.contains(THUMB)) return true
  return false
}

function placeRail(b: Binding) {
  const { el, rail, thumb } = b
  if (!el.isConnected || !canScrollY(el) || !isEffectivelyVisible(el)) {
    rail.hidden = true
    return
  }
  const rect = el.getBoundingClientRect()
  const m = metrics(el)
  rail.hidden = false
  rail.style.top = `${Math.round(rect.top)}px`
  rail.style.left = `${Math.round(rect.right - RAIL_W)}px`
  rail.style.height = `${Math.round(rect.height)}px`
  thumb.style.height = `${m.thumbH}px`
  thumb.style.transform = `translateY(${Math.round(m.thumbTop)}px)`
}

function syncAll() {
  for (const b of bindings.values()) placeRail(b)
}

function jumpToClientY(el: HTMLElement, clientY: number, thumbH: number) {
  const rect = el.getBoundingClientRect()
  const m = metrics(el)
  if (m.max <= 0) return
  const y = clientY - rect.top - thumbH / 2
  const ratio = m.thumbTravel > 0 ? Math.min(1, Math.max(0, y / m.thumbTravel)) : 0
  el.scrollTop = ratio * m.max
}

function onWinPointerMove(e: PointerEvent) {
  if (!dragging) return
  const { el } = dragging
  const m = metrics(el)
  if (m.max <= 0 || m.thumbTravel <= 0) return
  const dy = e.clientY - dragging.startY
  const nextTop = Math.min(m.thumbTravel, Math.max(0, dragging.startTop + dy))
  el.scrollTop = (nextTop / m.thumbTravel) * m.max
}

function onWinPointerUp() {
  if (!dragging) return
  dragging.thumb.classList.remove('active')
  dragging = null
}

function bind(el: HTMLElement) {
  if (bindings.has(el) || el.closest(`.${RAIL}`)) return
  if (!canScrollY(el)) return

  el.classList.add(HOST)

  const rail = document.createElement('div')
  rail.className = RAIL
  rail.setAttribute('aria-hidden', 'true')
  const thumb = document.createElement('div')
  thumb.className = THUMB
  rail.appendChild(thumb)
  document.body.appendChild(rail)

  const b: Binding = {
    el,
    rail,
    thumb,
    ro: null as unknown as ResizeObserver,
    onScroll: () => placeRail(b),
  }
  b.ro = new ResizeObserver(() => placeRail(b))
  bindings.set(el, b)

  el.addEventListener('scroll', b.onScroll, { passive: true })
  b.ro.observe(el)

  rail.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const m = metrics(el)
    const t = e.target as HTMLElement
    if (t === thumb || thumb.contains(t)) {
      dragging = { el, thumb, startY: e.clientY, startTop: m.thumbTop }
      thumb.classList.add('active')
      return
    }
    jumpToClientY(el, e.clientY, m.thumbH)
    placeRail(b)
  })

  placeRail(b)
}

function unbind(el: HTMLElement) {
  const b = bindings.get(el)
  if (!b) return
  b.el.removeEventListener('scroll', b.onScroll)
  b.ro.disconnect()
  b.rail.remove()
  b.el.classList.remove(HOST)
  bindings.delete(el)
}

function scan() {
  const nodes = document.querySelectorAll<HTMLElement>('body *')
  const live = new Set<HTMLElement>()
  for (const el of nodes) {
    if (el.classList.contains(RAIL) || el.classList.contains(THUMB)) continue
    if (canScrollY(el)) {
      live.add(el)
      bind(el)
    }
  }
  for (const el of [...bindings.keys()]) {
    if (!live.has(el) || !el.isConnected || !canScrollY(el)) unbind(el)
  }
  syncAll()
}

function scheduleScan() {
  window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(scan, 80)
}

/** 在主界面挂载后调用一次即可 */
export function installJumpScrollbars() {
  if (typeof window === 'undefined' || (window as unknown as { __qSb?: boolean }).__qSb) return
  ;(window as unknown as { __qSb?: boolean }).__qSb = true

  scan()
  const mo = new MutationObserver(() => scheduleScan())
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  })

  window.addEventListener('resize', syncAll, { passive: true })
  window.addEventListener('scroll', () => syncAll(), { passive: true, capture: true })
  window.addEventListener('pointermove', onWinPointerMove, { passive: true })
  window.addEventListener('pointerup', onWinPointerUp)
  window.addEventListener('pointercancel', onWinPointerUp)
}
