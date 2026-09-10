# Q-Music

Windows 便携本地音乐播放器（Electron + React）。

支持多格式播放、播放队列、歌词同步、音量归一、音频截取；主题与桌面歌词可配。默认单开，可在设置里允许多开。

## 下载

到 [Releases](https://github.com/XQ-rxslcq/Q-Music/releases) 下载 `Q-Music-*-portable.exe`，解压或直接运行即可（无需安装 Node）。

可选：本机 PATH 中有 `ffmpeg` 时可用截取等能力。

## 开发

```powershell
npm install
npm test
npm run dev
npm run dist:win
```

需要 Node ≥ 18。
