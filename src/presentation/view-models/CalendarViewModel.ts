import type { CalendarEvent, CalendarRsvpStatus } from '../../domain/entities/CalendarEvent'
import type { CalendarHostUser } from '../../domain/entities/CalendarHostUser'

export type CalendarMode = 'day' | 'week' | 'month'

export interface CalendarEventViewModel {
  id: string
  title: string
  description: string
  location: string
  joinUrl: string
  color: string
  attendeesCount: number
  attendeeIds: number[]
  attendees: Array<{ id: number; fullName: string; email: string; status: CalendarRsvpStatus }>
  organizerUserId: number | null
  organizerName: string
  isOnline: boolean
  meetingProvider: string
  onlineMeetingStatus: string
  liveKitRoomName: string
  isAllDay: boolean
  isOrganizer: boolean
  reminderMinutes: number | null
  recurrenceRule: string
  recurrenceInterval: number | null
  recurrenceUntil: string
  startTime: string
  endTime: string
  dayKey: string
  timeLabel: string
  isDeclined: boolean
  myRsvpStatus: 'accepted' | 'declined' | 'tentative' | 'needs_action'
}

export interface CalendarHostUserViewModel {
  id: number
  fullName: string
  email: string
  avatarUrl: string
}

export interface CalendarViewModel {
  host: CalendarHostUserViewModel | null
  events: CalendarEventViewModel[]
}

const toDayKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
})

const urlPattern = /(https?:\/\/[^\s]+)/i
const legacyCalendarRoomPattern = /^calendar-[^\s/\\]+$/i
const fallbackMeetingBaseUrl = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CALENDAR_MEETING_BASE_URL) ||
  `${globalThis.location?.origin || ''}/web/calls/calendar`
).replace(/\/$/, '')

const extractFirstUrl = (value: string): string => {
  const match = value.match(urlPattern)
  return match ? match[1] : ''
}

const isLegacyCalendarRoomName = (value: string): boolean => legacyCalendarRoomPattern.test(value.trim())

const buildLegacyMeetingUrl = (roomName: string): string =>
  roomName && fallbackMeetingBaseUrl ? `${fallbackMeetingBaseUrl}/${encodeURIComponent(roomName)}` : ''

const resolveLiveKitRoomName = (event: CalendarEvent): string => {
  const explicit = (event.liveKitRoomName || '').trim()
  if (explicit) return explicit

  const location = (event.location || '').trim()
  if (event.isOnline && isLegacyCalendarRoomName(location)) {
    return location
  }

  return ''
}

const resolveJoinUrl = (event: CalendarEvent): string => {
  const roomName = resolveLiveKitRoomName(event)
  if (event.isOnline && roomName && event.meetingProvider === 'livekit') {
    return buildLegacyMeetingUrl(roomName)
  }

  const explicit = (event.meetingUrl || event.ciscoJoinUrl || extractFirstUrl(event.location || '') || '').trim()
  if (explicit) return explicit

  if (!event.isOnline || !roomName) return ''

  // Legacy fallback until every backend response returns explicit meeting_url.
  return buildLegacyMeetingUrl(roomName)
}

const resolveDisplayLocation = (event: CalendarEvent): string => {
  const location = (event.location || '').trim()
  if (!location) return ''
  if (event.isOnline && isLegacyCalendarRoomName(location)) {
    return ''
  }
  return location
}

const toTimeLabel = (event: CalendarEvent): string => {
  if (event.isAllDay) {
    return 'Весь день'
  }

  const start = new Date(event.startTime)
  const end = new Date(event.endTime)

  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return 'Время не указано'
  }

  return `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`
}

export const toCalendarHostUserViewModel = (host: CalendarHostUser): CalendarHostUserViewModel => ({
  id: host.id,
  fullName: host.fullName,
  email: host.email,
  avatarUrl: host.avatarUrl,
})

export const toCalendarEventViewModel = (event: CalendarEvent, viewerId?: number | null): CalendarEventViewModel => {
  const start = new Date(event.startTime)
  const fallbackStart = Number.isNaN(start.valueOf()) ? new Date() : start

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: resolveDisplayLocation(event),
    joinUrl: resolveJoinUrl(event),
    color: event.color,
    attendeesCount: event.attendees.length,
    attendeeIds: event.attendees.map((a) => a.userId || a.user?.id || 0).filter((id) => id > 0),
    attendees: event.attendees.map((a) => {
      const id = a.userId || a.user?.id || 0
      return {
        id,
        fullName: a.user?.fullName || a.user?.email || `User ${id}`,
        email: a.user?.email || '',
        status: a.status || 'needs_action',
      }
    }),
    organizerUserId: event.userId,
    organizerName: event.userName,
    isOnline: event.isOnline,
    meetingProvider: event.meetingProvider || '',
    onlineMeetingStatus: event.onlineMeetingStatus || '',
    liveKitRoomName: resolveLiveKitRoomName(event),
    isAllDay: event.isAllDay,
    isOrganizer: event.isOrganizer,
    reminderMinutes: event.reminderMinutes,
    recurrenceRule: event.recurrenceRule,
    recurrenceInterval: event.recurrenceInterval,
    recurrenceUntil: event.recurrenceUntil,
    startTime: event.startTime,
    endTime: event.endTime,
    dayKey: toDayKey(fallbackStart),
    timeLabel: toTimeLabel(event),
    isDeclined: viewerId ? event.attendees.some((a) => Number(a.userId || a.user?.id || 0) === Number(viewerId) && a.status === 'declined') : false,
    myRsvpStatus: viewerId ? (event.attendees.find((a) => Number(a.userId || a.user?.id || 0) === Number(viewerId))?.status || 'needs_action') : 'needs_action',
  }
}

export const toCalendarViewModel = (
  host: CalendarHostUser | null,
  events: CalendarEvent[],
): CalendarViewModel => ({
  host: host ? toCalendarHostUserViewModel(host) : null,
  events: events
    .map((e) => toCalendarEventViewModel(e, host?.id))
    .sort((a, b) => new Date(a.startTime).valueOf() - new Date(b.startTime).valueOf()),
})
