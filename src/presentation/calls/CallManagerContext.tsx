import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client'
import {
  HttpUserDirectoryRepository,
  type UserDirectoryUser
} from '../../infrastructure/repositories/HttpUserDirectoryRepository'
import type {
  AudioTrack,
  Participant,
  VideoTrack,
  DataPublishOptions,
} from 'livekit-client'
import type {
  ActiveCallItem,
  CallSignal,
  CallTargetKind,
  StartCallResponse,
  StoredCallSnapshot,
} from '../../domain/entities/Call'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import type { NotificationRealtimeClient } from '../../infrastructure/notifications/NotificationRealtimeClient'
import { HttpCallRepository } from '../../infrastructure/repositories/HttpCallRepository'
import { WebCallSessionStore } from '../../infrastructure/storage/WebCallSessionStore'
import { getErrorMessage } from '../../shared/utils/getErrorMessage'
import CallOverlay from '../components/calls/CallOverlay'
import {
  CallManagerContext,
  type CallManagerContextValue,
  type JoinCalendarWebCallInput,
  type StartDirectWebCallInput,
  type StartGroupWebCallInput,
} from './callManagerShared'
import type {
  CallChatMessage,
  CallReaction,
  LiveKitCallParticipant,
  LiveKitCallState,
  RecoverableCallState,
} from './types'



interface CallManagerProviderProps {
  children: ReactNode
  currentUserId: number | null
  currentUserName: string
  realtimeClient: NotificationRealtimeClient
  sessionStore: AuthSessionStore
}

const TERMINAL_SIGNAL_MESSAGES: Record<string, string> = {
  call_busy: 'Пользователь уже находится в звонке.',
  call_declined: 'Звонок был отклонен.',
  call_ended: 'Звонок завершен.',
  incoming_call_cancel: 'Звонок был отменен.',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return ''
}

const readNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const isGroupRoom = (roomName: string): boolean =>
  roomName.trim().startsWith('call_group_')

