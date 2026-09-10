/** 点歌词跳转：越界夹到开头或末尾（末尾可触发下一首） */

export function clampLyricSeek(
  timeMs: number,
  durationSec: number,
): { seekSec: number; triggerNext: boolean } {
  if (!Number.isFinite(timeMs) || timeMs < 0) return { seekSec: 0, triggerNext: false }
  const seekSec = timeMs / 1000
  if (!(durationSec > 0)) return { seekSec: Math.max(0, seekSec), triggerNext: false }
  if (seekSec >= durationSec) return { seekSec: durationSec, triggerNext: true }
  return { seekSec, triggerNext: false }
}
