import { BatchCreateCalendarEventsUseCase } from '../../application/use-cases/calendar/BatchCreateCalendarEventsUseCase'
import { CreateCalendarEventUseCase } from '../../application/use-cases/calendar/CreateCalendarEventUseCase'
import { DeleteCalendarEventReminderUseCase } from '../../application/use-cases/calendar/DeleteCalendarEventReminderUseCase'
import { DeleteCalendarEventUseCase } from '../../application/use-cases/calendar/DeleteCalendarEventUseCase'
import { GetCalendarEventDetailsUseCase } from '../../application/use-cases/calendar/GetCalendarEventDetailsUseCase'
import { LoadCalendarEventsUseCase } from '../../application/use-cases/calendar/LoadCalendarEventsUseCase'
import { LoadCalendarHostUseCase } from '../../application/use-cases/calendar/LoadCalendarHostUseCase'
import { LoadCalendarTodaySummaryUseCase } from '../../application/use-cases/calendar/LoadCalendarTodaySummaryUseCase'
import { LoadCalendarUsersUseCase } from '../../application/use-cases/calendar/LoadCalendarUsersUseCase'
import { LoadThisWeekCalendarEventsUseCase } from '../../application/use-cases/calendar/LoadThisWeekCalendarEventsUseCase'
import { LoadUpcomingCalendarEventsUseCase } from '../../application/use-cases/calendar/LoadUpcomingCalendarEventsUseCase'
import { LoadUserCalendarEventUseCase } from '../../application/use-cases/calendar/LoadUserCalendarEventUseCase'
import { LoadUserCalendarEventsUseCase } from '../../application/use-cases/calendar/LoadUserCalendarEventsUseCase'
import { RespondCalendarInviteUseCase } from '../../application/use-cases/calendar/RespondCalendarInviteUseCase'
import { SearchCalendarEventsUseCase } from '../../application/use-cases/calendar/SearchCalendarEventsUseCase'
import { SetCalendarEventReminderUseCase } from '../../application/use-cases/calendar/SetCalendarEventReminderUseCase'
import { UpdateCalendarEventUseCase } from '../../application/use-cases/calendar/UpdateCalendarEventUseCase'
import type {
  CalendarAvailabilityRequest,
  CalendarAvailabilityResponse,
  BatchCreateCalendarEventsPayload,
  CalendarBatchCreateResult,
  CalendarEvent,
  CalendarRespondStatus,
  CalendarSearchParams,
  CalendarSelectableUser,
  CalendarSuggestedSlot,
  CalendarSuggestTimesRequest,
  CalendarTodaySummary,
  CreateCalendarEventPayload,
  UpdateCalendarEventPayload,
} from '../../domain/entities/CalendarEvent'
import type { CalendarViewModel } from '../view-models/CalendarViewModel'
import { toCalendarEventViewModel, toCalendarViewModel } from '../view-models/CalendarViewModel'

export interface CalendarLoadParams {
  fromIso: string
  toIso: string
  userId?: number
  force?: boolean
}

export interface CalendarLoadResult {
  viewModel: CalendarViewModel
  hostError: string
  eventsError: string
}

interface CachedLoad {
  at: number
  value: CalendarLoadResult
}

export class CalendarController {
  private static readonly cacheTtlMs = 15_000
  private static cache = new Map<string, CachedLoad>()
  private static inFlight = new Map<string, Promise<CalendarLoadResult>>()

  private readonly loadCalendarEventsUseCase: LoadCalendarEventsUseCase
  private readonly loadUserCalendarEventsUseCase: LoadUserCalendarEventsUseCase
  private readonly loadCalendarHostUseCase: LoadCalendarHostUseCase
  private readonly getCalendarEventDetailsUseCase: GetCalendarEventDetailsUseCase
  private readonly createCalendarEventUseCase: CreateCalendarEventUseCase
  private readonly updateCalendarEventUseCase: UpdateCalendarEventUseCase
  private readonly deleteCalendarEventUseCase: DeleteCalendarEventUseCase
  private readonly searchCalendarEventsUseCase: SearchCalendarEventsUseCase
  private readonly loadThisWeekCalendarEventsUseCase: LoadThisWeekCalendarEventsUseCase
  private readonly loadUpcomingCalendarEventsUseCase: LoadUpcomingCalendarEventsUseCase
  private readonly setCalendarEventReminderUseCase: SetCalendarEventReminderUseCase
  private readonly deleteCalendarEventReminderUseCase: DeleteCalendarEventReminderUseCase
  private readonly respondCalendarInviteUseCase: RespondCalendarInviteUseCase
  private readonly batchCreateCalendarEventsUseCase: BatchCreateCalendarEventsUseCase
  private readonly loadCalendarTodaySummaryUseCase: LoadCalendarTodaySummaryUseCase
  private readonly loadUserCalendarEventUseCase: LoadUserCalendarEventUseCase
  private readonly loadCalendarUsersUseCase: LoadCalendarUsersUseCase

