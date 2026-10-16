import { describe, expect, it } from 'vitest'
import { compareLibraryTracks, sortLibraryTracks } from '../src/core/library-sort'

const sample = [
  { id: '1', artist: 'Bob', titleZh: 'Zebra', mtimeMs: 300, birthtimeMs: 100, addedAt: '2020-01-01' },
  { id: '2', artist: 'Amy', titleZh: 'Apple', mtimeMs: 100, birthtimeMs: 300, addedAt: '2021-01-01' },
  { id: '3', artist: 'Amy', titleZh: 'Mango', mtimeMs: 200, birthtimeMs: 200, addedAt: '2022-01-01' },
]

describe('library-sort', () => {
  it('sorts by artist then title ascending', () => {
    const ids = sortLibraryTracks(sample, 'artist', 'asc').map((t) => t.id)
    expect(ids).toEqual(['2', '3', '1'])
  })

  it('sorts by title descending', () => {
    const ids = sortLibraryTracks(sample, 'title', 'desc').map((t) => t.id)
    expect(ids).toEqual(['1', '3', '2'])
  })

  it('sorts by mtime ascending', () => {
    const ids = sortLibraryTracks(sample, 'mtime', 'asc').map((t) => t.id)
    expect(ids).toEqual(['2', '3', '1'])
  })

  it('sorts by birthtime descending', () => {
    const ids = sortLibraryTracks(sample, 'birthtime', 'desc').map((t) => t.id)
    expect(ids).toEqual(['2', '3', '1'])
  })

  it('falls back to addedAt when birthtime missing', () => {
    const a = { id: 'a', titleZh: 'x', addedAt: '2024-01-01T00:00:00.000Z' }
    const b = { id: 'b', titleZh: 'y', addedAt: '2023-01-01T00:00:00.000Z' }
    expect(compareLibraryTracks(a, b, 'birthtime', 'asc')).toBeGreaterThan(0)
  })
})
