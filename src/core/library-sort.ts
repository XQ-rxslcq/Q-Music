/** 曲库列表排序（纯逻辑，便于单测） */

export type LibrarySortKey = 'artist' | 'title' | 'mtime' | 'birthtime'
export type LibrarySortDir = 'asc' | 'desc'

export type LibrarySortable = {
  id: string
  artist?: string
  title?: string
  titleZh?: string
  titleEn?: string
  titleJa?: string
  mtimeMs?: number
  birthtimeMs?: number
  addedAt?: string
}

function titleKey(t: LibrarySortable): string {
  return (t.titleZh || t.titleJa || t.titleEn || t.title || '').trim().toLowerCase()
}

function artistKey(t: LibrarySortable): string {
  return (t.artist || '').trim().toLowerCase()
}

function timeKey(t: LibrarySortable, which: 'mtime' | 'birthtime'): number {
  if (which === 'mtime') return t.mtimeMs ?? 0
  if (t.birthtimeMs && t.birthtimeMs > 0) return t.birthtimeMs
  // 旧曲库无 birthtime 时用入库时间兜底
  if (t.addedAt) {
    const ms = Date.parse(t.addedAt)
    if (Number.isFinite(ms)) return ms
  }
  return 0
}

export function compareLibraryTracks(
  a: LibrarySortable,
  b: LibrarySortable,
  key: LibrarySortKey,
  dir: LibrarySortDir,
): number {
  let cmp = 0
  if (key === 'artist') {
    cmp = artistKey(a).localeCompare(artistKey(b), 'zh')
    if (!cmp) cmp = titleKey(a).localeCompare(titleKey(b), 'zh')
  } else if (key === 'title') {
    cmp = titleKey(a).localeCompare(titleKey(b), 'zh')
    if (!cmp) cmp = artistKey(a).localeCompare(artistKey(b), 'zh')
  } else {
    cmp = timeKey(a, key) - timeKey(b, key)
    if (!cmp) cmp = titleKey(a).localeCompare(titleKey(b), 'zh')
  }
  if (!cmp) cmp = a.id.localeCompare(b.id)
  return dir === 'asc' ? cmp : -cmp
}

export function sortLibraryTracks<T extends LibrarySortable>(
  list: T[],
  key: LibrarySortKey,
  dir: LibrarySortDir,
): T[] {
  return [...list].sort((a, b) => compareLibraryTracks(a, b, key, dir))
}
