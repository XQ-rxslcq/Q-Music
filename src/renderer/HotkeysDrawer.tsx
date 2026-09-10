import { useMemo, useState } from 'react'
import {
  DEFAULT_HOTKEY_BINDINGS,
  HOTKEY_ACTION_LABELS,
  accelToKeycaps,
  evaluateHotkeyUsability,
  listImeHostileBindings,
  mergeHotkeyBindings,
  type HotkeyAction,
  type HotkeyBinding,
} from '../core/hotkey-config'
import DrawerShell from './DrawerShell'

type Props = {
  open: boolean
  value: HotkeyBinding[]
  failedGlobals?: string[]
  onChange: (next: HotkeyBinding[]) => void
  onClose: () => void
}

function Keycaps({ accel, tone }: { accel: string; tone?: 'bad' | 'doubt' | null }) {
  const caps = accelToKeycaps(accel)
  if (!caps.length) return <span className="keycap-empty">未绑定</span>
  return (
    <span className={`keycap-row ${tone === 'bad' ? 'bad' : tone === 'doubt' ? 'doubt' : ''}`}>
      {caps.map((c, i) => (
        <kbd key={`${c}-${i}`} className="keycap">
          {c}
        </kbd>
      ))}
    </span>
  )
}

export default function HotkeysDrawer({ open, value, failedGlobals = [], onChange, onClose }: Props) {
  const [recording, setRecording] = useState<HotkeyAction | null>(null)
  const bindings = useMemo(() => mergeHotkeyBindings(value), [value])
  const usability = useMemo(
    () => evaluateHotkeyUsability(bindings, failedGlobals),
    [bindings, failedGlobals],
  )
  const usabilityByAction = useMemo(() => new Map(usability.map((u) => [u.action, u])), [usability])
  const digitDoubtCount = useMemo(() => listImeHostileBindings(bindings).length, [bindings])

  if (!open) return null

  const patch = (action: HotkeyAction, accel: string) => {
    onChange(bindings.map((b) => (b.action === action ? { ...b, global: accel, inApp: '' } : b)))
  }

  return (
    <DrawerShell open={open} title="快捷键" onClose={onClose} panelClassName="theme-drawer hotkeys-drawer">
      <p className="theme-tip">
        全局生效（窗口在后台也可用）。点「录制」后按下组合键；Esc 取消。✓ 可用 · ? 存疑 · ✕ 不可用。
      </p>
      {digitDoubtCount > 0 && (
        <p className="theme-tip hotkey-ime-warn">
          有 {digitDoubtCount} 个绑定标为<strong>按键存疑</strong>（多为带数字的组合）：在中文输入法下应用外可能无效。不会改写你录入的键，仅作提示；更稳妥可用字母键（如
          Ctrl+Alt+Shift+Q）。
        </p>
      )}
      <ul className="hotkey-list">
        {bindings.map((b) => {
          const u = usabilityByAction.get(b.action)
          const bad = Boolean(u && !u.usable && u.kind !== 'empty')
          const doubt = Boolean(u?.doubtful)
          const ok = u?.usable === true && !doubt
          const statusClass = bad ? 'bad' : doubt ? 'doubt' : ok ? 'ok' : 'empty'
          const mark = bad ? '✕' : doubt ? '?' : ok ? '✓' : '·'
          return (
            <li key={b.action}>
              <div className="hotkey-label">
                <span>{HOTKEY_ACTION_LABELS[b.action]}</span>
                <span className={`hotkey-status ${statusClass}`} title={u?.label}>
                  {mark}
                </span>
              </div>
              {u && (u.doubtful || (u.kind !== 'ok' && u.kind !== 'empty')) && (
                <p className={`hotkey-reason ${u.doubtful ? 'doubt' : ''}`}>{u.label}</p>
              )}
              <div className="hotkey-row">
                <Keycaps accel={b.global} tone={bad ? 'bad' : doubt ? 'doubt' : null} />
                <button type="button" className="ghost" onClick={() => setRecording(b.action)}>
                  {recording === b.action ? '按下…' : '录制'}
                </button>
                <button type="button" className="ghost" onClick={() => patch(b.action, '')}>
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
            patch(recording, parts.join('+'))
            setRecording(null)
          }}
        >
          正在录制「{HOTKEY_ACTION_LABELS[recording]}」…（Esc 取消；原样保存，数字键仅提示存疑）
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
