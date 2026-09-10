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
import LyricsPanel from './LyricsPanel'
import TransportButtons from './TransportButtons'
import DrawerShell from './DrawerShell'
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
  lyricsRootAbs?: string | null
  onClose: () => void
  onSaved: (library: LibraryPayload) => void
  onLyricsRootChange: (library: LibraryPayload, absPath: string | null) => void
}

export default function LyricsMatchDrawer({
  open,
  tracks,
  initialTrackId,
  lyricsRootAbs,
  onClose,
  onSaved,
  onLyricsRootChange,
}: Props) {
  const missing = useMemo(() => tracks.filter((t) => !t.lyricsRel), [tracks])
  const [onlyMissing, setOnlyMissing] = useState(true)
  const list = onlyMissing ? missing : tracks
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
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const markDirty = () => setDirty(true)

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

  useEffect(() => {
    if (!open) return
    const id =
      initialTrackId && list.some((x) => x.id === initialTrackId)
        ? initialTrackId
        : list[0]?.id || null
    setActiveId(id)
  }, [open, initialTrackId, list])

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
        return originLines.map((l, i) => ({
          ...l,
          timeMs: stampedLines.includes(i) ? lineTimes[i]! : 1_000_000_000 + i,
        }))
      }
      return applyLineTimes(originLines, lineTimes)
    }
    if (fromPlain) {
      if (lineTimes && lineTimes.length === originLines.length) {
        return originLines.map((l, i) => ({
          ...l,
          timeMs: stampedLines.includes(i) ? lineTimes[i]! : 1_000_000_000 + i,
        }))
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

  const enterLineMode = (seedLines?: LyricLine[]) => {
    const lines = seedLines || originLines
    if (!lines?.length) return
    const base = fromPlain || seedLines
      ? lines
      : transformLyricLines(lines, { offsetMs, rate })
    setLineTimes(base.map((l) => l.timeMs))
    setStampedLines([])
    setLineCursor(0)
    setCalibrateMode('line')
    setMsg(
      fromPlain || seedLines
        ? '纯文本已按换行分段：播放到该句时点击行或「标记当前句」钉时间；文本框可随时改字'
        : '逐句对点：播放到该句时点击歌词行（或点「标记当前句」），已标行会显示时间戳',
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
    nextTimes[index] = playTimeMs
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
        if (fromPlain) {
          next[index] = 0
        } else {
          const base = transformLyricLines(originLines, { offsetMs, rate })
          next[index] = base[index]?.timeMs ?? next[index]
        }
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
    a.src = active.fileUrl
    a.load()
    setPlaying(false)
    setT(0)
  }, [active?.id, active?.fileUrl])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) void a.play().catch(() => setPlaying(false))
    else a.pause()
  }, [playing])

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
          ? applyLineTimes(resolvedNow.lines, lineTimes)
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
      if (onlyMissing && nextMissing[0]) setActiveId(nextMissing[0].id)
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
          <label className="cat-check">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(e) => setOnlyMissing(e.target.checked)}
            />
            只列未配词（{missing.length}/{tracks.length}）
          </label>
          <ul className="list lm-list">
            {list.map((row) => (
              <li key={row.id} className={row.id === active?.id ? 'active' : ''}>
                <button type="button" className="row" onClick={() => setActiveId(row.id)}>
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
            {!list.length && <li className="empty">没有待处理曲目</li>}
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
          </div>
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
            <textarea
              className="lm-paste"
              rows={4}
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
                  setOffsetMs(0)
                  setRate(1)
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

            {calibrateMode === 'fit' ? (
              <>
                <label className="theme-field">
                  <span>偏移 (ms) · 步进可改</span>
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
                  <span>速率（相对 LRC，1 = 相同）</span>
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
              </>
            ) : (
              <div className="theme-field">
                <span>
                  逐句对点 · 已标 {stampedLines.length}/{originLines?.length || 0} · 目标第 {lineCursor + 1}{' '}
                  句
                </span>
                <p className="theme-tip">右栏左键钉时间，右键撤销该句；也可点下方按钮。</p>
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
                      const base = transformLyricLines(originLines, { offsetMs, rate })
                      setLineTimes(base.map((l) => l.timeMs))
                      setStampedLines([])
                      setLineCursor(0)
                      markDirty()
                      setMsg('已重置逐句时间（回到当前偏移/速率）')
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
