import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'
import type { CalendarRespondStatus } from '../../../domain/entities/CalendarEvent'

export class RespondCalendarInviteUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(eventId: string, status: CalendarRespondStatus, comment?: string): Promise<void> {
    return this.calendarRepository.respondToEvent(eventId, status, comment)
  }
}
