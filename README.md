# Q-Music

Windows 本地音乐播放器（Electron + React）。

支持多格式播放、播放队列、歌词同步、音量归一、音频截取；主题与桌面歌词可配。默认单开，可在设置里允许多开。

## 下载

到 [Releases](https://github.com/XQ-rxslcq/Q-Music/releases) 任选其一：

| 产物 | 说明 |
|------|------|
| `Q-Music-*-setup.exe` | **安装包**：可自选安装路径；安装内容即 `win-unpacked`；默认数据在安装目录下的 `qmdata` |
| `Q-Music-*-portable.exe` | 便携单文件（解压即用） |
| `win-unpacked/` | 免安装目录，直接运行 `Q-Music.exe` |

无需安装 Node。本机 PATH 有 `ffmpeg` 时可用截取等能力。

## 开发

```powershell
npm install
npm test
npm run dev
npm run dist:win
```

`dist:win` 会输出到 `dist/<version>/`：同时生成便携包与 NSIS 安装包。

需要 Node ≥ 18。

> 开发模式进程名为 `electron.exe`，OOPZ / 音量合成器里通常显示 **Electron**，不是 Q-Music。按应用名选源请用打包后的 **Q-Music.exe**。
