import { useEffect, useRef, useState } from 'react'

export type ClickHudState = {
  id: number
  x: number
  y: number
  text: string
  /** 对应点击控件：鼠标移开即关闭 */
  anchor?: HTMLElement | null
}

type Props = {
  hud: ClickHudState | null
  /** 相对点击点：右上方偏移 */
  offsetX?: number
  offsetY?: number
  /** 未移开时的最长停留（兜底） */
  durationMs?: number
  onDone?: () => void
}

/**
 * 点击处右上角短时浮窗（音量/模式/桌面歌词等）。
 * 鼠标离开锚点控件即消失；否则在 durationMs 后自动关。
 */
export default function ClickHud({
  hud,
  offsetX = 10,
  offsetY = -36,
  durationMs = 1600,
  onDone,
}: Props) {
  const [visible, setVisible] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!hud) {
      setVisible(false)
      return
    }
    setVisible(true)

    const dismiss = () => {
      setVisible(false)
      onDoneRef.current?.()
    }

    const t = window.setTimeout(dismiss, durationMs)
    const anchor = hud.anchor
    if (anchor) {
      anchor.addEventListener('pointerleave', dismiss)
      anchor.addEventListener('pointercancel', dismiss)
    }

    return () => {
      window.clearTimeout(t)
      if (anchor) {
        anchor.removeEventListener('pointerleave', dismiss)
        anchor.removeEventListener('pointercancel', dismiss)
      }
    }
    // 故意不依赖 onDone，避免父组件重渲重置计时导致永不消失
  }, [hud?.id, durationMs])

  if (!hud || !visible) return null

  const left = Math.min(window.innerWidth - 12, Math.max(12, hud.x + offsetX))
  const top = Math.min(window.innerHeight - 12, Math.max(12, hud.y + offsetY))

  return (
    <div className="click-hud" style={{ left, top }} role="status" aria-live="polite">
      {hud.text}
    </div>
  )
}
