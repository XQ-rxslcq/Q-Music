import path from 'node:path'
import fs from 'node:fs'

export type PathRuntime = {
  /** Electron app.isPackaged */
  isPackaged: boolean
  /** process.execPath */
  execPath: string
  /** import.meta / __dirname of main bundle */
  mainDir: string
  /** electron-builder portable 注入；未打包时为空 */
  portableExecutableDir?: string | null
}

/**
 * 应用程序“根目录”（exe / 项目根）
 * - 开发：源码项目根（mainDir 的上一级）
 * - 便携包：exe 所在目录（优先 PORTABLE_EXECUTABLE_DIR）
 */
export function resolveAppRoot(rt: PathRuntime): string {
  if (!rt.isPackaged) {
    return path.resolve(rt.mainDir, '..')
  }
  const portable = rt.portableExecutableDir?.trim()
  if (portable) return path.resolve(portable)
  return path.resolve(path.dirname(rt.execPath))
}

/** 一律相对 base 拼接，禁止写死盘符 */
export function appJoin(base: string, ...segments: string[]): string {
  return path.join(base, ...segments)
}

export const QMDATA_DIR_NAME = 'qmdata'
export const QMDATA_LOCATION_FILE = 'qmdata-location.json'

/**
 * 用户所选路径统一落到以 qmdata 结尾的目录：
 * - 已是 …/qmdata（大小写不敏感）→ 原样
 * - 否则 → …/所选/qmdata
 */
export function ensureQmdataSuffix(dir: string): string {
  const raw = String(dir || '').trim()
  if (!raw) return raw
  const resolved = path.resolve(raw)
  if (path.basename(resolved).toLowerCase() === QMDATA_DIR_NAME) return resolved
  return path.join(resolved, QMDATA_DIR_NAME)
}

/** 默认用户数据：程序目录下的 qmdata（安装版 / 便携版一致） */
export function defaultQmdataDir(appRoot: string): string {
  return path.join(appRoot, QMDATA_DIR_NAME)
}

/** 历史默认：%APPDATA%/QMusic/qmdata（仅迁移探测） */
export function roamingQmdataDir(appDataPath: string): string {
  return path.join(appDataPath, 'QMusic', QMDATA_DIR_NAME)
}

/** 旧版 AppData 目录名（带连字符） */
export function legacyDefaultQmdataDir(appDataPath: string): string {
  return path.join(appDataPath, 'Q-Music', QMDATA_DIR_NAME)
}

export function resolveQmdataLocationPath(appRoot: string): string {
  return path.join(appRoot, QMDATA_LOCATION_FILE)
}

export function readQmdataLocation(appRoot: string): string | null {
  const file = resolveQmdataLocationPath(appRoot)
  try {
    if (!fs.existsSync(file)) return null
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { path?: string }
    const p = typeof raw.path === 'string' ? raw.path.trim() : ''
    return p ? path.resolve(p) : null
  } catch {
    return null
  }
}

export function writeQmdataLocation(appRoot: string, dataDir: string) {
  const file = resolveQmdataLocationPath(appRoot)
  fs.writeFileSync(file, JSON.stringify({ path: path.resolve(dataDir) }, null, 2), 'utf8')
}

/**
 * 解析 qmdata 目录（不含创建）：
 * 1) 程序旁 qmdata-location.json
 * 2) 程序旁 qmdata/
 * 3) 程序旁旧版 data/（调用方可再改名为 qmdata）
 * 4) 旧版 %APPDATA%/Q-Music/qmdata 或 %APPDATA%/QMusic/qmdata（若已存在）
 * 5) 默认：程序旁 qmdata（安装目录 / 便携目录）
 */
export function resolveQmdataDir(appRoot: string, appDataPath: string): {
  dataDir: string
  legacyDataDir: string | null
} {
  const located = readQmdataLocation(appRoot)
  if (located) return { dataDir: located, legacyDataDir: null }

  const localQm = path.join(appRoot, QMDATA_DIR_NAME)
  if (fs.existsSync(localQm)) return { dataDir: localQm, legacyDataDir: null }

  const legacy = path.join(appRoot, 'data')
  if (fs.existsSync(legacy)) return { dataDir: legacy, legacyDataDir: legacy }

  const legacyAppData = legacyDefaultQmdataDir(appDataPath)
  if (fs.existsSync(legacyAppData)) return { dataDir: legacyAppData, legacyDataDir: null }

  const roaming = roamingQmdataDir(appDataPath)
  if (fs.existsSync(roaming)) return { dataDir: roaming, legacyDataDir: null }

  return { dataDir: defaultQmdataDir(appRoot), legacyDataDir: null }
}

/** @deprecated 用 resolveQmdataDir；测试兼容：相对 appRoot 的 qmdata */
export function resolveDataDir(appRoot: string): string {
  return appJoin(appRoot, QMDATA_DIR_NAME)
}

export function resolveLogsDir(dataDir: string): string {
  return path.join(dataDir, 'logs')
}

export function resolveConfigPath(dataDir: string): string {
  return path.join(dataDir, 'config.json')
}

export function resolveUserDataDir(dataDir: string): string {
  return path.join(dataDir, 'userdata')
}

export function resolveQueuePath(dataDir: string): string {
  return path.join(dataDir, 'queue.json')
}

export type AppConfig = {
  version: number
  initializedAt: string
  /** 用户可选的音乐根目录；存相对 appRoot 或绝对（绝对仅运行期） */
  musicRootRel?: string | null
  /** 播放顺序：顺序 / 列表循环 / 单曲 / 随机 */
  playMode?: 'sequence' | 'loop' | 'single' | 'shuffle'
  /** 拖入导入默认入库的音乐根 id；空则用第一个根 */
  importTargetRootId?: string | null
  /**
   * 允许同时运行多个进程。默认 false（单开）。
   * 仅对打包后的程序生效；开发模式不受限。
   */
  allowMultiInstance?: boolean
  /** 重启后是否恢复播放队列。默认 true */
  persistQueue?: boolean
  /**
   * 桌面歌词按钮/快捷键是否三态循环（显示未锁 → 锁定 → 隐藏）。
   * false 时仅显隐两态。默认 true。
   */
  desktopLyricsTripleCycle?: boolean
}

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  initializedAt: '',
  musicRootRel: null,
  playMode: 'loop',
  importTargetRootId: null,
  allowMultiInstance: false,
  persistQueue: true,
  desktopLyricsTripleCycle: true,
}

export type QueueState = {
  trackIds: string[]
  currentId: string | null
}

export const DEFAULT_QUEUE_STATE: QueueState = {
  trackIds: [],
  currentId: null,
}

/** 把绝对路径尽量收成相对 base；若出了 base 外则原样返回绝对路径 */
export function toRelativeIfUnderRoot(base: string, absolutePath: string): string {
  const rel = path.relative(base, absolutePath)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return absolutePath
  return rel
}

export function fromRelativeToRoot(base: string, maybeRel: string): string {
  if (path.isAbsolute(maybeRel)) return maybeRel
  return path.resolve(base, maybeRel)
}

/** 轻量读配置（单实例探测用，不创建目录） */
export function peekConfig(configPath: string): AppConfig | null {
  try {
    if (!fs.existsSync(configPath)) return null
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }
  } catch {
    return null
  }
}
