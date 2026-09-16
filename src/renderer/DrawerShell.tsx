import { useRef, useState, type ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  /** 有未保存修改时，关闭前弹出确认 */
  dirty?: boolean
  /** 提供则确认框显示「保存」；否则仅「放弃 / 继续编辑」 */
  onSave?: () => void | Promise<void>
  children: ReactNode
  maskClassName?: string
  panelClassName?: string
  /** 标题栏右侧额外操作 */
  headExtra?: ReactNode
}

/**
 * 侧栏 / 居中面板壳：
 * - 仅在「按下就在遮罩上」的点击才关闭（面板内按下再拖出松开不关）
 * - dirty 时先确认是否保存
 */
export default function DrawerShell({
  open,
  title,
  onClose,
  dirty = false,
  onSave,
  children,
  maskClassName = '',
  panelClassName = 'theme-drawer',
  headExtra,
}: Props) {
  const downOnMask = useRef(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const requestClose = () => {
    if (dirty) setConfirmOpen(true)
    else onClose()
  }

  const discardAndClose = () => {
    setConfirmOpen(false)
    onClose()
  }

  const saveAndClose = async () => {
    if (!onSave) {
      discardAndClose()
      return
    }
    setSaving(true)
    try {
      await onSave()
      setConfirmOpen(false)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`theme-mask ${maskClassName}`.trim()}
      onPointerDown={(e) => {
        downOnMask.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        if (!downOnMask.current) return
        requestClose()
      }}
    >
      <aside
        className={panelClassName}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="theme-head">
          <h2>{title}</h2>
          <div className="theme-head-actions">
            {headExtra}
            <button
              type="button"
              className="icon theme-win-btn"
              title="最小化"
              aria-label="最小化"
              onClick={() => void window.qmusic?.windowMinimize?.()}
            >
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                <path d="M2 6.25h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              className="icon theme-win-btn"
              title="最大化 / 还原"
              aria-label="最大化"
              onClick={() => void window.qmusic?.windowToggleMaximize?.()}
            >
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
            </button>
            <button
              type="button"
              className="icon theme-win-btn"
              onClick={requestClose}
              aria-label="关闭"
              title="关闭"
            >
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                <path
                  d="M3 3l6 6M9 3L3 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
        {children}
      </aside>

      {confirmOpen && (
        <div
          className="drawer-confirm-mask"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="drawer-confirm" role="dialog" aria-modal="true" aria-labelledby="drawer-confirm-title">
            <h3 id="drawer-confirm-title">有未保存的修改</h3>
            <p>关闭前要保存吗？</p>
            <div className="drawer-confirm-actions">
              {onSave && (
                <button type="button" className="primary" disabled={saving} onClick={() => void saveAndClose()}>
                  {saving ? '保存中…' : '保存'}
                </button>
              )}
              <button type="button" disabled={saving} onClick={discardAndClose}>
                不保存
              </button>
              <button
                type="button"
                className="ghost"
                disabled={saving}
                onClick={() => setConfirmOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
