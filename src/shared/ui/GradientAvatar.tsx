interface GradientAvatarProps {
  initials: string
  src?: string
  size?: number
  seed?: number
  borderRadius?: number | string
}

const gradients = [
  'linear-gradient(135deg,#1E88E5 0%,#0D47A1 100%)',
  'linear-gradient(135deg,#6235C0 0%,#3B1F8C 100%)',
  'linear-gradient(135deg,#0A8F5C 0%,#065F46 100%)',
  'linear-gradient(135deg,#C47C0A 0%,#92400E 100%)',
]

export default function GradientAvatar({ initials, src, size = 32, seed = 0, borderRadius }: GradientAvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        style={{
          width: size,
          height: size,
          borderRadius: borderRadius ?? size / 2,
          objectFit: 'cover',
          flexShrink: 0,
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        }}
        onError={(e) => {
          // Fallback if image fails to load
          e.currentTarget.style.display = 'none'
          e.currentTarget.parentElement?.setAttribute('data-error', 'true')
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: borderRadius ?? (size / 2),
        background: gradients[seed % gradients.length],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.33,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '0.02em',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}
