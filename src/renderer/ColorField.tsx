/** 调色盘：色相条 + 饱和/明度面板；点盘面不关，点外部才收起（portal 避免被 label/overflow 坑） */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  value: string
  onChange: (hex: string) => void
  title?: string
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r: number, g: number, b: number) {
  const h = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  const s = max === 0 ? 0 : d / max
  return { h: h * 360, s: s * 100, v: max * 100 }
}

function hsvToRgb(h: number, s: number, v: number) {
  h = ((h % 360) + 360) % 360
  s = clamp(s, 0, 100) / 100
  v = clamp(v, 0, 100) / 100
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (h < 60) [rp, gp, bp] = [c, x, 0]
  else if (h < 120) [rp, gp, bp] = [x, c, 0]
  else if (h < 180) [rp, gp, bp] = [0, c, x]
  else if (h < 240) [rp, gp, bp] = [0, x, c]
  else if (h < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  }
}

function toSolidHex(value: string): string {
  const rgb = hexToRgb(value)
  if (rgb) return rgbToHex(rgb.r, rgb.g, rgb.b)
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value)
  if (m) return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]))
  return '#ffffff'
}

function hsvFromHex(hex: string) {
  const rgb = hexToRgb(hex) || { r: 255, g: 255, b: 255 }
  return rgbToHsv(rgb.r, rgb.g, rgb.b)
}

export default function ColorField({ value, onChange, title }: Props) {
  const [open, setOpen] = useState(false)
  const [draftHex, setDraftHex] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const dragKind = useRef<'sv' | 'hue' | null>(null)
  const hsvRef = useRef({ h: 0, s: 0, v: 100 })

  const hex = useMemo(() => toSolidHex(value), [value])
  const [hsv, setHsv] = useState(() => hsvFromHex(hex))
  hsvRef.current = hsv

  const placePop = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const popW = 228
    const popH = 230
    let left = r.left
    let top = r.bottom + 6
    if (left + popW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popW - 8)
    if (top + popH > window.innerHeight - 8) top = Math.max(8, r.top - popH - 6)
    setPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    placePop()
    const onWin = () => placePop()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [open, placePop])

  useEffect(() => {
    if (!open) return
    setHsv(hsvFromHex(hex))
    setDraftHex(hex)
  }, [open, hex])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    // 用 pointerdown + 捕获阶段；延后一帧注册，避免「打开」那次点击立刻关掉
    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', onDoc, true)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('pointerdown', onDoc, true)
    }
  }, [open])

  const emit = useCallback(
    (next: { h: number; s: number; v: number }) => {
      hsvRef.current = next
      setHsv(next)
      const { r, g, b } = hsvToRgb(next.h, next.s, next.v)
      const out = rgbToHex(r, g, b)
      setDraftHex(out)
      onChange(out)
    },
    [onChange],
  )

  const pickSv = useCallback(
    (clientX: number, clientY: number) => {
      const el = svRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)
      const v = clamp((1 - (clientY - rect.top) / rect.height) * 100, 0, 100)
      emit({ h: hsvRef.current.h, s, v })
    },
    [emit],
  )

  const pickHue = useCallback(
    (clientX: number) => {
      const el = hueRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 359.999)
      emit({ h, s: hsvRef.current.s, v: hsvRef.current.v })
    },
    [emit],
  )

  useEffect(() => {
    if (!open) return
    const onMove = (e: PointerEvent) => {
      if (dragKind.current === 'sv') pickSv(e.clientX, e.clientY)
      else if (dragKind.current === 'hue') pickHue(e.clientX)
    }
    const onUp = () => {
      dragKind.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [open, pickSv, pickHue])

  const pureHue = useMemo(() => {
    const { r, g, b } = hsvToRgb(hsv.h, 100, 100)
    return rgbToHex(r, g, b)
  }, [hsv.h])

  const pop = open
    ? createPortal(
        <div
          ref={popRef}
          className="color-pop"
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            ref={svRef}
            className="color-sv"
            style={{ backgroundColor: pureHue }}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              dragKind.current = 'sv'
              pickSv(e.clientX, e.clientY)
            }}
          >
            <div className="color-sv-white" />
            <div className="color-sv-black" />
            <span
              className="color-sv-thumb"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                background: hex,
              }}
            />
          </div>

          <div
            ref={hueRef}
            className="color-hue"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              dragKind.current = 'hue'
              pickHue(e.clientX)
            }}
          >
            <span className="color-hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%` }} />
          </div>

          <div className="color-pop-foot">
            <div className="color-pop-preview" style={{ background: hex }} />
            <label className="color-pop-row">
              <span>HEX</span>
              <input
                className="color-hex"
                value={draftHex}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  setDraftHex(v)
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                    const next = v.toLowerCase()
                    onChange(next)
                    setHsv(hsvFromHex(next))
                  }
                }}
              />
            </label>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className="color-field" ref={rootRef} title={title}>
      <button
        ref={btnRef}
        type="button"
        className="color-swatch-btn"
        aria-label={title || '选择颜色'}
        aria-expanded={open}
        style={{ background: hex }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {pop}
    </div>
  )
}
