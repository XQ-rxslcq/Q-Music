/**
 * 双图层背景：新图在上层淡入，下层保持不透明直到被完全盖住。
 * （两层同时降透明度会透出深色底，加载/过渡中间会发黑。）
 */

export type BgLayerId = 'a' | 'b'

const FADE_MS = 480

let active: BgLayerId = 'a'
let currentUrl: string | null = null
let swapGen = 0
const decoded = new Set<string>()

function layerEl(id: BgLayerId): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-bg-layer="${id}"]`)
}

function inactiveId(): BgLayerId {
  return active === 'a' ? 'b' : 'a'
}

function setCssBgVar(url: string | null) {
  const root = document.documentElement
  if (url) root.style.setProperty('--bg-image', `url("${url}")`)
  else root.style.setProperty('--bg-image', 'none')
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(() => step(left - 1))
    }
    step(n)
  })
}

/** 预解码（浏览器缓存）；轮换可提前数秒调用 */
export function prefetchBgLayerImage(url: string | null | undefined): void {
  if (!url || decoded.has(url) || url === currentUrl) return
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  const mark = () => {
    decoded.add(url)
  }
  if (typeof img.decode === 'function') {
    void img.decode().then(mark).catch(mark)
  } else {
    img.onload = mark
    img.onerror = mark
  }
}

function loadDecoded(url: string): Promise<void> {
  if (decoded.has(url)) return Promise.resolve()
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  if (typeof img.decode === 'function') {
    return img
      .decode()
      .then(() => {
        decoded.add(url)
      })
      .catch(() => {
        decoded.add(url)
      })
  }
  return new Promise((resolve) => {
    img.onload = () => {
      decoded.add(url)
      resolve()
    }
    img.onerror = () => resolve()
  })
}

function resetLayer(el: HTMLElement) {
  el.classList.remove('on', 'front', 'back')
  el.style.backgroundImage = ''
  el.style.transition = ''
}

/** 清空图层（切到纯色/渐变） */
export function clearBgLayers(): void {
  swapGen += 1
  currentUrl = null
  for (const id of ['a', 'b'] as BgLayerId[]) {
    const el = layerEl(id)
    if (el) resetLayer(el)
  }
  active = 'a'
  setCssBgVar(null)
}

/**
 * 切换背景：加载期间旧图不动；就绪后新图叠在上层 0→1 淡入，旧图始终 opacity:1，
 * 淡入结束后再撤下层（全程不透底）。
 */
export function setBgLayerImage(url: string | null): void {
  if (!url) {
    clearBgLayers()
    return
  }
  if (url === currentUrl) {
    setCssBgVar(url)
    return
  }

  const a = layerEl('a')
  const b = layerEl('b')
  if (!a || !b) {
    setCssBgVar(url)
    return
  }

  const my = ++swapGen
  const nextId = currentUrl ? inactiveId() : active
  const nextEl = layerEl(nextId)!
  const prevEl = currentUrl ? layerEl(active) : null

  void (async () => {
    await loadDecoded(url)
    if (my !== swapGen) return

    // 首张：无需交叉，直接显示
    if (!prevEl) {
      nextEl.style.transition = 'none'
      nextEl.style.backgroundImage = `url("${url}")`
      nextEl.classList.add('on', 'back')
      nextEl.classList.remove('front')
      void nextEl.offsetWidth
      nextEl.style.transition = ''
      active = nextId
      currentUrl = url
      setCssBgVar(url)
      return
    }

    // 新图先铺在上层但透明，等绘出后再淡入（加载期旧图仍全不透明）
    nextEl.style.transition = 'none'
    nextEl.classList.remove('on', 'back')
    nextEl.classList.add('front')
    nextEl.style.backgroundImage = `url("${url}")`
    prevEl.classList.add('on', 'back')
    prevEl.classList.remove('front')
    void nextEl.offsetWidth
    await waitFrames(2)
    if (my !== swapGen) return

    nextEl.style.transition = ''
    void nextEl.offsetWidth
    nextEl.classList.add('on')

    let finished = false
    const finish = () => {
      if (finished || my !== swapGen) return
      finished = true
      nextEl.classList.remove('front')
      nextEl.classList.add('back')
      prevEl.classList.remove('on', 'front', 'back')
      prevEl.style.backgroundImage = ''
      active = nextId
      currentUrl = url
      setCssBgVar(url)
    }

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'opacity') return
      nextEl.removeEventListener('transitionend', onEnd)
      finish()
    }
    nextEl.addEventListener('transitionend', onEnd)
    window.setTimeout(finish, FADE_MS + 100)
  })()
}
