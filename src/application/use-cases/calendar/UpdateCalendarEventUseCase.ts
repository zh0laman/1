import type { CalendarEvent, UpdateCalendarEventPayload } from '../../../domain/entities/CalendarEvent'
import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class UpdateCalendarEventUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(eventId: string, payload: UpdateCalendarEventPayload): Promise<CalendarEvent> {
    return this.calendarRepository.updateEvent(eventId, payload)
  }
}
