import { useLayoutEffect, useRef, useState } from 'react'
import type { Track } from './vite-env'

export type CtxAction =
  | 'edit'
  | 'rename'
  | 'lyrics'
  | 'matchLyrics'
  | 'addQueue'
  | 'play'
  | 'queueRemove'
  | 'queuePlayNext'

type Props = {
  x: number
  y: number
  track: Track
  source?: 'library' | 'queue'
  onAction: (action: CtxAction, track: Track) => void
  onClose: () => void
}

const VIEW_MARGIN = 12

export default function LibraryContextMenu({
  x,
  y,
  track,
  source = 'library',
  onAction,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const maxHeight = Math.max(120, window.innerHeight - VIEW_MARGIN * 2)
    el.style.maxHeight = `${maxHeight}px`

    const rect = el.getBoundingClientRect()
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth - VIEW_MARGIN) {
      left = Math.max(VIEW_MARGIN, window.innerWidth - rect.width - VIEW_MARGIN)
    }
    if (top + rect.height > window.innerHeight - VIEW_MARGIN) {
      top = Math.max(VIEW_MARGIN, window.innerHeight - rect.height - VIEW_MARGIN)
    }
    setPos({ left, top })
  }, [x, y, source])

  return (
    <div className="ctx-mask" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <ul
        ref={menuRef}
        className="ctx-menu scroll-menu"
        style={{ left: pos.left, top: pos.top }}
        onClick={(e) => e.stopPropagation()}
      >
        {source === 'queue' ? (
          <>
            <li className="ctx-group" aria-hidden>
              队列
            </li>
            <li>
              <button type="button" onClick={() => onAction('queuePlayNext', track)}>
                下一曲播放
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onAction('queueRemove', track)}>
                从队列中删除
              </button>
            </li>
          </>
        ) : (
          <>
            <li className="ctx-group" aria-hidden>
              播放
            </li>
            <li>
              <button type="button" onClick={() => onAction('play', track)}>
                播放 / 加入队列
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onAction('addQueue', track)}>
                仅加入队列
              </button>
            </li>
            <li className="ctx-sep" aria-hidden />
            <li className="ctx-group" aria-hidden>
              配置
            </li>
            <li>
              <button type="button" onClick={() => onAction('edit', track)}>
                编辑曲目信息
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onAction('rename', track)}>
                选词重命名文件
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onAction('lyrics', track)}>
                配置歌词文件
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onAction('matchLyrics', track)}>
                在线匹配歌词
              </button>
            </li>
          </>
        )}
      </ul>
    </div>
  )
}
