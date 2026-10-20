import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  applyLineTimes,
  buildLyricsSearchQuery,
  cleanLyricsTitle,
  fitLyricTiming,
  resolveLyricLines,
  serializeLrc,
  transformLyricLines,
  type LyricLine,
  type LyricTimingSample,
} from '../core/lyrics'
import {
  sortLibraryTracks,
  type LibrarySortDir,
  type LibrarySortKey,
} from '../core/library-sort'
import {
  VIRTUAL_TAG_CONFIGURED,
  VIRTUAL_TAG_MISSING,
  VIRTUAL_WORKBENCH_TAGS,
  filterWorkbenchTracks,
  type WorkbenchTag,
  type WorkbenchTagMap,
} from '../core/workbench-tags'
import LyricsPanel from './LyricsPanel'
import TransportButtons from './TransportButtons'
import DrawerShell from './DrawerShell'
import UiSelect from './UiSelect'
import { formatTime } from '../core/format'
import type { LibraryPayload, Track } from './vite-env'

type CalibrateMode = 'fit' | 'line'

type Hit = {
  id: number | string
  title: string
  artist: string
  album: string
  duration: number
  syncedLyrics: string | null
  plainLyrics: string | null
  source: string
}

type Props = {
  open: boolean
  tracks: Track[]
  initialTrackId?: string | null
  /** 打开时加载该曲已有歌词进入编辑 */
  initialEditExisting?: boolean
  lyricsRootAbs?: string | null
  onClose: () => void
  onSaved: (library: LibraryPayload) => void
  onLyricsRootChange: (library: LibraryPayload, absPath: string | null) => void
  /** 试听开始/结束时通知，用于挂起/恢复主播放 */
  onPreviewPlayingChange?: (playing: boolean) => void
}

