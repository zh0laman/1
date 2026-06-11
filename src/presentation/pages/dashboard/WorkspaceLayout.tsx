/* eslint-disable */
// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LogoutUseCase } from '../../../application/use-cases/auth/LogoutUseCase'
import { NotificationRealtimeClient } from '../../../infrastructure/notifications/NotificationRealtimeClient'
import { HttpAuthRepository } from '../../../infrastructure/repositories/HttpAuthRepository'
import { HttpChatRepository } from '../../../infrastructure/repositories/HttpChatRepository'
import { LocalStorageAuthSessionStore } from '../../../infrastructure/storage/LocalStorageAuthSessionStore'
import TopNavLayout from '../../../shared/ui/TopNavLayout'
import WorkspaceTopNav from '../../../shared/ui/WorkspaceTopNav'
import AppToast from '../../../shared/ui/AppToast'
import {
  AUTH_SESSION_EXPIRED_EVENT,
  PROFILE_UPDATED_EVENT,
  type AuthSessionExpiredDetail,
  type ProfileUpdatedDetail,
} from '../../../shared/auth/authSessionEvents'
import { consumeAuthFlashNotice, storeAuthFlashNotice, type AuthFlashNotice } from '../../../shared/auth/authFlashNotice'
import { C } from './model/constants'
import { createAuthController } from '../../auth/createAuthController'
import { CallManagerProvider } from '../../calls/CallManagerContext'
import { createHomeDashboardController } from '../../dashboard/createHomeDashboardController'
import { getDefaultHomeDashboardViewModel } from '../../view-models/HomeDashboardViewModel'
import { createNotificationController } from '../../notifications/createNotificationController'
import type { NotificationItemViewModel } from '../../view-models/NotificationViewModel'
import {
  attachMessageNotificationAudioUnlockListeners,
  playMessageNotificationSound,
} from '../../../shared/audio/messageNotificationSound'
import {
  ALEM_MESSENGER_MUTE_MAP_EVENT,
  type MessengerMuteMapDetail,
} from '../../../shared/messenger/muteMapEvents'
import {
  getRealtimeContentRecord,
  isIncomingChatMuted,
  normalizeConversationIdKey,
  resolveRealtimeConversationId,
} from '../../../shared/messenger/realtimeConversationId'
import { shouldReloadMessengerChatList } from '../../../shared/messenger/messengerWsEventsWithoutChatReload'

const MESSENGER_UNREAD_COUNT_EVENT = 'messenger:unread-count-changed'
const GLOBAL_TOAST_LIMIT = 4

type GlobalToastItem = {
  id: string
  title: string
  subtitle: string
  variant: 'success' | 'error' | 'info' | 'warning'
  icon?: string
}

const flashNoticeStyles: Record<AuthFlashNotice['kind'], { bg: string; border: string; text: string }> = {
  info: { bg: '#EEF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  warning: { bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412' },
  error: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C' },
}

const parseEventTimestamp = (input: unknown): string => {
  if (typeof input === 'string' && input) {
    const date = new Date(input)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  if (typeof input === 'number') {
    const normalized = input > 1e12 ? input : input * 1000
    const date = new Date(normalized)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  return new Date().toISOString()
}

const toReadableDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'сейчас'
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getRealtimeIcon = (eventType: string): string => {
  if (eventType.includes('call')) return 'call'
  if (eventType.includes('message') || eventType === 'typing') return 'forum'
  if (eventType.includes('chat')) return 'forum'
  if (eventType.includes('kanban') || eventType.includes('task')) return 'task_alt'
  if (eventType.includes('security') || eventType.includes('login')) return 'shield'
  if (eventType.includes('status')) return 'badge'
  return 'notifications'
}

const pickFirstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim()
      if (normalized) {
        return normalized
      }
    }
  }
  return ''
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

