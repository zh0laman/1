import { useEffect, useRef, useState } from 'react'
import MaterialSymbol from './MaterialSymbol'

type CustomSelectProps = {
  label: string
  value: string
  options: readonly string[]
  disabled?: boolean
  /** Подпись для «пустого» значения */
  emptyLabel?: string
  onChange: (next: string) => void
}

/**
 * Выпадающий список без нативного &lt;select&gt;: ограниченная высота списка и скролл внутри.
 */
export default function CustomSelect({
  label,
  value,
  options,
  disabled,
  emptyLabel = 'Все',
  onChange,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const showText = value || emptyLabel
  const buttonDisplay = value
    ? value.length > 40
      ? `${value.slice(0, 38)}…`
      : value
    : emptyLabel

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-col gap-1">
      <span className="text-[12px] font-semibold text-[#8497B4]">{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) setOpen((o) => !o)
        }}
        className="flex h-[38px] w-full items-center justify-between gap-2 rounded-xl border border-[#E8EDF5] bg-[#FAFBFD] py-0 pl-2.5 pr-2 text-left text-[13px] text-[#0A1628] outline-none transition hover:border-[#C5D8EE] focus-visible:border-[#B9D4F5] focus-visible:ring-2 focus-visible:ring-[#1E88E5]/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 truncate" title={showText}>
          {buttonDisplay}
        </span>
        <MaterialSymbol
          name="expand_more"
          size={20}
          color="#6B7F99"
          className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain rounded-xl border border-[#E8EDF5] bg-white py-1 shadow-[0_12px_40px_rgba(10,22,40,0.14)]"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-[#EFF6FF] ${
                !value ? 'bg-[#EFF6FF] font-semibold text-[#0F4EA3]' : 'text-[#374C6B]'
              }`}
            >
              {!value ? (
                <MaterialSymbol name="check" size={16} color="#1E88E5" />
              ) : (
                <span className="inline-block w-4 shrink-0" aria-hidden />
              )}
              {emptyLabel}
            </button>
          </li>
          {options.map((opt) => {
            const selected = value === opt
            return (
              <li key={opt} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={opt}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] leading-snug transition hover:bg-[#EFF6FF] ${
                    selected ? 'bg-[#EFF6FF] font-semibold text-[#0F4EA3]' : 'text-[#374C6B]'
                  }`}
                >
                  {selected ? (
                    <MaterialSymbol name="check" size={16} color="#1E88E5" className="mt-0.5 shrink-0" />
                  ) : (
                    <span className="inline-block w-4 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 break-words">{opt}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
