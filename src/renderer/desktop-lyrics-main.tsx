import { createRoot } from 'react-dom/client'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { findLyricIndex, type LyricLine } from '../core/lyrics'
import {
  DEFAULT_DESKTOP_LYRICS,
  karaokeLineProgress,
  lyricScrollOffset,
  mergeDesktopLyrics,
  resolveLyricFont,
  type DesktopLyricsSettings,
  type LineSlot,
} from '../core/desktop-lyrics'

/** 边缘留给系统缩放，中间区域用主进程 JS 拖窗（无边框透明窗 setMovable 在 Windows 上常无效） */
const RESIZE_EDGE = 8

type Payload = {
  settings: DesktopLyricsSettings
  lines: LyricLine[]
  currentTime: number
  duration?: number
  title?: string
  artist?: string
  playing?: boolean
}

const empty: Payload = {
  settings: { ...DEFAULT_DESKTOP_LYRICS },
  lines: [],
  currentTime: 0,
  duration: 0,
  playing: false,
}

function slotBoxStyle(slot: LineSlot, vertical: boolean): CSSProperties {
  const ax = slot.alignX === 'start' ? '0%' : slot.alignX === 'end' ? '100%' : '50%'
  const ay = slot.alignY === 'start' ? '0%' : slot.alignY === 'end' ? '100%' : '50%'
  const tx = slot.alignX === 'start' ? '0%' : slot.alignX === 'end' ? '-100%' : '-50%'
  const ty = slot.alignY === 'start' ? '0%' : slot.alignY === 'end' ? '-100%' : '-50%'
  return {
    position: 'absolute',
    left: `calc(${ax} + ${slot.offsetX}%)`,
    top: `calc(${ay} + ${slot.offsetY}%)`,
    transform: `translate(${tx}, ${ty})`,
    width: vertical ? '90%' : '92%',
    maxWidth: vertical ? '90%' : '92%',
    writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
    textOrientation: vertical ? 'mixed' : undefined,
    overflow: 'hidden',
    pointerEvents: 'none',
  }
}

function textPaintStyle(
  settings: DesktopLyricsSettings,
  on: boolean,
  progress: number | null,
): CSSProperties {
  const size = settings.fontSize
  const weight = 500
  const shadow = settings.shadow ? '0 2px 10px rgba(0,0,0,0.65)' : 'none'
  const stroke =
    settings.stroke && settings.strokeWidth > 0
      ? {
          WebkitTextStroke: `${settings.strokeWidth}px ${settings.strokeColor}`,
          paintOrder: 'stroke fill' as const,
        }
      : {}

  // 当前行 / 待播行共用同一套排版与「clip 填色」路径，避免实心色 vs 透明渐变两套渲染观感不一致
  const base: CSSProperties = {
    fontSize: size,
    fontWeight: weight,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    display: 'inline-block',
    textShadow: shadow,
    ...stroke,
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
  }

  if (on && settings.karaoke && progress != null) {
    const pct = Math.min(1, Math.max(0, progress)) * 100
    return {
      ...base,
      backgroundImage: `linear-gradient(90deg, ${settings.sungColor} ${pct}%, ${settings.unsungColor} ${pct}%)`,
    }
  }

  if (settings.fillMode === 'gradient' && on) {
    return {
      ...base,
      backgroundImage: `linear-gradient(90deg, ${settings.gradientFrom}, ${settings.gradientTo})`,
    }
  }

  const fill = on ? settings.activeColor : settings.color
  return {
    ...base,
    backgroundImage: `linear-gradient(90deg, ${fill} 0%, ${fill} 100%)`,
  }
}

