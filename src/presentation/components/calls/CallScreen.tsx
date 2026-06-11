import { useMemo, useState } from 'react'
import type { Room } from 'livekit-client'
import { CalendarDays, Copy, Info, Users, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { CallChatMessage, CallReaction, LiveKitCallState } from '../../calls/types'
import type { UserDirectoryUser } from '../../../infrastructure/repositories/HttpUserDirectoryRepository'
import CallChatPanel from './CallChatPanel'
import CallControls from './CallControls'
import CallHeader from './CallHeader'
import CallVideoGrid from './CallVideoGrid'
import CallWhiteboard from './CallWhiteboard'

interface CallScreenProps {
  room: Room | null
  currentCall: LiveKitCallState
  activeReactions: CallReaction[]
  callMessages: CallChatMessage[]
  unreadChatCount: number
  isChatVisible: boolean
  isWhiteboardVisible: boolean
  onSetChatVisible: (visible: boolean) => void
  onSetWhiteboardVisible: (visible: boolean) => void
  onHangUp: () => void
  onToggleMicrophone: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onToggleHandRaise: () => void
  onSendReaction: (emoji: string) => void
  onSendMessage: (input: { text: string; recipientId?: string; recipientName?: string }) => void
  onInviteParticipant: (userId: number) => void
  onSearchUsers?: (query: string) => Promise<UserDirectoryUser[]>
}

const ACCENT = '#60A5FA'

type SidePanelMode = 'participants' | 'info' | null

export default function CallScreen({
  room,
  currentCall,
  activeReactions,
  callMessages,
  unreadChatCount,
  isChatVisible,
  isWhiteboardVisible,
  onSetChatVisible,
  onSetWhiteboardVisible,
  onHangUp,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
  onToggleHandRaise,
  onSendReaction,
  onSendMessage,
  onInviteParticipant,
  onSearchUsers,
}: CallScreenProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>(null)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserDirectoryUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [invitedUserIds, setInvitedUserIds] = useState<Set<number>>(new Set())

  const participants = currentCall.participants ?? []
  const localParticipant = participants.find((p) => p.isLocal) ?? null
  const meetingLabel = location.pathname.includes('/calls/calendar/') ? 'Calendar meeting' : 'Call'

  const connectionInfo = useMemo(() => {
    if (currentCall.warning?.includes('Восстанавлив')) {
      return { tone: 'reconnecting' as const, label: 'Переподключение' }
    }
    if (currentCall.warning && currentCall.phase === 'error') {
      return { tone: 'error' as const, label: 'Ошибка подключения' }
    }
    if (currentCall.phase === 'connecting') {
      return {
        tone: currentCall.roomConnected ? ('reconnecting' as const) : ('connecting' as const),
        label: currentCall.roomConnected ? 'Переподключение' : 'Подключение',
      }
    }
    if (currentCall.roomConnected) {
      return { tone: 'connected' as const, label: 'Подключено' }
    }
    if (currentCall.phase === 'error') {
      return { tone: 'error' as const, label: 'Ошибка' }
    }
    return { tone: 'disconnected' as const, label: 'Отключено' }
  }, [currentCall.phase, currentCall.roomConnected, currentCall.warning])

  const title =
    currentCall.displayName ||
    (location.pathname.includes('/calls/calendar/') ? 'Онлайн-встреча' : currentCall.kind === 'group' ? 'Групповой звонок' : 'Видеозвонок')

  const subtitle =
    currentCall.kind === 'group'
      ? currentCall.groupName || currentCall.roomName
      : currentCall.acceptedByName
        ? `В разговоре с ${currentCall.acceptedByName}`
        : currentCall.phase === 'ringing'
          ? 'Ожидаем ответа...'
          : currentCall.roomName

  const handleCopyLink = async () => {
    const href = typeof window !== 'undefined' ? window.location.href : currentCall.roomName
    try {
      await navigator.clipboard.writeText(href)
    } catch {
      // ignore clipboard errors in UI
    }
  }

  const closePanels = () => {
    setSidePanelMode(null)
    onSetChatVisible(false)
  }

  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          right: 16,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          width: 340,
          height: 220,
          zIndex: 1500,
          borderRadius: 18,
          overflow: 'hidden',
          background: '#101318',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.36)',
        }}
      >
        <CallHeader
          title={title}
          subtitle={subtitle}
          roomName={currentCall.roomName}
          participantCount={participants.length}
          connectionTone={connectionInfo.tone}
          connectionLabel={connectionInfo.label}
          isMinimized
          startedAt={currentCall.createdAt}
          isScreenShareEnabled={currentCall.isScreenShareEnabled}
          meetingLabel={meetingLabel}
          onOpenParticipants={() => setSidePanelMode('participants')}
          onCopyLink={handleCopyLink}
          onMinimize={() => setIsMinimized(false)}
        />
        <div style={{ position: 'absolute', inset: 0 }}>
          <CallVideoGrid call={currentCall} participants={participants} accentColor={ACCENT} isMinimized />
        </div>
        <CallControls
          isMicrophoneEnabled={currentCall.isMicrophoneEnabled}
          isCameraEnabled={currentCall.isCameraEnabled}
          isScreenShareEnabled={currentCall.isScreenShareEnabled}
          isHandRaised={Boolean(localParticipant?.isHandRaised)}
          isChatVisible={isChatVisible}
          isWhiteboardVisible={isWhiteboardVisible}
          isParticipantsVisible={sidePanelMode === 'participants'}
          isInfoVisible={sidePanelMode === 'info'}
          hasUnreadChat={unreadChatCount > 0}
          isMinimized
          onToggleMicrophone={onToggleMicrophone}
          onToggleCamera={onToggleCamera}
          onToggleScreenShare={onToggleScreenShare}
          onToggleHandRaise={onToggleHandRaise}
          onToggleChat={() => onSetChatVisible(!isChatVisible)}
          onToggleWhiteboard={() => onSetWhiteboardVisible(!isWhiteboardVisible)}
          onOpenParticipants={() => setSidePanelMode(sidePanelMode === 'participants' ? null : 'participants')}
          onToggleInfo={() => setSidePanelMode(sidePanelMode === 'info' ? null : 'info')}
          onToggleEmojiPicker={() => setShowEmojiPicker((prev) => !prev)}
          onHangUp={onHangUp}
          onExpand={() => setIsMinimized(false)}
        />
      </div>
    )
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1500,
          display: 'grid',
          gridTemplateColumns:
            sidePanelMode || isChatVisible ? 'minmax(0, 1fr) minmax(320px, 360px)' : 'minmax(0, 1fr)',
          background: '#0F1115',
          color: '#E2E8F0',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', minWidth: 0, overflow: 'hidden' }}>
          <CallHeader
            title={title}
            subtitle={subtitle}
            roomName={currentCall.roomName}
            participantCount={participants.length}
            connectionTone={connectionInfo.tone}
            connectionLabel={connectionInfo.label}
            startedAt={currentCall.createdAt}
            isScreenShareEnabled={currentCall.isScreenShareEnabled}
            meetingLabel={meetingLabel}
            onOpenParticipants={() => setSidePanelMode(sidePanelMode === 'participants' ? null : 'participants')}
            onCopyLink={handleCopyLink}
            onMinimize={() => {
              setIsMinimized(true)
              closePanels()
            }}
          />
          <CallVideoGrid call={currentCall} participants={participants} accentColor={ACCENT} />

          {currentCall.warning ? (
            <div
              style={{
                position: 'absolute',
                top: 86,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 25,
                maxWidth: 'min(90vw, 560px)',
                borderRadius: 16,
                padding: '12px 18px',
                background: 'rgba(127, 29, 29, 0.84)',
                border: '1px solid rgba(248,113,113,0.22)',
                color: '#FEE2E2',
                fontSize: 13,
                fontWeight: 600,
                backdropFilter: 'blur(16px)',
              }}
            >
              {currentCall.warning}
            </div>
          ) : null}

          {room && localParticipant ? (
            <div
              style={{
                display: isWhiteboardVisible ? 'block' : 'none',
                position: 'absolute',
                inset: 0,
                zIndex: 100,
              }}
            >
              <CallWhiteboard
                room={room}
                onClose={() => onSetWhiteboardVisible(false)}
                currentUserName={localParticipant.name || ''}
                isVisible={isWhiteboardVisible}
              />
            </div>
          ) : null}

          <CallControls
            isMicrophoneEnabled={currentCall.isMicrophoneEnabled}
            isCameraEnabled={currentCall.isCameraEnabled}
            isScreenShareEnabled={currentCall.isScreenShareEnabled}
            isHandRaised={Boolean(localParticipant?.isHandRaised)}
            isChatVisible={isChatVisible}
            isWhiteboardVisible={isWhiteboardVisible}
            isParticipantsVisible={sidePanelMode === 'participants'}
            isInfoVisible={sidePanelMode === 'info'}
            hasUnreadChat={unreadChatCount > 0}
            onToggleMicrophone={onToggleMicrophone}
            onToggleCamera={onToggleCamera}
            onToggleScreenShare={onToggleScreenShare}
            onToggleHandRaise={onToggleHandRaise}
            onToggleChat={() => {
              setSidePanelMode(null)
              onSetChatVisible(!isChatVisible)
            }}
            onToggleWhiteboard={() => onSetWhiteboardVisible(!isWhiteboardVisible)}
            onOpenParticipants={() => {
              onSetChatVisible(false)
              setSidePanelMode(sidePanelMode === 'participants' ? null : 'participants')
            }}
            onToggleInfo={() => {
              onSetChatVisible(false)
              setSidePanelMode(sidePanelMode === 'info' ? null : 'info')
            }}
            onToggleEmojiPicker={() => setShowEmojiPicker((prev) => !prev)}
            onHangUp={onHangUp}
            onExpand={() => setIsMinimized(false)}
          />
        </div>

        {isChatVisible && localParticipant ? (
          <CallChatPanel
            messages={callMessages}
            onSendMessage={(text, recipientId, recipientName) =>
              onSendMessage({ text, recipientId, recipientName })
            }
            onClose={() => onSetChatVisible(false)}
            localIdentity={localParticipant.identity}
            participants={participants.map((p) => ({
              identity: p.identity,
              name: p.name,
            }))}
          />
        ) : null}

        {sidePanelMode ? (
          <CallSidePanel
            mode={sidePanelMode}
            title={title}
            roomName={currentCall.roomName}
            participants={participants}
            userSearchQuery={userSearchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            invitedUserIds={invitedUserIds}
            onClose={() => setSidePanelMode(null)}
            onCopyLink={handleCopyLink}
            onOpenCalendar={() => navigate('/calendar')}
            onSearchChange={(value) => {
              setUserSearchQuery(value)
              if (!onSearchUsers || !value.trim()) {
                setSearchResults([])
                setIsSearching(false)
                return
              }
              setIsSearching(true)
              onSearchUsers(value)
                .then((results) => {
                  setSearchResults(results)
                  setIsSearching(false)
                })
                .catch(() => setIsSearching(false))
            }}
            onInvite={(userId) => {
              if (invitedUserIds.has(userId)) return
              onInviteParticipant(userId)
              setInvitedUserIds((prev) => {
                const next = new Set(prev)
                next.add(userId)
                return next
              })
            }}
          />
        ) : null}
      </div>

      {showEmojiPicker ? (
        <div onClick={() => setShowEmojiPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 1600 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 8,
              padding: '12px 14px',
              borderRadius: 999,
              background: 'rgba(8,10,13,0.94)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              zIndex: 1601,
            }}
          >
            {['👍', '❤️', '😂', '👏', '🎉', '😮'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSendReaction(emoji)
                  setShowEmojiPicker(false)
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.06)',
                  fontSize: 22,
                  cursor: 'pointer',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1700, overflow: 'hidden' }}>
        {activeReactions.map((reaction) => (
          <FloatingReaction key={reaction.id} reaction={reaction} />
        ))}
      </div>
    </>
  )
}

