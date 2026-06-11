import { GetCallsHistoryUseCase } from '../../application/use-cases/notifications/GetCallsHistoryUseCase'
import { GetNotificationsUseCase } from '../../application/use-cases/notifications/GetNotificationsUseCase'
import { MarkAllNotificationsReadUseCase } from '../../application/use-cases/notifications/MarkAllNotificationsReadUseCase'
import { MarkNotificationReadUseCase } from '../../application/use-cases/notifications/MarkNotificationReadUseCase'
import type { CallHistoryItemViewModel, NotificationItemViewModel } from '../view-models/NotificationViewModel'
import { toCallHistoryItemViewModel, toNotificationItemViewModel } from '../view-models/NotificationViewModel'

interface CachedNotifications {
  atMs: number
  value: NotificationItemViewModel[]
}

export class NotificationController {
  private static readonly cacheTtlMs = 15_000
  private static notificationsCache: CachedNotifications | null = null
  private static notificationsInFlight: Promise<NotificationItemViewModel[]> | null = null

  private readonly getNotificationsUseCase: GetNotificationsUseCase
  private readonly markNotificationReadUseCase: MarkNotificationReadUseCase
  private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase
  private readonly getCallsHistoryUseCase: GetCallsHistoryUseCase

  constructor(
    getNotificationsUseCase: GetNotificationsUseCase,
    markNotificationReadUseCase: MarkNotificationReadUseCase,
    markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
    getCallsHistoryUseCase: GetCallsHistoryUseCase,
  ) {
    this.getNotificationsUseCase = getNotificationsUseCase
    this.markNotificationReadUseCase = markNotificationReadUseCase
    this.markAllNotificationsReadUseCase = markAllNotificationsReadUseCase
    this.getCallsHistoryUseCase = getCallsHistoryUseCase
  }

  async loadNotifications(params?: { limit?: number; offset?: number; force?: boolean }): Promise<NotificationItemViewModel[]> {
    const force = params?.force ?? false
    const now = Date.now()

    if (!force && NotificationController.notificationsCache && now - NotificationController.notificationsCache.atMs < NotificationController.cacheTtlMs) {
      return NotificationController.notificationsCache.value
    }

    if (!force && NotificationController.notificationsInFlight) {
      return NotificationController.notificationsInFlight
    }

    const request = this.getNotificationsUseCase
      .execute(params?.limit, params?.offset)
      .then((items) => items.map(toNotificationItemViewModel))
      .then((items) => {
        NotificationController.notificationsCache = {
          atMs: Date.now(),
          value: items,
        }
        return items
      })
      .finally(() => {
        NotificationController.notificationsInFlight = null
      })

    NotificationController.notificationsInFlight = request
    return request
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.markNotificationReadUseCase.execute(notificationId)
    NotificationController.notificationsCache = null
  }

  async markAllAsRead(): Promise<void> {
    await this.markAllNotificationsReadUseCase.execute()
    NotificationController.notificationsCache = null
  }

  async loadCalls(params?: { limit?: number; offset?: number; kind?: 'incoming' | 'outgoing' | 'all' | string }): Promise<CallHistoryItemViewModel[]> {
    const items = await this.getCallsHistoryUseCase.execute(params)
    return items.map(toCallHistoryItemViewModel)
  }
}
