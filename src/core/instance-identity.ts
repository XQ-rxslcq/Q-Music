export type InstanceIdentity = {
  /** 1-based 槽位（内部用；仅多开且并存时才体现在显示名） */
  slot: number
  /** 仅一台：Q-Music；两台及以上：Q-Music (n) */
  displayName: string
  /** Windows AppUserModelId；多开模式按槽位区分，避免任务栏合并错乱 */
  appUserModelId: string
}

/**
 * @param showSlotLabel 是否在显示名上附加 (n)。约定：仅当存活实例 ≥ 2 时为 true。
 */
export function buildInstanceIdentity(
  slot: number,
  opts: { multiMode: boolean; showSlotLabel: boolean },
): InstanceIdentity {
  const displayName = opts.showSlotLabel ? `Q-Music (${slot})` : 'Q-Music'
  const appUserModelId = opts.multiMode ? `com.qmusic.app.${slot}` : 'com.qmusic.app'
  return { slot, displayName, appUserModelId }
}

/** 存活实例数 ≥ 2 时才给显示名加编号 */
export function shouldShowSlotLabel(liveCount: number): boolean {
  return liveCount >= 2
}
