import { describe, expect, it } from 'vitest'
import path from 'node:path'
import {
  appJoin,
  ensureQmdataSuffix,
  fromRelativeToRoot,
  resolveAppRoot,
  resolveDataDir,
  resolveLogsDir,
  toRelativeIfUnderRoot,
} from '../src/core/app-paths'

describe('resolveAppRoot', () => {
  it('dev uses parent of mainDir', () => {
    const mainDir = path.join('repo', 'q-music', 'dist-electron')
    const root = resolveAppRoot({
      isPackaged: false,
      execPath: path.join('repo', 'q-music', 'node_modules', 'electron', 'electron.exe'),
      mainDir,
    })
    expect(root).toBe(path.resolve(mainDir, '..'))
  })

  it('packaged uses portable env first', () => {
    const root = resolveAppRoot({
      isPackaged: true,
      execPath: path.join('D:', 'Other', 'Q-Music.exe'),
      mainDir: path.join('D:', 'Other', 'resources', 'app.asar'),
      portableExecutableDir: path.join('E:', 'Apps', 'Q-Music'),
    })
    expect(root).toBe(path.resolve(path.join('E:', 'Apps', 'Q-Music')))
  })

  it('packaged falls back to exe directory', () => {
    const exe = path.join('F:', 'Portable', 'Q-Music', 'Q-Music.exe')
    const root = resolveAppRoot({
      isPackaged: true,
      execPath: exe,
      mainDir: path.join('F:', 'Portable', 'Q-Music', 'resources', 'app.asar'),
      portableExecutableDir: null,
    })
    expect(root).toBe(path.resolve(path.dirname(exe)))
  })
})

describe('relative joins', () => {
  it('appJoin never needs drive letter literals', () => {
    const root = path.join('X:', 'Anywhere', 'Q-Music')
    expect(resolveDataDir(root)).toBe(path.join(root, 'qmdata'))
    expect(resolveLogsDir(path.join(root, 'qmdata'))).toBe(path.join(root, 'qmdata', 'logs'))
    expect(appJoin(root, 'qmdata', 'config.json')).toBe(path.join(root, 'qmdata', 'config.json'))
  })

  it('roundtrips relative music paths under root', () => {
    const root = path.join('C:', 'Apps', 'Q-Music')
    const abs = path.join(root, 'MusicLibrary', 'a.mp3')
    const rel = toRelativeIfUnderRoot(root, abs)
    expect(rel).toBe(path.join('MusicLibrary', 'a.mp3'))
    expect(fromRelativeToRoot(root, rel)).toBe(path.resolve(abs))
  })

  it('keeps external absolute paths as-is', () => {
    const root = path.join('C:', 'Apps', 'Q-Music')
    const external = path.join('D:', 'Songs', 'b.mp3')
    expect(toRelativeIfUnderRoot(root, external)).toBe(external)
  })
})

describe('defaultQmdataDir', () => {
  it('defaults beside app root', async () => {
    const { defaultQmdataDir, resolveQmdataDir } = await import('../src/core/app-paths')
    const appRoot = path.join('D:', 'Apps', 'Q-Music')
    const appData = path.join('C:', 'Users', 'x', 'AppData', 'Roaming')
    expect(defaultQmdataDir(appRoot)).toBe(path.join(appRoot, 'qmdata'))
    const resolved = resolveQmdataDir(appRoot, appData)
    expect(resolved.dataDir).toBe(path.join(appRoot, 'qmdata'))
  })
})

describe('ensureQmdataSuffix', () => {
  it('appends qmdata when missing', () => {
    const parent = path.join('D:', 'MusicStore')
    expect(ensureQmdataSuffix(parent)).toBe(path.join(parent, 'qmdata'))
  })

  it('does not double-append when already ends with qmdata', () => {
    const dir = path.join('D:', 'MusicStore', 'qmdata')
    expect(ensureQmdataSuffix(dir)).toBe(path.resolve(dir))
    expect(ensureQmdataSuffix(path.join('D:', 'MusicStore', 'QMDATA'))).toBe(
      path.resolve(path.join('D:', 'MusicStore', 'QMDATA')),
    )
  })
})
