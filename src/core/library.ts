import { appJoin, resolveDataDir } from './app-paths'

export type {
  Category,
  LyricsMap,
  MusicRoot,
  ThemeSettings,
  TrackRecord,
  TitleDisplaySettings,
} from './library-model'

export {
  DEFAULT_THEME,
  displayTitle,
  fileBaseName,
  filterByCategory,
  makeTrackId,
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

export function resolveThemePath(appRoot: string) {
  return appJoin(appRoot, 'data', 'theme.json')
}

export function resolveHotkeysPath(appRoot: string) {
  return appJoin(appRoot, 'data', 'hotkeys.json')
}

export function resolveLibraryDir(appRoot: string) {
  return appJoin(appRoot, 'data', 'library')
}

export function resolveRootsPath(appRoot: string) {
  return appJoin(appRoot, 'data', 'library', 'roots.json')
}

export function resolveTracksPath(appRoot: string) {
  return appJoin(appRoot, 'data', 'library', 'tracks.json')
}

export function resolveLyricsMapPath(appRoot: string) {
  return appJoin(appRoot, 'data', 'library', 'lyrics-map.json')
}

/** 统一歌词目录（与音乐根类似，相对 AppRoot 或绝对路径） */
export function resolveLyricsRootPath(appRoot: string) {
  return appJoin(appRoot, 'data', 'library', 'lyrics-root.json')
}

export function resolveCategoriesPath(appRoot: string) {
  return appJoin(appRoot, 'data', 'library', 'categories.json')
}

export function resolveGainsPath(appRoot: string) {
  return appJoin(appRoot, 'data', 'library', 'gains.json')
}

export function resolveBackgroundsDir(appRoot: string) {
  return appJoin(appRoot, 'data', 'backgrounds')
}

export function libraryDataDirs(appRoot: string): string[] {
  return [resolveDataDir(appRoot), resolveLibraryDir(appRoot), resolveBackgroundsDir(appRoot)]
}
