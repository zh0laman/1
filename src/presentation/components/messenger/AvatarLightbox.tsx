import { useEffect, useState } from 'react'
import MS from '../../../shared/ui/MaterialSymbol'

const gradients = [
  'linear-gradient(135deg,#1E88E5 0%,#0D47A1 100%)',
  'linear-gradient(135deg,#6235C0 0%,#3B1F8C 100%)',
  'linear-gradient(135deg,#0A8F5C 0%,#065F46 100%)',
  'linear-gradient(135deg,#C47C0A 0%,#92400E 100%)',
]

interface AvatarLightboxProps {
  isOpen: boolean
  imageUrl?: string | null
  initials: string
  seed?: number
  title: string
  onClose: () => void
}

export default function AvatarLightbox({
  isOpen,
  imageUrl = null,
  initials,
  seed = 0,
  title,
  onClose,
}: AvatarLightboxProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  
  useEffect(() => {
    if (isOpen) {
      setFailedImageUrl(null)
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const shouldShowImage = Boolean(imageUrl && failedImageUrl !== imageUrl)

  return (
    <>
      <style>{`
        @keyframes avatarLightboxFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes avatarLightboxScaleUp {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(10, 22, 40, 0.86)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          animation: 'avatarLightboxFadeIn 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={onClose}
      >
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#FFFFFF',
            transition: 'background 0.2s ease, transform 0.2s ease',
            zIndex: 10000,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          <MS name="close" size={24} color="#FFFFFF" />
        </button>

        {/* Content Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            maxWidth: '100%',
            animation: 'avatarLightboxScaleUp 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Zoomed Avatar */}
          <div
            style={{
              width: 'min(420px, 80vw)',
              height: 'min(420px, 80vw)',
              borderRadius: '24px',
              background: shouldShowImage ? '#FFFFFF' : gradients[seed % gradients.length],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'min(120px, 24vw)',
              fontWeight: 800,
              color: '#FFFFFF',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12), 0 0 30px rgba(29, 114, 231, 0.25)',
              overflow: 'hidden',
              userSelect: 'none',
            }}
          >
            {shouldShowImage ? (
              <img
                src={imageUrl ?? undefined}
                alt={title}
                onError={() => setFailedImageUrl(imageUrl)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  userSelect: 'none',
                }}
              />
            ) : (
              initials
            )}
          </div>
        </div>
      </div>
    </>
  )
}
