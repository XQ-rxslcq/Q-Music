import type { DesktopLyricsSettings, PageLyricsSettings, ThemeSettings } from './vite-env'
import {
  LINE_LAYOUT_PRESETS,
  LYRIC_FONT_GROUPS,
  desktopLyricsFromPage,
  mergeDesktopLyrics,
  mergePageLyrics,
  pageLyricsFromDesktop,
  type LyricLang,
} from '../core/desktop-lyrics'
import UiSelect from './UiSelect'
import ColorField from './ColorField'
import DrawerShell from './DrawerShell'

type Props = {
  open: boolean
  value: ThemeSettings
  onChange: (next: ThemeSettings) => void
  onClose: () => void
}

function patchDesktop(value: ThemeSettings, patch: Partial<DesktopLyricsSettings>): ThemeSettings {
  return {
    ...value,
    desktopLyrics: mergeDesktopLyrics({ ...value.desktopLyrics, ...patch }),
  }
}

function patchPage(value: ThemeSettings, patch: Partial<PageLyricsSettings>): ThemeSettings {
  return {
    ...value,
    pageLyrics: mergePageLyrics({ ...value.pageLyrics, ...patch }),
  }
}

function patchFont(
  value: ThemeSettings,
  lang: LyricLang,
  font: string,
): ThemeSettings {
  const dl = mergeDesktopLyrics(value.desktopLyrics)
  const fonts = { ...dl.fonts, [lang]: font }
  return patchDesktop(value, {
    fonts,
    fontFamily: lang === 'zh' ? font : dl.fontFamily,
  })
}

function patchPageFont(
  value: ThemeSettings,
  lang: LyricLang,
  font: string,
): ThemeSettings {
  const pl = mergePageLyrics(value.pageLyrics)
  const fonts = { ...pl.fonts, [lang]: font }
  return patchPage(value, {
    fonts,
    fontFamily: lang === 'zh' ? font : pl.fontFamily,
  })
}

function syncToPage(value: ThemeSettings): ThemeSettings {
  return {
    ...value,
    pageLyrics: pageLyricsFromDesktop(mergeDesktopLyrics(value.desktopLyrics), value.pageLyrics),
  }
}

function syncToDesktop(value: ThemeSettings): ThemeSettings {
  return {
    ...value,
    desktopLyrics: desktopLyricsFromPage(
      mergeDesktopLyrics(value.desktopLyrics),
      mergePageLyrics(value.pageLyrics),
    ),
  }
}

