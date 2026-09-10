/** 桌面歌词外观（存入 theme.json） */

export type LineSlotAlign = 'start' | 'center' | 'end'

export type LineSlot = {
  alignX: LineSlotAlign
  alignY: LineSlotAlign
  /** 框内水平偏移 0~100（相对宽） */
  offsetX: number
  /** 框内垂直偏移 0~100（相对高） */
  offsetY: number
}

export type DesktopLyricsBounds = {
  x: number
  y: number
  width: number
  height: number
}

/** 按语种分别指定字体 */
export type LyricLang = 'zh' | 'ja' | 'en' | 'ko'

export type DesktopLyricsFontMap = Record<LyricLang, string>

export type DesktopLyricsSettings = {
  visible: boolean
  /** true=点击穿透；false=可拖缩放调位 */
  locked: boolean
  lineCount: 1 | 2
  orientation: 'horizontal' | 'vertical'
  /** 兼容旧配置：等同 fonts.zh */
  fontFamily: string
  fonts: DesktopLyricsFontMap
  fontSize: number
  color: string
  activeColor: string
  shadow: boolean
  opacity: number
  /** 兼容旧版整体对齐；有 lineLayouts 时以行位为准 */
  align: LineSlotAlign
  stroke: boolean
  strokeColor: string
  strokeWidth: number
  fillMode: 'solid' | 'gradient'
  gradientFrom: string
  gradientTo: string
  /** 句内已唱/待唱进度 */
  karaoke: boolean
  sungColor: string
  unsungColor: string
  bounds: DesktopLyricsBounds | null
  lineLayouts: {
    primary: LineSlot
    secondary: LineSlot
  }
}

export const DEFAULT_LINE_SLOT: LineSlot = {
  alignX: 'center',
  alignY: 'center',
  offsetX: 0,
  offsetY: 0,
}

export const DEFAULT_LYRIC_FONTS: DesktopLyricsFontMap = {
  zh: 'Microsoft YaHei',
  ja: 'Yu Gothic UI',
  en: 'Segoe UI',
  ko: 'Malgun Gothic',
}

export const DEFAULT_DESKTOP_LYRICS: DesktopLyricsSettings = {
  visible: false,
  locked: true,
  lineCount: 2,
  orientation: 'horizontal',
  fontFamily: DEFAULT_LYRIC_FONTS.zh,
  fonts: { ...DEFAULT_LYRIC_FONTS },
  fontSize: 28,
  color: '#9aa3b2',
  activeColor: '#ffffff',
  shadow: true,
  opacity: 1,
  align: 'center',
  stroke: false,
  strokeColor: '#000000',
  strokeWidth: 2,
  fillMode: 'solid',
  gradientFrom: '#ffffff',
  gradientTo: '#2a9fd4',
  karaoke: true,
  sungColor: '#2a9fd4',
  unsungColor: '#ffffff',
  bounds: null,
  lineLayouts: {
    primary: { alignX: 'center', alignY: 'center', offsetX: 0, offsetY: -8 },
    secondary: { alignX: 'center', alignY: 'end', offsetX: 0, offsetY: -4 },
  },
}

/** 框内行位预设 */
export const LINE_LAYOUT_PRESETS: Array<{
  id: string
  label: string
  layouts: DesktopLyricsSettings['lineLayouts']
}> = [
  {
    id: 'stack-center',
    label: '居中叠放',
    layouts: {
      primary: { alignX: 'center', alignY: 'center', offsetX: 0, offsetY: -10 },
      secondary: { alignX: 'center', alignY: 'center', offsetX: 0, offsetY: 12 },
    },
  },
  {
    id: 'corners',
    label: '左上 + 右下',
    layouts: {
      primary: { alignX: 'start', alignY: 'start', offsetX: 4, offsetY: 4 },
      secondary: { alignX: 'end', alignY: 'end', offsetX: -4, offsetY: -4 },
    },
  },
  {
    id: 'left-right',
    label: '左 + 右',
    layouts: {
      primary: { alignX: 'start', alignY: 'center', offsetX: 4, offsetY: 0 },
      secondary: { alignX: 'end', alignY: 'center', offsetX: -4, offsetY: 0 },
    },
  },
  {
    id: 'top-bottom',
    label: '上 + 下',
    layouts: {
      primary: { alignX: 'center', alignY: 'start', offsetX: 0, offsetY: 6 },
      secondary: { alignX: 'center', alignY: 'end', offsetX: 0, offsetY: -6 },
    },
  },
]

