import { createContext } from 'react'
import type {
  CallChatMessage,
  LiveKitCallState,
  RecoverableCallState,
} from './types'

export interface StartDirectWebCallInput {
  calleeId: number
  chatId?: string
  displayName: string
}

export interface StartGroupWebCallInput {
  groupId: string
  displayName: string
}

export interface JoinCalendarWebCallInput {
  roomName: string
  title?: string
}

export interface SendCallChatMessageInput {
  text: string
  recipientId?: string
  recipientName?: string
}

export interface CallManagerContextValue {
  busyLabel: string
  currentCall: LiveKitCallState | null
  incomingCall: LiveKitCallState | null
  isBusy: boolean
  recoverableCall: RecoverableCallState | null
  callMessages: CallChatMessage[]
  unreadChatCount: number
  isChatVisible: boolean
  isWhiteboardVisible: boolean
  setChatVisible: (visible: boolean) => void
  setWhiteboardVisible: (visible: boolean) => void

  acceptIncomingCall: () => Promise<void>
  declineIncomingCall: () => Promise<void>
  dismissRecoverableCall: () => void
  hangUp: () => Promise<void>
  joinCalendarCall: (input: JoinCalendarWebCallInput) => Promise<void>
  rejoinRecoverableCall: () => Promise<void>
  startDirectCall: (input: StartDirectWebCallInput) => Promise<void>
  startGroupCall: (input: StartGroupWebCallInput) => Promise<void>
  toggleCamera: () => Promise<void>
  toggleMicrophone: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  toggleHandRaise: () => Promise<void>
  sendReaction: (emoji: string) => Promise<void>
  sendChatMessage: (input: SendCallChatMessageInput) => Promise<void>
  inviteParticipant: (userId: number) => Promise<void>
}


export const CallManagerContext = createContext<CallManagerContextValue | null>(null)
