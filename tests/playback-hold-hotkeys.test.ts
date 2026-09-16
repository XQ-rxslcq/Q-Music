import { describe, expect, it } from 'vitest'
import { createPlaybackHold } from '../src/core/playback-hold'
import { VOLUME_HOTKEY_STEP, VOLUME_HOTKEY_STEP_PERCENT } from '../src/core/volume'
import { accelVariants } from '../src/core/hotkey-runtime'
import { keyTokenFromKeyboardEvent, isDigitAccelRisk } from '../src/core/hotkey-config'

describe('playback-hold', () => {
  it('pauses on first acquire and resumes after last release', () => {
    let playing = true
    const hold = createPlaybackHold({
      getPlaying: () => playing,
      pause: () => {
        playing = false
      },
      resume: () => {
        playing = true
      },
    })
    hold.acquire('lyrics-preview')
    expect(playing).toBe(false)
    hold.acquire('other')
    expect(playing).toBe(false)
    hold.release('lyrics-preview')
    expect(playing).toBe(false)
    hold.release('other')
    expect(playing).toBe(true)
  })

  it('does not resume if was not playing', () => {
    let playing = false
    const hold = createPlaybackHold({
      getPlaying: () => playing,
      pause: () => {
        playing = false
      },
      resume: () => {
        playing = true
      },
    })
    hold.acquire('x')
    hold.release('x')
    expect(playing).toBe(false)
  })
})

describe('volume step', () => {
  it('uses 5 percent', () => {
    expect(VOLUME_HOTKEY_STEP_PERCENT).toBe(5)
    expect(VOLUME_HOTKEY_STEP).toBe(0.05)
  })
})

describe('numpad accelerators', () => {
  it('expands digit to numN variants', () => {
    const v = accelVariants('CommandOrControl+Alt+7')
    expect(v.some((x) => /num7$/i.test(x))).toBe(true)
  })

  it('tokenizes numpad code as numN', () => {
    const e = {
      key: '7',
      code: 'Numpad7',
      ctrlKey: true,
      altKey: true,
      shiftKey: false,
      metaKey: false,
    } as KeyboardEvent
    expect(keyTokenFromKeyboardEvent(e)).toBe('num7')
  })

  it('does not mark numpad as digit-doubt', () => {
    expect(isDigitAccelRisk('CommandOrControl+Alt+num7')).toBe(false)
    expect(isDigitAccelRisk('CommandOrControl+Alt+7')).toBe(true)
  })
})