const toRealtimeNotification = (event: Record<string, unknown>): NotificationItemViewModel | null => {
  const eventType = typeof event.type === 'string' ? event.type : ''
  if (!eventType) return null

  const parsedEventContent = getRealtimeContentRecord(event)
  const objectEventContent =
    event.content && typeof event.content === 'object' && !Array.isArray(event.content)
      ? (event.content as Record<string, unknown>)
      : null
  const eventContent = { ...(parsedEventContent ?? {}), ...(objectEventContent ?? {}) }
  const conversationId = resolveRealtimeConversationId(event)
  const messageId = typeof event.message_id === 'string'
    ? event.message_id
    : typeof event.messageId === 'string'
      ? event.messageId
      : ''
  const notificationId = pickFirstText(
    event.notification_id,
    event.notificationId,
    eventContent.notification_id,
    eventContent.notificationId,
  )
  const createdAt = parseEventTimestamp(event.created_at ?? event.timestamp)
  const senderName = pickFirstText(
    eventContent.sender_full_name,
    eventContent.senderFullName,
    eventContent.from_full_name,
    eventContent.fromFullName,
    eventContent.from_name,
    eventContent.fromName,
    eventContent.sender_name,
    eventContent.senderName,
    eventContent.author_name,
    eventContent.authorName,
    eventContent.user_name,
    eventContent.username,
    eventContent.sender_username,
    eventContent.senderUsername,
    eventContent.full_name,
    eventContent.name,
    event.from_name,
    event.sender_name,
  )
  const senderId = typeof event.from === 'number' && Number.isFinite(event.from) ? event.from : null
  const resolvedSenderName = senderName || (senderId && senderId > 0 ? `User ${senderId}` : 'Система')
  const roomName = typeof eventContent.room_name === 'string' ? eventContent.room_name : ''
  const title = typeof event.title === 'string' && event.title.trim() ? event.title.trim() : ''
  const content =
    typeof event.content === 'string' && event.content.trim()
      ? event.content.trim()
      : typeof event.body === 'string' && event.body.trim()
        ? event.body.trim()
        : typeof eventContent.content === 'string' && eventContent.content.trim()
          ? eventContent.content.trim()
          : ''
  const idParts = [
    eventType,
    typeof event.id === 'string' ? event.id : '',
    messageId,
    conversationId,
    createdAt,
  ].filter(Boolean)
  const fallbackId = notificationId || `ws-${idParts.join(':')}`

  const chatMessagePresentation = (): NotificationItemViewModel => ({
    id: fallbackId,
    type: 'new_message',
    title: 'Новое сообщение',
    subtitle: `${resolvedSenderName}${roomName ? ` · ${roomName}` : ''} · ${toReadableDate(createdAt)}`,
    isRead: false,
    icon: getRealtimeIcon('new_message'),
    createdAt,
  })

  const eventTypeKey = eventType.toLowerCase()
  switch (eventTypeKey) {
    case 'new_message':
    case 'chat_message':
    case 'message_created':
      return chatMessagePresentation()
    case 'incoming_call':
      return {
        id: fallbackId,
        type: eventType,
        title: 'Входящий звонок',
        subtitle: `${resolvedSenderName} · ${toReadableDate(createdAt)}`,
        isRead: false,
        icon: getRealtimeIcon(eventType),
        createdAt,
      }
    case 'typing':
      return {
        id: fallbackId,
        type: eventType,
        title: 'Набор текста',
        subtitle: `${resolvedSenderName} печатает...`,
        isRead: true,
        icon: getRealtimeIcon(eventType),
        createdAt,
      }
    case 'message_deleted':
      return {
        id: fallbackId,
        type: eventType,
        title: 'Сообщение удалено',
        subtitle: `${roomName || 'Чат'} · ${toReadableDate(createdAt)}`,
        isRead: true,
        icon: getRealtimeIcon(eventType),
        createdAt,
      }
    case 'chat_hidden':
      return {
        id: fallbackId,
        type: eventType,
        title: 'Чат скрыт',
        subtitle: `${roomName || 'Диалог'} · ${toReadableDate(createdAt)}`,
        isRead: true,
        icon: getRealtimeIcon(eventType),
        createdAt,
      }
    case 'user_status':
      return {
        id: fallbackId,
        type: eventType,
        title: 'Статус пользователя',
        subtitle: `${resolvedSenderName} · ${toReadableDate(createdAt)}`,
        isRead: true,
        icon: getRealtimeIcon(eventType),
        createdAt,
      }
    case 'message':
      return {
        id: fallbackId,
        type: eventType,
        title: 'Уведомление',
        subtitle: `${resolvedSenderName} · ${toReadableDate(createdAt)}`,
        isRead: false,
        icon: getRealtimeIcon(eventType),
        createdAt,
      }
    default:
      if (!title && !content) {
        return null
      }
      return {
        id: fallbackId,
        type: eventType,
        title: title || 'Уведомление',
        subtitle: content || toReadableDate(createdAt),
        isRead: false,
        icon: getRealtimeIcon(eventType),
        createdAt,
        metadata: eventContent,
      }
  }
}

