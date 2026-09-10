import { describe, expect, it } from 'vitest'
import {
  actionsInHotkeyMap,
  GLOBAL_HOTKEY_MAP,
  hasUniqueAccelerators,
} from '../src/core/hotkey-map'
import {
  DEFAULT_DESKTOP_LYRICS,
  DESKTOP_LYRICS_FONTS,
  LYRIC_FONT_GROUPS,
  detectLyricLang,
  desktopLyricsFromPage,
  lyricScrollOffset,
  mergeDesktopLyrics,
  pageLyricsFromDesktop,
  resolveLyricFont,
  type DesktopLyricsSettings,
} from '../src/core/desktop-lyrics'
import { DEFAULT_THEME } from '../src/core/library-model'
import { mergeTitleDisplay, resolveTrackTitles } from '../src/core/title-display'

describe('desktop lyrics defaults', () => {
  it('DEFAULT_THEME embeds DEFAULT_DESKTOP_LYRICS', () => {
    expect(DEFAULT_THEME.desktopLyrics).toEqual(DEFAULT_DESKTOP_LYRICS)
    expect(DEFAULT_DESKTOP_LYRICS.visible).toBe(false)
    expect(DEFAULT_DESKTOP_LYRICS.lineCount).toBe(2)
    expect(DEFAULT_DESKTOP_LYRICS.fonts.zh).toBeTruthy()
  })

  it('merges partial settings like theme load', () => {
    const raw: Partial<DesktopLyricsSettings> = {
      visible: true,
      fontSize: 36,
      orientation: 'vertical',
    }
    const merged = mergeDesktopLyrics(raw)
    expect(merged.visible).toBe(true)
    expect(merged.fontSize).toBe(36)
    expect(merged.orientation).toBe('vertical')
    expect(merged.fontFamily).toBe(DEFAULT_DESKTOP_LYRICS.fontFamily)
    expect(merged.fonts.ja).toBe(DEFAULT_DESKTOP_LYRICS.fonts.ja)
    expect(merged.lineCount).toBe(2)
  })

  it('font list is non-empty unique strings with zh group', () => {
    expect(DESKTOP_LYRICS_FONTS.length).toBeGreaterThan(20)
    expect(new Set(DESKTOP_LYRICS_FONTS).size).toBe(DESKTOP_LYRICS_FONTS.length)
    const zh = LYRIC_FONT_GROUPS.find((g) => g.lang === 'zh')
    expect(zh?.fonts.some((f) => f.value.includes('YaHei') || f.label.includes('雅黑'))).toBe(true)
  })

  it('detects lyric language and resolves font', () => {
    expect(detectLyricLang('こんにちは')).toBe('ja')
    expect(detectLyricLang('안녕하세요')).toBe('ko')
    expect(detectLyricLang('你好世界')).toBe('zh')
    expect(detectLyricLang('Hello')).toBe('en')
    const s = mergeDesktopLyrics({
      fonts: { zh: 'KaiTi', ja: 'Meiryo', en: 'Arial', ko: 'Gulim' },
    })
    expect(resolveLyricFont(s, '楷体测试')).toBe('KaiTi')
    expect(resolveLyricFont(s, 'カタカナ')).toBe('Meiryo')
    expect(resolveLyricFont(s, 'ABC')).toBe('Arial')
  })

  it('scrolls long lyric with progress centered and clamps at ends', () => {
    expect(lyricScrollOffset(100, 200, 0.5)).toBe(0)
    expect(lyricScrollOffset(400, 200, 0)).toBe(0)
    expect(lyricScrollOffset(400, 200, 0.5)).toBe(100)
    expect(lyricScrollOffset(400, 200, 1)).toBe(200)
    expect(lyricScrollOffset(400, 200, 0.9)).toBe(200)
  })

  it('syncs shared style fields between desktop and page lyrics', () => {
    const dl = mergeDesktopLyrics({
      fontSize: 33,
      color: '#112233',
      activeColor: '#aabbcc',
      fonts: { zh: 'KaiTi', ja: 'Meiryo', en: 'Arial', ko: 'Gulim' },
      karaoke: true,
      sungColor: '#111111',
      unsungColor: '#eeeeee',
    })
    const page = pageLyricsFromDesktop(dl, { scrollLongLines: false })
    expect(page.fontSize).toBe(33)
    expect(page.color).toBe('#112233')
    expect(page.activeColor).toBe('#aabbcc')
    expect(page.fonts.ja).toBe('Meiryo')
    expect(page.karaoke).toBe(true)
    expect(page.sungColor).toBe('#111111')
    expect(page.scrollLongLines).toBe(false)
    expect(page.bgBlur).toBe(12)

    const back = desktopLyricsFromPage(
      mergeDesktopLyrics({ visible: true, bounds: { x: 1, y: 2, width: 3, height: 4 }, opacity: 0.7 }),
      page,
    )
    expect(back.visible).toBe(true)
    expect(back.bounds).toEqual({ x: 1, y: 2, width: 3, height: 4 })
    expect(back.fontSize).toBe(33)
    expect(back.color).toBe('#112233')
    expect(back.karaoke).toBe(true)
    expect(back.opacity).toBe(0.7)
  })
})

describe('global hotkey map', () => {
  it('covers play / seek / volume / desktop lyrics', () => {
    const actions = new Set(actionsInHotkeyMap())
    for (const a of [
      'toggle-play',
      'prev',
      'next',
      'vol-up',
      'vol-down',
      'seek-back',
      'seek-fwd',
      'toggle-desktop-lyrics',
      'toggle-desktop-lyrics-lock',
    ] as const) {
      expect(actions.has(a)).toBe(true)
    }
    expect(GLOBAL_HOTKEY_MAP.length).toBe(9)
  })

  it('accelerators are unique and use Ctrl+Alt', () => {
    expect(hasUniqueAccelerators()).toBe(true)
    for (const b of GLOBAL_HOTKEY_MAP) {
      expect(b.accel.startsWith('CommandOrControl+Alt+')).toBe(true)
    }
  })
})

describe('title display', () => {
  it('prefers zh then ja then en and hides unchecked aliases', () => {
    const resolved = resolveTrackTitles({
      titleZh: '中文名',
      titleJa: 'なまえ',
      titleEn: 'English Name',
      titleDisplay: mergeTitleDisplay({
        primary: 'auto',
        show: { zh: false, ja: true, en: false },
      }),
    })
    expect(resolved.primary).toBe('中文名')
    expect(resolved.aliases).toEqual([{ lang: 'ja', tag: 'JP', text: 'なまえ' }])
  })
})
