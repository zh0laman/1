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
} from '../entities/Call'

export interface CallRepository {
  startDirectCall(input: StartDirectCallInput): Promise<StartCallResponse>
  startGroupCall(input: StartGroupCallInput): Promise<StartCallResponse>
  acceptCall(input: AcceptCallInput): Promise<StartCallResponse>
  rejoinCall(input: RejoinCallInput): Promise<RejoinCallResponse>
  rejoinCalendarCall(input: RejoinCalendarCallInput): Promise<RejoinCalendarCallResponse>
  declineCall(input: DeclineCallInput): Promise<void>
  inviteToCall(input: InviteToCallInput): Promise<{ callId: string }>
  getActiveCalls(limit?: number): Promise<ActiveCallItem[]>
}
