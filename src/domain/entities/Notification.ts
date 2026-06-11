export interface NotificationItem {
  id: string
  userId: number
  organizerId: number | null
  type: string
  title: string
  content: string
  shortText?: string
  messageText?: string
  sourceSystemCode?: string
  sourceSystemName?: string
  notificationType?: string
  status?: string
  externalMessageId?: string
  applicationNumber?: string
  actionUrl?: string
  isRead: boolean
  metadata: Record<string, unknown>
  createdAt: string
  processedAt?: string
}

export interface CallHistoryItem {
  id: string
  callId: string
  fromUserId: number
  toUserId: number
  roomId: string
  roomName: string
  participantsCount: number
  chatId: string
  fromName: string
  status: 'initiated' | 'accepted' | 'ongoing' | 'no_answer' | 'canceled' | 'declined' | 'busy' | 'ended' | 'missed' | string
  createdAt: string
  updatedAt: string
  endedAt?: string
}

export interface RealtimeEvent {
  type: string
  from: number
  to: number
  conversationId: string | null
  messageId: string | null
  content: Record<string, unknown>
  timestamp: number
}

export interface PushPayload {
  type?: string
  kind?: string
  action?: string
  event?: string
  room_id?: string
  room_name?: string
  [key: string]: string | number | boolean | undefined
}
