export type CalendarRsvpStatus =
  | "accepted"
  | "declined"
  | "tentative"
  | "needs_action";
export type CalendarRespondStatus = "accepted" | "declined";

export interface CalendarAttendeeUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string;
  availabilityStatus: string;
  position: string;
  username: string;
}

export interface CalendarAttendee {
  userId: number;
  status: CalendarRsvpStatus;
  comment: string;
  createdAt: string;
  updatedAt: string;
  eventId: string;
  user: CalendarAttendeeUser | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  isAllDay: boolean;
  isOnline: boolean;
  color: string;
  attendeesCount: number;
  attendees: CalendarAttendee[];
  isOrganizer: boolean;
  reminderMinutes: number | null;
  recurrenceRule: string;
  recurrenceInterval: number | null;
  recurrenceUntil: string;
  createdAt: string;
  updatedAt: string;
  userId: number | null;
  userName: string;
  meetingProvider?: "livekit" | "cisco" | "none" | "";
  meetingRoomId?: string;
  meetingUrl?: string;
  liveKitRoomName?: string;
  ciscoMeetingId?: string;
  ciscoJoinUrl?: string;
  onlineMeetingStatus?: "created" | "pending" | "failed" | "none" | "";
}

export interface CreateCalendarEventPayload {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendeeIds?: number[];
  isAllDay?: boolean;
  isOnline?: boolean;
  location?: string;
  color?: string;
  recurrenceRule?: string;
  recurrenceInterval?: number;
  recurrenceUntil?: string;
  reminderMinutes?: number;
}

export type UpdateCalendarEventPayload = CreateCalendarEventPayload;

export interface BatchCalendarItem {
  mail: string;
  meetingName: string;
  meetingDescription: string;
}

export interface BatchCreateCalendarEventsPayload {
  dateFrom: string;
  dateTo: string;
  items: BatchCalendarItem[];
}

export interface CalendarBatchConflict {
  mail: string;
  reason: string;
  eventId: string;
}

export interface CalendarTodayTaskSummary {
  id: string;
  title: string;
  boardId: string;
  columnId: string;
  dueAt: string;
  priority: string;
  status: string;
}

export interface CalendarSelectableUser {
  id: number;
  fullName: string;
  email: string;
}

export interface CalendarTodaySummary {
  events: CalendarEvent[];
  eventsCount: number;
  tasks: CalendarTodayTaskSummary[];
  tasksCount: number;
}

export interface CalendarSearchParams {
  title: string;
  fromIso: string;
  toIso: string;
  limit?: number;
}

export interface CalendarBatchCreateResult {
  events: CalendarEvent[];
  conflicts: CalendarBatchConflict[];
}

export interface CalendarConflictItem {
  userId: number;
  userName: string;
  username?: string;
  email?: string;
  avatarUrl?: string | null;
  eventId: string;
  eventTitle: string;
  startTime: string;
  endTime: string;
  status?: string;
  overlapMinutes?: number;
}

export interface CalendarSuggestedSlot {
  startTime: string;
  endTime: string;
  timezone?: string;
  score?: number;
  label?: string;
  availableUserIds: number[];
  conflictedUserIds?: number[];
}

export interface CalendarConflictsByUser {
  userId: number;
  userName: string;
  username?: string;
  email?: string;
  avatarUrl?: string | null;
  conflicts: CalendarConflictItem[];
}

export interface CalendarAvailabilityRequest {
  startTime: string;
  endTime: string;
  attendeeIds: number[];
  excludeEventId?: string | null;
  timezone?: string;
}

export interface CalendarAvailabilityResponse {
  isAvailable: boolean;
  checkedUsersCount?: number;
  conflictedUsersCount?: number;
  checkedUserIds?: number[];
  organizerIncluded?: boolean;
  conflicts: CalendarConflictItem[];
  conflictsByUser: CalendarConflictsByUser[];
  suggestedSlots: CalendarSuggestedSlot[];
  partialSuggestedSlots: CalendarSuggestedSlot[];
}

export interface CalendarSuggestTimesRequest {
  durationMinutes: number;
  attendeeIds: number[];
  preferredStart?: string;
  preferredEnd?: string;
  timezone?: string;
  limit?: number;
}
