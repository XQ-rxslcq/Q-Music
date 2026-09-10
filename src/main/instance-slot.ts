import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  buildInstanceIdentity,
  shouldShowSlotLabel,
  type InstanceIdentity,
} from '../core/instance-identity'

export type { InstanceIdentity }
export { buildInstanceIdentity, shouldShowSlotLabel }

const SLOT_DIR_NAME = 'instance-slots'
const MAX_SLOTS = 32

function slotDir(appDataPath: string): string {
  return path.join(appDataPath, 'QMusic', SLOT_DIR_NAME)
}

function isPidAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    return code === 'EPERM'
  }
}

function readPid(file: string): number | null {
  try {
    const n = Number(fs.readFileSync(file, 'utf8').trim())
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function sweepDeadSlots(dir: string) {
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const file = path.join(dir, `${i}.pid`)
    if (!fs.existsSync(file)) continue
    const pid = readPid(file)
    if (!pid || !isPidAlive(pid)) {
      try {
        fs.unlinkSync(file)
      } catch {
        // ignore
      }
    }
  }
}

/** 清理已退出进程占用的槽位，并领取最小空闲槽（从 1 起） */
export function allocateInstanceSlot(appDataPath: string): number {
  const dir = slotDir(appDataPath)
  fs.mkdirSync(dir, { recursive: true })
  sweepDeadSlots(dir)

  for (let i = 1; i <= MAX_SLOTS; i++) {
    const file = path.join(dir, `${i}.pid`)
    if (fs.existsSync(file)) {
      const pid = readPid(file)
      if (pid && isPidAlive(pid)) continue
    }
    try {
      fs.writeFileSync(file, String(process.pid), { flag: 'wx' })
      return i
    } catch {
      // 竞态
    }
  }
  return (process.pid % 900) + 100
}

export function releaseInstanceSlot(appDataPath: string, slot: number) {
  if (!slot || slot < 1) return
  const file = path.join(slotDir(appDataPath), `${slot}.pid`)
  try {
    const pid = readPid(file)
    if (pid === process.pid || !pid) fs.unlinkSync(file)
  } catch {
    // ignore
  }
}

/** 当前仍存活的实例数（读槽位 pid） */
export function countLiveInstanceSlots(appDataPath: string): number {
  const dir = slotDir(appDataPath)
  if (!fs.existsSync(dir)) return 0
  sweepDeadSlots(dir)
  let n = 0
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const file = path.join(dir, `${i}.pid`)
    if (!fs.existsSync(file)) continue
    const pid = readPid(file)
    if (pid && isPidAlive(pid)) n += 1
  }
  return n
}

export function identityForSlot(
  slot: number,
  multiMode: boolean,
  appDataPath: string,
): InstanceIdentity {
  if (!multiMode) {
    return buildInstanceIdentity(1, { multiMode: false, showSlotLabel: false })
  }
  const live = countLiveInstanceSlots(appDataPath)
  return buildInstanceIdentity(slot, {
    multiMode: true,
    showSlotLabel: shouldShowSlotLabel(live),
  })
}

export function resolveInstanceIdentity(multiInstance: boolean): InstanceIdentity {
  const appData = app.getPath('appData')
  if (!multiInstance) {
    return buildInstanceIdentity(1, { multiMode: false, showSlotLabel: false })
  }
  const slot = allocateInstanceSlot(appData)
  return identityForSlot(slot, true, appData)
}

/** 监听槽位目录变化（其它实例启动/退出时刷新显示名） */
export function watchInstanceSlots(
  appDataPath: string,
  onChange: () => void,
): () => void {
  const dir = slotDir(appDataPath)
  fs.mkdirSync(dir, { recursive: true })
  let timer: NodeJS.Timeout | null = null
  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      try {
        onChange()
      } catch {
        // ignore
      }
    }, 150)
  }
  let watcher: fs.FSWatcher | null = null
  try {
    watcher = fs.watch(dir, () => schedule())
  } catch {
    // ignore
  }
  const poll = setInterval(schedule, 2500)
  return () => {
    if (timer) clearTimeout(timer)
    clearInterval(poll)
    try {
      watcher?.close()
    } catch {
      // ignore
    }
  }
}
