/** 从文件名解析艺人 / 中英日标题（适配常见本地归档命名） */

export type ParsedFilenameMeta = {
  artist: string
  titleZh: string
  titleEn: string
  titleJa: string
  /** 无法拆分时的整段标题兜底 */
  rawTitle: string
}

const RE_KANA = /[\u3040-\u30ff]/
const RE_CJK = /[\u4e00-\u9fff]/
const RE_LATIN = /[A-Za-z]/

export function scriptKind(text: string): 'ja' | 'zh' | 'en' | 'mixed' | 'other' {
  const t = text.trim()
  if (!t) return 'other'
  const hasKana = RE_KANA.test(t)
  const hasCjk = RE_CJK.test(t)
  const hasLatin = RE_LATIN.test(t)
  if (hasKana) return 'ja'
  if (hasCjk && !hasLatin) return 'zh'
  if (hasLatin && !hasCjk) return 'en'
  if (hasCjk && hasLatin) return 'mixed'
  if (hasCjk) return 'zh'
  return 'other'
}

function stripExt(name: string): string {
  return name.replace(/\.[^.\\/]+$/, '')
}

/** 去掉末尾版本标记类括号内容，返回主标题 + 翻译候选 */
function splitTrailingParens(title: string): { main: string; parens: string[] } {
  let s = title.trim()
  const parens: string[] = []
  // 反复吃掉末尾 (...) 或 （...）
  for (;;) {
    const m = s.match(/^(.*?)[\s]*[（(]([^）)]+)[）)]\s*$/u)
    if (!m) break
    const inner = m[2].trim()
    // 版本类标记不作为翻译字段
    if (/^(tv|short|full|ver\.?|version|remix|cover|feat\.?|翻自|日语填词)/i.test(inner)) {
      s = m[1].trim()
      continue
    }
    parens.unshift(inner)
    s = m[1].trim()
  }
  return { main: s, parens }
}

function assignByScript(
  parts: string[],
): Pick<ParsedFilenameMeta, 'titleZh' | 'titleEn' | 'titleJa'> {
  let titleZh = ''
  let titleEn = ''
  let titleJa = ''
  for (const p of parts) {
    const k = scriptKind(p)
    if (k === 'ja' && !titleJa) titleJa = p
    else if (k === 'zh' && !titleZh) titleZh = p
    else if (k === 'en' && !titleEn) titleEn = p
    else if (k === 'mixed') {
      if (!titleJa && RE_KANA.test(p)) titleJa = p
      else if (!titleZh) titleZh = p
      else if (!titleEn && RE_LATIN.test(p)) titleEn = p
    } else if (!titleZh && !titleJa && !titleEn) {
      titleZh = p
    }
  }
  return { titleZh, titleEn, titleJa }
}

