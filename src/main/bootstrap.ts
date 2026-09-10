import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  DEFAULT_CONFIG,
  resolveAppRoot,
  resolveConfigPath,
  resolveDataDir,
  resolveLogsDir,
  resolveUserDataDir,
  type AppConfig,
  type PathRuntime,
} from '../core/app-paths'
import { ensureLibraryLayout } from './store'

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

/**
 * 双击 exe 时自动初始化：相对应用根目录创建 data/ 及子结构，无需命令行。
 */
export function bootstrapPortableApp(mainDir: string): BootstrapResult {
  const appRoot = resolveAppRoot(runtimeFromElectron(mainDir))
  const dataDir = resolveDataDir(appRoot)
  const logsDir = resolveLogsDir(appRoot)
  const configPath = resolveConfigPath(appRoot)
  const userDataDir = resolveUserDataDir(appRoot)

  app.setPath('userData', userDataDir)

  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(logsDir, { recursive: true })
  fs.mkdirSync(userDataDir, { recursive: true })
  ensureLibraryLayout(appRoot)

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
        'Q-Music portable data',
        '本目录随程序一起拷贝即可在其它电脑使用。',
        '',
        'data/config.json     应用配置（含播放顺序等）',
        'data/theme.json      外观（含背景图路径、模块透明度）',
        'data/library/        多音乐根、曲目索引、歌词映射、分类',
        'data/backgrounds/    背景图文件',
        'data/logs/           日志',
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
