import type { DesktopLyricsSettings, PageLyricsSettings } from '../core/desktop-lyrics'
import type { TitleDisplaySettings } from '../core/title-display'

export type { DesktopLyricsSettings, PageLyricsSettings, TitleDisplaySettings }

export type Track = {
  id: string
  path: string
  title: string
  titleZh?: string
  titleEn?: string
  titleJa?: string
  artist: string
  album: string
  duration: number
  fileUrl: string
  categoryIds?: string[]
  lyricsRel?: string | null
  rootId?: string
  pathRel?: string
  titleDisplay?: TitleDisplaySettings
}

export type PlayMode = 'sequence' | 'loop' | 'single' | 'shuffle'

export type ThemeSettings = {
  mode: 'dark' | 'light'
  accent: string
  panelOpacity: number
  lowOpacityTextStroke: boolean
  bgStyle: 'gradient' | 'flat' | 'image'
  flatColor: string
  bgImageRel: string | null
  desktopLyrics: DesktopLyricsSettings
  pageLyrics: PageLyricsSettings
}

export type MusicRoot = { id: string; path: string; label: string; addedAt: string }
export type Category = { id: string; name: string }

export type ThemePayload = { theme: ThemeSettings; bgImageUrl: string | null }
export type LibraryPayload = {
  roots: MusicRoot[]
  tracks: unknown[]
  categories: Category[]
  playable: Track[]
  gains?: Record<string, number>
  lyricsRoot?: { path: string | null }
  lyricsRootAbs?: string | null
  updated?: number
  skipped?: number
  total?: number
}

export type QMusicApi = {
  openFiles: () => Promise<Track[]>
  openDirectory: () => Promise<Track[]>
  windowMinimize: () => Promise<void>
  windowToggleMaximize: () => Promise<boolean>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  windowDragStart: () => void
  windowDragEnd: () => void
  onChromeRefresh: (cb: () => void) => () => void
  onThemeChanged: (cb: (payload: ThemePayload) => void) => () => void
  getInitInfo: () => Promise<{
    appRoot: string
    dataDir: string
    firstRun: boolean
    packaged: boolean
    config?: {
      playMode?: PlayMode
      version?: number
      initializedAt?: string
      importTargetRootId?: string | null
      allowMultiInstance?: boolean
    }
  }>
  getPlayMode: () => Promise<PlayMode>
  setPlayMode: (mode: PlayMode) => Promise<PlayMode>
  getAllowMultiInstance: () => Promise<boolean>
  setAllowMultiInstance: (allow: boolean) => Promise<{ allowMultiInstance: boolean }>
  getTheme: () => Promise<ThemePayload>
  setTheme: (theme: ThemeSettings) => Promise<ThemePayload>
  pickBackground: () => Promise<ThemePayload>
  getLibrary: () => Promise<LibraryPayload>
  addMusicRoot: () => Promise<LibraryPayload>
  removeMusicRoot: (rootId: string) => Promise<LibraryPayload>
  rescanLibrary: () => Promise<LibraryPayload>
  updateTrack: (patch: Record<string, unknown> & { id: string }) => Promise<LibraryPayload>
  addCategory: (name: string) => Promise<LibraryPayload>
  setCategories: (cats: Category[]) => Promise<LibraryPayload>
  applyFilenameMeta: () => Promise<LibraryPayload & { updated?: number; skipped?: number; total?: number }>
  applyFilenameMetaForce: () => Promise<LibraryPayload & { updated?: number; total?: number }>
  importAudio: (payload: {
    sourcePath: string
    rootId: string
    artist: string
    titleZh: string
    titleEn: string
    titleJa: string
  }) => Promise<{ ok: boolean; error?: string; trackId?: string; library: LibraryPayload }>
  getImportTarget: () => Promise<{ importTargetRootId: string | null; roots: MusicRoot[] }>
  setImportTarget: (rootId: string | null) => Promise<{ importTargetRootId: string | null }>
  getPathForFile: (file: File) => string
  renameTrack: (payload: {
    id: string
    artist: string
    titleZh: string
    titleEn: string
    titleJa: string
  }) => Promise<{
    ok: boolean
    error?: string
    oldId?: string
    trackId?: string
    library: LibraryPayload
  }>
  getGains: () => Promise<Record<string, number>>
  setGains: (gains: Record<string, number>) => Promise<Record<string, number>>
  loadSiblingLyrics: (audioPath: string) => Promise<{ path: string | null; content: string | null }>
  openLyricsFile: () => Promise<{ path: string; content: string } | null>
  bindLyricsToTrack: (
    trackId: string,
  ) => Promise<{ path: string; content: string; lyricsRel: string; library: LibraryPayload } | null>
  loadLyricsForTrack: (trackId: string) => Promise<{ path: string | null; content: string | null }>
  searchLyrics: (opts: {
    title?: string
    artist?: string
    q?: string
    track?: {
      title?: string
      titleZh?: string
      titleEn?: string
      titleJa?: string
      artist?: string
      pathRel?: string
    }
  }) => Promise<{
    hits: Array<{
      id: number | string
      title: string
      artist: string
      album: string
      duration: number
      syncedLyrics: string | null
      plainLyrics: string | null
      source: string
    }>
    attemptsUsed: number
    lastLabel?: string
  }>
  saveLyricsToTrack: (
    trackId: string,
    content: string,
  ) => Promise<
    | { ok: true; path: string; lyricsRel: string; library: LibraryPayload }
    | { ok: false; error: string }
  >
  getLyricsRoot: () => Promise<{ path: string | null; absPath: string | null }>
  pickLyricsRoot: () => Promise<{
    path: string | null
    absPath: string | null
    library: LibraryPayload
  }>
  clearLyricsRoot: () => Promise<{
    path: string | null
    absPath: string | null
    library: LibraryPayload
  }>
  setDesktopLyricsVisible: (visible: boolean) => Promise<{ visible: boolean }>
  pushDesktopLyrics: (payload: {
    lines?: Array<{ timeMs: number; text: string }>
    currentTime?: number
    duration?: number
    title?: string
    artist?: string
    settings?: DesktopLyricsSettings
    playing?: boolean
  }) => Promise<void>
  onDesktopLyricsPayload: (
    cb: (payload: {
      settings: DesktopLyricsSettings
      lines: Array<{ timeMs: number; text: string }>
      currentTime: number
      duration?: number
      title?: string
      artist?: string
      playing?: boolean
    }) => void,
  ) => () => void
  onHotkeyAction: (
    cb: (
      action:
        | 'toggle-play'
        | 'prev'
        | 'next'
        | 'vol-up'
        | 'vol-down'
        | 'seek-back'
        | 'seek-fwd'
        | 'toggle-desktop-lyrics'
        | 'toggle-desktop-lyrics-lock',
    ) => void,
  ) => () => void
  getHotkeys: () => Promise<
    Array<{ action: string; global: string; inApp: string }>
  >
  setHotkeys: (
    bindings: Array<{ action: string; global: string; inApp: string }>,
  ) => Promise<Array<{ action: string; global: string; inApp: string }>>
  ffmpegAvailable: () => Promise<boolean>
  trimExport: (payload: {
    inputPath: string
    startSec: number
    endSec: number
    outputPath?: string
  }) => Promise<{ ok: true; outputPath: string; track: Track } | { ok: false; error: string }>
}

declare global {
  interface Window {
    qmusic: QMusicApi
  }
}

export {}
