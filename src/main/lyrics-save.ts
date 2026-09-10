import fs from 'node:fs/promises'
import path from 'node:path'
import { toRelativeIfUnderRoot } from '../core/app-paths'
import { siblingLrcPath } from '../core/paths'
import {
  absoluteTrackPath,
  getPathAppRoot,
  lyricsPathInRoot,
  loadLyricsMap,
  loadRoots,
  loadTracks,
  resolveLyricsRootAbsolute,
  saveLyricsMap,
  saveTracks,
} from './store'

export type SaveLyricsResult =
  | { ok: true; path: string; lyricsRel: string }
  | { ok: false; error: string }

/**
 * 保存歌词：
 * - 若已设置歌词根目录 → 写入该目录下「与音频同主文件名」的 .lrc
 * - 否则 → 写入音频同目录同名 .lrc（旧行为）
 */
export async function saveLyricsForTrack(
  appRoot: string,
  trackId: string,
  content: string,
): Promise<SaveLyricsResult> {
  const tracks = loadTracks(appRoot)
  const roots = loadRoots(appRoot)
  const track = tracks.find((t) => t.id === trackId)
  if (!track) return { ok: false, error: '曲目不存在' }
  if (!track.rootId) return { ok: false, error: '曲目未绑定音乐根' }
  const root = roots.find((r) => r.id === track.rootId)
  if (!root) return { ok: false, error: '音乐根不存在' }
  const audioAbs = absoluteTrackPath(appRoot, root, track)
  const lyricsRootAbs = resolveLyricsRootAbsolute(appRoot)
  const lrcAbs = lyricsRootAbs
    ? lyricsPathInRoot(lyricsRootAbs, audioAbs)
    : path.join(path.parse(audioAbs).dir, `${path.parse(audioAbs).name}.lrc`)

  try {
    if (lyricsRootAbs) {
      await fs.mkdir(lyricsRootAbs, { recursive: true })
    }
    await fs.writeFile(lrcAbs, content.replace(/^\uFEFF/, ''), 'utf8')
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '写入歌词失败' }
  }

  const lyricsRel = toRelativeIfUnderRoot(getPathAppRoot(), lrcAbs)
  const map = loadLyricsMap(appRoot)
  map[trackId] = lyricsRel
  saveLyricsMap(appRoot, map)
  const i = tracks.findIndex((t) => t.id === trackId)
  if (i >= 0) {
    tracks[i] = { ...tracks[i], lyricsRel }
    saveTracks(appRoot, tracks)
  }
  return { ok: true, path: lrcAbs, lyricsRel }
}

/** @deprecated 使用 saveLyricsForTrack */
export const saveLyricsBesideAudio = saveLyricsForTrack

/** 解析曲目歌词文件：映射 → 歌词根同名 → 音频旁同名 */
export async function resolveLyricsFileForTrack(
  appRoot: string,
  trackId: string,
): Promise<{ path: string | null; via: 'map' | 'lyrics-root' | 'sibling' | null }> {
  const tracks = loadTracks(appRoot)
  const roots = loadRoots(appRoot)
  const track = tracks.find((t) => t.id === trackId)
  if (!track) return { path: null, via: null }
  const root = roots.find((r) => r.id === track.rootId)
  if (!root) return { path: null, via: null }
  const audioAbs = absoluteTrackPath(appRoot, root, track)

  const map = loadLyricsMap(appRoot)
  const mapped = map[trackId] || track.lyricsRel
  if (mapped) {
    const abs = path.isAbsolute(mapped) ? mapped : path.resolve(appRoot, mapped)
    try {
      await fs.access(abs)
      return { path: abs, via: 'map' }
    } catch {
      /* fall through */
    }
  }

  const lyricsRootAbs = resolveLyricsRootAbsolute(appRoot)
  if (lyricsRootAbs) {
    const inRoot = lyricsPathInRoot(lyricsRootAbs, audioAbs)
    try {
      await fs.access(inRoot)
      return { path: inRoot, via: 'lyrics-root' }
    } catch {
      /* fall through */
    }
  }

  const sibling = siblingLrcPath(audioAbs)
  try {
    await fs.access(sibling)
    return { path: sibling, via: 'sibling' }
  } catch {
    return { path: null, via: null }
  }
}
