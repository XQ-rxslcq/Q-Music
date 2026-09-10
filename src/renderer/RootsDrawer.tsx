import DrawerShell from './DrawerShell'
import type { MusicRoot } from './vite-env'

type Props = {
  open: boolean
  onClose: () => void
  roots: MusicRoot[]
  lyricsRootAbs: string | null
  onNotify: (kind: 'ok' | 'error' | 'info', text: string) => void
  onLibraryChange: (lib: unknown) => void
  onLyricsRootChange: (abs: string | null) => void
}

export default function RootsDrawer({
  open,
  onClose,
  roots,
  lyricsRootAbs,
  onNotify,
  onLibraryChange,
  onLyricsRootChange,
}: Props) {
  if (!open) return null

  return (
    <DrawerShell open={open} title="目录绑定管理" onClose={onClose} panelClassName="theme-drawer roots-drawer">
      <h3 className="theme-sub">音乐目录</h3>
      <p className="theme-tip">已绑定的歌曲扫描根目录；移除后该根下曲目会从曲库索引中删除（不删磁盘文件）。</p>
      <ul className="roots-list">
        {roots.length === 0 && <li className="roots-empty">尚未绑定音乐目录</li>}
        {roots.map((r) => (
          <li key={r.id} className="roots-item">
            <div className="roots-item-main">
              <strong>{r.label || '未命名'}</strong>
              <code className="path-code">{r.path}</code>
            </div>
            <div className="roots-item-actions">
                  <button
                type="button"
                className="ghost tiny"
                onClick={() => {
                  void window.qmusic.openMusicRoot?.(r.id).then((err) => {
                    if (err) onNotify('error', err)
                  })
                }}
              >
                打开
              </button>
              <button
                type="button"
                className="ghost tiny danger"
                onClick={() => {
                  if (!window.confirm(`确定解除绑定「${r.label || r.path}」？\n不会删除磁盘上的音频文件。`)) return
                  void window.qmusic.removeMusicRoot(r.id).then((lib) => {
                    onLibraryChange(lib)
                    onNotify('ok', '已解除音乐目录绑定')
                  })
                }}
              >
                移除
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="panel-tools">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            void window.qmusic.addMusicRoot().then((lib) => {
              onLibraryChange(lib)
              onNotify('ok', '已添加音乐目录')
            })
          }}
        >
          添加音乐目录…
        </button>
        <button
          type="button"
          className="ghost"
          disabled={!roots.length}
          onClick={() => {
            void window.qmusic.rescanLibrary().then((lib) => {
              onLibraryChange(lib)
              onNotify('ok', '已重新扫描曲库')
            })
          }}
        >
          重新扫描
        </button>
      </div>

      <h3 className="theme-sub">歌词目录</h3>
      <p className="theme-tip">匹配/保存 LRC 时优先使用此目录（按音频同名）；未设置则写在音频同目录。</p>
      <ul className="roots-list">
        {lyricsRootAbs ? (
          <li className="roots-item">
            <div className="roots-item-main">
              <strong>歌词根目录</strong>
              <code className="path-code">{lyricsRootAbs}</code>
            </div>
            <div className="roots-item-actions">
              <button
                type="button"
                className="ghost tiny"
                onClick={() => {
                  void window.qmusic.openPath?.(lyricsRootAbs).then((err) => {
                    if (err) onNotify('error', err)
                  })
                }}
              >
                打开
              </button>
              <button
                type="button"
                className="ghost tiny danger"
                onClick={() => {
                  if (!window.confirm('确定清除歌词目录绑定？')) return
                  void window.qmusic.clearLyricsRoot().then((res) => {
                    onLibraryChange(res.library)
                    onLyricsRootChange(res.absPath)
                    onNotify('ok', '已清除歌词目录')
                  })
                }}
              >
                清除
              </button>
            </div>
          </li>
        ) : (
          <li className="roots-empty">尚未绑定歌词目录</li>
        )}
      </ul>
      <div className="panel-tools">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            void window.qmusic.pickLyricsRoot().then((res) => {
              onLibraryChange(res.library)
              onLyricsRootChange(res.absPath)
              onNotify('ok', res.absPath ? `歌词目录：${res.absPath}` : '未选择')
            })
          }}
        >
          {lyricsRootAbs ? '更换歌词目录…' : '选择歌词目录…'}
        </button>
      </div>
    </DrawerShell>
  )
}
