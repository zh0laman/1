import type { BatchCreateCalendarEventsPayload, CalendarBatchCreateResult } from '../../../domain/entities/CalendarEvent'
import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class BatchCreateCalendarEventsUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(payload: BatchCreateCalendarEventsPayload): Promise<CalendarBatchCreateResult> {
    return this.calendarRepository.batchCreateEvents(payload)
  }
}
