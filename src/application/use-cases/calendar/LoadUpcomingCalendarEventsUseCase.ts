import type { CalendarEvent } from '../../../domain/entities/CalendarEvent'
import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class LoadUpcomingCalendarEventsUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(limit?: number): Promise<CalendarEvent[]> {
    return this.calendarRepository.getUpcomingEvents(limit)
  }
}
