import { useLayoutEffect, useRef, useState } from 'react'

export type LyricsCtxAction =
  | 'toggleDesktopVisible'
  | 'toggleDesktopLock'
  | 'pickLyricsFile'
  | 'lyricsStyle'
  | 'editExistingLyrics'
  | 'matchLyrics'

type Props = {
  x: number
  y: number
  hasExistingLyrics?: boolean
  desktopVisible?: boolean
  desktopLocked?: boolean
  onAction: (action: LyricsCtxAction) => void
  onClose: () => void
}

const VIEW_MARGIN = 12

function switchLabel(on: boolean) {
  return on ? '开 → 关' : '关 → 开'
}

export default function LyricsContextMenu({
  x,
  y,
  hasExistingLyrics = false,
  desktopVisible = false,
  desktopLocked = true,
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
  }, [x, y])

  return (
    <div className="ctx-mask" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <ul
        ref={menuRef}
        className="ctx-menu scroll-menu"
        style={{ left: pos.left, top: pos.top }}
        onClick={(e) => e.stopPropagation()}
      >
        <li className="ctx-group" aria-hidden>
          桌面歌词
        </li>
        <li>
          <button type="button" onClick={() => onAction('toggleDesktopVisible')}>
            歌词显示：{switchLabel(desktopVisible)}
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onAction('toggleDesktopLock')}>
            歌词锁定：{switchLabel(desktopLocked)}
          </button>
        </li>
        <li className="ctx-sep" aria-hidden />
        <li className="ctx-group" aria-hidden>
          配置
        </li>
        <li>
          <button type="button" onClick={() => onAction('pickLyricsFile')}>
            选择歌词文件
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onAction('lyricsStyle')}>
            歌词样式
          </button>
        </li>
        <li className="ctx-sep" aria-hidden />
        {hasExistingLyrics && (
          <li>
            <button type="button" onClick={() => onAction('editExistingLyrics')}>
              编辑已有歌词
            </button>
          </li>
        )}
        <li>
          <button type="button" onClick={() => onAction('matchLyrics')}>
            打开歌词匹配工作台
          </button>
        </li>
      </ul>
    </div>
  )
}
