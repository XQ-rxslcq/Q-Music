# scripts/ · q-music（Q-Music）专用脚本

> 本目录只放**本项目专用**脚本。默认不提升到工作区根 `scripts/`；若需通用化，须你明确说「提升为通用」。

## 脚本索引

| 名称 | 内容 | 创建时间 | 备注 |
|------|------|----------|------|
| `check-node.mjs` | `npm run dev` 前检查 Node >= 18 | 2026-09-08 | 主路径 |
| `dev.ps1` | 兼容兜底启动；无写死盘符 | 2026-09-08 | `npm run dev:compat` |
| `dist-win.ps1` | 测试 + 构建 + 便携包到 `dist/<version>/` | 2026-09-08 | `npm run dist:win` |
| `run-regression.ps1` | 跑全量 Vitest 回归 | 2026-09-08 | `npm test` |
| `gen-app-icon.py` | Comfortaa 白 Q + `#2a9fd4` → png/ico | 2026-09-09 | 需 Pillow |
| `probe-lrclib.mjs` | 探测 lrclib 命中率（手工） | 2026-09-09 | 非 CI |
| `fill-library-meta.ts` | 校验后按文件名填 tracks.json（不改磁盘名） | 2026-09-10 | `node --experimental-strip-types scripts/fill-library-meta.ts [--dry]` |

## 索引

<!-- INDEX-START -->
| name | type | size | created | modified | notes |
|------|------|------|---------|----------|-------|
| check-node.mjs | file | 614 B | 2026-09-08 | 2026-09-10 | |
| dev.ps1 | file | 2.5 KB | 2026-09-08 | 2026-09-10 | |
| dist-win.ps1 | file | 1.3 KB | 2026-09-08 | 2026-09-11 | |
| fill-library-meta.ts | file | 3.0 KB | 2026-09-10 | 2026-09-10 | |
| gen-app-icon.py | file | 2.4 KB | 2026-09-09 | 2026-09-10 | |
| probe-global-hotkey.mjs | file | 3.3 KB | 2026-09-10 | 2026-09-10 | |
| probe-global-hotkey-sendkeys.ps1 | file | 1.7 KB | 2026-09-10 | 2026-09-10 | |
| probe-lrclib.mjs | file | 2.8 KB | 2026-09-09 | 2026-09-10 | |
| run-regression.ps1 | file | 536 B | 2026-09-08 | 2026-09-10 | |
| test-hotkeys-e2e.ps1 | file | 8.4 KB | 2026-09-10 | 2026-09-10 | |
<!-- INDEX-END -->
