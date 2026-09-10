import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  DEFAULT_CONFIG,
  DEFAULT_QUEUE_STATE,
  QMDATA_DIR_NAME,
  defaultQmdataDir,
  peekConfig,
  resolveAppRoot,
  resolveConfigPath,
  resolveLogsDir,
  resolveQmdataDir,
  resolveQueuePath,
  resolveUserDataDir,
  writeQmdataLocation,
  type AppConfig,
  type PathRuntime,
  type QueueState,
} from '../core/app-paths'
import { ensureLibraryLayout, setPathAppRoot } from './store'

export type BootstrapResult = {
  appRoot: string
  dataDir: string
  logsDir: string
  configPath: string
  userDataDir: string
  config: AppConfig
  firstRun: boolean
}

function runtimeFromElectron(mainDir: string): PathRuntime {
  return {
    isPackaged: app.isPackaged,
    execPath: process.execPath,
    mainDir,
    portableExecutableDir: process.env.PORTABLE_EXECUTABLE_DIR || null,
  }
}

function migrateLegacyDataFolder(appRoot: string, legacyDataDir: string): string {
  const target = path.join(appRoot, QMDATA_DIR_NAME)
  if (path.resolve(legacyDataDir) === path.resolve(target)) return target
  if (fs.existsSync(target)) return target
  fs.renameSync(legacyDataDir, target)
  return target
}

/**
 * 仅解析路径 + 读 allowMultiInstance，不做 mkdir（供二次启动快速退场）。
 */
export function peekSingleInstancePolicy(mainDir: string): {
  appRoot: string
  allowMultiInstance: boolean
} {
  const appRoot = resolveAppRoot(runtimeFromElectron(mainDir))
  const appData = app.getPath('appData')
  const { dataDir, legacyDataDir } = resolveQmdataDir(appRoot, appData)
  const effective =
    legacyDataDir && dataDir === legacyDataDir ? path.join(appRoot, QMDATA_DIR_NAME) : dataDir
  // 旧 data 尚未改名时仍可读
  const candidates = [
    resolveConfigPath(dataDir),
    legacyDataDir ? resolveConfigPath(legacyDataDir) : null,
    resolveConfigPath(effective),
  ].filter(Boolean) as string[]
  for (const p of candidates) {
    const cfg = peekConfig(p)
    if (cfg) return { appRoot, allowMultiInstance: Boolean(cfg.allowMultiInstance) }
  }
  return { appRoot, allowMultiInstance: false }
}

/**
 * 初始化 qmdata：默认 %APPDATA%/Q-Music/qmdata；旧版程序旁 data/ 就地改名为 qmdata。
 */
export function bootstrapPortableApp(mainDir: string): BootstrapResult {
  const appRoot = resolveAppRoot(runtimeFromElectron(mainDir))
  setPathAppRoot(appRoot)

  const appData = app.getPath('appData')
  let { dataDir, legacyDataDir } = resolveQmdataDir(appRoot, appData)

  if (legacyDataDir && path.basename(legacyDataDir) === 'data') {
    dataDir = migrateLegacyDataFolder(appRoot, legacyDataDir)
  }

  writeQmdataLocation(appRoot, dataDir)

  const logsDir = resolveLogsDir(dataDir)
  const configPath = resolveConfigPath(dataDir)
  const userDataDir = resolveUserDataDir(dataDir)

  app.setPath('userData', userDataDir)

  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(logsDir, { recursive: true })
  fs.mkdirSync(userDataDir, { recursive: true })
  ensureLibraryLayout(dataDir)

  let firstRun = false
  let config: AppConfig
  if (!fs.existsSync(configPath)) {
    firstRun = true
    config = {
      ...DEFAULT_CONFIG,
      initializedAt: new Date().toISOString(),
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
    fs.writeFileSync(
      path.join(dataDir, 'README.txt'),
      [
        'Q-Music user data (qmdata)',
        `默认位置：程序目录下的 qmdata（${defaultQmdataDir(appRoot)}）`,
        '可在「应用行为设置」中更改路径；定位文件在程序目录 qmdata-location.json。',
        '',
        'config.json     应用配置',
        'theme.json      外观',
        'hotkeys.json    快捷键',
        'queue.json      播放队列（可关）',
        'library/        曲库索引',
        'backgrounds/    背景图',
        'logs/           日志',
        '',
      ].join('\n'),
      'utf8',
    )
  } else {
    try {
      config = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }
    } catch {
      config = { ...DEFAULT_CONFIG, initializedAt: new Date().toISOString() }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
    }
  }

  return { appRoot, dataDir, logsDir, configPath, userDataDir, config, firstRun }
}

export function readConfig(configPath: string): AppConfig {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }
  } catch {
    return { ...DEFAULT_CONFIG, initializedAt: new Date().toISOString() }
  }
}

export function writeConfig(configPath: string, config: AppConfig) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
}

export function readQueueState(dataDir: string): QueueState {
  try {
    const p = resolveQueuePath(dataDir)
    if (!fs.existsSync(p)) return { ...DEFAULT_QUEUE_STATE }
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Partial<QueueState>
    return {
      trackIds: Array.isArray(raw.trackIds) ? raw.trackIds.filter((x) => typeof x === 'string') : [],
      currentId: typeof raw.currentId === 'string' ? raw.currentId : null,
    }
  } catch {
    return { ...DEFAULT_QUEUE_STATE }
  }
}

export function writeQueueState(dataDir: string, state: QueueState) {
  const p = resolveQueuePath(dataDir)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf8')
}

/** 将整个 qmdata 目录移到新位置，更新定位文件，删除旧目录。 */
export function relocateQmdata(appRoot: string, fromDir: string, toDir: string): { ok: true } | { ok: false; error: string } {
  const from = path.resolve(fromDir)
  const to = path.resolve(toDir)
  if (from === to) {
    writeQmdataLocation(appRoot, to)
    return { ok: true }
  }
  try {
    if (fs.existsSync(to)) {
      const listing = fs.readdirSync(to)
      if (listing.length > 0) {
        return { ok: false, error: '目标目录已存在且非空，请换一个空目录' }
      }
      fs.rmSync(to, { recursive: true, force: true })
    }
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.cpSync(from, to, { recursive: true })
    writeQmdataLocation(appRoot, to)
    // 确认新目录可读后再删旧的
    if (!fs.existsSync(path.join(to, 'config.json')) && fs.existsSync(path.join(from, 'config.json'))) {
      return { ok: false, error: '移动后校验失败，已保留原目录' }
    }
    fs.rmSync(from, { recursive: true, force: true })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
