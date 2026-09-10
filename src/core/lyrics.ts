import { parseFilenameMeta } from './filename-meta'

export type LyricLine = {
  timeMs: number
  text: string
}

export type ParsedLyrics = {
  offsetMs: number
  lines: LyricLine[]
  meta: Record<string, string>
}

const TIME_TAG = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g
const META_TAG = /^\[(ti|ar|al|by|offset):([^\]]*)\]$/i

function parseTimeTag(mm: string, ss: string, frac?: string): number {
  const minutes = Number(mm)
  const seconds = Number(ss)
  let ms = 0
  if (frac) {
    const padded = frac.length === 1 ? frac + '00' : frac.length === 2 ? frac + '0' : frac.slice(0, 3)
    ms = Number(padded)
  }
  return (minutes * 60 + seconds) * 1000 + ms
}

/** 解析 LRC 文本为有序歌词行 */
export function parseLrc(content: string): ParsedLyrics {
  const meta: Record<string, string> = {}
  let offsetMs = 0
  const raw: LyricLine[] = []

  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const metaMatch = trimmed.match(META_TAG)
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase()
      const value = metaMatch[2].trim()
      meta[key] = value
      if (key === 'offset') {
        const n = Number(value)
        if (Number.isFinite(n)) offsetMs = n
      }
      continue
    }

    const times: number[] = []
    let lastIndex = 0
    TIME_TAG.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = TIME_TAG.exec(trimmed)) !== null) {
      times.push(parseTimeTag(m[1], m[2], m[3]))
      lastIndex = TIME_TAG.lastIndex
    }
    if (!times.length) continue
    const text = trimmed.slice(lastIndex).trim()
    // 一期：去掉增强 LRC 的逐字时间标记残留
    const clean = text.replace(/<\d{1,2}:\d{1,2}(?:\.\d{1,3})?>/g, '').trim()
    for (const timeMs of times) {
      raw.push({ timeMs, text: clean })
    }
  }

  const sorted = raw
    .map((l) => ({ ...l, timeMs: l.timeMs + offsetMs }))
    .sort((a, b) => a.timeMs - b.timeMs)

  return { offsetMs, lines: sorted, meta }
}

/**
 * 当前应高亮的歌词下标：最大的 i 满足 lines[i].timeMs <= tMs
 * 前奏返回 -1
 */
export function findLyricIndex(lines: LyricLine[], timeSec: number): number {
  if (!lines.length) return -1
  const tMs = timeSec * 1000
  if (tMs < lines[0].timeMs) return -1
  let lo = 0
  let hi = lines.length - 1
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].timeMs <= tMs) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

/** 在已解析行上再叠加整体偏移（用于人工校准预览，不改原始文本） */
export function shiftLyricLines(lines: LyricLine[], extraOffsetMs: number): LyricLine[] {
  if (!extraOffsetMs) return lines
  return lines.map((l) => ({ ...l, timeMs: l.timeMs + extraOffsetMs }))
}

/**
 * 线性变换时间轴：play ≈ rate * lyric + offsetMs
 * rate=1 时退化为纯偏移。
 */
export function transformLyricLines(
  lines: LyricLine[],
  opts: { offsetMs?: number; rate?: number },
): LyricLine[] {
  const offsetMs = opts.offsetMs ?? 0
  const rate = opts.rate ?? 1
  if (!offsetMs && rate === 1) return lines
  return lines.map((l) => ({
    ...l,
    timeMs: Math.round(rate * l.timeMs + offsetMs),
  }))
}

/** 用逐句绝对时间覆盖生成预览/落盘行（变奏高级对点） */
export function applyLineTimes(lines: LyricLine[], timesMs: number[]): LyricLine[] {
  return lines.map((l, i) => {
    const t = timesMs[i]
    return {
      ...l,
      timeMs: Number.isFinite(t) ? Math.max(0, Math.round(t)) : l.timeMs,
    }
  })
}

