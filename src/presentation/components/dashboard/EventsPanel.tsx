import CardShell from '../../../shared/ui/CardShell'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import { Avatar } from './primitives'

interface EventItem {
  id: string
  title: string
  time: string
  end: string
  tag: string
  color: string
  attendees: string[]
}

interface EventsPanelProps {
  events?: EventItem[]
  onOpenAll?: () => void
}

const avatarSeed: Record<string, number> = { АС: 0, МБ: 1, ДН: 2, АИ: 3 }

export default function EventsPanel({ events = [], onOpenAll }: EventsPanelProps) {
  const today = new Date()
  const month = today.toLocaleDateString('ru-RU', { month: 'short' })

  return (
    <CardShell className="overflow-hidden border-0 bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-extrabold tracking-tight text-[#0A1628]">Ближайшие события</h3>
        <button
          type="button"
          onClick={onOpenAll}
          className="text-[13px] font-bold text-blue-600 transition-colors hover:text-blue-700"
        >
          Все
        </button>
      </div>

      <div className="space-y-3">
        {events.map((event, index) => (
          <article key={event.id} className="group relative overflow-hidden rounded-xl border-0 bg-white p-4 shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex gap-3">
              <div className="w-10 shrink-0 text-center">
                <p className="text-lg font-extrabold leading-none text-[#1E88E5]">{today.getDate() + index}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[#94A3B8]">{month}</p>
              </div>

              <span className="w-0.5 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0A1628]">{event.title}</p>

                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#64748B]">
                    <MaterialSymbol name="schedule" size={12} color="#94A3B8" />
                    {event.time} - {event.end}
                  </span>
                  <span className="rounded-md bg-[#EBF4FE] px-2 py-0.5 text-[10px] font-semibold text-[#1E88E5]">{event.tag}</span>
                </div>
              </div>

              <div className="flex self-start">
                {event.attendees.slice(0, 3).map((attendee, attendeeIndex) => (
                  <div key={`${event.id}-${attendee}-${attendeeIndex}`} className={attendeeIndex > 0 ? '-ml-2' : ''}>
                    <Avatar initials={attendee} size={22} seed={avatarSeed[attendee] ?? attendeeIndex} />
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}

        {events.length === 0 ? (
          <div className="rounded-xl border-0 bg-slate-50 px-4 py-8 text-center text-[13px] font-medium text-slate-500 shadow-inner ring-1 ring-black/5">
            Событий на ближайшее время нет
          </div>
        ) : null}
      </div>
    </CardShell>
  )
}
