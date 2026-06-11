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
import { HttpCalendarRepository } from '../../infrastructure/repositories/HttpCalendarRepository'
import { LocalStorageAuthSessionStore } from '../../infrastructure/storage/LocalStorageAuthSessionStore'
import { CalendarController } from '../controllers/CalendarController'

export const createCalendarController = () => {
  const sessionStore = new LocalStorageAuthSessionStore()
  const calendarRepository = new HttpCalendarRepository(sessionStore)

  const loadCalendarEventsUseCase = new LoadCalendarEventsUseCase(calendarRepository)
  const loadUserCalendarEventsUseCase = new LoadUserCalendarEventsUseCase(calendarRepository)
  const loadCalendarHostUseCase = new LoadCalendarHostUseCase(calendarRepository)
  const loadCalendarUsersUseCase = new LoadCalendarUsersUseCase(calendarRepository)
  const getCalendarEventDetailsUseCase = new GetCalendarEventDetailsUseCase(calendarRepository)
  const createCalendarEventUseCase = new CreateCalendarEventUseCase(calendarRepository)
  const updateCalendarEventUseCase = new UpdateCalendarEventUseCase(calendarRepository)
  const deleteCalendarEventUseCase = new DeleteCalendarEventUseCase(calendarRepository)
  const searchCalendarEventsUseCase = new SearchCalendarEventsUseCase(calendarRepository)
  const loadThisWeekCalendarEventsUseCase = new LoadThisWeekCalendarEventsUseCase(calendarRepository)
  const loadUpcomingCalendarEventsUseCase = new LoadUpcomingCalendarEventsUseCase(calendarRepository)
  const setCalendarEventReminderUseCase = new SetCalendarEventReminderUseCase(calendarRepository)
  const deleteCalendarEventReminderUseCase = new DeleteCalendarEventReminderUseCase(calendarRepository)
  const respondCalendarInviteUseCase = new RespondCalendarInviteUseCase(calendarRepository)
  const batchCreateCalendarEventsUseCase = new BatchCreateCalendarEventsUseCase(calendarRepository)
  const loadCalendarTodaySummaryUseCase = new LoadCalendarTodaySummaryUseCase(calendarRepository)
  const loadUserCalendarEventUseCase = new LoadUserCalendarEventUseCase(calendarRepository)

  const calendarController = new CalendarController(
    loadCalendarEventsUseCase,
    loadUserCalendarEventsUseCase,
    loadCalendarHostUseCase,
    getCalendarEventDetailsUseCase,
    createCalendarEventUseCase,
    updateCalendarEventUseCase,
    deleteCalendarEventUseCase,
    searchCalendarEventsUseCase,
    loadThisWeekCalendarEventsUseCase,
    loadUpcomingCalendarEventsUseCase,
    setCalendarEventReminderUseCase,
    deleteCalendarEventReminderUseCase,
    respondCalendarInviteUseCase,
    batchCreateCalendarEventsUseCase,
    loadCalendarTodaySummaryUseCase,
    loadUserCalendarEventUseCase,
    loadCalendarUsersUseCase,
  )

  return {
    calendarController,
  }
}
