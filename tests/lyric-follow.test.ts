import { describe, expect, it } from 'vitest'
import { computeCenterScrollTop, isLineCenterInBand } from '../src/core/lyric-follow'

describe('lyric-follow', () => {
  it('detects center ±20% band', () => {
    // view 0–100, center 50, band 30–70
    expect(isLineCenterInBand(0, 100, 45, 10)).toBe(true) // center 50
    expect(isLineCenterInBand(0, 100, 25, 10)).toBe(true) // center 30
    expect(isLineCenterInBand(0, 100, 15, 10)).toBe(false) // center 20
    expect(isLineCenterInBand(0, 100, 65, 10)).toBe(true) // center 70
    expect(isLineCenterInBand(0, 100, 71, 10)).toBe(false) // center 76
  })

  it('centers line and clamps at ends', () => {
    // view 200, content 1000, line at 100 h=40 → center 120 → scroll 20
    expect(computeCenterScrollTop(0, 200, 1000, 100, 40)).toBe(20)
    // near top: line at 0 → target -80 → 0
    expect(computeCenterScrollTop(0, 200, 1000, 0, 40)).toBe(0)
    // near bottom: line offset 960 h=40 → center 980 → target 880; max=800
    expect(computeCenterScrollTop(0, 200, 1000, 960, 40)).toBe(800)
  })
})
