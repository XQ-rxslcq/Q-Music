/**
 * 用曲库实测 lrclib（与应用相同的清洗/优先日英逻辑）。
 * 用法：node scripts/probe-lrclib.mjs [数量]
 */
import fs from 'node:fs'
import path from 'node:path'
function cleanLyricsTitle(raw) {
  let s = (raw || '').trim()
  if (!s) return ''
  s = s.replace(/（/g, '(').replace(/）/g, ')')
  let prev = ''
  while (s !== prev) {
    prev = s
    s = s.replace(/\s*\([^)]*\)\s*$/u, '').trim()
  }
  return s
}

function primaryOf(t) {
  for (const c of [t.titleJa, t.titleEn, t.titleZh, t.title]) {
    const x = cleanLyricsTitle(c || '')
    if (x) return x
  }
  const fn = (t.pathRel || '').replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '')
  const m = fn.match(/^(.+?)\s+[-–—]\s+(.+)$/u)
  return cleanLyricsTitle(m ? m[2] : fn)
}

const tracks = JSON.parse(fs.readFileSync(path.join('data/library/tracks.json'), 'utf8'))

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function search(params) {
  const url = `https://lrclib.net/api/search?${new URLSearchParams(params)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Q-Music/1.0.0 probe', Accept: 'application/json' },
  })
  const data = await res.json()
  if (!Array.isArray(data)) return { n: 0, sync: 0, sample: '' }
  return {
    n: data.length,
    sync: data.filter((x) => x.syncedLyrics).length,
    sample: data[0] ? `${data[0].trackName} / ${data[0].artistName}` : '',
  }
}

async function main() {
  const n = Number(process.argv[2] || 40)
  const sample = tracks.slice(0, n)
  const lines = []
  let hit = 0
  let syncHit = 0
  for (const t of sample) {
    const primary = primaryOf(t)
    const artist = (t.artist || '').replace(/^未知艺人$/, '').trim()
    const variants = []
    if (primary && artist) variants.push({ q: `${artist} ${primary}` }, { track_name: primary, artist_name: artist })
    if (primary) variants.push({ q: primary }, { track_name: primary })
    if (t.titleZh) {
      const zh = cleanLyricsTitle(t.titleZh)
      if (zh && zh !== primary) variants.push({ q: zh })
    }
    let best = { n: 0, sync: 0, sample: '', q: '' }
    for (const v of variants.slice(0, 5)) {
      const r = await search(v)
      await sleep(450)
      if (r.sync > best.sync || (r.sync === best.sync && r.n > best.n)) best = { ...r, q: JSON.stringify(v) }
      if (r.sync > 0) break
    }
    if (best.n > 0) hit++
    if (best.sync > 0) syncHit++
    lines.push(
      `${best.sync ? 'SYNC' : best.n ? 'PLAIN' : 'MISS'}\t${t.artist} | ${primary}\t${best.q}\tn=${best.n}\tsync=${best.sync}\t${best.sample}`,
    )
  }
  lines.unshift(`any=${hit}/${sample.length} synced=${syncHit}/${sample.length}`)
  fs.writeFileSync('scratch-lrclib-probe.txt', lines.join('\n'), 'utf8')
  console.log(lines.join('\n'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
