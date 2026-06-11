import { useEffect, useRef } from 'react'
import { C } from '../../pages/dashboard/model/constants'
import { formatRecordingDuration } from './utils'

type Props = {
  stream: MediaStream | null
  durationSeconds: number
  isLocked: boolean
}

const PREVIEW_SIZE = 248
const RING_SIZE = 280
const RING_RADIUS = 126
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const RING_ACTIVE_ARC = RING_CIRCUMFERENCE * 0.24

export default function VideoMessageRecordingPreview({ stream, durationSeconds, isLocked }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.srcObject = stream

    if (!stream) {
      return
    }

    const playVideo = async () => {
      try {
        await video.play()
      } catch {
        return
      }
    }

    void playVideo()

    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null
      }
    }
  }, [stream])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, calc(-50% - 18px))',
        zIndex: 4,
        pointerEvents: 'none',
        display: 'grid',
        justifyItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: RING_SIZE,
          height: RING_SIZE,
          display: 'grid',
          placeItems: 'center',
          filter: 'drop-shadow(0 26px 56px rgba(22, 53, 102, 0.24))',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 22,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 44%, rgba(138,196,255,0.20) 0%, rgba(138,196,255,0.07) 42%, rgba(138,196,255,0) 72%)',
            animation: 'messenger-video-recording-pulse 2.4s ease-in-out infinite',
          }}
        />

        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'visible',
            transform: 'rotate(-102deg)',
          }}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="rgba(72, 157, 255, 0.16)"
            strokeWidth="7"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={isLocked ? '#2C8CFF' : '#43A4FF'}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${RING_ACTIVE_ARC} ${RING_CIRCUMFERENCE}`}
            style={{
              animation: 'messenger-video-recording-ring-spin 1.6s linear infinite',
              transformOrigin: '50% 50%',
              transition: 'stroke 0.18s ease',
              filter: 'drop-shadow(0 0 10px rgba(67,164,255,0.42))',
            }}
          />
        </svg>

        <div
          style={{
            width: PREVIEW_SIZE,
            height: PREVIEW_SIZE,
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            background: 'linear-gradient(180deg, #CFD8E6 0%, #B9C7DB 100%)',
            border: '1px solid rgba(255,255,255,0.58)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.16)',
          }}
        >
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'linear-gradient(180deg, rgba(11,22,41,0.02) 0%, rgba(11,22,41,0.10) 100%)',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          height: 38,
          padding: '0 14px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.92)',
          border: `1px solid ${C.borderLight}`,
          boxShadow: '0 12px 26px rgba(10,22,40,0.10)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#FF6262',
            boxShadow: '0 0 0 6px rgba(255,98,98,0.14)',
            animation: 'messenger-video-recording-dot 1.25s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1,
            color: C.ink,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
            fontFamily: 'Roboto, "Segoe UI", sans-serif',
          }}
        >
          {formatRecordingDuration(durationSeconds)}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: isLocked ? C.blue : C.inkMuted,
            lineHeight: 1,
            fontFamily: 'Roboto, "Segoe UI", sans-serif',
          }}
        >
          {isLocked ? 'Кружок записывается' : 'Запись кружка'}
        </span>
      </div>

      <style>
        {`
          @keyframes messenger-video-recording-pulse {
            0% { transform: scale(0.98); opacity: 0.54; }
            50% { transform: scale(1.02); opacity: 0.96; }
            100% { transform: scale(0.98); opacity: 0.54; }
          }
          @keyframes messenger-video-recording-dot {
            0% { opacity: 1; }
            50% { opacity: 0.38; }
            100% { opacity: 1; }
          }
          @keyframes messenger-video-recording-ring-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}
