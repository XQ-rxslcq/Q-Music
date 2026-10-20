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

/** 单图模式当前选中（可与轮换池共用路径，单独记住） */
export function imageModeSelection(theme: ThemeSettings): string | null {
  if (theme.singleBgImageRel) return theme.singleBgImageRel
  if (theme.bgStyle === 'image' && theme.bgImageRel) return theme.bgImageRel
  if (isSingleBackgroundRel(theme.bgImageRel)) return theme.bgImageRel
  return null
}

/** 从磁盘读出后合并 singleBgImageRel，并在 image 模式下恢复单图指针 */
export function mergeThemeBackgroundFields(
  theme: ThemeSettings,
  rawSingle?: string | null,
): ThemeSettings {
  let singleBgImageRel =
    typeof rawSingle === 'string' && rawSingle.trim() ? rawSingle : theme.singleBgImageRel ?? null
  if (!singleBgImageRel) {
    singleBgImageRel = imageModeSelection(theme)
  }
  let bgImageRel = theme.bgImageRel
  if (theme.bgStyle === 'image') {
    bgImageRel = singleBgImageRel
  }
  return { ...theme, singleBgImageRel, bgImageRel }
}

export function selectSingleBackground(theme: ThemeSettings, rel: string | null): ThemeSettings {
  return {
    ...theme,
    bgStyle: 'image',
    singleBgImageRel: rel,
    bgImageRel: rel,
  }
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

/** 落盘前：image 模式写回 singleBgImageRel；rotate 不改动 singleBgImageRel */
export function normalizeThemeBeforeSave(theme: ThemeSettings): ThemeSettings {
  const merged = mergeThemeBackgroundFields(theme)
  if (merged.bgStyle !== 'image') return merged
  const sel = merged.singleBgImageRel ?? merged.bgImageRel
  return { ...merged, singleBgImageRel: sel, bgImageRel: sel }
}
