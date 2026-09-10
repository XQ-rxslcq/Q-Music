import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { siblingLrcPath, defaultTrimOutputPath } from '../core/paths'
import { buildFfmpegTrimArgs, validateTrimRange } from '../core/trim'

export async function readTextFileSmart(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath)
  // UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8')
  }
  const asUtf8 = buf.toString('utf8')
  // 粗略检测：大量替换字符则再试 latin1（部分 ANSI 歌词可读；完整 GBK 后续可加解码库）
  const bad = (asUtf8.match(/\uFFFD/g) || []).length
  if (bad > 0 && bad / Math.max(asUtf8.length, 1) > 0.02) {
    return buf.toString('latin1')
  }
  return asUtf8
}

export async function loadSiblingLyrics(audioPath: string): Promise<{
  path: string | null
  content: string | null
}> {
  const lrc = siblingLrcPath(audioPath)
  try {
    await fs.access(lrc)
    const content = await readTextFileSmart(lrc)
    return { path: lrc, content }
  } catch {
    return { path: null, content: null }
  }
}

function runCmd(cmd: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true })
    let stderr = ''
    child.stderr.on('data', (d) => {
      stderr += String(d)
    })
    child.on('error', (err) => {
      resolve({ code: 1, stderr: err.message })
    })
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stderr })
    })
  })
}

export async function detectFfmpeg(): Promise<string | null> {
  const candidates = process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg']
  for (const c of candidates) {
    const r = await runCmd(c, ['-version'])
    if (r.code === 0) return c
  }
  return null
}

export async function trimAudio(opts: {
  inputPath: string
  startSec: number
  endSec: number
  outputPath?: string
}): Promise<{ ok: true; outputPath: string } | { ok: false; error: string }> {
  const check = validateTrimRange(opts.startSec, opts.endSec)
  if (!check.ok) return check

  const ffmpeg = await detectFfmpeg()
  if (!ffmpeg) {
    return { ok: false, error: '未找到 ffmpeg，请安装并加入 PATH 后重试' }
  }

  const outputPath = opts.outputPath || defaultTrimOutputPath(opts.inputPath)
  const tryCopy = buildFfmpegTrimArgs({
    inputPath: opts.inputPath,
    outputPath,
    startSec: opts.startSec,
    endSec: opts.endSec,
    copyCodec: true,
  })
  let result = await runCmd(ffmpeg, tryCopy)
  if (result.code !== 0) {
    const reencode = buildFfmpegTrimArgs({
      inputPath: opts.inputPath,
      outputPath,
      startSec: opts.startSec,
      endSec: opts.endSec,
      copyCodec: false,
    })
    result = await runCmd(ffmpeg, reencode)
  }
  if (result.code !== 0) {
    return { ok: false, error: result.stderr.slice(0, 500) || '截取失败' }
  }
  return { ok: true, outputPath: path.normalize(outputPath) }
}
