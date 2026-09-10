import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultTrimOutputPath, siblingLrcPath } from '../src/core/paths'

describe('paths', () => {
  it('siblingLrcPath', () => {
    expect(siblingLrcPath(path.join('a', 'b', 'song.mp3'))).toBe(path.join('a', 'b', 'song.lrc'))
    expect(siblingLrcPath(path.join('x', 'demo.m4a'))).toBe(path.join('x', 'demo.lrc'))
  })
  it('defaultTrimOutputPath', () => {
    expect(defaultTrimOutputPath(path.join('a', 'song.m4a'))).toBe(
      path.join('a', 'song.trim.mp3'),
    )
  })
})