function FloatingReaction({ reaction }: { reaction: CallReaction }) {
  const [leftOffset] = useState(() => Math.random() * 46 - 23)
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 132,
        left: `calc(50% + ${leftOffset}%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        animation: 'call-float-up 4s ease-out forwards',
      }}
    >
      <span style={{ fontSize: 42 }}>{reaction.emoji}</span>
      <div
        style={{
          padding: '4px 9px',
          borderRadius: 999,
          background: 'rgba(8,10,13,0.86)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#E2E8F0',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {reaction.senderName}
      </div>
      <style>{`
        @keyframes call-float-up {
          0% { transform: translateY(0); opacity: 0; }
          12% { opacity: 1; }
          82% { opacity: 1; }
          100% { transform: translateY(-260px); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function CallSidePanel({
  mode,
  title,
  roomName,
  participants,
  userSearchQuery,
  searchResults,
  isSearching,
  invitedUserIds,
  onClose,
  onCopyLink,
  onOpenCalendar,
  onSearchChange,
  onInvite,
}: {
  mode: 'participants' | 'info'
  title: string
  roomName: string
  participants: LiveKitCallState['participants']
  userSearchQuery: string
  searchResults: UserDirectoryUser[]
  isSearching: boolean
  invitedUserIds: Set<number>
  onClose: () => void
  onCopyLink: () => void
  onOpenCalendar: () => void
  onSearchChange: (value: string) => void
  onInvite: (userId: number) => void
}) {
  const panelTitle = mode === 'participants' ? 'Участники' : 'Информация о встрече'

  return (
    <aside
      style={{
        position: 'relative',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(12,14,18,0.96)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '-20px 0 50px rgba(0,0,0,0.24)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '18px 18px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div>
          <div style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 700 }}>{panelTitle}</div>
          <div style={{ marginTop: 4, color: '#94A3B8', fontSize: 12 }}>{mode === 'participants' ? `${participants.length} в звонке` : roomName}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: '#CBD5E1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {mode === 'participants' ? (
          <>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Пригласить участника..."
                style={{
                  width: '100%',
                  height: 46,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#F8FAFC',
                  outline: 'none',
                  padding: '0 14px',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
              {participants.map((participant) => (
                <div
                  key={participant.sid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 16,
                    padding: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                    }}
                  >
                    {(participant.name || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: '#F8FAFC', fontSize: 14, fontWeight: 600 }}>
                      {participant.name}
                      {participant.isLocal ? ' (Вы)' : ''}
                    </div>
                    <div style={{ marginTop: 4, color: '#94A3B8', fontSize: 12 }}>
                      {participant.isLocal ? 'Organizer' : 'Participant'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, color: '#94A3B8', fontSize: 11 }}>
                    <span>{participant.isMicrophoneEnabled ? 'Mic on' : 'Mic off'}</span>
                    <span>{participant.isCameraEnabled ? 'Cam on' : 'Cam off'}</span>
                  </div>
                </div>
              ))}
            </div>

            {userSearchQuery.trim() ? (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: '#94A3B8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Найденные пользователи
                </div>
                {isSearching ? (
                  <div style={{ color: '#94A3B8', fontSize: 13 }}>Поиск...</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ color: '#94A3B8', fontSize: 13 }}>Пользователи не найдены</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          borderRadius: 14,
                          padding: 12,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background: 'rgba(37,99,235,0.2)',
                            color: '#BFDBFE',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                          }}
                        >
                          {(user.fullName || user.username || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ color: '#F8FAFC', fontSize: 14, fontWeight: 600 }}>{user.fullName || user.username}</div>
                          <div style={{ marginTop: 3, color: '#94A3B8', fontSize: 12 }}>{user.username}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onInvite(user.id)}
                          disabled={invitedUserIds.has(user.id)}
                          style={{
                            height: 36,
                            borderRadius: 999,
                            border: 'none',
                            padding: '0 14px',
                            background: invitedUserIds.has(user.id) ? 'rgba(255,255,255,0.08)' : '#2563EB',
                            color: '#FFFFFF',
                            cursor: invitedUserIds.has(user.id) ? 'default' : 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          {invitedUserIds.has(user.id) ? 'Приглашён' : 'Invite'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <InfoCard icon={<CalendarDays size={16} />} title="Встреча">
              {title}
            </InfoCard>
            <InfoCard icon={<Users size={16} />} title="Участники">
              {participants.length}
            </InfoCard>
            <InfoCard icon={<Info size={16} />} title="Комната">
              <code style={{ fontSize: 12, color: '#BFDBFE' }}>{roomName}</code>
            </InfoCard>
            <div style={{ display: 'grid', gap: 10 }}>
              <button
                type="button"
                onClick={onCopyLink}
                style={infoButtonStyle}
              >
                <Copy size={15} />
                <span>Скопировать ссылку</span>
              </button>
              <button
                type="button"
                onClick={onOpenCalendar}
                style={secondaryInfoButtonStyle}
              >
                <CalendarDays size={15} />
                <span>Вернуться в календарь</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 14,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {icon}
        <span>{title}</span>
      </div>
      <div style={{ marginTop: 10, color: '#F8FAFC', fontSize: 14, fontWeight: 600 }}>{children}</div>
    </div>
  )
}

const infoButtonStyle = {
  height: 42,
  borderRadius: 14,
  border: 'none',
  background: '#2563EB',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
  fontWeight: 700,
} as const

const secondaryInfoButtonStyle = {
  ...infoButtonStyle,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.08)',
} as const
