interface ConnectionStatusProps {
  tone: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error'
  label: string
  compact?: boolean
}

const toneMap: Record<
  ConnectionStatusProps['tone'],
  { dot: string; bg: string; border: string; text: string; pulse: boolean }
> = {
  connected: {
    dot: '#34A853',
    bg: 'rgba(32,33,36,0.88)',
    border: 'rgba(52,168,83,0.28)',
    text: '#E8EAED',
    pulse: false,
  },
  connecting: {
    dot: '#FBBC04',
    bg: 'rgba(32,33,36,0.88)',
    border: 'rgba(251,188,4,0.3)',
    text: '#E8EAED',
    pulse: true,
  },
  reconnecting: {
    dot: '#4285F4',
    bg: 'rgba(32,33,36,0.88)',
    border: 'rgba(66,133,244,0.3)',
    text: '#E8EAED',
    pulse: true,
  },
  disconnected: {
    dot: '#9AA0A6',
    bg: 'rgba(32,33,36,0.88)',
    border: 'rgba(154,160,166,0.2)',
    text: '#9AA0A6',
    pulse: false,
  },
  error: {
    dot: '#EA4335',
    bg: 'rgba(32,33,36,0.88)',
    border: 'rgba(234,67,53,0.28)',
    text: '#E8EAED',
    pulse: false,
  },
}

export default function ConnectionStatus({ tone, label, compact = false }: ConnectionStatusProps) {
  const colors = toneMap[tone]

  return (
    <>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          borderRadius: 999,
          padding: compact ? '6px 10px' : '7px 12px',
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          color: colors.text,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <span
          style={{
            width: compact ? 7 : 8,
            height: compact ? 7 : 8,
            borderRadius: '50%',
            background: colors.dot,
            flexShrink: 0,
            animation: colors.pulse ? 'meet-dot-pulse 1.4s ease-in-out infinite' : 'none',
          }}
        />
        {!compact && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        )}
      </div>
      <style>{`
        @keyframes meet-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
    </>
  )
}