const mergeNotifications = (
  previous: NotificationItemViewModel[],
  incoming: NotificationItemViewModel,
): NotificationItemViewModel[] => {
  const byId = new Map<string, NotificationItemViewModel>()
  previous.forEach((item) => {
    byId.set(item.id, item)
  })

  const existing = byId.get(incoming.id)
  byId.set(incoming.id, existing ? { ...existing, ...incoming } : incoming)

  return Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 60)
}

const isEphemeralRealtimeNotification = (notification: NotificationItemViewModel): boolean =>
  notification.type === 'typing' || notification.type === 'user_status'

const toGlobalToast = (notification: NotificationItemViewModel): GlobalToastItem | null => {
  if (isEphemeralRealtimeNotification(notification)) {
    return null
  }

  return {
    id: notification.id,
    title: notification.title,
    subtitle: notification.subtitle,
    variant: notification.type === 'incoming_call' ? 'warning' : 'info',
    icon: notification.icon,
  }
}

export default function WorkspaceLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [manualActiveNav, setManualActiveNav] = useState('home')
  const isTablet = location.pathname.endsWith('/tablet') || location.pathname.includes('/tablet/')
  const isEmbedded = location.pathname.includes('/editor') || location.search.includes('embedded=true')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [userName, setUserName] = useState('Пользователь')
  const [userEmail, setUserEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [dashboardData, setDashboardData] = useState(getDefaultHomeDashboardViewModel())
  const [notifications, setNotifications] = useState<NotificationItemViewModel[]>([])
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const [globalToasts, setGlobalToasts] = useState<GlobalToastItem[]>([])
  const [flashNotice, setFlashNotice] = useState<AuthFlashNotice | null>(() => consumeAuthFlashNotice())
  const [isNotificationsBootstrapped, setIsNotificationsBootstrapped] = useState(false)
  const [, setNotificationSocketStatus] = useState('idle')
  const shownRealtimeToastIdsRef = useRef<Set<string>>(new Set())
  const messengerMuteMapRef = useRef<MessengerMuteMapDetail>({})

  const authRepository = useMemo(() => new HttpAuthRepository(), [])
  const sessionStore = useMemo(() => new LocalStorageAuthSessionStore(), [])
  const chatRepository = useMemo(() => new HttpChatRepository(sessionStore), [sessionStore])
  const logoutUseCase = useMemo(() => new LogoutUseCase(authRepository, sessionStore), [authRepository, sessionStore])
  const { authController } = useMemo(() => createAuthController(), [])
  const { homeDashboardController } = useMemo(() => createHomeDashboardController(), [])
  const { notificationController } = useMemo(() => createNotificationController(), [])
  const notificationRealtimeClient = useMemo(
    () => new NotificationRealtimeClient(),
    [],
  )

  const routeActiveNav = location.pathname.startsWith('/messenger')
    ? 'chat'
    : location.pathname.startsWith('/profile')
      ? 'profile'
      : location.pathname.startsWith('/calendar')
        ? 'calendar'
        : location.pathname.startsWith('/alemstore')
          ? 'alemstore'
          : location.pathname.startsWith('/alem-rag')
              ? 'alem-rag'
          : location.pathname.startsWith('/alemai')
            ? 'alem-rag'
            : location.pathname.startsWith('/drive')
              ? 'alemdrive'
              : location.pathname.startsWith('/notes')
                ? 'notes'
                : location.pathname.startsWith('/alem-contact')
                  ? 'alem-contact'
                : location.pathname.startsWith('/board') || location.pathname.startsWith('/kanban')
                ? 'board'
                : location.pathname.startsWith('/workspace')
                  ? 'workspace'
                  : location.pathname.startsWith('/dashboard') || location.pathname === '/'
                    ? 'home'
                    : manualActiveNav

  useEffect(() => {
    return attachMessageNotificationAudioUnlockListeners()
  }, [])

  useEffect(() => {
    let isCancelled = false

    const load = async () => {
      try {
        const [authModel, homeModel, notificationList, unifiedChats] = await Promise.all([
          authController.bootstrap(),
          homeDashboardController.load(),
          notificationController.loadNotifications({ limit: 50, offset: 0 }),
          chatRepository.getUnifiedChats(),
        ])

        if (isCancelled) {
          return
        }

        setUserName(authModel.name || 'Пользователь')
        setUserEmail(authModel.email || '')
        setCurrentUserId(typeof authModel.userId === 'number' ? authModel.userId : null)
        setAvatarUrl(authModel.avatarUrl || '')
        setDashboardData(homeModel)
        setNotifications(
          notificationList
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        )
        setChatUnreadCount(unifiedChats.reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0))

        const muteBootstrap: MessengerMuteMapDetail = {}
        for (const chat of unifiedChats) {
          muteBootstrap[normalizeConversationIdKey(chat.id)] = chat.isMuted
          if (chat.type === 'personal' && typeof chat.peerId === 'number') {
            muteBootstrap[`peer:${chat.peerId}`] = chat.isMuted
          }
        }
        messengerMuteMapRef.current = muteBootstrap
      } catch {
        // silently ignore at layout level
      } finally {
        if (!isCancelled) {
          setIsNotificationsBootstrapped(true)
        }
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [authController, chatRepository, homeDashboardController, notificationController])

  useEffect(() => {
    const onMuteMap = (e: Event) => {
      const detail = (e as CustomEvent<MessengerMuteMapDetail>).detail
      if (!detail || typeof detail !== 'object') {
        return
      }
      const next: MessengerMuteMapDetail = { ...messengerMuteMapRef.current }
      for (const [key, value] of Object.entries(detail)) {
        next[normalizeConversationIdKey(key)] = Boolean(value)
      }
      messengerMuteMapRef.current = next
    }
    window.addEventListener(ALEM_MESSENGER_MUTE_MAP_EVENT, onMuteMap as EventListener)
    return () => window.removeEventListener(ALEM_MESSENGER_MUTE_MAP_EVENT, onMuteMap as EventListener)
  }, [])

  useEffect(() => {
    const unsubscribeStatus = notificationRealtimeClient.subscribeStatus((nextStatus) => {
      setNotificationSocketStatus(nextStatus)
    })

    const unsubscribeEvents = notificationRealtimeClient.subscribe((event) => {
      const eventType = typeof event.type === 'string' ? event.type : ''
      const eventTypeNorm = eventType.toLowerCase()

      const shouldRefreshChats = shouldReloadMessengerChatList(eventType)

      if (shouldRefreshChats) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('messenger:refresh-chats', { detail: event }))
        }
      }

      const parsedContent = getRealtimeContentRecord(event)
      const eventContent =
        event.content && typeof event.content === 'object' && !Array.isArray(event.content)
          ? (event.content as Record<string, unknown>)
          : parsedContent

      const isChatWsMessage =
        eventTypeNorm === 'new_message' ||
        eventTypeNorm === 'chat_message' ||
        eventTypeNorm === 'message_created'

      let isMuted = false
      if (isChatWsMessage) {
        const isMention = Boolean(
          (event as { is_mention?: unknown }).is_mention ??
            parsedContent?.is_mention ??
            eventContent?.is_mention,
        )
        isMuted = isIncomingChatMuted(event, messengerMuteMapRef.current) && !isMention
      }

      const senderId = toFiniteNumber(
        eventContent?.sender_id ??
        eventContent?.senderId ??
        eventContent?.author_id ??
        eventContent?.authorId ??
        eventContent?.user_id ??
        eventContent?.userId ??
        event.from,
      )
      if (currentUserId !== null && senderId === currentUserId && 
          (eventTypeNorm === 'new_message' || eventTypeNorm === 'chat_message' || eventTypeNorm === 'message_created' || eventTypeNorm === 'typing')) {
        return
      }

      const mapped = toRealtimeNotification(event)
      if (!mapped) return
      if (isEphemeralRealtimeNotification(mapped)) return
      setNotifications((prev) => mergeNotifications(prev, mapped))

      // Play sound and increment count for all types of incoming chat messages
      const isAnyChatMessage = mapped.type === 'new_message' || eventTypeNorm === 'new_message' || eventTypeNorm === 'chat_message' || eventTypeNorm === 'message_created' || eventTypeNorm === 'message'
      if (isAnyChatMessage) {
        // Play sound ONLY if NOT muted
        if (!isMuted) {
          playMessageNotificationSound()
        }

        // Increment unread count ALWAYS (even if muted) if not currently in messenger route
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/messenger')) {
          // Refresh unread count from server to be 100% accurate
          void chatRepository.getUnifiedChats().then(chats => {
            const total = chats.reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0)
            setChatUnreadCount(total)
          }).catch(() => {})
        }
      }

      if (isMuted) return // Don't show toasts for muted chats

      const toast = toGlobalToast(mapped)
      if (!toast) return
      if (shownRealtimeToastIdsRef.current.has(toast.id)) return

      shownRealtimeToastIdsRef.current.add(toast.id)
      
      setGlobalToasts((prev) => {
        const next = [toast, ...prev.filter((item) => item.id !== toast.id)]
        return next.slice(0, GLOBAL_TOAST_LIMIT)
      })

      if (shownRealtimeToastIdsRef.current.size > 200) {
        shownRealtimeToastIdsRef.current = new Set([toast.id])
      }
    })

    if (isNotificationsBootstrapped) {
      notificationRealtimeClient.connect()
    }

    return () => {
      unsubscribeStatus()
      unsubscribeEvents()
      notificationRealtimeClient.disconnect()
    }
  }, [currentUserId, isNotificationsBootstrapped, notificationRealtimeClient])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleUnreadCountChange = (event: Event) => {
      const nextUnreadCount = (event as CustomEvent<number>).detail
      setChatUnreadCount(typeof nextUnreadCount === 'number' ? nextUnreadCount : 0)
    }

    window.addEventListener(MESSENGER_UNREAD_COUNT_EVENT, handleUnreadCountChange as EventListener)

    return () => {
      window.removeEventListener(MESSENGER_UNREAD_COUNT_EVENT, handleUnreadCountChange as EventListener)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent<AuthSessionExpiredDetail>).detail
      sessionStore.clearTokens()
      storeAuthFlashNotice({
        kind: 'error',
        title: 'Сессия завершена',
        message: detail?.message ?? 'Сессия текущего web-устройства завершена. Войдите снова.',
      })
      navigate('/login', {
        replace: true,
        state: { from: location.pathname },
      })
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired as EventListener)

    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired as EventListener)
    }
  }, [location.pathname, navigate, sessionStore])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<ProfileUpdatedDetail>).detail
      if (detail.avatarUrl !== undefined) {
        setAvatarUrl(detail.avatarUrl || '')
      }
      if (detail.fullName !== undefined) {
        setUserName(detail.fullName || 'Пользователь')
      } else if (detail.firstName !== undefined || detail.lastName !== undefined) {
        setUserName(`${detail.firstName ?? ''} ${detail.lastName ?? ''}`.trim() || 'Пользователь')
      }
    }

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated as EventListener)

    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated as EventListener)
    }
  }, [])

  const handleMarkNotificationRead = useCallback(async (notificationId: string) => {
    const target = notifications.find((item) => item.id === notificationId)
    if (!target || target.isRead) {
      return
    }

    let snapshot: NotificationItemViewModel[] = []
    setNotifications((prev) => {
      snapshot = prev
      return prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
    })

    if (notificationId.startsWith('ws-')) {
      return
    }

    try {
      await notificationController.markAsRead(notificationId)
    } catch {
      setNotifications(snapshot)
    }
  }, [notificationController, notifications])

  const handleMarkAllNotificationsRead = useCallback(async () => {
    let snapshot: NotificationItemViewModel[] = []
    setNotifications((prev) => {
      snapshot = prev
      return prev.map((item) => ({ ...item, isRead: true }))
    })
    try {
      await notificationController.markAllAsRead()
    } catch {
      setNotifications(snapshot)
    }
  }, [notificationController])

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    try {
      notificationRealtimeClient.disconnect()
      // Clear local in-memory/localStorage tokens immediately
      sessionStore.clearTokens()
    } finally {
      setIsLoggingOut(false)
    }

    // Navigate the browser to the backend Keycloak logout endpoint.
    // This is REQUIRED for proper SSO logout: the backend will revoke tokens,
    // clear app cookies, and then redirect the browser to Keycloak's end-session
    // endpoint which clears KEYCLOAK_SESSION and KEYCLOAK_IDENTITY cookies.
    // A simple POST to /api/v1/auth/logout cannot clear Keycloak browser cookies.
    window.location.href = '/api/v1/auth/keycloak/logout'
  }, [isLoggingOut, notificationRealtimeClient, sessionStore])

  const handleCloseGlobalToast = useCallback((toastId: string) => {
    setGlobalToasts((prev) => prev.filter((item) => item.id !== toastId))
  }, [])

  const topNav = (
    <>
      {flashNotice ? (
        <div
          style={{
            padding: '10px 20px',
            borderBottom: `1px solid ${flashNoticeStyles[flashNotice.kind].border}`,
            background: flashNoticeStyles[flashNotice.kind].bg,
            color: flashNoticeStyles[flashNotice.kind].text,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{flashNotice.title}</div>
            <div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>{flashNotice.message}</div>
          </div>
          <button
            type="button"
            onClick={() => setFlashNotice(null)}
            style={{
              border: 'none',
              background: 'transparent',
              color: flashNoticeStyles[flashNotice.kind].text,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              padding: 0,
            }}
          >
            Закрыть
          </button>
        </div>
      ) : null}
      <WorkspaceTopNav
        activeNav={routeActiveNav}
        setActiveNav={setManualActiveNav}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        userName={userName}
        userEmail={userEmail}
        avatarUrl={avatarUrl}
        chatUnreadCount={chatUnreadCount}
        accessToken={sessionStore.getTokens()?.accessToken}
      />
    </>
  )

  return (
    <CallManagerProvider
      currentUserId={currentUserId}
      currentUserName={userName}
      realtimeClient={notificationRealtimeClient}
      sessionStore={sessionStore}
    >
      <>
        <TopNavLayout
          background="linear-gradient(135deg, #F4F9FF 0%, #EEF6FF 38%, #F7FBFF 68%, #EAF4FF 100%)"
          fontFamily="'Inter', sans-serif"
          outletContext={{
            activeNav: routeActiveNav,
            setActiveNav: setManualActiveNav,
            dashboardData,
            userEmail,
            workspaceBootstrapReady: isNotificationsBootstrapped,
          }}
          topNav={isTablet || isEmbedded ? null : topNav}
        />
        {globalToasts.length > 0 ? (
          <div className="pointer-events-none fixed right-4 top-16 z-[9999] flex w-[min(460px,calc(100vw-2rem))] flex-col gap-2">
            {globalToasts.map((toast) => (
              <div key={toast.id} className="pointer-events-auto">
                <AppToast
                  message={toast.subtitle}
                  title={toast.title}
                  subtitle={toast.subtitle}
                  variant={toast.variant}
                  icon={toast.icon}
                  floating={false}
                  onClose={() => handleCloseGlobalToast(toast.id)}
                />
              </div>
            ))}
          </div>
        ) : null}
      </>
    </CallManagerProvider>
  )
}
