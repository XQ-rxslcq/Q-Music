import { contextBridge, ipcRenderer, webUtils } from 'electron'

export type TrackInfo = {
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
  titleDisplay?: {
    primary?: 'auto' | 'zh' | 'ja' | 'en'
    show?: {
      zh?: boolean
      ja?: boolean
      en?: boolean
    }
  }
}

const api = {
  openFiles: (): Promise<TrackInfo[]> => ipcRenderer.invoke('dialog:openFiles'),
  openDirectory: (): Promise<TrackInfo[]> => ipcRenderer.invoke('dialog:openDirectory'),
  windowMinimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  windowToggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('window:toggleMaximize'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('window:close'),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  windowDragStart: (): void => {
    ipcRenderer.send('window:drag-start')
  },
  windowDragEnd: (): void => {
    ipcRenderer.send('window:drag-end')
  },
  onChromeRefresh: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('window:chrome-refresh', handler)
    return () => ipcRenderer.removeListener('window:chrome-refresh', handler)
  },
  onThemeChanged: (cb: (payload: unknown) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: unknown) => cb(payload)
    ipcRenderer.on('theme:changed', handler)
    return () => ipcRenderer.removeListener('theme:changed', handler)
  },
  getInitInfo: () => ipcRenderer.invoke('app:getInitInfo'),
  getPlayMode: () => ipcRenderer.invoke('player:getPlayMode'),
  setPlayMode: (mode: string) => ipcRenderer.invoke('player:setPlayMode', mode),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: (theme: unknown) => ipcRenderer.invoke('theme:set', theme),
  pickBackground: () => ipcRenderer.invoke('theme:pickBackground'),
  getLibrary: () => ipcRenderer.invoke('library:get'),
  addMusicRoot: () => ipcRenderer.invoke('library:addRoot'),
  removeMusicRoot: (rootId: string) => ipcRenderer.invoke('library:removeRoot', rootId),
  rescanLibrary: () => ipcRenderer.invoke('library:rescan'),
  updateTrack: (patch: unknown) => ipcRenderer.invoke('library:updateTrack', patch),
  addCategory: (name: string) => ipcRenderer.invoke('library:addCategory', name),
  setCategories: (cats: unknown) => ipcRenderer.invoke('library:setCategories', cats),
  applyFilenameMeta: () => ipcRenderer.invoke('library:applyFilenameMeta'),
  applyFilenameMetaForce: () => ipcRenderer.invoke('library:applyFilenameMetaForce'),
  importAudio: (payload: unknown) => ipcRenderer.invoke('library:importAudio', payload),
  getImportTarget: () => ipcRenderer.invoke('config:getImportTarget'),
  setImportTarget: (rootId: string | null) => ipcRenderer.invoke('config:setImportTarget', rootId),
  getAllowMultiInstance: () => ipcRenderer.invoke('config:getAllowMultiInstance'),
  setAllowMultiInstance: (allow: boolean) => ipcRenderer.invoke('config:setAllowMultiInstance', allow),
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return (file as File & { path?: string }).path || ''
    }
  },
  renameTrack: (payload: unknown) => ipcRenderer.invoke('library:renameTrack', payload),
  getGains: () => ipcRenderer.invoke('library:getGains'),
  setGains: (gains: Record<string, number>) => ipcRenderer.invoke('library:setGains', gains),
  loadSiblingLyrics: (audioPath: string) => ipcRenderer.invoke('lyrics:loadSibling', audioPath),
  openLyricsFile: () => ipcRenderer.invoke('lyrics:openFile'),
  bindLyricsToTrack: (trackId: string) => ipcRenderer.invoke('lyrics:bindToTrack', trackId),
  loadLyricsForTrack: (trackId: string) => ipcRenderer.invoke('lyrics:loadForTrack', trackId),
  searchLyrics: (opts: { title?: string; artist?: string; q?: string; track?: unknown }) =>
    ipcRenderer.invoke('lyrics:search', opts),
  saveLyricsToTrack: (trackId: string, content: string) =>
    ipcRenderer.invoke('lyrics:saveToTrack', trackId, content),
  getLyricsRoot: () => ipcRenderer.invoke('lyrics:getRoot'),
  pickLyricsRoot: () => ipcRenderer.invoke('lyrics:pickRoot'),
  clearLyricsRoot: () => ipcRenderer.invoke('lyrics:clearRoot'),
  setDesktopLyricsVisible: (visible: boolean) =>
    ipcRenderer.invoke('desktop-lyrics:setVisible', visible),
  pushDesktopLyrics: (payload: unknown) => ipcRenderer.invoke('desktop-lyrics:push', payload),
  onDesktopLyricsPayload: (cb: (payload: unknown) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: unknown) => cb(payload)
    ipcRenderer.on('desktop-lyrics:payload', handler)
    return () => ipcRenderer.removeListener('desktop-lyrics:payload', handler)
  },
  onHotkeyAction: (cb: (action: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, action: string) => cb(action)
    ipcRenderer.on('hotkey:action', handler)
    return () => ipcRenderer.removeListener('hotkey:action', handler)
  },
  getHotkeys: () => ipcRenderer.invoke('hotkeys:get'),
  setHotkeys: (bindings: unknown) => ipcRenderer.invoke('hotkeys:set', bindings),
  ffmpegAvailable: (): Promise<boolean> => ipcRenderer.invoke('ffmpeg:available'),
  trimExport: (payload: unknown) => ipcRenderer.invoke('trim:export', payload),
}

contextBridge.exposeInMainWorld('qmusic', api)

export type QMusicApi = typeof api
