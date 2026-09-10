import path from 'node:path'

/** 同目录同名 .lrc */
export function siblingLrcPath(audioPath: string): string {
  const parsed = path.parse(audioPath)
  return path.join(parsed.dir, `${parsed.name}.lrc`)
}

export function isAudioExt(filePath: string, exts: ReadonlySet<string>): boolean {
  return exts.has(path.extname(filePath).toLowerCase())
}

/** 截取输出默认文件名：name.trim.ext */
export function defaultTrimOutputPath(audioPath: string, ext = '.mp3'): string {
  const parsed = path.parse(audioPath)
  const outExt = ext.startsWith('.') ? ext : `.${ext}`
  return path.join(parsed.dir, `${parsed.name}.trim${outExt}`)
}
