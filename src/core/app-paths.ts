import path from 'node:path'

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
 * 应用程序“根目录”（用户可把整个文件夹拷到任意盘符/路径）
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

/** 一律相对 appRoot 拼接，禁止写死盘符 */
export function appJoin(appRoot: string, ...segments: string[]): string {
  return path.join(appRoot, ...segments)
}

export function resolveDataDir(appRoot: string): string {
  return appJoin(appRoot, 'data')
}

export function resolveLogsDir(appRoot: string): string {
  return appJoin(appRoot, 'data', 'logs')
}

export function resolveConfigPath(appRoot: string): string {
  return appJoin(appRoot, 'data', 'config.json')
}

export function resolveUserDataDir(appRoot: string): string {
  // Electron 内部缓存/窗口状态等，仍落在应用旁，保证整夹拷贝即走
  return appJoin(appRoot, 'data', 'userdata')
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
}

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  initializedAt: '',
  musicRootRel: null,
  playMode: 'loop',
  importTargetRootId: null,
  allowMultiInstance: false,
}

/** 把绝对路径尽量收成相对 appRoot；若出了 appRoot 外则原样返回绝对路径 */
export function toRelativeIfUnderRoot(appRoot: string, absolutePath: string): string {
  const rel = path.relative(appRoot, absolutePath)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return absolutePath
  return rel
}

export function fromRelativeToRoot(appRoot: string, maybeRel: string): string {
  if (path.isAbsolute(maybeRel)) return maybeRel
  return path.resolve(appRoot, maybeRel)
}
