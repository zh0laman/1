import type { CalendarEvent } from '../../../domain/entities/CalendarEvent'
import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class GetCalendarEventDetailsUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(eventId: string): Promise<CalendarEvent> {
    return this.calendarRepository.getEvent(eventId)
  }
}