export default function LyricsMatchDrawer({
  open,
  tracks,
  initialTrackId,
  initialEditExisting = false,
  lyricsRootAbs,
  onClose,
  onSaved,
  onLyricsRootChange,
  onPreviewPlayingChange,
}: Props) {
  const missing = useMemo(() => tracks.filter((t) => !t.lyricsRel), [tracks])
  const [trackQuery, setTrackQuery] = useState('')
  const [sortKey, setSortKey] = useState<LibrarySortKey>('title')
  const [sortDir, setSortDir] = useState<LibrarySortDir>('asc')
  const [wbTags, setWbTags] = useState<WorkbenchTag[]>([])
  const [wbByTrack, setWbByTrack] = useState<WorkbenchTagMap>({})
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([VIRTUAL_TAG_MISSING])
  const [newTagName, setNewTagName] = useState('')
  const [libLyricsOpen, setLibLyricsOpen] = useState(false)
  const [libLyricsQuery, setLibLyricsQuery] = useState('')

  const list = useMemo(() => {
    const filtered = filterWorkbenchTracks(tracks, {
      query: trackQuery,
      selectedTagIds,
      byTrack: wbByTrack,
    })
    return sortLibraryTracks(filtered, sortKey, sortDir)
  }, [tracks, trackQuery, selectedTagIds, wbByTrack, sortKey, sortDir])

  const [activeId, setActiveId] = useState<string | null>(null)
  const active = list.find((t) => t.id === activeId) || list[0] || null

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [selectedHitId, setSelectedHitId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [rawLrc, setRawLrc] = useState('')
  const [offsetMs, setOffsetMs] = useState(0)
  const [rate, setRate] = useState(1)
  const [offsetStep, setOffsetStep] = useState(50)
  const [samples, setSamples] = useState<LyricTimingSample[]>([])
  const [calibrateMode, setCalibrateMode] = useState<CalibrateMode>('fit')
  const [lineTimes, setLineTimes] = useState<number[] | null>(null)
  const [lineCursor, setLineCursor] = useState(0)
  const [stampedLines, setStampedLines] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [previewKey, setPreviewKey] = useState(0)
  const [lyricsFollowKey, setLyricsFollowKey] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [pasteHeight, setPasteHeight] = useState(96)
  /** 试听音量（独立于主播放器，本地记住） */
  const [previewVolume, setPreviewVolume] = useState(() => {
    const raw = Number(window.localStorage.getItem('qmusic.previewVolume'))
    return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 0.85
  })
  const [previewMuted, setPreviewMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  /** 已装载的试听地址，避免重复 load 打断播放 */
  const previewUrlRef = useRef('')
  const onPreviewPlayingChangeRef = useRef(onPreviewPlayingChange)
  onPreviewPlayingChangeRef.current = onPreviewPlayingChange
  const pendingEditExisting = useRef(false)
  const pasteResizeRef = useRef<{ startY: number; startH: number } | null>(null)

  useEffect(() => {
    window.localStorage.setItem('qmusic.previewVolume', String(previewVolume))
  }, [previewVolume])

  const markDirty = () => setDirty(true)

  const applyLoadedLyrics = (text: string, label: string, opts?: { dirty?: boolean }) => {
    const cleaned = text.replace(/^\uFEFF/, '')
    setSelectedHitId(null)
    setRawLrc(cleaned)
    setOffsetMs(0)
    setRate(1)
    setSamples([])
    setPlaying(false)
    setT(0)
    setPreviewKey((k) => k + 1)
    if (opts?.dirty !== false) markDirty()
    else setDirty(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    const next = resolveLyricLines(cleaned)
    if (next.fromPlain) {
      setCalibrateMode('line')
      setLineTimes(next.lines.map(() => 0))
      setStampedLines([])
      setLineCursor(0)
      setMsg(`${label}（纯文本 ${next.lines.length} 行）：请逐句对点或改字`)
    } else {
      setLineTimes(null)
      setStampedLines([])
      setLineCursor(0)
      setCalibrateMode('fit')
      setMsg(`${label}（${next.lines.length} 行）· 保存时才覆盖文件`)
    }
  }

  const loadExistingLyrics = async (trackId?: string, opts?: { dirty?: boolean }) => {
    const id = trackId || active?.id
    if (!id) return
    setBusy(true)
    setMsg('正在加载已有歌词…')
    try {
      const res = await window.qmusic.loadLyricsForTrack(id)
      if (!res.content?.trim()) {
        setMsg('当前曲目没有已绑定的歌词内容')
        return
      }
      applyLoadedLyrics(res.content, '已载入现有歌词', { dirty: opts?.dirty !== false })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '加载已有歌词失败')
    } finally {
      setBusy(false)
    }
  }

  const resetPreview = (nextRaw = '') => {
    setRawLrc(nextRaw)
    setOffsetMs(0)
    setRate(1)
    setSamples([])
    setCalibrateMode('fit')
    setLineTimes(null)
    setLineCursor(0)
    setStampedLines([])
    setPlaying(false)
    setT(0)
    setPreviewKey((k) => k + 1)
    setDirty(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  /** 切换曲目前若有未保存改动：先确认，避免静默丢弃（旧实现直接 setActiveId） */
  const requestSwitchTrack = (id: string) => {
    if (id === active?.id) return
    if (dirty && !window.confirm('当前曲目有未保存的歌词改动，切换将丢弃这些改动，确定切换？')) return
    setActiveId(id)
  }

  // 打开抽屉时：载入标签 + 初始选中（勿依赖 list，否则标签回写会把选中打回第一首）
  useEffect(() => {
    if (!open) {
      pendingEditExisting.current = false
      return
    }
    if (initialEditExisting) {
      setSelectedTagIds([])
      pendingEditExisting.current = true
    }
    void window.qmusic.getWorkbenchTags().then((res) => {
      setWbTags(res.tags || [])
      setWbByTrack(res.byTrack || {})
    })
    const pool = tracks
    const id =
      initialTrackId && pool.some((x) => x.id === initialTrackId)
        ? initialTrackId
        : pool[0]?.id || null
    setActiveId(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在打开/指定曲目变化时初始化选中
  }, [open, initialTrackId, initialEditExisting])

  // 筛选后当前曲不在列表里时，落到可见第一首
  useEffect(() => {
    if (!open) return
    if (!list.length) {
      setActiveId(null)
      return
    }
    setActiveId((prev) => (prev && list.some((t) => t.id === prev) ? prev : list[0]!.id))
  }, [open, list])

  const toggleFilterTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  const applyWbState = (res: { tags: WorkbenchTag[]; byTrack: WorkbenchTagMap }) => {
    setWbTags(res.tags || [])
    setWbByTrack(res.byTrack || {})
  }

  const onAddTag = async () => {
    const name = newTagName.trim()
    if (!name) return
    const res = await window.qmusic.addWorkbenchTag(name)
    applyWbState(res)
    setNewTagName('')
  }

  const onRemoveTagDef = async (tagId: string) => {
    const res = await window.qmusic.removeWorkbenchTag(tagId)
    applyWbState(res)
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId))
  }

  const onToggleTrackTag = async (tagId: string) => {
    if (!active) return
    const cur = new Set(wbByTrack[active.id] || [])
    if (cur.has(tagId)) cur.delete(tagId)
    else cur.add(tagId)
    const res = await window.qmusic.setTrackWorkbenchTags(active.id, [...cur])
    applyWbState(res)
  }

  const configuredTracks = useMemo(() => {
    const q = libLyricsQuery.trim().toLowerCase()
    return tracks
      .filter((t) => t.lyricsRel)
      .filter((t) => {
        if (!q) return true
        const hay = [t.title, t.titleZh, t.titleEn, t.titleJa, t.artist, t.album]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 80)
  }, [tracks, libLyricsQuery])

  const loadFromConfiguredTrack = async (trackId: string) => {
    if (!active) return
    setBusy(true)
    setMsg('正在加载已配歌词…')
    try {
      const res = await window.qmusic.loadLyricsForTrack(trackId)
      if (!res.content?.trim()) {
        setMsg('所选曲目没有可读歌词内容')
        return
      }
      const src = tracks.find((t) => t.id === trackId)
      const label = src
        ? `已从「${src.titleZh || src.title || '曲目'}」载入`
        : '已从已配歌词库载入'
      applyLoadedLyrics(res.content, label, { dirty: true })
      setLibLyricsOpen(false)
      setSelectedHitId(null)
      setHits([])
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '加载失败')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!active) {
      setQuery('')
      return
    }
    const q = buildLyricsSearchQuery(active)
    setQuery(q.q)
    setHits([])
    setSelectedHitId(null)
    resetPreview('')
    setMsg(null)
    // 已配曲：先展示现有歌词；重新搜索/粘贴可改预览，仅保存时覆盖
    if (pendingEditExisting.current || active.lyricsRel) {
      pendingEditExisting.current = false
      void loadExistingLyrics(active.id, { dirty: false })
    }
  }, [active?.id])

  const resolved = useMemo(() => (rawLrc.trim() ? resolveLyricLines(rawLrc) : null), [rawLrc])
  const fromPlain = Boolean(resolved?.fromPlain)
  const hasLines = Boolean(resolved?.lines.length)
  const originLines = resolved?.lines
  const previewLines: LyricLine[] = useMemo(() => {
    if (!originLines?.length) return []
    if (calibrateMode === 'line' && lineTimes && lineTimes.length === originLines.length) {
      if (fromPlain) {
        // 未标注句放到远处，避免全 0 时高亮跳到最后一行
        const base = originLines.map((l, i) => ({
          ...l,
          timeMs: stampedLines.includes(i) ? lineTimes[i]! : 1_000_000_000 + i,
        }))
        return transformLyricLines(base, { offsetMs, rate })
      }
      return transformLyricLines(applyLineTimes(originLines, lineTimes), { offsetMs, rate })
    }
    if (fromPlain) {
      if (lineTimes && lineTimes.length === originLines.length) {
        const base = originLines.map((l, i) => ({
          ...l,
          timeMs: stampedLines.includes(i) ? lineTimes[i]! : 1_000_000_000 + i,
        }))
        return transformLyricLines(base, { offsetMs, rate })
      }
      return originLines.map((l, i) => ({ ...l, timeMs: 1_000_000_000 + i }))
    }
    return transformLyricLines(originLines, { offsetMs, rate })
  }, [originLines, offsetMs, rate, calibrateMode, lineTimes, fromPlain, stampedLines])
  const markedIndices = useMemo(() => {
    if (calibrateMode === 'line' || fromPlain) return stampedLines
    return samples.map((s) => s.lineIndex).filter((i): i is number => i != null)
  }, [calibrateMode, fromPlain, stampedLines, samples])

  const seekBy = (deltaSec: number) => {
    const a = audioRef.current
    if (!a) return
    const next = Math.max(0, Math.min(dur || a.duration || 0, (a.currentTime || 0) + deltaSec))
    a.currentTime = next
    setT(next)
  }

  /** 播放绝对时间 → 源时间轴（再经 offset/rate 变换后对齐播放） */
  const playMsToSourceMs = (playTimeMs: number) => {
    const r = rate || 1
    return Math.max(0, Math.round((playTimeMs - offsetMs) / r))
  }

  const enterLineMode = (seedLines?: LyricLine[]) => {
    const lines = seedLines || originLines
    if (!lines?.length) return
    // 保留当前偏移/倍率：逐句时间轴用原始 LRC 时间，预览时再套 transform
    setLineTimes(lines.map((l) => l.timeMs))
    setStampedLines([])
    setLineCursor(0)
    setCalibrateMode('line')
    setMsg(
      fromPlain || seedLines
        ? '纯文本已按换行分段：播放到该句时点击行或「标记当前句」钉时间；仍可用左侧偏移/倍率整体微调'
        : '逐句对点：左键钉时间；偏移/倍率仍可用，方便整体调整',
    )
  }

  // 纯文本自动进入逐句模式
  useEffect(() => {
    if (!fromPlain || !originLines?.length) return
    if (calibrateMode !== 'line' || !lineTimes || lineTimes.length !== originLines.length) {
      setLineTimes(originLines.map((l) => l.timeMs))
      setCalibrateMode('line')
      setStampedLines((prev) => prev.filter((i) => i < originLines.length))
      setLineCursor((c) => Math.min(c, originLines.length - 1))
    }
  }, [fromPlain, originLines, calibrateMode, lineTimes])

  const stampLineAtPlay = (index: number) => {
    if (!originLines || !lineTimes) return
    const playTimeMs = Math.round((audioRef.current?.currentTime ?? t) * 1000)
    const nextTimes = [...lineTimes]
    // 存源时间，预览/保存再套偏移与倍率
    nextTimes[index] = playMsToSourceMs(playTimeMs)
    setLineTimes(nextTimes)
    setStampedLines((prev) => (prev.includes(index) ? prev : [...prev, index].sort((a, b) => a - b)))
    const nextCursor = Math.min(index + 1, originLines.length - 1)
    setLineCursor(nextCursor)
    markDirty()
    setMsg(
      `已标记第 ${index + 1} 句 → ${formatTime(playTimeMs / 1000)}` +
        (index + 1 < originLines.length ? ` · 下一目标第 ${nextCursor + 1} 句` : ' · 已到末句') +
        ' · 右键可撤销',
    )
  }

  /** 右键撤销单句定位（逐句）或采点（整体） */
  const undoLineStamp = (index: number) => {
    if (!originLines) return
    if (calibrateMode === 'line' || fromPlain) {
      if (!stampedLines.includes(index)) {
        setMsg(`第 ${index + 1} 句尚未定位`)
        return
      }
      setStampedLines((prev) => prev.filter((i) => i !== index))
      if (lineTimes) {
        const next = [...lineTimes]
        next[index] = fromPlain ? 0 : (originLines[index]?.timeMs ?? next[index])
        setLineTimes(next)
      }
      setLineCursor(index)
      markDirty()
      setMsg(`已撤销第 ${index + 1} 句定位`)
      return
    }
    if (!samples.some((s) => s.lineIndex === index)) {
      setMsg(`第 ${index + 1} 句无采点`)
      return
    }
    const next = samples.filter((s) => s.lineIndex !== index)
    setSamples(next)
    markDirty()
    setMsg(`已撤销第 ${index + 1} 句采点（剩 ${next.length}）`)
  }

  const applyFitFromSamples = (pts: LyricTimingSample[], autoMsg: boolean) => {
    const fit = fitLyricTiming(pts)
    if (!fit) return
    setOffsetMs(fit.offsetMs)
    setRate(fit.rate)
    if (autoMsg) {
      setMsg(
        `自动填充：偏移 ${fit.offsetMs >= 0 ? '+' : ''}${fit.offsetMs} ms` +
          ` · 速率 ${fit.rate}` +
          ` · 残差≈${fit.rmseMs}ms` +
          `（已采 ${fit.sampleCount} 点` +
          (fit.rateNearOne ? '，接近纯偏移）' : '，存在速率差）'),
      )
    }
  }

  useEffect(() => {
    const a = audioRef.current
    if (!a || !active) return
    if (previewUrlRef.current === active.fileUrl) return
    previewUrlRef.current = active.fileUrl
    a.src = active.fileUrl
    a.load()
    setPlaying(false)
    setT(0)
    setDur(0)
  }, [active?.id, active?.fileUrl])

  // 播放意图 → 音频元素。失败要让用户看见原因：旧实现静默 catch 成「点了没反应」
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      if (!a.currentSrc && !a.getAttribute('src')) {
        setMsg('无法播放：该曲目缺少音频地址，可到首页「重新扫描曲库」后再试')
        setPlaying(false)
      } else {
        const p = a.play()
        if (p) {
          p.catch((err: unknown) => {
            // load/切曲造成的打断属正常竞态，不算失败
            if ((err as { name?: string })?.name === 'AbortError') return
            console.warn('[Q-Music] 工作台试听播放失败', err)
            setMsg(`无法播放：${(err as { message?: string })?.message || '原因未知'}`)
            setPlaying(false)
          })
        }
      }
    } else {
      a.pause()
    }
    onPreviewPlayingChangeRef.current?.(playing)
  }, [playing])

  // 以元素真实状态为准：自行停下/解码失败时纠正按钮态
  useEffect(() => {
    if (!open) return
    const a = audioRef.current
    if (!a) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onErr = () => {
      console.warn('[Q-Music] 工作台音频加载失败', a.error)
      setMsg('无法播放：音频加载失败（文件可能已移动，或格式不受支持）')
      setPlaying(false)
    }
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('error', onErr)
    return () => {
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('error', onErr)
    }
  }, [open])

  // 试听音量 / 静音
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = previewVolume
    a.muted = previewMuted
  }, [previewVolume, previewMuted, open, active?.id])

  useEffect(() => {
    if (open) return
    setPlaying(false)
    onPreviewPlayingChangeRef.current?.(false)
  }, [open])

  if (!open) return null

  const search = async () => {
    if (!active) return
    setBusy(true)
    setMsg('搜索中（已限速，自动清洗歌名并多策略重试）…')
    try {
      const built = buildLyricsSearchQuery(active)
      const q = cleanLyricsTitle(query.trim()) || query.trim() || built.q
      if (q !== query) setQuery(q)
      const res = await window.qmusic.searchLyrics({
        title: built.title,
        artist: built.artist || undefined,
        q,
        track: {
          title: active.title,
          titleZh: active.titleZh,
          titleEn: active.titleEn,
          titleJa: active.titleJa,
          artist: active.artist,
          pathRel: active.pathRel,
        },
      })
      setHits(res.hits)
      setSelectedHitId(null)
      resetPreview('')
      setMsg(
        res.hits.length
          ? `找到 ${res.hits.length} 条候选（尝试 ${res.attemptsUsed} 次${res.lastLabel ? ` · ${res.lastLabel}` : ''}）`
          : `未找到歌词（已试 ${res.attemptsUsed} 次），可改关键词或粘贴 LRC`,
      )
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '搜索失败')
      setHits([])
    } finally {
      setBusy(false)
    }
  }

  const pickHit = (h: Hit) => {
    const synced = Boolean(h.syncedLyrics?.trim())
    const text = (h.syncedLyrics || h.plainLyrics || '').replace(/^\uFEFF/, '')
    setSelectedHitId(String(h.id))
    setRawLrc(text)
    setOffsetMs(0)
    setRate(1)
    setSamples([])
    setPlaying(false)
    setT(0)
    setPreviewKey((k) => k + 1)
    setDirty(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (!synced && text.trim()) {
      const lines = resolveLyricLines(text).lines
      setLineTimes(lines.map(() => 0))
      setStampedLines([])
      setLineCursor(0)
      setCalibrateMode('line')
      setMsg(
        `已载入纯文本（${lines.length} 行）：${h.title} — ${h.artist}。请逐句对点；可在文本框改字`,
      )
    } else {
      setLineTimes(null)
      setStampedLines([])
      setLineCursor(0)
      setCalibrateMode('fit')
      setMsg(synced ? `已载入带时间轴：${h.title} — ${h.artist}` : '无歌词内容')
    }
  }

  const pickRoot = async () => {
    setBusy(true)
    try {
      const res = await window.qmusic.pickLyricsRoot()
      onLyricsRootChange(res.library, res.absPath)
      setMsg(res.absPath ? `歌词目录：${res.absPath}` : '未选择目录')
    } finally {
      setBusy(false)
    }
  }

  const clearRoot = async () => {
    setBusy(true)
    try {
      const res = await window.qmusic.clearLyricsRoot()
      onLyricsRootChange(res.library, null)
      setMsg('已清除歌词目录；保存将写回音频同目录')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!active || !rawLrc.trim()) return
    const resolvedNow = resolveLyricLines(rawLrc)
    let content: string
    if (!resolvedNow.lines.length) {
      content = rawLrc.replace(/^\uFEFF/, '')
      if (!content.endsWith('\n')) content += '\n'
    } else {
      const linesForSave =
        (calibrateMode === 'line' || resolvedNow.fromPlain) &&
        lineTimes &&
        lineTimes.length === resolvedNow.lines.length
          ? transformLyricLines(applyLineTimes(resolvedNow.lines, lineTimes), {
              offsetMs,
              rate,
            })
          : transformLyricLines(resolvedNow.lines, { offsetMs, rate })
      content = serializeLrc({
        lines: linesForSave,
        meta: {
          ti: active.titleZh || active.title || resolvedNow.meta.ti || '',
          ar: active.artist || resolvedNow.meta.ar || '',
          by: 'Q-Music',
        },
        offsetMs: 0,
      })
    }
    if (active.lyricsRel) {
      const title = active.titleZh || active.titleJa || active.titleEn || active.title || '当前曲目'
      const ok = window.confirm(`「${title}」已有歌词文件，确定覆盖保存？`)
      if (!ok) return
    }
    setBusy(true)
    try {
      const res = await window.qmusic.saveLyricsToTrack(active.id, content)
      if (!res.ok) {
        setMsg(res.error || '保存失败')
        throw new Error(res.error || '保存失败')
      }
      setMsg(`已保存 ${res.path}`)
      setDirty(false)
      onSaved(res.library)
      const nextMissing = res.library.playable.filter((x) => !x.lyricsRel && x.id !== active.id)
      if (selectedTagIds.includes(VIRTUAL_TAG_MISSING) && nextMissing[0]) {
        setActiveId(nextMissing[0].id)
      }
    } finally {
      setBusy(false)
    }
  }

  const saveHint = lyricsRootAbs
    ? `确认保存到歌词目录（与音频同主文件名 .lrc）`
    : `确认保存为音频同目录同名 .lrc`

  return (
    <DrawerShell
      open={open}
      title="歌词匹配工作台"
      onClose={onClose}
      dirty={dirty}
      onSave={save}
      maskClassName="lm-mask"
      panelClassName="theme-drawer lyrics-match"
    >
      <div className="lm-root-bar">
        <div className="lm-root-path" title={lyricsRootAbs || '未设置（默认写在音频旁）'}>
          歌词目录：{lyricsRootAbs || '未设置（保存到音频同目录）'}
        </div>
        <div className="panel-tools">
          <button type="button" className="ghost" disabled={busy} onClick={() => void pickRoot()}>
            选择目录
          </button>
          <button type="button" className="ghost" disabled={busy || !lyricsRootAbs} onClick={() => void clearRoot()}>
            清除
          </button>
        </div>
      </div>

      <p className="theme-tip">
        搜索 → 点选候选 → 中栏文本下校准 → 右栏试听对点（左键定位，右键撤销单句）→ 保存。
      </p>

      <div className="lm-grid">
        <section className="lm-col">
          <div className="lm-track-tools">
            <input
              type="search"
              className="library-search lm-track-search"
              placeholder="筛选曲目 / 艺人"
              value={trackQuery}
              onChange={(e) => setTrackQuery(e.target.value)}
              aria-label="工作台曲目搜索"
            />
            <div className="library-sort">
              <UiSelect
                className="library-sort-select"
                aria-label="工作台排序"
                value={sortKey}
                options={[
                  { value: 'title', label: '歌名' },
                  { value: 'artist', label: '歌手' },
                  { value: 'mtime', label: '修改时间' },
                  { value: 'birthtime', label: '创建时间' },
                ]}
                onChange={(v) => setSortKey(v as LibrarySortKey)}
              />
              <button
                type="button"
                className="library-sort-dir"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              >
                {sortDir === 'asc' ? '升序' : '降序'}
              </button>
            </div>
          </div>
          <div className="lm-tag-filters" role="group" aria-label="标签筛选（多选且需同时满足）">
            {VIRTUAL_WORKBENCH_TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`lm-tag-chip ${selectedTagIds.includes(t.id) ? 'on' : ''}`}
                onClick={() => toggleFilterTag(t.id)}
              >
                {t.name}
                {t.id === VIRTUAL_TAG_MISSING ? ` ${missing.length}` : ''}
                {t.id === VIRTUAL_TAG_CONFIGURED ? ` ${tracks.length - missing.length}` : ''}
              </button>
            ))}
            {wbTags.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`lm-tag-chip ${selectedTagIds.includes(t.id) ? 'on' : ''}`}
                onClick={() => toggleFilterTag(t.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (window.confirm(`删除标签「${t.name}」？`)) void onRemoveTagDef(t.id)
                }}
                title="左键筛选；右键删除标签定义"
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="lm-tag-add">
            <input
              type="text"
              value={newTagName}
              placeholder="新标签名"
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onAddTag()
              }}
            />
            <button type="button" className="ghost" disabled={!newTagName.trim()} onClick={() => void onAddTag()}>
              添加标签
            </button>
          </div>
          {active && wbTags.length > 0 && (
            <div className="lm-tag-assign">
              <span className="theme-tip">当前曲目标记：</span>
              {wbTags.map((t) => {
                const on = (wbByTrack[active.id] || []).includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`lm-tag-chip sm ${on ? 'on' : ''}`}
                    onClick={() => void onToggleTrackTag(t.id)}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>
          )}
          <p className="theme-tip">
            列表 {list.length}/{tracks.length} · 标签多选为同时满足 · 右键标签可删
          </p>
          <ul className="list lm-list">
            {list.map((row) => (
              <li key={row.id} className={row.id === active?.id ? 'active' : ''}>
                <button type="button" className="row" onClick={() => requestSwitchTrack(row.id)}>
                  <span className={`lyric-flag ${row.lyricsRel ? 'on' : 'off'}`}>
                    {row.lyricsRel ? '词' : '·'}
                  </span>
                  <span className="title">
                    {row.titleJa || row.titleEn || row.titleZh || row.title}
                  </span>
                  <span className="meta">{row.artist}</span>
                </button>
              </li>
            ))}
            {!list.length && <li className="empty">没有匹配曲目</li>}
          </ul>
        </section>

        <section className="lm-col">
          <div className="panel-toolbar">
            <input
              className="lm-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索关键词（歌名/艺人）"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search()
              }}
            />
            <button type="button" className="primary" disabled={busy || !active} onClick={() => void search()}>
              搜索
            </button>
            <button
              type="button"
              className="ghost"
              disabled={busy || !active?.lyricsRel}
              title={active?.lyricsRel ? '载入并编辑已绑定的歌词' : '当前曲目未绑定歌词'}
              onClick={() => void loadExistingLyrics()}
            >
              编辑已有歌词
            </button>
            <button
              type="button"
              className={`ghost ${libLyricsOpen ? 'active-toggle' : ''}`}
              disabled={busy || !active}
              title="从曲库已配歌词中搜索并载入内容，再为本曲配置"
              onClick={() => setLibLyricsOpen((v) => !v)}
            >
              {libLyricsOpen ? '收起已配库' : '加载现有歌词'}
            </button>
          </div>
          {libLyricsOpen && (
            <div className="lm-lib-lyrics">
              <input
                type="search"
                className="library-search"
                placeholder="搜索已配歌词的曲目…"
                value={libLyricsQuery}
                onChange={(e) => setLibLyricsQuery(e.target.value)}
                aria-label="搜索已配歌词"
              />
              <ul className="list lm-list lm-hits">
                {configuredTracks.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="row lm-hit-row"
                      disabled={busy || row.id === active?.id}
                      onClick={() => void loadFromConfiguredTrack(row.id)}
                    >
                      <span className="lm-hit-title">
                        {row.titleZh || row.titleJa || row.titleEn || row.title}
                      </span>
                      <span className="lm-hit-meta">
                        {row.artist || '未知艺人'}
                        {row.id === active?.id ? ' · 当前曲' : ''}
                      </span>
                    </button>
                  </li>
                ))}
                {!configuredTracks.length && <li className="empty">没有已配歌词可加载</li>}
              </ul>
            </div>
          )}
          <ul className="list lm-list lm-hits">
            {hits.map((h) => (
              <li key={String(h.id)} className={selectedHitId === String(h.id) ? 'active' : ''}>
                <button type="button" className="row lm-hit-row" onClick={() => pickHit(h)}>
                  <span className="lm-hit-title">
                    {h.title}
                    {h.album ? ` · ${h.album}` : ''}
                  </span>
                  <span className="lm-hit-meta">
                    {h.artist || '未知艺人'}
                    {h.syncedLyrics ? ' · LRC' : ' · 纯文本'}
                    {h.duration ? ` · ${Math.round(h.duration)}s` : ''}
                  </span>
                </button>
              </li>
            ))}
            {!hits.length && <li className="empty">搜索结果出现在这里</li>}
          </ul>
          <label className="theme-field">
            <span>{fromPlain ? '歌词文本（可改；按换行分段）' : '或粘贴 / 编辑 LRC 文本'}</span>
            <div className="lm-paste-wrap" style={{ height: pasteHeight }}>
              <div className="lm-paste-bar">
                <span className="lm-paste-bar-hint">拖右上角调高度</span>
                <button
                  type="button"
                  className="lm-paste-resize"
                  title="拖动调整高度（上移加高）"
                  aria-label="拖动调整高度"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const startY = e.clientY
                    const startH = pasteHeight
                    pasteResizeRef.current = { startY, startH }
                    const target = e.currentTarget
                    target.setPointerCapture(e.pointerId)
                    const onMove = (ev: PointerEvent) => {
                      const st = pasteResizeRef.current
                      if (!st) return
                      const next = Math.min(420, Math.max(72, st.startH + (st.startY - ev.clientY)))
                      setPasteHeight(next)
                    }
                    const onUp = (ev: PointerEvent) => {
                      pasteResizeRef.current = null
                      target.releasePointerCapture(ev.pointerId)
                      target.removeEventListener('pointermove', onMove)
                      target.removeEventListener('pointerup', onUp)
                      target.removeEventListener('pointercancel', onUp)
                    }
                    target.addEventListener('pointermove', onMove)
                    target.addEventListener('pointerup', onUp)
                    target.addEventListener('pointercancel', onUp)
                  }}
                />
              </div>
              <textarea
                className="lm-paste"
                value={rawLrc}
                onChange={(e) => {
                  const text = e.target.value
                  setSelectedHitId(null)
                  setRawLrc(text)
                  setPreviewKey((k) => k + 1)
                  markDirty()
                  const next = resolveLyricLines(text)
                  if (next.fromPlain) {
                    setCalibrateMode('line')
                    setLineTimes((prev) => next.lines.map((_, i) => prev?.[i] ?? 0))
                    setStampedLines((prev) => prev.filter((i) => i < next.lines.length))
                    // 逐行模式下改字不清空偏移/倍率：编辑文本不该丢掉已调好的校准（需要时用「归零」）
                    setSamples([])
                  } else if (next.lines.length) {
                    setSamples([])
                  } else {
                    setLineTimes(null)
                    setStampedLines([])
                  }
                }}
                placeholder="粘贴 LRC，或纯文本（每行一句）…"
              />
            </div>
          </label>

          <div className="lm-col-tune">
            <div className="seg lm-mode-seg">
              <button
                type="button"
                className={calibrateMode === 'fit' ? 'on' : ''}
                disabled={!hasLines || fromPlain}
                title={fromPlain ? '纯文本无原始时间轴，请用逐句对点' : undefined}
                onClick={() => {
                  setCalibrateMode('fit')
                  setMsg('整体校准：采 3～4 点估算偏移与速率')
                }}
              >
                整体偏移/速率
              </button>
              <button
                type="button"
                className={calibrateMode === 'line' ? 'on' : ''}
                disabled={!hasLines}
                onClick={() => enterLineMode()}
              >
                逐句对点
              </button>
            </div>

            <label className="theme-field">
              <span>偏移 (ms) · 步进可改{calibrateMode === 'line' ? ' · 逐句模式可整体微调' : ''}</span>
              <div className="lm-num-row">
                <button
                  type="button"
                  className="ghost"
                  disabled={!hasLines}
                  onClick={() => {
                    setOffsetMs((v) => v - Math.abs(offsetStep || 50))
                    markDirty()
                  }}
                >
                  −
                </button>
                <input
                  className="lm-num"
                  type="number"
                  value={offsetMs}
                  disabled={!hasLines}
                  onChange={(e) => {
                    setOffsetMs(Number(e.target.value) || 0)
                    markDirty()
                  }}
                />
                <button
                  type="button"
                  className="ghost"
                  disabled={!hasLines}
                  onClick={() => {
                    setOffsetMs((v) => v + Math.abs(offsetStep || 50))
                    markDirty()
                  }}
                >
                  +
                </button>
                <input
                  className="lm-num lm-step"
                  type="number"
                  min={1}
                  title="加减步进 ms"
                  value={offsetStep}
                  disabled={!hasLines}
                  onChange={(e) => setOffsetStep(Math.max(1, Number(e.target.value) || 50))}
                />
                <button
                  type="button"
                  className="ghost"
                  disabled={!hasLines}
                  onClick={() => {
                    setOffsetMs(0)
                    markDirty()
                  }}
                >
                  归零
                </button>
              </div>
            </label>

            <label className="theme-field">
              <span>速率（相对源时间轴，1 = 相同）</span>
              <div className="lm-num-row">
                <button
                  type="button"
                  className="ghost"
                  disabled={!hasLines}
                  onClick={() => {
                    setRate((v) => Math.round((v - 0.01) * 10000) / 10000)
                    markDirty()
                  }}
                >
                  −
                </button>
                <input
                  className="lm-num"
                  type="number"
                  step={0.001}
                  min={0.5}
                  max={2}
                  value={rate}
                  disabled={!hasLines}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setRate(Number.isFinite(n) ? n : 1)
                    markDirty()
                  }}
                />
                <button
                  type="button"
                  className="ghost"
                  disabled={!hasLines}
                  onClick={() => {
                    setRate((v) => Math.round((v + 0.01) * 10000) / 10000)
                    markDirty()
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={!hasLines}
                  onClick={() => {
                    setRate(1)
                    markDirty()
                  }}
                >
                  1.0
                </button>
              </div>
            </label>

            {calibrateMode === 'fit' ? (
              <div className="theme-field">
                <span>采点估算（建议 3～4 点）· 右栏点行采点，右键撤销</span>
                <div className="panel-tools">
                  <button
                    type="button"
                    className="ghost"
                    disabled={!hasLines || samples.length < 2}
                    onClick={() => {
                      applyFitFromSamples(samples, true)
                      markDirty()
                    }}
                  >
                    用当前点重新计算
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={!samples.length}
                    onClick={() => {
                      setSamples([])
                      markDirty()
                      setMsg('已清空采点')
                    }}
                  >
                    清空采点 ({samples.length})
                  </button>
                </div>
                {samples.length > 0 && (
                  <ul className="lm-samples">
                    {samples.map((s, i) => (
                      <li key={`${s.lineIndex}-${s.playTimeMs}-${i}`}>
                        #{(s.lineIndex ?? 0) + 1} LRC {formatTime(s.lyricTimeMs / 1000)} → 播放{' '}
                        {formatTime(s.playTimeMs / 1000)}
                        {s.text ? ` · ${s.text.slice(0, 16)}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="theme-field">
                <span>
                  逐句对点 · 已标 {stampedLines.length}/{originLines?.length || 0} · 目标第 {lineCursor + 1}{' '}
                  句
                </span>
                <p className="theme-tip">
                  右栏左键钉时间，右键撤销；上方偏移/倍率对全部句子整体生效。
                </p>
                <div className="panel-tools">
                  <button
                    type="button"
                    className="primary"
                    disabled={!hasLines || !lineTimes}
                    onClick={() => stampLineAtPlay(lineCursor)}
                  >
                    标记当前目标句
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={!hasLines || lineCursor <= 0}
                    onClick={() => setLineCursor((c) => Math.max(0, c - 1))}
                  >
                    上一目标
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={!hasLines || !originLines || lineCursor >= originLines.length - 1}
                    onClick={() =>
                      setLineCursor((c) => Math.min((originLines?.length || 1) - 1, c + 1))
                    }
                  >
                    下一目标
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={!stampedLines.length}
                    onClick={() => undoLineStamp(lineCursor)}
                  >
                    撤销目标句
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={!stampedLines.length}
                    onClick={() => {
                      if (!originLines) return
                      if (fromPlain) {
                        setLineTimes(originLines.map(() => 0))
                        setStampedLines([])
                        setLineCursor(0)
                        markDirty()
                        setMsg('已清空逐句时间，请重新对点')
                        return
                      }
                      setLineTimes(originLines.map((l) => l.timeMs))
                      setStampedLines([])
                      setLineCursor(0)
                      markDirty()
                      setMsg('已重置逐句时间（回到原始 LRC；偏移/倍率仍生效）')
                    }}
                  >
                    重置逐句
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="lm-col lm-preview">
          <div className="lm-preview-play">
            <div className="now-title">
              {active ? active.titleZh || active.titleJa || active.title : '未选曲'}
            </div>
            <audio
              ref={audioRef}
              preload="metadata"
              onTimeUpdate={() => setT(audioRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDur(audioRef.current?.duration || 0)}
              onEnded={() => setPlaying(false)}
            />
            <div className="lm-transport">
              <div className="lm-transport-main">
                <TransportButtons
                  compact
                  playing={playing}
                  disabled={!active}
                  onToggle={() => setPlaying((p) => !p)}
                  onSeekBack={() => seekBy(-5)}
                  onSeekFwd={() => seekBy(5)}
                />
                <span className="theme-tip lm-time">
                  {formatTime(t)} / {formatTime(dur)}
                </span>
              </div>
              <div className="lm-vol-row">
                <button
                  type="button"
                  className={`ctrl-btn lm-vol-btn ${previewMuted ? 'off' : ''}`}
                  title={previewMuted ? '取消静音' : '静音'}
                  aria-label={previewMuted ? '取消静音' : '静音'}
                  onClick={() => setPreviewMuted((m) => !m)}
                >
                  {previewMuted ? (
                    <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M4 9h3l4-3.5v13L7 15H4V9zm11.7-.9 1.4 1.4L15.4 12l1.7 1.7-1.4 1.4L14 13.4l-1.7 1.7-1.4-1.4L12.6 12l-1.7-1.7 1.4-1.4L14 10.6l1.7-1.5z"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M4 9h3l4-3.5v13L7 15H4V9zm9.5-.9a4.6 4.6 0 0 1 0 7.8v-1.7a3 3 0 0 0 0-4.4V8.1zm2-2.6a7.6 7.6 0 0 1 0 13v-1.8a5.8 5.8 0 0 0 0-9.4V5.5z"
                      />
                    </svg>
                  )}
                </button>
                <input
                  className="ui-range lm-vol"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={previewVolume}
                  title={`试听音量 ${Math.round(previewVolume * 100)}%`}
                  aria-label="试听音量"
                  style={
                    { '--range-progress': `${previewVolume * 100}%` } as CSSProperties
                  }
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setPreviewVolume(v)
                    if (previewMuted && v > 0) setPreviewMuted(false)
                  }}
                />
                <span className="theme-tip lm-vol-num">{Math.round(previewVolume * 100)}%</span>
              </div>
            </div>
            <input
              className="ui-range"
              type="range"
              min={0}
              max={dur || 0}
              step={0.1}
              value={Math.min(t, dur || 0)}
              disabled={!active}
              style={
                {
                  '--range-progress': `${dur > 0 ? (Math.min(t, dur) / dur) * 100 : 0}%`,
                } as CSSProperties
              }
              onPointerDown={() => setLyricsFollowKey((k) => k + 1)}
              onChange={(e) => {
                const v = Number(e.target.value)
                setT(v)
                setLyricsFollowKey((k) => k + 1)
                if (audioRef.current) audioRef.current.currentTime = v
              }}
            />
          </div>

          <div className="lm-lyrics" key={previewKey}>
            {hasLines ? (
              <LyricsPanel
                lines={previewLines}
                currentTime={t}
                emptyText="先搜索或粘贴 LRC"
                clickable
                markedIndices={markedIndices}
                focusIndex={calibrateMode === 'line' ? lineCursor : null}
                resumeFollowKey={lyricsFollowKey}
                clickTitle={
                  calibrateMode === 'line'
                    ? '听到这句时点击，钉到当前播放时间'
                    : '听到这句时点击，加入整体估算样本'
                }
                contextTitle="右键撤销本句定位"
                onLineContextMenu={(index) => undoLineStamp(index)}
                onLineClick={(index) => {
                  if (!originLines) return
                  if (calibrateMode === 'line') {
                    setLineCursor(index)
                    stampLineAtPlay(index)
                    return
                  }
                  const origin = originLines[index]
                  if (!origin) return
                  const playTimeMs = Math.round((audioRef.current?.currentTime ?? t) * 1000)
                  const next: LyricTimingSample = {
                    lyricTimeMs: origin.timeMs,
                    playTimeMs,
                    lineIndex: index,
                    text: origin.text,
                  }
                  const without = samples.filter((p) => p.lineIndex !== index)
                  const merged = [...without, next].sort(
                    (a, b) => (a.lineIndex ?? 0) - (b.lineIndex ?? 0),
                  )
                  setSamples(merged)
                  markDirty()
                  if (merged.length >= 3) applyFitFromSamples(merged, true)
                  else setMsg(`已采 ${merged.length} 点，再点 ${3 - merged.length} 句后自动估算`)
                }}
              />
            ) : rawLrc.trim() ? (
              <pre className="lm-plain">{rawLrc}</pre>
            ) : (
              <div className="lyrics empty">先搜索或粘贴 LRC</div>
            )}
          </div>

          <div className="lm-preview-footer">
            <button
              type="button"
              className="primary"
              disabled={busy || !active || !rawLrc.trim()}
              onClick={() => void save()}
            >
              {saveHint}
            </button>
            {msg && <p className="theme-tip">{msg}</p>}
          </div>
        </section>
      </div>
    </DrawerShell>
  )
}
