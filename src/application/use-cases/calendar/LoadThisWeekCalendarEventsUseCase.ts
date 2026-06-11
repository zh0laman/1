import type { CalendarEvent } from '../../../domain/entities/CalendarEvent'
import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class LoadThisWeekCalendarEventsUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(timezoneOffsetMinutes?: number): Promise<CalendarEvent[]> {
    return this.calendarRepository.getThisWeekEvents(timezoneOffsetMinutes)
  }
}
