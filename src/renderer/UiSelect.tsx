import { useEffect, useId, useRef, useState } from 'react'

export type UiSelectOption = { value: string; label: string }

type Props = {
  value: string
  options: UiSelectOption[]
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
  'aria-label'?: string
}

/** 自定义下拉：弹出层跟随主题（渐变/纯色/图片半透明），非系统原生 option 框 */
export default function UiSelect({
  value,
  options,
  onChange,
  className,
  disabled,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()
  const current = options.find((o) => o.value === value) || options[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      className={`ui-select-wrap ${open ? 'open' : ''} ${className || ''}`.trim()}
      ref={rootRef}
    >
      <button
        type="button"
        className="ui-select-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className="ui-select-label">{current?.label ?? ''}</span>
        <span className="ui-select-caret" aria-hidden />
      </button>
      {open && (
        <ul className="ui-select-menu" id={listId} role="listbox">
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={`ui-select-option ${o.value === value ? 'on' : ''}`}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
