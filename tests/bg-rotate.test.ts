import { describe, expect, it } from 'vitest'
import {
  clampBgRotateIntervalSec,
  isBgRotateDue,
  mergeBgRotate,
  moveBgRotateOrder,
  nextBgRotateRel,
  orderBgRotateRels,
} from '../src/core/bg-rotate'

describe('bg-rotate', () => {
  it('clamps interval to 5–86400 seconds', () => {
    expect(clampBgRotateIntervalSec(0)).toBe(5)
    expect(clampBgRotateIntervalSec(999999)).toBe(86400)
    expect(clampBgRotateIntervalSec(7.6)).toBe(8)
  })

  it('merges defaults and migrates intervalMin minutes → seconds', () => {
    expect(mergeBgRotate(undefined)).toEqual({ intervalSec: 300, lastSwitchedAt: 0, order: [] })
    expect(mergeBgRotate({ intervalSec: 90 }).intervalSec).toBe(90)
    expect(mergeBgRotate({ intervalMin: 2 } as { intervalMin: number }).intervalSec).toBe(120)
  })

  it('detects due time in seconds', () => {
    expect(isBgRotateDue(0, 30, 1000)).toBe(true)
    expect(isBgRotateDue(1000, 30, 1000 + 29_000)).toBe(false)
    expect(isBgRotateDue(1000, 30, 1000 + 30_000)).toBe(true)
  })

  it('orders by custom list then leftover filenames', () => {
    expect(orderBgRotateRels(['c.jpg', 'a.jpg', 'b.jpg'], ['b.jpg', 'missing.jpg'])).toEqual([
      'b.jpg',
      'a.jpg',
      'c.jpg',
    ])
  })

  it('moves order up/down', () => {
    expect(moveBgRotateOrder(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveBgRotateOrder(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
    expect(moveBgRotateOrder(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
  })

  it('cycles to next rel', () => {
    const rels = ['a.jpg', 'b.jpg', 'c.jpg']
    expect(nextBgRotateRel(rels, null)).toBe('a.jpg')
    expect(nextBgRotateRel(rels, 'a.jpg')).toBe('b.jpg')
    expect(nextBgRotateRel(rels, 'c.jpg')).toBe('a.jpg')
    expect(nextBgRotateRel(rels, 'missing.jpg')).toBe('a.jpg')
    expect(nextBgRotateRel([], 'a.jpg')).toBe(null)
  })
})
