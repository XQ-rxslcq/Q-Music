/**
 * 校验并按文件名填充 tracks.json 元数据（不改磁盘文件名）。
 * 用法：在 q-music 根目录执行
 *   node --experimental-strip-types scripts/fill-library-meta.ts
 *   node --experimental-strip-types scripts/fill-library-meta.ts --dry
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyParsedToTrackFields, parseFilenameMeta } from '../src/core/filename-meta.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')
const tracksPath = path.join(appRoot, 'data', 'library', 'tracks.json')
const dry = process.argv.includes('--dry')

type Track = {
  pathRel: string
  artist: string
  titleZh: string
  titleEn: string
  titleJa: string
  [k: string]: unknown
}

const tracks = JSON.parse(fs.readFileSync(tracksPath, 'utf8')) as Track[]
let updated = 0
let skipped = 0
const samples: unknown[] = []
const suspicious: string[] = []

for (const t of tracks) {
  const base = path.basename(t.pathRel)
  const fields = applyParsedToTrackFields(parseFilenameMeta(base))
  const confident =
    Boolean(fields.artist && fields.artist !== '未知艺人') &&
    Boolean(fields.titleZh || fields.titleEn || fields.titleJa)
  if (!confident) {
    skipped += 1
    suspicious.push(base)
    continue
  }
  const before = {
    artist: t.artist,
    titleZh: t.titleZh,
    titleEn: t.titleEn,
    titleJa: t.titleJa,
  }
  const after = {
    artist: fields.artist,
    titleZh: fields.titleZh,
    titleEn: fields.titleEn,
    titleJa: fields.titleJa,
  }
  if (
    before.artist === after.artist &&
    before.titleZh === after.titleZh &&
    before.titleEn === after.titleEn &&
    before.titleJa === after.titleJa
  ) {
    continue
  }
  // 抽查：艺人主要片段应能在文件名中找到
  const nameNorm = base.toLowerCase().replace(/\s+/g, '')
  const artistParts = after.artist
    .toLowerCase()
    .split(/[、,/&]/)
    .map((s) => s.replace(/\s+/g, '').trim())
    .filter((s) => s.length >= 2)
  const artistOk =
    !artistParts.length || artistParts.some((p) => nameNorm.includes(p))
  if (!artistOk) {
    skipped += 1
    suspicious.push(`artist-mismatch:${base}`)
    continue
  }
  Object.assign(t, after)
  updated += 1
  if (samples.length < 15) samples.push({ pathRel: t.pathRel, before, after })
}

const report = {
  dry,
  total: tracks.length,
  updated,
  skipped,
  samples,
  suspiciousHead: suspicious.slice(0, 20),
}
const reportPath = path.join(appRoot, 'scratch', 'fill-meta-report.json')
fs.mkdirSync(path.dirname(reportPath), { recursive: true })
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
console.log(`report -> ${reportPath} updated=${updated} skipped=${skipped} total=${tracks.length}`)

if (!dry) {
  fs.writeFileSync(tracksPath, JSON.stringify(tracks, null, 2), 'utf8')
  console.log(`wrote ${tracksPath}`)
}
