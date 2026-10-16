import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { findLyricIndex, type LyricLine } from '../core/lyrics'
import {
  isActiveLineInCenterBand,
  scrollLineToVerticalCenter,
} from '../core/lyric-follow'
import {
  karaokeLineProgress,
  lyricScrollOffset,
  mergePageLyrics,
  type PageLyricsSettings,
} from '../core/desktop-lyrics'

type Props = {
  lines: LyricLine[]
  currentTime: number
  duration?: number
  /** 播放中时用 rAF 平滑跟唱进度 */
  playing?: boolean
  emptyText?: string
  clickable?: boolean
  markedIndices?: number[]
  focusIndex?: number | null
  onLineClick?: (index: number, line: LyricLine) => void
  /** 右键：撤销单行定位 / 采点 */
  onLineContextMenu?: (index: number, line: LyricLine) => void
  clickTitle?: string
  contextTitle?: string
  /**
   * 父组件在「点击/拖动播放进度条」时递增，恢复默认跟随。
   * 用户拖动后：仅当当前句仍在视口中心 ±20%（合计 40%）带内时，换句再居中对齐。
   */
  resumeFollowKey?: number
  /** 按行文本解析字体（详情页按语种） */
  resolveFont?: (text: string) => string
  /** 详情页：长句滚动 / 跟唱等 */
  pageLyrics?: PageLyricsSettings
}

/**
 * 双层裁剪跟唱：底层未唱色 + 上层已唱色按宽度裁剪。
 * 不用 background-clip:text（父级 opacity 下会整行失效，看起来像瞬间变色）。
 */
