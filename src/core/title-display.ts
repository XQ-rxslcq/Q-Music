/** 多语种曲名显示：主标题 + 副标题标签（CN/JP/EN） */

export type TitleLang = 'zh' | 'ja' | 'en'

export type TitleDisplaySettings = {
  /** 主标题语种；auto 按 zh → ja → en */
  primary: TitleLang | 'auto'
  /** 各语种是否作为副标题显示（主标题不会重复出现） */
  show: Record<TitleLang, boolean>
}

export const DEFAULT_TITLE_DISPLAY: TitleDisplaySettings = {
  primary: 'auto',
  show: { zh: true, ja: true, en: true },
}

export const TITLE_LANG_ORDER: TitleLang[] = ['zh', 'ja', 'en']

export const TITLE_LANG_TAG: Record<TitleLang, 'CN' | 'JP' | 'EN'> = {
  zh: 'CN',
  ja: 'JP',
  en: 'EN',
}

export const TITLE_LANG_LABEL: Record<TitleLang | 'auto', string> = {
  auto: '自动（中→日→英）',
  zh: '中文 CN',
  ja: '日语 JP',
  en: '英语 EN',
}

export type TrackTitleFields = {
  titleZh?: string | null
  titleEn?: string | null
  titleJa?: string | null
  title?: string | null
  pathRel?: string | null
  path?: string | null
  titleDisplay?: Partial<TitleDisplaySettings> | null
}

export type TitleAliasPart = {
  lang: TitleLang
  tag: 'CN' | 'JP' | 'EN'
  text: string
}

export type ResolvedTrackTitles = {
  primary: string
  primaryLang: TitleLang | null
  aliases: TitleAliasPart[]
}

function fileBase(pathLike: string): string {
  const s = pathLike.replace(/\\/g, '/')
  const name = s.split('/').pop() || s
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

export function mergeTitleDisplay(
  partial?: Partial<TitleDisplaySettings> | null,
): TitleDisplaySettings {
  const p = partial || {}
  const showIn: Partial<Record<TitleLang, boolean>> = p.show || {}
  return {
    primary: p.primary === 'zh' || p.primary === 'ja' || p.primary === 'en' ? p.primary : 'auto',
    show: {
      zh: showIn.zh !== false,
      ja: showIn.ja !== false,
      en: showIn.en !== false,
    },
  }
}

function textOf(t: TrackTitleFields, lang: TitleLang): string {
  if (lang === 'zh') return (t.titleZh || '').trim()
  if (lang === 'ja') return (t.titleJa || '').trim()
  return (t.titleEn || '').trim()
}

function fallbackTitle(t: TrackTitleFields): string {
  const raw = (t.title || '').trim()
  if (raw) return raw
  const fromPath = t.pathRel || t.path || ''
  return fromPath ? fileBase(fromPath) : '未命名'
}

/** 解析列表用主标题与副标题（带 CN/JP/EN） */
export function resolveTrackTitles(t: TrackTitleFields): ResolvedTrackTitles {
  const pref = mergeTitleDisplay(t.titleDisplay)
  const available = TITLE_LANG_ORDER.filter((lang) => Boolean(textOf(t, lang)))

  let primaryLang: TitleLang | null = null
  if (pref.primary !== 'auto' && textOf(t, pref.primary)) {
    primaryLang = pref.primary
  } else {
    primaryLang = available[0] || null
  }

  const primary = primaryLang ? textOf(t, primaryLang) : fallbackTitle(t)
  const aliases: TitleAliasPart[] = []
  for (const lang of TITLE_LANG_ORDER) {
    if (lang === primaryLang) continue
    if (!pref.show[lang]) continue
    const text = textOf(t, lang)
    if (!text) continue
    aliases.push({ lang, tag: TITLE_LANG_TAG[lang], text })
  }

  return { primary, primaryLang, aliases }
}

/** 仅主标题字符串（播放器、桌面歌词等） */
export function resolvePrimaryTitle(t: TrackTitleFields): string {
  return resolveTrackTitles(t).primary
}
