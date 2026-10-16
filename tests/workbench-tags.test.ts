import { describe, expect, it } from 'vitest'
import {
  VIRTUAL_TAG_CONFIGURED,
  VIRTUAL_TAG_MISSING,
  filterWorkbenchTracks,
  mergeWorkbenchTags,
  trackMatchesWorkbenchTags,
} from '../src/core/workbench-tags'

const tracks = [
  { id: 'a', titleZh: '晴天', artist: '周杰伦', lyricsRel: 'a.lrc' },
  { id: 'b', titleZh: '七里香', artist: '周杰伦', lyricsRel: null },
  { id: 'c', titleZh: '稻香', artist: 'Jay', lyricsRel: 'c.lrc' },
]

describe('workbench-tags', () => {
  it('merges and strips virtual ids from storage', () => {
    const m = mergeWorkbenchTags({
      tags: [
        { id: VIRTUAL_TAG_CONFIGURED, name: 'hack' },
        { id: 't1', name: ' 暂不配置 ' },
      ],
      byTrack: { a: [VIRTUAL_TAG_MISSING, 't1', 't1'] },
    })
    expect(m.tags).toEqual([{ id: 't1', name: '暂不配置' }])
    expect(m.byTrack.a).toEqual(['t1'])
  })

  it('AND-filters virtual + custom tags', () => {
    const byTrack = { b: ['skip'], a: ['skip'] }
    expect(trackMatchesWorkbenchTags(tracks[1]!, [VIRTUAL_TAG_MISSING, 'skip'], byTrack)).toBe(true)
    expect(trackMatchesWorkbenchTags(tracks[0]!, [VIRTUAL_TAG_MISSING, 'skip'], byTrack)).toBe(false)
    expect(trackMatchesWorkbenchTags(tracks[0]!, [VIRTUAL_TAG_CONFIGURED], byTrack)).toBe(true)
  })

  it('filters by query and tags', () => {
    const list = filterWorkbenchTracks(tracks, {
      query: '周',
      selectedTagIds: [VIRTUAL_TAG_MISSING],
      byTrack: {},
    })
    expect(list.map((t) => t.id)).toEqual(['b'])
  })
})
