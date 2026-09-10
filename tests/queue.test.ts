import { describe, expect, it } from 'vitest'
import {
  appendUniquePreserveOrder,
  dedupeQueuePreserveFirst,
  excludeCategoryFromQueue,
  mergeTracksById,
  moveQueueItemToPlayNext,
  removeQueueIndex,
  resolveNextIndex,
  shuffleIndices,
} from '../src/core/queue'

describe('mergeTracksById', () => {
  it('dedupes by id', () => {
    const a = [
      { id: '1', title: 'a' },
      { id: '2', title: 'b' },
    ]
    const b = [{ id: '2', title: 'b2' }, { id: '3', title: 'c' }]
    expect(mergeTracksById(a, b)).toEqual([
      { id: '1', title: 'a' },
      { id: '2', title: 'b2' },
      { id: '3', title: 'c' },
    ])
  })
})

describe('resolveNextIndex', () => {
  it('loop wraps', () => {
    expect(
      resolveNextIndex({
        mode: 'loop',
        queueLength: 3,
        from: 2,
        direction: 1,
        shuffleOrder: [],
      }).index,
    ).toBe(0)
  })

  it('sequence stops at end', () => {
    const r = resolveNextIndex({
      mode: 'sequence',
      queueLength: 3,
      from: 2,
      direction: 1,
      shuffleOrder: [],
    })
    expect(r.stop).toBe(true)
    expect(r.index).toBe(2)
  })

  it('single replays', () => {
    const r = resolveNextIndex({
      mode: 'single',
      queueLength: 5,
      from: 2,
      direction: 1,
      shuffleOrder: [],
    })
    expect(r.replay).toBe(true)
    expect(r.index).toBe(2)
  })

  it('shuffle stays in range', () => {
    const order = [2, 0, 1]
    const r = resolveNextIndex({
      mode: 'shuffle',
      queueLength: 3,
      from: 2,
      direction: 1,
      shuffleOrder: order,
    })
    expect(r.index).toBe(0)
  })
})

describe('removeQueueIndex', () => {
  it('adjusts current index', () => {
    const q = ['a', 'b', 'c']
    expect(removeQueueIndex(q, 0, 2)).toEqual({ queue: ['b', 'c'], index: 1 })
    expect(removeQueueIndex(q, 2, 2)).toEqual({ queue: ['a', 'b'], index: 1 })
    expect(removeQueueIndex(q, 1, 1).queue).toEqual(['a', 'c'])
  })
})

describe('moveQueueItemToPlayNext', () => {
  it('moves item after current without changing current index', () => {
    const q = ['a', 'b', 'c', 'd']
    expect(moveQueueItemToPlayNext(q, 3, 1)).toEqual({
      queue: ['a', 'b', 'd', 'c'],
      index: 1,
    })
  })

  it('no-op when already next', () => {
    const q = ['a', 'b', 'c']
    expect(moveQueueItemToPlayNext(q, 1, 0)).toEqual({ queue: q, index: 0 })
  })
})

describe('shuffleIndices', () => {
  it('has all indices', () => {
    const s = shuffleIndices(5, 0)
    expect(s.sort()).toEqual([0, 1, 2, 3, 4])
  })
})

describe('queue unique helpers', () => {
  it('appends unique only', () => {
    const q = [{ id: '1' }, { id: '2' }]
    expect(appendUniquePreserveOrder(q, [{ id: '2' }, { id: '3' }])).toEqual([
      { id: '1' },
      { id: '2' },
      { id: '3' },
    ])
  })

  it('dedupes preserve first', () => {
    expect(dedupeQueuePreserveFirst([{ id: 'a' }, { id: 'b' }, { id: 'a' }])).toEqual([
      { id: 'a' },
      { id: 'b' },
    ])
  })

  it('excludes category', () => {
    const q = [
      { id: '1', categoryIds: ['c1'] },
      { id: '2', categoryIds: ['c2'] },
    ]
    expect(excludeCategoryFromQueue(q, 'c1')).toEqual([{ id: '2', categoryIds: ['c2'] }])
  })
})
