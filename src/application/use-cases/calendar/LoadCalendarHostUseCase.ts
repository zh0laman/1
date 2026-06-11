import type { CalendarHostUser } from '../../../domain/entities/CalendarHostUser'
import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class LoadCalendarHostUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(): Promise<CalendarHostUser> {
    return this.calendarRepository.getCurrentHostUser()
  }
}
