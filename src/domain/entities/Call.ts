export type CallTargetKind = 'direct' | 'group'
export type CallDirection = 'incoming' | 'outgoing'

export interface StartDirectCallInput {
  calleeId: number
  chatId?: string
  priority?: 'normal' | 'high'
}

export interface StartGroupCallInput {
  groupId: string
}

export interface InviteToCallInput {
  calleeId: number
  roomName: string
  chatId?: string
}

export interface AcceptCallInput {
  roomName: string
  callId?: string
}

export interface RejoinCallInput {
  roomName?: string
  callId?: string
}

export interface RejoinCalendarCallInput {
  roomName: string
}

export interface DeclineCallInput {
  callId: string
  reason?: 'busy' | 'declined' | 'canceled'
  roomName?: string
}

export interface StartCallResponse {
  token: string
  url: string
  roomName: string
  callId: string
}

export interface RejoinCallResponse extends StartCallResponse {
  status: string
  chatId: string
  participantsCount: number
}

export interface RejoinCalendarCallResponse {
  token: string
  url: string
  roomName: string
  callType: string
  eventId: string
  title: string
  meetingProvider: string
  onlineMeetingStatus: string
  participantsCount: number
}

export interface ActiveCallItem {
  id: string
  callId: string
  fromUserId: number
  toUserId: number
  roomId: string
  roomName: string
  participantsCount: number
  chatId: string
  fromName: string
  status: string
  createdAt: string
  updatedAt: string
  endedAt: string
}

export interface CallSignal {
  type: string
  callId: string
  roomName: string
  roomId: string
  chatId: string
  fromUserId: number
  fromName: string
  groupId: string
  groupName: string
  acceptedByUserId: number
  acceptedByName: string
  reason: string
  isVideo: boolean
  createdAt: string
}

export interface StoredCallSnapshot {
  callId: string
  roomName: string
  chatId: string
  kind: CallTargetKind
  direction: CallDirection
  displayName: string
  fromName: string
  fromUserId: number
  groupId: string
  groupName: string
  createdAt: string
}
