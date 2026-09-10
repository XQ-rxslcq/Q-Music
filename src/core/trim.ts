/** ffmpeg 截取参数构建（纯函数，便于回归） */

export type TrimRequest = {
  inputPath: string
  outputPath: string
  startSec: number
  endSec: number
  /** 优先尝试流复制；失败由调用方改重编码 */
  copyCodec?: boolean
}

export type TrimValidation =
  | { ok: true; duration: number }
  | { ok: false; error: string }

export function validateTrimRange(
  startSec: number,
  endSec: number,
  mediaDurationSec?: number,
): TrimValidation {
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    return { ok: false, error: '起止时间无效' }
  }
  if (startSec < 0) return { ok: false, error: '起点不能小于 0' }
  if (endSec <= startSec) return { ok: false, error: '终点必须大于起点' }
  if (mediaDurationSec != null && Number.isFinite(mediaDurationSec)) {
    if (startSec >= mediaDurationSec) return { ok: false, error: '起点超出曲目长度' }
    if (endSec > mediaDurationSec + 0.05) {
      return { ok: false, error: '终点超出曲目长度' }
    }
  }
  return { ok: true, duration: endSec - startSec }
}

/** 生成 ffmpeg argv（不含可执行文件名） */
export function buildFfmpegTrimArgs(req: TrimRequest): string[] {
  const v = validateTrimRange(req.startSec, req.endSec)
  if (!v.ok) throw new Error(v.error)

  const args = ['-y', '-ss', String(req.startSec), '-to', String(req.endSec), '-i', req.inputPath]
  if (req.copyCodec) {
    args.push('-c', 'copy')
  } else {
    args.push('-c:a', 'libmp3lame', '-q:a', '2')
  }
  args.push(req.outputPath)
  return args
}
