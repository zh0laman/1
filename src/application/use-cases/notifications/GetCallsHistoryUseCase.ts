import type { CallHistoryItem } from '../../../domain/entities/Notification'
import type { NotificationRepository } from '../../../domain/repositories/NotificationRepository'

export class GetCallsHistoryUseCase {
  private readonly repository: NotificationRepository

  constructor(repository: NotificationRepository) {
    this.repository = repository
  }

  async execute(params?: { limit?: number; offset?: number; kind?: 'incoming' | 'outgoing' | 'all' | string }): Promise<CallHistoryItem[]> {
    const limit = Number.isFinite(params?.limit) ? Math.max(1, Math.trunc(params?.limit as number)) : 20
    const offset = Number.isFinite(params?.offset) ? Math.max(0, Math.trunc(params?.offset as number)) : 0
    const kind = params?.kind ?? 'all'
    return this.repository.getCalls(limit, offset, kind)
  }
}
