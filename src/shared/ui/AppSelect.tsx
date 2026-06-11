import { useEffect, useMemo, useRef, useState } from 'react'
import MaterialSymbol from './MaterialSymbol'

export interface AppSelectOption {
  label: string
  value: string
  disabled?: boolean
  description?: string
  image?: string
  avatarBg?: string
  avatarColor?: string
}

interface AppSelectProps {
  value: string
  options: AppSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
  menuClassName?: string
  ariaLabel?: string
  searchable?: boolean
  searchPlaceholder?: string
  onSearchChange?: (value: string) => void
  multiple?: boolean
  selectedValues?: string[]
  onSelectedValuesChange?: (values: string[]) => void
  closeOnSelect?: boolean
  selectedSummaryText?: (options: AppSelectOption[]) => string
  showButtonAvatar?: boolean
  showOptionAvatar?: boolean
}

function OptionAvatar({
  name,
  image,
  avatarBg,
  avatarColor,
}: {
  name: string
  image?: string
  avatarBg?: string
  avatarColor?: string
}) {
  if (image) {
    return <img src={image} alt={name} className="h-6 w-6 rounded-full object-cover" />
  }

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (!initials) return null

  if (avatarBg || avatarColor) {
    return (
      <div
        style={{ backgroundColor: avatarBg, color: avatarColor }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      >
        {initials}
      </div>
    )
  }

  // Automatic heuristics based on standard project status names
  let bgStyle = 'bg-[#EBF4FE]'
  let textStyle = 'text-[#1E88E5]'

  const upperName = name.toUpperCase()
  if (upperName.includes('ГОТОВО') || upperName === 'Г' || upperName === 'DONE') {
    bgStyle = 'bg-[#E2FBE9]'
    textStyle = 'text-[#0E9F6E]'
  } else if (upperName.includes('НА ПРОВЕРКЕ') || upperName === 'НП' || upperName === 'TEST') {
    bgStyle = 'bg-[#FEF3C7]'
    textStyle = 'text-[#D97706]'
  } else if (upperName.includes('К ВЫПОЛНЕНИЮ') || upperName === 'КВ' || upperName === 'TODO') {
    bgStyle = 'bg-[#F1F3F5]'
    textStyle = 'text-[#495057]'
  }

  return (
    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${bgStyle} ${textStyle}`}>
      {initials}
    </div>
  )
}

export default function AppSelect({
  value,
  options,
  onChange,
  placeholder = 'Выберите значение',
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  ariaLabel,
  searchable = false,
  searchPlaceholder = 'Поиск...',
  onSearchChange,
  multiple = false,
  selectedValues,
  onSelectedValuesChange,
  closeOnSelect,
  selectedSummaryText,
  showButtonAvatar = true,
  showOptionAvatar = true,
}: AppSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const isMultiple = multiple && Array.isArray(selectedValues) && typeof onSelectedValuesChange === 'function'

  const selected = useMemo(() => options.find((option) => option.value === value), [options, value])
  const selectedSet = useMemo(() => new Set(selectedValues ?? []), [selectedValues])
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(option.value)),
    [options, selectedSet],
  )
  const shouldCloseOnSelect = closeOnSelect ?? !isMultiple

  const filteredOptions = useMemo(() => {
    if (!searchable) return options
    const query = search.trim().toLowerCase()
    if (!query) return options

    return options.filter((option) => {
      const label = option.label.toLowerCase()
      const optionValue = option.value.toLowerCase()
      return label.includes(query) || optionValue.includes(query)
    })
  }, [options, search, searchable])

  const closeMenu = () => {
    setOpen(false)
    setSearch('')
    onSearchChange?.('')
  }

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) {
        closeMenu()
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (!next) {
              setSearch('')
              onSearchChange?.('')
            }
            return next
          })
        }}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[#DDE3EE] bg-[#F9FBFE] px-3 text-left text-sm text-[#0A1628] outline-none transition-all hover:border-[#C5D2E5] focus:ring-2 focus:ring-[#1E88E5]/10 disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName} ${
          open ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/10' : ''
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {!isMultiple && selected && value && showButtonAvatar && (
            <OptionAvatar
              name={selected.label}
              image={selected.image}
              avatarBg={selected.avatarBg}
              avatarColor={selected.avatarColor}
            />
          )}
          <span
            className={`truncate ${
              isMultiple
                ? selectedOptions.length ? 'text-[#0A1628]' : 'text-[#8497B4]'
                : selected ? 'text-[#0A1628]' : 'text-[#8497B4]'
            }`}
          >
            {isMultiple
              ? selectedOptions.length
                ? selectedSummaryText
                  ? selectedSummaryText(selectedOptions)
                  : `Выбрано: ${selectedOptions.length}`
                : placeholder
              : selected?.label || placeholder}
          </span>
        </div>
        <MaterialSymbol
          name="expand_more"
          size={18}
          color="#64748B"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 160ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </button>

      {open && !disabled ? (
        <div
          role="listbox"
          aria-multiselectable={isMultiple || undefined}
          className={`absolute left-0 top-[calc(100%+8px)] z-[1200] max-h-64 w-full flex flex-col overflow-hidden rounded-2xl border border-[#DDE3EE] bg-white shadow-[0_12px_40px_rgba(10,22,40,0.2)] animate-in fade-in zoom-in-95 duration-150 ${menuClassName}`}
        >
          {searchable ? (
            <div className="border-b border-[#F1F4F9] p-2">
              <div className="flex h-9 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 focus-within:border-[#1E88E5] focus-within:ring-2 focus-within:ring-[#1E88E5]/10 transition-all">
                <MaterialSymbol name="search" size={16} color="#64748B" />
                <input
                  autoFocus
                  value={search}
                  onChange={(event) => { const nextValue = event.target.value; setSearch(nextValue); onSearchChange?.(nextValue) }}
                  placeholder={searchPlaceholder}
                  className="h-full w-full border-none bg-transparent text-xs text-[#0A1628] outline-none placeholder:text-[#94A3B8]"
                />
              </div>
            </div>
          ) : null}

          <div className="flex-1 overflow-auto p-1.5 custom-scrollbar">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isActive = isMultiple ? selectedSet.has(option.value) : option.value === value
                const isSpecial = option.value === '' // placeholder option
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    disabled={option.disabled}
                    onClick={() => {
                      if (option.disabled) return
                      if (isMultiple) {
                        const nextValues = isActive
                          ? (selectedValues ?? []).filter((selectedValue) => selectedValue !== option.value)
                          : [...(selectedValues ?? []), option.value]
                        onSelectedValuesChange(nextValues)
                        if (shouldCloseOnSelect) {
                          closeMenu()
                        }
                        return
                      }
                      onChange(option.value)
                      if (shouldCloseOnSelect) {
                        closeMenu()
                      }
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      isActive ? 'bg-[#F0F7FF] text-[#1E88E5]' : 'text-[#334155] hover:bg-[#F8FAFC]'
                    } ${option.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {showOptionAvatar && !isSpecial && (
                      <OptionAvatar
                        name={option.label}
                        image={option.image}
                        avatarBg={option.avatarBg}
                        avatarColor={option.avatarColor}
                      />
                    )}
                    <div className="min-w-0 flex-1 py-0.5">
                      <p 
                        className={`text-sm leading-tight break-words line-clamp-2 ${isActive ? 'font-bold' : 'font-medium'}`}
                        title={option.label}
                      >
                        {option.label}
                      </p>
                      {option.description && (
                        <p className={`truncate text-[10px] ${isActive ? 'text-[#1E88E5]/70' : 'text-[#64748B]'}`}>
                          {option.description}
                        </p>
                      )}
                    </div>
                    {isMultiple ? (
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                          isActive ? 'border-[#1E88E5] bg-[#1E88E5]' : 'border-[#CBD5E1] bg-white'
                        }`}
                      >
                        {isActive ? <MaterialSymbol name="check" size={12} color="#fff" /> : null}
                      </div>
                    ) : isActive ? <MaterialSymbol name="check" size={16} color="#1E88E5" /> : null}
                  </button>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-[#F8FAFC] rounded-xl m-1">
                 <MaterialSymbol name="search_off" size={20} color="#94A3B8" />
                 <p className="mt-2 text-xs font-medium text-[#64748B]">Ничего не найдено</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

