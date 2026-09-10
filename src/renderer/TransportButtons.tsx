/** 等大等样式播放控件：模式 | 上一首 | 播放 | 下一首 | 词 */

import type { PlayMode } from '../core/queue'

type LyricsBtnState = 'off' | 'unlocked' | 'locked'

type Props = {
  playing: boolean
  disabled?: boolean
  onPrev?: () => void
  onToggle: () => void
  onNext?: () => void
  compact?: boolean
  onSeekBack?: () => void
  onSeekFwd?: () => void
  className?: string
  /** 完整播放条：模式在上一首左侧 */
  mode?: PlayMode
  onCycleMode?: () => void
  /** 完整播放条：词按钮在下一首右侧 */
  lyricsState?: LyricsBtnState
  onCycleLyrics?: () => void
}

function IconPrev() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
    </svg>
  )
}

function IconNext() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path fill="currentColor" d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path fill="currentColor" d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}

function IconBack5() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"
      />
    </svg>
  )
}

function IconFwd5() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M12 5V1l5 5-5 5V7c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z"
      />
    </svg>
  )
}

/** 顺序 */
function IconModeSequence() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M4 6h12v2H4V6zm0 5h12v2H4v-2zm0 5h8v2H4v-2zm13-1.41L20.59 18 17 21.59 15.59 20.17 17.76 18l-2.17-2.17L17 14.59z"
      />
    </svg>
  )
}

/** 列表循环 */
function IconModeLoop() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M7 7h11v3l4-4-4-4v3H5c-1.1 0-2 .9-2 2v4h2V7zm10 10H6v-3l-4 4 4 4v-3h12c1.1 0 2-.9 2-2v-4h-2v4z"
      />
    </svg>
  )
}

/** 单曲循环 */
function IconModeSingle() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M7 7h11v3l4-4-4-4v3H5c-1.1 0-2 .9-2 2v4h2V7zm10 10H6v-3l-4 4 4 4v-3h12c1.1 0 2-.9 2-2v-4h-2v4zM13 15V9h-1.5l-1.5 1v1.1l1.2-.8H12v4.7H13z"
      />
    </svg>
  )
}

/** 随机 */
function IconModeShuffle() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
      />
    </svg>
  )
}

function ModeIcon({ mode }: { mode: PlayMode }) {
  if (mode === 'loop') return <IconModeLoop />
  if (mode === 'single') return <IconModeSingle />
  if (mode === 'shuffle') return <IconModeShuffle />
  return <IconModeSequence />
}

const MODE_TITLE: Record<PlayMode, string> = {
  sequence: '顺序播放',
  loop: '列表循环',
  single: '单曲循环',
  shuffle: '随机播放',
}

export default function TransportButtons({
  playing,
  disabled,
  onPrev,
  onToggle,
  onNext,
  compact,
  onSeekBack,
  onSeekFwd,
  className,
  mode,
  onCycleMode,
  lyricsState,
  onCycleLyrics,
}: Props) {
  return (
    <div className={`transport ${className || ''}`.trim()}>
      {compact ? (
        <>
          {onSeekBack && (
            <button
              type="button"
              className="ctrl-btn"
              disabled={disabled}
              onClick={onSeekBack}
              title="后退 5 秒"
              aria-label="后退 5 秒"
            >
              <IconBack5 />
            </button>
          )}
          <button
            type="button"
            className="ctrl-btn ctrl-main"
            disabled={disabled}
            onClick={onToggle}
            title={playing ? '暂停' : '播放'}
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          {onSeekFwd && (
            <button
              type="button"
              className="ctrl-btn"
              disabled={disabled}
              onClick={onSeekFwd}
              title="前进 5 秒"
              aria-label="前进 5 秒"
            >
              <IconFwd5 />
            </button>
          )}
        </>
      ) : (
        <>
          {onCycleMode && mode && (
            <button
              type="button"
              className="ctrl-btn"
              onClick={onCycleMode}
              title={MODE_TITLE[mode]}
              aria-label={MODE_TITLE[mode]}
            >
              <ModeIcon mode={mode} />
            </button>
          )}
          <button
            type="button"
            className="ctrl-btn"
            disabled={disabled}
            onClick={onPrev}
            title="上一曲"
            aria-label="上一曲"
          >
            <IconPrev />
          </button>
          <button
            type="button"
            className="ctrl-btn ctrl-main"
            disabled={disabled}
            onClick={onToggle}
            title={playing ? '暂停' : '播放'}
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            className="ctrl-btn"
            disabled={disabled}
            onClick={onNext}
            title="下一曲"
            aria-label="下一曲"
          >
            <IconNext />
          </button>
          {onCycleLyrics && (
            <button
              type="button"
              className={`ctrl-btn ctrl-ci ${lyricsState && lyricsState !== 'off' ? 'on' : ''}`}
              onClick={onCycleLyrics}
              title={
                lyricsState === 'off'
                  ? '桌面歌词：显示（未锁定）'
                  : lyricsState === 'unlocked'
                    ? '桌面歌词：锁定'
                    : '桌面歌词：隐藏'
              }
              aria-label="桌面歌词"
            >
              <span className="ctrl-ci-char">词</span>
              {lyricsState === 'locked' && (
                <svg className="ctrl-ci-lock" viewBox="0 0 12 12" width="10" height="10" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M9 5.5V4a3 3 0 0 0-6 0v1.5H2.5v5h7v-5H9zM4.5 4a1.5 1.5 0 0 1 3 0v1.5h-3V4z"
                  />
                </svg>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}
