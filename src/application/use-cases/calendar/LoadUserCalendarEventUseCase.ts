import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'
import type { CalendarEvent } from '../../../domain/entities/CalendarEvent'

export class LoadUserCalendarEventUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(userId: number, eventId: string): Promise<CalendarEvent> {
    return this.calendarRepository.getUserEvent(userId, eventId)
  }
}
