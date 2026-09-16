/** 主播放被次要场景（歌词试听等）临时抢占时的统一挂起管理 */

export type PlaybackHoldHooks = {
  /** 当前主播放是否在播 */
  getPlaying: () => boolean
  pause: () => void
  resume: () => void
}

export type PlaybackHoldController = {
  /** 登记占用原因；首个原因会在必要时暂停主播放 */
  acquire: (reason: string) => void
  /** 释放；全部释放后若挂起前在播则恢复 */
  release: (reason: string) => void
  releaseAll: () => void
  reasons: () => string[]
  isHeld: () => boolean
}

/**
 * 用独立 reason 列表管理「谁在占用主播放」。
 * 后续新功能（导入预览、截取试听等）只需 acquire/release 自己的 reason。
 */
export function createPlaybackHold(hooks: PlaybackHoldHooks): PlaybackHoldController {
  const holders = new Set<string>()
  let resumeAfter = false

  return {
    acquire(reason: string) {
      const key = reason.trim()
      if (!key) return
      const first = holders.size === 0
      holders.add(key)
      if (first) {
        resumeAfter = hooks.getPlaying()
        if (resumeAfter) hooks.pause()
      }
    },
    release(reason: string) {
      const key = reason.trim()
      if (!key) return
      if (!holders.delete(key)) return
      if (holders.size === 0 && resumeAfter) {
        resumeAfter = false
        hooks.resume()
      }
    },
    releaseAll() {
      if (!holders.size) return
      holders.clear()
      if (resumeAfter) {
        resumeAfter = false
        hooks.resume()
      }
    },
    reasons: () => [...holders],
    isHeld: () => holders.size > 0,
  }
}
