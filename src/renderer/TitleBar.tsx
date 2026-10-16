import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  menuOpen: boolean
  onToggleMenu: () => void
  menu: ReactNode
  brandName?: string
}

function IconMinimize() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
      <path d="M2 6.25h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconMaximize() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
      <rect
        x="1.75"
        y="1.75"
        width="8.5"
        height="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        rx="0.4"
      />
    </svg>
  )
}

function IconRestore() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
      <path
        d="M3.5 4.25h5.5v5.5H3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M4.75 4.25V2.75h5.5V8.25H8.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
      <path
        d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * 标题栏拖拽用系统 `-webkit-app-region: drag`（含最大化拖拽还原）。
 * 切走再回来偶发失效时，仅在「失焦后再聚焦」时重挂载；勿在 maximize/unmaximize
 * 时重挂载，否则会打断正在进行的原生拖拽，窗口易甩出屏外且之后拖不动。
 */
export default function TitleBar({ menuOpen, onToggleMenu, menu, brandName = 'Q-Music' }: Props) {
  const [maximized, setMaximized] = useState(false)
  const [dragEpoch, setDragEpoch] = useState(0)
  const wasBlurred = useRef(false)
  const api = window.qmusic

  useEffect(() => {
    if (!api) return
    void api.windowIsMaximized().then(setMaximized).catch(() => undefined)
  }, [api])

  useEffect(() => {
    if (!api?.onChromeRefresh) return
    return api.onChromeRefresh(() => {
      void api.windowIsMaximized().then(setMaximized).catch(() => undefined)
    })
  }, [api])

  useEffect(() => {
    const onBlur = () => {
      wasBlurred.current = true
    }
    const onFocus = () => {
      if (!wasBlurred.current) return
      wasBlurred.current = false
      // 等焦点稳定后再挂载，避免拖拽过程中拆掉 drag 区
      window.setTimeout(() => setDragEpoch((n) => n + 1), 80)
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return (
    <div className="titlebar">
      <div key={dragEpoch} className="titlebar-drag">
        <span className="titlebar-brand">{brandName}</span>
      </div>
      <div className="titlebar-actions">
        <div className="menu-wrap">
          <button
            type="button"
            className={`win-btn menu-btn ${menuOpen ? 'open' : ''}`}
            title="菜单"
            aria-label="菜单"
            onClick={onToggleMenu}
          >
            <span className="burger" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={onToggleMenu} />
              <div className="app-menu" onClick={(e) => e.stopPropagation()}>
                {menu}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          className="win-btn"
          title="最小化"
          onClick={() => void api?.windowMinimize()}
        >
          <IconMinimize />
        </button>
        <button
          type="button"
          className="win-btn"
          title={maximized ? '还原' : '最大化'}
          onClick={async () => {
            if (!api) return
            const next = await api.windowToggleMaximize()
            setMaximized(next)
          }}
        >
          {maximized ? <IconRestore /> : <IconMaximize />}
        </button>
        <button
          type="button"
          className="win-btn win-close"
          title="关闭"
          onClick={() => void api?.windowClose()}
        >
          <IconClose />
        </button>
      </div>
    </div>
  )
}
