import type { CalendarEvent } from '../../../domain/entities/CalendarEvent'
import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class LoadCalendarEventsUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(fromIso: string, toIso: string): Promise<CalendarEvent[]> {
    return this.calendarRepository.getMyEvents(fromIso, toIso)
  }
}