const toIsoString = (value: string): string => {
  if (!value) {
    return new Date().toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

const parseCallSignal = (event: Record<string, unknown>): CallSignal | null => {
  const type = readString(event.type)
  if (!type || !type.includes('call')) {
    return null
  }

  const source = {
    ...event,
    ...(isRecord(event.content) ? event.content : {}),
  } as Record<string, unknown>
  const roomName = readString(source.room_name) || readString(source.room_id) || readString(source.roomId)
  const callId = readString(source.call_id) || readString(source.callId)

  if (!callId && !roomName) {
    return null
  }

  return {
    type: readString(source.type) || type,
    callId,
    roomName,
    roomId: readString(source.room_id) || readString(source.roomId) || roomName,
    chatId: readString(source.chat_id) || readString(source.chatId),
    fromUserId: readNumber(source.from_user_id) || readNumber(source.fromUserId) || readNumber(source.sender_id) || readNumber(source.senderId),
    fromName:
      readString(source.from_full_name) ||
      readString(source.from_name) ||
      readString(source.sender_name) ||
      readString(source.fullName) ||
      readString(source.full_name),
    groupId: readString(source.group_id) || readString(source.groupId),
    groupName: readString(source.group_name) || readString(source.groupName),
    acceptedByUserId: readNumber(source.accepted_by_user_id) || readNumber(source.acceptedByUserId),
    acceptedByName: readString(source.accepted_by_name) || readString(source.acceptedByName),
    reason: readString(source.reason),
    isVideo: source.is_video !== false && source.isVideo !== false,
    createdAt: toIsoString(readString(source.sent_at) || readString(source.created_at) || readString(source.timestamp)),
  }
}

const createCallState = (
  snapshot: StoredCallSnapshot,
  patch: Partial<LiveKitCallState> = {},
): LiveKitCallState => ({
  ...snapshot,
  phase: 'idle',
  token: '',
  url: '',
  roomConnected: false,
  acceptedByName: '',
  participantsCount: 0,
  participants: [],
  invitedUserIds: [],
  isMicrophoneEnabled: false,
  isCameraEnabled: false,
  isScreenShareEnabled: false,
  warning: '',
  ...patch,
})

const createSignalSnapshot = (
  signal: CallSignal,
  direction: 'incoming' | 'outgoing',
): StoredCallSnapshot => {
  const kind: CallTargetKind =
    signal.type === 'call_invite' || Boolean(signal.groupId) || isGroupRoom(signal.roomName)
      ? 'group'
      : 'direct'

  return {
    callId: signal.callId,
    roomName: signal.roomName || signal.roomId,
    chatId: signal.chatId,
    kind,
    direction,
    displayName:
      kind === 'group'
        ? signal.groupName || 'Групповой звонок'
        : signal.fromName || 'Видеозвонок',
    fromName: signal.fromName,
    fromUserId: signal.fromUserId,
    groupId: signal.groupId,
    groupName: signal.groupName,
    createdAt: signal.createdAt || new Date().toISOString(),
  }
}

const createOutgoingSnapshot = (input: {
  callId: string
  chatId?: string
  displayName: string
  fromName: string
  fromUserId: number | null
  groupId?: string
  groupName?: string
  kind: CallTargetKind
  roomName: string
}): StoredCallSnapshot => ({
  callId: input.callId,
  roomName: input.roomName,
  chatId: input.chatId ?? '',
  kind: input.kind,
  direction: 'outgoing',
  displayName: input.displayName,
  fromName: input.fromName,
  fromUserId: input.fromUserId ?? 0,
  groupId: input.groupId ?? '',
  groupName: input.groupName ?? '',
  createdAt: new Date().toISOString(),
})

const createSyntheticActiveCall = (snapshot: StoredCallSnapshot): ActiveCallItem => ({
  id: snapshot.callId,
  callId: snapshot.callId,
  fromUserId: snapshot.fromUserId,
  toUserId: 0,
  roomId: snapshot.roomName,
  roomName: snapshot.roomName,
  participantsCount: 0,
  chatId: snapshot.chatId,
  fromName: snapshot.fromName,
  status: 'ongoing',
  createdAt: snapshot.createdAt,
  updatedAt: snapshot.createdAt,
  endedAt: '',
})

const deriveSnapshotFromActiveCall = (
  candidate: ActiveCallItem,
  currentUserId: number | null,
): StoredCallSnapshot => {
  const kind: CallTargetKind = isGroupRoom(candidate.roomName) ? 'group' : 'direct'
  const direction =
    currentUserId !== null && candidate.fromUserId === currentUserId ? 'outgoing' : 'incoming'

  return {
    callId: candidate.callId,
    roomName: candidate.roomName,
    chatId: candidate.chatId,
    kind,
    direction,
    displayName:
      kind === 'group'
        ? 'Групповой звонок'
        : direction === 'outgoing'
          ? 'Исходящий звонок'
          : candidate.fromName || 'Видеозвонок',
    fromName: candidate.fromName,
    fromUserId: candidate.fromUserId,
    groupId: kind === 'group' ? candidate.chatId : '',
    groupName: '',
    createdAt: toIsoString(candidate.createdAt),
  }
}

const toRecoverableCall = (
  candidate: ActiveCallItem,
  snapshot: StoredCallSnapshot,
): RecoverableCallState => {
  const subtitle =
    candidate.status === 'initiated'
      ? snapshot.direction === 'incoming'
        ? 'Входящий звонок еще активен. Можно быстро вернуться.'
        : 'Исходящий звонок еще активен. Можно быстро вернуться.'
      : 'Звонок еще активен. Можно вернуться в комнату.'

  return {
    candidate,
    snapshot,
    kind: snapshot.kind,
    direction: snapshot.direction,
    displayName: snapshot.displayName,
    subtitle,
  }
}

const matchesCall = (
  candidate: { callId?: string; roomName?: string } | null | undefined,
  callId: string,
  roomName: string,
): boolean => {
  if (!candidate) {
    return false
  }

  return Boolean(
    (callId && candidate.callId === callId) ||
      (roomName && candidate.roomName === roomName),
  )
}

const parseIdentityUserId = (identity: string): number | null => {
  const [rawUserId] = identity.split(':')
  const parsed = Number(rawUserId)
  return Number.isFinite(parsed) ? parsed : null
}

const extractTrack = <TTrack extends AudioTrack | VideoTrack>(
  participant: Participant,
  source: Track.Source,
  kind: Track.Kind,
): TTrack | null => {
  const publication = participant.getTrackPublication(source)
  const track = publication?.track

  if (!track || track.kind !== kind) {
    return null
  }

  return track as TTrack
}

const collectParticipants = (
  room: Room,
  currentUserName: string,
  raisedHands: Record<string, boolean>,
): LiveKitCallParticipant[] => {
  const allParticipants: Participant[] = [
    room.localParticipant,
    ...Array.from(room.remoteParticipants.values()),
  ]

  return allParticipants.map((participant) => {

    const microphonePublication = participant.getTrackPublication(Track.Source.Microphone)
    const cameraPublication = participant.getTrackPublication(Track.Source.Camera)

    const userId = parseIdentityUserId(participant.identity)
    const isLocal = participant === room.localParticipant

    const identity = participant.identity || ''
    const sid = participant.sid || ''
    
    // Attempt to find hand raise state in our local tracking state (Record<string, boolean>)
    // Checking both identity and sid just in case of mismatch
    const isHandRaisedInState = 
      raisedHands[identity] === true || 
      (sid && raisedHands[sid] === true)
    
    // Fallback to LiveKit attributes if local state is missing
    const isHandRaisedInAttributes = 
      participant.attributes?.hand_raised === 'true' || 
      participant.attributes?.isHandRaised === 'true' ||
      participant.attributes?.is_hand_raised === 'true' ||
      participant.attributes?.handRaised === 'true'

    return {
      sid: sid || identity,
      userId,
      identity,
      name:
        participant.name ||
        (isLocal ? currentUserName : userId !== null ? `User ${userId}` : 'Участник'),
      isLocal,
      audioTrack: extractTrack<AudioTrack>(participant, Track.Source.Microphone, Track.Kind.Audio),
      videoTrack: extractTrack<VideoTrack>(participant, Track.Source.Camera, Track.Kind.Video),
      screenShareTrack: extractTrack<VideoTrack>(
        participant,
        Track.Source.ScreenShare,
        Track.Kind.Video,
      ),
      isMicrophoneEnabled: Boolean(microphonePublication && !microphonePublication.isMuted),
      isCameraEnabled: Boolean(cameraPublication && !cameraPublication.isMuted),
      isHandRaised: isHandRaisedInState || isHandRaisedInAttributes,
      isSpeaking: participant.isSpeaking,
      connectionQuality: participant.connectionQuality.toString(),
    }
  })
}

const resolvePhase = (
  call: LiveKitCallState,
  roomState: ConnectionState,
  participantsCount: number,
): LiveKitCallState['phase'] => {
  if (
    roomState === ConnectionState.Connecting ||
    roomState === ConnectionState.Reconnecting
  ) {
    return 'connecting'
  }

  if (participantsCount > 1 || Boolean(call.acceptedByName)) {
    return 'active'
  }

  if (call.direction === 'incoming') {
    return 'active'
  }

  return 'ringing'
}

const pickRecoverableCandidate = (
  candidates: ActiveCallItem[],
  currentUserId: number | null,
  snapshot: StoredCallSnapshot | null,
): ActiveCallItem | null => {
  if (candidates.length === 0) {
    return null
  }

  const ordered = candidates
    .slice()
    .sort(
      (left, right) =>
        new Date(right.updatedAt || right.createdAt).getTime() -
        new Date(left.updatedAt || left.createdAt).getTime(),
    )

  if (snapshot) {
    const exactMatch = ordered.find((candidate) =>
      matchesCall(candidate, snapshot.callId, snapshot.roomName),
    )

    if (exactMatch) {
      return exactMatch
    }
  }

  const ringingIncoming = ordered.find(
    (candidate) =>
      candidate.status === 'initiated' &&
      currentUserId !== null &&
      candidate.fromUserId !== currentUserId,
  )

  return ringingIncoming ?? ordered[0] ?? null
}

export function CallManagerProvider({
  children,
  currentUserId,
  currentUserName,
  realtimeClient,
  sessionStore,
}: CallManagerProviderProps) {
  const callRepository = useMemo(() => new HttpCallRepository(sessionStore), [sessionStore])
  const userDirectoryRepository = useMemo(() => new HttpUserDirectoryRepository(sessionStore), [sessionStore])
  const callSessionStore = useMemo(() => new WebCallSessionStore(), [])
  const [currentCall, setCurrentCall] = useState<LiveKitCallState | null>(null)
  const [incomingCall, setIncomingCall] = useState<LiveKitCallState | null>(null)
  const [recoverableCall, setRecoverableCall] = useState<RecoverableCallState | null>(null)
  const [activeReactions, setActiveReactions] = useState<CallReaction[]>([])
  const [callMessages, setCallMessages] = useState<CallChatMessage[]>([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [isChatVisible, setIsChatVisible] = useState(false)
  const [isWhiteboardVisible, setIsWhiteboardVisible] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({})
  const raisedHandsRef = useRef<Record<string, boolean>>({})


  const currentCallRef = useRef<LiveKitCallState | null>(null)
  const incomingCallRef = useRef<LiveKitCallState | null>(null)
  const recoverableCallRef = useRef<RecoverableCallState | null>(null)
  const roomRef = useRef<Room | null>(null)
  const activeReactionsRef = useRef<CallReaction[]>([])
  const isChatVisibleRef = useRef(false)
  const currentUserNameRef = useRef(currentUserName)

  useEffect(() => {
    activeReactionsRef.current = activeReactions
  }, [activeReactions])

  useEffect(() => {
    isChatVisibleRef.current = isChatVisible
    if (isChatVisible) {
      setUnreadChatCount(0)
    }
  }, [isChatVisible])

  useEffect(() => {
    currentCallRef.current = currentCall
  }, [currentCall])

  useEffect(() => {
    raisedHandsRef.current = raisedHands
  }, [raisedHands])

  useEffect(() => {
    incomingCallRef.current = incomingCall
  }, [incomingCall])

  useEffect(() => {
    recoverableCallRef.current = recoverableCall
  }, [recoverableCall])

  useEffect(() => {
    currentUserNameRef.current = currentUserName
  }, [currentUserName])

  const manualRoomDisconnectRef = useRef(false)
  const warningTimerRef = useRef<number | null>(null)
  const recoveryBootstrappedRef = useRef(false)
  const syncCurrentCallRef = useRef<((room: Room) => void) | null>(null)

  const debugLog = useCallback((event: string, details?: Record<string, unknown>) => {
    if (details) {
      console.debug(`[CallManager] ${event}`, details)
      return
    }
    console.debug(`[CallManager] ${event}`)
  }, [])


  const clearWarningTimer = useCallback(() => {
    if (warningTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
  }, [])

  const safeDisconnectRoom = useCallback(async () => {
    const room = roomRef.current
    if (!room) {
      return
    }

    roomRef.current = null
    manualRoomDisconnectRef.current = true
    try {
      await Promise.resolve(room.disconnect())
    } catch {
      // ignore room cleanup errors
    } finally {
      manualRoomDisconnectRef.current = false
    }
  }, [])

  const clearAllCallUi = useCallback(
    async (clearStoredSnapshot: boolean) => {
      clearWarningTimer()
      await safeDisconnectRoom()
      startTransition(() => {
        setCurrentCall(null)
        setIncomingCall(null)
        setRecoverableCall(null)
        setRaisedHands({})
      })

      if (clearStoredSnapshot) {
        callSessionStore.clearCurrentCallSnapshot()
      }
      setRoom(null)

    },
    [callSessionStore, clearWarningTimer, safeDisconnectRoom],
  )

  const showTerminalWarning = useCallback(
    async (message: string) => {
      if (!currentCallRef.current) {
        await clearAllCallUi(true)
        return
      }

      clearWarningTimer()
      startTransition(() => {
        setCurrentCall((previous) =>
          previous ? { ...previous, warning: message } : previous,
        )
      })

      if (typeof window !== 'undefined') {
        warningTimerRef.current = window.setTimeout(() => {
          warningTimerRef.current = null
          void clearAllCallUi(true)
        }, 1600)
      }
    },
    [clearAllCallUi, clearWarningTimer],
  )

  const syncCurrentCallFromRoom = useCallback((room: Room) => {
    const participants = collectParticipants(room, currentUserNameRef.current, raisedHandsRef.current)

    const localParticipant = participants.find((participant) => participant.isLocal) ?? null

    // Synchronous update for immediate feedback
    setCurrentCall((previous) => {
      if (!previous) {
        return previous
      }

      return {
        ...previous,
        participants,
        participantsCount: participants.length,
        roomConnected: room.state !== ConnectionState.Disconnected,
        phase: resolvePhase(previous, room.state, participants.length),
        isMicrophoneEnabled: localParticipant?.isMicrophoneEnabled ?? false,
        isCameraEnabled: localParticipant?.isCameraEnabled ?? false,
        isScreenShareEnabled: Boolean(localParticipant?.screenShareTrack),
        warning:
          room.state === ConnectionState.Reconnecting
            ? 'Восстанавливаем соединение...'
            : previous.warning === 'Восстанавливаем соединение...'
              ? ''
              : previous.warning,
      }
    })
  }, [])

  useEffect(() => {
    syncCurrentCallRef.current = syncCurrentCallFromRoom
  }, [syncCurrentCallFromRoom])

  useEffect(() => {
    if (room) {
      syncCurrentCallFromRoom(room)
    }
  }, [raisedHands, room, syncCurrentCallFromRoom])

  const connectToRoom = useCallback(
    async (
      snapshot: StoredCallSnapshot,
      auth: StartCallResponse,
      fallbackPhase: LiveKitCallState['phase'],
    ) => {
      debugLog('connecting_to_room', {
        callId: snapshot.callId,
        roomName: snapshot.roomName,
        direction: snapshot.direction,
        kind: snapshot.kind,
      })

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      const handleRoomMutation = () => {
        syncCurrentCallRef.current?.(room)
      }

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        debugLog('connection_state_changed', {
          roomName: snapshot.roomName,
          state,
        })
        handleRoomMutation()
      })
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        debugLog('participant_connected', {
          roomName: snapshot.roomName,
          participantIdentity: participant.identity,
          participantName: participant.name,
        })
        handleRoomMutation()
      })
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        debugLog('participant_disconnected', {
          roomName: snapshot.roomName,
          participantIdentity: participant.identity,
          participantName: participant.name,
        })
        handleRoomMutation()
      })
      room.on(RoomEvent.ParticipantMetadataChanged, handleRoomMutation)
      room.on(RoomEvent.ParticipantAttributesChanged, handleRoomMutation)
      room.on(RoomEvent.ActiveSpeakersChanged, handleRoomMutation)
      room.on(RoomEvent.ConnectionQualityChanged, handleRoomMutation)
      room.on(RoomEvent.TrackSubscribed, handleRoomMutation)
      room.on(RoomEvent.TrackUnsubscribed, handleRoomMutation)
      room.on(RoomEvent.TrackMuted, handleRoomMutation)
      room.on(RoomEvent.TrackUnmuted, handleRoomMutation)
      room.on(RoomEvent.LocalTrackPublished, handleRoomMutation)
      room.on(RoomEvent.LocalTrackUnpublished, handleRoomMutation)
      room.on(RoomEvent.LocalTrackSubscribed, handleRoomMutation)
      room.on(RoomEvent.Reconnecting, () => {
        debugLog('room_reconnecting', { roomName: snapshot.roomName })
        handleRoomMutation()
      })
      room.on(RoomEvent.Reconnected, () => {
        debugLog('room_reconnected', { roomName: snapshot.roomName })
        handleRoomMutation()
      })
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: Participant) => {
        if (!participant) return
        
        try {
          const decoder = new TextDecoder()
          const text = decoder.decode(payload)
          const data = JSON.parse(text)

          if (data.type === 'raise_hand') {
            const rhIdentity = data.identity || data.sender_id || participant.identity
            const rhValue = Boolean(data.value)
            
            // Update ref immediately so syncCurrentCallFromRoom sees fresh data
            raisedHandsRef.current = { ...raisedHandsRef.current, [rhIdentity]: rhValue }
            setRaisedHands(prev => ({ ...prev, [rhIdentity]: rhValue }))

            handleRoomMutation()
            return
          }

          if (data.type === 'call_reaction' || data.type === 'reaction') {
            const sid = participant.sid
            const emoji = data.emoji
            if (typeof emoji === 'string') {
              const reaction: CallReaction = {
                id: data.id || `${Date.now()}_${sid}_${emoji}`,
                emoji,
                senderId: data.sender_id || participant.identity,
                senderName: data.sender_name || participant.name || 'Участник',
                timestamp: data.ts || Date.now()
              }

              setActiveReactions((prev) => {
                const next = [...prev, reaction].slice(-20)
                return next
              })

              window.setTimeout(() => {
                setActiveReactions((prev) => prev.filter((r) => r.id !== reaction.id))
              }, 4800)
            }
          } else if (data.type === 'call_chat') {

            const msg: CallChatMessage = {
              id: data.id,
              senderId: data.sender_id,
              senderName: data.sender_name,
              recipientId: data.recipient_id,
              recipientName: data.recipient_name,
              text: data.text,
              timestamp: data.ts,
            }
            
            // Filter private messages
            if (msg.recipientId && msg.recipientId !== room.localParticipant.identity) {
              return
            }

            setCallMessages((prev) => [...prev, msg])
            if (!isChatVisibleRef.current) {
              setUnreadChatCount((c) => c + 1)
            }
          }
        } catch {
          // ignore
        }
      })

      room.on(RoomEvent.Disconnected, () => {
        const wasManualDisconnect = manualRoomDisconnectRef.current
        debugLog('room_disconnected', {
          roomName: snapshot.roomName,
          manual: wasManualDisconnect,
        })
        roomRef.current = null
        setRoom(null)
        if (wasManualDisconnect) {

          return
        }

        const snapshotForRecovery =
          callSessionStore.getCurrentCallSnapshot() ?? snapshot
        const fallbackCandidate = createSyntheticActiveCall(snapshotForRecovery)
        startTransition(() => {
          setRecoverableCall(
            toRecoverableCall(fallbackCandidate, snapshotForRecovery),
          )
          setCurrentCall(null)
        })
      })

      roomRef.current = room

      try {
        await room.prepareConnection(auth.url, auth.token)
      } catch {
        // proceed with direct connect if prepareConnection fails
      }

      try {
        await room.connect(auth.url, auth.token)
        roomRef.current = room
        setRoom(room)
        await room.startAudio()
        debugLog('room_connected', {
          roomName: snapshot.roomName,
          localIdentity: room.localParticipant.identity,
        })

      } catch (error) {
        console.error('[CallManager] connection_error', {
          roomName: snapshot.roomName,
          message: getErrorMessage(error, 'LiveKit connection failed'),
        })
        await safeDisconnectRoom()
        throw error
      }

      const [microphoneResult, cameraResult] = await Promise.allSettled([
        room.localParticipant.setMicrophoneEnabled(true),
        room.localParticipant.setCameraEnabled(true),
      ])

      const warnings: string[] = []
      if (microphoneResult.status === 'rejected') {
        warnings.push('Не удалось включить микрофон.')
      }
      if (cameraResult.status === 'rejected') {
        warnings.push('Не удалось включить камеру. Продолжили без видео.')
      }

      const participants = collectParticipants(room, currentUserNameRef.current, raisedHands)

      const localParticipant = participants.find((participant) => participant.isLocal) ?? null
      startTransition(() => {
        setCurrentCall((previous) => {
          if (!previous || previous.callId !== snapshot.callId) {
            return previous
          }

          return {
            ...previous,
            token: auth.token,
            url: auth.url,
            roomConnected: true,
            phase:
              participants.length > 1
                ? 'active'
                : previous.acceptedByName
                  ? 'active'
                  : fallbackPhase,
            participants,
            participantsCount: participants.length,
            isMicrophoneEnabled: localParticipant?.isMicrophoneEnabled ?? false,
            isCameraEnabled: localParticipant?.isCameraEnabled ?? false,
            isScreenShareEnabled: Boolean(localParticipant?.screenShareTrack),
            warning: warnings.join(' '),
          }
        })
      })
    },
    [callSessionStore, debugLog, safeDisconnectRoom, raisedHands],
  )

  const startDirectCall = useCallback(
    async ({ calleeId, chatId, displayName }: StartDirectWebCallInput) => {
      if (currentCallRef.current || incomingCallRef.current || recoverableCallRef.current) {
        throw new Error('Сначала завершите текущий звонок или вернитесь в него.')
      }

      const response = await callRepository.startDirectCall({
        calleeId,
        chatId,
      })

      const snapshot = createOutgoingSnapshot({
        callId: response.callId,
        chatId,
        displayName,
        fromName: currentUserNameRef.current,
        fromUserId: currentUserId,
        kind: 'direct',
        roomName: response.roomName,
      })

      callSessionStore.setCurrentCallSnapshot(snapshot)
      setRecoverableCall(null)
      setIncomingCall(null)
      setCurrentCall(
        createCallState(snapshot, {
          phase: 'connecting',
          token: response.token,
          url: response.url,
        }),
      )

      try {
        await connectToRoom(snapshot, response, 'ringing')
      } catch (error) {
        await clearAllCallUi(true)
        await callRepository
          .declineCall({
            callId: response.callId,
            reason: 'canceled',
            roomName: response.roomName,
          })
          .catch(() => undefined)
        throw error
      }
    },
    [
      callRepository,
      callSessionStore,
      clearAllCallUi,
      connectToRoom,
      currentUserId,
    ],
  )

  const startGroupCall = useCallback(
    async ({ groupId, displayName }: StartGroupWebCallInput) => {
      if (currentCallRef.current || incomingCallRef.current || recoverableCallRef.current) {
        throw new Error('Сначала завершите текущий звонок или вернитесь в него.')
      }

      const response = await callRepository.startGroupCall({ groupId })
      const snapshot = createOutgoingSnapshot({
        callId: response.callId,
        chatId: groupId,
        displayName,
        fromName: currentUserNameRef.current,
        fromUserId: currentUserId,
        groupId,
        groupName: displayName,
        kind: 'group',
        roomName: response.roomName,
      })

      callSessionStore.setCurrentCallSnapshot(snapshot)
      setRecoverableCall(null)
      setIncomingCall(null)
      setCurrentCall(
        createCallState(snapshot, {
          phase: 'connecting',
          token: response.token,
          url: response.url,
        }),
      )

      try {
        await connectToRoom(snapshot, response, 'ringing')
      } catch (error) {
        await clearAllCallUi(true)
        await callRepository
          .declineCall({
            callId: response.callId,
            reason: 'canceled',
            roomName: response.roomName,
          })
          .catch(() => undefined)
        throw error
      }
    },
    [
      callRepository,
      callSessionStore,
      clearAllCallUi,
      connectToRoom,
      currentUserId,
    ],
  )

  const acceptIncomingCall = useCallback(async () => {
    const pendingCall = incomingCallRef.current
    if (!pendingCall) {
      return
    }

    const response = await callRepository.acceptCall({
      callId: pendingCall.callId,
      roomName: pendingCall.roomName,
    })

    const snapshot: StoredCallSnapshot = {
      ...pendingCall,
    }
    callSessionStore.setCurrentCallSnapshot(snapshot)
    setIncomingCall(null)
    setRecoverableCall(null)
    setCurrentCall(
      createCallState(snapshot, {
        phase: 'connecting',
        token: response.token,
        url: response.url,
      }),
    )

    try {
      await connectToRoom(snapshot, response, 'active')
    } catch (error) {
      setRecoverableCall(
        toRecoverableCall(createSyntheticActiveCall(snapshot), snapshot),
      )
      setCurrentCall(null)
      throw error
    }
  }, [callRepository, callSessionStore, connectToRoom])

  const declineIncomingCall = useCallback(async () => {
    const pendingCall = incomingCallRef.current
    if (!pendingCall) {
      return
    }

    await callRepository.declineCall({
      callId: pendingCall.callId,
      reason: 'declined',
      roomName: pendingCall.roomName,
    })
    await clearAllCallUi(true)
  }, [callRepository, clearAllCallUi])

  const hangUp = useCallback(async () => {
    const activeCall = currentCallRef.current
    if (!activeCall) {
      return
    }

    if (activeCall.roomConnected) {
      await clearAllCallUi(true)
      return
    }

    await callRepository
      .declineCall({
        callId: activeCall.callId,
        reason: 'canceled',
        roomName: activeCall.roomName,
      })
      .catch(() => undefined)
    await clearAllCallUi(true)
  }, [callRepository, clearAllCallUi])

  const rejoinRecoverableCall = useCallback(async () => {
    const candidate = recoverableCallRef.current
    if (!candidate) {
      return
    }

    const response = await callRepository.rejoinCall({
      callId: candidate.candidate.callId,
      roomName: candidate.candidate.roomName,
    })

    const snapshot =
      candidate.snapshot ??
      deriveSnapshotFromActiveCall(candidate.candidate, currentUserId)
    callSessionStore.setCurrentCallSnapshot(snapshot)
    setRecoverableCall(null)
    setCurrentCall(
      createCallState(snapshot, {
        phase: 'connecting',
        token: response.token,
        url: response.url,
      }),
    )

    try {
      await connectToRoom(snapshot, response, 'active')
    } catch (error) {
      setRecoverableCall(
        toRecoverableCall(candidate.candidate, snapshot),
      )
      setCurrentCall(null)
      throw error
    }
  }, [callRepository, callSessionStore, connectToRoom, currentUserId])

  const joinCalendarCall = useCallback(
    async ({ roomName, title }: JoinCalendarWebCallInput) => {
      const normalizedRoomName = roomName.trim()
      if (!normalizedRoomName) {
        throw new Error('Не удалось определить комнату встречи.')
      }

      const activeCall = currentCallRef.current
      if (activeCall?.roomName === normalizedRoomName && activeCall.roomConnected) {
        return
      }

      if (activeCall || incomingCallRef.current || recoverableCallRef.current) {
        throw new Error('Сначала завершите текущий звонок или вернитесь в него.')
      }

      const response = await callRepository.rejoinCalendarCall({
        roomName: normalizedRoomName,
      })

      const snapshot: StoredCallSnapshot = {
        callId: response.eventId || response.roomName || normalizedRoomName,
        roomName: response.roomName || normalizedRoomName,
        chatId: '',
        kind: 'group',
        direction: 'outgoing',
        displayName: response.title || title || 'Встреча в календаре',
        fromName: currentUserNameRef.current,
        fromUserId: currentUserId ?? 0,
        groupId: '',
        groupName: response.title || title || 'Встреча в календаре',
        createdAt: new Date().toISOString(),
      }

      callSessionStore.setCurrentCallSnapshot(snapshot)
      setRecoverableCall(null)
      setIncomingCall(null)
      setCurrentCall(
        createCallState(snapshot, {
          phase: 'connecting',
          token: response.token,
          url: response.url,
        }),
      )

      try {
        await connectToRoom(snapshot, {
          callId: snapshot.callId,
          roomName: snapshot.roomName,
          token: response.token,
          url: response.url,
        }, 'active')
      } catch (error) {
        setRecoverableCall(toRecoverableCall(createSyntheticActiveCall(snapshot), snapshot))
        setCurrentCall(null)
        throw error
      }
    },
    [callRepository, callSessionStore, connectToRoom, currentUserId],
  )

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current
    const activeCall = currentCallRef.current
    if (!room || !activeCall) {
      return
    }

    try {
      await room.localParticipant.setMicrophoneEnabled(!activeCall.isMicrophoneEnabled)
      debugLog('local_microphone_toggled', {
        roomName: activeCall.roomName,
        enabled: !activeCall.isMicrophoneEnabled,
      })
      syncCurrentCallFromRoom(room)
    } catch (error) {
      setCurrentCall((previous) =>
        previous
          ? { ...previous, warning: getErrorMessage(error, 'Не удалось изменить состояние микрофона.') }
          : previous,
      )
    }
  }, [debugLog, syncCurrentCallFromRoom])

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    const activeCall = currentCallRef.current
    if (!room || !activeCall) {
      return
    }

    try {
      await room.localParticipant.setCameraEnabled(!activeCall.isCameraEnabled)
      debugLog('local_camera_toggled', {
        roomName: activeCall.roomName,
        enabled: !activeCall.isCameraEnabled,
      })
      syncCurrentCallFromRoom(room)
    } catch (error) {
      setCurrentCall((previous) =>
        previous
          ? { ...previous, warning: getErrorMessage(error, 'Не удалось изменить состояние камеры.') }
          : previous,
      )
    }
  }, [debugLog, syncCurrentCallFromRoom])

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current
    const activeCall = currentCallRef.current
    if (!room || !activeCall) {
      return
    }

    try {
      await room.localParticipant.setScreenShareEnabled(!activeCall.isScreenShareEnabled)
      debugLog('local_screenshare_toggled', {
        roomName: activeCall.roomName,
        enabled: !activeCall.isScreenShareEnabled,
      })
      syncCurrentCallFromRoom(room)
    } catch (error) {
      setCurrentCall((previous) =>
        previous
          ? { ...previous, warning: getErrorMessage(error, 'Не удалось изменить демонстрацию экрана.') }
          : previous,
      )
    }
  }, [debugLog, syncCurrentCallFromRoom])

  const toggleHandRaise = useCallback(async () => {
    const room = roomRef.current
    if (!room) {
      console.warn('[HandRaise] No room available')
      return
    }
    const localParticipant = room.localParticipant
    if (!localParticipant) {
      console.warn('[HandRaise] No local participant')
      return
    }

    // Read current state from ref (avoid stale closure)
    const localPartState = currentCallRef.current?.participants.find(p => p.isLocal)
    const isCurrentlyRaised = localPartState?.isHandRaised ??
      raisedHandsRef.current[localParticipant.identity] ?? false
    const newStateValue = !isCurrentlyRaised

    console.log('[HandRaise] Toggling:', { from: isCurrentlyRaised, to: newStateValue, identity: localParticipant.identity })

    // 1. Update state immediately
    const nextRaisedHands = { ...raisedHandsRef.current, [localParticipant.identity]: newStateValue }
    if (localParticipant.sid) {
      nextRaisedHands[localParticipant.sid] = newStateValue
    }
    
    raisedHandsRef.current = nextRaisedHands
    setRaisedHands(nextRaisedHands)

    setCurrentCall(prev => {
      if (!prev) return prev
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.isLocal ? { ...p, isHandRaised: newStateValue } : p
        )
      }
    })

    // 2. Publish via Data Channel (primary — compatible with mobile)
    try {
      const encoder = new TextEncoder()
      const payload = encoder.encode(JSON.stringify({
        type: 'raise_hand',
        identity: localParticipant.identity,
        sender_id: localParticipant.identity,
        sender_name: currentUserNameRef.current,
        value: newStateValue
      }))
      await localParticipant.publishData(payload, { reliable: true })
      console.log('[HandRaise] publishData successfully sent for:', localParticipant.identity)
    } catch (e) {
      console.error('[HandRaise] publishData failed:', e)
    }

    // 3. Also set attributes (for LiveKit attribute sync — secondary)
    try {
      const newStateStr = String(newStateValue)
      await localParticipant.setAttributes({
        hand_raised: newStateStr,
        isHandRaised: newStateStr,
        is_hand_raised: newStateStr,
      })
    } catch (e) {
      console.warn('[HandRaise] setAttributes failed (non-critical):', e)
    }
  }, [])


  const sendReaction = useCallback(async (emoji: string) => {
    const room = roomRef.current
    if (!room) return
    
    const timestamp = Date.now()
    const localIdentity = room.localParticipant.identity
    const payload = { 
      type: 'call_reaction',
      id: `${timestamp}_${localIdentity}_${emoji}`,
      emoji,
      sender_id: localIdentity,
      sender_name: currentUserNameRef.current,
      ts: timestamp
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify(payload))
    await room.localParticipant.publishData(data, { reliable: true })

    const localReaction: CallReaction = {
      id: payload.id,
      emoji: payload.emoji,
      senderId: payload.sender_id,
      senderName: payload.sender_name,
      timestamp: payload.ts
    }

    setActiveReactions((prev) => [...prev, localReaction].slice(-20))

    window.setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== localReaction.id))
    }, 4800)

    syncCurrentCallFromRoom(room)

  }, [syncCurrentCallFromRoom])

  const sendChatMessage = useCallback(async (input: { text: string, recipientId?: string, recipientName?: string }) => {
    const room = roomRef.current
    if (!room) return

    const timestamp = Date.now()
    const localIdentity = room.localParticipant.identity
    const msgId = `msg_${timestamp}_${localIdentity}`
    
    const payload = {
      type: 'call_chat',
      id: msgId,
      sender_id: localIdentity,
      sender_name: currentUserNameRef.current,
      recipient_id: input.recipientId,
      recipient_name: input.recipientName,
      text: input.text,
      ts: timestamp
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify(payload))
    
    const options: DataPublishOptions = { reliable: true }
    if (input.recipientId) {
      options.destinationIdentities = [input.recipientId]
    }
    
    await room.localParticipant.publishData(data, options)

    // Add locally immediately
    const localMsg: CallChatMessage = {
      id: msgId,
      senderId: localIdentity,
      senderName: currentUserNameRef.current,
      recipientId: input.recipientId,
      recipientName: input.recipientName,
      text: input.text,
      timestamp,
      isLocal: true
    }
    setCallMessages((prev) => [...prev, localMsg])
  }, [])

  const inviteParticipant = useCallback(async (userId: number) => {
    if (!currentCall || !currentCall.roomName) {
      console.warn('[CallManager] Cannot invite: no active call')
      return
    }

    try {
      await callRepository.inviteToCall({
        calleeId: userId,
        roomName: currentCall.roomName,
        chatId: currentCall.chatId,
      })
      console.log('[CallManager] Invited user %d to room %s', userId, currentCall.roomName)
    } catch (e) {
      console.error('[CallManager] Failed to invite user %d:', userId, e)
      throw e
    }
  }, [currentCall, callRepository])

  const searchUsers = useCallback(async (query: string): Promise<UserDirectoryUser[]> => {
    try {
      const users = await userDirectoryRepository.getUsers()
      if (!query.trim()) return users
      const q = query.toLowerCase()
      return users.filter(u => 
        (u.fullName || '').toLowerCase().includes(q) || 
        (u.username || '').toLowerCase().includes(q) || 
        (u.email || '').toLowerCase().includes(q)
      )
    } catch (e) {
      console.error('[CallManager] searchUsers failed:', e)
      return []
    }
  }, [userDirectoryRepository])


  const dismissRecoverableCall = useCallback(() => {
    setRecoverableCall(null)
    callSessionStore.clearCurrentCallSnapshot()
  }, [callSessionStore])

  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe((event) => {
      const signal = parseCallSignal(event)
      if (!signal) {
        return
      }

      void (async () => {
        switch (signal.type) {
          case 'incoming_call':
          case 'call':
          case 'call_invite':
          case 'call_invitation': {
            if (
              matchesCall(currentCallRef.current, signal.callId, signal.roomName) ||
              matchesCall(incomingCallRef.current, signal.callId, signal.roomName)
            ) {
              return
            }

            if (currentCallRef.current || incomingCallRef.current) {
              await callRepository
                .declineCall({
                  callId: signal.callId,
                  reason: 'busy',
                  roomName: signal.roomName,
                })
                .catch(() => undefined)
              return
            }

            const snapshot = createSignalSnapshot(signal, 'incoming')
            callSessionStore.setCurrentCallSnapshot(snapshot)
            setRecoverableCall(null)
            setIncomingCall(createCallState(snapshot, { phase: 'incoming' }))
            return
          }
          case 'call_accepted': {
            setCurrentCall((previous) => {
              if (!previous || !matchesCall(previous, signal.callId, signal.roomName)) {
                return previous
              }

              return {
                ...previous,
                acceptedByName: signal.acceptedByName || previous.acceptedByName,
                phase: 'active',
                warning: '',
              }
            })
            return
          }
          case 'call_busy':
          case 'call_declined':
          case 'call_ended':
          case 'incoming_call_cancel': {
            const message =
              TERMINAL_SIGNAL_MESSAGES[signal.type] ||
              'Звонок завершен.'

            if (matchesCall(incomingCallRef.current, signal.callId, signal.roomName)) {
              await clearAllCallUi(true)
              return
            }

            if (matchesCall(recoverableCallRef.current?.candidate, signal.callId, signal.roomName)) {
              await clearAllCallUi(true)
              return
            }

            if (matchesCall(currentCallRef.current, signal.callId, signal.roomName)) {
              await showTerminalWarning(message)
            }
            return
          }
          default:
            return
        }
      })()
    })

    return () => {
      unsubscribe()
    }
  }, [callRepository, callSessionStore, clearAllCallUi, realtimeClient, showTerminalWarning])

  useEffect(() => {
    if (currentUserId === null || recoveryBootstrappedRef.current) {
      return
    }

    recoveryBootstrappedRef.current = true
    let cancelled = false

    const bootstrapRecovery = async () => {
      try {
        const snapshot = callSessionStore.getCurrentCallSnapshot()
        const candidates = await callRepository.getActiveCalls(10)
        if (cancelled || currentCallRef.current || incomingCallRef.current) {
          return
        }

        const candidate = pickRecoverableCandidate(candidates, currentUserId, snapshot)
        if (!candidate) {
          if (!recoverableCallRef.current) {
            callSessionStore.clearCurrentCallSnapshot()
          }
          return
        }

        const effectiveSnapshot =
          snapshot && matchesCall(candidate, snapshot.callId, snapshot.roomName)
            ? snapshot
            : deriveSnapshotFromActiveCall(candidate, currentUserId)

        callSessionStore.setCurrentCallSnapshot(effectiveSnapshot)

        if (
          candidate.status === 'initiated' &&
          effectiveSnapshot.direction === 'incoming'
        ) {
          setIncomingCall(createCallState(effectiveSnapshot, { phase: 'incoming' }))
          return
        }

        setRecoverableCall(toRecoverableCall(candidate, effectiveSnapshot))
      } catch {
        // recovery is best-effort only
      }
    }

    void bootstrapRecovery()

    return () => {
      cancelled = true
    }
  }, [callRepository, callSessionStore, currentUserId])

  useEffect(() => () => {
    clearWarningTimer()
    void safeDisconnectRoom()
  }, [clearWarningTimer, safeDisconnectRoom])

  const isBusy = Boolean(currentCall || incomingCall || recoverableCall)
  const busyLabel = recoverableCall
    ? 'Сначала завершите текущий звонок или вернитесь в него.'
    : 'Сначала завершите текущий звонок.'

  const value = useMemo<CallManagerContextValue>(
    () => ({
      busyLabel,
      currentCall,
      incomingCall,
      isBusy,
      recoverableCall,
      activeReactions,
      callMessages,
      unreadChatCount,
      isChatVisible,
      isWhiteboardVisible,
      setChatVisible: setIsChatVisible,
      setWhiteboardVisible: setIsWhiteboardVisible,
      acceptIncomingCall,
      declineIncomingCall,
      dismissRecoverableCall,
      hangUp,
      joinCalendarCall,
      rejoinRecoverableCall,
      startDirectCall,
      startGroupCall,
      toggleCamera,
      toggleMicrophone,
      toggleScreenShare,
      toggleHandRaise,
      sendReaction,
      sendChatMessage,
      inviteParticipant,
    }),
    [
      busyLabel,
      currentCall,
      incomingCall,
      isBusy,
      recoverableCall,
      activeReactions,
      callMessages,
      unreadChatCount,
      isChatVisible,
      acceptIncomingCall,

      declineIncomingCall,
      dismissRecoverableCall,
      hangUp,
      joinCalendarCall,
      rejoinRecoverableCall,
      startDirectCall,
      startGroupCall,
      toggleCamera,
      toggleMicrophone,
      toggleScreenShare,
      toggleHandRaise,
      sendReaction,
      sendChatMessage,
      inviteParticipant,
      isWhiteboardVisible,
    ],
  )

  return (
    <CallManagerContext.Provider value={value}>
      {children}
      <CallOverlay
        room={room}
        currentCall={currentCall}

        incomingCall={incomingCall}
        recoverableCall={recoverableCall}
        busyIncomingLabel={busyLabel}
        isBusy={Boolean(currentCall || recoverableCall)}
        activeReactions={activeReactions}
        callMessages={callMessages}
        unreadChatCount={unreadChatCount}
        isChatVisible={isChatVisible}
        isWhiteboardVisible={isWhiteboardVisible}
        onSetChatVisible={setIsChatVisible}
        onSetWhiteboardVisible={setIsWhiteboardVisible}
        onAcceptIncoming={() => {
          void acceptIncomingCall()
        }}
        onDeclineIncoming={() => {
          void declineIncomingCall()
        }}
        onHangUp={() => {
          void hangUp()
        }}
        onToggleMicrophone={() => {
          void toggleMicrophone()
        }}
        onToggleCamera={() => {
          void toggleCamera()
        }}
        onToggleScreenShare={() => {
          void toggleScreenShare()
        }}
        onToggleHandRaise={() => {
          void toggleHandRaise()
        }}
        onSendReaction={(emoji) => {
          void sendReaction(emoji)
        }}
        onSendMessage={(input) => {
          void sendChatMessage(input)
        }}
        onRejoinRecoverable={() => {
          void rejoinRecoverableCall()
        }}
        onDismissRecoverable={dismissRecoverableCall}
        onInviteParticipant={(userId) => {
          void inviteParticipant(userId)
        }}
        onSearchUsers={searchUsers}
      />

    </CallManagerContext.Provider>
  )
}
