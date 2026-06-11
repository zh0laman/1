import type { CalendarMode } from '../../view-models/CalendarViewModel'

interface CalendarModeSwitchProps {
  mode: CalendarMode
  onChange: (mode: CalendarMode) => void
}

const items: Array<{ key: CalendarMode; label: string }> = [
  { key: 'day', label: 'День' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

export default function CalendarModeSwitch({ mode, onChange }: CalendarModeSwitchProps) {
  return (
    <div className="inline-flex rounded-full border border-[#D5DFEE] bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      {items.map((item) => {
        const active = item.key === mode

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A9CBF5]',
              active ? 'bg-[#DDEBFF] text-[#1458A8]' : 'text-[#506481] hover:bg-[#F4F7FC]',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