/** 视口内长句：进度点居中，整句右→左平移，尾部露全后停移 */
function LyricScrollLine({
  text,
  settings,
  on,
  progress,
  vertical,
  slot,
}: {
  text: string
  settings: DesktopLyricsSettings
  on: boolean
  progress: number | null
  vertical: boolean
  slot: LineSlot
}) {
  const viewRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [scroll, setScroll] = useState(0)

  const scrollProgress = on ? (progress == null ? 0.5 : progress) : 0

  useLayoutEffect(() => {
    const view = viewRef.current
    const tip = textRef.current
    if (!view || !tip) return

    const measure = () => {
      const viewW = vertical ? view.clientHeight : view.clientWidth
      const textW = vertical ? tip.scrollHeight : tip.scrollWidth
      setScroll(lyricScrollOffset(textW, viewW, scrollProgress))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(view)
    ro.observe(tip)
    return () => ro.disconnect()
  }, [
    text,
    on,
    scrollProgress,
    vertical,
    settings.fontSize,
    settings.fontFamily,
    settings.fonts,
    settings.karaoke,
  ])

  const axis = vertical ? 'translateY' : 'translateX'

  return (
    <div ref={viewRef} style={slotBoxStyle(slot, vertical)}>
      <span
        ref={textRef}
        style={{
          ...textPaintStyle(settings, on, on ? progress : null),
          fontFamily: resolveLyricFont(settings, text),
          transform: `${axis}(${-scroll}px)`,
          willChange: 'transform',
        }}
      >
        {text}
      </span>
    </div>
  )
}

function App() {
  const [payload, setPayload] = useState<Payload>(empty)
  const { settings, lines, duration, playing } = payload
  const dragging = useRef(false)
  const clockRef = useRef(payload.currentTime)
  const [clock, setClock] = useState(payload.currentTime)

  useEffect(() => {
    const off = window.qmusic?.onDesktopLyricsPayload?.((p) => {
      const next = {
        settings: mergeDesktopLyrics(p.settings),
        lines: p.lines || [],
        currentTime: p.currentTime || 0,
        duration: p.duration || 0,
        title: p.title,
        artist: p.artist,
        playing: Boolean(p.playing),
      }
      clockRef.current = next.currentTime
      setClock(next.currentTime)
      setPayload(next)
    })
    return () => off?.()
  }, [])

  useEffect(() => {
    if (!playing) return
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
  }, [playing, payload.currentTime])

  useEffect(() => {
    const end = () => {
      if (!dragging.current) return
      dragging.current = false
      window.qmusic?.windowDragEnd?.()
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
      end()
    }
  }, [])

  const active = useMemo(() => findLyricIndex(lines, clock), [lines, clock])
  const progress = useMemo(
    () => karaokeLineProgress(lines, active, clock, duration),
    [lines, active, clock, duration],
  )

  const rows = useMemo(() => {
    // 有歌词数据时：前奏 / 末句之后都不显示「暂无歌词」，末句后仍钉在最后一句
    if (!lines.length) return [] as Array<{ text: string; on: boolean; slot: 'primary' | 'secondary' }>
    const idx = active >= 0 ? active : 0
    const on = active >= 0
    if (settings.lineCount === 1) {
      const t = lines[idx]?.text || ''
      return [{ text: t || '…', on, slot: 'primary' as const }]
    }
    const cur = lines[idx]?.text || ''
    const next = lines[idx + 1]?.text
    const out: Array<{ text: string; on: boolean; slot: 'primary' | 'secondary' }> = []
    out.push({ text: cur || '…', on, slot: 'primary' })
    if (next) out.push({ text: next, on: false, slot: 'secondary' })
    return out
  }, [lines, active, settings.lineCount])

  const vertical = settings.orientation === 'vertical'
  const unlocked = settings.locked === false

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!unlocked || e.button !== 0 || !window.qmusic?.windowDragStart) return
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    if (x < RESIZE_EDGE || y < RESIZE_EDGE || x > r.width - RESIZE_EDGE || y > r.height - RESIZE_EDGE) {
      return
    }
    dragging.current = true
    window.qmusic.windowDragStart()
  }

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        boxSizing: 'border-box',
        opacity: settings.opacity,
        fontFamily: settings.fonts?.zh || settings.fontFamily,
        border: unlocked ? '1px dashed rgba(255,255,255,0.45)' : 'none',
        background: unlocked ? 'rgba(0,0,0,0.18)' : 'transparent',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: unlocked ? 'move' : 'default',
      }}
    >
      {unlocked && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 8,
            zIndex: 2,
            fontSize: 11,
            color: 'rgba(255,255,255,0.75)',
            pointerEvents: 'none',
          }}
        >
          拖动中间 · 边缘缩放 · 再点「词」可锁定
        </div>
      )}
      {rows.length === 0 ? (
        <div
          style={{
            ...slotBoxStyle(settings.lineLayouts.primary, vertical),
            ...textPaintStyle(settings, true, null),
            color: settings.activeColor,
            WebkitTextFillColor: settings.activeColor,
            backgroundImage: 'none',
            overflow: 'visible',
          }}
        >
          {payload.title || '桌面歌词'}
          <span style={{ opacity: 0.65, marginLeft: 8, fontSize: '0.75em' }}>
            （暂无歌词）
          </span>
        </div>
      ) : (
        rows.map((row) => (
          <LyricScrollLine
            key={`${row.slot}-${row.text}`}
            text={row.text}
            settings={settings}
            on={row.on}
            progress={row.on ? progress : null}
            vertical={vertical}
            slot={
              row.slot === 'primary' ? settings.lineLayouts.primary : settings.lineLayouts.secondary
            }
          />
        ))
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
