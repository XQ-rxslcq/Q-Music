import { describe, expect, it } from 'vitest'
import {
  applyLineTimes,
  buildLyricsSearchQuery,
  cleanLyricsTitle,
  findLyricIndex,
  fitLyricTiming,
  parseLrc,
  serializeLrc,
  shiftLyricLines,
  transformLyricLines,
} from '../src/core/lyrics'

const SAMPLE = `
[ti:Demo]
[ar:Test]
[offset:0]
[00:00.00]前奏后
[00:12.00]第一句
[00:15.50]第二句
[00:18.05][00:45.00]重复句
`

describe('parseLrc', () => {
  it('parses meta and multi timestamps', () => {
    const parsed = parseLrc(SAMPLE)
    expect(parsed.meta.ti).toBe('Demo')
    expect(parsed.meta.ar).toBe('Test')
    expect(parsed.lines.length).toBe(5)
    expect(parsed.lines[1].text).toBe('第一句')
    expect(parsed.lines[1].timeMs).toBe(12000)
    const repeats = parsed.lines.filter((l) => l.text === '重复句')
    expect(repeats.map((r) => r.timeMs)).toEqual([18050, 45000])
  })

  it('applies offset', () => {
    const parsed = parseLrc('[offset:1000]\n[00:01.00]hello')
    expect(parsed.lines[0].timeMs).toBe(2000)
  })
})

describe('findLyricIndex', () => {
  const lines = parseLrc(SAMPLE).lines

  it('returns -1 before first line', () => {
    const late = parseLrc('[00:10.00]a\n[00:20.00]b').lines
    expect(findLyricIndex(late, 3)).toBe(-1)
  })

  it('binary searches current line', () => {
    expect(findLyricIndex(lines, 12)).toBe(1)
    expect(findLyricIndex(lines, 15.5)).toBe(2)
    expect(findLyricIndex(lines, 40)).toBe(3)
    expect(findLyricIndex(lines, 50)).toBe(4)
  })

  it('handles seek backwards', () => {
    expect(findLyricIndex(lines, 100)).toBe(4)
    expect(findLyricIndex(lines, 12.1)).toBe(1)
  })
})

describe('shiftLyricLines + serializeLrc', () => {
  it('shifts preview times and serializes baked timestamps', () => {
    const parsed = parseLrc('[00:01.00]hello\n[00:02.00]world')
    const shifted = shiftLyricLines(parsed.lines, 500)
    expect(shifted[0].timeMs).toBe(1500)
    expect(parsed.lines[0].timeMs).toBe(1000)
    const out = serializeLrc({
      lines: shifted,
      meta: { ti: 'X', ar: 'Y', by: 'Q-Music' },
      offsetMs: 0,
    })
    expect(out).toContain('[ti:X]')
    expect(out).toContain('[00:01.500]hello')
    expect(out).toContain('[00:02.500]world')
  })
})

describe('fitLyricTiming + transformLyricLines', () => {
  it('fits pure offset from samples', () => {
    const fit = fitLyricTiming([
      { lyricTimeMs: 10000, playTimeMs: 10800 },
      { lyricTimeMs: 20000, playTimeMs: 20800 },
      { lyricTimeMs: 30000, playTimeMs: 30800 },
    ])
    expect(fit).not.toBeNull()
    expect(fit!.offsetMs).toBe(800)
    expect(fit!.rateNearOne).toBe(true)
    const lines = transformLyricLines(
      [
        { timeMs: 10000, text: 'a' },
        { timeMs: 20000, text: 'b' },
      ],
      { offsetMs: fit!.offsetMs, rate: fit!.rate },
    )
    expect(lines[0].timeMs).toBe(10800)
  })

  it('fits rate when tempo differs', () => {
    // play = 1.1 * lyric + 500
    const fit = fitLyricTiming([
      { lyricTimeMs: 10000, playTimeMs: 11500 },
      { lyricTimeMs: 20000, playTimeMs: 22500 },
      { lyricTimeMs: 30000, playTimeMs: 33500 },
      { lyricTimeMs: 40000, playTimeMs: 44500 },
    ])
    expect(fit).not.toBeNull()
    expect(fit!.rate).toBeCloseTo(1.1, 3)
    expect(fit!.offsetMs).toBe(500)
    expect(fit!.rateNearOne).toBe(false)
  })

  it('applyLineTimes overrides per-line timestamps', () => {
    const lines = [
      { timeMs: 1000, text: 'a' },
      { timeMs: 2000, text: 'b' },
    ]
    const out = applyLineTimes(lines, [1500, 2800])
    expect(out[0].timeMs).toBe(1500)
    expect(out[1].timeMs).toBe(2800)
    expect(out[0].text).toBe('a')
  })
})

