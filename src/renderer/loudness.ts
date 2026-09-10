import {
  clampGainByPeak,
  computeTrackGainDb,
  estimateLufsFromPcm,
  type LoudnessProfile,
} from '../core/volume'

/** 用 Web Audio 解码当前可播放 URL，估算响度（相对归一，可移植） */
export async function scanLoudnessFromUrl(fileUrl: string): Promise<LoudnessProfile> {
  const res = await fetch(fileUrl)
  if (!res.ok) throw new Error(`无法读取音频：${res.status}`)
  const buf = await res.arrayBuffer()
  const ctx = new OfflineAudioContext(1, 1, 44100)
  const decoded = await ctx.decodeAudioData(buf.slice(0))
  const ch0 = decoded.getChannelData(0)
  // 降采样抽样，避免超大文件卡死
  const step = Math.max(1, Math.floor(ch0.length / 200_000))
  const samples = new Float32Array(Math.ceil(ch0.length / step))
  for (let i = 0, j = 0; i < ch0.length; i += step, j++) samples[j] = ch0[i]
  const { lufs, peakDb } = estimateLufsFromPcm(samples)
  const rawGain = computeTrackGainDb(lufs)
  const gainDb = clampGainByPeak(rawGain, peakDb)
  return { lufs, peakDb, gainDb }
}