function normalizeArtist(a: string): string {
  return a
    .replace(/^【\s*/, '')
    .replace(/\s*】$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 解析规则（按优先级）：
 * 1. 【艺人】标题… / 【艺人】标题(中文)
 * 2. 《标题》艺人 / 「标题」艺人 / "标题"-艺人
 * 3. 艺人 - 标题…（支持 、 多艺人；缺空格的 `-` 也试）
 * 4. 整段作为标题
 */
export function parseFilenameMeta(fileName: string): ParsedFilenameMeta {
  const base = stripExt(fileName).replace(/\u00a0/g, ' ').trim()
  const empty: ParsedFilenameMeta = {
    artist: '',
    titleZh: '',
    titleEn: '',
    titleJa: '',
    rawTitle: base,
  }
  if (!base) return empty

  let artist = ''
  let titlePart = base

  const bracketArtist = base.match(/^【([^】]*)】\s*(.+)$/u)
  if (bracketArtist) {
    artist = normalizeArtist(bracketArtist[1] || '')
    titlePart = bracketArtist[2].trim()
  } else {
    const book = base.match(/^《([^》]+)》\s*[-–—]?\s*(.+)$/u)
    if (book) {
      titlePart = book[1].trim()
      artist = normalizeArtist(book[2])
    } else {
      const jpQuote = base.match(/^「([^」]+)」\s*[-–—]?\s*(.+)$/u)
      if (jpQuote) {
        titlePart = jpQuote[1].trim()
        artist = normalizeArtist(jpQuote[2])
      } else {
        const dq = base.match(/^["“]([^"”]+)["”]\s*[-–—]?\s*(.+)$/u)
        if (dq) {
          titlePart = dq[1].trim()
          artist = normalizeArtist(dq[2])
        } else {
          const dash =
            base.match(/^(.+?)\s+[-–—]\s+(.+)$/u) || base.match(/^(.+?)\s*[-–—]\s*(.+)$/u)
          if (dash && dash[1].length < 80) {
            artist = normalizeArtist(dash[1])
            titlePart = dash[2].trim()
          } else {
            // 歌手 歌曲名（中文）/ 歌手 歌曲名(中文)：空格分隔且标题侧带括号
            const spaced = base.match(
              /^(.+?)\s+(.+?[（(][^）)]+[）)].*)$/u,
            )
            if (spaced && spaced[1].length < 60 && !/[（(]/.test(spaced[1])) {
              artist = normalizeArtist(spaced[1])
              titlePart = spaced[2].trim()
            }
          }
        }
      }
    }
  }

  const { main, parens } = splitTrailingParens(titlePart)
  const assigned = assignByScript([main, ...parens].filter(Boolean))

  // 主标题若仍未归入任何语种字段，按脚本写入
  if (!assigned.titleZh && !assigned.titleEn && !assigned.titleJa && main) {
    const k = scriptKind(main)
    if (k === 'ja') assigned.titleJa = main
    else if (k === 'en') assigned.titleEn = main
    else assigned.titleZh = main
  } else if (main) {
    const k = scriptKind(main)
    if (k === 'ja' && !assigned.titleJa) assigned.titleJa = main
    else if (k === 'en' && !assigned.titleEn) assigned.titleEn = main
    else if (k === 'zh' && !assigned.titleZh) assigned.titleZh = main
    else if (!assigned.titleJa && !assigned.titleEn && !assigned.titleZh) assigned.titleZh = main
  }

  return {
    artist: artist || '',
    titleZh: assigned.titleZh,
    titleEn: assigned.titleEn,
    titleJa: assigned.titleJa,
    rawTitle: main || titlePart || base,
  }
}

/** 规范文件名：【歌手】歌曲名（中文名）.ext；纯中文只写主歌名 */
export function buildCanonicalFilename(meta: {
  artist: string
  titleZh: string
  titleEn: string
  titleJa: string
  ext: string
}): string {
  const zh = meta.titleZh.trim()
  const en = meta.titleEn.trim()
  const ja = meta.titleJa.trim()
  // 主歌名优先日/英，否则中文（本身是中文则只放歌曲名处）
  const primary = ja || en || zh || '未命名'
  const artist = meta.artist.trim() || '未知艺人'
  let name = `【${artist}】${primary}`
  if (zh && zh !== primary) name += `（${zh}）`
  const ext = meta.ext.startsWith('.') ? meta.ext : meta.ext ? `.${meta.ext}` : ''
  return `${name}${ext}`
}

/** 把文件名拆成可选词块，供「选词填充」 */
export function tokenizeForNaming(fileName: string): string[] {
  const base = stripExt(fileName).replace(/\u00a0/g, ' ').trim()
  if (!base) return []
  const tokens: string[] = []
  const re =
    /【[^】]*】|《[^》]*》|「[^」]*」|"[^"]+"|“[^”]+”|[（(][^）)]+[）)]|[^\s\-–—、,，/|【】《》「」"'“”（()）]+|[\-–—]|、|,|，/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(base))) {
    const t = m[0].trim()
    if (!t || /^[\-–—]$/.test(t)) continue
    // 括号内容单独成词
    const inner = t.match(/^[（(](.+)[）)]$/u)
    if (inner) tokens.push(inner[1].trim())
    else if (/^【.*】$/.test(t)) tokens.push(t.slice(1, -1).trim() || t)
    else if (/^《.*》$/.test(t)) tokens.push(t.slice(1, -1).trim() || t)
    else if (/^「.*」$/.test(t)) tokens.push(t.slice(1, -1).trim() || t)
    else if (/^["“].*["”]$/.test(t)) tokens.push(t.slice(1, -1).trim() || t)
    else tokens.push(t)
  }
  return tokens.filter(Boolean)
}

export function applyParsedToTrackFields(parsed: ParsedFilenameMeta): {
  artist: string
  titleZh: string
  titleEn: string
  titleJa: string
} {
  return {
    artist: parsed.artist || '未知艺人',
    titleZh: parsed.titleZh || (parsed.artist ? '' : parsed.rawTitle),
    titleEn: parsed.titleEn,
    titleJa: parsed.titleJa,
  }
}
