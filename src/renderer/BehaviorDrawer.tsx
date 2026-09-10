import { useEffect, useState } from 'react'
import DrawerShell from './DrawerShell'

type Behavior = {
  allowMultiInstance: boolean
  persistQueue: boolean
  desktopLyricsTripleCycle: boolean
  dataDir: string
  defaultDataDir: string
  appRoot: string
}

type Props = {
  open: boolean
  onClose: () => void
  onNotify: (kind: 'ok' | 'error' | 'info', text: string) => void
  onBehaviorChange?: (b: Behavior) => void
}

export default function BehaviorDrawer({ open, onClose, onNotify, onBehaviorChange }: Props) {
  const [behavior, setBehavior] = useState<Behavior | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void window.qmusic.getBehavior().then((b) => setBehavior(b as Behavior))
  }, [open])

  if (!open) return null

  const patch = async (next: Partial<Behavior>) => {
    const res = (await window.qmusic.setBehavior({
      allowMultiInstance: next.allowMultiInstance,
      persistQueue: next.persistQueue,
      desktopLyricsTripleCycle: next.desktopLyricsTripleCycle,
    })) as Behavior
    setBehavior(res)
    onBehaviorChange?.(res)
  }

  return (
    <DrawerShell
      open={open}
      title="应用行为设置"
      onClose={onClose}
      panelClassName="theme-drawer behavior-drawer"
    >
      {!behavior ? (
        <p className="theme-tip">加载中…</p>
      ) : (
        <>
          <label className="theme-field check">
            <input
              type="checkbox"
              checked={behavior.allowMultiInstance}
              onChange={(e) => {
                void patch({ allowMultiInstance: e.target.checked }).then(() => {
                  onNotify(
                    'ok',
                    e.target.checked
                      ? '已允许多开（下次新启动的进程可并存）'
                      : '已恢复单开（已有实例时二次启动会唤起原窗口）',
                  )
                })
              }}
            />
            允许同时运行多个实例
          </label>
          <p className="theme-tip">
            仅打包后生效；开发模式始终可多开。多开并存时标题才会变成 Q-Music (1)、(2)…；只开一台仍显示
            Q-Music。
          </p>

          <label className="theme-field check">
            <input
              type="checkbox"
              checked={behavior.persistQueue}
              onChange={(e) => {
                void patch({ persistQueue: e.target.checked }).then(() => {
                  onNotify('ok', e.target.checked ? '重启后保留播放队列' : '重启后清空播放队列')
                })
              }}
            />
            重启后保留播放队列
          </label>

          <label className="theme-field check">
            <input
              type="checkbox"
              checked={behavior.desktopLyricsTripleCycle}
              onChange={(e) => {
                void patch({ desktopLyricsTripleCycle: e.target.checked }).then(() => {
                  onNotify(
                    'ok',
                    e.target.checked
                      ? '桌面歌词：三态循环（显示→锁定→隐藏）'
                      : '桌面歌词：两态循环（显示↔隐藏）',
                  )
                })
              }}
            />
            桌面歌词三态循环（显示 → 锁定 → 隐藏）
          </label>
          <p className="theme-tip">关闭后按钮与快捷键只在「显示 / 隐藏」间切换。</p>

          <div className="theme-field">
            <span>数据目录（qmdata）</span>
            <code className="path-code">{behavior.dataDir}</code>
            <p className="theme-tip">默认：{behavior.defaultDataDir}</p>
            <div className="panel-tools">
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    const picked = await window.qmusic.pickDataDir()
                    if (picked.canceled || !picked.path) return
                    setBusy(true)
                    onNotify('info', '正在移动数据并重启…')
                    const res = await window.qmusic.relocateDataDir(picked.path)
                    setBusy(false)
                    if (!res.ok) onNotify('error', res.error || '移动失败')
                  })()
                }}
              >
                更改位置…
              </button>
              <button
                type="button"
                className="ghost"
                disabled={busy || behavior.dataDir === behavior.defaultDataDir}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    onNotify('info', '正在移回默认位置并重启…')
                    const res = await window.qmusic.relocateDataDir(behavior.defaultDataDir)
                    setBusy(false)
                    if (!res.ok) onNotify('error', res.error || '移动失败')
                  })()
                }}
              >
                恢复默认位置
              </button>
            </div>
            <p className="theme-tip">更改后会移动整个 qmdata 并重启；原目录不留残留。</p>
            <p className="theme-tip">
              所选路径若尚未以 qmdata 结尾，会自动补上 \qmdata（已是则不再追加）。
            </p>
          </div>
        </>
      )}
    </DrawerShell>
  )
}
