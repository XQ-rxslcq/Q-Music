import { describe, expect, it } from 'vitest'
import {
  displayTitle,
  filterByCategory,
  makeTrackId,
  mergeTrackLists,
  type TrackRecord,
} from '../src/core/library-model'

function track(partial: Partial<TrackRecord> & Pick<TrackRecord, 'id' | 'pathRel'>): TrackRecord {
  return {
    rootId: 'r1',
    titleZh: '',
    titleEn: '',
    titleJa: '',
    artist: '',
    album: '',
    duration: 0,
    categoryIds: [],
    lyricsRel: null,
    addedAt: '2026-01-01',
    ...partial,
  }
}

describe('library model', () => {
  it('makeTrackId normalizes slashes', () => {
    expect(makeTrackId('a', 'Music\\x.mp3')).toBe(makeTrackId('a', 'Music/x.mp3'))
  })

  it('displayTitle prefers zh > en > ja > filename', () => {
    expect(displayTitle(track({ id: '1', pathRel: 'a.mp3', titleEn: 'Hello' }))).toBe('Hello')
    expect(
      displayTitle(track({ id: '1', pathRel: 'a.mp3', titleZh: '你好', titleEn: 'Hello' })),
    ).toBe('你好')
    expect(displayTitle(track({ id: '1', pathRel: 'song.mp3' }))).toBe('song')
  })

  it('mergeTrackLists dedupes and merges titles/categories', () => {
    const a = [
      track({
        id: 'r1::a.mp3',
        pathRel: 'a.mp3',
        titleEn: 'A',
        categoryIds: ['c1'],
      }),
    ]
    const b = [
      track({
        id: 'r1::a.mp3',
        pathRel: 'a.mp3',
        titleZh: '甲',
        categoryIds: ['c2'],
        lyricsRel: 'data/l.lrc',
      }),
    ]
    const m = mergeTrackLists(a, b)
    expect(m).toHaveLength(1)
    expect(m[0].titleZh).toBe('甲')
    expect(m[0].titleEn).toBe('A')
    expect(m[0].categoryIds.sort()).toEqual(['c1', 'c2'])
    expect(m[0].lyricsRel).toBe('data/l.lrc')
  })

  it('filterByCategory', () => {
    const list = [
      track({ id: '1', pathRel: 'a.mp3', categoryIds: ['rock'] }),
      track({ id: '2', pathRel: 'b.mp3', categoryIds: [] }),
    ]
    expect(filterByCategory(list, 'rock')).toHaveLength(1)
    expect(filterByCategory(list, '__uncategorized')).toHaveLength(1)
    expect(filterByCategory(list, null)).toHaveLength(2)
  })
})
