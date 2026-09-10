/**
 * 歌词在线搜索（lrclib.net 公开 API）
 * 歌曲宝无官方歌词接口；本模块对脏歌名（译名括号/Remix）做清洗并多策略回退。
 * 仅供个人为自己已持有的本地音频匹配 LRC。
 */

import {
  buildLyricsSearchAttempts,
  cleanLyricsTitle,
  type LyricsSearchAttempt,
} from '../core/lyrics'

export type LyricSearchHit = {
  id: number | string
  title: string
  artist: string
  album: string
  duration: number
  syncedLyrics: string | null
  plainLyrics: string | null
  source: 'lrclib'
}

const MIN_GAP_MS = 900
let lastRequestAt = 0
let chain: Promise<unknown> = Promise.resolve()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastRequestAt))
    if (wait) await sleep(wait)
    lastRequestAt = Date.now()
    return fn()
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function fetchLrclibOnce(opts: {
  title?: string
  artist?: string
  q?: string
}): Promise<LyricSearchHit[]> {
  const params = new URLSearchParams()
  const title = cleanLyricsTitle(opts.title || '')
  const artist = (opts.artist || '').trim()
  const q = (opts.q || '').trim()

  // 优先用模糊 q；有干净 title 时再带 track_name（勿把脏括号歌名塞进去）
  if (q) params.set('q', q)
  else if (title) {
    params.set('track_name', title)
    if (artist) params.set('artist_name', artist)
  }
  if (!params.has('q') && !params.has('track_name') && title) {
    params.set('q', artist ? `${artist} ${title}` : title)
  }
  if (![...params.keys()].length) return []

  const url = `https://lrclib.net/api/search?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Q-Music/1.0.0 (personal local lyrics matching; Electron)',
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`歌词搜索失败 HTTP ${res.status}`)
  const data = (await res.json()) as Array<{
    id: number
    name?: string
    trackName?: string
    artistName?: string
    albumName?: string
    duration?: number
    syncedLyrics?: string | null
    plainLyrics?: string | null
  }>
  if (!Array.isArray(data)) return []
  return data
    .map((row) => ({
      id: row.id,
      title: row.trackName || row.name || '',
      artist: row.artistName || '',
      album: row.albumName || '',
      duration: Number(row.duration) || 0,
      syncedLyrics: row.syncedLyrics || null,
      plainLyrics: row.plainLyrics || null,
      source: 'lrclib' as const,
    }))
    .filter((h) => Boolean(h.syncedLyrics || h.plainLyrics))
}

function mergeHits(into: LyricSearchHit[], more: LyricSearchHit[]): LyricSearchHit[] {
  const seen = new Set(into.map((h) => String(h.id)))
  for (const h of more) {
    if (seen.has(String(h.id))) continue
    seen.add(String(h.id))
    into.push(h)
  }
  // 带时间轴的排前面
  into.sort((a, b) => Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics)))
  return into
}

export type LyricsSearchResult = {
  hits: LyricSearchHit[]
  attemptsUsed: number
  lastLabel?: string
}

/**
 * 多策略搜索：脏歌名会先清洗；无结果则换「仅歌名 / 译名」再试。
 * 每次 HTTP 仍走全局限速。
 */
export async function searchLyricsLrclib(opts: {
  title?: string
  artist?: string
  q?: string
  /** 传入完整曲目字段时自动生成回退列表 */
  track?: {
    title?: string
    titleZh?: string
    titleEn?: string
    titleJa?: string
    artist?: string
    pathRel?: string
  }
  maxAttempts?: number
}): Promise<LyricsSearchResult> {
  const maxAttempts = opts.maxAttempts ?? 5
  const attempts: LyricsSearchAttempt[] = []

  if (opts.track) {
    attempts.push(...buildLyricsSearchAttempts(opts.track))
  }

  const manualQ = (opts.q || '').trim()
  const manualTitle = cleanLyricsTitle(opts.title || '')
  const manualArtist = (opts.artist || '').trim()

  // 用户改过搜索框：优先用其输入（也做清洗）
  if (manualQ) {
    const cleanedQ = cleanLyricsTitle(manualQ) || manualQ
    attempts.unshift({ q: cleanedQ, label: `手动：${cleanedQ}` })
    // 若手动串含空格，再试去掉艺人前缀后的歌名段
    const parts = cleanedQ.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      const maybeTitle = parts.slice(1).join(' ')
      attempts.splice(1, 0, { q: maybeTitle, title: maybeTitle, label: `手动歌名段：${maybeTitle}` })
    }
  } else if (manualTitle) {
    if (manualArtist) {
      attempts.unshift({
        title: manualTitle,
        artist: manualArtist,
        label: `手动：${manualArtist} / ${manualTitle}`,
      })
    }
    attempts.unshift({ title: manualTitle, q: manualTitle, label: `手动歌名：${manualTitle}` })
  }

  // 去重 attempt
  const uniq: LyricsSearchAttempt[] = []
  const seenKey = new Set<string>()
  for (const a of attempts) {
    const key = JSON.stringify({ t: a.title || '', ar: a.artist || '', q: a.q || '' })
    if (seenKey.has(key)) continue
    seenKey.add(key)
    uniq.push(a)
  }

  const hits: LyricSearchHit[] = []
  let used = 0
  let lastLabel: string | undefined

  for (const attempt of uniq.slice(0, maxAttempts)) {
    used++
    lastLabel = attempt.label
    const batch = await rateLimited(() =>
      fetchLrclibOnce({
        title: attempt.title,
        artist: attempt.artist,
        q: attempt.q,
      }),
    )
    mergeHits(hits, batch)
    if (hits.some((h) => h.syncedLyrics) && hits.length >= 3) break
    if (hits.length >= 8) break
  }

  return { hits: hits.slice(0, 12), attemptsUsed: used, lastLabel }
}
