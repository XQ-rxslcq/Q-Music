import { describe, expect, it } from 'vitest'
import { buildInstanceIdentity, shouldShowSlotLabel } from '../src/core/instance-identity'

describe('buildInstanceIdentity', () => {
  it('single / alone keeps plain Q-Music', () => {
    expect(buildInstanceIdentity(1, { multiMode: false, showSlotLabel: false })).toEqual({
      slot: 1,
      displayName: 'Q-Music',
      appUserModelId: 'com.qmusic.app',
    })
    expect(buildInstanceIdentity(1, { multiMode: true, showSlotLabel: false }).displayName).toBe(
      'Q-Music',
    )
  })

  it('only labels when showSlotLabel (live ≥ 2)', () => {
    expect(shouldShowSlotLabel(1)).toBe(false)
    expect(shouldShowSlotLabel(2)).toBe(true)
    expect(buildInstanceIdentity(1, { multiMode: true, showSlotLabel: true }).displayName).toBe(
      'Q-Music (1)',
    )
    expect(buildInstanceIdentity(2, { multiMode: true, showSlotLabel: true })).toEqual({
      slot: 2,
      displayName: 'Q-Music (2)',
      appUserModelId: 'com.qmusic.app.2',
    })
  })
})
