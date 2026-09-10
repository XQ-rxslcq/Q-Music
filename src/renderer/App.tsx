import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import TitleBar from './TitleBar'
import ThemeDrawer from './ThemeDrawer'
import LyricsStyleDrawer from './LyricsStyleDrawer'
import TransportButtons from './TransportButtons'
import TrimDrawer from './TrimDrawer'
import TrackEditDrawer from './TrackEditDrawer'
import RenameDrawer from './RenameDrawer'
import RootsDrawer from './RootsDrawer'
import ImportDrawer, { type ImportDraft } from './ImportDrawer'
import LyricsMatchDrawer from './LyricsMatchDrawer'
import LibraryContextMenu, { type CtxAction } from './LibraryContextMenu'
import SongPage from './SongPage'
import PlaylistPicker from './PlaylistPicker'
import HotkeysDrawer from './HotkeysDrawer'
import BehaviorDrawer from './BehaviorDrawer'
import { formatTime } from '../core/format'
import { toMediaUrl } from '../core/media-url'
import { resolveLyricLines, type LyricLine } from '../core/lyrics'
import { DEFAULT_THEME, mergeDesktopLyrics, mergePageLyrics } from '../core/library-model'
import { nextDesktopLyricsCycle } from '../core/desktop-lyrics'
import { resolvePrimaryTitle } from '../core/title-display'
import TrackTitleCell from './TrackTitleCell'
import {
  DEFAULT_HOTKEY_BINDINGS,
  matchGlobalAccelInApp,
  mergeHotkeyBindings,
  type HotkeyAction,
  type HotkeyBinding,
} from '../core/hotkey-config'
import {
  appendUniquePreserveOrder,
  dedupeQueuePreserveFirst,
  excludeCategoryFromQueue,
  mergeTracksById,
  moveQueueItemToPlayNext,
  pickByCategories,
  removeQueueIndex,
  resolveNextIndex,
  shuffleIndices,
  type PlayMode,
} from '../core/queue'
import { effectiveLinearGain } from '../core/volume'
import { scanLoudnessFromUrl } from './loudness'
import type { Category, LibraryPayload, MusicRoot, ThemeSettings, Track } from './vite-env'

const NORM_KEY = 'qmusic.normalize'

function applyTheme(theme: ThemeSettings, bgImageUrl: string | null) {
  const root = document.documentElement
  root.dataset.theme = theme.mode
  root.dataset.bg = theme.bgStyle
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-dim', theme.accent)
  root.style.setProperty('--panel-opacity', String(theme.panelOpacity))
  root.style.setProperty('--flat-color', theme.flatColor)
  const strokeOn =
    theme.lowOpacityTextStroke !== false && theme.panelOpacity < 0.4
  root.dataset.lowOpacityStroke = strokeOn ? '1' : '0'
  if (theme.bgStyle === 'image' && bgImageUrl) {
    root.style.setProperty('--bg-image', `url("${bgImageUrl}")`)
  } else {
    root.style.setProperty('--bg-image', 'none')
  }
  const pl = mergePageLyrics(theme.pageLyrics)
  root.style.setProperty('--page-lyric-size', `${pl.fontSize}px`)
  root.style.setProperty('--page-lyric-color', pl.color)
  root.style.setProperty('--page-lyric-active', pl.activeColor)
  root.style.setProperty('--page-lyric-font', pl.fontFamily)
  root.style.setProperty('--page-bg-blur', `${pl.bgBlur}px`)
  root.dataset.pageBgBlur = pl.bgBlur > 0 ? '1' : '0'
  root.style.setProperty('--page-lyric-unsung', pl.unsungColor)
}

function trackLabel(t: Track) {
  return resolvePrimaryTitle(t)
}

