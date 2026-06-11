import type {
  CalendarAvailabilityRequest,
  CalendarAvailabilityResponse,
  CalendarConflictItem,
  CalendarSuggestedSlot,
  CalendarSuggestTimesRequest,
  BatchCreateCalendarEventsPayload,
  CalendarAttendee,
  CalendarAttendeeUser,
  CalendarBatchConflict,
  CalendarBatchCreateResult,
  CalendarEvent,
  CalendarRespondStatus,
  CalendarRsvpStatus,
  CalendarSearchParams,
  CalendarSelectableUser,
  CalendarTodaySummary,
  CalendarTodayTaskSummary,
  CreateCalendarEventPayload,
  UpdateCalendarEventPayload,
} from "../../domain/entities/CalendarEvent";
import type { CalendarHostUser } from "../../domain/entities/CalendarHostUser";
import type { CalendarRepository } from "../../domain/repositories/CalendarRepository";
import type { AuthSessionStore } from "../../domain/services/AuthSessionStore";
import { authorizedFetch } from "../http/authorizedFetch";
import { normalizeBackendAssetUrl } from "../http/normalizeBackendAssetUrl";

interface EventAttendeeUserDto {
  id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string | null;
  availability_status?: string;
  position?: string;
  username?: string;
}

interface EventAttendeeDto {
  user_id?: number;
  status?: string;
  comment?: string;
  created_at?: string;
  updated_at?: string;
  event_id?: string;
  user?: EventAttendeeUserDto | null;
}

interface CalendarEventDto {
  id: string | number;
  title?: string;
  description?: string | null;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  start_time?: string;
  end_time?: string;
  location?: string | null;
  is_all_day?: boolean;
  is_online?: boolean;
  color?: string | null;
  attendees?: EventAttendeeDto[];
  is_organizer?: boolean;
  reminder_minutes?: number | null;
  recurrence_interval?: number | null;
  recurrence_rule?: string | null;
  recurrence_until?: string | null;
  created_at?: string;
  updated_at?: string;
  user_id?: number | null;
  user_name?: string | null;
  meeting_provider?: string | null;
  meeting_room_id?: string | null;
  meeting_url?: string | null;
  livekit_room_name?: string | null;
  cisco_meeting_id?: string | null;
  cisco_join_url?: string | null;
  online_meeting_status?: string | null;
}

interface MeDto {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string | null;
}

interface CalendarTodayTaskSummaryDto {
  id?: string;
  title?: string;
  board_id?: string;
  column_id?: string;
  due_at?: string;
  priority?: string;
  status?: string;
}

interface CalendarTodaySummaryDto {
  events?: CalendarEventDto[];
  events_count?: number;
  tasks?: CalendarTodayTaskSummaryDto[];
  tasks_count?: number;
}

interface ApiErrorDetailsDto {
  conflicts?: Array<{
    mail?: string;
    reason?: string;
    user_id?: number;
    user_name?: string;
    event_id?: string;
    event_title?: string;
    start_time?: string;
    end_time?: string;
  }>;
  suggested_slots?: Array<{
    start_time?: string;
    end_time?: string;
    available_user_ids?: number[];
  }>;
}

interface ApiErrorDto {
  error?: string;
  message?: string;
  detail?: string;
  details?: ApiErrorDetailsDto;
}

interface CalendarUserDto {
  id?: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

const fallbackColor = "#1E88E5";
const defaultRsvpStatus: CalendarRsvpStatus = "needs_action";

const toRfc3339NoMillis = (value: string): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toISOString().replace(".000Z", "Z");
};

