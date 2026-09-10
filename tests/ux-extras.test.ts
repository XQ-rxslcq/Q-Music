import { describe, expect, it } from 'vitest'
import { clampLyricSeek } from '../src/core/lyric-seek'
import { karaokeLineProgress, mergeDesktopLyrics, nextDesktopLyricsCycle } from '../src/core/desktop-lyrics'
import {
  findHotkeyConflicts,
  mergeHotkeyBindings,
  shouldAcceptHotkeyFire,
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

describe('nextDesktopLyricsCycle', () => {
  it('three-state: hide → unlock → lock → hide', () => {
    const a = nextDesktopLyricsCycle({ visible: false, locked: true }, 'three')
    expect(a).toMatchObject({ visible: true, locked: false })
    const b = nextDesktopLyricsCycle(a, 'three')
    expect(b).toMatchObject({ visible: true, locked: true })
    const c = nextDesktopLyricsCycle(b, 'three')
    expect(c).toMatchObject({ visible: false, locked: true })
  })

  it('two-state: hide ↔ show', () => {
    const a = nextDesktopLyricsCycle({ visible: false, locked: true }, 'two')
    expect(a).toMatchObject({ visible: true, locked: true })
    const b = nextDesktopLyricsCycle(a, 'two')
    expect(b).toMatchObject({ visible: false, locked: true })
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

describe('shouldAcceptHotkeyFire', () => {
  it('debounces duplicate fires within window', () => {
    const map = new Map<string, number>()
    expect(shouldAcceptHotkeyFire('toggle-play', 1000, map, 200)).toBe(true)
    expect(shouldAcceptHotkeyFire('toggle-play', 1100, map, 200)).toBe(false)
    expect(shouldAcceptHotkeyFire('toggle-play', 1300, map, 200)).toBe(true)
    expect(shouldAcceptHotkeyFire('next', 1310, map, 200)).toBe(true)
  })
})

describe('isImeHostileAccel', () => {
  it('flags bare Ctrl+digit', async () => {
    const { isImeHostileAccel, isDigitAccelRisk } = await import('../src/core/hotkey-config')
    expect(isImeHostileAccel('CommandOrControl+7')).toBe(true)
    expect(isImeHostileAccel('Ctrl+5')).toBe(true)
    expect(isImeHostileAccel('CommandOrControl+Alt+7')).toBe(false)
    expect(isDigitAccelRisk('CommandOrControl+Alt+7')).toBe(true)
    expect(isImeHostileAccel('CommandOrControl+Alt+Shift+Q')).toBe(false)
    expect(isDigitAccelRisk('CommandOrControl+Alt+Shift+Q')).toBe(false)
  })
})

describe('digit doubt: no rewrite', () => {
  it('keeps recorded digit accels and marks doubtful only', async () => {
    const { upgradeImeHostileAccel, mergeHotkeyBindings, evaluateHotkeyUsability } = await import(
      '../src/core/hotkey-config'
    )
    expect(upgradeImeHostileAccel('CommandOrControl+7')).toBe('CommandOrControl+7')
    const merged = mergeHotkeyBindings([
      { action: 'show-main', global: 'CommandOrControl+7', inApp: '' },
      { action: 'toggle-play', global: 'CommandOrControl+Alt+5', inApp: '' },
    ])
    expect(merged.find((b) => b.action === 'show-main')!.global).toBe('CommandOrControl+7')
    expect(merged.find((b) => b.action === 'toggle-play')!.global).toBe('CommandOrControl+Alt+5')
    const bare = evaluateHotkeyUsability([{ action: 'show-main', global: 'CommandOrControl+7', inApp: '' }])
    expect(bare[0].usable).toBe(true)
    expect(bare[0].doubtful).toBe(true)
    expect(bare[0].kind).toBe('digit-doubt')
    expect(bare[0].label).toContain('按键存疑')
    const altDigit = evaluateHotkeyUsability([
      { action: 'show-main', global: 'CommandOrControl+Alt+7', inApp: '' },
    ])
    expect(altDigit[0].usable).toBe(true)
    expect(altDigit[0].doubtful).toBe(true)
    expect(altDigit[0].kind).toBe('digit-doubt')
  })
})
