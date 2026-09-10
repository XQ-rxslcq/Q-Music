import { useState } from 'react'
import { formatTime, parseTimeInput } from '../core/format'
import type { Track } from './vite-env'
import DrawerShell from './DrawerShell'

type Props = {
  open: boolean
  track: Track | null
  currentTime: number
  duration: number
  onClose: () => void
  onTrimmed: (track: Track) => void
}

export default function TrimDrawer({
  open,
  track,
  currentTime,
  duration,
  onClose,
  onTrimmed,
}: Props) {
  const [startText, setStartText] = useState('0')
  const [endText, setEndText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!open) return null

  const applyCurrentAsStart = () => setStartText(String(Number(currentTime.toFixed(2))))
  const applyCurrentAsEnd = () => setEndText(String(Number(currentTime.toFixed(2))))

  const run = async () => {
    if (!track || !window.qmusic) return
    const startSec = parseTimeInput(startText)
    const endSec = parseTimeInput(endText || String(duration))
    if (startSec == null || endSec == null) {
      setMsg('请输入合法时间（秒或 mm:ss）')
      return
    }
    setBusy(true)
    setMsg(null)
    const result = await window.qmusic.trimExport({
      inputPath: track.path,
      startSec,
      endSec,
    })
    setBusy(false)
    if (!result.ok) {
      setMsg(result.error)
      return
    }
    setMsg(`已保存：${result.outputPath}`)
    onTrimmed(result.track)
  }

  return (
    <DrawerShell open={open} title="音频截取" onClose={onClose} panelClassName="theme-drawer">
        <p className="theme-tip">
          当前：{track?.title ?? '未选曲'} · 长度 {formatTime(duration)}
          <br />
          默认另存为同目录 `原名.trim.mp3`，不覆盖原文件。需要本机 PATH 中有 ffmpeg。
        </p>
        <label className="theme-field">
          <span>起点（秒 / mm:ss）</span>
          <div className="row-inline">
            <input value={startText} onChange={(e) => setStartText(e.target.value)} />
            <button type="button" onClick={applyCurrentAsStart}>
              用当前位置
            </button>
          </div>
        </label>
        <label className="theme-field">
          <span>终点</span>
          <div className="row-inline">
            <input
              value={endText}
              placeholder={String(Number(duration.toFixed(2)) || '')}
              onChange={(e) => setEndText(e.target.value)}
            />
            <button type="button" onClick={applyCurrentAsEnd}>
              用当前位置
            </button>
          </div>
        </label>
        {msg && <div className="banner error">{msg}</div>}
        <button type="button" className="primary" disabled={!track || busy} onClick={() => void run()}>
          {busy ? '截取中…' : '开始截取'}
        </button>
    </DrawerShell>
  )
}
