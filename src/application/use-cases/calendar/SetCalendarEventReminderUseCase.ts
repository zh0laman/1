import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class SetCalendarEventReminderUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(eventId: string, minutesBefore: number): Promise<void> {
    return this.calendarRepository.setEventReminder(eventId, minutesBefore)
  }
}