/**
 * 纯文本歌词：按换行分段为可对点行（初始时间均为 0，需逐句标注）。
 * 空行跳过；保留行内空格。
 */
export function plainTextToLyricLines(text: string): LyricLine[] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => ({ timeMs: 0, text: line.trim() }))
}

/** 解析 LRC；若无时间轴则回退为纯文本分行 */
export function resolveLyricLines(content: string): {
  lines: LyricLine[]
  meta: Record<string, string>
  offsetMs: number
  fromPlain: boolean
} {
  const trimmed = (content || '').trim()
  if (!trimmed) return { lines: [], meta: {}, offsetMs: 0, fromPlain: false }
  const parsed = parseLrc(content)
  if (parsed.lines.length) {
    return { lines: parsed.lines, meta: parsed.meta, offsetMs: parsed.offsetMs, fromPlain: false }
  }
  return {
    lines: plainTextToLyricLines(content),
    meta: parsed.meta,
    offsetMs: 0,
    fromPlain: true,
  }
}

export type LyricTimingSample = {
  /** 原 LRC 时间戳 ms */
  lyricTimeMs: number
  /** 用户点击时音频播放位置 ms */
  playTimeMs: number
  lineIndex?: number
  text?: string
}

export type LyricTimingFit = {
  /** play ≈ rate * lyric + offsetMs */
  offsetMs: number
  rate: number
  /** 均方根残差 ms */
  rmseMs: number
  /** rate 是否接近 1（可视为纯偏移） */
  rateNearOne: boolean
  sampleCount: number
}

/**
 * 用若干「听到这句时的播放时间」样本，拟合偏移与相对速率。
 * ≥2 点做最小二乘；1 点则仅算偏移、rate=1。
 */
export function fitLyricTiming(samples: LyricTimingSample[]): LyricTimingFit | null {
  const pts = samples
    .filter((s) => Number.isFinite(s.lyricTimeMs) && Number.isFinite(s.playTimeMs))
    .map((s) => ({ x: s.lyricTimeMs, y: s.playTimeMs }))
  if (!pts.length) return null

  if (pts.length === 1) {
    const offsetMs = Math.round(pts[0].y - pts[0].x)
    return {
      offsetMs,
      rate: 1,
      rmseMs: 0,
      rateNearOne: true,
      sampleCount: 1,
    }
  }

  const n = pts.length
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumXY = 0
  for (const p of pts) {
    sumX += p.x
    sumY += p.y
    sumXX += p.x * p.x
    sumXY += p.x * p.y
  }
  const denom = n * sumXX - sumX * sumX
  let rate = 1
  let offsetMs = 0
  if (Math.abs(denom) < 1e-6) {
    // 所有歌词时间几乎相同 → 只能估偏移
    offsetMs = Math.round(sumY / n - sumX / n)
    rate = 1
  } else {
    rate = (n * sumXY - sumX * sumY) / denom
    offsetMs = (sumY - rate * sumX) / n
  }

  // 合理钳制，避免点错导致离谱
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 2) {
    // 退化为纯偏移：mean(play - lyric)
    let sumDiff = 0
    for (const p of pts) sumDiff += p.y - p.x
    offsetMs = Math.round(sumDiff / n)
    rate = 1
  } else {
    offsetMs = Math.round(offsetMs)
    rate = Math.round(rate * 10000) / 10000
  }

  let sse = 0
  for (const p of pts) {
    const pred = rate * p.x + offsetMs
    const e = p.y - pred
    sse += e * e
  }
  const rmseMs = Math.round(Math.sqrt(sse / n))
  const rateNearOne = Math.abs(rate - 1) < 0.008

  return { offsetMs, rate, rmseMs, rateNearOne, sampleCount: n }
}

/**
 * 把偏移写入 LRC：优先写 [offset:]，时间戳保持相对原文件；
 * 若 bakeTimestamps=true 则把偏移并进各行时间并清零 offset。
 */
