/** 响度归一：曲目增益计算（不依赖 ffmpeg，便于单测） */

export const DEFAULT_TARGET_LUFS = -18

export function dbToLinear(db: number): number {
  return 10 ** (db / 20)
}

export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity
  return 20 * Math.log10(linear)
}

export function computeTrackGainDb(
  measuredLufs: number,
  targetLufs = DEFAULT_TARGET_LUFS,
): number {
  if (!Number.isFinite(measuredLufs)) return 0
  return targetLufs - measuredLufs
}

/** 峰值保护：限制增益，使峰值不超过 peakLimitDb（默认 -1 dBTP 近似） */
export function clampGainByPeak(
  gainDb: number,
  peakDb: number,
  peakLimitDb = -1,
): number {
  if (!Number.isFinite(peakDb)) return gainDb
  const maxGain = peakLimitDb - peakDb
  return Math.min(gainDb, maxGain)
}

export function effectiveLinearGain(opts: {
  userVolume: number
  gainDb: number
  normalizeEnabled: boolean
}): number {
  const { userVolume, gainDb, normalizeEnabled } = opts
  const g = normalizeEnabled ? dbToLinear(gainDb) : 1
  return Math.max(0, userVolume) * g
}

/**
 * 简易响度近似：对 PCM 样本算 RMS，再映射到近似 LUFS（非广播级，够用做相对归一）
 * samples: [-1,1] 交织或单声道
 */
export function estimateLufsFromPcm(samples: ArrayLike<number>): {
  lufs: number
  peakDb: number
} {
  if (!samples.length) return { lufs: DEFAULT_TARGET_LUFS, peakDb: -Infinity }
  let sumSq = 0
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]
    const a = Math.abs(v)
    if (a > peak) peak = a
    sumSq += v * v
  }
  const rms = Math.sqrt(sumSq / samples.length)
  const rmsDb = linearToDb(Math.max(rms, 1e-12))
  // 粗略：积分响度约比 RMS 低若干 dB；用固定偏移近似相对比较
  const lufs = rmsDb - 3.0
  const peakDb = linearToDb(Math.max(peak, 1e-12))
  return { lufs, peakDb }
}

export type LoudnessProfile = {
  lufs: number
  peakDb: number
  gainDb: number
}
