import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  DEFAULT_THEME,
  type Category,
  type LyricsMap,
  type MusicRoot,
  type ThemeSettings,
  type TrackRecord,
  resolveBackgroundsDir,
  resolveCategoriesPath,
  resolveGainsPath,
  resolveHotkeysPath,
  resolveLyricsMapPath,
  resolveLyricsRootPath,
  resolveRootsPath,
  resolveThemePath,
  resolveTracksPath,
  libraryDataDirs,
  mergeDesktopLyrics,
  mergePageLyrics,
} from '../core/library'
import { fromRelativeToRoot, toRelativeIfUnderRoot } from '../core/app-paths'
import { DEFAULT_HOTKEY_BINDINGS, mergeHotkeyBindings, type HotkeyBinding } from '../core/hotkey-config'

/** exe/项目根：音乐根、歌词等相对路径基准 */
let pathAppRoot = ''

export function setPathAppRoot(appRoot: string) {
  pathAppRoot = appRoot
}

export function getPathAppRoot() {
  return pathAppRoot || process.cwd()
}

function musicBase() {
  return getPathAppRoot()
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback
    return { ...(fallback as object), ...JSON.parse(fs.readFileSync(file, 'utf8')) } as T
  } catch {
    return fallback
  }
}

function readJsonArray<T>(file: string): T[] {
  try {
    if (!fs.existsSync(file)) return []
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

/** 参数均为 qmdata 根目录 */
export function ensureLibraryLayout(dataDir: string) {
  for (const d of libraryDataDirs(dataDir)) {
    fs.mkdirSync(d, { recursive: true })
  }
  const roots = resolveRootsPath(dataDir)
  const tracks = resolveTracksPath(dataDir)
  const lyrics = resolveLyricsMapPath(dataDir)
  const lyricsRoot = resolveLyricsRootPath(dataDir)
  const cats = resolveCategoriesPath(dataDir)
  const theme = resolveThemePath(dataDir)
  if (!fs.existsSync(roots)) writeJson(roots, [])
  if (!fs.existsSync(tracks)) writeJson(tracks, [])
  if (!fs.existsSync(lyrics)) writeJson(lyrics, {})
  if (!fs.existsSync(lyricsRoot)) writeJson(lyricsRoot, { path: null })
  if (!fs.existsSync(cats)) writeJson(cats, [])
  if (!fs.existsSync(theme)) writeJson(theme, DEFAULT_THEME)
  const gains = resolveGainsPath(dataDir)
  if (!fs.existsSync(gains)) writeJson(gains, {})
  const hotkeys = resolveHotkeysPath(dataDir)
  if (!fs.existsSync(hotkeys)) writeJson(hotkeys, { bindings: DEFAULT_HOTKEY_BINDINGS })
}

export function loadGains(appRoot: string): Record<string, number> {
  return readJson<Record<string, number>>(resolveGainsPath(appRoot), {})
}

export function saveGains(appRoot: string, gains: Record<string, number>) {
  writeJson(resolveGainsPath(appRoot), gains)
}

export function loadTheme(appRoot: string): ThemeSettings {
  const raw = readJson<
    Partial<ThemeSettings> & {
      desktopLyrics?: Partial<ThemeSettings['desktopLyrics']>
      pageLyrics?: Partial<ThemeSettings['pageLyrics']>
    }
  >(resolveThemePath(appRoot), {})
  return {
    ...DEFAULT_THEME,
    ...raw,
    desktopLyrics: mergeDesktopLyrics(raw.desktopLyrics),
    pageLyrics: mergePageLyrics(raw.pageLyrics),
  }
}

export function saveTheme(appRoot: string, theme: ThemeSettings) {
  writeJson(resolveThemePath(appRoot), {
    ...theme,
    desktopLyrics: mergeDesktopLyrics(theme.desktopLyrics),
    pageLyrics: mergePageLyrics(theme.pageLyrics),
  })
}

export function loadHotkeys(appRoot: string): HotkeyBinding[] {
  const raw = readJson<{ bindings?: HotkeyBinding[] }>(resolveHotkeysPath(appRoot), {})
  return mergeHotkeyBindings(raw.bindings)
}

export function saveHotkeys(appRoot: string, bindings: HotkeyBinding[]) {
  writeJson(resolveHotkeysPath(appRoot), { bindings: mergeHotkeyBindings(bindings) })
}

export function loadRoots(appRoot: string): MusicRoot[] {
  return readJsonArray<MusicRoot>(resolveRootsPath(appRoot))
}

export function saveRoots(appRoot: string, roots: MusicRoot[]) {
  writeJson(resolveRootsPath(appRoot), roots)
}

export function loadTracks(appRoot: string): TrackRecord[] {
  return readJsonArray<TrackRecord>(resolveTracksPath(appRoot))
}

export function saveTracks(appRoot: string, tracks: TrackRecord[]) {
  writeJson(resolveTracksPath(appRoot), tracks)
}

export function loadLyricsMap(appRoot: string): LyricsMap {
  return readJson<LyricsMap>(resolveLyricsMapPath(appRoot), {})
}

export function saveLyricsMap(appRoot: string, map: LyricsMap) {
  writeJson(resolveLyricsMapPath(appRoot), map)
}

export type LyricsRootSettings = { path: string | null }

export function loadLyricsRoot(appRoot: string): LyricsRootSettings {
  return readJson<LyricsRootSettings>(resolveLyricsRootPath(appRoot), { path: null })
}

export function saveLyricsRoot(appRoot: string, settings: LyricsRootSettings) {
  writeJson(resolveLyricsRootPath(appRoot), settings)
}

/** 歌词根绝对路径；未设置返回 null */
export function resolveLyricsRootAbsolute(dataDir: string): string | null {
  const { path: p } = loadLyricsRoot(dataDir)
  if (!p) return null
  return fromRelativeToRoot(musicBase(), p)
}

/** 在歌词根目录下按音频主文件名定位 .lrc */
export function lyricsPathInRoot(lyricsRootAbs: string, audioAbs: string): string {
  const base = path.parse(audioAbs).name
  return path.join(lyricsRootAbs, `${base}.lrc`)
}

export function loadCategories(appRoot: string): Category[] {
  return readJsonArray<Category>(resolveCategoriesPath(appRoot))
}

export function saveCategories(appRoot: string, cats: Category[]) {
  writeJson(resolveCategoriesPath(appRoot), cats)
}

export function addMusicRoot(
  dataDir: string,
  absPath: string,
  label?: string,
): MusicRoot[] {
  const roots = loadRoots(dataDir)
  const base = musicBase()
  const stored = toRelativeIfUnderRoot(base, path.resolve(absPath))
  if (roots.some((r) => path.resolve(fromRelativeToRoot(base, r.path)) === path.resolve(absPath))) {
    return roots
  }
  roots.push({
    id: randomUUID(),
    path: stored,
    label: label || path.basename(absPath) || 'Music',
    addedAt: new Date().toISOString(),
  })
  saveRoots(dataDir, roots)
  return roots
}

export function removeMusicRoot(dataDir: string, rootId: string): MusicRoot[] {
  const roots = loadRoots(dataDir).filter((r) => r.id !== rootId)
  saveRoots(dataDir, roots)
  const tracks = loadTracks(dataDir).filter((t) => t.rootId !== rootId)
  saveTracks(dataDir, tracks)
  return roots
}

export function resolveRootAbsolute(_dataDir: string, root: MusicRoot): string {
  return fromRelativeToRoot(musicBase(), root.path)
}

export function absoluteTrackPath(dataDir: string, root: MusicRoot, track: TrackRecord): string {
  return path.join(resolveRootAbsolute(dataDir, root), track.pathRel)
}

export function resolveLyricsAbsolute(_dataDir: string, lyricsRel: string | null): string | null {
  if (!lyricsRel) return null
  return fromRelativeToRoot(musicBase(), lyricsRel)
}

/** 复制背景图到 qmdata/backgrounds，返回相对 qmdata 的路径 */
export function importBackgroundImage(dataDir: string, sourceAbs: string): string {
  const dir = resolveBackgroundsDir(dataDir)
  fs.mkdirSync(dir, { recursive: true })
  const ext = path.extname(sourceAbs) || '.jpg'
  const name = `bg-${Date.now()}${ext}`
  const dest = path.join(dir, name)
  fs.copyFileSync(sourceAbs, dest)
  return toRelativeIfUnderRoot(dataDir, dest)
}

export function backgroundFileUrl(dataDir: string, bgImageRel: string | null): string | null {
  if (!bgImageRel) return null
  let abs = fromRelativeToRoot(dataDir, bgImageRel)
  if (!fs.existsSync(abs)) {
    // 旧版相对程序根 / data/ 的路径
    abs = fromRelativeToRoot(musicBase(), bgImageRel)
  }
  if (!fs.existsSync(abs)) return null
  return abs
}