export function serializeLrc(opts: {
  lines: LyricLine[]
  meta?: Record<string, string>
  offsetMs?: number
  bakeTimestamps?: boolean
}): string {
  const meta = { ...(opts.meta || {}) }
  const offsetMs = opts.offsetMs ?? 0
  const bake = Boolean(opts.bakeTimestamps)
  const out: string[] = []

  if (meta.ti) out.push(`[ti:${meta.ti}]`)
  if (meta.ar) out.push(`[ar:${meta.ar}]`)
  if (meta.al) out.push(`[al:${meta.al}]`)
  if (meta.by) out.push(`[by:${meta.by}]`)
  if (!bake && offsetMs) out.push(`[offset:${Math.round(offsetMs)}]`)
  else if (bake) out.push(`[offset:0]`)
  else if (meta.offset != null && meta.offset !== '') out.push(`[offset:${meta.offset}]`)

  const lines = bake
    ? opts.lines.map((l) => ({ ...l, timeMs: l.timeMs + offsetMs }))
    : opts.lines

  // 若 lines 已含 parse 时的 offset，serialize 时传入的 lines 应是「未加 extra」的原始行
  for (const line of lines) {
    const t = Math.max(0, Math.round(line.timeMs))
    const m = Math.floor(t / 60000)
    const s = Math.floor((t % 60000) / 1000)
    const ms = t % 1000
    const tag = `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}]`
    out.push(`${tag}${line.text}`)
  }
  return out.join('\n') + '\n'
}

/** 去掉歌名尾部括号段（译名 / Remix / Cover 等），便于在线搜词 */
export function cleanLyricsTitle(raw: string): string {
  let s = (raw || '').trim()
  if (!s) return ''
  s = s.replace(/（/g, '(').replace(/）/g, ')')
  let prev = ''
  while (s !== prev) {
    prev = s
    s = s.replace(/\s*\([^)]*\)\s*$/u, '').trim()
  }
  // 「春よ、来い。春天，来吧。」这类日中粘连：保留句号前日文段
  if (/。/.test(s) && /[\u3040-\u30ff]/.test(s)) {
    const before = s.split('。')[0]?.trim() || ''
    if (before && /[\u3040-\u30ff]/.test(before)) s = before
  }
  // 常见文件名噪声
  s = s.replace(/\s*[-–—]\s*(Official|MV|Audio|Lyric Video).*$/i, '').trim()
  return s
}

/** 从整段标题里抽出括号内的译名/别名（跳过 remix/cover 等） */
export function extractTitleAliases(raw: string): string[] {
  const s = (raw || '').replace(/（/g, '(').replace(/）/g, ')')
  const out: string[] = []
  const re = /\(([^)]+)\)/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    const inner = m[1].trim()
    if (!inner) continue
    if (/^(tv|short|full|ver\.?|version|remix|cover|feat\.?|live|inst|instrumental|翻自|日语填词|giga)/i.test(inner)) {
      continue
    }
    const cleaned = cleanLyricsTitle(inner)
    if (cleaned && !out.includes(cleaned)) out.push(cleaned)
  }
  return out
}

function fileNameFromPathRel(pathRel?: string): string {
  if (!pathRel) return ''
  return pathRel.replace(/^.*[/\\]/, '')
}

/** 补全语种字段：不足时从 pathRel 解析文件名 */
function resolveTitleFields(track: {
  title?: string
  titleZh?: string
  titleEn?: string
  titleJa?: string
  artist?: string
  pathRel?: string
}): { titleZh: string; titleEn: string; titleJa: string; artist: string; rawCombined: string } {
  let titleZh = (track.titleZh || '').trim()
  let titleEn = (track.titleEn || '').trim()
  let titleJa = (track.titleJa || '').trim()
  let artist = (track.artist || '').replace(/^未知艺人$/, '').trim()

  const fileName = fileNameFromPathRel(track.pathRel)
  if (fileName && (!titleJa || !titleEn || !titleZh)) {
    const parsed = parseFilenameMeta(fileName)
    if (!titleJa && parsed.titleJa) titleJa = parsed.titleJa
    if (!titleEn && parsed.titleEn) titleEn = parsed.titleEn
    if (!titleZh && parsed.titleZh) titleZh = parsed.titleZh
    if (!artist && parsed.artist) artist = parsed.artist
  }

  // titleZh 混着「原文 (译名)」且无 titleJa 时拆出日文主名
  if (!titleJa && titleZh) {
    const main = cleanLyricsTitle(titleZh)
    if (/[\u3040-\u30ff]/.test(main)) titleJa = main
  }

  const rawCombined = [titleJa, titleEn, titleZh, track.title, fileName].filter(Boolean).join(' ')
  return { titleZh, titleEn, titleJa, artist, rawCombined }
}

