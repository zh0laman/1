import type { NotificationItem } from '../../../domain/entities/Notification'
import type { NotificationRepository } from '../../../domain/repositories/NotificationRepository'

export class GetNotificationsUseCase {
  private readonly repository: NotificationRepository

  constructor(repository: NotificationRepository) {
    this.repository = repository
  }

  async execute(limit = 20, offset = 0): Promise<NotificationItem[]> {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20
    const normalizedOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0
    return this.repository.getNotifications(normalizedLimit, normalizedOffset)
  }
}
