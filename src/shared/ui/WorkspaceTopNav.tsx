/* eslint-disable */
// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  detectAppLocale,
  formatNotificationDateTime,
  getNotificationTranslations,
} from '../notifications/notificationPresentation'
import { canAccessAlemContact } from '../config/alemContactAccess'
import AppModal from './AppModal'
import MaterialSymbol from './MaterialSymbol'
import GradientAvatar from './GradientAvatar'

interface TopNavNotification {
  id: string
  type: string
  title: string
  subtitle: string
  preview?: string
  isRead: boolean
  icon: string
  createdAt?: string
  dateLabel?: string
  sourceName?: string
  sourceSystemCode?: string
  status?: string
  statusLabel?: string
  statusTone?: 'success' | 'warning' | 'error' | 'neutral'
  actionUrl?: string
  fullMessage?: string
  notificationType?: string
  externalMessageId?: string
  applicationNumber?: string
  processedAt?: string
  metadata?: Record<string, any>
}

const NAV_ITEMS = [
  { id: 'workspace', icon: 'apps', label: 'Workspace', route: '/workspace' },
  { id: 'board', icon: 'view_kanban', label: 'Доска', route: '/board' },
  { id: 'calendar', icon: 'calendar_today', label: 'Календарь', route: '/calendar' },
  { id: 'alem-rag', icon: 'auto_awesome', label: 'Alem AI', route: '/alem-rag', isAi: true },
  { id: 'alemdrive', icon: 'folder_open', label: 'Alem Drive', route: '/drive' },
  { id: 'notes', icon: 'notes', label: 'Заметки', route: '/notes' },
  { id: 'alem-contact', icon: 'contacts', label: 'AlemContact', route: '/alem-contact' },
  { id: 'chat', icon: 'forum', label: 'Сообщения', route: '/messenger' },
]

const NAV_GROUPS: string[][] = [
  ['workspace', 'board', 'calendar'],
  ['alem-rag', 'alemdrive'],
  ['notes', 'alem-contact', 'chat'],
]

interface WorkspaceTopNavProps {
  activeNav: string
  setActiveNav: (id: string) => void
  onLogout: () => Promise<void>
  isLoggingOut: boolean
  notifications?: TopNavNotification[]
  onMarkNotificationRead?: (notificationId: string) => Promise<void>
  onMarkAllNotificationsRead?: () => Promise<void>
  userName?: string
  /** Для ограничения раздела AlemContact */
  userEmail?: string
  avatarUrl?: string
  chatUnreadCount?: number
  accessToken?: string | null
}

