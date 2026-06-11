import type { CallHistoryItem, NotificationItem } from '../../domain/entities/Notification'
import {
  buildNotificationCompactMeta,
  detectAppLocale,
  formatNotificationDateTime,
  getNotificationFallbackMessage,
  getNotificationFallbackTitle,
  getNotificationIconName,
  getNotificationPreview,
  getNotificationSourceName,
  getNotificationStatusMeta,
} from '../../shared/notifications/notificationPresentation'

export interface NotificationItemViewModel {
  id: string
  type: string
  title: string
  subtitle: string
  preview?: string
  isRead: boolean
  icon: string
  createdAt: string
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

export interface CallHistoryItemViewModel {
  id: string
  callId: string
  roomName: string
  status: string
  fromName: string
  createdAt: string
}

export const toNotificationItemViewModel = (item: NotificationItem): NotificationItemViewModel => {
  const locale = detectAppLocale()
  const title = item.title?.trim() || getNotificationFallbackTitle(item, locale)
  const preview = getNotificationPreview(item, locale)
  const dateLabel = formatNotificationDateTime(item.createdAt, locale)
  const sourceName = getNotificationSourceName(item)
  const statusMeta = getNotificationStatusMeta(item.status, locale)
  const fullMessage = getNotificationFallbackMessage(item, locale)

  return {
    id: item.id,
    type: item.type,
    title,
    subtitle: buildNotificationCompactMeta(preview, sourceName, item.createdAt, locale),
    preview,
    isRead: item.isRead,
    icon: getNotificationIconName(item),
    createdAt: item.createdAt,
    dateLabel,
    sourceName,
    sourceSystemCode: item.sourceSystemCode,
    status: item.status,
    statusLabel: statusMeta?.label,
    statusTone: statusMeta?.tone,
    actionUrl: item.actionUrl,
    fullMessage,
    notificationType: item.notificationType,
    externalMessageId: item.externalMessageId,
    applicationNumber: item.applicationNumber,
    processedAt: item.processedAt,
    metadata: item.metadata,
  }
}

export const toCallHistoryItemViewModel = (item: CallHistoryItem): CallHistoryItemViewModel => ({
  id: item.id,
  callId: item.callId,
  roomName: item.roomName || item.roomId,
  status: item.status,
  fromName: item.fromName || `User ${item.fromUserId}`,
  createdAt: item.createdAt,
})