function LyricLineText({
  text,
  active,
  progress,
  pageLyrics,
}: {
  text: string
  active: boolean
  progress: number
  pageLyrics?: PageLyricsSettings
}) {
  const pl = pageLyrics ? mergePageLyrics(pageLyrics) : null
  const viewRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [scroll, setScroll] = useState(0)

  const scrollOn = Boolean(pl?.scrollLongLines && active)
  const karaokeOn = Boolean(pl?.karaoke && active)
  const pct = Math.min(100, Math.max(0, progress * 100))
  const display = text || '♪'

  useLayoutEffect(() => {
    if (!scrollOn) {
      setScroll(0)
      return
    }
    const view = viewRef.current
    const tip = tipRef.current
    if (!view || !tip) return
    const measure = () => {
      setScroll(lyricScrollOffset(tip.scrollWidth, view.clientWidth, progress))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(view)
    ro.observe(tip)
    return () => ro.disconnect()
  }, [text, scrollOn, progress, pl?.fontSize, pl?.fonts, pl?.fontFamily])

  const move = scroll ? (`translateX(${-scroll}px)` as const) : undefined

  if (karaokeOn && pl) {
    return (
      <span className="lyric-text lyric-karaoke" ref={viewRef}>
        <span className="lyric-karaoke-track" style={{ transform: move }} ref={tipRef}>
          <span className="lyric-karaoke-base" style={{ color: pl.unsungColor }}>
            {display}
          </span>
          <span className="lyric-karaoke-fill" style={{ width: `${pct}%` }}>
            <span className="lyric-karaoke-fill-text" style={{ color: pl.sungColor }}>
              {display}
            </span>
          </span>
        </span>
      </span>
    )
  }

  return (
    <span className="lyric-text" ref={viewRef}>
      <span
        ref={tipRef}
        className="lyric-text-inner"
        style={{
          transform: move,
          willChange: scrollOn ? 'transform' : undefined,
        }}
      >
        {display}
      </span>
    </span>
  )
}

export default function LyricsPanel({
  lines,
  currentTime,
  duration,
  playing = false,
  emptyText,
  clickable,
  markedIndices,
  focusIndex,
  onLineClick,
  onLineContextMenu,
  clickTitle,
  contextTitle,
  resumeFollowKey = 0,
  resolveFont,
  pageLyrics,
}: Props) {
  const clockRef = useRef(currentTime)
  const [clock, setClock] = useState(currentTime)
  const needSmooth = Boolean(pageLyrics?.karaoke)

  useEffect(() => {
    clockRef.current = currentTime
    setClock(currentTime)
  }, [currentTime])

  useEffect(() => {
    if (!needSmooth || !playing) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      clockRef.current += dt
      setClock(clockRef.current)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [needSmooth, playing, currentTime])

  const active = useMemo(() => findLyricIndex(lines, clock), [lines, clock])
  const progress = useMemo(
    () => karaokeLineProgress(lines, active, clock, duration),
    [lines, active, clock, duration],
  )
  const listRef = useRef<HTMLUListElement | null>(null)
  const marked = useMemo(() => new Set(markedIndices || []), [markedIndices])
  /** 用户是否拖动过列表；未拖动时始终居中跟随 */
  const userDetachedRef = useRef(false)
  const programmaticScrollRef = useRef(false)
  const programmaticClearTimer = useRef(0)
  const [followHud, setFollowHud] = useState(true)
  const lastResumeKey = useRef(resumeFollowKey)
  const lastFollowTarget = useRef(-1)
  const usePageFx = Boolean(pageLyrics)

  useEffect(() => {
    if (resumeFollowKey !== lastResumeKey.current) {
      lastResumeKey.current = resumeFollowKey
      userDetachedRef.current = false
      setFollowHud(true)
      lastFollowTarget.current = -1
    }
  }, [resumeFollowKey])

  useEffect(() => {
    return () => {
      if (programmaticClearTimer.current) window.clearTimeout(programmaticClearTimer.current)
    }
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const target = focusIndex != null && focusIndex >= 0 ? focusIndex : active
    if (target < 0) return
    const el = list.querySelector(`[data-i="${target}"]`) as HTMLElement | null
    if (!el) return

    const shouldSync = !userDetachedRef.current || isActiveLineInCenterBand(list, el, 0.2)
    if (!shouldSync) {
      setFollowHud(false)
      return
    }
    // 同一目标且已跟随过则跳过，避免 smooth 滚动期间反复触发
    if (lastFollowTarget.current === target) return
    lastFollowTarget.current = target
    programmaticScrollRef.current = true
    if (programmaticClearTimer.current) window.clearTimeout(programmaticClearTimer.current)
    scrollLineToVerticalCenter(list, el, 'smooth')
    setFollowHud(true)
    // smooth 滚动可能超过 450ms；过早清标志会把程序滚动误判成用户拖动
    programmaticClearTimer.current = window.setTimeout(() => {
      programmaticScrollRef.current = false
      programmaticClearTimer.current = 0
    }, 700)
  }, [active, focusIndex, lines.length])

  const markUserScroll = () => {
    if (programmaticScrollRef.current) return
    userDetachedRef.current = true
    setFollowHud(false)
  }

  const interruptFollow = () => {
    userDetachedRef.current = true
    setFollowHud(false)
  }

  if (!lines.length) {
    return <div className="lyrics empty">{emptyText ?? '暂无歌词'}</div>
  }

  return (
    <ul
      className={`lyrics ${clickable ? 'clickable' : ''} ${followHud ? 'following' : 'follow-off'}${usePageFx ? ' page-fx' : ''}`}
      ref={listRef}
      onWheel={markUserScroll}
      onScroll={markUserScroll}
      onTouchMove={markUserScroll}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') markUserScroll()
      }}
    >
      {lines.map((line, i) => {
        const isOn = i === active
        const karaokeMode = usePageFx && Boolean(pageLyrics?.karaoke)
        const cls = [
          isOn ? 'on' : '',
          marked.has(i) ? 'marked' : '',
          focusIndex === i ? 'focus' : '',
          clickable ? 'can-click' : '',
          karaokeMode ? (isOn ? 'karaoke' : 'karaoke-off') : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <li
            key={`${line.timeMs}-${i}`}
            data-i={i}
            className={cls}
            style={resolveFont ? { fontFamily: resolveFont(line.text || '') } : undefined}
            onClick={
              clickable && onLineClick
                ? () => {
                    interruptFollow()
                    onLineClick(i, line)
                  }
                : undefined
            }
            onContextMenu={
              clickable && onLineContextMenu
                ? (e) => {
                    e.preventDefault()
                    interruptFollow()
                    onLineContextMenu(i, line)
                  }
                : undefined
            }
            title={
              clickable
                ? [
                    clickTitle || '听到这句时点击',
                    onLineContextMenu ? contextTitle || '右键撤销本句定位' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : undefined
            }
          >
            {clickable && <span className="lyric-time">{formatMs(line.timeMs)}</span>}
            {usePageFx ? (
              <LyricLineText
                text={line.text || ''}
                active={isOn}
                progress={isOn ? progress : 0}
                pageLyrics={pageLyrics}
              />
            ) : (
              <span className="lyric-text">{line.text || '♪'}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function formatMs(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(t / 60)
  const s = t % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
