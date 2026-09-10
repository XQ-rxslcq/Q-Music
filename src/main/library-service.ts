import fs from 'node:fs/promises'
import path from 'node:path'
import { parseFile } from 'music-metadata'
import {
  applyParsedToTrackFields,
  buildCanonicalFilename,
  parseFilenameMeta,
} from '../core/filename-meta'
import { displayTitle, makeTrackId, mergeTrackLists, type MusicRoot, type TrackRecord } from '../core/library'
import { toRelativeIfUnderRoot } from '../core/app-paths'
import { siblingLrcPath } from '../core/paths'
import {
  absoluteTrackPath,
  getPathAppRoot,
  loadGains,
  loadLyricsMap,
  loadRoots,
  loadTracks,
  lyricsPathInRoot,
  resolveLyricsRootAbsolute,
  resolveRootAbsolute,
  saveGains,
  saveLyricsMap,
  saveTracks,
} from './store'

const AUDIO_EXT = new Set([
  '.mp3',
  '.m4a',
  '.aac',
  '.flac',
  '.wav',
  '.ogg',
  '.opus',
  '.webm',
])

async function listAudioFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await listAudioFiles(full)))
    else if (AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) out.push(full)
  }
  return out
}

async function fileToRecord(
  appRoot: string,
  root: MusicRoot,
  absFile: string,
): Promise<TrackRecord> {
  const rootAbs = resolveRootAbsolute(appRoot, root)
  const pathRel = path.relative(rootAbs, absFile)
  const id = makeTrackId(root.id, pathRel)
  const base = path.parse(absFile).name
  let titleZh = ''
  let titleEn = ''
  let titleJa = ''
  let artist = '未知艺人'
  let album = ''
  let duration = 0
  try {
    const meta = await parseFile(absFile, { duration: true })
    const title = meta.common.title || base
    // 标签无法区分语种时先写入中文字段，用户可再编辑
    titleZh = title
    artist = meta.common.artist || meta.common.artists?.join(', ') || artist
    album = meta.common.album || ''
    duration = meta.format.duration ?? 0
  } catch {
    titleZh = base
  }

  // 文件名能可靠拆出艺人时，优先用文件名规则（覆盖常不准确的内嵌标签）
  const fromName = applyParsedToTrackFields(parseFilenameMeta(path.basename(absFile)))
  if (fromName.artist && fromName.artist !== '未知艺人') {
    artist = fromName.artist
    titleZh = fromName.titleZh
    titleEn = fromName.titleEn
    titleJa = fromName.titleJa
  }

  let lyricsRel: string | null = null
  const lyricsRootAbs = resolveLyricsRootAbsolute(appRoot)
  const candidates = [
    lyricsRootAbs ? lyricsPathInRoot(lyricsRootAbs, absFile) : null,
    siblingLrcPath(absFile),
  ].filter(Boolean) as string[]
  for (const lrc of candidates) {
    try {
      await fs.access(lrc)
      lyricsRel = toRelativeIfUnderRoot(getPathAppRoot(), lrc)
      break
    } catch {
      /* try next */
    }
  }

  return {
    id,
    rootId: root.id,
    pathRel,
    titleZh,
    titleEn,
    titleJa,
    artist,
    album,
    duration,
    categoryIds: [],
    lyricsRel,
    addedAt: new Date().toISOString(),
  }
}

/** 扫描所有已登记音乐根，合并进总曲库并写回 data/library */
export async function rescanAllRoots(appRoot: string): Promise<TrackRecord[]> {
  const roots = loadRoots(appRoot)
  const existing = loadTracks(appRoot)
  const lyricsMap = loadLyricsMap(appRoot)
  const scanned: TrackRecord[] = []

  for (const root of roots) {
    const rootAbs = resolveRootAbsolute(appRoot, root)
    try {
      await fs.access(rootAbs)
    } catch {
      continue
    }
    const files = await listAudioFiles(rootAbs)
    for (const f of files) {
      const rec = await fileToRecord(appRoot, root, f)
      if (lyricsMap[rec.id]) rec.lyricsRel = lyricsMap[rec.id]
      scanned.push(rec)
    }
  }

  // 保留用户手改过的三语标题 / 分类（同 id 合并时优先已有非空）
  const merged = mergeTrackLists(scanned, existing)
  // mergeTrackLists 是 existing 被 incoming 覆盖逻辑——我们要 scanned 为基、保留 existing 的编辑
  const byId = new Map(scanned.map((t) => [t.id, t]))
  for (const old of existing) {
    const cur = byId.get(old.id)
    if (!cur) continue
    byId.set(old.id, {
      ...cur,
      titleZh: old.titleZh || cur.titleZh,
      titleEn: old.titleEn || cur.titleEn,
      titleJa: old.titleJa || cur.titleJa,
      artist: old.artist || cur.artist,
      album: old.album || cur.album,
      categoryIds: old.categoryIds.length ? old.categoryIds : cur.categoryIds,
      lyricsRel: old.lyricsRel || cur.lyricsRel,
      titleDisplay: old.titleDisplay || cur.titleDisplay,
    })
  }
  const final = [...byId.values()]
  saveTracks(appRoot, final)

  const nextMap: Record<string, string> = { ...lyricsMap }
  for (const t of final) {
    if (t.lyricsRel) nextMap[t.id] = t.lyricsRel
  }
  saveLyricsMap(appRoot, nextMap)
  return final
}

