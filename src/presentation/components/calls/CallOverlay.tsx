import { type CSSProperties } from 'react'
import type { Room } from 'livekit-client'
import type { CallChatMessage, CallReaction, LiveKitCallState, RecoverableCallState } from '../../calls/types'
import type { UserDirectoryUser } from '../../../infrastructure/repositories/HttpUserDirectoryRepository'
import CallScreen from './CallScreen'

interface CallOverlayProps {
  room: Room | null
  currentCall: LiveKitCallState | null
  incomingCall: LiveKitCallState | null
  recoverableCall: RecoverableCallState | null
  busyIncomingLabel: string
  isBusy: boolean
  activeReactions: CallReaction[]
  callMessages: CallChatMessage[]
  unreadChatCount: number
  isChatVisible: boolean
  isWhiteboardVisible: boolean
  onSetChatVisible: (visible: boolean) => void
  onSetWhiteboardVisible: (visible: boolean) => void
  onAcceptIncoming: () => void
  onDeclineIncoming: () => void
  onHangUp: () => void
  onToggleMicrophone: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onToggleHandRaise: () => void
  onSendReaction: (emoji: string) => void
  onSendMessage: (input: { text: string; recipientId?: string; recipientName?: string }) => void
  onRejoinRecoverable: () => void
  onDismissRecoverable: () => void
  onInviteParticipant: (userId: number) => void
  onSearchUsers?: (query: string) => Promise<UserDirectoryUser[]>
}

export default function CallOverlay({
  room,
  currentCall,
  incomingCall,
  recoverableCall,
  busyIncomingLabel,
  isBusy,
  activeReactions,
  callMessages,
  unreadChatCount,
  isChatVisible,
  isWhiteboardVisible,
  onSetChatVisible,
  onSetWhiteboardVisible,
  onAcceptIncoming,
  onDeclineIncoming,
  onHangUp,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
  onToggleHandRaise,
  onSendReaction,
  onSendMessage,
  onRejoinRecoverable,
  onDismissRecoverable,
  onInviteParticipant,
  onSearchUsers,
}: CallOverlayProps) {
  return (
    <>
      {recoverableCall ? (
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
            zIndex: 1200,
            width: 320,
            borderRadius: 22,
            border: '1px solid rgba(125, 162, 255, 0.22)',
            background: 'rgba(9, 13, 20, 0.96)',
            color: '#F8FBFF',
            boxShadow: '0 24px 60px rgba(4, 10, 20, 0.46)',
            backdropFilter: 'blur(18px)',
            padding: 18,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BED2FF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Активный звонок
          </div>
          <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{recoverableCall.displayName}</div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45, color: 'rgba(228, 236, 248, 0.82)' }}>
            {recoverableCall.subtitle}
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button type="button" onClick={onRejoinRecoverable} style={primaryButtonStyle}>
              Вернуться
            </button>
            <button type="button" onClick={onDismissRecoverable} style={secondaryButtonStyle}>
              Скрыть
            </button>
          </div>
        </div>
      ) : null}

      {incomingCall ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(7, 12, 24, 0.62)',
            backdropFilter: 'blur(18px) saturate(1.2)',
            padding: 24,
          }}
        >
          <div
            style={{
              width: 340,
              maxWidth: '92vw',
              borderRadius: 38,
              padding: '42px 32px 36px',
              background: '#0F1218',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 42px 100px rgba(0,0,0,0.65)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div style={{ position: 'relative', width: 92, height: 92, marginBottom: 24 }}>
              <div
                style={{
                  position: 'absolute',
                  inset: -8,
                  borderRadius: '50%',
                  background: 'rgba(125, 162, 255, 0.12)',
                  animation: 'telegram-call-pulse 2s ease-out infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1E3A8A 0%, #7DA2FF 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  fontWeight: 900,
                  boxShadow: '0 12px 28px rgba(13, 71, 161, 0.32)',
                }}
              >
                {(incomingCall.displayName || 'S')[0].toUpperCase()}
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 800, color: '#A8C2FF', textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.9 }}>
              {incomingCall.kind === 'group' ? 'Групповой вызов' : 'Видеозвонок'}
            </div>
            <div style={{ marginTop: 12, fontSize: 24, fontWeight: 900, lineHeight: 1.1, color: '#F8FAFD' }}>
              {incomingCall.displayName}
            </div>
            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, color: 'rgba(228, 236, 248, 0.65)', fontWeight: 500 }}>
              {incomingCall.kind === 'group' ? incomingCall.groupName || 'Входящий звонок' : 'Входящий вызов...'}
            </div>

            {isBusy ? (
              <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: '#FCA5A5', background: 'rgba(248, 113, 113, 0.1)', padding: '6px 12px', borderRadius: 12 }}>
                {busyIncomingLabel}
              </div>
            ) : null}

            <div style={{ marginTop: 42, display: 'flex', width: '100%', gap: 14 }}>
              <button type="button" onClick={onDeclineIncoming} style={declineButtonStyle}>
                Отклонить
              </button>
              <button type="button" onClick={onAcceptIncoming} style={acceptButtonStyle}>
                Принять
              </button>
            </div>
          </div>

          <style>{`
            @keyframes telegram-call-pulse {
              0% { transform: scale(1); opacity: 0.8; }
              100% { transform: scale(1.6); opacity: 0; }
            }
          `}</style>
        </div>
      ) : null}

      {currentCall ? (
        <CallScreen
          room={room}
          currentCall={currentCall}
          activeReactions={activeReactions}
          callMessages={callMessages}
          unreadChatCount={unreadChatCount}
          isChatVisible={isChatVisible}
          isWhiteboardVisible={isWhiteboardVisible}
          onSetChatVisible={onSetChatVisible}
          onSetWhiteboardVisible={onSetWhiteboardVisible}
          onHangUp={onHangUp}
          onToggleMicrophone={onToggleMicrophone}
          onToggleCamera={onToggleCamera}
          onToggleScreenShare={onToggleScreenShare}
          onToggleHandRaise={onToggleHandRaise}
          onSendReaction={onSendReaction}
          onSendMessage={onSendMessage}
          onInviteParticipant={onInviteParticipant}
          onSearchUsers={onSearchUsers}
        />
      ) : null}
    </>
  )
}

const primaryButtonStyle: CSSProperties = {
  flex: 1,
  height: 48,
  borderRadius: 16,
  border: 'none',
  background: 'linear-gradient(135deg, #2563EB 0%, #7DA2FF 100%)',
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 18px 32px rgba(37,99,235,0.24)',
}

const secondaryButtonStyle: CSSProperties = {
  flex: 1,
  height: 48,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)',
  color: '#F8FBFF',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}

const declineButtonStyle: CSSProperties = {
  flex: 1,
  height: 62,
  borderRadius: 22,
  border: 'none',
  background: 'rgba(239, 68, 68, 0.15)',
  color: '#FF8A8A',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
}

const acceptButtonStyle: CSSProperties = {
  flex: 1,
  height: 62,
  borderRadius: 22,
  border: 'none',
  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  color: '#FFFFFF',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 18px 34px rgba(16, 185, 129, 0.24)',
}
