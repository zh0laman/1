import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'

export interface CustomSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface CustomSelectProps {
  value: string
  options: CustomSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
  searchable?: boolean
  searchPlaceholder?: string
}

const filterOptions = (rows: CustomSelectOption[], rawQuery: string): CustomSelectOption[] => {
  const query = rawQuery.trim().toLowerCase()
  if (!query) {
    return rows
  }

  return rows.filter((item) => {
    const label = item.label.toLowerCase()
    const optionValue = item.value.toLowerCase()
    return label.includes(query) || optionValue.includes(query)
  })
}

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Выберите вариант',
  disabled = false,
  className = '',
  buttonClassName = '',
  searchable = true,
  searchPlaceholder = 'Поиск...',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searchQuery, setSearchQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const selectedOption = useMemo(() => options.find((item) => item.value === value), [options, value])

  const filteredOptions = useMemo(() => {
    if (!searchable) {
      return options
    }
    return filterOptions(options, searchQuery)
  }, [options, searchQuery, searchable])

  const getDefaultActiveIndex = (rows: CustomSelectOption[]) => {
    const selectedIndex = rows.findIndex((item) => item.value === value && !item.disabled)
    if (selectedIndex >= 0) {
      return selectedIndex
    }
    return rows.findIndex((item) => !item.disabled)
  }

  useEffect(() => {
    if (!open) {
      return
    }

    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setSearchQuery('')
        setActiveIndex(-1)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setSearchQuery('')
        setActiveIndex(-1)
      }
    }

    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('touchstart', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('touchstart', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useEffect(() => {
    if (!open || activeIndex < 0) {
      return
    }
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const moveActive = (step: number) => {
    if (!filteredOptions.length) {
      return
    }

    let cursor = activeIndex < 0 ? 0 : activeIndex
    let loops = 0
    while (loops < filteredOptions.length) {
      cursor = (cursor + step + filteredOptions.length) % filteredOptions.length
      if (!filteredOptions[cursor]?.disabled) {
        setActiveIndex(cursor)
        break
      }
      loops += 1
    }
  }

  const closeDropdown = () => {
    setOpen(false)
    setSearchQuery('')
    setActiveIndex(-1)
  }

  const openDropdown = () => {
    setOpen(true)
    setSearchQuery('')
    setActiveIndex(getDefaultActiveIndex(options))
  }

  const selectActive = () => {
    if (activeIndex < 0 || !filteredOptions[activeIndex] || filteredOptions[activeIndex].disabled) {
      return
    }
    onChange(filteredOptions[activeIndex].value)
    closeDropdown()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }

    if (event.target instanceof HTMLInputElement) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDropdown()
      }
      return
    }

    if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
      event.preventDefault()
      openDropdown()
      return
    }

    if (!open) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectActive()
      return
    }

    if (event.key === 'Tab') {
      closeDropdown()
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return
          }

          if (open) {
            closeDropdown()
            return
          }

          openDropdown()
        }}
        className={`ui-select w-full flex items-center justify-between gap-2 px-2.5 py-2 text-[12px] text-[#22345E] ${buttonClassName} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate text-left">{selectedOption?.label ?? placeholder}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`w-4 h-4 text-[#6E7B98] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[70] rounded-xl border border-[#D7E0F0] bg-white shadow-[0_12px_28px_rgba(20,46,105,0.16)] max-h-56 overflow-y-auto">
          {searchable && (
            <div className="px-2.5 pt-2.5 pb-1.5 border-b border-[#EEF3FB]">
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  const query = event.target.value
                  setSearchQuery(query)
                  const rows = filterOptions(options, query)
                  setActiveIndex(getDefaultActiveIndex(rows))
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-[#D7E0F0] px-2.5 py-1.5 text-[12px] text-[#22345E] placeholder:text-[#8FA0BE] outline-none focus:border-[#AFC7EF]"
              />
            </div>
          )}

          <ul role="listbox" className="py-1">
            {filteredOptions.map((option, index) => {
              const isSelected = option.value === value
              const isActive = index === activeIndex
              const isDisabled = !!option.disabled

              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  <button
                    ref={(el) => {
                      optionRefs.current[index] = el
                    }}
                    type="button"
                    disabled={isDisabled}
                    onMouseEnter={() => !isDisabled && setActiveIndex(index)}
                    onClick={() => {
                      if (isDisabled) {
                        return
                      }
                      onChange(option.value)
                      closeDropdown()
                    }}
                    className={`w-full px-3 py-2.5 text-left text-[12px] flex items-center justify-between gap-2 ${
                      isDisabled
                        ? 'text-[#A2AEC7] cursor-not-allowed'
                        : isSelected
                          ? 'text-[#103A9A] bg-[#EAF1FF]'
                          : isActive
                            ? 'text-[#22345E] bg-[#F4F8FF]'
                            : 'text-[#22345E] hover:bg-[#F8FBFF]'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? <span className="text-[#1463D3]">✓</span> : null}
                  </button>
                </li>
              )
            })}

            {filteredOptions.length === 0 && (
              <li className="px-3 py-2.5 text-[12px] text-[#8FA0BE]">Ничего не найдено</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
