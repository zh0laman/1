import { Check, Copy, Minimize2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ConnectionStatus from './ConnectionStatus'

interface CallHeaderProps {
  title: string
  subtitle: string
  roomName: string
  participantCount: number
  connectionTone: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error'
  connectionLabel: string
  isRecording?: boolean
  isMinimized?: boolean
  startedAt?: string
  isScreenShareEnabled?: boolean
  meetingLabel?: string
  onOpenParticipants: () => void
  onCopyLink: () => void
  onMinimize: () => void
}

const formatDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return [hours, minutes, seconds].map((v) => String(v).padStart(2, '0')).join(':')
  }
  return [minutes, seconds].map((v) => String(v).padStart(2, '0')).join(':')
}

const formatClock = (value: Date): string =>
  value.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

export default function CallHeader({
  title,
  subtitle,
  roomName,
  participantCount,
  connectionTone,
  connectionLabel,
  isRecording = false,
  isMinimized = false,
  startedAt,
  isScreenShareEnabled = false,
  meetingLabel = 'Online meeting',
  onOpenParticipants,
  onCopyLink,
  onMinimize,
}: CallHeaderProps) {
  const startedAtTime = useMemo(
    () => (startedAt ? new Date(startedAt).getTime() : Number.NaN),
    [startedAt],
  )
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (Number.isNaN(startedAtTime)) {
      return
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [startedAtTime])

  useEffect(() => {
    if (!copied) {
      return
    }
    const timeout = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const durationSeconds = Number.isNaN(startedAtTime)
    ? 0
    : Math.max(0, Math.floor((now - startedAtTime) / 1000))

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: isMinimized ? '10px 12px' : '16px 18px 10px',
        background: 'linear-gradient(180deg, rgba(8,10,13,0.84) 0%, rgba(8,10,13,0.48) 58%, transparent 100%)',
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 999,
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.08)',
              color: '#CBD5E1',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {meetingLabel}
          </span>
          {isScreenShareEnabled ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 999,
                padding: '4px 10px',
                background: 'rgba(37,99,235,0.22)',
                color: '#BFDBFE',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Screen sharing
            </span>
          ) : null}
          {isRecording ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 999,
                padding: '4px 10px',
                background: 'rgba(217,48,37,0.18)',
                color: '#FCA5A5',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#F87171',
                }}
              />
              REC
            </span>
          ) : null}
        </div>
        <div
          style={{
            color: '#F8FAFC',
            fontSize: isMinimized ? 14 : 24,
            fontWeight: 700,
            lineHeight: 1.1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        {!isMinimized ? (
          <div
            style={{
              color: '#94A3B8',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span>{subtitle || roomName}</span>
            {durationSeconds > 0 ? <span>{formatDuration(durationSeconds)}</span> : null}
            <span>{formatClock(new Date(now))}</span>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onOpenParticipants}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 38,
            borderRadius: 999,
            padding: '0 14px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(12,14,18,0.58)',
            color: '#E2E8F0',
            cursor: 'pointer',
          }}
          title="Участники"
        >
          <Users size={15} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{participantCount}</span>
        </button>
        {!isMinimized ? (
          <ConnectionStatus tone={connectionTone} label={connectionLabel} />
        ) : null}
        <button
          type="button"
          onClick={() => {
            onCopyLink()
            setCopied(true)
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(12,14,18,0.58)',
            color: copied ? '#86EFAC' : '#E2E8F0',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title={copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        {!isMinimized ? (
          <button
            type="button"
            onClick={onMinimize}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(12,14,18,0.58)',
              color: '#E2E8F0',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Свернуть"
          >
            <Minimize2 size={16} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
