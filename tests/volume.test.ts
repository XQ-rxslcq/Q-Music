import { describe, expect, it } from 'vitest'
import {
  clampGainByPeak,
  computeTrackGainDb,
  dbToLinear,
  effectiveLinearGain,
  estimateLufsFromPcm,
} from '../src/core/volume'

describe('volume', () => {
  it('computeTrackGainDb toward target', () => {
    expect(computeTrackGainDb(-10, -18)).toBeCloseTo(-8)
    expect(computeTrackGainDb(-24, -18)).toBeCloseTo(6)
  })

  it('dbToLinear', () => {
    expect(dbToLinear(0)).toBeCloseTo(1)
    expect(dbToLinear(6)).toBeGreaterThan(1.9)
  })

  it('clampGainByPeak prevents clipping', () => {
    // peak already -1dB, cannot add +10dB
    expect(clampGainByPeak(10, -1, -1)).toBeCloseTo(0)
  })

  it('effectiveLinearGain respects toggle', () => {
    expect(
      effectiveLinearGain({ userVolume: 0.5, gainDb: 6, normalizeEnabled: false }),
    ).toBeCloseTo(0.5)
    expect(
      effectiveLinearGain({ userVolume: 0.5, gainDb: 0, normalizeEnabled: true }),
    ).toBeCloseTo(0.5)
  })

  it('estimateLufsFromPcm louder > quieter', () => {
    const quiet = new Float32Array(1000).fill(0.05)
    const loud = new Float32Array(1000).fill(0.5)
    const q = estimateLufsFromPcm(quiet)
    const l = estimateLufsFromPcm(loud)
    expect(l.lufs).toBeGreaterThan(q.lufs)
    expect(l.peakDb).toBeGreaterThan(q.peakDb)
  })
})
