import { appJoin, resolveDataDir } from './app-paths'
import path from 'node:path'

export type {
  BgRotateSettings,
  Category,
  LyricsMap,
  MusicRoot,
  ThemeSettings,
  TrackRecord,
  TitleDisplaySettings,
} from './library-model'

export {
  DEFAULT_BG_ROTATE,
  DEFAULT_THEME,
  displayTitle,
  fileBaseName,
  filterByCategory,
  makeTrackId,
  mergeBgRotate,
  mergeTrackLists,
  mergeDesktopLyrics,
  mergePageLyrics,
  mergeTitleDisplay,
  resolvePrimaryTitle,
  resolveTrackTitles,
  DEFAULT_TITLE_DISPLAY,
  TITLE_LANG_LABEL,
  TITLE_LANG_ORDER,
  TITLE_LANG_TAG,
} from './library-model'

/** 下列路径均相对 qmdata 根目录（参数名 dataDir） */

export function resolveThemePath(dataDir: string) {
  return path.join(dataDir, 'theme.json')
}

export function resolveHotkeysPath(dataDir: string) {
  return path.join(dataDir, 'hotkeys.json')
}

export function resolveLibraryDir(dataDir: string) {
  return path.join(dataDir, 'library')
}

export function resolveRootsPath(dataDir: string) {
  return path.join(dataDir, 'library', 'roots.json')
}

export function resolveTracksPath(dataDir: string) {
  return path.join(dataDir, 'library', 'tracks.json')
}

export function resolveLyricsMapPath(dataDir: string) {
  return path.join(dataDir, 'library', 'lyrics-map.json')
}

/** 统一歌词目录配置文件 */
export function resolveLyricsRootPath(dataDir: string) {
  return path.join(dataDir, 'library', 'lyrics-root.json')
}

export function resolveCategoriesPath(dataDir: string) {
  return path.join(dataDir, 'library', 'categories.json')
}

export function resolveGainsPath(dataDir: string) {
  return path.join(dataDir, 'library', 'gains.json')
}

/** 歌词工作台自定义标签（仅工作台可见） */
export function resolveWorkbenchTagsPath(dataDir: string) {
  return path.join(dataDir, 'library', 'workbench-tags.json')
}

export function resolveBackgroundsDir(dataDir: string) {
  return path.join(dataDir, 'backgrounds')
}

/** 背景轮换图片池（相对 qmdata） */
export function resolveBgRotateDir(dataDir: string) {
  return path.join(dataDir, 'bg-rotate')
}

export function libraryDataDirs(dataDir: string): string[] {
  return [
    dataDir,
    resolveLibraryDir(dataDir),
    resolveBackgroundsDir(dataDir),
    resolveBgRotateDir(dataDir),
  ]
}

/** @deprecated 兼容旧测试引用 */
export function resolveLegacyDataDir(appRoot: string) {
  return resolveDataDir(appRoot)
}

void appJoin
