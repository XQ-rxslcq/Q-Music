import { useMemo, useState } from 'react'
import {
  DEFAULT_HOTKEY_BINDINGS,
  HOTKEY_ACTION_LABELS,
  eventToInAppAccel,
  findHotkeyConflicts,
  mergeHotkeyBindings,
  type HotkeyAction,
  type HotkeyBinding,
} from '../core/hotkey-config'
import DrawerShell from './DrawerShell'

type Props = {
  open: boolean
  value: HotkeyBinding[]
  onChange: (next: HotkeyBinding[]) => void
  onClose: () => void
}

export default function HotkeysDrawer({ open, value, onChange, onClose }: Props) {
  const [recording, setRecording] = useState<{ action: HotkeyAction; scope: 'global' | 'inApp' } | null>(
    null,
  )
  const bindings = useMemo(() => mergeHotkeyBindings(value), [value])
  const conflicts = useMemo(() => findHotkeyConflicts(bindings), [bindings])

  if (!open) return null

  const patch = (action: HotkeyAction, scope: 'global' | 'inApp', accel: string) => {
    onChange(
      bindings.map((b) => (b.action === action ? { ...b, [scope]: accel } : b)),
    )
  }

  return (
    <DrawerShell open={open} title="快捷键" onClose={onClose} panelClassName="theme-drawer hotkeys-drawer">
        <p className="theme-tip">
          全局键在窗口失焦时生效。点「录制」后按下组合键；Esc 取消。冲突会标红。
        </p>
        {conflicts.length > 0 && (
          <p className="theme-tip hotkey-conflict">
            冲突：
            {conflicts
              .map((c) => `${c.scope}「${c.accel}」→ ${c.actions.map((a) => HOTKEY_ACTION_LABELS[a]).join(' / ')}`)
              .join('；')}
          </p>
        )}
        <ul className="hotkey-list">
          {bindings.map((b) => {
            const gConflict = conflicts.some(
              (c) => c.scope === 'global' && c.actions.includes(b.action),
            )
            const iConflict = conflicts.some(
              (c) => c.scope === 'inApp' && c.actions.includes(b.action),
            )
            return (
              <li key={b.action}>
                <div className="hotkey-label">{HOTKEY_ACTION_LABELS[b.action]}</div>
                <div className="hotkey-row">
                  <span>全局</span>
                  <code className={gConflict ? 'bad' : ''}>{b.global || '（无）'}</code>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setRecording({ action: b.action, scope: 'global' })}
                  >
                    {recording?.action === b.action && recording.scope === 'global' ? '按下…' : '录制'}
                  </button>
                  <button type="button" className="ghost" onClick={() => patch(b.action, 'global', '')}>
                    清空
                  </button>
                </div>
                <div className="hotkey-row">
                  <span>窗内</span>
                  <code className={iConflict ? 'bad' : ''}>{b.inApp || '（无）'}</code>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setRecording({ action: b.action, scope: 'inApp' })}
                  >
                    {recording?.action === b.action && recording.scope === 'inApp' ? '按下…' : '录制'}
                  </button>
                  <button type="button" className="ghost" onClick={() => patch(b.action, 'inApp', '')}>
                    清空
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {recording && (
          <div
            className="hotkey-capture"
            tabIndex={0}
            ref={(el) => el?.focus()}
            onKeyDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (e.key === 'Escape') {
                setRecording(null)
                return
              }
              if (recording.scope === 'inApp') {
                patch(recording.action, 'inApp', eventToInAppAccel(e.nativeEvent))
              } else {
                const parts: string[] = []
                if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
                if (e.altKey) parts.push('Alt')
                if (e.shiftKey) parts.push('Shift')
                let key = e.key
                if (key === ' ') key = 'Space'
                else if (key.startsWith('Arrow')) key = key.replace('Arrow', '')
                else if (key.length === 1) key = key.toUpperCase()
                if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
                parts.push(key)
                patch(recording.action, 'global', parts.join('+'))
              }
              setRecording(null)
            }}
          >
            正在录制「{HOTKEY_ACTION_LABELS[recording.action]}」
            {recording.scope === 'global' ? '全局' : '窗内'}快捷键…（Esc 取消）
          </div>
        )}
        <div className="panel-tools" style={{ marginTop: 12 }}>
          <button type="button" className="ghost" onClick={() => onChange([...DEFAULT_HOTKEY_BINDINGS])}>
            恢复默认
          </button>
        </div>
    </DrawerShell>
  )
}
