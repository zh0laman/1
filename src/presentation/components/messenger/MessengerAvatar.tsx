import { useState } from 'react'
import { C } from '../../pages/dashboard/model/constants'

const gradients = [
  'linear-gradient(135deg,#1E88E5 0%,#0D47A1 100%)',
  'linear-gradient(135deg,#6235C0 0%,#3B1F8C 100%)',
  'linear-gradient(135deg,#0A8F5C 0%,#065F46 100%)',
  'linear-gradient(135deg,#C47C0A 0%,#92400E 100%)',
]

interface MessengerAvatarProps {
  initials: string
  imageUrl?: string | null
  size?: number
  seed?: number
  online?: boolean
}

export default function MessengerAvatar({ initials, imageUrl = null, size = 36, seed = 0, online = false }: MessengerAvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const shouldShowImage = Boolean(imageUrl && failedImageUrl !== imageUrl)
  const onlineDotSize = Math.max(11, Math.round(size * 0.28))
  const onlineDotBorder = Math.max(2, Math.round(size * 0.06))

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          background: shouldShowImage ? '#FFFFFF' : gradients[seed % gradients.length],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.32,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.02em',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        {shouldShowImage ? (
          <img
            src={imageUrl ?? undefined}
            alt={initials}
            onError={() => setFailedImageUrl(imageUrl)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          initials
        )}
      </div>
      {online ? (
        <div
          style={{
            position: 'absolute',
            bottom: Math.max(1, Math.round(size * 0.03)),
            right: Math.max(1, Math.round(size * 0.03)),
            width: onlineDotSize,
            height: onlineDotSize,
            borderRadius: onlineDotSize / 2,
            background: C.green,
            border: `${onlineDotBorder}px solid #fff`,
          }}
        />
      ) : null}
    </div>
  )
}