function pickPrimaryTitle(fields: {
  titleZh: string
  titleEn: string
  titleJa: string
  title?: string
  pathRel?: string
}): string {
  // 搜词优先日文原名 → 英文 → 中文（中文常是译名，lrclib 召回差）
  for (const c of [fields.titleJa, fields.titleEn, fields.titleZh, fields.title || '']) {
    const cleaned = cleanLyricsTitle(c)
    if (cleaned) return cleaned
  }
  const fromPath = cleanLyricsTitle(
    fileNameFromPathRel(fields.pathRel)
      .replace(/\.[^.]+$/, '')
      .replace(/^.*?[-–—]\s*/, ''),
  )
  return fromPath
}

export type LyricsSearchAttempt = {
  title?: string
  artist?: string
  q?: string
  label: string
}

/** 生成多组搜索尝试：先干净原名+艺人，再仅歌名，再译名 */
export function buildLyricsSearchAttempts(track: {
  title?: string
  titleZh?: string
  titleEn?: string
  titleJa?: string
  artist?: string
  pathRel?: string
}): LyricsSearchAttempt[] {
  const fields = resolveTitleFields(track)
  const artist = fields.artist
  const primary = pickPrimaryTitle({ ...fields, title: track.title, pathRel: track.pathRel })
  const aliases = [
    ...extractTitleAliases(fields.rawCombined),
    ...extractTitleAliases(fileNameFromPathRel(track.pathRel)),
  ]
  if (fields.titleZh) {
    const zh = cleanLyricsTitle(fields.titleZh)
    if (zh && zh !== primary && !aliases.includes(zh)) aliases.push(zh)
  }

  const attempts: LyricsSearchAttempt[] = []
  const seen = new Set<string>()
  const add = (a: LyricsSearchAttempt) => {
    const key = JSON.stringify({ t: a.title || '', ar: a.artist || '', q: a.q || '' })
    if (seen.has(key)) return
    seen.add(key)
    attempts.push(a)
  }

  if (primary) {
    if (artist) {
      add({ title: primary, artist, label: `歌名+艺人：${artist} / ${primary}` })
      add({ q: `${artist} ${primary}`, label: `关键词：${artist} ${primary}` })
    }
    add({ title: primary, label: `仅歌名：${primary}` })
    add({ q: primary, label: `关键词：${primary}` })
  }

  for (const alias of aliases) {
    if (alias === primary) continue
    if (artist) add({ q: `${artist} ${alias}`, label: `译名+艺人：${artist} ${alias}` })
    add({ title: alias, label: `译名：${alias}` })
    add({ q: alias, label: `关键词：${alias}` })
  }

  return attempts
}

/** 从曲目字段拼默认搜索框文案（已清洗，优先日/英原名） */
export function buildLyricsSearchQuery(track: {
  title?: string
  titleZh?: string
  titleEn?: string
  titleJa?: string
  artist?: string
  pathRel?: string
}): { title: string; artist: string; q: string } {
  const fields = resolveTitleFields(track)
  const attempts = buildLyricsSearchAttempts(track)
  const first = attempts[0]
  const title =
    first?.title || pickPrimaryTitle({ ...fields, title: track.title, pathRel: track.pathRel })
  const artist = fields.artist
  const q = first?.q || [artist, title].filter(Boolean).join(' ').trim() || title
  return { title, artist, q }
}