  constructor(
    loadCalendarEventsUseCase: LoadCalendarEventsUseCase,
    loadUserCalendarEventsUseCase: LoadUserCalendarEventsUseCase,
    loadCalendarHostUseCase: LoadCalendarHostUseCase,
    getCalendarEventDetailsUseCase: GetCalendarEventDetailsUseCase,
    createCalendarEventUseCase: CreateCalendarEventUseCase,
    updateCalendarEventUseCase: UpdateCalendarEventUseCase,
    deleteCalendarEventUseCase: DeleteCalendarEventUseCase,
    searchCalendarEventsUseCase: SearchCalendarEventsUseCase,
    loadThisWeekCalendarEventsUseCase: LoadThisWeekCalendarEventsUseCase,
    loadUpcomingCalendarEventsUseCase: LoadUpcomingCalendarEventsUseCase,
    setCalendarEventReminderUseCase: SetCalendarEventReminderUseCase,
    deleteCalendarEventReminderUseCase: DeleteCalendarEventReminderUseCase,
    respondCalendarInviteUseCase: RespondCalendarInviteUseCase,
    batchCreateCalendarEventsUseCase: BatchCreateCalendarEventsUseCase,
    loadCalendarTodaySummaryUseCase: LoadCalendarTodaySummaryUseCase,
    loadUserCalendarEventUseCase: LoadUserCalendarEventUseCase,
    loadCalendarUsersUseCase: LoadCalendarUsersUseCase,
  ) {
    this.loadCalendarEventsUseCase = loadCalendarEventsUseCase
    this.loadUserCalendarEventsUseCase = loadUserCalendarEventsUseCase
    this.loadCalendarHostUseCase = loadCalendarHostUseCase
    this.getCalendarEventDetailsUseCase = getCalendarEventDetailsUseCase
    this.createCalendarEventUseCase = createCalendarEventUseCase
    this.updateCalendarEventUseCase = updateCalendarEventUseCase
    this.deleteCalendarEventUseCase = deleteCalendarEventUseCase
    this.searchCalendarEventsUseCase = searchCalendarEventsUseCase
    this.loadThisWeekCalendarEventsUseCase = loadThisWeekCalendarEventsUseCase
    this.loadUpcomingCalendarEventsUseCase = loadUpcomingCalendarEventsUseCase
    this.setCalendarEventReminderUseCase = setCalendarEventReminderUseCase
    this.deleteCalendarEventReminderUseCase = deleteCalendarEventReminderUseCase
    this.respondCalendarInviteUseCase = respondCalendarInviteUseCase
    this.batchCreateCalendarEventsUseCase = batchCreateCalendarEventsUseCase
    this.loadCalendarTodaySummaryUseCase = loadCalendarTodaySummaryUseCase
    this.loadUserCalendarEventUseCase = loadUserCalendarEventUseCase
    this.loadCalendarUsersUseCase = loadCalendarUsersUseCase
  }

  invalidateCache(): void {
    CalendarController.cache.clear()
    CalendarController.inFlight.clear()
  }

  async loadPage(params: CalendarLoadParams): Promise<CalendarLoadResult> {
    const { fromIso, toIso, userId, force = false } = params
    const key = `${userId ?? 'me'}:${fromIso}:${toIso}`
    const now = Date.now()

    if (!force) {
      const cached = CalendarController.cache.get(key)
      if (cached && now - cached.at < CalendarController.cacheTtlMs) {
        return cached.value
      }

      const inFlight = CalendarController.inFlight.get(key)
      if (inFlight) {
        return inFlight
      }
    }

    const request = this.performLoad(fromIso, toIso, userId)
      .then((result) => {
        CalendarController.cache.set(key, {
          at: Date.now(),
          value: result,
        })
        return result
      })
      .finally(() => {
        CalendarController.inFlight.delete(key)
      })

    CalendarController.inFlight.set(key, request)
    return request
  }

