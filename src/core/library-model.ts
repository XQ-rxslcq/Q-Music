/** 浏览器与主进程共用的曲库模型（禁止依赖 node:path） */

import type { DesktopLyricsSettings, PageLyricsSettings } from './desktop-lyrics'
import {
  DEFAULT_DESKTOP_LYRICS,
  DEFAULT_PAGE_LYRICS,
  mergeDesktopLyrics,
  mergePageLyrics,
} from './desktop-lyrics'
import {
  mergeTitleDisplay,
  resolvePrimaryTitle,
  type TitleDisplaySettings,
} from './title-display'

export type { DesktopLyricsSettings, PageLyricsSettings } from './desktop-lyrics'
export type { TitleDisplaySettings, TitleLang } from './title-display'
export {
  DEFAULT_DESKTOP_LYRICS,
  DEFAULT_PAGE_LYRICS,
  DESKTOP_LYRICS_FONTS,
  LYRIC_FONT_GROUPS,
  LINE_LAYOUT_PRESETS,
  mergeDesktopLyrics,
  mergePageLyrics,
  detectLyricLang,
  resolveLyricFont,
} from './desktop-lyrics'
export {
  DEFAULT_TITLE_DISPLAY,
  TITLE_LANG_LABEL,
  TITLE_LANG_ORDER,
  TITLE_LANG_TAG,
  mergeTitleDisplay,
  resolvePrimaryTitle,
  resolveTrackTitles,
} from './title-display'

export type MusicRoot = {
  id: string
  path: string
  label: string
  addedAt: string
}

export type Category = {
  id: string
  name: string
}

export type TrackRecord = {
  id: string
  rootId: string
  pathRel: string
  titleZh: string
  titleEn: string
  titleJa: string
  artist: string
  album: string
  duration: number
  categoryIds: string[]
  lyricsRel: string | null
  addedAt: string
  /** 列表主标题 / 副标题显隐 */
  titleDisplay?: TitleDisplaySettings
}

export type LyricsMap = Record<string, string>

export type ThemeSettings = {
  mode: 'dark' | 'light'
  accent: string
  panelOpacity: number
  /** 面板不透明度低于 40% 时，为信息文字加反色描边 */
  lowOpacityTextStroke: boolean
  bgStyle: 'gradient' | 'flat' | 'image'
  flatColor: string
  bgImageRel: string | null
  desktopLyrics: DesktopLyricsSettings
  pageLyrics: PageLyricsSettings
}

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'dark',
  accent: '#3d9cf0',
  panelOpacity: 0.78,
  lowOpacityTextStroke: true,
  bgStyle: 'gradient',
  flatColor: '#141820',
  bgImageRel: null,
  desktopLyrics: mergeDesktopLyrics(DEFAULT_DESKTOP_LYRICS),
  pageLyrics: mergePageLyrics(DEFAULT_PAGE_LYRICS),
}

export function fileBaseName(pathRel: string): string {
  const s = pathRel.replace(/\\/g, '/')
  const name = s.split('/').pop() || s
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

export function displayTitle(
  t: Pick<TrackRecord, 'titleZh' | 'titleEn' | 'titleJa' | 'pathRel' | 'titleDisplay'>,
): string {
  return resolvePrimaryTitle(t)
}

export function makeTrackId(rootId: string, pathRel: string): string {
  const norm = pathRel.replace(/\\/g, '/').toLowerCase()
  return `${rootId}::${norm}`
}

export function mergeTrackLists(existing: TrackRecord[], incoming: TrackRecord[]): TrackRecord[] {
  const map = new Map(existing.map((t) => [t.id, t]))
  for (const t of incoming) {
    const prev = map.get(t.id)
    if (!prev) {
      map.set(t.id, t)
      continue
    }
    map.set(t.id, {
      ...prev,
      ...t,
      titleZh: t.titleZh || prev.titleZh,
      titleEn: t.titleEn || prev.titleEn,
      titleJa: t.titleJa || prev.titleJa,
      lyricsRel: t.lyricsRel ?? prev.lyricsRel,
      categoryIds: Array.from(new Set([...prev.categoryIds, ...t.categoryIds])),
      // 扫描入库不带显示偏好时保留原配置
      titleDisplay: mergeTitleDisplay(prev.titleDisplay || t.titleDisplay),
    })
  }
  return [...map.values()]
}

export function filterByCategory(tracks: TrackRecord[], categoryId: string | null): TrackRecord[] {
  if (!categoryId) return tracks
  if (categoryId === '__uncategorized') return tracks.filter((t) => !t.categoryIds.length)
  return tracks.filter((t) => t.categoryIds.includes(categoryId))
}
