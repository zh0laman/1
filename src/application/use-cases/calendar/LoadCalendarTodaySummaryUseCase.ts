import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'
import type { CalendarTodaySummary } from '../../../domain/entities/CalendarEvent'

export class LoadCalendarTodaySummaryUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(timezoneOffsetMinutes?: number): Promise<CalendarTodaySummary> {
    return this.calendarRepository.getTodaySummary(timezoneOffsetMinutes)
  }
}
