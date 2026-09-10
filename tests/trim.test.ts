import { describe, expect, it } from 'vitest'
import { buildFfmpegTrimArgs, validateTrimRange } from '../src/core/trim'

describe('trim', () => {
  it('validates range', () => {
    expect(validateTrimRange(10, 5).ok).toBe(false)
    expect(validateTrimRange(-1, 2).ok).toBe(false)
    expect(validateTrimRange(0, 10, 8).ok).toBe(false)
    const ok = validateTrimRange(1, 5, 10)
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.duration).toBe(4)
  })

  it('builds ffmpeg args', () => {
    const args = buildFfmpegTrimArgs({
      inputPath: 'in.m4a',
      outputPath: 'out.mp3',
      startSec: 12.5,
      endSec: 100,
      copyCodec: false,
    })
    expect(args).toContain('-ss')
    expect(args).toContain('12.5')
    expect(args).toContain('-to')
    expect(args).toContain('libmp3lame')
    expect(args.at(-1)).toBe('out.mp3')
  })

  it('copy codec mode', () => {
    const args = buildFfmpegTrimArgs({
      inputPath: 'in.m4a',
      outputPath: 'out.m4a',
      startSec: 1,
      endSec: 2,
      copyCodec: true,
    })
    expect(args).toContain('copy')
  })
})
