import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  Hand,
  Info,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Presentation,
  PhoneOff,
  ScreenShare,
  Smile,
  Users,
  Video,
  VideoOff,
} from 'lucide-react'

interface CallControlsProps {
  isMicrophoneEnabled: boolean
  isCameraEnabled: boolean
  isScreenShareEnabled: boolean
  isHandRaised: boolean
  isChatVisible: boolean
  isWhiteboardVisible: boolean
  isParticipantsVisible?: boolean
  isInfoVisible?: boolean
  hasUnreadChat: boolean
  isMinimized?: boolean
  onToggleMicrophone: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onToggleHandRaise: () => void
  onToggleChat: () => void
  onToggleWhiteboard: () => void
  onOpenParticipants: () => void
  onToggleInfo: () => void
  onToggleEmojiPicker: () => void
  onHangUp: () => void
  onExpand: () => void
}

type Tone = 'neutral' | 'primary' | 'danger' | 'warning'

const toneStyles: Record<Tone, { bg: string; color: string; hover: string; shadow: string }> = {
  neutral: {
    bg: 'rgba(255,255,255,0.1)',
    color: '#F8FAFC',
    hover: 'rgba(255,255,255,0.16)',
    shadow: 'none',
  },
  primary: {
    bg: 'rgba(37, 99, 235, 0.94)',
    color: '#FFFFFF',
    hover: '#1D4ED8',
    shadow: '0 10px 30px rgba(37,99,235,0.28)',
  },
  danger: {
    bg: '#D93025',
    color: '#FFFFFF',
    hover: '#B42318',
    shadow: '0 10px 30px rgba(217,48,37,0.26)',
  },
  warning: {
    bg: '#F59E0B',
    color: '#111827',
    hover: '#D97706',
    shadow: '0 10px 30px rgba(245,158,11,0.22)',
  },
}

function ControlButton({
  label,
  icon,
  tone,
  badge = false,
  compact = false,
  onClick,
}: {
  label: string
  icon: ReactNode
  tone: Tone
  badge?: boolean
  compact?: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const size = compact ? 44 : 50
  const colors = toneStyles[tone]

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.08)',
        background: hovered ? colors.hover : colors.bg,
        color: colors.color,
        boxShadow: colors.shadow,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 140ms ease, background 140ms ease, box-shadow 140ms ease',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {icon}
      {badge ? (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#22C55E',
            border: '2px solid rgba(15,17,21,0.96)',
          }}
        />
      ) : null}
    </button>
  )
}

const wrapStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
  transform: 'translateX(-50%)',
  zIndex: 40,
  width: 'min(calc(100vw - 28px), 780px)',
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
}

export default function CallControls({
  isMicrophoneEnabled,
  isCameraEnabled,
  isScreenShareEnabled,
  isHandRaised,
  isChatVisible,
  isWhiteboardVisible,
  isParticipantsVisible = false,
  isInfoVisible = false,
  hasUnreadChat,
  isMinimized = false,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
  onToggleHandRaise,
  onToggleChat,
  onToggleWhiteboard,
  onOpenParticipants,
  onToggleInfo,
  onToggleEmojiPicker,
  onHangUp,
  onExpand,
}: CallControlsProps) {
  const iconSize = isMinimized ? 18 : 20

  if (isMinimized) {
    return (
      <div style={wrapStyle}>
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 999,
            background: 'rgba(8,10,13,0.82)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          <ControlButton label="Развернуть" icon={<Maximize2 size={iconSize} />} tone="neutral" onClick={onExpand} compact />
          <ControlButton
            label={isMicrophoneEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            icon={isMicrophoneEnabled ? <Mic size={iconSize} /> : <MicOff size={iconSize} />}
            tone={isMicrophoneEnabled ? 'neutral' : 'danger'}
            onClick={onToggleMicrophone}
            compact
          />
          <ControlButton
            label={isCameraEnabled ? 'Выключить камеру' : 'Включить камеру'}
            icon={isCameraEnabled ? <Video size={iconSize} /> : <VideoOff size={iconSize} />}
            tone={isCameraEnabled ? 'neutral' : 'danger'}
            onClick={onToggleCamera}
            compact
          />
          <ControlButton label="Завершить звонок" icon={<PhoneOff size={iconSize} />} tone="danger" onClick={onHangUp} compact />
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={wrapStyle}>
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            borderRadius: 999,
            background: 'rgba(8,10,13,0.82)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          }}
        >
          <ControlButton
            label={isMicrophoneEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            icon={isMicrophoneEnabled ? <Mic size={iconSize} /> : <MicOff size={iconSize} />}
            tone={isMicrophoneEnabled ? 'neutral' : 'danger'}
            onClick={onToggleMicrophone}
          />
          <ControlButton
            label={isCameraEnabled ? 'Выключить камеру' : 'Включить камеру'}
            icon={isCameraEnabled ? <Video size={iconSize} /> : <VideoOff size={iconSize} />}
            tone={isCameraEnabled ? 'neutral' : 'danger'}
            onClick={onToggleCamera}
          />
          <ControlButton
            label={isScreenShareEnabled ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'}
            icon={<ScreenShare size={iconSize} />}
            tone={isScreenShareEnabled ? 'primary' : 'neutral'}
            onClick={onToggleScreenShare}
          />
          <ControlButton
            label="Участники"
            icon={<Users size={iconSize} />}
            tone={isParticipantsVisible ? 'primary' : 'neutral'}
            onClick={onOpenParticipants}
          />
          <ControlButton
            label="Информация о встрече"
            icon={<Info size={iconSize} />}
            tone={isInfoVisible ? 'primary' : 'neutral'}
            onClick={onToggleInfo}
          />
          <ControlButton
            label="Чат"
            icon={<MessageSquare size={iconSize} />}
            tone={isChatVisible ? 'primary' : 'neutral'}
            onClick={onToggleChat}
            badge={hasUnreadChat}
          />
          <ControlButton
            label="Доска"
            icon={<Presentation size={iconSize} />}
            tone={isWhiteboardVisible ? 'primary' : 'neutral'}
            onClick={onToggleWhiteboard}
          />
          <ControlButton
            label={isHandRaised ? 'Опустить руку' : 'Поднять руку'}
            icon={<Hand size={iconSize} />}
            tone={isHandRaised ? 'warning' : 'neutral'}
            onClick={onToggleHandRaise}
          />
          <ControlButton
            label="Реакции"
            icon={<Smile size={iconSize} />}
            tone="neutral"
            onClick={onToggleEmojiPicker}
          />
          <div
            style={{
              width: 1,
              alignSelf: 'stretch',
              background: 'rgba(255,255,255,0.08)',
            }}
          />
          <ControlButton
            label="Завершить звонок"
            icon={<PhoneOff size={iconSize} />}
            tone="danger"
            onClick={onHangUp}
          />
        </div>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .call-controls-wrap {
            width: calc(100vw - 20px);
          }
        }
      `}</style>
    </>
  )
}
