/* eslint-disable */
// @ts-nocheck
import { C } from '../../pages/dashboard/model/constants'
import MS from '../../../shared/ui/MaterialSymbol'
import { Avatar } from './primitives'

function Header({ notifOpen, setNotifOpen, notifications = [], userName = 'Пользователь', userRole = '' }) {
  const unread = notifications.filter((n) => !n.read).length
  const initials =
    userName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'

  return (
    <header className="sticky top-0 z-[100] flex h-16 items-center gap-4 border-b border-[#DDE3EE] bg-white px-7 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="hidden sm:flex flex-1 items-center gap-1.5 truncate">
        <span className="text-[11px] font-medium text-[#8497B4]">Alem Platform</span>
        <MS name="chevron_right" size={14} color={C.inkFaint} />
        <span className="text-[11px] font-bold text-[#0A1628] truncate">Главная панель</span>
      </div>

      <div className="hidden md:flex h-[38px] w-[280px] items-center gap-2.5 rounded-[10px] border border-[#DDE3EE] bg-[#F2F5FA] px-[13px]">
        <MS name="search" size={15} color={C.inkMuted} />
        <input
          placeholder="Поиск задач, документов, событий…"
          className="flex-1 border-0 bg-transparent text-[13px] text-[#0A1628] outline-none placeholder:text-[#8497B4]"
        />
        <div className="flex items-center gap-0.5 rounded-[5px] border border-[#EAEFF8] bg-white px-1.5 py-0.5">
          <span className="text-[10px] font-bold text-[#8497B4]">⌘</span>
          <span className="text-[10px] font-bold text-[#8497B4]">K</span>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          className={`relative flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[10px] border transition-all ${
            notifOpen ? 'border-[#1E88E5]/40 bg-[#EBF4FE]' : 'border-[#DDE3EE] bg-[#F2F5FA]'
          }`}
        >
          <MS name="notifications" size={18} color={notifOpen ? C.blue : C.inkSub} />
          {unread > 0 ? <span className="absolute top-[7px] right-[7px] h-2 w-2 rounded-full border-2 border-white bg-[#C53030]" /> : null}
        </button>

        {notifOpen ? (
          <div className="absolute top-[46px] right-0 z-[500] w-[368px] overflow-hidden rounded-[14px] border border-[#DDE3EE] bg-white shadow-[0_12px_48px_rgba(10,22,40,0.14),0_2px_8px_rgba(10,22,40,0.06)]">
            <div className="flex items-center justify-between border-b border-[#EAEFF8] px-5 pt-4 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-extrabold text-[#0A1628]">Уведомления</span>
                {unread > 0 ? <span className="rounded-lg bg-[#C53030] px-[7px] py-px text-[10px] font-bold text-white">{unread} новых</span> : null}
              </div>
              <span className="cursor-pointer text-[11px] font-semibold text-[#1E88E5]">Отметить прочитанными</span>
            </div>

            {notifications.map((n, i) => (
              <div
                key={n.id}
                className={`flex cursor-pointer items-start gap-3 px-5 py-[13px] transition-colors hover:bg-[#F2F5FA] ${
                  !n.read ? 'bg-[#F6F9FF]' : 'bg-transparent'
                } ${i < notifications.length - 1 ? 'border-b border-[#EAEFF8]' : ''}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${n.read ? 'bg-[#F2F5FA]' : 'bg-[#EBF4FE]'}`}
                >
                  <MS name={n.icon} size={17} color={n.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`mb-0.5 text-xs text-[#0A1628] ${n.read ? 'font-medium' : 'font-bold'}`}>{n.title}</div>
                  <div className="text-[11px] text-[#8497B4]">{n.sub}</div>
                </div>
                {!n.read ? <div className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-[#1E88E5]" /> : null}
              </div>
            ))}

            {notifications.length === 0 ? <div className="px-5 py-3.5 text-xs text-[#8497B4]">Нет уведомлений</div> : null}

            <div className="border-t border-[#EAEFF8] px-5 py-3 text-center">
              <span className="cursor-pointer text-xs font-bold text-[#1E88E5]">Все уведомления →</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="h-6 w-px bg-[#EAEFF8]" />

      <button className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-[5px] transition-colors hover:bg-[#F2F5FA]">
        <Avatar initials={initials} size={34} seed={0} />
        <div className="text-left">
          <div className="text-xs font-bold text-[#0A1628]">{userName}</div>
          <div className="text-[10px] text-[#8497B4]">{userRole || 'Пользователь'}</div>
        </div>
        <MS name="expand_more" size={16} color={C.inkMuted} />
      </button>
    </header>
  )
}

export default Header
