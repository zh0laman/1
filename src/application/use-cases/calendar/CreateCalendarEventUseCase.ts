import type {
  CalendarAvailabilityRequest,
  CalendarAvailabilityResponse,
  CalendarEvent,
  CalendarSuggestedSlot,
  CalendarSuggestTimesRequest,
  CreateCalendarEventPayload,
} from '../../../domain/entities/CalendarEvent'
import type { CalendarRepository } from '../../../domain/repositories/CalendarRepository'

export class CreateCalendarEventUseCase {
  private readonly calendarRepository: CalendarRepository

  constructor(calendarRepository: CalendarRepository) {
    this.calendarRepository = calendarRepository
  }

  async execute(payload: CreateCalendarEventPayload, options?: { force?: boolean }): Promise<CalendarEvent> {
    return this.calendarRepository.createEvent(payload, options)
  }

  async checkAvailability(payload: CalendarAvailabilityRequest): Promise<CalendarAvailabilityResponse> {
    return this.calendarRepository.checkAvailability(payload)
  }

  async suggestTimes(payload: CalendarSuggestTimesRequest): Promise<CalendarSuggestedSlot[]> {
    return this.calendarRepository.suggestTimes(payload)
  }
}