const isCalendarRsvpStatus = (value: string): value is CalendarRsvpStatus => {
  return (
    value === "accepted" ||
    value === "declined" ||
    value === "tentative" ||
    value === "needs_action"
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const toRsvpStatus = (value: string | undefined): CalendarRsvpStatus => {
  if (!value) return defaultRsvpStatus;
  const normalized = value.trim().toLowerCase();
  return isCalendarRsvpStatus(normalized) ? normalized : defaultRsvpStatus;
};

export class HttpCalendarRepository implements CalendarRepository {
  private readonly sessionStore: AuthSessionStore;

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore;
  }

  async getMyEvents(fromIso: string, toIso: string): Promise<CalendarEvent[]> {
    const query = new URLSearchParams({ from: fromIso, to: toIso }).toString();
    return this.requestEvents([
      `/api/v1/calendar/events?${query}`,
      `/api/calendar/events?${query}`,
      `/calendar/events?${query}`,
    ]);
  }

  async getUserEvents(
    userId: number,
    fromIso: string,
    toIso: string,
  ): Promise<CalendarEvent[]> {
    const query = new URLSearchParams({ from: fromIso, to: toIso }).toString();
    return this.requestEvents([
      `/api/v1/calendar/users/${userId}/events?${query}`,
      `/api/calendar/users/${userId}/events?${query}`,
      `/calendar/users/${userId}/events?${query}`,
    ]);
  }

  async getUserEvent(userId: number, eventId: string): Promise<CalendarEvent> {
    const data = await this.requestJson<CalendarEventDto>([
      `/api/v1/calendar/users/${userId}/events/${eventId}`,
      `/api/calendar/users/${userId}/events/${eventId}`,
      `/calendar/users/${userId}/events/${eventId}`,
    ]);

    return this.mapEvent(data);
  }

  async getEvent(eventId: string): Promise<CalendarEvent> {
    const data = await this.requestJson<CalendarEventDto>([
      `/api/v1/calendar/events/${eventId}`,
      `/api/calendar/events/${eventId}`,
      `/calendar/events/${eventId}`,
    ]);

    return this.mapEvent(data);
  }

  async createEvent(
    payload: CreateCalendarEventPayload,
    options?: { force?: boolean },
  ): Promise<CalendarEvent> {
    const suffix = options?.force ? "?force=true" : "";
    const data = await this.requestJson<CalendarEventDto>(
      [
        `/api/v1/calendar/events${suffix}`,
        `/api/calendar/events${suffix}`,
        `/calendar/events${suffix}`,
      ],
      {
        method: "POST",
        body: JSON.stringify(this.toEventRequestDto(payload)),
      },
    );

    return this.mapEvent(data);
  }

  async checkAvailability(
    payload: CalendarAvailabilityRequest,
  ): Promise<CalendarAvailabilityResponse> {
    const data = await this.requestJson<{
      is_available?: boolean;
      conflicts?: Array<{
        user_id?: number;
        user_name?: string;
        username?: string;
        email?: string;
        avatar_url?: string | null;
        event_id?: string;
        event_title?: string;
        start_time?: string;
        end_time?: string;
        status?: string;
        overlap_minutes?: number;
      }>;
      conflicts_by_user?: Array<{
        user_id?: number;
        user_name?: string;
        username?: string;
        email?: string;
        avatar_url?: string | null;
        conflicts?: Array<{
          user_id?: number;
          user_name?: string;
          username?: string;
          email?: string;
          avatar_url?: string | null;
          event_id?: string;
          event_title?: string;
          start_time?: string;
          end_time?: string;
          status?: string;
          overlap_minutes?: number;
        }>;
      }>;
      suggested_slots?: Array<{
        start_time?: string;
        end_time?: string;
        timezone?: string;
        score?: number;
        label?: string;
        available_user_ids?: number[];
        conflicted_user_ids?: number[];
      }>;
      partial_suggested_slots?: Array<{
        start_time?: string;
        end_time?: string;
        timezone?: string;
        score?: number;
        label?: string;
        available_user_ids?: number[];
        conflicted_user_ids?: number[];
      }>;
      checked_users_count?: number;
      conflicted_users_count?: number;
      checked_user_ids?: number[];
      organizer_included?: boolean;
    }>(
      [
        "/api/v1/calendar/events/check-availability",
        "/api/calendar/events/check-availability",
        "/calendar/events/check-availability",
      ],
      {
        method: "POST",
        body: JSON.stringify({
          start_time: toRfc3339NoMillis(payload.startTime),
          end_time: toRfc3339NoMillis(payload.endTime),
          attendee_ids: payload.attendeeIds ?? [],
          exclude_event_id: payload.excludeEventId ?? null,
          timezone: payload.timezone,
        }),
      },
    );

    const mapConflict = (item: {
      user_id?: number;
      user_name?: string;
      username?: string;
      email?: string;
      avatar_url?: string | null;
      event_id?: string;
      event_title?: string;
      start_time?: string;
      end_time?: string;
      status?: string;
      overlap_minutes?: number;
    }): CalendarConflictItem => ({
      userId: Number(item.user_id ?? 0),
      userName: item.user_name ?? "",
      username: item.username ?? "",
      email: item.email ?? "",
      avatarUrl: normalizeBackendAssetUrl(item.avatar_url ?? null),
      eventId: item.event_id ?? "",
      eventTitle: item.event_title ?? "",
      startTime: item.start_time ?? "",
      endTime: item.end_time ?? "",
      status: item.status ?? "",
      overlapMinutes: Number(item.overlap_minutes ?? 0),
    });

    return {
      isAvailable: Boolean(data.is_available),
      checkedUsersCount:
        typeof data.checked_users_count === "number"
          ? data.checked_users_count
          : undefined,
      conflictedUsersCount:
        typeof data.conflicted_users_count === "number"
          ? data.conflicted_users_count
          : undefined,
      checkedUserIds: Array.isArray(data.checked_user_ids)
        ? data.checked_user_ids.filter(
            (id): id is number => typeof id === "number",
          )
        : [],
      organizerIncluded:
        typeof data.organizer_included === "boolean"
          ? data.organizer_included
          : undefined,
      conflicts: (data.conflicts ?? []).map(mapConflict),
      conflictsByUser: (data.conflicts_by_user ?? []).map((group) => ({
        userId: Number(group.user_id ?? 0),
        userName: group.user_name ?? "",
        username: group.username ?? "",
        email: group.email ?? "",
        avatarUrl: normalizeBackendAssetUrl(group.avatar_url ?? null),
        conflicts: (group.conflicts ?? []).map(mapConflict),
      })),
      suggestedSlots: (data.suggested_slots ?? []).map(
        (item): CalendarSuggestedSlot => ({
          startTime: item.start_time ?? "",
          endTime: item.end_time ?? "",
          timezone: item.timezone ?? "",
          score: typeof item.score === "number" ? item.score : undefined,
          label: item.label ?? "",
          availableUserIds: Array.isArray(item.available_user_ids)
            ? item.available_user_ids.filter(
                (id): id is number => typeof id === "number",
              )
            : [],
          conflictedUserIds: Array.isArray(item.conflicted_user_ids)
            ? item.conflicted_user_ids.filter(
                (id): id is number => typeof id === "number",
              )
            : [],
        }),
      ),
      partialSuggestedSlots: (data.partial_suggested_slots ?? []).map(
        (item): CalendarSuggestedSlot => ({
          startTime: item.start_time ?? "",
          endTime: item.end_time ?? "",
          timezone: item.timezone ?? "",
          score: typeof item.score === "number" ? item.score : undefined,
          label: item.label ?? "",
          availableUserIds: Array.isArray(item.available_user_ids)
            ? item.available_user_ids.filter(
                (id): id is number => typeof id === "number",
              )
            : [],
          conflictedUserIds: Array.isArray(item.conflicted_user_ids)
            ? item.conflicted_user_ids.filter(
                (id): id is number => typeof id === "number",
              )
            : [],
        }),
      ),
    };
  }

  async suggestTimes(
    payload: CalendarSuggestTimesRequest,
  ): Promise<CalendarSuggestedSlot[]> {
    const data = await this.requestJson<
      Array<{
        start_time?: string;
        end_time?: string;
        timezone?: string;
        score?: number;
        label?: string;
        available_user_ids?: number[];
        conflicted_user_ids?: number[];
      }>
    >(
      [
        "/api/v1/calendar/events/suggest-times",
        "/api/calendar/events/suggest-times",
        "/calendar/events/suggest-times",
      ],
      {
        method: "POST",
        body: JSON.stringify({
          duration_minutes: payload.durationMinutes,
          attendee_ids: payload.attendeeIds ?? [],
          preferred_start: payload.preferredStart
            ? toRfc3339NoMillis(payload.preferredStart)
            : undefined,
          preferred_end: payload.preferredEnd
            ? toRfc3339NoMillis(payload.preferredEnd)
            : undefined,
          timezone: payload.timezone,
          limit: payload.limit,
        }),
      },
    );

    return (data ?? []).map((item) => ({
      startTime: item.start_time ?? "",
      endTime: item.end_time ?? "",
      timezone: item.timezone ?? "",
      score: typeof item.score === "number" ? item.score : undefined,
      label: item.label ?? "",
      availableUserIds: Array.isArray(item.available_user_ids)
        ? item.available_user_ids.filter(
            (id): id is number => typeof id === "number",
          )
        : [],
      conflictedUserIds: Array.isArray(item.conflicted_user_ids)
        ? item.conflicted_user_ids.filter(
            (id): id is number => typeof id === "number",
          )
        : [],
    }));
  }

  async updateEvent(
    eventId: string,
    payload: UpdateCalendarEventPayload,
  ): Promise<CalendarEvent> {
    const data = await this.requestJson<CalendarEventDto>(
      [
        `/api/v1/calendar/events/${eventId}`,
        `/api/calendar/events/${eventId}`,
        `/calendar/events/${eventId}`,
      ],
      {
        method: "PUT",
        body: JSON.stringify(this.toEventRequestDto(payload)),
      },
    );

    return this.mapEvent(data);
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.requestJson<Record<string, string>>(
      [
        `/api/v1/calendar/events/${eventId}`,
        `/api/calendar/events/${eventId}`,
        `/calendar/events/${eventId}`,
      ],
      { method: "DELETE" },
      true,
    );
  }

  async searchEvents(params: CalendarSearchParams): Promise<CalendarEvent[]> {
    const query = new URLSearchParams({
      title: params.title,
      from: params.fromIso,
      to: params.toIso,
      ...(typeof params.limit === "number"
        ? { limit: String(params.limit) }
        : {}),
    }).toString();

    return this.requestEvents([
      `/api/v1/calendar/events/search?${query}`,
      `/api/calendar/events/search?${query}`,
      `/calendar/events/search?${query}`,
    ]);
  }

  async getThisWeekEvents(
    timezoneOffsetMinutes?: number,
  ): Promise<CalendarEvent[]> {
    const query =
      typeof timezoneOffsetMinutes === "number"
        ? `?${new URLSearchParams({ timezone_offset: String(timezoneOffsetMinutes) }).toString()}`
        : "";

    return this.requestEvents([
      `/api/v1/calendar/events/this-week${query}`,
      `/api/calendar/events/this-week${query}`,
      `/calendar/events/this-week${query}`,
    ]);
  }

  async getUpcomingEvents(limit?: number): Promise<CalendarEvent[]> {
    const query =
      typeof limit === "number"
        ? `?${new URLSearchParams({ limit: String(limit) }).toString()}`
        : "";

    return this.requestEvents([
      `/api/v1/calendar/events/upcoming${query}`,
      `/api/calendar/events/upcoming${query}`,
      `/calendar/events/upcoming${query}`,
    ]);
  }

  async setEventReminder(
    eventId: string,
    minutesBefore: number,
  ): Promise<void> {
    await this.requestJson<Record<string, string>>(
      [
        `/api/v1/calendar/events/${eventId}/reminder`,
        `/api/calendar/events/${eventId}/reminder`,
        `/calendar/events/${eventId}/reminder`,
      ],
      {
        method: "PUT",
        body: JSON.stringify({ minutes_before: minutesBefore }),
      },
      true,
    );
  }

  async deleteEventReminder(eventId: string): Promise<void> {
    await this.requestJson<Record<string, string>>(
      [
        `/api/v1/calendar/events/${eventId}/reminder`,
        `/api/calendar/events/${eventId}/reminder`,
        `/calendar/events/${eventId}/reminder`,
      ],
      { method: "DELETE" },
      true,
    );
  }

  async respondToEvent(
    eventId: string,
    status: CalendarRespondStatus,
    comment = "",
  ): Promise<void> {
    await this.requestJson<Record<string, string>>(
      [
        `/api/v1/calendar/events/${eventId}/respond`,
        `/api/calendar/events/${eventId}/respond`,
        `/calendar/events/${eventId}/respond`,
      ],
      {
        method: "POST",
        body: JSON.stringify({ status, comment }),
      },
      true,
    );
  }

  async batchCreateEvents(
    payload: BatchCreateCalendarEventsPayload,
  ): Promise<CalendarBatchCreateResult> {
    try {
      const raw = await this.requestJson<
        CalendarEventDto[] | { events: CalendarEventDto[] }
      >(
        [
          "/api/v1/calendar/events/batch",
          "/api/calendar/events/batch",
          "/calendar/events/batch",
        ],
        {
          method: "POST",
          body: JSON.stringify({
            date_from: payload.dateFrom,
            date_to: payload.dateTo,
            items: payload.items.map((item) => ({
              mail: item.mail,
              meeting_name: item.meetingName,
              meeting_description: item.meetingDescription,
            })),
          }),
        },
      );

      const eventsData = Array.isArray(raw) ? raw : (raw?.events ?? []);

      return {
        events: this.mapEvents(eventsData),
        conflicts: [],
      };
    } catch (error) {
      const conflicts = this.parseBatchConflicts(error);
      if (conflicts.length) {
        return {
          events: [],
          conflicts,
        };
      }
      throw error;
    }
  }

  async getTodaySummary(
    timezoneOffsetMinutes?: number,
  ): Promise<CalendarTodaySummary> {
    const query =
      typeof timezoneOffsetMinutes === "number"
        ? `?${new URLSearchParams({ timezone_offset: String(timezoneOffsetMinutes) }).toString()}`
        : "";

    const data = await this.requestJson<CalendarTodaySummaryDto>([
      `/api/v1/calendar/today${query}`,
      `/api/calendar/today${query}`,
      `/calendar/today${query}`,
    ]);

    return {
      events: this.mapEvents(data.events),
      eventsCount:
        typeof data.events_count === "number" ? data.events_count : 0,
      tasks: this.mapTodayTasks(data.tasks),
      tasksCount: typeof data.tasks_count === "number" ? data.tasks_count : 0,
    };
  }

  async getCurrentHostUser(): Promise<CalendarHostUser> {
    const response = await this.authorizedFetch("/api/v1/auth/me");
    const data = (await response.json()) as MeDto;

    const fullName =
      data.full_name?.trim() ||
      `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() ||
      "Пользователь";

    return {
      id: data.id,
      fullName,
      email: data.email ?? "",
      avatarUrl: normalizeBackendAssetUrl(data.avatar_url) ?? "",
    };
  }

  async listUsers(query?: string): Promise<CalendarSelectableUser[]> {
    const params = new URLSearchParams();
    if (typeof query === "string") {
      params.set("q", query);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const data = await this.requestJson<
      CalendarUserDto[] | { users?: CalendarUserDto[] }
    >([
      `/api/v1/calendar/users/search${suffix}`,
      `/api/calendar/users/search${suffix}`,
      `/calendar/users/search${suffix}`,
    ]);
    const users = Array.isArray(data) ? data : (data?.users ?? []);

    return (users ?? [])
      .filter(
        (user): user is CalendarUserDto & { id: number } =>
          typeof user.id === "number",
      )
      .map((user) => ({
        id: user.id,
        fullName:
          user.full_name?.trim() ||
          `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
          user.email ||
          `User ${user.id}`,
        email: user.email ?? "",
      }));
  }

  private async requestEvents(paths: string[]): Promise<CalendarEvent[]> {
    const raw = await this.requestJson<
      CalendarEventDto[] | { events: CalendarEventDto[] }
    >(paths);
    const data = Array.isArray(raw) ? raw : (raw?.events ?? []);
    return this.mapEvents(data);
  }

  private async requestJson<T>(
    paths: string[],
    init?: RequestInit,
    allowEmptyBody = false,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (const path of paths) {
      const response = await this.authorizedFetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });

      if (response.ok) {
        if (response.status === 204 || allowEmptyBody) {
          return {} as T;
        }

        const data = (await response.json()) as T;
        return data;
      }

      if (response.status === 404 && path !== paths[paths.length - 1]) {
        continue;
      }

      const apiError = await this.readApiError(response);
      const error = new Error(apiError.message);
      (
        error as Error & { status?: number; details?: ApiErrorDetailsDto }
      ).status = response.status;
      (
        error as Error & { status?: number; details?: ApiErrorDetailsDto }
      ).details = apiError.details;
      lastError = error;

      if (response.status !== 404) {
        break;
      }
    }

    throw lastError ?? new Error("Не удалось выполнить запрос календаря.");
  }

  private async readApiError(
    response: Response,
  ): Promise<{ message: string; details: ApiErrorDetailsDto | undefined }> {
    try {
      const data = (await response.json()) as ApiErrorDto;
      return {
        message:
          data.error ||
          data.message ||
          data.detail ||
          `Ошибка запроса календаря (${response.status})`,
        details: data.details,
      };
    } catch {
      return {
        message: `Ошибка запроса календаря (${response.status})`,
        details: undefined,
      };
    }
  }

  private parseBatchConflicts(error: unknown): CalendarBatchConflict[] {
    if (!isRecord(error)) return [];

    const details = error.details;
    if (!isRecord(details)) return [];

    const conflictsRaw = details.conflicts;
    if (!Array.isArray(conflictsRaw)) return [];

    return conflictsRaw
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((item) => ({
        mail: typeof item.mail === "string" ? item.mail : "",
        reason:
          typeof item.reason === "string" ? item.reason : "Конфликт календаря",
        eventId: typeof item.event_id === "string" ? item.event_id : "",
      }))
      .filter((item) => Boolean(item.mail || item.eventId));
  }

  private mapAttendeeUser(
    user: EventAttendeeUserDto | null | undefined,
  ): CalendarAttendeeUser | null {
    const id = Number(user?.id);
    if (!user || !Number.isFinite(id)) return null;
    return {
      id,
      email: user.email ?? "",
      firstName: user.first_name ?? "",
      lastName: user.last_name ?? "",
      fullName:
        user.full_name ??
        `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
      avatarUrl: normalizeBackendAssetUrl(user.avatar_url) ?? "",
      availabilityStatus: user.availability_status ?? "",
      position: user.position ?? "",
      username: user.username ?? "",
    };
  }

  private mapAttendee(attendee: EventAttendeeDto): CalendarAttendee {
    const userId = Number(attendee.user_id);
    return {
      userId: Number.isFinite(userId) ? userId : 0,
      status: toRsvpStatus(attendee.status),
      comment: attendee.comment ?? "",
      createdAt: attendee.created_at ?? "",
      updatedAt: attendee.updated_at ?? "",
      eventId: attendee.event_id ?? "",
      user: this.mapAttendeeUser(attendee.user),
    };
  }

  private mapEvent(event: CalendarEventDto): CalendarEvent {
    const attendees = Array.isArray(event.attendees)
      ? event.attendees.map((attendee) => this.mapAttendee(attendee))
      : [];
    const firstName = event.first_name?.trim() ?? "";
    const lastName = event.last_name?.trim() ?? "";
    const fullNameFromParts = `${firstName} ${lastName}`.trim();
    const rawUserId = Number(event.user_id);
    const fallbackUserId = Number.isFinite(rawUserId) ? rawUserId : null;
    const organizerDisplayName =
      fullNameFromParts ||
      event.user_name?.trim() ||
      event.username?.trim() ||
      (fallbackUserId ? `Пользователь #${fallbackUserId}` : "");

    return {
      id: String(event.id),
      title: event.title ?? "Событие без названия",
      description: event.description ?? "",
      startTime: event.start_time ?? "",
      endTime: event.end_time ?? "",
      location: event.location ?? "",
      isAllDay: Boolean(event.is_all_day),
      isOnline: Boolean(event.is_online),
      color: event.color || fallbackColor,
      attendeesCount: attendees.length,
      attendees,
      isOrganizer: Boolean(event.is_organizer),
      reminderMinutes:
        typeof event.reminder_minutes === "number"
          ? event.reminder_minutes
          : null,
      recurrenceInterval:
        typeof event.recurrence_interval === "number"
          ? event.recurrence_interval
          : null,
      recurrenceRule: event.recurrence_rule ?? "",
      recurrenceUntil: event.recurrence_until ?? "",
      createdAt: event.created_at ?? "",
      updatedAt: event.updated_at ?? "",
      userId: fallbackUserId,
      userName: organizerDisplayName,
      meetingProvider: (event.meeting_provider ??
        "") as CalendarEvent["meetingProvider"],
      meetingRoomId: event.meeting_room_id ?? "",
      meetingUrl: event.meeting_url ?? "",
      liveKitRoomName: event.livekit_room_name ?? "",
      ciscoMeetingId: event.cisco_meeting_id ?? "",
      ciscoJoinUrl: event.cisco_join_url ?? "",
      onlineMeetingStatus: (event.online_meeting_status ??
        "") as CalendarEvent["onlineMeetingStatus"],
    };
  }

  private mapEvents(
    data: CalendarEventDto[] | null | undefined,
  ): CalendarEvent[] {
    return (data ?? []).map((event) => this.mapEvent(event));
  }

  private mapTodayTasks(
    input: CalendarTodayTaskSummaryDto[] | undefined,
  ): CalendarTodayTaskSummary[] {
    return (input ?? []).map((task) => ({
      id: task.id ?? "",
      title: task.title ?? "",
      boardId: task.board_id ?? "",
      columnId: task.column_id ?? "",
      dueAt: task.due_at ?? "",
      priority: task.priority ?? "",
      status: task.status ?? "",
    }));
  }

  private toEventRequestDto(
    payload: CreateCalendarEventPayload | UpdateCalendarEventPayload,
  ): Record<string, unknown> {
    const normalizedStart = toRfc3339NoMillis(payload.startTime);
    const normalizedEnd = toRfc3339NoMillis(payload.endTime);

    const result: Record<string, unknown> = {
      title: payload.title,
      description: payload.description ?? "",
      start_time: normalizedStart,
      end_time: normalizedEnd,
      attendee_ids: payload.attendeeIds ?? [],
      is_all_day: Boolean(payload.isAllDay),
      is_online: Boolean(payload.isOnline),
      location: payload.location ?? "",
      color: payload.color ?? fallbackColor,
    };

    if (typeof payload.reminderMinutes === "number") {
      result.reminder_minutes = payload.reminderMinutes;
    }

    if (payload.recurrenceRule && payload.recurrenceRule.trim()) {
      result.recurrence_rule = payload.recurrenceRule.trim();
      if (typeof payload.recurrenceInterval === "number") {
        result.recurrence_interval = payload.recurrenceInterval;
      }
      if (payload.recurrenceUntil && payload.recurrenceUntil.trim()) {
        result.recurrence_until = toRfc3339NoMillis(
          payload.recurrenceUntil.trim(),
        );
      }
    }

    return result;
  }

  private async authorizedFetch(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    return authorizedFetch(this.sessionStore, path, init);
  }
}
