import type {
  AcceptCallInput,
  ActiveCallItem,
  DeclineCallInput,
  InviteToCallInput,
  RejoinCalendarCallInput,
  RejoinCalendarCallResponse,
  RejoinCallInput,
  RejoinCallResponse,
  StartCallResponse,
  StartDirectCallInput,
  StartGroupCallInput,
} from '../../domain/entities/Call'
import type { CallRepository } from '../../domain/repositories/CallRepository'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import { withCallHeaders } from '../http/callHeaders'
import { authorizedFetch } from '../http/authorizedFetch'

interface StartCallResponseDto {
  token: string
  url: string
  room_name: string
  call_id: string
}

interface RejoinCallResponseDto extends StartCallResponseDto {
  status?: string
  chat_id?: string
  participants_count?: number
}

interface RejoinCalendarCallResponseDto {
  token?: string
  url?: string
  room_name?: string
  call_type?: string
  event_id?: string
  title?: string
  meeting_provider?: string
  online_meeting_status?: string
  participants_count?: number
}

interface ActiveCallDto {
  id: string
  call_id: string
  from_user_id: number
  to_user_id: number
  room_id?: string
  room_name?: string
  participants_count?: number
  chat_id?: string
  from_name?: string
  status?: string
  created_at: string
  updated_at: string
  ended_at?: string
}

interface InviteCallResponseDto {
  call_id: string
}

const normalizeLiveKitUrl = (url: string): string => {
  const normalized = url.trim()
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    normalized.startsWith('ws://')
  ) {
    throw new Error('Backend вернул небезопасный LiveKit URL. Ожидался wss:// endpoint.')
  }
  return normalized
}

const toStartCallResponse = (dto: StartCallResponseDto): StartCallResponse => ({
  token: dto.token ?? '',
  url: normalizeLiveKitUrl(dto.url ?? ''),
  roomName: dto.room_name ?? '',
  callId: dto.call_id ?? '',
})

const toRejoinCallResponse = (dto: RejoinCallResponseDto): RejoinCallResponse => ({
  token: dto.token ?? '',
  url: normalizeLiveKitUrl(dto.url ?? ''),
  roomName: dto.room_name ?? '',
  callId: dto.call_id ?? '',
  status: dto.status ?? '',
  chatId: dto.chat_id ?? '',
  participantsCount: Number(dto.participants_count ?? 0),
})

const toRejoinCalendarCallResponse = (
  dto: RejoinCalendarCallResponseDto,
): RejoinCalendarCallResponse => ({
  token: dto.token ?? '',
  url: normalizeLiveKitUrl(dto.url ?? ''),
  roomName: dto.room_name ?? '',
  callType: dto.call_type ?? 'calendar',
  eventId: dto.event_id ?? '',
  title: dto.title ?? '',
  meetingProvider: dto.meeting_provider ?? '',
  onlineMeetingStatus: dto.online_meeting_status ?? '',
  participantsCount: Number(dto.participants_count ?? 0),
})

const toActiveCall = (dto: ActiveCallDto): ActiveCallItem => ({
  id: dto.id,
  callId: dto.call_id,
  fromUserId: Number(dto.from_user_id ?? 0),
  toUserId: Number(dto.to_user_id ?? 0),
  roomId: dto.room_id ?? dto.room_name ?? '',
  roomName: dto.room_name ?? dto.room_id ?? '',
  participantsCount: Number(dto.participants_count ?? 0),
  chatId: dto.chat_id ?? '',
  fromName: dto.from_name ?? '',
  status: dto.status ?? '',
  createdAt: dto.created_at ?? '',
  updatedAt: dto.updated_at ?? '',
  endedAt: dto.ended_at ?? '',
})

export class HttpCallRepository implements CallRepository {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  async startDirectCall(input: StartDirectCallInput): Promise<StartCallResponse> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/calls/start', {
      method: 'POST',
      headers: withCallHeaders(),
      body: JSON.stringify({
        callee_id: input.calleeId,
        chat_id: input.chatId ?? '',
        priority: input.priority ?? 'high',
      }),
    })

    return toStartCallResponse((await response.json()) as StartCallResponseDto)
  }

  async startGroupCall(input: StartGroupCallInput): Promise<StartCallResponse> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/calls/group/start', {
      method: 'POST',
      headers: withCallHeaders(),
      body: JSON.stringify({
        group_id: input.groupId,
      }),
    })

    return toStartCallResponse((await response.json()) as StartCallResponseDto)
  }

  async acceptCall(input: AcceptCallInput): Promise<StartCallResponse> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/calls/accept', {
      method: 'POST',
      headers: withCallHeaders(),
      body: JSON.stringify({
        room_name: input.roomName,
        call_id: input.callId ?? '',
      }),
    })

    return toStartCallResponse((await response.json()) as StartCallResponseDto)
  }

  async rejoinCall(input: RejoinCallInput): Promise<RejoinCallResponse> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/calls/rejoin', {
      method: 'POST',
      headers: withCallHeaders(),
      body: JSON.stringify({
        room_name: input.roomName ?? '',
        call_id: input.callId ?? '',
      }),
    })

    return toRejoinCallResponse((await response.json()) as RejoinCallResponseDto)
  }

  async rejoinCalendarCall(input: RejoinCalendarCallInput): Promise<RejoinCalendarCallResponse> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/calls/calendar/rejoin', {
      method: 'POST',
      headers: withCallHeaders(),
      body: JSON.stringify({
        room_name: input.roomName,
      }),
    })

    return toRejoinCalendarCallResponse(
      (await response.json()) as RejoinCalendarCallResponseDto,
    )
  }

  async declineCall(input: DeclineCallInput): Promise<void> {
    await authorizedFetch(this.sessionStore, '/api/v1/calls/decline', {
      method: 'POST',
      headers: withCallHeaders(),
      body: JSON.stringify({
        call_id: input.callId,
        reason: input.reason ?? 'declined',
        room_name: input.roomName ?? '',
      }),
    })
  }

  async inviteToCall(input: InviteToCallInput): Promise<{ callId: string }> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/calls/invite', {
      method: 'POST',
      headers: withCallHeaders(),
      body: JSON.stringify({
        callee_id: input.calleeId,
        room_name: input.roomName,
        chat_id: input.chatId ?? '',
      }),
    })

    const data = (await response.json()) as InviteCallResponseDto
    return {
      callId: data.call_id ?? '',
    }
  }

  async getActiveCalls(limit = 10): Promise<ActiveCallItem[]> {
    const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 50) : 10
    const response = await authorizedFetch(this.sessionStore, `/api/v1/calls/active?limit=${normalizedLimit}`, {
      headers: withCallHeaders(),
    })
    const data = (await response.json()) as ActiveCallDto[] | { data?: ActiveCallDto[] }
    const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
    return items.map(toActiveCall)
  }
}