  async getEvent(eventId: string): Promise<CalendarEvent> {
    return this.getCalendarEventDetailsUseCase.execute(eventId)
  }

  async getUserEvent(userId: number, eventId: string): Promise<CalendarEvent> {
    return this.loadUserCalendarEventUseCase.execute(userId, eventId)
  }

  async createEvent(payload: CreateCalendarEventPayload, options?: { force?: boolean }): Promise<CalendarEvent> {
    const event = await this.createCalendarEventUseCase.execute(payload, options)
    this.invalidateCache()
    return event
  }

  async checkAvailability(payload: CalendarAvailabilityRequest): Promise<CalendarAvailabilityResponse> {
    return this.createCalendarEventUseCase.checkAvailability(payload)
  }

  async suggestTimes(payload: CalendarSuggestTimesRequest): Promise<CalendarSuggestedSlot[]> {
    return this.createCalendarEventUseCase.suggestTimes(payload)
  }

  async updateEvent(eventId: string, payload: UpdateCalendarEventPayload): Promise<CalendarEvent> {
    const event = await this.updateCalendarEventUseCase.execute(eventId, payload)
    this.invalidateCache()
    return event
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.deleteCalendarEventUseCase.execute(eventId)
    this.invalidateCache()
  }

  async searchEvents(params: CalendarSearchParams): Promise<CalendarEvent[]> {
    return this.searchCalendarEventsUseCase.execute(params)
  }

  async loadThisWeekEvents(timezoneOffsetMinutes?: number): Promise<CalendarEvent[]> {
    return this.loadThisWeekCalendarEventsUseCase.execute(timezoneOffsetMinutes)
  }

  async loadUpcomingEvents(limit?: number): Promise<CalendarEvent[]> {
    return this.loadUpcomingCalendarEventsUseCase.execute(limit)
  }

  async setReminder(eventId: string, minutesBefore: number): Promise<void> {
    await this.setCalendarEventReminderUseCase.execute(eventId, minutesBefore)
    this.invalidateCache()
  }

  async deleteReminder(eventId: string): Promise<void> {
    await this.deleteCalendarEventReminderUseCase.execute(eventId)
    this.invalidateCache()
  }

  async respondInvite(eventId: string, status: CalendarRespondStatus, comment?: string): Promise<void> {
    await this.respondCalendarInviteUseCase.execute(eventId, status, comment)
    this.invalidateCache()
  }

  async batchCreateEvents(payload: BatchCreateCalendarEventsPayload): Promise<CalendarBatchCreateResult> {
    const result = await this.batchCreateCalendarEventsUseCase.execute(payload)
    this.invalidateCache()
    return result
  }

  async loadTodaySummary(timezoneOffsetMinutes?: number): Promise<CalendarTodaySummary> {
    return this.loadCalendarTodaySummaryUseCase.execute(timezoneOffsetMinutes)
  }

  async loadUsers(query?: string): Promise<CalendarSelectableUser[]> {
    return this.loadCalendarUsersUseCase.execute(query)
  }

  toEventViewModel(event: CalendarEvent, viewerId?: number | null) {
    return toCalendarEventViewModel(event, viewerId)
  }

  private async performLoad(fromIso: string, toIso: string, userId?: number): Promise<CalendarLoadResult> {
    const [hostResult, eventsResult] = await Promise.allSettled([
      this.loadCalendarHostUseCase.execute(),
      typeof userId === 'number'
        ? this.loadUserCalendarEventsUseCase.execute(userId, fromIso, toIso)
        : this.loadCalendarEventsUseCase.execute(fromIso, toIso),
    ])

    const host = hostResult.status === 'fulfilled' ? hostResult.value : null
    const events = eventsResult.status === 'fulfilled' ? eventsResult.value : []

    return {
      viewModel: toCalendarViewModel(host, events),
      hostError: hostResult.status === 'rejected' ? 'Не удалось загрузить данные пользователя.' : '',
      eventsError: eventsResult.status === 'rejected' ? 'Не удалось загрузить события календаря.' : '',
    }
  }
}