/** 按语种分组的字体（含常见 Windows 中日韩与西文字体） */
export const LYRIC_FONT_GROUPS: Array<{
  lang: LyricLang
  label: string
  sample: string
  fonts: Array<{ value: string; label: string }>
}> = [
  {
    lang: 'zh',
    label: '中文',
    sample: '歌词样式',
    fonts: [
      { value: 'Microsoft YaHei', label: '微软雅黑' },
      { value: 'Microsoft YaHei UI', label: '微软雅黑 UI' },
      { value: 'SimHei', label: '黑体' },
      { value: 'SimSun', label: '宋体' },
      { value: 'NSimSun', label: '新宋体' },
      { value: 'KaiTi', label: '楷体' },
      { value: 'FangSong', label: '仿宋' },
      { value: 'DengXian', label: '等线' },
      { value: 'Microsoft JhengHei', label: '微软正黑体' },
      { value: 'MingLiU', label: '细明体' },
      { value: 'PMingLiU', label: '新细明体' },
      { value: 'Source Han Sans SC', label: '思源黑体 SC' },
      { value: 'Noto Sans SC', label: 'Noto Sans SC' },
    ],
  },
  {
    lang: 'ja',
    label: '日文',
    sample: '歌詞スタイル',
    fonts: [
      { value: 'Yu Gothic UI', label: '游ゴシック UI' },
      { value: 'Yu Gothic', label: '游ゴシック' },
      { value: 'Meiryo UI', label: 'メイリオ UI' },
      { value: 'Meiryo', label: 'メイリオ' },
      { value: 'MS Gothic', label: 'MS ゴシック' },
      { value: 'MS PGothic', label: 'MS Pゴシック' },
      { value: 'MS Mincho', label: 'MS 明朝' },
      { value: 'Yu Mincho', label: '游明朝' },
      { value: 'Source Han Sans', label: '思源黑体' },
      { value: 'Noto Sans JP', label: 'Noto Sans JP' },
    ],
  },
  {
    lang: 'en',
    label: '西文',
    sample: 'Lyrics',
    fonts: [
      { value: 'Segoe UI', label: 'Segoe UI' },
      { value: 'Arial', label: 'Arial' },
      { value: 'Calibri', label: 'Calibri' },
      { value: 'Candara', label: 'Candara' },
      { value: 'Georgia', label: 'Georgia' },
      { value: 'Times New Roman', label: 'Times New Roman' },
      { value: 'Trebuchet MS', label: 'Trebuchet MS' },
      { value: 'Verdana', label: 'Verdana' },
      { value: 'Tahoma', label: 'Tahoma' },
      { value: 'Consolas', label: 'Consolas' },
      { value: 'Courier New', label: 'Courier New' },
      { value: 'Comic Sans MS', label: 'Comic Sans MS' },
      { value: 'Impact', label: 'Impact' },
    ],
  },
  {
    lang: 'ko',
    label: '韩文',
    sample: '가사',
    fonts: [
      { value: 'Malgun Gothic', label: '맑은 고딕' },
      { value: 'Gulim', label: '굴림' },
      { value: 'Dotum', label: '돋움' },
      { value: 'Batang', label: '바탕' },
      { value: 'Gungsuh', label: '궁서' },
      { value: 'Noto Sans KR', label: 'Noto Sans KR' },
    ],
  },
]

/** 扁平列表（兼容旧测试 / 下拉） */
export const DESKTOP_LYRICS_FONTS = Array.from(
  new Set(LYRIC_FONT_GROUPS.flatMap((g) => g.fonts.map((f) => f.value))),
)

/** 根据歌词文本判断语种（假名→日；谚文→韩；汉字→中；否则西文） */
export function detectLyricLang(text: string): LyricLang {
  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(text)) return 'ja'
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return 'ko'
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) return 'zh'
  return 'en'
}

export function resolveLyricFont(
  settings: Pick<DesktopLyricsSettings, 'fontFamily' | 'fonts'>,
  text: string,
): string {
  const lang = detectLyricLang(text)
  const map = settings.fonts || DEFAULT_LYRIC_FONTS
  return map[lang] || settings.fontFamily || DEFAULT_LYRIC_FONTS[lang]
}

/** 当前句内跟唱进度 0~1（按当前句→下一句时间线性） */
export function karaokeLineProgress(
  lines: Array<{ timeMs: number }>,
  activeIndex: number,
  currentTimeSec: number,
  durationSec?: number,
): number {
  if (activeIndex < 0 || !lines[activeIndex]) return 0
  const t0 = lines[activeIndex].timeMs / 1000
  const t1 =
    lines[activeIndex + 1] != null
      ? lines[activeIndex + 1].timeMs / 1000
      : Math.max(t0 + 0.001, durationSec || t0 + 5)
  if (currentTimeSec <= t0) return 0
  if (currentTimeSec >= t1) return 1
  return (currentTimeSec - t0) / (t1 - t0)
}

/**
 * 长句视口平移量：让「当前进度位置」尽量落在视口中心；
 * 开头不往右空、结尾露全后不再右移（进度仍可继续走到 100%）。
 */
export function lyricScrollOffset(textWidth: number, viewWidth: number, progress: number): number {
  if (!(textWidth > 0) || !(viewWidth > 0) || textWidth <= viewWidth) return 0
  const maxScroll = textWidth - viewWidth
  const p = Math.min(1, Math.max(0, progress))
  const focus = textWidth * p
  const ideal = focus - viewWidth / 2
  return Math.min(maxScroll, Math.max(0, ideal))
}

