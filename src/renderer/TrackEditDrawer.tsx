import { useEffect, useMemo, useState } from 'react'
import type { Category, TitleDisplaySettings, Track } from './vite-env'
import {
  DEFAULT_TITLE_DISPLAY,
  TITLE_LANG_LABEL,
  TITLE_LANG_ORDER,
  mergeTitleDisplay,
  type TitleLang,
} from '../core/title-display'
import { useFilenameSelectionFill } from './use-filename-selection-fill'
import DrawerShell from './DrawerShell'

type Patch = {
  id: string
  titleZh: string
  titleEn: string
  titleJa: string
  artist: string
  album: string
  categoryIds: string[]
  titleDisplay: TitleDisplaySettings
}

type Props = {
  open: boolean
  track: Track | null
  categories: Category[]
  onClose: () => void
  onSave: (patch: Patch) => void | Promise<void>
}

function catsKey(ids: string[]) {
  return [...ids].sort().join(',')
}

function displayKey(d: TitleDisplaySettings) {
  const m = mergeTitleDisplay(d)
  return `${m.primary}|${m.show.zh},${m.show.ja},${m.show.en}`
}

export default function TrackEditDrawer({ open, track, categories, onClose, onSave }: Props) {
  const [titleZh, setTitleZh] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [titleJa, setTitleJa] = useState('')
  const [artist, setArtist] = useState('')
  const [album, setAlbum] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [titleDisplay, setTitleDisplay] = useState<TitleDisplaySettings>(DEFAULT_TITLE_DISPLAY)
  const [baseline, setBaseline] = useState('')
  const { sourceRef, fillOnFocus } = useFilenameSelectionFill()

  useEffect(() => {
    if (!track) return
    const zh = track.titleZh || ''
    const en = track.titleEn || ''
    const ja = track.titleJa || ''
    const ar = track.artist || ''
    const al = track.album || ''
    const cats = track.categoryIds ?? []
    const td = mergeTitleDisplay(track.titleDisplay)
    setTitleZh(zh)
    setTitleEn(en)
    setTitleJa(ja)
    setArtist(ar)
    setAlbum(al)
    setCategoryIds(cats)
    setTitleDisplay(td)
    setBaseline(`${zh}\0${en}\0${ja}\0${ar}\0${al}\0${catsKey(cats)}\0${displayKey(td)}`)
  }, [track?.id])

  const dirty = useMemo(() => {
    if (!track || !baseline) return false
    const cur = `${titleZh}\0${titleEn}\0${titleJa}\0${artist}\0${album}\0${catsKey(categoryIds)}\0${displayKey(titleDisplay)}`
    return cur !== baseline
  }, [track, baseline, titleZh, titleEn, titleJa, artist, album, categoryIds, titleDisplay])

  if (!open || !track) return null

  const fileLabel = track.pathRel || track.path || track.title || ''

  const toggleCat = (id: string) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  const setPrimary = (primary: TitleDisplaySettings['primary']) => {
    setTitleDisplay((prev) => ({ ...prev, primary }))
  }

  const toggleShow = (lang: TitleLang) => {
    setTitleDisplay((prev) => ({
      ...prev,
      show: { ...prev.show, [lang]: !prev.show[lang] },
    }))
  }

  const texts: Record<TitleLang, string> = {
    zh: titleZh.trim(),
    ja: titleJa.trim(),
    en: titleEn.trim(),
  }

  const buildPatch = (): Patch => ({
    id: track.id,
    titleZh: titleZh.trim(),
    titleEn: titleEn.trim(),
    titleJa: titleJa.trim(),
    artist: artist.trim(),
    album: album.trim(),
    categoryIds,
    titleDisplay: mergeTitleDisplay(titleDisplay),
  })

  const doSave = async () => {
    await onSave(buildPatch())
  }

  return (
    <DrawerShell open={open} title="编辑曲目" onClose={onClose} dirty={dirty} onSave={doSave}>
      <div className="theme-field">
        <span>原文件名（可拖选，再点下方输入框填入）</span>
        <p ref={sourceRef} className="filename-source">
          {fileLabel}
        </p>
      </div>

      <label className="theme-field">
        <span>中文标题</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={titleZh}
          onFocus={() => fillOnFocus(setTitleZh)}
          onChange={(e) => setTitleZh(e.target.value)}
        />
      </label>
      <label className="theme-field">
        <span>日语标题</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={titleJa}
          onFocus={() => fillOnFocus(setTitleJa)}
          onChange={(e) => setTitleJa(e.target.value)}
        />
      </label>
      <label className="theme-field">
        <span>英文标题</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={titleEn}
          onFocus={() => fillOnFocus(setTitleEn)}
          onChange={(e) => setTitleEn(e.target.value)}
        />
      </label>
      <label className="theme-field">
        <span>艺术家</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={artist}
          onFocus={() => fillOnFocus(setArtist)}
          onChange={(e) => setArtist(e.target.value)}
        />
      </label>
      <label className="theme-field">
        <span>专辑</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={album}
          onFocus={() => fillOnFocus(setAlbum)}
          onChange={(e) => setAlbum(e.target.value)}
        />
      </label>

      <h3 className="theme-sub">列表显示名</h3>
      <p className="theme-tip">
        主标题默认中文→日语→英语；副标题跟在歌名后，样式同艺人，带 CN / JP / EN 标签。末尾一列只显示艺人。
      </p>
      <label className="theme-field">
        <span>主标题</span>
        <div className="seg" style={{ flexWrap: 'wrap' }}>
          {(['auto', 'zh', 'ja', 'en'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={titleDisplay.primary === p ? 'active' : ''}
              disabled={p !== 'auto' && !texts[p]}
              onClick={() => setPrimary(p)}
            >
              {TITLE_LANG_LABEL[p]}
            </button>
          ))}
        </div>
      </label>
      <div className="theme-field">
        <span>副标题显示</span>
        <div className="cat-checks">
          {TITLE_LANG_ORDER.map((lang) => (
            <label key={lang} className="cat-check">
              <input
                type="checkbox"
                checked={titleDisplay.show[lang]}
                disabled={!texts[lang]}
                onChange={() => toggleShow(lang)}
              />
              {TITLE_LANG_LABEL[lang]}
              {texts[lang] ? `（${texts[lang]}）` : '（空）'}
            </label>
          ))}
        </div>
        <span className="theme-tip">主标题本身不会作为副标题重复出现；取消勾选即隐藏该语种。</span>
      </div>

      <div className="theme-field">
        <span>分类</span>
        <div className="cat-checks">
          {categories.map((c) => (
            <label key={c.id} className="cat-check">
              <input
                type="checkbox"
                checked={categoryIds.includes(c.id)}
                onChange={() => toggleCat(c.id)}
              />
              {c.name}
            </label>
          ))}
          {!categories.length && <span className="theme-tip">暂无分类，请先「新建分类」</span>}
        </div>
      </div>

      <button type="button" className="primary" onClick={() => void doSave()}>
        保存到 data/library
      </button>
    </DrawerShell>
  )
}
