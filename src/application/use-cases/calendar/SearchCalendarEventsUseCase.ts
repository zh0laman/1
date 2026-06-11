import type { CalendarEvent, CalendarSearchParams } from '../../../domain/entities/CalendarEvent'
import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class SearchCalendarEventsUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(params: CalendarSearchParams): Promise<CalendarEvent[]> {
    return this.calendarRepository.searchEvents(params)
  }
}
