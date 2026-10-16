/** 歌词工作台专用标签（与首页歌单 categories 分离） */

export type WorkbenchTag = {
  id: string
  name: string
}

/** trackId → 自定义标签 id 列表 */
export type WorkbenchTagMap = Record<string, string[]>

export type WorkbenchTagsPayload = {
  tags: WorkbenchTag[]
  byTrack: WorkbenchTagMap
}

/** 虚拟标签：已绑定歌词 / 未绑定（不入库） */
export const VIRTUAL_TAG_CONFIGURED = '__wb_configured__'
export const VIRTUAL_TAG_MISSING = '__wb_missing__'

export const VIRTUAL_WORKBENCH_TAGS: WorkbenchTag[] = [
  { id: VIRTUAL_TAG_CONFIGURED, name: '已配置' },
  { id: VIRTUAL_TAG_MISSING, name: '未配置' },
]

export function isVirtualWorkbenchTag(id: string): boolean {
  return id === VIRTUAL_TAG_CONFIGURED || id === VIRTUAL_TAG_MISSING
}

export function mergeWorkbenchTags(raw?: Partial<WorkbenchTagsPayload> | null): WorkbenchTagsPayload {
  const tags = Array.isArray(raw?.tags)
    ? raw!.tags
        .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string' && t.name.trim())
        .map((t) => ({ id: t.id, name: t.name.trim() }))
        .filter((t) => !isVirtualWorkbenchTag(t.id))
    : []
  const byTrack: WorkbenchTagMap = {}
  const src = raw?.byTrack && typeof raw.byTrack === 'object' ? raw.byTrack : {}
  for (const [trackId, ids] of Object.entries(src)) {
    if (!Array.isArray(ids)) continue
    const cleaned = ids.filter((id) => typeof id === 'string' && id && !isVirtualWorkbenchTag(id))
    if (cleaned.length) byTrack[trackId] = [...new Set(cleaned)]
  }
  return { tags, byTrack }
}

export type WorkbenchFilterable = {
  id: string
  lyricsRel?: string | null
  title?: string
  titleZh?: string
  titleEn?: string
  titleJa?: string
  artist?: string
  album?: string
}

/** 多选标签：须同时满足（AND）；空选 = 不过滤 */
export function trackMatchesWorkbenchTags(
  track: WorkbenchFilterable,
  selectedTagIds: string[],
  byTrack: WorkbenchTagMap,
): boolean {
  if (!selectedTagIds.length) return true
  const custom = new Set(byTrack[track.id] || [])
  const hasLyrics = Boolean(track.lyricsRel)
  for (const id of selectedTagIds) {
    if (id === VIRTUAL_TAG_CONFIGURED) {
      if (!hasLyrics) return false
      continue
    }
    if (id === VIRTUAL_TAG_MISSING) {
      if (hasLyrics) return false
      continue
    }
    if (!custom.has(id)) return false
  }
  return true
}

export function filterWorkbenchTracks<T extends WorkbenchFilterable>(
  tracks: T[],
  opts: {
    query: string
    selectedTagIds: string[]
    byTrack: WorkbenchTagMap
  },
): T[] {
  const q = opts.query.trim().toLowerCase()
  return tracks.filter((t) => {
    if (!trackMatchesWorkbenchTags(t, opts.selectedTagIds, opts.byTrack)) return false
    if (!q) return true
    const hay = [t.title, t.titleZh, t.titleEn, t.titleJa, t.artist, t.album]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function makeWorkbenchTagId(): string {
  return `wbt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
