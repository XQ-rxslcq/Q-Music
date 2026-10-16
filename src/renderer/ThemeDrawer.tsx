import { useEffect, useState } from 'react'
import type { BgRotateItem, ThemeSettings } from './vite-env'
import { mergeBgRotate } from '../core/library-model'
import { moveBgRotateOrder } from '../core/bg-rotate'
import ColorField from './ColorField'
import DrawerShell from './DrawerShell'

const ACCENTS = [
  { id: 'sky', label: '天青', value: '#3d9cf0' },
  { id: 'teal', label: '青绿', value: '#2bbbad' },
  { id: 'amber', label: '琥珀', value: '#e0a145' },
  { id: 'rose', label: '玫红', value: '#e06b8a' },
  { id: 'violet', label: '藤紫', value: '#8b7cf0' },
]

type Props = {
  open: boolean
  value: ThemeSettings
  onChange: (next: ThemeSettings) => void
  onPickBackground: () => void
  onThemePayload?: (tp: { theme: ThemeSettings; bgImageUrl: string | null }) => void
  onClose: () => void
}

export default function ThemeDrawer({
  open,
  value,
  onChange,
  onPickBackground,
  onThemePayload,
  onClose,
}: Props) {
  const [rotateItems, setRotateItems] = useState<BgRotateItem[]>([])
  const [rotateBusy, setRotateBusy] = useState(false)
  /** 间隔输入框草稿：输入过程中不回写，避免 5 秒下限把中间态夹掉（如想打 30 先被改成 5→50） */
  const [intervalDraft, setIntervalDraft] = useState<string | null>(null)

  useEffect(() => {
    if (!open || value.bgStyle !== 'rotate') return
    let cancelled = false
    void window.qmusic.listBgRotate().then((res) => {
      if (cancelled) return
      setRotateItems(res.items || [])
      onThemePayload?.(res)
    })
    return () => {
      cancelled = true
    }
  }, [open, value.bgStyle, onThemePayload])

  if (!open) return null

  const opacityPct = Math.round(value.panelOpacity * 100)
  const intervalSec = mergeBgRotate(value.bgRotate).intervalSec

  const applyRotatePayload = (res: {
    items: BgRotateItem[]
    theme: ThemeSettings
    bgImageUrl: string | null
  }) => {
    setRotateItems(res.items || [])
    onThemePayload?.(res)
  }

  const onAddRotate = async () => {
    setRotateBusy(true)
    try {
      const res = await window.qmusic.addBgRotate()
      applyRotatePayload(res)
    } finally {
      setRotateBusy(false)
    }
  }

  const onRemoveRotate = async (rel: string) => {
    setRotateBusy(true)
    try {
      const res = await window.qmusic.removeBgRotate(rel)
      applyRotatePayload(res)
    } finally {
      setRotateBusy(false)
    }
  }

  const onMoveRotate = async (rel: string, delta: -1 | 1) => {
    const order = rotateItems.map((i) => i.rel)
    const next = moveBgRotateOrder(order, rel, delta)
    if (next.join('\0') === order.join('\0')) return
    setRotateBusy(true)
    try {
      const res = await window.qmusic.reorderBgRotate(next)
      applyRotatePayload(res)
    } finally {
      setRotateBusy(false)
    }
  }

  return (
    <DrawerShell open={open} title="外观" onClose={onClose} panelClassName="theme-drawer">
      <label className="theme-field">
        <span>亮 / 暗</span>
        <div className="seg">
          <button
            type="button"
            className={value.mode === 'dark' ? 'active' : ''}
            onClick={() => onChange({ ...value, mode: 'dark' })}
          >
            暗色
          </button>
          <button
            type="button"
            className={value.mode === 'light' ? 'active' : ''}
            onClick={() => onChange({ ...value, mode: 'light' })}
          >
            亮色
          </button>
        </div>
      </label>

      <label className="theme-field">
        <span>主题色</span>
        <div className="swatches">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`swatch ${value.accent === a.value ? 'active' : ''}`}
              style={{ background: a.value }}
              title={a.label}
              onClick={() => onChange({ ...value, accent: a.value })}
            />
          ))}
        </div>
      </label>

      <label className="theme-field">
        <span>背景模式</span>
        <div className="seg seg-4">
          <button
            type="button"
            className={value.bgStyle === 'gradient' ? 'active' : ''}
            onClick={() => onChange({ ...value, bgStyle: 'gradient' })}
          >
            渐变
          </button>
          <button
            type="button"
            className={value.bgStyle === 'flat' ? 'active' : ''}
            onClick={() => onChange({ ...value, bgStyle: 'flat' })}
          >
            纯色
          </button>
          <button
            type="button"
            className={value.bgStyle === 'image' ? 'active' : ''}
            onClick={() => onChange({ ...value, bgStyle: 'image' })}
          >
            图片
          </button>
          <button
            type="button"
            className={value.bgStyle === 'rotate' ? 'active' : ''}
            onClick={() => onChange({ ...value, bgStyle: 'rotate' })}
          >
            轮换
          </button>
        </div>
      </label>

      {value.bgStyle === 'flat' && (
        <div className="theme-field">
          <span>纯色颜色</span>
          <ColorField
            value={value.flatColor}
            onChange={(flatColor) => onChange({ ...value, flatColor })}
          />
        </div>
      )}

      {value.bgStyle === 'image' && (
        <label className="theme-field">
          <span>背景图（复制到 qmdata/backgrounds）</span>
          <button type="button" onClick={onPickBackground}>
            {value.bgImageRel ? '更换图片' : '选择图片'}
          </button>
          {value.bgImageRel && <span className="theme-tip">{value.bgImageRel}</span>}
        </label>
      )}

      {value.bgStyle === 'rotate' && (
        <div className="theme-field">
          <span>背景轮换（qmdata/bg-rotate）</span>
          <div className="bg-rotate-toolbar">
            <label className="bg-rotate-interval">
              <span>间隔（秒）</span>
              <input
                type="number"
                min={5}
                max={86400}
                step={1}
                value={intervalDraft ?? String(intervalSec)}
                disabled={rotateBusy}
                onChange={(e) => {
                  const raw = e.target.value
                  setIntervalDraft(raw)
                  const n = Number(raw)
                  // 仅提交合法区间内的值；越界值留到失焦时再夹取（≥5 / ≤86400）
                  if (Number.isFinite(n) && n >= 5 && n <= 86400) {
                    onChange({
                      ...value,
                      bgRotate: mergeBgRotate({ ...value.bgRotate, intervalSec: n }),
                    })
                  }
                }}
                onBlur={() => {
                  if (intervalDraft != null) {
                    const n = Number(intervalDraft)
                    onChange({
                      ...value,
                      bgRotate: mergeBgRotate({
                        ...value.bgRotate,
                        intervalSec: Number.isFinite(n) ? n : intervalSec,
                      }),
                    })
                  }
                  setIntervalDraft(null)
                }}
              />
            </label>
            <button type="button" disabled={rotateBusy} onClick={() => void onAddRotate()}>
              添加图片
            </button>
          </div>
          <ul className="bg-rotate-list">
            {rotateItems.map((item, i) => (
              <li key={item.rel} className={value.bgImageRel === item.rel ? 'active' : ''}>
                <span className="bg-rotate-thumb" style={{ backgroundImage: `url("${item.url}")` }} />
                <span className="bg-rotate-name" title={item.rel}>
                  {item.name}
                </span>
                <span className="bg-rotate-move">
                  <button
                    type="button"
                    className="ghost"
                    disabled={rotateBusy || i === 0}
                    title="上移"
                    onClick={() => void onMoveRotate(item.rel, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={rotateBusy || i >= rotateItems.length - 1}
                    title="下移"
                    onClick={() => void onMoveRotate(item.rel, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={rotateBusy}
                    onClick={() => void onRemoveRotate(item.rel)}
                  >
                    删除
                  </button>
                </span>
              </li>
            ))}
            {!rotateItems.length && (
              <li className="bg-rotate-empty">还没有图片，点「添加图片」放入轮换池</li>
            )}
          </ul>
          <span className="theme-tip">↑↓ 调整轮换顺序；间隔单位为秒，写入 theme.json。</span>
        </div>
      )}

      <label className="theme-field">
        <span>UI 模块不透明度 {opacityPct}%（0% 时无底无边框）</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={opacityPct}
          className="ui-range"
          onChange={(e) => onChange({ ...value, panelOpacity: Number(e.target.value) / 100 })}
        />
      </label>

      <label className="theme-field">
        <span>低透明度文字描边</span>
        <div className="seg">
          <button
            type="button"
            className={value.lowOpacityTextStroke !== false ? 'active' : ''}
            onClick={() => onChange({ ...value, lowOpacityTextStroke: true })}
          >
            开
          </button>
          <button
            type="button"
            className={value.lowOpacityTextStroke === false ? 'active' : ''}
            onClick={() => onChange({ ...value, lowOpacityTextStroke: false })}
          >
            关
          </button>
        </div>
        <span className="theme-tip">
          开启后，模块不透明度低于 40% 时，给信息文字加「文字色反色」描边，便于压在复杂背景上阅读。
        </span>
      </label>

      <p className="theme-tip">桌面歌词样式请到菜单「歌词 → 歌词样式」。</p>
      <p className="theme-tip">外观保存在 qmdata/theme.json，随数据目录一起拷贝。</p>
    </DrawerShell>
  )
}
