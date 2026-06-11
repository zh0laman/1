import type { CalendarEvent } from '../../../domain/entities/CalendarEvent'
import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class LoadUserCalendarEventsUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(userId: number, fromIso: string, toIso: string): Promise<CalendarEvent[]> {
    return this.calendarRepository.getUserEvents(userId, fromIso, toIso)
  }
}
