import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME } from '../src/core/library-model'
import {
  applyBgStyleChange,
  mergeThemeBackgroundFields,
  selectSingleBackground,
} from '../src/core/theme-bg'

describe('theme-bg', () => {
  it('切换轮换→单图时恢复 singleBgImageRel', () => {
    const rotate = {
      ...DEFAULT_THEME,
      bgStyle: 'rotate' as const,
      singleBgImageRel: 'backgrounds/bg-old.jpg',
      bgImageRel: 'bg-rotate/cur.jpg',
    }
    const image = applyBgStyleChange(rotate, 'image')
    expect(image.bgStyle).toBe('image')
    expect(image.bgImageRel).toBe('backgrounds/bg-old.jpg')
    expect(image.singleBgImageRel).toBe('backgrounds/bg-old.jpg')
  })

  it('单图模式下 merge 使用 singleBgImageRel', () => {
    const t = mergeThemeBackgroundFields({
      ...DEFAULT_THEME,
      bgStyle: 'image',
      singleBgImageRel: 'backgrounds/a.jpg',
      bgImageRel: 'bg-rotate/stale.jpg',
    })
    expect(t.bgImageRel).toBe('backgrounds/a.jpg')
  })

  it('点选轮换池图片可记为单图选中', () => {
    const t = selectSingleBackground(DEFAULT_THEME, 'bg-rotate/pool.jpg')
    expect(t.singleBgImageRel).toBe('bg-rotate/pool.jpg')
    expect(t.bgImageRel).toBe('bg-rotate/pool.jpg')
    expect(t.bgStyle).toBe('image')
  })
})
