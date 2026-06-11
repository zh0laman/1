import type { NotificationRepository } from '../../../domain/repositories/NotificationRepository'

export class MarkNotificationReadUseCase {
  private readonly repository: NotificationRepository

  constructor(repository: NotificationRepository) {
    this.repository = repository
  }

  async execute(notificationId: string): Promise<void> {
    await this.repository.markAsRead(notificationId)
  }
}
