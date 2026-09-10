import { useEffect, useMemo, useState } from 'react'
import {
  applyParsedToTrackFields,
  buildCanonicalFilename,
  parseFilenameMeta,
} from '../core/filename-meta'
import type { MusicRoot } from './vite-env'
import { useFilenameSelectionFill } from './use-filename-selection-fill'
import DrawerShell from './DrawerShell'

export type ImportDraft = {
  sourcePath: string
  fileUrl: string
  fileName: string
}

type Props = {
  open: boolean
  draft: ImportDraft | null
  roots: MusicRoot[]
  importTargetRootId: string | null
  onImportTargetChange: (rootId: string) => void
  onClose: () => void
  onImport: (payload: {
    sourcePath: string
    rootId: string
    artist: string
    titleZh: string
    titleEn: string
    titleJa: string
  }) => Promise<void>
  onScanLoudness: (fileUrl: string) => Promise<void>
  scanning?: boolean
}

export default function ImportDrawer({
  open,
  draft,
  roots,
  importTargetRootId,
  onImportTargetChange,
  onClose,
  onImport,
  onScanLoudness,
  scanning,
}: Props) {
  const [artist, setArtist] = useState('')
  const [titleZh, setTitleZh] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [titleJa, setTitleJa] = useState('')
  const [busy, setBusy] = useState(false)
  const { sourceRef, fillOnFocus } = useFilenameSelectionFill()

  useEffect(() => {
    if (!draft) return
    const fields = applyParsedToTrackFields(parseFilenameMeta(draft.fileName))
    setArtist(fields.artist)
    setTitleZh(fields.titleZh)
    setTitleEn(fields.titleEn)
    setTitleJa(fields.titleJa)
  }, [draft?.sourcePath])

  const targetRootId = importTargetRootId || roots[0]?.id || ''
  const targetRoot = roots.find((r) => r.id === targetRootId) || roots[0] || null

  const preview = useMemo(() => {
    const ext = draft?.fileName.match(/\.[^.]+$/)?.[0] || '.mp3'
    return buildCanonicalFilename({ artist, titleZh, titleEn, titleJa, ext })
  }, [artist, titleZh, titleEn, titleJa, draft])

  if (!open || !draft) return null

  const canImport = Boolean(targetRoot) && !busy

  const doImport = async () => {
    if (!targetRootId) return
    setBusy(true)
    try {
      await onImport({
        sourcePath: draft.sourcePath,
        rootId: targetRootId,
        artist: artist.trim(),
        titleZh: titleZh.trim(),
        titleEn: titleEn.trim(),
        titleJa: titleJa.trim(),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <DrawerShell
      open={open}
      title="导入单曲"
      onClose={onClose}
      dirty
      onSave={canImport ? doImport : undefined}
      panelClassName="theme-drawer track-edit import-drawer"
    >
        <div className="theme-field">
          <span>原文件名（可拖选，再点下方输入框填入）</span>
          <p ref={sourceRef} className="filename-source">
            {draft.fileName}
          </p>
          <span className="theme-tip">{draft.sourcePath}</span>
        </div>

        <label className="theme-field">
          <span>入库目录</span>
          <select
            value={targetRootId}
            onChange={(e) => onImportTargetChange(e.target.value)}
            disabled={!roots.length}
          >
            {!roots.length && <option value="">请先添加音乐目录</option>}
            {roots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label || r.path}
              </option>
            ))}
          </select>
        </label>

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

        <p className="theme-tip">将保存为：{preview}</p>
        {targetRoot && (
          <p className="theme-tip">目标：{targetRoot.path}</p>
        )}

        <div className="import-actions">
          <button type="button" className="primary" disabled={!canImport} onClick={() => void doImport()}>
            {busy ? '入库中…' : '重命名并入库'}
          </button>
          <button
            type="button"
            disabled={scanning || !draft.fileUrl}
            onClick={() => void onScanLoudness(draft.fileUrl)}
          >
            {scanning ? '扫描中…' : '扫描响度（预览）'}
          </button>
        </div>
    </DrawerShell>
  )
}
