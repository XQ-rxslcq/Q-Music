import { useMemo, useRef, useState } from 'react'
import type { Category, Track } from './vite-env'

type Props = {
  open: boolean
  anchorLabel: string
  categories: Category[]
  library: Track[]
  currentId: string
  onClose: () => void
  onSelect: (categoryId: string) => void
  onCreate: (name: string) => void | Promise<void>
  onAddSelectedToQueue: (categoryIds: string[]) => void
  onExcludeSelectedFromQueue: (categoryIds: string[]) => void
}

export default function PlaylistPicker({
  open,
  anchorLabel,
  categories,
  library,
  currentId,
  onClose,
  onSelect,
  onCreate,
  onAddSelectedToQueue,
  onExcludeSelectedFromQueue,
}: Props) {
  const [checked, setChecked] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const downOnMask = useRef(false)

  const rows = useMemo(() => {
    const allCount = library.length
    const list: Array<{ id: string; name: string; count: number }> = [
      { id: '', name: '总曲库（全部）', count: allCount },
      ...categories.map((c) => ({
        id: c.id,
        name: c.name,
        count: library.filter((t) => t.categoryIds?.includes(c.id)).length,
      })),
      {
        id: '__uncategorized',
        name: '未分类',
        count: library.filter((t) => !t.categoryIds?.length).length,
      },
    ]
    return list
  }, [categories, library])

  if (!open) return null

  const toggle = (id: string) => {
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const submitCreate = async () => {
    const name = newName.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      await onCreate(name)
      setNewName('')
      setCreating(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="playlist-mask"
      onPointerDown={(e) => {
        downOnMask.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        if (!downOnMask.current) return
        onClose()
      }}
    >
      <div
        className="playlist-pop"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="playlist-pop-head">
          <strong>歌单 · {anchorLabel}</strong>
          <button type="button" className="icon" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="playlist-pop-tools">
          <button
            type="button"
            className="ghost"
            disabled={!checked.length}
            onClick={() => onAddSelectedToQueue(checked)}
          >
            加入队列
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!checked.length}
            onClick={() => onExcludeSelectedFromQueue(checked)}
          >
            队列排除
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setCreating((v) => !v)
              setNewName('')
            }}
          >
            新建歌单
          </button>
        </div>
        {creating && (
          <div className="playlist-create">
            <input
              autoFocus
              className="playlist-create-input"
              placeholder="输入歌单名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitCreate()
                if (e.key === 'Escape') {
                  setCreating(false)
                  setNewName('')
                }
              }}
            />
            <button type="button" className="primary" disabled={busy || !newName.trim()} onClick={() => void submitCreate()}>
              创建
            </button>
          </div>
        )}
        <ul className="playlist-list">
          {rows.map((r) => (
            <li key={r.id || 'all'} className={currentId === r.id ? 'on' : ''}>
              <label className="playlist-check" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={checked.includes(r.id)}
                  onChange={() => toggle(r.id)}
                />
              </label>
              <button
                type="button"
                className="playlist-name"
                onClick={() => {
                  onSelect(r.id)
                  onClose()
                }}
              >
                <span>{r.name}</span>
                <span className="meta">{r.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
