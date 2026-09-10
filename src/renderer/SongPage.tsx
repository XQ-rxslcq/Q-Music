import { useEffect, useMemo, useState } from 'react'
import LyricsPanel from './LyricsPanel'
import type { LyricLine } from '../core/lyrics'
import { clampLyricSeek } from '../core/lyric-seek'
import { formatTime } from '../core/format'
import {
  mergePageLyrics,
  resolveLyricFont,
  type PageLyricsSettings,
} from '../core/desktop-lyrics'

type Props = {
  open: boolean
  title: string
  artist: string
  lines: LyricLine[]
  currentTime: number
  duration: number
  playing?: boolean
  resumeFollowKey: number
  pageLyrics?: PageLyricsSettings
  onClose: () => void
  onSeek: (sec: number) => void
  onSeekEndNext: () => void
  onOpenMatch?: () => void
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        d="M5 9.5 12 16.5 19 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function SongPage({
  open,
  title,
  artist,
  lines,
  currentTime,
  duration,
  playing = false,
  resumeFollowKey,
  pageLyrics,
  onClose,
  onSeek,
  onSeekEndNext,
  onOpenMatch,
}: Props) {
  const [localFollow, setLocalFollow] = useState(0)
  useEffect(() => {
    if (open) setLocalFollow((k) => k + 1)
  }, [open, resumeFollowKey])

  const empty = useMemo(() => !lines.length, [lines])
  const pl = useMemo(() => mergePageLyrics(pageLyrics), [pageLyrics])
  const resolveFont = useMemo(
    () => (text: string) => resolveLyricFont(pl, text),
    [pl],
  )

  if (!open) return null

  return (
    <div className="song-page">
      <div className="song-page-head">
        <button type="button" className="song-page-back" onClick={onClose} title="返回" aria-label="返回">
          <ChevronDown />
        </button>
        <div className="song-page-meta">
          <div className="song-page-title">{title || '未在播放'}</div>
          <div className="song-page-sub">
            {artist || '—'} · {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>
      <div className="song-page-body">
        {empty ? (
          <div className="lyrics empty">
            暂无歌词
            {onOpenMatch && (
              <button type="button" className="primary" style={{ marginTop: 12 }} onClick={onOpenMatch}>
                打开歌词匹配工作台
              </button>
            )}
          </div>
        ) : (
          <LyricsPanel
            lines={lines}
            currentTime={currentTime}
            duration={duration}
            playing={playing}
            clickable
            resumeFollowKey={localFollow}
            resolveFont={resolveFont}
            pageLyrics={pl}
            clickTitle="点击跳转到这句"
            onLineClick={(_i, line) => {
              const { seekSec, triggerNext } = clampLyricSeek(line.timeMs, duration)
              onSeek(seekSec)
              if (triggerNext) onSeekEndNext()
            }}
          />
        )}
      </div>
    </div>
  )
}
