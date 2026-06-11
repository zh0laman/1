import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class DeleteCalendarEventReminderUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(eventId: string): Promise<void> {
    return this.calendarRepository.deleteEventReminder(eventId)
  }
}
