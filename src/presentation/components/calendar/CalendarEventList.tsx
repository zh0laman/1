import CardShell from '../../../shared/ui/CardShell'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type { CalendarEventViewModel } from '../../view-models/CalendarViewModel'

interface CalendarEventListProps {
  title: string
  events: CalendarEventViewModel[]
}

export default function CalendarEventList({ title, events }: CalendarEventListProps) {
  return (
    <CardShell className="p-4">
      <h2 className="mb-3 text-base font-bold text-[#0A1628]">{title}</h2>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#DDE3EE] bg-[#F9FBFF] px-3 py-8 text-center text-sm text-[#7C8CA6]">
          События не найдены
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <article key={event.id} className="rounded-xl border border-[#EAEFF8] bg-white p-3 transition hover:border-[#D4E2F5]">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-[#0A1628]">{event.title}</h3>
                <span
                  className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: event.color || '#1E88E5' }}
                />
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#F3F6FB] px-2 py-1 font-semibold text-[#4B5D79]">
                  <MaterialSymbol name="calendar_today" size={12} color="#8497B4" />
                  {event.timeLabel}
                </span>
                <span
                  className={[
                    'inline-flex rounded-md px-2 py-1 text-[11px] font-semibold',
                    event.isOnline ? 'bg-[#E8FAF3] text-[#0A8F5C]' : 'bg-[#F3F4F6] text-[#6B7280]',
                  ].join(' ')}
                >
                  {event.isOnline ? 'Онлайн' : 'Оффлайн'}
                </span>
                {event.attendeesCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                    <MaterialSymbol name="group" size={12} color="#8497B4" />
                    {event.attendeesCount}
                  </span>
                ) : null}
              </div>

              {event.location ? (
                <p className="text-xs text-[#5C6E8A]">{event.location}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </CardShell>
  )
}
