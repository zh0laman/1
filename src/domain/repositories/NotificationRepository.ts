import type { CallHistoryItem, NotificationItem } from '../entities/Notification'

export interface NotificationRepository {
  getNotifications(limit: number, offset: number): Promise<NotificationItem[]>
  markAsRead(notificationId: string): Promise<void>
  markAllAsRead(): Promise<void>
  getCalls(limit: number, offset: number, kind?: 'incoming' | 'outgoing' | 'all' | string): Promise<CallHistoryItem[]>
}
