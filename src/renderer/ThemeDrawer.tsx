import type { ThemeSettings } from './vite-env'
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
  onClose: () => void
}

export default function ThemeDrawer({ open, value, onChange, onPickBackground, onClose }: Props) {
  if (!open) return null

  const opacityPct = Math.round(value.panelOpacity * 100)

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
          <div className="seg seg-3">
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
            <span>背景图（复制到 data/backgrounds）</span>
            <button type="button" onClick={onPickBackground}>
              {value.bgImageRel ? '更换图片' : '选择图片'}
            </button>
            {value.bgImageRel && <span className="theme-tip">{value.bgImageRel}</span>}
          </label>
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
            onChange={(e) =>
              onChange({ ...value, panelOpacity: Number(e.target.value) / 100 })
            }
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
        <p className="theme-tip">外观保存在程序目录 data/theme.json，随应用一起拷贝。</p>
    </DrawerShell>
  )
}
