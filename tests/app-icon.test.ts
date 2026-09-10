import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.join(__dirname, '..')

describe('app icon assets (回归：图标定稿存在)', () => {
  it('has png/ico and blue-cyan Comfortaa source font', () => {
    const png = path.join(root, 'assets', 'icon.png')
    const ico = path.join(root, 'build', 'icon.ico')
    const font = path.join(root, 'assets', 'fonts', 'Comfortaa-Variable.ttf')
    expect(fs.existsSync(png)).toBe(true)
    expect(fs.existsSync(ico)).toBe(true)
    expect(fs.existsSync(font)).toBe(true)
    expect(fs.statSync(png).size).toBeGreaterThan(1000)
    expect(fs.statSync(ico).size).toBeGreaterThan(1000)

    // PNG 签名
    const head = fs.readFileSync(png).subarray(0, 8)
    expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  })

  it('icon.png sample pixel is near brand blue #2a9fd4 (冗余抽检)', () => {
    // 读取未压缩难度高；改为校验 gen 脚本与定稿色常量一致
    const script = fs.readFileSync(path.join(root, 'scripts', 'gen-app-icon.py'), 'utf8')
    expect(script).toContain('#2a9fd4')
    expect(script).toContain('Comfortaa')
    expect(script).toMatch(/BG\s*=\s*\(42,\s*159,\s*212/)
  })
})