export function trackToPlayable(
  appRoot: string,
  track: TrackRecord,
  roots: MusicRoot[],
  toMediaUrl: (p: string) => string,
) {
  const root = roots.find((r) => r.id === track.rootId)
  if (!root) return null
  const abs = absoluteTrackPath(appRoot, root, track)
  return {
    id: track.id,
    path: abs,
    title: displayTitle(track),
    titleZh: track.titleZh,
    titleEn: track.titleEn,
    titleJa: track.titleJa,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    fileUrl: toMediaUrl(abs),
    categoryIds: track.categoryIds,
    lyricsRel: track.lyricsRel,
    rootId: track.rootId,
    pathRel: track.pathRel,
    titleDisplay: track.titleDisplay,
  }
}

/** 按文件名规则一键填充三语标题与艺人（覆盖写入） */
export function applyFilenameMetaToAll(appRoot: string): { updated: number; total: number } {
  const tracks = loadTracks(appRoot)
  let updated = 0
  for (const t of tracks) {
    const base = path.basename(t.pathRel)
    const fields = applyParsedToTrackFields(parseFilenameMeta(base))
    const next = {
      ...t,
      artist: fields.artist,
      titleZh: fields.titleZh,
      titleEn: fields.titleEn,
      titleJa: fields.titleJa,
    }
    if (
      next.artist !== t.artist ||
      next.titleZh !== t.titleZh ||
      next.titleEn !== t.titleEn ||
      next.titleJa !== t.titleJa
    ) {
      updated += 1
    }
    Object.assign(t, next)
  }
  saveTracks(appRoot, tracks)
  return { updated, total: tracks.length }
}

export async function renameTrackFile(
  appRoot: string,
  trackId: string,
  meta: { artist: string; titleZh: string; titleEn: string; titleJa: string },
): Promise<{ ok: true; track: TrackRecord; oldId: string } | { ok: false; error: string }> {
  const roots = loadRoots(appRoot)
  const tracks = loadTracks(appRoot)
  const i = tracks.findIndex((t) => t.id === trackId)
  if (i < 0) return { ok: false, error: '曲目不存在' }
  const track = tracks[i]
  const root = roots.find((r) => r.id === track.rootId)
  if (!root) return { ok: false, error: '音乐根不存在' }

  const absOld = absoluteTrackPath(appRoot, root, track)
  const ext = path.extname(absOld)
  const newName = buildCanonicalFilename({ ...meta, ext })
  // 清理 Windows 非法字符
  const safeName = newName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim()
  const dir = path.dirname(absOld)
  const absNew = path.join(dir, safeName)

  if (path.resolve(absOld) !== path.resolve(absNew)) {
    try {
      await fs.access(absNew)
      return { ok: false, error: `目标文件已存在：${safeName}` }
    } catch {
      // ok
    }
    try {
      await fs.rename(absOld, absNew)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : '重命名失败' }
    }
    // 同名 .lrc 一并改名
    const oldLrc = absOld.replace(/\.[^.]+$/, '.lrc')
    const newLrc = absNew.replace(/\.[^.]+$/, '.lrc')
    try {
      await fs.access(oldLrc)
      await fs.rename(oldLrc, newLrc)
    } catch {
      // no lrc
    }
  }

  const rootAbs = resolveRootAbsolute(appRoot, root)
  const pathRel = path.relative(rootAbs, absNew)
  const newId = makeTrackId(root.id, pathRel)
  const lyricsMap = loadLyricsMap(appRoot)
  const gains = loadGains(appRoot)

  if (lyricsMap[track.id]) {
    const oldRel = lyricsMap[track.id]
    delete lyricsMap[track.id]
    const maybeNewLrc = toRelativeIfUnderRoot(getPathAppRoot(), absNew.replace(/\.[^.]+$/, '.lrc'))
    lyricsMap[newId] = oldRel.endsWith('.lrc') ? maybeNewLrc : oldRel
  }
  if (gains[track.id] != null) {
    gains[newId] = gains[track.id]
    delete gains[track.id]
  }

  const next: TrackRecord = {
    ...track,
    id: newId,
    pathRel,
    artist: meta.artist,
    titleZh: meta.titleZh,
    titleEn: meta.titleEn,
    titleJa: meta.titleJa,
    lyricsRel: lyricsMap[newId] ?? track.lyricsRel,
  }
  tracks[i] = next
  saveTracks(appRoot, tracks)
  saveLyricsMap(appRoot, lyricsMap)
  saveGains(appRoot, gains)
  return { ok: true, track: next, oldId: trackId }
}

