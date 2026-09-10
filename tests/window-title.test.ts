import { describe, expect, it } from 'vitest'
import {
  buildNowPlayingSegment,
  buildWindowTitle,
  buildWindowTitleFromTrack,
} from '../src/core/window-title'

describe('window-title', () => {
  it('idle keeps app name only', () => {
    expect(buildWindowTitle('Q-Music', null)).toBe('Q-Music')
    expect(buildWindowTitle('Q-Music (2)', '')).toBe('Q-Music (2)')
    expect(buildWindowTitleFromTrack('Q-Music', null)).toBe('Q-Music')
  })

  it('playing appends title after app with standard separator', () => {
    expect(buildWindowTitle('Q-Music', '晴天')).toBe('Q-Music - 晴天')
    expect(buildWindowTitleFromTrack('Q-Music (1)', { title: '晴天', artist: '周杰伦' })).toBe(
      'Q-Music (1) - 周杰伦 - 晴天',
    )
  })

  it('does not duplicate artist already in title', () => {
    expect(
      buildNowPlayingSegment({ title: '周杰伦 - 晴天', artist: '周杰伦' }),
    ).toBe('周杰伦 - 晴天')
  })

  it('sanitizes control whitespace', () => {
    expect(buildWindowTitle('Q-Music', '  a\nb\t  ')).toBe('Q-Music - a b')
  })
})
