import { useEffect, useMemo, useState } from 'react'
import type { LiveKitCallParticipant, LiveKitCallState } from '../../calls/types'
import CallParticipantTile from './CallParticipantTile'

interface CallVideoGridProps {
  call: LiveKitCallState
  participants: LiveKitCallParticipant[]
  accentColor: string
  isMinimized?: boolean
}

const getGridColumns = (count: number): string => {
  if (count <= 1) return 'minmax(0, 1fr)'
  if (count === 2) return 'repeat(2, minmax(0, 1fr))'
  if (count <= 4) return 'repeat(2, minmax(0, 1fr))'
  if (count <= 9) return 'repeat(3, minmax(0, 1fr))'
  return 'repeat(3, minmax(0, 1fr))'
}

export default function CallVideoGrid({
  call,
  participants,
  accentColor,
  isMinimized = false,
}: CallVideoGridProps) {
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const orderedParticipants = useMemo(
    () =>
      participants.slice().sort((a, b) => {
        const leftScore =
          Number(Boolean(a.screenShareTrack)) * 100 +
          Number(Boolean(a.isSpeaking)) * 10 +
          Number(Boolean(a.isLocal)) * 3 +
          Number(Boolean(a.isCameraEnabled))
        const rightScore =
          Number(Boolean(b.screenShareTrack)) * 100 +
          Number(Boolean(b.isSpeaking)) * 10 +
          Number(Boolean(b.isLocal)) * 3 +
          Number(Boolean(b.isCameraEnabled))
        return rightScore - leftScore
      }),
    [participants],
  )

  const count = orderedParticipants.length
  const useSpotlightLayout = !isMinimized && count > 9 && windowWidth > 1024
  const leadParticipant = useSpotlightLayout ? orderedParticipants[0] : null
  const galleryParticipants = useSpotlightLayout ? orderedParticipants.slice(1) : orderedParticipants
  const isWaiting =
    !isMinimized &&
    count <= 1 &&
    (call.phase === 'connecting' || call.phase === 'ringing' || !call.roomConnected)

  if (useSpotlightLayout && leadParticipant) {
    return (
      <>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 320px',
            gap: 14,
            padding: '92px 18px calc(env(safe-area-inset-bottom, 0px) + 108px)',
          }}
        >
          <div style={{ minHeight: 0 }}>
            <CallParticipantTile participant={leadParticipant} accentColor={accentColor} spotlight />
          </div>
          <div
            style={{
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gridAutoRows: 'minmax(110px, 1fr)',
              gap: 10,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {galleryParticipants.map((participant) => (
              <CallParticipantTile
                key={participant.sid}
                participant={participant}
                accentColor={accentColor}
                isCompact
              />
            ))}
          </div>
        </div>
        {isWaiting ? <WaitingBadge connecting={call.phase === 'connecting'} /> : null}
      </>
    )
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns:
            !isMinimized && windowWidth < 640 ? 'minmax(0, 1fr)' : getGridColumns(count),
          gridAutoRows:
            count <= 1
              ? 'minmax(0, 1fr)'
              : count <= 4
                ? 'minmax(220px, 1fr)'
                : 'minmax(160px, 1fr)',
          gap: isMinimized ? 8 : 12,
          padding: isMinimized
            ? 8
            : '92px 18px calc(env(safe-area-inset-bottom, 0px) + 108px)',
          overflowY: 'auto',
          alignContent: count === 1 ? 'center' : 'stretch',
        }}
      >
        {orderedParticipants.map((participant) => (
          <div
            key={participant.sid}
            style={{
              minHeight: isMinimized ? 110 : count === 1 ? 0 : 180,
              maxWidth: count === 1 ? 'min(100%, 1120px)' : 'none',
              width: '100%',
              justifySelf: count === 1 ? 'center' : 'stretch',
              aspectRatio: count === 1 ? '16 / 9' : undefined,
            }}
          >
            <CallParticipantTile
              participant={participant}
              accentColor={accentColor}
              isCompact={isMinimized}
              spotlight={count === 1}
            />
          </div>
        ))}
      </div>
      {isWaiting ? <WaitingBadge connecting={call.phase === 'connecting'} /> : null}
    </>
  )
}

function WaitingBadge({ connecting }: { connecting: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 112px)',
        transform: 'translateX(-50%)',
        zIndex: 15,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        borderRadius: 999,
        padding: '10px 16px',
        background: 'rgba(8,10,13,0.84)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#E2E8F0',
        backdropFilter: 'blur(20px)',
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: connecting ? '#60A5FA' : '#F59E0B',
          animation: 'call-wait-pulse 1.2s ease-in-out infinite',
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 600 }}>
        {connecting ? 'Подключение к встрече...' : 'Ожидаем других участников...'}
      </span>
      <style>{`
        @keyframes call-wait-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.78); }
        }
      `}</style>
    </div>
  )
}
