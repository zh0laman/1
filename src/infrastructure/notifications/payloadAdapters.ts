import type { PushPayload, RealtimeEvent } from '../../domain/entities/Notification'

export interface NormalizedPushPayload {
  source: 'fcm'
  category: 'persisted' | 'chat' | 'call' | 'email' | 'unknown'
  type: string
  roomId: string
  roomName: string
  notificationId: string
  raw: PushPayload
}

export interface NormalizedRealtimeEvent {
  source: 'ws'
  category: 'chat' | 'call' | 'unknown'
  type: string
  roomName: string
  callId: string
  raw: RealtimeEvent
}

export const normalizeNotificationRestItem = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== 'object') {
    return {}
  }

  return input as Record<string, unknown>
}

export const normalizePushPayload = (payload: PushPayload): NormalizedPushPayload => {
  const kind = String(payload.kind ?? '')
  const type = String(payload.type ?? '')
  const notificationId = String(payload.notification_id ?? '')
  const roomId = String(payload.room_id ?? '')
  const roomName = String(payload.room_name ?? '')

  let category: NormalizedPushPayload['category'] = 'unknown'
  if (notificationId) category = 'persisted'
  else if (kind === 'chat_message') category = 'chat'
  else if (type.startsWith('call_') || type === 'incoming_call' || type === 'incoming_call_cancel' || type === 'call_invite') category = 'call'
  else if (type === 'email_notification') category = 'email'

  return {
    source: 'fcm',
    category,
    type,
    roomId,
    roomName,
    notificationId,
    raw: payload,
  }
}

export const normalizeRealtimeEvent = (event: RealtimeEvent): NormalizedRealtimeEvent => {
  const type = String(event.type ?? '')
  const content = event.content ?? {}
  const roomName = String(content.room_name ?? '')
  const callId = String(content.call_id ?? '')

  let category: NormalizedRealtimeEvent['category'] = 'unknown'
  if (type === 'new_message') category = 'chat'
  else if (type.startsWith('call_') || type === 'incoming_call_cancel') category = 'call'

  return {
    source: 'ws',
    category,
    type,
    roomName,
    callId,
    raw: event,
  }
}
