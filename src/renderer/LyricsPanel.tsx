import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { findLyricIndex, type LyricLine } from '../core/lyrics'
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
   * 父组件在「点击/拖动播放进度条」时递增，用于重新开启跟随。
   * 用户滚动歌词列表或点歌词行后会关闭跟随，直到再次 seek。
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
  const [follow, setFollow] = useState(true)
  const lastResumeKey = useRef(resumeFollowKey)
  const usePageFx = Boolean(pageLyrics)

  useEffect(() => {
    if (resumeFollowKey !== lastResumeKey.current) {
      lastResumeKey.current = resumeFollowKey
      setFollow(true)
    }
  }, [resumeFollowKey])

  useEffect(() => {
    if (!follow || !listRef.current) return
    const target = focusIndex != null && focusIndex >= 0 ? focusIndex : active
    if (target < 0) return
    const el = listRef.current.querySelector(`[data-i="${target}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [active, focusIndex, follow])

  const interruptFollow = () => setFollow(false)

  if (!lines.length) {
    return <div className="lyrics empty">{emptyText ?? '暂无歌词'}</div>
  }

  return (
    <ul
      className={`lyrics ${clickable ? 'clickable' : ''} ${follow ? 'following' : 'follow-off'}${usePageFx ? ' page-fx' : ''}`}
      ref={listRef}
      onWheel={interruptFollow}
      onTouchMove={interruptFollow}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') interruptFollow()
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
