import { describe, expect, it } from 'vitest'
import { resolveShowMainHotkeyAction } from '../src/core/show-main'
import { accelVariants, shouldRefreshGlobalHotkeys } from '../src/core/hotkey-runtime'
import { mergeHotkeyBindings, DEFAULT_HOTKEY_BINDINGS } from '../src/core/hotkey-config'

describe('resolveShowMainHotkeyAction', () => {
  it('creates when missing', () => {
    expect(
      resolveShowMainHotkeyAction({
        exists: false,
        visible: false,
        minimized: false,
        focused: false,
      }),
    ).toBe('create')
  })

  it('minimizes when already frontmost', () => {
    expect(
      resolveShowMainHotkeyAction({
        exists: true,
        visible: true,
        minimized: false,
        focused: true,
      }),
    ).toBe('minimize')
  })

  it('shows when hidden, minimized, or unfocused', () => {
    expect(
      resolveShowMainHotkeyAction({
        exists: true,
        visible: false,
        minimized: false,
        focused: false,
      }),
    ).toBe('show')
    expect(
      resolveShowMainHotkeyAction({
        exists: true,
        visible: true,
        minimized: true,
        focused: false,
      }),
    ).toBe('show')
    expect(
      resolveShowMainHotkeyAction({
        exists: true,
        visible: true,
        minimized: false,
        focused: false,
      }),
    ).toBe('show')
  })
})

describe('hotkey runtime', () => {
  it('expands CommandOrControl variants', () => {
    expect(accelVariants('CommandOrControl+Alt+Space')).toEqual([
      'CommandOrControl+Alt+Space',
      'Control+Alt+Space',
      'Ctrl+Alt+Space',
    ])
  })

  it('only refreshes when expected accel missing', () => {
    expect(
      shouldRefreshGlobalHotkeys({
        hasHandler: true,
        expectedAccels: ['Ctrl+Alt+Space'],
        registeredAccels: ['Ctrl+Alt+Space'],
      }),
    ).toBe(false)
    expect(
      shouldRefreshGlobalHotkeys({
        hasHandler: true,
        expectedAccels: ['Ctrl+Alt+Space', 'Ctrl+Alt+D'],
        registeredAccels: ['Ctrl+Alt+Space'],
      }),
    ).toBe(true)
    expect(
      shouldRefreshGlobalHotkeys({
        hasHandler: false,
        expectedAccels: ['Ctrl+Alt+Space'],
        registeredAccels: [],
      }),
    ).toBe(false)
  })
})

describe('mergeHotkeyBindings migration', () => {
  it('upgrades legacy seek comma/period defaults', () => {
    const merged = mergeHotkeyBindings([
      { action: 'seek-back', global: 'CommandOrControl+Alt+,', inApp: '' },
      { action: 'seek-fwd', global: 'CommandOrControl+Alt+.', inApp: '' },
    ])
    expect(merged.find((b) => b.action === 'seek-back')!.global).toBe('CommandOrControl+Alt+[')
    expect(merged.find((b) => b.action === 'seek-fwd')!.global).toBe('CommandOrControl+Alt+]')
  })

  it('keeps custom seek bindings', () => {
    const merged = mergeHotkeyBindings([
      { action: 'seek-back', global: 'CommandOrControl+Alt+Z', inApp: '' },
    ])
    expect(merged.find((b) => b.action === 'seek-back')!.global).toBe('CommandOrControl+Alt+Z')
  })

  it('defaults use bracket seek keys', () => {
    expect(DEFAULT_HOTKEY_BINDINGS.find((b) => b.action === 'seek-back')!.global).toContain('[')
  })
})
