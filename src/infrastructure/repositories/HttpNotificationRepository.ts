import type { CallHistoryItem, NotificationItem } from '../../domain/entities/Notification'
import type { NotificationRepository } from '../../domain/repositories/NotificationRepository'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import { HttpError } from '../http/HttpError'
import { authorizedFetch } from '../http/authorizedFetch'
import { normalizeNotificationRestItem } from '../notifications/payloadAdapters'

interface NotificationDto {
  id: string
  user_id?: number
  userId?: number
  organizer_id?: number | null
  organizerId?: number | null
  type?: string
  title?: string
  content?: string
  message_text?: string
  messageText?: string
  short_text?: string
  shortText?: string
  source_system_code?: string
  sourceSystemCode?: string
  source_system_name?: string
  sourceSystemName?: string
  notification_type?: string
  notificationType?: string
  status?: string
  external_message_id?: string
  externalMessageId?: string
  application_number?: string
  applicationNumber?: string
  action_url?: string
  actionUrl?: string
  is_read?: boolean
  isRead?: boolean
  metadata?: Record<string, unknown>
  created_at?: string
  createdAt?: string
  processed_at?: string
  processedAt?: string
}

interface CallHistoryDto {
  id: string
  call_id: string
  from_user_id: number
  to_user_id: number
  room_id?: string
  room_name?: string
  participants_count?: number
  chat_id?: string
  from_name?: string
  status?: string
  created_at: string
  updated_at: string
  ended_at?: string
}

const pickString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
  }
  return ''
}

const mapNotification = (value: NotificationDto): NotificationItem => ({
  id: value.id,
  userId: Number(value.user_id ?? value.userId ?? 0),
  organizerId:
    typeof value.organizer_id === 'number'
      ? value.organizer_id
      : typeof value.organizerId === 'number'
        ? value.organizerId
        : null,
  type: value.type ?? '',
  title: value.title ?? '',
  content: pickString(value.message_text, value.messageText, value.content),
  shortText: pickString(value.short_text, value.shortText),
  messageText: pickString(value.message_text, value.messageText, value.content),
  sourceSystemCode: pickString(value.source_system_code, value.sourceSystemCode),
  sourceSystemName: pickString(value.source_system_name, value.sourceSystemName),
  notificationType: pickString(value.notification_type, value.notificationType, value.type),
  status: pickString(value.status),
  externalMessageId: pickString(value.external_message_id, value.externalMessageId),
  applicationNumber: pickString(value.application_number, value.applicationNumber),
  actionUrl: pickString(value.action_url, value.actionUrl),
  isRead: Boolean(value.is_read ?? value.isRead),
  metadata: value.metadata ?? {},
  createdAt: pickString(value.created_at, value.createdAt),
  processedAt: pickString(value.processed_at, value.processedAt),
})

const mapCall = (value: CallHistoryDto): CallHistoryItem => ({
  id: value.id,
  callId: value.call_id,
  fromUserId: Number(value.from_user_id ?? 0),
  toUserId: Number(value.to_user_id ?? 0),
  roomId: value.room_id ?? value.room_name ?? '',
  roomName: value.room_name ?? value.room_id ?? '',
  participantsCount: Number(value.participants_count ?? 0),
  chatId: value.chat_id ?? '',
  fromName: value.from_name ?? '',
  status: value.status ?? '',
  createdAt: value.created_at ?? '',
  updatedAt: value.updated_at ?? '',
  endedAt: value.ended_at ?? '',
})

export class HttpNotificationRepository implements NotificationRepository {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  async getNotifications(limit: number, offset: number): Promise<NotificationItem[]> {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20
    const normalizedOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0
    const response = await this.fetchWithNotificationErrors(`/api/v1/notifications?limit=${normalizedLimit}&offset=${normalizedOffset}`)
    const raw = (await response.json()) as NotificationDto[] | { data?: NotificationDto[] }
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []
    return list
      .map((item) => normalizeNotificationRestItem(item))
      .map((item) => mapNotification(item as unknown as NotificationDto))
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.fetchWithNotificationErrors(`/api/v1/notifications/${notificationId}/read`, { method: 'POST' })
  }

  async markAllAsRead(): Promise<void> {
    await this.fetchWithNotificationErrors('/api/v1/notifications/read-all', { method: 'POST' })
  }

  async getCalls(limit: number, offset: number, kind = 'all'): Promise<CallHistoryItem[]> {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20
    const normalizedOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0
    const queryKind = kind || 'all'
    const response = await this.fetchWithNotificationErrors(`/api/v1/calls?limit=${normalizedLimit}&offset=${normalizedOffset}&kind=${encodeURIComponent(queryKind)}`)
    const raw = (await response.json()) as CallHistoryDto[] | { data?: CallHistoryDto[] }
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []
    return list.map(mapCall)
  }

  private async fetchWithNotificationErrors(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await authorizedFetch(this.sessionStore, path, init)
    } catch (error) {
      if (error instanceof HttpError) {
        throw error
      }

      throw error
    }
  }
}