export default function LyricsStyleDrawer({ open, value, onChange, onClose }: Props) {
  if (!open) return null

  const dl = mergeDesktopLyrics(value.desktopLyrics)
  const pl = mergePageLyrics(value.pageLyrics)

  return (
    <DrawerShell open={open} title="歌词样式" onClose={onClose} panelClassName="theme-drawer">

        <p className="theme-tip">
          桌面歌词与歌曲详情页分开配置。播放条「词」也可开关桌面歌词；解锁后可拖缩放。
        </p>

        <h3 className="theme-sub">桌面歌词</h3>

        <label className="theme-field">
          <span>显示</span>
          <div className="seg">
            <button
              type="button"
              className={dl.visible ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { visible: true }))}
            >
              开
            </button>
            <button
              type="button"
              className={!dl.visible ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { visible: false }))}
            >
              关
            </button>
          </div>
        </label>
        <label className="theme-field">
          <span>锁定（穿透）</span>
          <div className="seg">
            <button
              type="button"
              className={dl.locked !== false ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { locked: true }))}
            >
              锁定
            </button>
            <button
              type="button"
              className={dl.locked === false ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { locked: false, visible: true }))}
            >
              解锁调位
            </button>
          </div>
        </label>
        <label className="theme-field">
          <span>行数 / 方向</span>
          <div className="seg">
            <button
              type="button"
              className={dl.lineCount === 1 ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { lineCount: 1 }))}
            >
              单行
            </button>
            <button
              type="button"
              className={dl.lineCount === 2 ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { lineCount: 2 }))}
            >
              双行
            </button>
            <button
              type="button"
              className={dl.orientation === 'horizontal' ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { orientation: 'horizontal' }))}
            >
              横
            </button>
            <button
              type="button"
              className={dl.orientation === 'vertical' ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { orientation: 'vertical' }))}
            >
              竖
            </button>
          </div>
        </label>
        <label className="theme-field">
          <span>框内行位预设</span>
          <div className="seg" style={{ flexWrap: 'wrap' }}>
            {LINE_LAYOUT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={
                  JSON.stringify(dl.lineLayouts) === JSON.stringify(p.layouts) ? 'active' : ''
                }
                onClick={() => onChange(patchDesktop(value, { lineLayouts: p.layouts }))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </label>

        <h3 className="theme-sub">桌面 · 按语种字体</h3>
        <p className="theme-tip">每行歌词按文字自动选字体（假名→日、谚文→韩、汉字→中、其余→西文）。</p>
        {LYRIC_FONT_GROUPS.map((g) => (
          <label key={g.lang} className="theme-field">
            <span>
              {g.label}
              <span className="font-sample" style={{ fontFamily: dl.fonts[g.lang] }}>
                {g.sample}
              </span>
            </span>
            <UiSelect
              value={dl.fonts[g.lang]}
              options={g.fonts.map((f) => ({ value: f.value, label: f.label }))}
              onChange={(font) => onChange(patchFont(value, g.lang, font))}
            />
          </label>
        ))}

        <label className="theme-field">
          <span>字号 {dl.fontSize}px</span>
          <input
            type="range"
            min={16}
            max={56}
            step={1}
            value={dl.fontSize}
            className="ui-range"
            onChange={(e) => onChange(patchDesktop(value, { fontSize: Number(e.target.value) }))}
          />
        </label>
        <div className="theme-field">
          <span>描边</span>
          <div className="seg">
            <button
              type="button"
              className={dl.stroke ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { stroke: true }))}
            >
              开
            </button>
            <button
              type="button"
              className={!dl.stroke ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { stroke: false }))}
            >
              关
            </button>
          </div>
          {dl.stroke && (
            <div className="lm-num-row" style={{ marginTop: 8 }}>
              <ColorField
                title="描边色"
                value={dl.strokeColor?.startsWith('#') ? dl.strokeColor : '#000000'}
                onChange={(strokeColor) => onChange(patchDesktop(value, { strokeColor }))}
              />
              <input
                className="lm-num"
                type="number"
                min={1}
                max={8}
                value={dl.strokeWidth ?? 2}
                onChange={(e) =>
                  onChange(
                    patchDesktop(value, { strokeWidth: Math.max(1, Number(e.target.value) || 2) }),
                  )
                }
              />
            </div>
          )}
        </div>
        <div className="theme-field">
          <span>填充</span>
          <div className="seg">
            <button
              type="button"
              className={dl.fillMode !== 'gradient' ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { fillMode: 'solid' }))}
            >
              纯色
            </button>
            <button
              type="button"
              className={dl.fillMode === 'gradient' ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { fillMode: 'gradient' }))}
            >
              渐变
            </button>
          </div>
          {dl.fillMode === 'gradient' && (
            <div className="lm-num-row" style={{ marginTop: 8 }}>
              <ColorField
                title="渐变起"
                value={dl.gradientFrom?.startsWith('#') ? dl.gradientFrom : '#ffffff'}
                onChange={(gradientFrom) => onChange(patchDesktop(value, { gradientFrom }))}
              />
              <ColorField
                title="渐变止"
                value={dl.gradientTo?.startsWith('#') ? dl.gradientTo : '#2a9fd4'}
                onChange={(gradientTo) => onChange(patchDesktop(value, { gradientTo }))}
              />
            </div>
          )}
        </div>
        <div className="theme-field">
          <span>句内跟唱进度</span>
          <div className="seg">
            <button
              type="button"
              className={dl.karaoke !== false ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { karaoke: true }))}
            >
              开
            </button>
            <button
              type="button"
              className={dl.karaoke === false ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { karaoke: false }))}
            >
              关
            </button>
          </div>
        </div>
        {dl.karaoke !== false ? (
          <>
            <div className="theme-field">
              <span>已唱 / 未唱</span>
              <div className="lm-num-row">
                <ColorField
                  title="已唱"
                  value={dl.sungColor?.startsWith('#') ? dl.sungColor : '#2a9fd4'}
                  onChange={(sungColor) =>
                    onChange(patchDesktop(value, { sungColor, activeColor: sungColor }))
                  }
                />
                <ColorField
                  title="未唱"
                  value={dl.unsungColor?.startsWith('#') ? dl.unsungColor : '#ffffff'}
                  onChange={(unsungColor) => onChange(patchDesktop(value, { unsungColor }))}
                />
              </div>
              <span className="theme-tip">仅当前句内渐变；下一句用下方「其它句」色，字号与当前句一致。</span>
            </div>
            <div className="theme-field">
              <span>其它句（下一句）</span>
              <div className="lm-num-row">
                <ColorField
                  title="其它句"
                  value={dl.color.startsWith('#') ? dl.color : '#9aa3b2'}
                  onChange={(color) => onChange(patchDesktop(value, { color }))}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="theme-field">
            <span>当前句 / 其它句</span>
            <div className="lm-num-row">
              <ColorField
                title="当前句"
                value={dl.activeColor.startsWith('#') ? dl.activeColor : '#ffffff'}
                onChange={(activeColor) => onChange(patchDesktop(value, { activeColor }))}
              />
              <ColorField
                title="其它句"
                value={dl.color.startsWith('#') ? dl.color : '#999999'}
                onChange={(color) => onChange(patchDesktop(value, { color }))}
              />
            </div>
          </div>
        )}
        <label className="theme-field">
          <span>不透明度 {Math.round(dl.opacity * 100)}%</span>
          <input
            type="range"
            min={30}
            max={100}
            step={1}
            value={Math.round(dl.opacity * 100)}
            className="ui-range"
            onChange={(e) => onChange(patchDesktop(value, { opacity: Number(e.target.value) / 100 }))}
          />
        </label>
        <label className="theme-field">
          <span>阴影</span>
          <div className="seg">
            <button
              type="button"
              className={dl.shadow ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { shadow: true }))}
            >
              开
            </button>
            <button
              type="button"
              className={!dl.shadow ? 'active' : ''}
              onClick={() => onChange(patchDesktop(value, { shadow: false }))}
            >
              关
            </button>
          </div>
        </label>
        <div className="theme-field">
          <span>统一到详情页</span>
          <button
            type="button"
            className="primary"
            style={{ width: '100%' }}
            onClick={() => onChange(syncToPage(value))}
          >
            将桌面歌词样式同步到详情页
          </button>
          <span className="theme-tip">字体、字号、颜色、跟唱色会覆盖详情页对应项。</span>
        </div>

        <h3 className="theme-sub">歌曲详情页</h3>
        <p className="theme-tip">仅影响点进当前曲后的歌词列表；可与桌面歌词互相同步。</p>
        <div className="theme-field">
          <span>从桌面同步</span>
          <button
            type="button"
            className="primary"
            style={{ width: '100%' }}
            onClick={() => onChange(syncToPage(value))}
          >
            用桌面歌词样式覆盖详情页
          </button>
        </div>
        {LYRIC_FONT_GROUPS.map((g) => (
          <label key={`page-${g.lang}`} className="theme-field">
            <span>
              {g.label}
              <span className="font-sample" style={{ fontFamily: pl.fonts[g.lang] }}>
                {g.sample}
              </span>
            </span>
            <UiSelect
              value={pl.fonts[g.lang]}
              options={g.fonts.map((f) => ({ value: f.value, label: f.label }))}
              onChange={(font) => onChange(patchPageFont(value, g.lang, font))}
            />
          </label>
        ))}
        <label className="theme-field">
          <span>字号 {pl.fontSize}px</span>
          <input
            type="range"
            min={14}
            max={56}
            step={1}
            value={pl.fontSize}
            className="ui-range"
            onChange={(e) => onChange(patchPage(value, { fontSize: Number(e.target.value) }))}
          />
        </label>
        <label className="theme-field">
          <span>背景模糊 {pl.bgBlur}px</span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={pl.bgBlur}
            className="ui-range"
            onChange={(e) => onChange(patchPage(value, { bgBlur: Number(e.target.value) }))}
          />
          <span className="theme-tip">0 为实底遮罩；大于 0 时毛玻璃透出下层界面，不影响歌词清晰度。</span>
        </label>
        <label className="theme-field">
          <span>长句滚动</span>
          <div className="seg">
            <button
              type="button"
              className={pl.scrollLongLines !== false ? 'active' : ''}
              onClick={() => onChange(patchPage(value, { scrollLongLines: true }))}
            >
              开
            </button>
            <button
              type="button"
              className={pl.scrollLongLines === false ? 'active' : ''}
              onClick={() => onChange(patchPage(value, { scrollLongLines: false }))}
            >
              关
            </button>
          </div>
          <span className="theme-tip">当前句过长时按跟唱进度平移，与桌面歌词同算法。</span>
        </label>
        <div className="theme-field">
          <span>句内跟唱进度</span>
          <div className="seg">
            <button
              type="button"
              className={pl.karaoke ? 'active' : ''}
              onClick={() => onChange(patchPage(value, { karaoke: true }))}
            >
              开
            </button>
            <button
              type="button"
              className={!pl.karaoke ? 'active' : ''}
              onClick={() => onChange(patchPage(value, { karaoke: false }))}
            >
              关
            </button>
          </div>
        </div>
        {pl.karaoke ? (
          <div className="theme-field">
            <span>已唱 / 未唱</span>
            <div className="lm-num-row">
              <ColorField
                title="已唱"
                value={pl.sungColor?.startsWith('#') ? pl.sungColor : '#2a9fd4'}
                onChange={(sungColor) =>
                  onChange(patchPage(value, { sungColor, activeColor: sungColor }))
                }
              />
              <ColorField
                title="未唱"
                value={pl.unsungColor?.startsWith('#') ? pl.unsungColor : '#e8eef8'}
                onChange={(unsungColor) => onChange(patchPage(value, { unsungColor }))}
              />
            </div>
            <span className="theme-tip">跟唱仅作用于当前句；其它句仍用下方「其它句」色。</span>
          </div>
        ) : (
          <div className="theme-field">
            <span>当前句 / 其它句</span>
            <div className="lm-num-row">
              <ColorField
                title="当前句"
                value={pl.activeColor.startsWith('#') ? pl.activeColor : '#e8eef8'}
                onChange={(activeColor) => onChange(patchPage(value, { activeColor }))}
              />
              <ColorField
                title="其它句"
                value={pl.color.startsWith('#') ? pl.color : '#9aa8bd'}
                onChange={(color) => onChange(patchPage(value, { color }))}
              />
            </div>
          </div>
        )}
        {!pl.karaoke && (
          <div className="theme-field">
            <span className="theme-tip">跟唱关闭时用当前句/其它句两色；开启后当前句改用已唱/未唱渐变。</span>
          </div>
        )}
        {pl.karaoke && (
          <div className="theme-field">
            <span>其它句颜色</span>
            <div className="lm-num-row">
              <ColorField
                title="其它句"
                value={pl.color.startsWith('#') ? pl.color : '#9aa8bd'}
                onChange={(color) => onChange(patchPage(value, { color }))}
              />
            </div>
          </div>
        )}
        <div className="theme-field">
          <span>统一到桌面歌词</span>
          <button
            type="button"
            className="primary"
            style={{ width: '100%' }}
            onClick={() => onChange(syncToDesktop(value))}
          >
            将详情页样式同步到桌面歌词
          </button>
          <span className="theme-tip">字体、字号、颜色、跟唱色会覆盖桌面对应项；窗口位置与行位保留。</span>
        </div>

        <p className="theme-tip">样式写入 data/theme.json，与外观主题同文件。</p>
    </DrawerShell>
  )
}
