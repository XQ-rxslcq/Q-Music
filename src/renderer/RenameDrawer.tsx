import { useEffect, useMemo, useState } from 'react'
import { buildCanonicalFilename, tokenizeForNaming } from '../core/filename-meta'
import type { Track } from './vite-env'
import { useFilenameSelectionFill } from './use-filename-selection-fill'
import DrawerShell from './DrawerShell'

type Field = 'artist' | 'titleZh' | 'titleEn' | 'titleJa'

  type Props = {
  open: boolean
  track: Track | null
  onClose: () => void
  onConfirm: (meta: {
    id: string
    artist: string
    titleZh: string
    titleEn: string
    titleJa: string
  }) => void | Promise<void>
}

export default function RenameDrawer({ open, track, onClose, onConfirm }: Props) {
  const [artist, setArtist] = useState('')
  const [titleZh, setTitleZh] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [titleJa, setTitleJa] = useState('')
  const [target, setTarget] = useState<Field>('artist')
  const [baseline, setBaseline] = useState('')
  const { sourceRef, fillOnFocus } = useFilenameSelectionFill()

  useEffect(() => {
    if (!track) return
    const a = track.artist || ''
    const zh = track.titleZh || ''
    const en = track.titleEn || ''
    const ja = track.titleJa || ''
    setArtist(a)
    setTitleZh(zh)
    setTitleEn(en)
    setTitleJa(ja)
    setTarget('artist')
    setBaseline(`${a}\0${zh}\0${en}\0${ja}`)
  }, [track?.id])

  const tokens = useMemo(() => {
    if (!track) return []
    return tokenizeForNaming(track.pathRel || track.path || track.title)
  }, [track])

  const preview = useMemo(() => {
    const ext = (track?.pathRel || track?.path || '.mp3').match(/\.[^.]+$/)?.[0] || '.mp3'
    return buildCanonicalFilename({ artist, titleZh, titleEn, titleJa, ext })
  }, [artist, titleZh, titleEn, titleJa, track])

  const dirty = Boolean(baseline) && `${artist}\0${titleZh}\0${titleEn}\0${titleJa}` !== baseline

  if (!open || !track) return null

  const fileLabel = track.pathRel || track.path || ''

  const applyToken = (tok: string) => {
    if (target === 'artist') {
      setArtist((prev) => (prev ? `${prev}、${tok}` : tok))
      return
    }
    if (target === 'titleZh') setTitleZh(tok)
    else if (target === 'titleEn') setTitleEn(tok)
    else setTitleJa(tok)
  }

  const doConfirm = async () => {
    await onConfirm({
      id: track.id,
      artist: artist.trim(),
      titleZh: titleZh.trim(),
      titleEn: titleEn.trim(),
      titleJa: titleJa.trim(),
    })
  }

  return (
    <DrawerShell
      open={open}
      title="选词重命名"
      onClose={onClose}
      dirty={dirty}
      onSave={doConfirm}
      panelClassName="theme-drawer track-edit"
    >
        <div className="theme-field">
          <span>原文件名（可拖选，再点下方输入框填入）</span>
          <p ref={sourceRef} className="filename-source">
            {fileLabel}
          </p>
        </div>

        <div className="theme-field">
          <span>填入目标（点词块写入；艺人可多次追加）</span>
          <div className="seg seg-2x2">
            {(
              [
                ['artist', '艺人'],
                ['titleZh', '中文'],
                ['titleEn', '英文'],
                ['titleJa', '日语'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={target === id ? 'active' : ''}
                onClick={() => setTarget(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="theme-field">
          <span>词块</span>
          <div className="token-cloud">
            {tokens.map((tok, i) => (
              <button key={`${tok}-${i}`} type="button" className="token" onClick={() => applyToken(tok)}>
                {tok}
              </button>
            ))}
          </div>
        </div>

        <label className="theme-field">
          <span>艺人</span>
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

        <p className="theme-tip">预览：{preview}</p>

        <button type="button" className="primary" onClick={() => void doConfirm()}>
          重命名文件并保存
        </button>
    </DrawerShell>
  )
}
