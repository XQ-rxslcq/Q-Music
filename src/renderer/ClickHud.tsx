import { useEffect, useState } from 'react'

export type ClickHudState = {
  id: number
  x: number
  y: number
  text: string
}

type Props = {
  hud: ClickHudState | null
  /** 相对点击点：右上方偏移 */
  offsetX?: number
  offsetY?: number
  durationMs?: number
  onDone?: () => void
}

/**
 * 点击处右上角短时浮窗（音量/模式/桌面歌词等），类似常见播放器的状态气泡。
 */
export default function ClickHud({
  hud,
  offsetX = 10,
  offsetY = -36,
  durationMs = 1200,
  onDone,
}: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!hud) {
      setVisible(false)
      return
    }
    setVisible(true)
    const t = window.setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, durationMs)
    return () => window.clearTimeout(t)
  }, [hud?.id, durationMs, onDone])

  if (!hud || !visible) return null

  const left = Math.min(
    window.innerWidth - 12,
    Math.max(12, hud.x + offsetX),
  )
  const top = Math.min(
    window.innerHeight - 12,
    Math.max(12, hud.y + offsetY),
  )

  return (
    <div className="click-hud" style={{ left, top }} role="status" aria-live="polite">
      {hud.text}
    </div>
  )
}