function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim()
}

/**
 * 将外部音频按规范文件名复制到指定音乐根，写入曲库元数据（不改动源文件名以外的源路径；源文件保留）。
 */
export async function importAudioFile(
  appRoot: string,
  payload: {
    sourcePath: string
    rootId: string
    artist: string
    titleZh: string
    titleEn: string
    titleJa: string
  },
): Promise<{ ok: true; track: TrackRecord } | { ok: false; error: string }> {
  const roots = loadRoots(appRoot)
  const root = roots.find((r) => r.id === payload.rootId)
  if (!root) return { ok: false, error: '入库音乐根不存在' }

  const sourcePath = path.resolve(payload.sourcePath)
  try {
    await fs.access(sourcePath)
  } catch {
    return { ok: false, error: '源文件不存在' }
  }

  const ext = path.extname(sourcePath) || '.mp3'
  if (!AUDIO_EXT.has(ext.toLowerCase())) {
    return { ok: false, error: `不支持的音频格式：${ext}` }
  }

  const rootAbs = resolveRootAbsolute(appRoot, root)
  const newName = safeFileName(
    buildCanonicalFilename({
      artist: payload.artist,
      titleZh: payload.titleZh,
      titleEn: payload.titleEn,
      titleJa: payload.titleJa,
      ext,
    }),
  )
  const absNew = path.join(rootAbs, newName)

  if (path.resolve(sourcePath) !== path.resolve(absNew)) {
    try {
      await fs.access(absNew)
      return { ok: false, error: `目标已存在：${newName}` }
    } catch {
      // ok
    }
    try {
      await fs.mkdir(rootAbs, { recursive: true })
      await fs.copyFile(sourcePath, absNew)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : '复制失败' }
    }
    const oldLrc = sourcePath.replace(/\.[^.]+$/, '.lrc')
    const newLrc = absNew.replace(/\.[^.]+$/, '.lrc')
    try {
      await fs.access(oldLrc)
      await fs.copyFile(oldLrc, newLrc)
    } catch {
      // no lrc
    }
  }

  const rec = await fileToRecord(appRoot, root, absNew)
  const next: TrackRecord = {
    ...rec,
    artist: payload.artist || rec.artist,
    titleZh: payload.titleZh,
    titleEn: payload.titleEn,
    titleJa: payload.titleJa,
  }

  const tracks = loadTracks(appRoot)
  const idx = tracks.findIndex((t) => t.id === next.id)
  if (idx >= 0) tracks[idx] = { ...tracks[idx], ...next }
  else tracks.push(next)
  saveTracks(appRoot, tracks)
  return { ok: true, track: next }
}

/** 校验后按文件名填充：要求能拆出艺人，且至少有一个标题字段 */
export function applyFilenameMetaVerified(appRoot: string): {
  updated: number
  skipped: number
  total: number
  samples: Array<{ pathRel: string; before: object; after: object }>
} {
  const tracks = loadTracks(appRoot)
  let updated = 0
  let skipped = 0
  const samples: Array<{ pathRel: string; before: object; after: object }> = []
  for (const t of tracks) {
    const base = path.basename(t.pathRel)
    const parsed = parseFilenameMeta(base)
    const fields = applyParsedToTrackFields(parsed)
    const confident =
      Boolean(fields.artist && fields.artist !== '未知艺人') &&
      Boolean(fields.titleZh || fields.titleEn || fields.titleJa)
    if (!confident) {
      skipped += 1
      continue
    }
    const before = {
      artist: t.artist,
      titleZh: t.titleZh,
      titleEn: t.titleEn,
      titleJa: t.titleJa,
    }
    const after = {
      artist: fields.artist,
      titleZh: fields.titleZh,
      titleEn: fields.titleEn,
      titleJa: fields.titleJa,
    }
    if (
      before.artist === after.artist &&
      before.titleZh === after.titleZh &&
      before.titleEn === after.titleEn &&
      before.titleJa === after.titleJa
    ) {
      continue
    }
    Object.assign(t, after)
    updated += 1
    if (samples.length < 20) samples.push({ pathRel: t.pathRel, before, after })
  }
  saveTracks(appRoot, tracks)
  return { updated, skipped, total: tracks.length, samples }
}
