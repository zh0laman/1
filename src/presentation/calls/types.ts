import type { AudioTrack, VideoTrack } from 'livekit-client'
import type { ActiveCallItem, CallDirection, CallTargetKind, StoredCallSnapshot } from '../../domain/entities/Call'

export type CallUiPhase = 'idle' | 'incoming' | 'connecting' | 'ringing' | 'active' | 'error'

export interface LiveKitCallParticipant {
  sid: string
  userId: number | null
  identity: string
  name: string
  isLocal: boolean
  audioTrack: AudioTrack | null
  videoTrack: VideoTrack | null
  screenShareTrack: VideoTrack | null
  isMicrophoneEnabled: boolean
  isCameraEnabled: boolean
  isHandRaised?: boolean
  reaction?: string | null
  isSpeaking?: boolean
  connectionQuality?: string
}

export interface LiveKitCallState extends StoredCallSnapshot {
  phase: CallUiPhase
  token: string
  url: string
  roomConnected: boolean
  acceptedByName: string
  participantsCount: number
  participants: LiveKitCallParticipant[]
  invitedUserIds: number[]
  isMicrophoneEnabled: boolean
  isCameraEnabled: boolean
  isScreenShareEnabled: boolean
  warning: string
}

export interface RecoverableCallState {
  candidate: ActiveCallItem
  snapshot: StoredCallSnapshot | null
  kind: CallTargetKind
  direction: CallDirection
  displayName: string
  subtitle: string
}

export interface CallToastState {
  tone: 'info' | 'error' | 'success'
  message: string
}

export interface CallChatMessage {
  id: string
  senderId: string
  senderName: string
  recipientId?: string // if absent, message is for everyone
  recipientName?: string
  text: string
  timestamp: number
  isLocal?: boolean
}

export interface CallReaction {
  id: string
  emoji: string
  senderId: string
  senderName: string
  timestamp: number
}

export type CallDataPayload =
  | { type: 'raise_hand'; identity: string; sender_name: string; value: boolean }
  | {
      type: 'call_chat'
      id: string
      sender_id: string
      sender_name: string
      recipient_id?: string
      recipient_name?: string
      text: string
      ts: number
    }
  | {
      type: 'call_reaction'
      id: string
      emoji: string
      sender_id: string
      sender_name: string
      ts: number
    }

