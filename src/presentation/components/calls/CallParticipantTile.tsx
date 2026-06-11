import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, MonitorUp, VideoOff } from 'lucide-react'
import type { LiveKitCallParticipant } from '../../calls/types'
import EmptyCameraState from './EmptyCameraState'

interface CallParticipantTileProps {
  participant: LiveKitCallParticipant
  accentColor: string
  isCompact?: boolean
  spotlight?: boolean
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (parts.length === 0) return '?'
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}

export default function CallParticipantTile({
  participant,
  accentColor,
  isCompact = false,
  spotlight = false,
}: CallParticipantTileProps) {
  const mediaHostRef = useRef<HTMLDivElement | null>(null)
  const audioHostRef = useRef<HTMLDivElement | null>(null)
  const [hovered, setHovered] = useState(false)
  const initials = useMemo(() => getInitials(participant.name), [participant.name])
  const primaryVideoTrack = participant.screenShareTrack ?? participant.videoTrack

  useEffect(() => {
    const host = mediaHostRef.current
    if (!host) {
      return
    }

    host.innerHTML = ''
    if (!primaryVideoTrack) {
      return
    }

    const element = primaryVideoTrack.attach()
    element.style.width = '100%'
    element.style.height = '100%'
    element.style.objectFit = 'cover'
    element.style.borderRadius = 'inherit'
    if (participant.isLocal && !participant.screenShareTrack) {
      element.style.transform = 'scaleX(-1)'
    }
    host.appendChild(element)

    return () => {
      primaryVideoTrack.detach(element)
      element.remove()
    }
  }, [participant.isLocal, participant.screenShareTrack, primaryVideoTrack])

  useEffect(() => {
    const host = audioHostRef.current
    if (!host) {
      return
    }

    host.innerHTML = ''
    if (!participant.audioTrack || participant.isLocal) {
      return
    }

    const element = participant.audioTrack.attach()
    element.autoplay = true
    host.appendChild(element)

    return () => {
      participant.audioTrack?.detach(element)
      element.remove()
    }
  }, [participant.audioTrack, participant.isLocal])

  const ringColor = participant.isSpeaking ? accentColor : 'rgba(255,255,255,0.05)'

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          height: '100%',
          minHeight: isCompact ? 110 : spotlight ? 320 : 180,
          borderRadius: spotlight ? 20 : isCompact ? 16 : 18,
          overflow: 'hidden',
          background: '#1A1D22',
          border: `1px solid ${participant.isSpeaking ? 'rgba(96,165,250,0.44)' : 'rgba(255,255,255,0.06)'}`,
          boxShadow: participant.isSpeaking
            ? '0 0 0 1px rgba(96,165,250,0.28), 0 16px 42px rgba(37,99,235,0.14)'
            : '0 12px 32px rgba(0,0,0,0.22)',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: participant.isSpeaking ? `inset 0 0 0 2px ${ringColor}` : 'none',
            borderRadius: 'inherit',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
        <div
          ref={mediaHostRef}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, #171A1F 0%, #0F1115 100%)',
          }}
        />
        {!primaryVideoTrack ? (
          <EmptyCameraState
            initials={initials}
            accentColor={accentColor}
            size={isCompact ? 'compact' : spotlight ? 'hero' : 'regular'}
            label={participant.name}
          />
        ) : null}
        <div ref={audioHostRef} style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} />

        <div
          style={{
            position: 'absolute',
            inset: 'auto 0 0 0',
            height: spotlight ? 120 : 88,
            background: 'linear-gradient(180deg, transparent 0%, rgba(4,7,12,0.88) 78%, rgba(4,7,12,0.96) 100%)',
            zIndex: 4,
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 'auto 12px 12px 12px',
            zIndex: 5,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: '#F8FAFC',
                fontSize: isCompact ? 12 : 14,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {participant.name}
              {participant.isLocal ? ' (Вы)' : ''}
            </div>
            <div
              style={{
                marginTop: 4,
                color: '#94A3B8',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {participant.connectionQuality ? <span>{participant.connectionQuality}</span> : null}
              {participant.screenShareTrack ? <span>Screen</span> : null}
              {participant.isHandRaised ? <span>Поднята рука</span> : null}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <StatusBubble danger={!participant.isMicrophoneEnabled}>
              {participant.isMicrophoneEnabled ? <Mic size={13} /> : <MicOff size={13} />}
            </StatusBubble>
            {!participant.isCameraEnabled ? (
              <StatusBubble danger>
                <VideoOff size={13} />
              </StatusBubble>
            ) : null}
            {participant.screenShareTrack ? (
              <StatusBubble primary>
                <MonitorUp size={13} />
              </StatusBubble>
            ) : null}
          </div>
        </div>

        {participant.isHandRaised ? (
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 5,
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#FBBF24',
              color: '#111827',
              boxShadow: '0 12px 24px rgba(251,191,36,0.24)',
              fontSize: 17,
            }}
          >
            ✋
          </div>
        ) : null}
      </div>
    </>
  )
}

function StatusBubble({
  children,
  danger = false,
  primary = false,
}: {
  children: React.ReactNode
  danger?: boolean
  primary?: boolean
}) {
  return (
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: primary
          ? 'rgba(37,99,235,0.88)'
          : danger
            ? 'rgba(217,48,37,0.92)'
            : 'rgba(255,255,255,0.14)',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {children}
    </span>
  )
}