export function mergeDesktopLyrics(
  partial?: Partial<DesktopLyricsSettings> | null,
): DesktopLyricsSettings {
  const p = partial || {}
  const fonts: DesktopLyricsFontMap = {
    ...DEFAULT_LYRIC_FONTS,
    ...(p.fonts || {}),
  }
  // 旧配置只有 fontFamily：补到中文位
  if (p.fontFamily && !p.fonts?.zh) fonts.zh = p.fontFamily
  const fontFamily = fonts.zh || p.fontFamily || DEFAULT_DESKTOP_LYRICS.fontFamily
  return {
    ...DEFAULT_DESKTOP_LYRICS,
    ...p,
    fonts,
    fontFamily,
    lineLayouts: {
      primary: { ...DEFAULT_DESKTOP_LYRICS.lineLayouts.primary, ...(p.lineLayouts?.primary || {}) },
      secondary: {
        ...DEFAULT_DESKTOP_LYRICS.lineLayouts.secondary,
        ...(p.lineLayouts?.secondary || {}),
      },
    },
    bounds: p.bounds === undefined ? DEFAULT_DESKTOP_LYRICS.bounds : p.bounds,
  }
}

/** 歌曲详情页歌词样式 */
export type PageLyricsSettings = {
  fontSize: number
  color: string
  activeColor: string
  fontFamily: string
  fonts: DesktopLyricsFontMap
  /** 详情页背景毛玻璃模糊半径（px），0=不模糊、实底遮罩 */
  bgBlur: number
  /** 当前句过长时按进度横向滚动（与桌面歌词同算法） */
  scrollLongLines: boolean
  /** 当前句已唱/未唱跟唱色 */
  karaoke: boolean
  sungColor: string
  unsungColor: string
}

export const DEFAULT_PAGE_LYRICS: PageLyricsSettings = {
  fontSize: 20,
  color: '#9aa8bd',
  activeColor: '#e8eef8',
  fontFamily: DEFAULT_LYRIC_FONTS.zh,
  fonts: { ...DEFAULT_LYRIC_FONTS },
  bgBlur: 12,
  scrollLongLines: true,
  karaoke: false,
  sungColor: '#2a9fd4',
  unsungColor: '#e8eef8',
}

export function mergePageLyrics(partial?: Partial<PageLyricsSettings> | null): PageLyricsSettings {
  const raw = (partial || {}) as Partial<PageLyricsSettings> & { opacity?: number }
  const { opacity: _legacyOpacity, ...p } = raw
  const fonts: DesktopLyricsFontMap = {
    ...DEFAULT_LYRIC_FONTS,
    ...(p.fonts || {}),
  }
  if (p.fontFamily && !p.fonts?.zh) fonts.zh = p.fontFamily
  const blurRaw = p.bgBlur != null ? Number(p.bgBlur) : DEFAULT_PAGE_LYRICS.bgBlur
  const bgBlur = Math.max(0, Math.min(40, Number.isFinite(blurRaw) ? blurRaw : DEFAULT_PAGE_LYRICS.bgBlur))
  return {
    ...DEFAULT_PAGE_LYRICS,
    ...p,
    fonts,
    fontFamily: fonts.zh || p.fontFamily || DEFAULT_PAGE_LYRICS.fontFamily,
    bgBlur,
  }
}

/** 桌面歌词 → 详情页：同步共用的字体/颜色/跟唱字段 */
export function pageLyricsFromDesktop(
  dl: DesktopLyricsSettings,
  prev?: Partial<PageLyricsSettings> | null,
): PageLyricsSettings {
  const keep = prev || {}
  return mergePageLyrics({
    ...keep,
    fontSize: dl.fontSize,
    color: dl.color,
    activeColor: dl.activeColor,
    fontFamily: dl.fontFamily,
    fonts: { ...dl.fonts },
    // 背景模糊是详情页专用，同步时保留
    bgBlur: keep.bgBlur ?? DEFAULT_PAGE_LYRICS.bgBlur,
    karaoke: dl.karaoke !== false,
    sungColor: dl.sungColor,
    unsungColor: dl.unsungColor,
    scrollLongLines: keep.scrollLongLines ?? DEFAULT_PAGE_LYRICS.scrollLongLines,
  })
}

/** 详情页 → 桌面歌词：只覆盖共用样式，保留窗口/行位等桌面专用项 */
export function desktopLyricsFromPage(
  dl: DesktopLyricsSettings,
  pl: PageLyricsSettings,
): DesktopLyricsSettings {
  return mergeDesktopLyrics({
    ...dl,
    fontSize: pl.fontSize,
    color: pl.color,
    activeColor: pl.activeColor,
    fontFamily: pl.fontFamily,
    fonts: { ...pl.fonts },
    karaoke: pl.karaoke,
    sungColor: pl.sungColor,
    unsungColor: pl.unsungColor,
  })
}
