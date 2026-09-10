import { useCallback, useEffect, useRef } from 'react'

/**
 * 在「原文件名」区域拖选文字后，点击输入框时把选区写入该字段。
 * 选区在输入框获得焦点前会丢失，故用 selectionchange 缓存。
 */
export function useFilenameSelectionFill() {
  const sourceRef = useRef<HTMLParagraphElement | null>(null)
  const pendingRef = useRef('')

  useEffect(() => {
    const onSel = () => {
      const root = sourceRef.current
      if (!root) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
      const a = sel.anchorNode
      const f = sel.focusNode
      if (!a || !f || !root.contains(a) || !root.contains(f)) return
      const text = sel.toString().replace(/\u00a0/g, ' ').trim()
      if (text) pendingRef.current = text
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const takePending = useCallback(() => {
    const t = pendingRef.current.trim()
    pendingRef.current = ''
    return t
  }, [])

  /** 输入框 focus：若有来自文件名的选区，写入（覆盖） */
  const fillOnFocus = useCallback(
    (apply: (text: string) => void) => {
      const t = takePending()
      if (t) apply(t)
    },
    [takePending],
  )

  return { sourceRef, fillOnFocus, takePending }
}
