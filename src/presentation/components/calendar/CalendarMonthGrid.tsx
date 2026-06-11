import type { CalendarEventViewModel } from '../../view-models/CalendarViewModel'

interface CalendarMonthGridProps {
  cells: Array<{
    dateKey: string
    dayNumber: number
    inCurrentMonth: boolean
    isToday: boolean
    isSelected: boolean
    events: CalendarEventViewModel[]
  }>
  onSelectDay: (dayKey: string) => void
  onOpenDay: (dayKey: string) => void
  onSelectEvent: (event: CalendarEventViewModel, x: number, y: number) => void
}

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const formatEventTime = (event: CalendarEventViewModel) => {
  if (event.isAllDay) return 'Весь день'
  const [start] = event.timeLabel.split('-')
  return start.trim()
}

const getEventSurface = (color?: string) => {
  const accent = color || '#2E6BFF'
  return {
    borderColor: `${accent}26`,
    backgroundColor: `${accent}12`,
    color: accent,
  }
}

export default function CalendarMonthGrid({
  cells,
  onSelectDay,
  onOpenDay,
  onSelectEvent,
}: CalendarMonthGridProps) {
  const weeksCount = Math.max(1, Math.ceil(cells.length / 7))
  const maxRowsPerCell = 3

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-[#E7ECF4] bg-white">
      <div className="grid shrink-0 grid-cols-7 border-b border-[#EAEFF6] bg-[#FCFDFF]">
        {weekDays.map((day) => (
          <div
            key={day}
            className="border-r border-[#EEF2F7] px-3 py-2 text-center text-[11px] font-medium text-[#7B8798] last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${weeksCount}, minmax(0, 1fr))` }}>
        {cells.map((cell) => {
          const hiddenEventsCount = Math.max(0, cell.events.length - maxRowsPerCell)
          const visibleEvents = hiddenEventsCount > 0
            ? cell.events.slice(0, maxRowsPerCell - 1)
            : cell.events.slice(0, maxRowsPerCell)

          return (
            <button
              key={cell.dateKey}
              type="button"
              aria-label={`Выбрать дату ${cell.dateKey}`}
              onClick={() => onSelectDay(cell.dateKey)}
              className={[
                'group min-h-[128px] overflow-hidden border-r border-t border-[#EEF2F7] px-2 py-1.5 text-left align-top transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FC5F5] last:border-r-0',
                cell.isSelected ? 'bg-[#F7FAFF]' : 'bg-white hover:bg-[#FBFDFF]',
                cell.inCurrentMonth ? '' : 'bg-[#FBFCFE] text-[#A8B2C2]',
              ].join(' ')}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={[
                    'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-semibold leading-none',
                    cell.isToday ? 'bg-[#111111] text-white shadow-[0_8px_18px_rgba(15,23,42,0.22)]' : 'text-[#1B2B42]',
                    !cell.inCurrentMonth && !cell.isToday ? 'text-[#A8B2C2]' : '',
                  ].join(' ')}
                >
                  {cell.dayNumber}
                </span>
              </div>

              <div className="space-y-1 overflow-hidden">
                {visibleEvents.map((event) => {
                  const surface = getEventSurface(event.color)

                  return (
                    <div
                      key={event.id}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation()
                        onSelectEvent(event, clickEvent.clientX, clickEvent.clientY)
                      }}
                      className="flex min-h-[24px] items-center gap-1 overflow-hidden rounded-[7px] border px-1.5 py-0.5 text-[9px] leading-none transition hover:brightness-[0.98] md:text-[10px]"
                      style={surface}
                      title={`${event.title} · ${event.timeLabel}`}
                    >
                      <span
                        className="h-4 w-[3px] shrink-0 rounded-full"
                        style={{ backgroundColor: event.color || '#2E6BFF' }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate font-semibold">{event.title}</span>
                      <span className="shrink-0 text-[8px] font-medium opacity-80 md:text-[9px]">
                        {formatEventTime(event)}
                      </span>
                    </div>
                  )
                })}

                {hiddenEventsCount > 0 ? (
                  <button
                    type="button"
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation()
                      onOpenDay(cell.dateKey)
                    }}
                    className="pl-1 text-[9px] font-medium text-[#5F7FB1] underline decoration-transparent underline-offset-2 transition hover:decoration-current md:text-[10px]"
                    title={`Открыть ${cell.dateKey} и посмотреть ещё ${hiddenEventsCount} события`}
                  >
                    +ещё {hiddenEventsCount}
                  </button>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
