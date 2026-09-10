import { describe, expect, it } from 'vitest'
import {
  applyParsedToTrackFields,
  buildCanonicalFilename,
  parseFilenameMeta,
  tokenizeForNaming,
} from '../src/core/filename-meta'

describe('parseFilenameMeta', () => {
  it('parses Artist - Ja (Zh)', () => {
    const p = parseFilenameMeta('Ado - うっせぇわ (烦死了).mp3')
    expect(p.artist).toBe('Ado')
    expect(p.titleJa).toContain('うっせぇわ')
    expect(p.titleZh).toBe('烦死了')
  })

  it('parses 【Artist】title(zh)', () => {
    const p = parseFilenameMeta('【YOASOBI】夜に駆ける (向夜晚奔去).mp3')
    expect(p.artist).toBe('YOASOBI')
    expect(p.titleJa).toContain('夜に駆ける')
    expect(p.titleZh).toBe('向夜晚奔去')
  })

  it('parses English title with Chinese paren', () => {
    const p = parseFilenameMeta('Akie秋绘 - Lemon (柠檬).mp3')
    expect(p.artist).toBe('Akie秋绘')
    expect(p.titleEn).toBe('Lemon')
    expect(p.titleZh).toBe('柠檬')
  })

  it('parses 《title》artist', () => {
    const p = parseFilenameMeta('《BLOW my GALE》目白麦昆.mp3')
    expect(p.artist).toBe('目白麦昆')
    expect(p.titleEn).toBe('BLOW my GALE')
  })

  it('builds canonical name as 【artist】primary（zh）', () => {
    expect(
      buildCanonicalFilename({
        artist: 'Ado',
        titleJa: 'うっせぇわ',
        titleZh: '烦死了',
        titleEn: '',
        ext: '.mp3',
      }),
    ).toBe('【Ado】うっせぇわ（烦死了）.mp3')
  })

  it('parses spaced artist title with Chinese paren', () => {
    const p = parseFilenameMeta('周深 大鱼（电影感）.mp3')
    expect(p.artist).toBe('周深')
    expect(p.titleZh).toContain('大鱼')
  })

  it('tokenizes for pick-fill', () => {
    const tokens = tokenizeForNaming('Akie秋绘 - Lemon (柠檬).mp3')
    expect(tokens).toContain('Akie秋绘')
    expect(tokens).toContain('Lemon')
    expect(tokens).toContain('柠檬')
  })

  it('applyParsed fills artist', () => {
    const f = applyParsedToTrackFields(parseFilenameMeta('周深 - 大鱼.mp3'))
    expect(f.artist).toBe('周深')
    expect(f.titleZh).toBe('大鱼')
  })
})
