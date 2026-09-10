/**
 * 对外窗口标题规范（任务栏、托盘悬停、部分联动软件读窗口标题）
 *
 * 格式：
 * - 空闲：`{App}`，例如 `Q-Music` / `Q-Music (2)`
 * - 播放：`{App} - {NowPlaying}`
 * - NowPlaying：有艺人时 `艺人 - 歌名`，否则仅 `歌名`
 *
 * 约定：
 * - 应用名前缀固定，便于 OOPZ 等按「Q-Music」识别实例
 * - 分隔符统一为 ` - `（空格-空格）
 * - 不把曲名写入 AppUserModelId / relaunchDisplayName（系统身份保持稳定）
 */

const TITLE_SEP = ' - '
const MAX_SEGMENT_LEN = 120
const MAX_TITLE_LEN = 240

function sanitizeSegment(raw: string, max = MAX_SEGMENT_LEN): string {
  return raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** 当前曲目标识段（不含应用名） */
export function buildNowPlayingSegment(input: {
  title?: string | null
  artist?: string | null
}): string | null {
  const title = sanitizeSegment(input.title || '')
  const artist = sanitizeSegment(input.artist || '')
  if (!title && !artist) return null
  if (artist && title) {
    // 歌名已以「艺人 - 」开头时不重复拼接
    if (title.startsWith(`${artist}${TITLE_SEP}`)) return title
    return sanitizeSegment(`${artist}${TITLE_SEP}${title}`, MAX_SEGMENT_LEN)
  }
  return title || artist
}

/** 完整窗口 / 托盘标题 */
export function buildWindowTitle(
  appDisplayName: string,
  nowPlaying?: string | null,
): string {
  const app = sanitizeSegment(appDisplayName || '') || 'Q-Music'
  const track = sanitizeSegment(nowPlaying || '', MAX_SEGMENT_LEN)
  if (!track) return app
  const full = `${app}${TITLE_SEP}${track}`
  return full.length <= MAX_TITLE_LEN ? full : `${full.slice(0, MAX_TITLE_LEN - 1)}…`
}

export function buildWindowTitleFromTrack(
  appDisplayName: string,
  track: { title?: string | null; artist?: string | null } | null | undefined,
): string {
  return buildWindowTitle(appDisplayName, track ? buildNowPlayingSegment(track) : null)
}
