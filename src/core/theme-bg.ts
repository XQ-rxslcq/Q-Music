import type { ThemeSettings } from './library-model'

/** 相对 qmdata 的路径是否属于单张背景目录 backgrounds/ */
export function isSingleBackgroundRel(rel: string | null | undefined): boolean {
  if (!rel) return false
  const n = rel.replace(/\\/g, '/').toLowerCase()
  return n.includes('backgrounds/')
}

export function isBgRotateRel(rel: string | null | undefined): boolean {
  if (!rel) return false
  const n = rel.replace(/\\/g, '/').toLowerCase()
  return n.includes('bg-rotate/')
}

/** 从磁盘读出后合并 singleBgImageRel，并在 image 模式下恢复单图指针 */
export function mergeThemeBackgroundFields(
  theme: ThemeSettings,
  rawSingle?: string | null,
): ThemeSettings {
  let singleBgImageRel =
    typeof rawSingle === 'string' && rawSingle.trim() ? rawSingle : theme.singleBgImageRel ?? null
  if (!singleBgImageRel && isSingleBackgroundRel(theme.bgImageRel)) {
    singleBgImageRel = theme.bgImageRel
  }
  let bgImageRel = theme.bgImageRel
  if (theme.bgStyle === 'image') {
    bgImageRel = singleBgImageRel
  }
  return { ...theme, singleBgImageRel, bgImageRel }
}

/** 切换背景模式时保留单图与轮换各自的 rel，避免互相覆盖 */
export function applyBgStyleChange(theme: ThemeSettings, bgStyle: ThemeSettings['bgStyle']): ThemeSettings {
  if (bgStyle === theme.bgStyle) return theme
  const merged = mergeThemeBackgroundFields(theme)
  if (bgStyle === 'image') {
    return {
      ...merged,
      bgStyle: 'image',
      bgImageRel: merged.singleBgImageRel,
    }
  }
  if (bgStyle === 'rotate') {
    return { ...merged, bgStyle: 'rotate' }
  }
  return { ...merged, bgStyle }
}

/** 落盘前：image 模式写回单图 rel；rotate 不改动 singleBgImageRel */
export function normalizeThemeBeforeSave(theme: ThemeSettings): ThemeSettings {
  const merged = mergeThemeBackgroundFields(theme)
  if (merged.bgStyle === 'image' && isSingleBackgroundRel(merged.bgImageRel)) {
    return {
      ...merged,
      singleBgImageRel: merged.bgImageRel,
      bgImageRel: merged.bgImageRel,
    }
  }
  if (merged.bgStyle === 'image' && merged.singleBgImageRel) {
    return { ...merged, bgImageRel: merged.singleBgImageRel }
  }
  return merged
}