describe('cleanLyricsTitle + buildLyricsSearchQuery', () => {
  it('strips translation and remix parentheses', () => {
    expect(cleanLyricsTitle('うっせぇわ (烦死了)(Giga Remix)')).toBe('うっせぇわ')
    expect(cleanLyricsTitle('僕らの環境 (我们的环境)')).toBe('僕らの環境')
  })

  it('builds cleaned default query for bilingual filenames', () => {
    const q = buildLyricsSearchQuery({
      titleZh: 'うっせぇわ (烦死了)(Giga Remix)',
      artist: 'Ado',
    })
    expect(q.title).toBe('うっせぇわ')
    expect(q.q).toContain('うっせぇわ')
    expect(q.q).not.toContain('烦死了')
  })

  it('prefers Japanese original over Chinese translation field', () => {
    const q = buildLyricsSearchQuery({
      titleZh: '烦死了',
      titleJa: 'うっせぇわ',
      artist: 'Ado',
      pathRel: 'Ado - うっせぇわ (烦死了).mp3',
    })
    expect(q.title).toBe('うっせぇわ')
    expect(q.q).toContain('うっせぇわ')
    expect(q.q).not.toContain('烦死了')
  })

  it('recovers Japanese from pathRel when only Chinese titleZh set', () => {
    const q = buildLyricsSearchQuery({
      titleZh: '我们的环境',
      titleJa: '',
      artist: '22_7',
      pathRel: '22_7 - 僕らの環境 (我们的环境).mp3',
    })
    expect(q.title).toBe('僕らの環境')
  })
})

describe('plainTextToLyricLines + resolveLyricLines', () => {
  it('splits plain text by newlines and skips blanks', async () => {
    const { plainTextToLyricLines, resolveLyricLines } = await import('../src/core/lyrics')
    const lines = plainTextToLyricLines('一句\n\n  二句  \n三句\n')
    expect(lines.map((l) => l.text)).toEqual(['一句', '二句', '三句'])
    expect(lines.every((l) => l.timeMs === 0)).toBe(true)

    const plain = resolveLyricLines('hello\nworld')
    expect(plain.fromPlain).toBe(true)
    expect(plain.lines).toHaveLength(2)

    const synced = resolveLyricLines('[00:01.00]a\n[00:02.00]b')
    expect(synced.fromPlain).toBe(false)
    expect(synced.lines[0].timeMs).toBe(1000)
  })

  it('strips BOM and treats whitespace-only as empty', async () => {
    const { resolveLyricLines, plainTextToLyricLines } = await import('../src/core/lyrics')
    expect(resolveLyricLines('\uFEFFhello\nworld').lines.map((l) => l.text)).toEqual([
      'hello',
      'world',
    ])
    expect(plainTextToLyricLines('\n  \n\t\n')).toEqual([])
    expect(resolveLyricLines('   ').lines).toEqual([])
  })
})

describe('plain lyrics stamp → LRC roundtrip (冗余路径)', () => {
  it('resolve → applyLineTimes → serialize → parse recovers times/text', async () => {
    const { resolveLyricLines, applyLineTimes, serializeLrc, parseLrc } = await import(
      '../src/core/lyrics'
    )
    const plain = resolveLyricLines('第一句\n第二句\n第三句')
    expect(plain.fromPlain).toBe(true)
    const stamped = applyLineTimes(plain.lines, [1200, 5600, 9800])
    const out = serializeLrc({
      lines: stamped,
      meta: { ti: 'Demo', ar: 'Test', by: 'Q-Music' },
      offsetMs: 0,
    })
    expect(out).toContain('[ti:Demo]')
    const again = parseLrc(out)
    expect(again.lines.map((l) => l.text)).toEqual(['第一句', '第二句', '第三句'])
    expect(again.lines.map((l) => l.timeMs)).toEqual([1200, 5600, 9800])
    // 冗余：同一内容经 resolveLyricLines 不再判为纯文本
    const resolved = resolveLyricLines(out)
    expect(resolved.fromPlain).toBe(false)
    expect(resolved.lines).toHaveLength(3)
  })

  it('synced content: resolveLyricLines ≡ parseLrc lines (冗余入口)', async () => {
    const { resolveLyricLines, parseLrc } = await import('../src/core/lyrics')
    const src = '[ti:X]\n[00:01.00]a\n[00:02.50]b'
    const a = parseLrc(src)
    const b = resolveLyricLines(src)
    expect(b.fromPlain).toBe(false)
    expect(b.lines).toEqual(a.lines)
    expect(b.meta.ti).toBe(a.meta.ti)
  })

  it('shiftLyricLines equals transformLyricLines with rate=1 (冗余变换)', async () => {
    const { parseLrc, shiftLyricLines, transformLyricLines } = await import('../src/core/lyrics')
    const lines = parseLrc('[00:01.00]a\n[00:02.00]b').lines
    expect(shiftLyricLines(lines, 350)).toEqual(
      transformLyricLines(lines, { offsetMs: 350, rate: 1 }),
    )
  })
})

describe('buildLyricsSearchAttempts', () => {
  it('includes alias and cleaned primary', async () => {
    const { buildLyricsSearchAttempts } = await import('../src/core/lyrics')
    const attempts = buildLyricsSearchAttempts({
      titleZh: 'Lemon (柠檬)',
      artist: 'Akie秋绘',
    })
    const blob = JSON.stringify(attempts)
    expect(blob).toContain('Lemon')
    expect(blob).toContain('柠檬')
  })
})

