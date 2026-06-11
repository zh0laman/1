import type { NotificationRepository } from '../../../domain/repositories/NotificationRepository'

export class MarkAllNotificationsReadUseCase {
  private readonly repository: NotificationRepository

  constructor(repository: NotificationRepository) {
    this.repository = repository
  }

  async execute(): Promise<void> {
    await this.repository.markAllAsRead()
  }
}
