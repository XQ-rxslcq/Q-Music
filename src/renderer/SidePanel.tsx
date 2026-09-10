import type { ReactNode } from 'react'
import DrawerShell from './DrawerShell'

type Props = {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
}

/** 右侧展开面板：歌词等 */
export default function SidePanel({ open, title = '', onClose, children }: Props) {
  if (!open) return null
  return (
    <DrawerShell open={open} title={title} onClose={onClose} panelClassName="theme-drawer side-panel">
      <div className="side-panel-body">{children}</div>
    </DrawerShell>
  )
}
