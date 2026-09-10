import { describe, expect, it } from 'vitest'
import { fromMediaUrl, toMediaUrl } from '../src/core/media-url'

describe('media-url', () => {
  it('roundtrips windows path', () => {
    const p = 'C:\\Music\\晴天.mp3'
    const url = toMediaUrl(p)
    expect(url.startsWith('qmusic://local/')).toBe(true)
    expect(fromMediaUrl(url)).toBe(p)
  })
  it('roundtrips posix path', () => {
    const p = '/home/user/Music/a.flac'
    expect(fromMediaUrl(toMediaUrl(p))).toBe(p)
  })
})
