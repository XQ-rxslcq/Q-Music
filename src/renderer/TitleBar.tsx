import { useEffect, useRef, useState } from 'react'

type Props = {
  menuOpen: boolean
  onToggleMenu: () => void
  menu: React.ReactNode
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
 * 使用主进程读光标拖窗（不用 -webkit-app-region）。
 * Windows 无边框在 Alt+Tab / 切软件后再回来时，CSS drag 经常失效；
 * JS 拖窗不受影响。
 */
export default function TitleBar({ menuOpen, onToggleMenu, menu }: Props) {
  const [maximized, setMaximized] = useState(false)
  const dragging = useRef(false)
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
    }
  }, [])

  return (
    <div className="titlebar">
      <div
        className="titlebar-drag"
        onPointerDown={(e) => {
          if (!api?.windowDragStart || e.button !== 0) return
          dragging.current = true
          setMaximized(false)
          api.windowDragStart()
        }}
        onDoubleClick={async () => {
          if (!api) return
          dragging.current = false
          api.windowDragEnd?.()
          const next = await api.windowToggleMaximize()
          setMaximized(next)
        }}
      >
        <span className="titlebar-brand">Q-Music</span>
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