function hasLyrics(t: Track) {
  return Boolean(t.lyricsRel)
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const [library, setLibrary] = useState<Track[]>([])
  const [roots, setRoots] = useState<MusicRoot[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [queue, setQueue] = useState<Track[]>([])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.85)
  const [mode, setMode] = useState<PlayMode>('loop')
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME)
  const [themeReady, setThemeReady] = useState(false)
  const skipThemePersist = useRef(true)
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null)
  const [themeOpen, setThemeOpen] = useState(false)
  const [lyricsStyleOpen, setLyricsStyleOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [songPageOpen, setSongPageOpen] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [libraryQuery, setLibraryQuery] = useState('')
  const [hotkeysOpen, setHotkeysOpen] = useState(false)
  const [behaviorOpen, setBehaviorOpen] = useState(false)
  const [rootsOpen, setRootsOpen] = useState(false)
  const [hotkeys, setHotkeys] = useState<HotkeyBinding[]>(() => [...DEFAULT_HOTKEY_BINDINGS])
  const [hotkeysReady, setHotkeysReady] = useState(false)
  const [failedGlobals, setFailedGlobals] = useState<string[]>([])
  const queuePersistReady = useRef(false)
  const [trimOpen, setTrimOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTrack, setEditTrack] = useState<Track | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTrack, setRenameTrack] = useState<Track | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importDraft, setImportDraft] = useState<ImportDraft | null>(null)
  const [importTargetRootId, setImportTargetRootId] = useState<string | null>(null)
  const [importScanning, setImportScanning] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [lyricsMatchOpen, setLyricsMatchOpen] = useState(false)
  const [lyricsMatchTrackId, setLyricsMatchTrackId] = useState<string | null>(null)
  const [lyricsRootAbs, setLyricsRootAbs] = useState<string | null>(null)
  const [lyricsTripleCycle, setLyricsTripleCycle] = useState(true)
  const [ctx, setCtx] = useState<{
    x: number
    y: number
    track: Track
    source: 'library' | 'queue'
    queueIndex?: number
  } | null>(null)
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [lyricsFollowKey, setLyricsFollowKey] = useState(0)
  const [normalize, setNormalize] = useState(() => localStorage.getItem(NORM_KEY) !== '0')
  const [gainMap, setGainMap] = useState<Record<string, number>>({})
  const [initHint, setInitHint] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('Q-Music')
  const [toast, setToast] = useState<{ kind: 'info' | 'ok' | 'error'; text: string } | null>(null)
  const [scanningAll, setScanningAll] = useState(false)
  const scanAbortRef = useRef(false)

  const dismissToast = () => {
    setToast(null)
    setError(null)
    setInitHint(null)
  }

  const notify = (kind: 'info' | 'ok' | 'error', text: string) => setToast({ kind, text })

  const applyLibrary = (payload: LibraryPayload) => {
    setRoots(payload.roots)
    setCategories(payload.categories)
    setLibrary(payload.playable)
    if (payload.gains) setGainMap(payload.gains)
    if (payload.lyricsRootAbs !== undefined) setLyricsRootAbs(payload.lyricsRootAbs ?? null)
    setImportTargetRootId((prev) => {
      if (prev && payload.roots.some((r) => r.id === prev)) return prev
      return payload.roots[0]?.id || null
    })
  }

  useEffect(() => {
    void (async () => {
      const info = await window.qmusic.getInitInfo()
      if (info?.displayName) setDisplayName(info.displayName)
      if (info?.firstRun) {
        setInitHint(`首次启动：已创建数据目录 qmdata（${info.dataDir}）`)
      }
      const savedMode = info?.config?.playMode
      if (savedMode === 'sequence' || savedMode === 'loop' || savedMode === 'single' || savedMode === 'shuffle') {
        setMode(savedMode)
      } else if (typeof window.qmusic.getPlayMode === 'function') {
        try {
          const m = await window.qmusic.getPlayMode()
          if (m === 'sequence' || m === 'loop' || m === 'single' || m === 'shuffle') setMode(m)
        } catch {
          // keep default
        }
      }
      if (info?.config?.desktopLyricsTripleCycle != null) {
        setLyricsTripleCycle(info.config.desktopLyricsTripleCycle !== false)
      } else {
        try {
          const b = await window.qmusic.getBehavior?.()
          if (b && typeof b.desktopLyricsTripleCycle === 'boolean') {
            setLyricsTripleCycle(b.desktopLyricsTripleCycle)
          }
        } catch {
          // default triple
        }
      }
      const tp = await window.qmusic.getTheme()
      const merged = {
        ...DEFAULT_THEME,
        ...tp.theme,
        desktopLyrics: mergeDesktopLyrics(tp.theme.desktopLyrics),
        pageLyrics: mergePageLyrics(tp.theme.pageLyrics),
      }
      setTheme(merged)
      setBgImageUrl(tp.bgImageUrl)
      applyTheme(merged, tp.bgImageUrl)
      skipThemePersist.current = true
      setThemeReady(true)
      if (typeof window.qmusic.getHotkeys === 'function') {
        try {
          const hk = await window.qmusic.getHotkeys()
          setHotkeys(mergeHotkeyBindings(hk as HotkeyBinding[]))
        } catch {
          setHotkeys(mergeHotkeyBindings(DEFAULT_HOTKEY_BINDINGS))
        }
      }
      try {
        const failed = await window.qmusic.getFailedHotkeys?.()
        if (Array.isArray(failed)) setFailedGlobals(failed)
      } catch {
        // ignore
      }
      setHotkeysReady(true)
      const lib = await window.qmusic.getLibrary()
      applyLibrary(lib)
      try {
        const it = await window.qmusic.getImportTarget()
        setImportTargetRootId(it.importTargetRootId || it.roots[0]?.id || null)
      } catch {
        setImportTargetRootId(lib.roots[0]?.id || null)
      }
      // 恢复播放队列
      try {
        const q = await window.qmusic.getQueue()
        if (q?.trackIds?.length && lib.playable?.length) {
          const byId = new Map(lib.playable.map((t) => [t.id, t]))
          const restored = q.trackIds.map((id) => byId.get(id)).filter(Boolean) as Track[]
          if (restored.length) {
            const idx = Math.max(
              0,
              q.currentId ? restored.findIndex((t) => t.id === q.currentId) : 0,
            )
            setQueue(restored)
            setIndex(idx < 0 ? 0 : idx)
          }
        }
      } catch {
        // ignore
      }
      queuePersistReady.current = true
      if (info?.dataDir) {
        console.info('[Q-Music] dataDir =', info.dataDir)
      }
    })()
  }, [])

  const filteredLibrary = useMemo(() => {
    let list = library
    if (categoryFilter === '__uncategorized') {
      list = list.filter((t) => !t.categoryIds?.length)
    } else if (categoryFilter) {
      list = list.filter((t) => t.categoryIds?.includes(categoryFilter))
    }
    const q = libraryQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter((t) => {
      const hay = [
        t.title,
        t.titleZh,
        t.titleEn,
        t.titleJa,
        t.artist,
        t.album,
        trackLabel(t),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [library, categoryFilter, libraryQuery])

  const filterLabel = useMemo(() => {
    if (!categoryFilter) return '总曲库'
    if (categoryFilter === '__uncategorized') return '未分类'
    return categories.find((c) => c.id === categoryFilter)?.name || '歌单'
  }, [categoryFilter, categories])

  const current = queue[index] ?? null
  const trackGainDb = current ? (gainMap[current.id] ?? 0) : 0

  useEffect(() => {
    if (!themeReady) return
    applyTheme(theme, bgImageUrl)
    if (skipThemePersist.current) {
      skipThemePersist.current = false
      return
    }
    void window.qmusic.setTheme(theme).then((tp) => {
      if (tp.bgImageUrl !== bgImageUrl) setBgImageUrl(tp.bgImageUrl)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在 theme 变更时落盘
  }, [theme, themeReady])

  useEffect(() => {
    if (!hotkeysReady) return
    if (typeof window.qmusic.setHotkeys !== 'function') return
    void window.qmusic.setHotkeys(hotkeys).then((res) => {
      const failed = (res as { failedGlobals?: string[] })?.failedGlobals
      if (Array.isArray(failed)) setFailedGlobals(failed)
    })
  }, [hotkeys, hotkeysReady])

  useEffect(() => {
    if (!queuePersistReady.current) return
    if (typeof window.qmusic.setQueue !== 'function') return
    void window.qmusic.setQueue({
      trackIds: queue.map((t) => t.id),
      currentId: queue[index]?.id ?? null,
    })
  }, [queue, index])

  useEffect(() => {
    localStorage.setItem(NORM_KEY, normalize ? '1' : '0')
  }, [normalize])

  useEffect(() => {
    if (!Object.keys(gainMap).length) return
    void window.qmusic.setGains(gainMap)
  }, [gainMap])

  const statusText = useMemo(() => {
    if (!current) return '未播放'
    return current.artist || '—'
  }, [current])

  const ensureAudioGraph = useCallback(() => {
    const audio = audioRef.current
    if (!audio || gainNodeRef.current) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const src = ctx.createMediaElementSource(audio)
    const gain = ctx.createGain()
    src.connect(gain)
    gain.connect(ctx.destination)
    audioCtxRef.current = ctx
    gainNodeRef.current = gain
  }, [])

  const applyOutputGain = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    ensureAudioGraph()
    const linear = effectiveLinearGain({
      userVolume: volume,
      gainDb: trackGainDb,
      normalizeEnabled: normalize,
    })
    // HTMLAudio volume 上限为 1，安静曲抬升必须走 GainNode
    audio.volume = 1
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = Math.max(0, linear)
    } else {
      audio.volume = Math.min(1, linear)
    }
    void audioCtxRef.current?.resume()
  }, [volume, trackGainDb, normalize, ensureAudioGraph])

  useEffect(() => {
    applyOutputGain()
  }, [applyOutputGain])

  const loadQueue = useCallback((tracks: Track[], startIndex = 0, autoplay = true) => {
    setQueue(tracks)
    setIndex(startIndex)
    setShuffleOrder(shuffleIndices(tracks.length, startIndex))
    setError(null)
    if (autoplay) setPlaying(true)
  }, [])

  const addToLibraryAndQueue = useCallback((tracks: Track[]) => {
    if (!tracks.length) return
    setLibrary((prev) => mergeTracksById(prev, tracks))
    setQueue((prev) => {
      const next = mergeTracksById(prev, tracks)
      if (prev.length === 0) {
        setIndex(0)
        setShuffleOrder(shuffleIndices(next.length))
        setPlaying(true)
      }
      return next
    })
  }, [])

  const onAddFiles = async () => {
    const tracks = await window.qmusic.openFiles()
    addToLibraryAndQueue(tracks)
  }

  const onAddMusicRoots = async () => {
    const lib = await window.qmusic.addMusicRoot()
    applyLibrary(lib)
  }

  const onRescan = async () => {
    const lib = await window.qmusic.rescanLibrary()
    applyLibrary(lib)
  }

  const playAt = (i: number) => {
    if (i < 0 || i >= queue.length) return
    setIndex(i)
    setPlaying(true)
    setError(null)
  }

  const removeFromQueue = (i: number) => {
    setQueue((prev) => {
      const { queue: next, index: nextIndex } = removeQueueIndex(prev, i, index)
      setIndex(nextIndex)
      setShuffleOrder(shuffleIndices(next.length))
      if (next.length === 0) {
        setPlaying(false)
        const a = audioRef.current
        if (a) {
          a.pause()
          a.removeAttribute('src')
        }
      }
      return next
    })
  }

  const clearQueue = () => {
    setQueue([])
    setIndex(0)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setLyrics([])
    const a = audioRef.current
    if (a) {
      a.pause()
      a.removeAttribute('src')
    }
  }

  const goRelative = useCallback(
    (direction: 1 | -1) => {
      if (!queue.length) return
      const result = resolveNextIndex({
        mode,
        queueLength: queue.length,
        from: index,
        direction,
        shuffleOrder,
      })
      if (result.shuffleOrder) setShuffleOrder(result.shuffleOrder)
      if (result.replay) {
        const a = audioRef.current
        if (a) {
          a.currentTime = 0
          void a.play()
        }
        return
      }
      if (result.stop) {
        setPlaying(false)
        return
      }
      setIndex(result.index)
      setPlaying(true)
    },
    [queue.length, mode, index, shuffleOrder],
  )

  const goNext = useCallback(() => goRelative(1), [goRelative])
  const goPrev = useCallback(() => {
    const a = audioRef.current
    if (a && a.currentTime > 3) {
      a.currentTime = 0
      return
    }
    goRelative(-1)
  }, [goRelative])

  const cycleDesktopLyrics = useCallback(() => {
    setTheme((t) => {
      const dl = t.desktopLyrics
      const step = nextDesktopLyricsCycle(
        { visible: Boolean(dl?.visible), locked: dl?.locked !== false },
        lyricsTripleCycle ? 'three' : 'two',
      )
      setToast({ kind: 'ok', text: step.toast })
      return {
        ...t,
        desktopLyrics: mergeDesktopLyrics({
          ...(dl || {}),
          visible: step.visible,
          locked: step.locked,
        }),
      }
    })
  }, [lyricsTripleCycle])

  const toggleDesktopLyrics = useCallback(() => {
    cycleDesktopLyrics()
  }, [cycleDesktopLyrics])

  const toggleDesktopLyricsLock = useCallback(() => {
    setTheme((t) => ({
      ...t,
      desktopLyrics: mergeDesktopLyrics({
        ...(t.desktopLyrics || {}),
        locked: !t.desktopLyrics?.locked,
        visible: true,
      }),
    }))
  }, [])

  const onHotkeyAction = useCallback(
    (action: HotkeyAction | string) => {
      if (action === 'toggle-play') setPlaying((p) => !p)
      else if (action === 'next') goNext()
      else if (action === 'prev') goPrev()
      else if (action === 'vol-up') setVolume((v) => Math.min(1, v + 0.05))
      else if (action === 'vol-down') setVolume((v) => Math.max(0, v - 0.05))
      else if (action === 'seek-back' || action === 'seek-fwd') {
        const a = audioRef.current
        if (!a) return
        const delta = action === 'seek-fwd' ? 5 : -5
        a.currentTime = Math.max(0, Math.min(duration || a.duration || 0, (a.currentTime || 0) + delta))
        setLyricsFollowKey((k) => k + 1)
      } else if (action === 'toggle-desktop-lyrics') {
        toggleDesktopLyrics()
      } else if (action === 'toggle-desktop-lyrics-lock') {
        toggleDesktopLyricsLock()
      }
    },
    [goNext, goPrev, duration, toggleDesktopLyrics, toggleDesktopLyricsLock],
  )

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLyrics([])
      if (!current) return
      const res = await window.qmusic.loadLyricsForTrack(current.id)
      if (cancelled) return
      if (res.content) {
        setLyrics(resolveLyricLines(res.content).lines)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [current?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    audio.src = current.fileUrl
    applyOutputGain()
    const tryPlay = async () => {
      try {
        if (playing) await audio.play()
        else audio.pause()
      } catch (e) {
        setError(e instanceof Error ? e.message : '无法播放该文件')
        setPlaying(false)
      }
    }
    void tryPlay()
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current ? trackLabel(current) : displayName,
        artist: current?.artist || displayName,
        album: displayName,
      })
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    } catch {
      // ignore
    }
  }, [current, playing, displayName])

  useEffect(() => {
    const payload = current
      ? { title: trackLabel(current), artist: current.artist || null }
      : null
    void window.qmusic.setNowPlaying?.(payload)
  }, [current?.id, current?.artist, current?.title, current?.titleZh, current?.titleEn, current?.titleJa, displayName]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) void audio.play().catch(() => setPlaying(false))
    else audio.pause()
  }, [playing])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || current?.duration || 0)
    const onEnded = () => goRelative(1)
    const onErr = () => {
      setError('解码失败或格式不受支持')
      setPlaying(false)
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onErr)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onErr)
    }
  }, [goRelative, current?.duration])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (!el) return
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) return
      if (el.closest?.('.theme-drawer, .theme-mask, .hotkeys-record')) return
      if (
        editOpen ||
        renameOpen ||
        importOpen ||
        themeOpen ||
        hotkeysOpen ||
        behaviorOpen ||
        rootsOpen ||
        trimOpen ||
        lyricsMatchOpen ||
        lyricsStyleOpen
      ) {
        return
      }
      for (const b of hotkeys) {
        const hitInApp = Boolean(b.inApp?.trim()) && matchGlobalAccelInApp(e, b.inApp)
        const hitGlobal = Boolean(b.global?.trim()) && matchGlobalAccelInApp(e, b.global)
        if (!hitInApp && !hitGlobal) continue
        e.preventDefault()
        // 一律走主进程（带防抖），避免与 globalShortcut 双触发把切换类操作抵消
        void window.qmusic.dispatchHotkey?.(b.action)
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    hotkeys,
    onHotkeyAction,
    editOpen,
    renameOpen,
    importOpen,
    themeOpen,
    hotkeysOpen,
    behaviorOpen,
    rootsOpen,
    trimOpen,
    lyricsMatchOpen,
    lyricsStyleOpen,
  ])

  useEffect(() => {
    const offTheme = window.qmusic.onThemeChanged?.((tp) => {
      skipThemePersist.current = true
      const merged = {
        ...DEFAULT_THEME,
        ...tp.theme,
        desktopLyrics: mergeDesktopLyrics(tp.theme.desktopLyrics),
        pageLyrics: mergePageLyrics(tp.theme.pageLyrics),
      }
      setTheme(merged)
      setBgImageUrl(tp.bgImageUrl)
      applyTheme(merged, tp.bgImageUrl)
    })
    const offName = window.qmusic.onDisplayNameChanged?.((name) => {
      if (name) setDisplayName(name)
    })
    const offHotkey = window.qmusic.onHotkeyAction?.((action) => {
      onHotkeyAction(action)
    })
    return () => {
      offTheme?.()
      offName?.()
      offHotkey?.()
    }
  }, [onHotkeyAction])

  useEffect(() => {
    if (!theme.desktopLyrics?.visible) return
    void window.qmusic.pushDesktopLyrics({
      lines: lyrics,
      currentTime,
      duration,
      title: current ? trackLabel(current) : undefined,
      artist: current?.artist,
      settings: theme.desktopLyrics,
      playing,
    })
  }, [lyrics, currentTime, duration, current, theme.desktopLyrics, playing])

  const cycleMode = () => {
    const order: PlayMode[] = ['sequence', 'loop', 'single', 'shuffle']
    const next = order[(order.indexOf(mode) + 1) % order.length]
    setMode(next)
    if (next === 'shuffle') setShuffleOrder(shuffleIndices(queue.length, index))
    void window.qmusic.setPlayMode?.(next)
  }

  const playLibraryTrack = (track: Track) => {
    const existing = queue.findIndex((t) => t.id === track.id)
    if (existing >= 0) {
      playAt(existing)
      return
    }
    loadQueue([...queue, track], queue.length, true)
  }

  const addOneToQueue = (track: Track) => {
    setQueue((prev) => appendUniquePreserveOrder(prev, [track]))
  }

  /** 当前筛选结果追加入队（重复跳过） */
  const addFilteredToQueue = () => {
    if (!filteredLibrary.length) return
    setQueue((prev) => {
      const next = appendUniquePreserveOrder(prev, filteredLibrary)
      if (prev.length === 0 && next.length) {
        setIndex(0)
        setShuffleOrder(shuffleIndices(next.length))
        setPlaying(true)
      }
      return next
    })
  }

  /** 用当前筛选结果替换队列并播放 */
  const playFilteredAsQueue = () => {
    if (!filteredLibrary.length) return
    loadQueue(dedupeQueuePreserveFirst(filteredLibrary), 0, true)
  }

  const tracksForCategoryIds = (categoryIds: string[]) => {
    const seen = new Set<string>()
    const out: Track[] = []
    for (const id of categoryIds) {
      const chunk =
        !id
          ? library
          : id === '__uncategorized'
            ? library.filter((t) => !t.categoryIds?.length)
            : pickByCategories(library, [id])
      for (const t of chunk) {
        if (seen.has(t.id)) continue
        seen.add(t.id)
        out.push(t)
      }
    }
    return out
  }

  const playNextInQueue = (itemIndex: number) => {
    setQueue((prev) => {
      const { queue: next, index: nextIndex } = moveQueueItemToPlayNext(prev, itemIndex, index)
      setIndex(nextIndex)
      setShuffleOrder(shuffleIndices(next.length, nextIndex))
      return next
    })
    notify('ok', '已设为下一曲播放')
  }

  const pickLyrics = async (trackId?: string) => {
    const id = trackId || current?.id
    if (!id) return
    const res = await window.qmusic.bindLyricsToTrack(id)
    if (!res) return
    setLyrics(resolveLyricLines(res.content).lines)
    applyLibrary(res.library)
    setSongPageOpen(true)
  }

  const scanCurrentLoudness = async () => {
    if (!current) return
    notify('info', '扫描响度中…')
    try {
      const profile = await scanLoudnessFromUrl(current.fileUrl)
      setGainMap((m) => ({ ...m, [current.id]: profile.gainDb }))
      setNormalize(true)
      notify('ok', `LUFS≈${profile.lufs.toFixed(1)} → 增益 ${profile.gainDb.toFixed(1)} dB`)
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '扫描失败')
    }
  }

  const scanAllLoudness = async () => {
    if (scanningAll) {
      scanAbortRef.current = true
      return
    }
    const targets = library.filter((t) => gainMap[t.id] == null)
    if (!targets.length) {
      notify('ok', '全部曲目已有响度增益')
      setNormalize(true)
      return
    }
    setScanningAll(true)
    scanAbortRef.current = false
    setNormalize(true)
    let done = 0
    const nextMap = { ...gainMap }
    for (const t of targets) {
      if (scanAbortRef.current) break
      notify('info', `批量响度 ${done + 1}/${targets.length}：${trackLabel(t)}`)
      try {
        const profile = await scanLoudnessFromUrl(t.fileUrl)
        nextMap[t.id] = profile.gainDb
        done += 1
        if (done % 8 === 0) {
          setGainMap({ ...nextMap })
          await window.qmusic.setGains(nextMap)
        }
      } catch {
        // skip broken file
      }
    }
    setGainMap(nextMap)
    await window.qmusic.setGains(nextMap)
    setScanningAll(false)
    notify(
      scanAbortRef.current ? 'info' : 'ok',
      scanAbortRef.current
        ? `已中止，完成 ${done}/${targets.length}`
        : `响度归一完成 ${done}/${targets.length}（只调总音量即可）`,
    )
  }

  const onApplyFilenameMeta = async () => {
    if (
      !window.confirm(
        '按文件名规则校验并填充曲目的艺人/中英日标题？（只改曲库索引，不改磁盘文件名；跳过无法可靠解析的项）',
      )
    ) {
      return
    }
    const lib = await window.qmusic.applyFilenameMeta()
    applyLibrary(lib)
    setQueue((prev) =>
      prev.map((t) => {
        const u = lib.playable.find((p) => p.id === t.id)
        return u ? { ...t, ...u } : t
      }),
    )
    notify(
      'ok',
      `已填充 ${lib.updated ?? 0} 首（共 ${lib.total ?? 0}，跳过 ${lib.skipped ?? 0}）`,
    )
  }

  const openImportDraft = (sourcePath: string) => {
    if (!sourcePath) {
      notify('error', '无法读取拖入文件的路径')
      return
    }
    const fileName = sourcePath.split(/[/\\]/).pop() || sourcePath
    setImportDraft({ sourcePath, fileName, fileUrl: toMediaUrl(sourcePath) })
    setImportOpen(true)
  }

  const onLibraryDragOver = (e: DragEvent) => {
    if (![...e.dataTransfer.types].includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropActive(true)
  }

  const onLibraryDragLeave = (e: DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDropActive(false)
  }

  const onLibraryDrop = (e: DragEvent) => {
    e.preventDefault()
    setDropActive(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const audio = /\.(mp3|m4a|aac|flac|wav|ogg|opus|webm)$/i.test(file.name)
    if (!audio) {
      notify('error', '请拖入音频文件')
      return
    }
    const p =
      (typeof window.qmusic.getPathForFile === 'function' && window.qmusic.getPathForFile(file)) ||
      (file as File & { path?: string }).path ||
      ''
    openImportDraft(p)
  }

  const onImportTargetChange = (rootId: string) => {
    setImportTargetRootId(rootId)
    void window.qmusic.setImportTarget(rootId)
  }

  const onImportConfirm = async (payload: {
    sourcePath: string
    rootId: string
    artist: string
    titleZh: string
    titleEn: string
    titleJa: string
  }) => {
    const res = await window.qmusic.importAudio(payload)
    if (!res.ok) {
      notify('error', res.error || '入库失败')
      return
    }
    applyLibrary(res.library)
    setImportOpen(false)
    setImportDraft(null)
    notify('ok', '已按规范名入库')
  }

  const onImportScanLoudness = async (fileUrl: string) => {
    setImportScanning(true)
    notify('info', '扫描响度中…')
    try {
      const profile = await scanLoudnessFromUrl(fileUrl)
      notify('ok', `LUFS≈${profile.lufs.toFixed(1)} → 建议增益 ${profile.gainDb.toFixed(1)} dB（入库后可再扫写入）`)
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '扫描失败')
    } finally {
      setImportScanning(false)
    }
  }

  const onThemeChange = (next: ThemeSettings) => setTheme(next)

  const onPickBackground = async () => {
    const tp = await window.qmusic.pickBackground()
    const merged = {
      ...DEFAULT_THEME,
      ...tp.theme,
      desktopLyrics: mergeDesktopLyrics(tp.theme.desktopLyrics),
      pageLyrics: mergePageLyrics(tp.theme.pageLyrics),
    }
    setTheme(merged)
    setBgImageUrl(tp.bgImageUrl)
    applyTheme(merged, tp.bgImageUrl)
  }

  const openEditTrack = (t: Track) => {
    setEditTrack(t)
    setEditOpen(true)
  }

  const openRenameTrack = (t: Track) => {
    setRenameTrack(t)
    setRenameOpen(true)
  }

  const onCtxAction = (action: CtxAction, track: Track) => {
    const queueIndex = ctx?.source === 'queue' ? ctx.queueIndex : undefined
    setCtx(null)
    if (action === 'play') playLibraryTrack(track)
    else if (action === 'addQueue') addOneToQueue(track)
    else if (action === 'queueRemove' && queueIndex != null) removeFromQueue(queueIndex)
    else if (action === 'queuePlayNext' && queueIndex != null) playNextInQueue(queueIndex)
    else if (action === 'edit') openEditTrack(track)
    else if (action === 'rename') openRenameTrack(track)
    else if (action === 'lyrics') void pickLyrics(track.id)
    else if (action === 'matchLyrics') {
      setLyricsMatchTrackId(track.id)
      setLyricsMatchOpen(true)
    }
  }

  const onSaveTrack = async (patch: {
    id: string
    titleZh: string
    titleEn: string
    titleJa: string
    artist: string
    album: string
    categoryIds: string[]
    titleDisplay: import('../core/title-display').TitleDisplaySettings
  }) => {
    const lib = await window.qmusic.updateTrack(patch)
    applyLibrary(lib)
    setQueue((prev) =>
      prev.map((t) => {
        const u = lib.playable.find((p) => p.id === t.id)
        return u ? { ...t, ...u } : t
      }),
    )
    setEditOpen(false)
    setEditTrack(null)
  }

  const onRenameConfirm = async (meta: {
    id: string
    artist: string
    titleZh: string
    titleEn: string
    titleJa: string
  }) => {
    const res = await window.qmusic.renameTrack(meta)
    if (!res.ok) {
      notify('error', res.error || '重命名失败')
      return
    }
    applyLibrary(res.library)
    const oldId = res.oldId || meta.id
    const updated = res.library.playable.find((p) => p.id === res.trackId)
    if (updated) {
      setQueue((prev) => prev.map((t) => (t.id === oldId ? updated : t)))
      setGainMap((m) => {
        if (m[oldId] == null || oldId === updated.id) return m
        const next = { ...m, [updated.id]: m[oldId] }
        delete next[oldId]
        return next
      })
    }
    setRenameOpen(false)
    setRenameTrack(null)
    notify('ok', '已重命名并更新曲库')
  }

  return (
    <div className="shell">
      <TitleBar
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
        brandName={displayName}
        menu={
          <>
            <div className="menu-section">歌曲</div>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                void onAddMusicRoots()
              }}
            >
              添加音乐目录
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                setRootsOpen(true)
              }}
            >
              目录绑定管理
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                void onRescan()
              }}
            >
              重新扫描曲库
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                void onAddFiles()
              }}
            >
              临时添加文件
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                void onApplyFilenameMeta()
              }}
            >
              按文件名填充（校验）
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                if (!roots.length) {
                  notify('error', '请先添加音乐目录')
                  return
                }
                const labels = roots.map((r, i) => `${i + 1}. ${r.label || r.path}`).join('\n')
                const pick = window.prompt(
                  `选择默认入库音乐根序号（当前默认第 1 个）\n${labels}`,
                  '1',
                )
                const n = Number(pick)
                if (!Number.isFinite(n) || n < 1 || n > roots.length) return
                const id = roots[n - 1].id
                setImportTargetRootId(id)
                void window.qmusic.setImportTarget(id)
                notify('ok', `入库目录：${roots[n - 1].label || roots[n - 1].path}`)
              }}
            >
              设置拖入入库目录
            </button>
            <button
              type="button"
              className="menu-item"
              disabled={!current}
              onClick={() => {
                setMenuOpen(false)
                setTrimOpen(true)
              }}
            >
              截取当前曲
            </button>

            <div className="menu-section">歌词</div>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                setLyricsStyleOpen(true)
              }}
            >
              歌词样式
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                void window.qmusic.pickLyricsRoot().then((res) => {
                  applyLibrary(res.library)
                  setLyricsRootAbs(res.absPath)
                  notify('ok', res.absPath ? `歌词目录：${res.absPath}` : '未选择')
                })
              }}
            >
              选择歌词目录
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                setLyricsMatchTrackId(current?.id || null)
                setLyricsMatchOpen(true)
              }}
            >
              歌词匹配工作台
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                cycleDesktopLyrics()
              }}
            >
              {!theme.desktopLyrics?.visible
                ? '开启桌面歌词'
                : theme.desktopLyrics?.locked === false
                  ? '锁定桌面歌词'
                  : '关闭桌面歌词'}
            </button>

            <div className="menu-section">响度</div>
            <button
              type="button"
              className="menu-item"
              disabled={!current || scanningAll}
              onClick={() => {
                setMenuOpen(false)
                void scanCurrentLoudness()
              }}
            >
              扫描当前曲响度
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                void scanAllLoudness()
              }}
            >
              {scanningAll ? '中止批量扫描' : '批量扫描响度'}
            </button>

            <div className="menu-section">应用</div>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                setThemeOpen(true)
              }}
            >
              外观主题
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                setHotkeysOpen(true)
              }}
            >
              快捷键
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false)
                setBehaviorOpen(true)
              }}
            >
              应用行为设置
            </button>
            <div className="menu-sep" />
            <div className="menu-hint">音乐根 {roots.length} · 曲目 {library.length}</div>
          </>
        }
      />

      <div
        className={`app ${queueOpen ? 'with-queue' : 'library-only'} ${songPageOpen ? 'song-open' : ''}`}
      >
        {(initHint || error || toast) && (
          <div
            className={`banner dismissible ${
              error || toast?.kind === 'error' ? 'error' : toast?.kind === 'ok' ? 'ok' : 'info'
            }`}
          >
            <span className="banner-text">
              {[initHint, error, toast?.text].filter(Boolean).join(' · ')}
            </span>
            <button type="button" className="banner-close" title="关闭" onClick={dismissToast}>
              ×
            </button>
          </div>
        )}

        <main className={`layout-main ${queueOpen ? 'with-queue' : ''}`}>
          <section
            className={`panel library-panel ${dropActive ? 'drop-active' : ''}`}
            onDragEnter={onLibraryDragOver}
            onDragOver={onLibraryDragOver}
            onDragLeave={onLibraryDragLeave}
            onDrop={onLibraryDrop}
          >
            <div className="panel-head">
              <button
                type="button"
                className="panel-title panel-title-btn"
                title="点击选择歌单"
                onClick={() => setPlaylistOpen(true)}
              >
                <span className="panel-title-icon" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  {filterLabel} ({filteredLibrary.length})
                </span>
              </button>
              <div className="panel-tools">
                <input
                  type="search"
                  className="library-search"
                  placeholder="搜索歌曲 / 艺人"
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                  aria-label="搜索曲库"
                />
                <button
                  type="button"
                  onClick={addFilteredToQueue}
                  disabled={!filteredLibrary.length}
                >
                  加入队列
                </button>
                <button
                  type="button"
                  onClick={playFilteredAsQueue}
                  disabled={!filteredLibrary.length}
                >
                  替换队列
                </button>
                <button
                  type="button"
                  className={queueOpen ? 'active-toggle' : ''}
                  onClick={() => setQueueOpen((v) => !v)}
                >
                  {queueOpen ? '收起队列' : `队列 (${queue.length})`}
                </button>
              </div>
            </div>

            <ul className="list">
              {filteredLibrary.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="row"
                    onClick={() => playLibraryTrack(t)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setCtx({ x: e.clientX, y: e.clientY, track: t, source: 'library' })
                    }}
                  >
                    <span
                      className={`lyric-flag ${hasLyrics(t) ? 'on' : 'off'}`}
                      title={hasLyrics(t) ? '已绑定歌词' : '无歌词'}
                    >
                      {hasLyrics(t) ? '词' : '·'}
                    </span>
                    <TrackTitleCell track={t} />
                    <span className="meta">{t.artist}</span>
                  </button>
                </li>
              ))}
              {!filteredLibrary.length && (
                <li className="empty">
                  {libraryQuery.trim()
                    ? '没有匹配的歌曲'
                    : '用菜单「添加音乐目录」登记文件夹，或把音频拖入此面板导入'}
                </li>
              )}
            </ul>
          </section>

          {queueOpen && (
            <section className="panel queue-panel">
              <div className="panel-head">
                <h2 className="panel-title">播放队列 ({queue.length})</h2>
                <div className="panel-tools">
                  <button type="button" className="ghost" onClick={clearQueue} disabled={!queue.length}>
                    清空
                  </button>
                  <button type="button" className="icon" title="收起" onClick={() => setQueueOpen(false)}>
                    ×
                  </button>
                </div>
              </div>
              <ul className="list">
                {queue.map((t, i) => (
                  <li key={`${t.id}-${i}`} className={i === index ? 'active' : ''}>
                    <button
                      type="button"
                      className="row"
                      onClick={() => playAt(i)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setCtx({
                          x: e.clientX,
                          y: e.clientY,
                          track: t,
                          source: 'queue',
                          queueIndex: i,
                        })
                      }}
                    >
                      <span className="idx">{i + 1}</span>
                      <TrackTitleCell track={t} />
                      <span className="meta">{t.artist}</span>
                    </button>
                    <button type="button" className="icon" onClick={() => removeFromQueue(i)}>
                      ×
                    </button>
                  </li>
                ))}
                {!queue.length && <li className="empty">队列为空</li>}
              </ul>
            </section>
          )}
        </main>

        <footer className="player">
          <audio ref={audioRef} preload="metadata" />
          <div className="player-top">
            <div className="now">
              <button
                type="button"
                className="now-title now-title-btn"
                title="打开歌曲页"
                onClick={() => setSongPageOpen(true)}
              >
                {current ? trackLabel(current) : displayName}
              </button>
              <div className="now-sub">{statusText}</div>
            </div>
            <div className="controls">
              <TransportButtons
                playing={playing}
                disabled={!queue.length}
                onPrev={goPrev}
                onToggle={() => setPlaying((p) => !p)}
                onNext={goNext}
                mode={mode}
                onCycleMode={cycleMode}
                lyricsState={
                  !theme.desktopLyrics?.visible
                    ? 'off'
                    : theme.desktopLyrics?.locked === false
                      ? 'unlocked'
                      : 'locked'
                }
                onCycleLyrics={() => cycleDesktopLyrics()}
              />
            </div>
            <div className="vol vol-stack">
              <div className="vol-row">
                <span>音量</span>
                <input
                  className="ui-range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  style={{ '--range-progress': `${volume * 100}%` } as CSSProperties}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </div>
              <label className="norm gain-line">
                <input
                  type="checkbox"
                  checked={normalize}
                  onChange={(e) => setNormalize(e.target.checked)}
                />
                归一 {trackGainDb >= 0 ? '+' : ''}
                {trackGainDb.toFixed(1)} dB
              </label>
            </div>
          </div>
          <div className="player-seek">
            <span>{formatTime(currentTime)}</span>
            <input
              className="ui-range seek-range"
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              disabled={!current}
              style={
                {
                  '--range-progress': `${duration > 0 ? (Math.min(currentTime, duration) / duration) * 100 : 0}%`,
                } as CSSProperties
              }
              onPointerDown={() => setLyricsFollowKey((k) => k + 1)}
              onChange={(e) => {
                const v = Number(e.target.value)
                setCurrentTime(v)
                setLyricsFollowKey((k) => k + 1)
                if (audioRef.current) audioRef.current.currentTime = v
              }}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </footer>
      </div>

      <SongPage
        open={songPageOpen}
        title={current ? trackLabel(current) : ''}
        artist={current?.artist || ''}
        lines={lyrics}
        currentTime={currentTime}
        duration={duration}
        playing={playing}
        resumeFollowKey={lyricsFollowKey}
        pageLyrics={theme.pageLyrics}
        onClose={() => setSongPageOpen(false)}
        onSeek={(sec) => {
          setCurrentTime(sec)
          setLyricsFollowKey((k) => k + 1)
          if (audioRef.current) audioRef.current.currentTime = sec
        }}
        onSeekEndNext={() => goNext()}
        onOpenMatch={() => {
          setLyricsMatchTrackId(current?.id || null)
          setLyricsMatchOpen(true)
        }}
      />

      <PlaylistPicker
        open={playlistOpen}
        anchorLabel={filterLabel}
        categories={categories}
        library={library}
        currentId={categoryFilter}
        onClose={() => setPlaylistOpen(false)}
        onSelect={(id) => setCategoryFilter(id)}
        onCreate={async (name) => {
          try {
            const lib = await window.qmusic.addCategory(name)
            applyLibrary(lib)
            notify('ok', `已创建歌单「${name}」`)
          } catch (e) {
            notify('error', e instanceof Error ? e.message : '创建歌单失败')
          }
        }}
        onAddSelectedToQueue={(ids) => {
          const tracks = tracksForCategoryIds(ids)
          if (!tracks.length) {
            notify('info', '所选歌单没有歌曲')
            return
          }
          setQueue((prev) => {
            const next = appendUniquePreserveOrder(prev, tracks)
            if (prev.length === 0 && next.length) {
              setIndex(0)
              setShuffleOrder(shuffleIndices(next.length))
              setPlaying(true)
            }
            return next
          })
          notify('ok', `已加入队列 ${tracks.length} 首`)
        }}
        onExcludeSelectedFromQueue={(ids) => {
          const catIds = ids.filter((id) => id && id !== '__uncategorized')
          if (!catIds.length) {
            notify('info', '请勾选具体分类再排除')
            return
          }
          setQueue((prev) => {
            let next = prev
            for (const id of catIds) next = excludeCategoryFromQueue(next, id)
            setIndex((i) => Math.min(i, Math.max(0, next.length - 1)))
            return next
          })
        }}
      />

      <HotkeysDrawer
        open={hotkeysOpen}
        value={hotkeys}
        failedGlobals={failedGlobals}
        onChange={(next) => setHotkeys(mergeHotkeyBindings(next))}
        onClose={() => setHotkeysOpen(false)}
      />
      <BehaviorDrawer
        open={behaviorOpen}
        onClose={() => setBehaviorOpen(false)}
        onNotify={notify}
        onBehaviorChange={(b) => {
          setLyricsTripleCycle(b.desktopLyricsTripleCycle !== false)
        }}
      />
      <RootsDrawer
        open={rootsOpen}
        onClose={() => setRootsOpen(false)}
        roots={roots}
        lyricsRootAbs={lyricsRootAbs}
        onNotify={notify}
        onLibraryChange={(lib) => applyLibrary(lib as LibraryPayload)}
        onLyricsRootChange={setLyricsRootAbs}
      />

      <ThemeDrawer
        open={themeOpen}
        value={theme}
        onChange={onThemeChange}
        onPickBackground={() => void onPickBackground()}
        onClose={() => setThemeOpen(false)}
      />
      <LyricsStyleDrawer
        open={lyricsStyleOpen}
        value={theme}
        onChange={onThemeChange}
        onClose={() => setLyricsStyleOpen(false)}
      />
      <TrimDrawer
        open={trimOpen}
        track={current}
        currentTime={currentTime}
        duration={duration}
        onClose={() => setTrimOpen(false)}
        onTrimmed={(track) => addToLibraryAndQueue([track])}
      />
      <TrackEditDrawer
        open={editOpen}
        track={editTrack}
        categories={categories}
        onClose={() => {
          setEditOpen(false)
          setEditTrack(null)
        }}
        onSave={(patch) => void onSaveTrack(patch)}
      />
      <RenameDrawer
        open={renameOpen}
        track={renameTrack}
        onClose={() => {
          setRenameOpen(false)
          setRenameTrack(null)
        }}
        onConfirm={(meta) => void onRenameConfirm(meta)}
      />
      <ImportDrawer
        open={importOpen}
        draft={importDraft}
        roots={roots}
        importTargetRootId={importTargetRootId}
        onImportTargetChange={onImportTargetChange}
        onClose={() => {
          setImportOpen(false)
          setImportDraft(null)
        }}
        onImport={onImportConfirm}
        onScanLoudness={onImportScanLoudness}
        scanning={importScanning}
      />
      <LyricsMatchDrawer
        open={lyricsMatchOpen}
        tracks={library}
        initialTrackId={lyricsMatchTrackId}
        lyricsRootAbs={lyricsRootAbs}
        onClose={() => {
          setLyricsMatchOpen(false)
          setLyricsMatchTrackId(null)
        }}
        onLyricsRootChange={(lib, abs) => {
          applyLibrary(lib)
          setLyricsRootAbs(abs)
        }}
        onSaved={(lib) => {
          applyLibrary(lib)
          setQueue((prev) =>
            prev.map((t) => {
              const u = lib.playable.find((p) => p.id === t.id)
              return u ? { ...t, ...u } : t
            }),
          )
          notify('ok', lyricsRootAbs ? '歌词已保存到歌词目录' : '歌词已保存到音频同目录')
        }}
      />
      {ctx && (
        <LibraryContextMenu
          x={ctx.x}
          y={ctx.y}
          track={ctx.track}
          source={ctx.source}
          onAction={onCtxAction}
          onClose={() => setCtx(null)}
        />
      )}
    </div>
  )
}
