import CardShell from '../../../shared/ui/CardShell'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'

interface DashboardNotification {
  id: string
  icon: string
  title: string
  sub: string
  read: boolean
  color: string
}

interface NotificationsPanelProps {
  notifications: DashboardNotification[]
}

export default function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  const unreadCount = notifications.filter((item) => !item.read).length

  return (
    <CardShell className="overflow-hidden border-0 bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-extrabold tracking-tight text-[#0A1628]">Уведомления</h3>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600 ring-1 ring-blue-500/20">{unreadCount} новых</span>
      </div>

      <div className="space-y-2.5">
        {notifications.slice(0, 5).map((item) => (
          <article
            key={item.id}
            className={[
              'group flex items-start gap-3.5 rounded-xl border-0 bg-white p-3 shadow-sm ring-1 ring-black/5 transition-all hover:bg-slate-50 hover:shadow-md cursor-pointer',
              !item.read ? 'bg-blue-50/50 ring-blue-100/50 hover:bg-blue-50' : '',
            ].join(' ')}
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
              <MaterialSymbol name={item.icon} size={18} color={item.color} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-[13px] font-bold text-[#0A1628] group-hover:text-blue-600">{item.title}</p>
              <p className="mt-1 line-clamp-1 text-[12px] font-medium text-[#64748B]">{item.sub}</p>
            </div>

            {!item.read ? <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" /> : null}
          </article>
        ))}

        {notifications.length === 0 ? (
          <p className="rounded-xl border-0 bg-slate-50 px-4 py-8 text-center text-[13px] font-medium text-slate-500 shadow-inner ring-1 ring-black/5">
            Нет новых уведомлений
          </p>
        ) : null}
      </div>
    </CardShell>
  )
}
