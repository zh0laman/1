import { useEffect, useRef, useState } from 'react'
import MaterialSymbol from './MaterialSymbol'

interface AppTimePickerProps {
  value: string // "HH:mm"
  onChange: (value: string) => void
  label?: string
  error?: boolean
  disabled?: boolean
  className?: string
  /** Merged into the trigger button (after default chrome classes). */
  buttonClassName?: string
}

const HOURS = Array.from({ length: 24 }).map((_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }).map((_, i) => String(i).padStart(2, '0'))

export default function AppTimePicker({
  value,
  onChange,
  label,
  error,
  disabled,
  className = '',
  buttonClassName = '',
}: AppTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hourScrollRef = useRef<HTMLDivElement>(null)
  const minuteScrollRef = useRef<HTMLDivElement>(null)
  
  const [hour, minute] = (value || '09:00').split(':')

  useEffect(() => {
    if (isOpen) {
      // Auto-scroll to selected values
      const scrollToValue = (ref: React.RefObject<HTMLDivElement | null>, val: string) => {
        if (!ref.current) return
        const activeItem = ref.current.querySelector(`[data-value="${val}"]`) as HTMLElement
        if (activeItem) {
          ref.current.scrollTo({
            top: activeItem.offsetTop - ref.current.offsetHeight / 2 + activeItem.offsetHeight / 2,
            behavior: 'auto',
          })
        }
      }
      setTimeout(() => {
        scrollToValue(hourScrollRef, hour)
        scrollToValue(minuteScrollRef, minute)
      }, 0)
    }
  }, [isOpen, hour, minute])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectHour = (h: string) => {
    onChange(`${h}:${minute || '00'}`)
  }

  const handleSelectMinute = (m: string) => {
    onChange(`${hour || '09'}:${m}`)
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="mb-1.5 ml-1 block text-[13px] font-semibold text-[#4A6282]">{label}</label>}
      
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-11 w-full items-center justify-between rounded-xl border bg-white px-3 text-sm transition-all focus:border-[#1A73E8] focus:ring-2 focus:ring-[#D9E8FF] ${
          error ? 'border-[#E53935] bg-[#FFEBEE]' : 'border-[#D7E2F3]'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-[#C5D2E5]'} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2">
          <MaterialSymbol name="schedule" size={18} color={error ? '#E53935' : '#6F86A8'} />
          <span className={`font-medium ${value ? 'text-[#1E293B]' : 'text-[#94A3B8]'}`}>
            {value || '--:--'}
          </span>
        </div>
        <MaterialSymbol name="expand_more" size={18} color="#94A3B8" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[500] flex w-40 overflow-hidden rounded-2xl border border-[#DDE3EE] bg-white shadow-[0_12px_40px_rgba(10,22,40,0.18)] transition-all duration-200">
          {/* Hours column */}
          <div 
            ref={hourScrollRef}
            className="flex-1 overflow-y-auto max-h-64 custom-scrollbar border-r border-[#F0F4F8] scroll-smooth scrollbar-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="py-2">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  data-value={h}
                  onClick={() => handleSelectHour(h)}
                  className={`flex w-full items-center justify-center px-3 py-1.5 text-sm transition-all ${
                    hour === h ? 'bg-[#1A73E8] font-bold text-white shadow-sm scale-110 z-10' : 'text-[#2D4263] hover:bg-[#F3F7FF] active:bg-[#E8F1FF]'
                  }`}
                >
                  {h}
                </button>
              ))}
              <div className="h-4" /> {/* Bottom spacer to prevent clumping */}
            </div>
          </div>
          
          {/* Minutes column */}
          <div 
            ref={minuteScrollRef}
            className="flex-1 overflow-y-auto max-h-64 custom-scrollbar scroll-smooth scrollbar-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="py-2">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-value={m}
                  onClick={() => handleSelectMinute(m)}
                  className={`flex w-full items-center justify-center px-3 py-1.5 text-sm transition-all ${
                    minute === m ? 'bg-[#1A73E8] font-bold text-white shadow-sm scale-110 z-10' : 'text-[#2D4263] hover:bg-[#F3F7FF] active:bg-[#E8F1FF]'
                  }`}
                >
                  {m}
                </button>
              ))}
              <div className="h-4" /> {/* Bottom spacer to prevent clumping */}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
