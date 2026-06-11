interface EmptyCameraStateProps {
  initials: string
  accentColor: string
  size?: 'compact' | 'regular' | 'hero'
  label?: string
}

export default function EmptyCameraState({
  initials,
  accentColor,
  label,
  size = 'regular',
}: EmptyCameraStateProps) {
  const compact = size === 'compact'
  const hero = size === 'hero'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at 30% 20%, rgba(59,130,246,0.24), transparent 32%), linear-gradient(180deg, #171A1F 0%, #0F1115 100%)',
      }}
    >
      <div
        style={{
          width: compact ? 56 : hero ? 132 : 96,
          height: compact ? 56 : hero ? 132 : 96,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${accentColor} 0%, rgba(37,99,235,0.42) 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#E8EAED',
          fontSize: compact ? 20 : hero ? 44 : 36,
          fontWeight: 700,
          letterSpacing: '0.02em',
          userSelect: 'none',
          flexShrink: 0,
          boxShadow: '0 16px 40px rgba(15,23,42,0.28)',
        }}
      >
        {initials}
      </div>
      {label && !compact ? (
        <div
          style={{
            color: '#CBD5E1',
            fontSize: hero ? 16 : 13,
            fontWeight: 600,
            textAlign: 'center',
            padding: '0 18px',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  )
}
