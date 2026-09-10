/**
 * 全局快捷键可行性探测（独立于 Q-Music 业务）
 *
 * 用法（在项目根）：
 *   npx electron ./scripts/probe-global-hotkey.mjs
 *
 * 可选环境变量：
 *   QMUSIC_PROBE_SECONDS=25
 *   QMUSIC_PROBE_ACCEL=CommandOrControl+Alt+Shift+F9
 *   QMUSIC_PROBE_SECOND=1   # 再起第二进程抢键，验证多开冲突
 */
import { app, globalShortcut, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ACCEL = process.env.QMUSIC_PROBE_ACCEL || 'CommandOrControl+Alt+Shift+F9'
const SECONDS = Math.max(5, Number(process.env.QMUSIC_PROBE_SECONDS || 20) || 20)
const RUN_SECOND = process.env.QMUSIC_PROBE_SECOND === '1'
const role = process.env.QMUSIC_PROBE_ROLE || 'primary'

function stamp(...args) {
  console.log(`[probe ${role} ${new Date().toISOString()}]`, ...args)
}

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 440,
    height: 240,
    title: `hotkey-probe-${role}`,
    show: true,
  })
  const label = ACCEL.replace(/CommandOrControl/gi, 'Ctrl')
  void win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <body style="font-family:Segoe UI,sans-serif;padding:16px;background:#1a1f2a;color:#e8eef8">
        <h3>Global hotkey probe (${role})</h3>
        <p>请切到<strong>别的软件</strong>再按：<b>${label}</b></p>
        <p id="log">waiting…</p>
      </body>
    `)}`,
  )

  let hits = 0
  const ok = globalShortcut.register(ACCEL, () => {
    hits += 1
    stamp('HIT', ACCEL, 'count=', hits)
    void win.webContents
      .executeJavaScript(
        `document.getElementById('log').textContent = 'HIT x${hits} @ ' + new Date().toLocaleTimeString()`,
      )
      .catch(() => undefined)
  })

  stamp('register', ACCEL, '→', ok ? 'OK' : 'FAILED')
  stamp('isRegistered', globalShortcut.isRegistered(ACCEL))

  if (!ok) {
    stamp('CONCLUSION: REGISTER_FAILED — accelerator rejected (conflict / OS / Electron)')
    setTimeout(() => app.quit(), 2500)
    return
  }

  if (role === 'primary' && RUN_SECOND) {
    stamp('will spawn secondary in 4s to steal hotkey…')
    setTimeout(() => {
      const child = spawn(process.execPath, [__filename], {
        env: {
          ...process.env,
          QMUSIC_PROBE_ROLE: 'secondary',
          QMUSIC_PROBE_SECOND: '0',
          ELECTRON_RUN_AS_NODE: '',
        },
        stdio: 'inherit',
      })
      child.on('exit', (code) => stamp('secondary exited', code))
    }, 4000)
  }

  if (role === 'secondary') {
    setTimeout(() => {
      stamp('secondary: unregisterAll + re-register (simulate multi-instance)')
      globalShortcut.unregisterAll()
      const ok2 = globalShortcut.register(ACCEL, () => stamp('SECONDARY HIT'))
      stamp('secondary register →', ok2 ? 'OK' : 'FAILED')
    }, 800)
  }

  stamp(`listening ${SECONDS}s — focus another app and press hotkey`)
  setTimeout(() => {
    const verdict =
      hits > 0 ? 'GLOBAL_OK' : 'NO_HIT — register succeeded but callback never fired'
    stamp('SUMMARY hits=', hits, verdict)
    try {
      globalShortcut.unregisterAll()
    } catch {
      // ignore
    }
    app.quit()
  }, SECONDS * 1000)
})

app.on('window-all-closed', (e) => {
  e.preventDefault()
})