export default function WorkspaceTopNav({
  activeNav,
  setActiveNav,
  onLogout,
  isLoggingOut,
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  userName = 'Пользователь',
  userEmail = '',
  avatarUrl,
  chatUnreadCount = 0,
  accessToken,
}: WorkspaceTopNavProps) {
  const navigate = useNavigate()
  const showAlemContact = canAccessAlemContact(userEmail)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifRender, setNotifRender] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<TopNavNotification | null>(null)

  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [rsvpSuccess, setRsvpSuccess] = useState('')
  const [rsvpError, setRsvpError] = useState('')

  useEffect(() => {
    setRsvpLoading(false)
    setRsvpSuccess('')
    setRsvpError('')
  }, [selectedNotification])

  const handleCalendarRsvp = async (status: 'accepted' | 'declined') => {
    const eventId = selectedNotification?.metadata?.event_id || selectedNotification?.metadata?.eventId
    if (!eventId) {
      setRsvpError('Не удалось определить ID встречи.')
      return
    }
    setRsvpLoading(true)
    setRsvpError('')
    setRsvpSuccess('')

    try {
      const { LocalStorageAuthSessionStore } = await import('../../infrastructure/storage/LocalStorageAuthSessionStore')
      const { authorizedFetch } = await import('../../infrastructure/http/authorizedFetch')
      const sessionStore = new LocalStorageAuthSessionStore()

      await authorizedFetch(sessionStore, `/api/v1/calendar/events/${eventId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ status, comment: '' }),
      })

      setRsvpSuccess(
        status === 'accepted'
          ? 'Вы успешно приняли приглашение на встречу!'
          : 'Вы отклонили приглашение на встречу.'
      )

      if (onMarkNotificationRead && selectedNotification?.id) {
        void onMarkNotificationRead(selectedNotification.id)
      }
    } catch (err: any) {
      console.error(err)
      setRsvpError(err?.message || 'Не удалось отправить ответ на приглашение.')
    } finally {
      setRsvpLoading(false)
    }
  }

  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const locale = detectAppLocale()
  const t = getNotificationTranslations(locale)

  const unread = notifications.filter((n) => !n.isRead).length
  const initials =
    userName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'U'

  const handleMarkAsRead = async (notificationId: string) => {
    if (!onMarkNotificationRead) return
    await onMarkNotificationRead(notificationId).catch(() => undefined)
  }

  const handleMarkAllAsRead = async () => {
    if (!onMarkAllNotificationsRead) return
    await onMarkAllNotificationsRead().catch(() => undefined)
  }

  const badgeClassName = (tone?: TopNavNotification['statusTone']) => {
    switch (tone) {
      case 'success':
        return 'border-[#B7E4CC] bg-[#EAFBF2] text-[#157347]'
      case 'warning':
        return 'border-[#F4D8A6] bg-[#FFF7E8] text-[#9A6700]'
      case 'error':
        return 'border-[#F5B5B5] bg-[#FFF0F0] text-[#C53030]'
      default:
        return 'border-[#D9E3F0] bg-[#F5F8FC] text-[#5F728C]'
    }
  }

  const openActionUrl = (actionUrl: string) => {
    if (/^https?:\/\//i.test(actionUrl)) {
      window.location.assign(actionUrl)
      return
    }

    if (actionUrl.startsWith('/')) {
      navigate(actionUrl)
      setNotifOpen(false)
      setNotifRender(false)
      setSelectedNotification(null)
      return
    }

    window.location.assign(actionUrl)
  }

  const handleOpenNotification = async (notification: TopNavNotification) => {
    await handleMarkAsRead(notification.id)

    if (notification.actionUrl) {
      openActionUrl(notification.actionUrl)
      return
    }

    setSelectedNotification(notification)
  }

  const handleNav = (item: typeof NAV_ITEMS[0]) => {
    if (item.isExternal) {
      const url = new URL(item.route)
      if (accessToken) {
        url.searchParams.set('token', accessToken)
      }
      window.open(url.toString(), '_blank', 'noopener,noreferrer')
      return
    }

    setActiveNav(item.id)
    navigate(item.route)
    setNotifOpen(false)
    setProfileOpen(false)
    setMobileMenuOpen(false)
  }

  const handleOverlayClick = () => {
    setNotifOpen(false)
    setProfileOpen(false)
    setMobileMenuOpen(false)
  }

  const openNotifications = () => {
    setNotifRender(true)
    requestAnimationFrame(() => {
      setNotifOpen(true)
    })
  }

  const closeNotifications = () => {
    setNotifOpen(false)
  }

  const toggleNotifications = () => {
    if (notifOpen) {
      closeNotifications()
      return
    }
    setProfileOpen(false)
    setMobileMenuOpen(false)
    openNotifications()
  }

  useEffect(() => {
    if (notifOpen) return
    if (!notifRender) return
    const timeout = window.setTimeout(() => setNotifRender(false), 220)
    return () => window.clearTimeout(timeout)
  }, [notifOpen, notifRender])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifOpen && notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen, profileOpen])

  return (
    <>
      {(notifOpen || profileOpen || mobileMenuOpen) && (
        <div className="fixed inset-0 z-[490] bg-black/5 lg:hidden" onClick={handleOverlayClick} />
      )}

      <header className="sticky top-0 z-[500] bg-transparent px-3 py-2.5">
        <div className="mx-auto flex h-16 max-w-[1780px] items-center rounded-2xl border border-white/20 bg-white/70 px-4 shadow-[0_8px_32px_rgba(10,22,40,0.04)] backdrop-blur-md transition-all duration-300">
        <div className="flex items-center gap-2 lg:gap-4 flex-1 lg:flex-initial">
          <button
            onClick={() => { setMobileMenuOpen(!mobileMenuOpen); closeNotifications(); setProfileOpen(false) }}
            className="flex h-9 w-9 items-center justify-center rounded-xl lg:hidden hover:bg-slate-500/5 transition-colors border-0 cursor-pointer"
          >
            <MaterialSymbol name={mobileMenuOpen ? 'close' : 'menu'} size={22} color="#374C6B" />
          </button>
          
          <div
            className="flex shrink-0 cursor-pointer items-center gap-2 lg:gap-3 lg:border-r border-slate-200/60 pr-4 lg:pr-6"
            onClick={() => {
              setActiveNav('home')
              navigate('/dashboard')
              setNotifOpen(false)
              setProfileOpen(false)
              setMobileMenuOpen(false)
            }}
          >
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Alem logo" className="h-9 lg:h-10 w-auto object-contain" />
            <span className="hidden sm:inline text-[15px] lg:text-[16px] font-semibold tracking-[-0.02em] font-outfit text-[#0F1F33] whitespace-nowrap">
              Alem Workspace
            </span>
          </div>
        </div>

        <nav className="hidden lg:flex flex-1 items-center justify-center px-4 h-full min-w-0">
          <div className="no-scrollbar flex h-full items-center overflow-x-auto bg-transparent px-2 gap-1.5">
          {NAV_GROUPS.map((groupIds, groupIndex) => (
            <div key={`group-${groupIndex}`} className="flex items-center">
              {groupIds
                .filter((itemId) => itemId !== 'alem-contact' || showAlemContact)
                .map((itemId) => {
                  const item = NAV_ITEMS.find((navItem) => navItem.id === itemId)
                  if (!item) return null
                  const isActive = activeNav === item.id
                  const isAiNav = Boolean(item.isAi)
                  const itemBadge = item.id === 'chat' ? chatUnreadCount : item.badge
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item)}
                      className={[
                        'group relative flex h-9 items-center gap-2 rounded-xl px-3 py-1.5 transition-all duration-200 cursor-pointer border-0 font-[inherit] leading-none whitespace-nowrap',
                        isAiNav
                          ? isActive
                            ? 'bg-indigo-50/80 text-indigo-700 font-semibold ring-1 ring-indigo-100/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                            : 'text-indigo-600/90 hover:bg-indigo-500/5 hover:text-indigo-800 font-medium'
                          : isActive
                            ? 'bg-[#F0F6FF] text-[#1D72E7] font-semibold ring-1 ring-[#D2E2F8]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                            : 'text-[#60718C] hover:bg-slate-500/5 hover:text-[#0F1F33] font-medium',
                      ].join(' ')}
                    >
                      <div className="relative flex items-center justify-center">
                        <MaterialSymbol
                          name={item.icon}
                          size={18}
                          color={
                            isAiNav
                              ? isActive
                                ? '#4F46E5'
                                : '#6366F1'
                              : isActive
                                ? '#1D72E7'
                                : 'currentColor'
                          }
                        />
                        {itemBadge ? (
                          <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-[#CB3F3F] px-1 text-[9px] font-bold text-white shadow-[0_2px_6px_rgba(203,63,63,0.3)]">
                            {itemBadge > 99 ? '99+' : itemBadge}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[13px] tracking-tight whitespace-nowrap">
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              {groupIndex < NAV_GROUPS.length - 1 ? (
                <div className="mx-2.5 w-px h-5 bg-slate-200/60 align-middle self-center" aria-hidden />
              ) : null}
            </div>
          ))}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-2 ml-auto">
          <div className="relative" ref={notifRef}>
            <button
              onClick={toggleNotifications}
              className={[
                'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-0 transition-all duration-200',
                notifOpen ? 'bg-[#F0F6FF] text-[#1D72E7] ring-1 ring-[#D2E2F8]/60' : 'bg-transparent text-[#6B7F99] hover:bg-slate-500/5 hover:text-[#0F1F33]',
              ].join(' ')}
            >
              <MaterialSymbol name="notifications" size={20} color="currentColor" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CB3F3F] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#CB3F3F]"></span>
                </span>
              )}
            </button>

            {notifRender && (
              <div
                className={[
                  'absolute top-13 right-0 z-300 w-[min(560px,calc(100vw-16px))] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-[#EDF2F8] bg-white/95 backdrop-blur-lg shadow-[0_16px_48px_rgba(15,35,62,0.1)] transition-all duration-220 ease-out sm:w-140 sm:max-w-140',
                  notifOpen ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-2 scale-[0.98] opacity-0 pointer-events-none',
                ].join(' ')}
              >
                <div className="flex items-center justify-between border-b border-[#EDF2F8] px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-[#0F1F33]">{t.notifications}</span>
                    {unread > 0 && (
                      <span className="rounded-lg bg-[#CB3F3F] px-1.75 py-px text-[10px] font-bold text-white shadow-sm">{unread} {t.newItems}</span>
                    )}
                  </div>
                  <span
                    className="cursor-pointer text-[11px] font-semibold text-[#1D72E7] hover:underline whitespace-nowrap"
                    onClick={() => { void handleMarkAllAsRead() }}
                  >
                    {t.allRead}
                  </span>
                </div>

                <div className="max-h-[70vh] overflow-y-auto sm:max-h-[72vh] custom-scrollbar">
                  {notifications.map((n, i) => (
                    <div
                      key={`${n.id}-${n.type}`}
                      onClick={() => { void handleOpenNotification(n) }}
                      className={[
                        'flex cursor-pointer items-start gap-3 px-5 py-3.5 transition-all duration-200',
                        !n.isRead ? 'bg-[#F3F8FF]/60 hover:bg-[#F3F8FF]' : 'bg-transparent hover:bg-slate-500/5',
                        i < notifications.length - 1 ? 'border-b border-[#EDF2F8]' : '',
                      ].join(' ')}
                      style={{
                        transitionDelay: notifOpen ? `${Math.min(i, 6) * 16}ms` : '0ms',
                        transform: notifOpen ? 'translateY(0)' : 'translateY(-2px)',
                        opacity: notifOpen ? 1 : 0.94,
                      }}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.isRead ? 'bg-slate-100' : 'bg-[#F0F6FF]'}`}>
                        <MaterialSymbol name={n.icon} size={17} color={n.isRead ? '#60718C' : '#1D72E7'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className={`min-w-0 text-xs text-[#0F1F33] ${n.isRead ? 'font-semibold' : 'font-bold'}`}>{n.title}</div>
                          <div className="shrink-0 text-[10px] font-medium text-[#60718C]">
                            {n.dateLabel || (n.createdAt ? formatNotificationDateTime(n.createdAt, locale) : '')}
                          </div>
                        </div>
                        <div className="mt-1 wrap-break-word text-[11px] leading-[1.45] text-[#60718C]">
                          {n.preview || n.subtitle}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {n.sourceName ? (
                            <span className="rounded-full border border-[#D9E3F0] bg-[#F5F8FC] px-2 py-0.5 text-[10px] font-semibold text-[#556987]">
                              {t.source}: {n.sourceName}
                            </span>
                          ) : null}
                          {n.statusLabel ? (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClassName(n.statusTone)}`}>
                              {t.status}: {n.statusLabel}
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleOpenNotification(n)
                          }}
                          className="mt-2 text-[11px] font-semibold text-[#1D72E7] hover:underline cursor-pointer border-0 bg-transparent"
                        >
                          {t.details}
                        </button>
                      </div>
                      {!n.isRead && <div className="mt-1.5 h-1.75 w-1.75 shrink-0 rounded-full bg-[#1D72E7] shadow-sm" />}
                    </div>
                  ))}

                  {notifications.length === 0 && (
                    <div className="px-5 py-5 text-xs text-[#60718C]">{t.noNotifications}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px shrink-0 self-center bg-slate-200/60" aria-hidden />

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setProfileOpen(!profileOpen); closeNotifications(); setMobileMenuOpen(false) }}
              className={[
                'flex h-9 cursor-pointer items-center gap-2 rounded-xl border-0 px-1.5 font-[inherit] text-[#0F1F33] transition-all duration-200',
                profileOpen ? 'bg-[#F4F7FB] ring-1 ring-slate-200/50' : 'bg-transparent hover:bg-slate-500/5',
              ].join(' ')}
            >
              <GradientAvatar initials={initials} src={avatarUrl} size={28} seed={0} />
              <div className="hidden text-left md:block">
                <div className="text-[12px] font-bold leading-none text-[#0F1F33]">{userName}</div>
              </div>
              <MaterialSymbol name="expand_more" size={16} color="#60718C" />
            </button>

            {profileOpen && (
              <div className="absolute top-13 right-0 z-300 w-56 overflow-hidden rounded-2xl border border-[#EDF2F8] bg-white/95 backdrop-blur-lg shadow-[0_16px_48px_rgba(15,35,62,0.1)]">
                <div className="flex items-center gap-3 border-b border-[#EDF2F8] px-4 py-3.5">
                  <GradientAvatar initials={initials} src={avatarUrl} size={32} seed={0} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-[#0F1F33]">{userName}</div>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false)
                      setActiveNav('profile')
                      navigate('/profile')
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[13px] text-[#374C6B] transition-colors hover:bg-slate-500/5 hover:text-[#0F1F33] border-0 bg-transparent font-[inherit]"
                  >
                    <MaterialSymbol name="badge" size={16} color="#60718C" />
                    Мой профиль
                  </button>
                </div>

                <div className="border-t border-[#EDF2F8] py-1">
                  <button
                    onClick={() => { setProfileOpen(false); void onLogout() }}
                    disabled={isLoggingOut}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[13px] text-[#CB3F3F] transition-colors hover:bg-[#FEF0F0] disabled:opacity-60 border-0 bg-transparent font-[inherit]"
                  >
                    <MaterialSymbol name="logout" size={16} color="#CB3F3F" />
                    {isLoggingOut ? 'Выход...' : 'Выйти'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </header>

      {selectedNotification ? (
        <AppModal title={selectedNotification.title} onClose={() => setSelectedNotification(null)} maxWidth={640}>
          {(() => {
            const isCalendarInvite =
              (selectedNotification.type === 'calendar_invite' ||
                selectedNotification.notificationType === 'calendar_invite' ||
                selectedNotification.type === 'calendar_event_created' ||
                selectedNotification.type === 'calendar_event_updated') &&
              Boolean(selectedNotification.metadata?.event_id || selectedNotification.metadata?.eventId)

            return (
              <div className="space-y-4">
                <div className="text-[14px] font-semibold leading-6 text-[#0A1628]">
                  {selectedNotification.fullMessage || selectedNotification.preview || selectedNotification.subtitle}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedNotification.sourceName ? (
                    <span className="rounded-full border border-[#D9E3F0] bg-[#F5F8FC] px-2.5 py-1 text-[11px] font-semibold text-[#556987]">
                      {t.source}: {selectedNotification.sourceName}
                    </span>
                  ) : null}
                  {selectedNotification.statusLabel ? (
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClassName(selectedNotification.statusTone)}`}>
                      {t.status}: {selectedNotification.statusLabel}
                    </span>
                  ) : null}
                </div>

                {isCalendarInvite && (
                  <div className="rounded-2xl border border-[#E7EDF6] bg-[#F8FAFC] p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#374C6B]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[#1E88E5]">
                        <MaterialSymbol name="event" size={14} color="currentColor" />
                      </span>
                      ВАШ ОТВЕТ НА ПРИГЛАШЕНИЕ
                    </div>

                    {rsvpSuccess ? (
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                        <MaterialSymbol name="check_circle" size={18} color="currentColor" />
                        {rsvpSuccess}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={rsvpLoading}
                            onClick={() => handleCalendarRsvp('accepted')}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs py-2.5 transition-all duration-200 shadow-sm hover:shadow"
                          >
                            {rsvpLoading ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <MaterialSymbol name="check" size={14} color="currentColor" />
                            )}
                            Принять встречу
                          </button>

                          <button
                            type="button"
                            disabled={rsvpLoading}
                            onClick={() => handleCalendarRsvp('declined')}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-60 border border-rose-200 text-rose-600 font-bold text-xs py-2.5 transition-all duration-200"
                          >
                            {rsvpLoading ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
                            ) : (
                              <MaterialSymbol name="close" size={14} color="currentColor" />
                            )}
                            Отклонить встречу
                          </button>
                        </div>

                        {rsvpError && (
                          <div className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5">
                            {rsvpError}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

            <div className="grid gap-3 rounded-2xl border border-[#E7EDF6] bg-[#FBFCFE] p-4 sm:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A9BB5]">{t.receivedAt}</div>
                <div className="mt-1 text-[13px] font-medium text-[#0A1628]">
                  {selectedNotification.createdAt ? formatNotificationDateTime(selectedNotification.createdAt, locale) : '-'}
                </div>
              </div>
              {selectedNotification.processedAt ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A9BB5]">{t.processedAt}</div>
                  <div className="mt-1 text-[13px] font-medium text-[#0A1628]">
                    {formatNotificationDateTime(selectedNotification.processedAt, locale)}
                  </div>
                </div>
              ) : null}
              {selectedNotification.sourceName ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A9BB5]">{t.sourceSystemName}</div>
                  <div className="mt-1 text-[13px] font-medium text-[#0A1628]">{selectedNotification.sourceName}</div>
                </div>
              ) : null}
              {selectedNotification.sourceSystemCode ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A9BB5]">{t.sourceSystemCode}</div>
                  <div className="mt-1 text-[13px] font-medium text-[#0A1628]">{selectedNotification.sourceSystemCode}</div>
                </div>
              ) : null}
              {selectedNotification.externalMessageId ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A9BB5]">{t.externalMessageId}</div>
                  <div className="mt-1 break-all text-[13px] font-medium text-[#0A1628]">{selectedNotification.externalMessageId}</div>
                </div>
              ) : null}
              {selectedNotification.applicationNumber ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8A9BB5]">{t.applicationNumber}</div>
                  <div className="mt-1 text-[13px] font-medium text-[#0A1628]">{selectedNotification.applicationNumber}</div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="rounded-xl border border-[#D9E3F0] px-4 py-2 text-[13px] font-semibold text-[#52637D] transition hover:bg-[#F6F8FB]"
              >
                {t.close}
              </button>
              {selectedNotification.actionUrl ? (
                <button
                  type="button"
                  onClick={() => openActionUrl(selectedNotification.actionUrl!)}
                  className="rounded-xl bg-[#1E88E5] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#166FC2]"
                >
                  {t.open}
                </button>
              ) : null}
            </div>
          </div>
            )
          })()}
        </AppModal>
      ) : null}

      {/* Mobile Drawer */}
      <div
        className={[
          'fixed left-3 right-3 top-[76px] bottom-3 z-[500] w-auto max-w-[320px] transform overflow-hidden rounded-[28px] border border-white/40 bg-white/88 backdrop-blur-xl shadow-[0_24px_60px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-in-out lg:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex max-h-[calc(100vh-88px)] flex-col gap-1.5 overflow-y-auto p-4 custom-scrollbar">
          {NAV_ITEMS.filter((item) => item.id !== 'alem-contact' || showAlemContact).map((item) => {
            const isActive = activeNav === item.id
            const isAiNav = Boolean(item.isAi)
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item)}
                className={[
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all border-0 cursor-pointer font-[inherit]',
                  isAiNav
                    ? isActive
                      ? 'bg-indigo-50 text-indigo-700 font-bold ring-1 ring-indigo-100/70 shadow-sm'
                      : 'text-indigo-600/90 font-semibold hover:bg-indigo-500/5 hover:text-indigo-800'
                    : isActive
                      ? 'bg-[#F0F6FF] text-[#1D72E7] font-bold ring-1 ring-[#D2E2F8]/60 shadow-sm'
                      : 'text-[#60718C] font-semibold hover:bg-slate-500/5 hover:text-[#0F1F33]',
                ].join(' ')}
              >
                <MaterialSymbol
                  name={item.icon}
                  size={20}
                  color={isAiNav ? (isActive ? '#4F46E5' : '#6366F1') : isActive ? '#1D72E7' : 'currentColor'}
                />
                <span className="text-[13px] flex min-w-0 flex-1 items-center gap-2">
                  {item.label}
                </span>
                {isActive && (
                   <div className={`ml-auto h-1.5 w-1.5 rounded-full ${isAiNav ? 'bg-indigo-600' : 'bg-[#1D72E7]'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
