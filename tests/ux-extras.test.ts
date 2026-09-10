import { describe, expect, it } from 'vitest'
import { clampLyricSeek } from '../src/core/lyric-seek'
import { karaokeLineProgress, mergeDesktopLyrics } from '../src/core/desktop-lyrics'
import {
  findHotkeyConflicts,
  mergeHotkeyBindings,
  DEFAULT_HOTKEY_BINDINGS,
} from '../src/core/hotkey-config'

describe('clampLyricSeek', () => {
  it('clamps before start and past end', () => {
    expect(clampLyricSeek(-100, 200)).toEqual({ seekSec: 0, triggerNext: false })
    expect(clampLyricSeek(250000, 200)).toEqual({ seekSec: 200, triggerNext: true })
    expect(clampLyricSeek(5000, 200)).toEqual({ seekSec: 5, triggerNext: false })
  })
})

describe('karaokeLineProgress', () => {
  it('lerps between current and next line', () => {
    const lines = [{ timeMs: 10000 }, { timeMs: 20000 }]
    expect(karaokeLineProgress(lines, 0, 10)).toBe(0)
    expect(karaokeLineProgress(lines, 0, 15)).toBeCloseTo(0.5, 5)
    expect(karaokeLineProgress(lines, 0, 20)).toBe(1)
  })
})

describe('mergeDesktopLyrics', () => {
  it('fills new fields from defaults', () => {
    const m = mergeDesktopLyrics({ visible: true, fontSize: 40 })
    expect(m.visible).toBe(true)
    expect(m.fontSize).toBe(40)
    expect(m.locked).toBe(true)
    expect(m.karaoke).toBe(true)
    expect(m.lineLayouts.primary.alignX).toBeTruthy()
  })
})

describe('hotkey conflicts', () => {
  it('detects duplicate global accel', () => {
    const bindings = mergeHotkeyBindings([
      ...DEFAULT_HOTKEY_BINDINGS,
      { action: 'next', global: 'CommandOrControl+Alt+Space', inApp: '' },
    ])
    // force duplicate
    const bad = bindings.map((b) =>
      b.action === 'next' ? { ...b, global: bindings.find((x) => x.action === 'toggle-play')!.global } : b,
    )
    const c = findHotkeyConflicts(bad)
    expect(c.some((x) => x.scope === 'global')).toBe(true)
  })
})
