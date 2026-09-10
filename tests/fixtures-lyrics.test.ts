import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findLyricIndex, parseLrc } from '../src/core/lyrics'
import { siblingLrcPath } from '../src/core/paths'

describe('fixture lyrics file', () => {
  it('parses repo fixture and syncs', () => {
    const file = path.join(__dirname, 'fixtures', 'demo.lrc')
    const text = fs.readFileSync(file, 'utf8')
    const parsed = parseLrc(text)
    expect(parsed.meta.ti).toBe('Fixture Song')
    expect(findLyricIndex(parsed.lines, 0.5)).toBe(-1)
    expect(findLyricIndex(parsed.lines, 1.0)).toBe(0)
    expect(findLyricIndex(parsed.lines, 2.6)).toBe(1)
    expect(findLyricIndex(parsed.lines, 10)).toBe(2)
  })

  it('sibling path matches fixture naming', () => {
    const audio = path.join('tests', 'fixtures', 'demo.mp3')
    expect(siblingLrcPath(audio)).toBe(path.join('tests', 'fixtures', 'demo.lrc'))
  })
})
