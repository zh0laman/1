import { C } from '../../pages/dashboard/model/constants'

type LoadingBubble = {
  id: string
  side: 'left' | 'right'
  width: number
  lines: number[]
  withAvatar?: boolean
  tint?: 'surface' | 'accent'
}

const MESSAGE_BUBBLES: LoadingBubble[] = [
  {
    id: 'left-1',
    side: 'left',
    width: 228,
    lines: [150, 82],
    withAvatar: true,
    tint: 'surface',
  },
  {
    id: 'right-1',
    side: 'right',
    width: 194,
    lines: [132, 96],
    tint: 'accent',
  },
  {
    id: 'left-2',
    side: 'left',
    width: 254,
    lines: [172, 126, 88],
    withAvatar: true,
    tint: 'surface',
  },
  {
    id: 'right-2',
    side: 'right',
    width: 168,
    lines: [110, 74],
    tint: 'accent',
  },
]

function SkeletonLine({ width, tinted = false }: { width: number; tinted?: boolean }) {
  return (
    <div
      style={{
        width,
        maxWidth: '100%',
        height: 10,
        borderRadius: 999,
        background: tinted
          ? 'linear-gradient(90deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.22) 100%)'
          : 'linear-gradient(90deg, rgba(121,146,182,0.10) 0%, rgba(121,146,182,0.22) 50%, rgba(121,146,182,0.10) 100%)',
        backgroundSize: '200% 100%',
        animation: 'messenger-chat-loading-shimmer 1.8s ease-in-out infinite',
      }}
    />
  )
}

export default function ChatHistoryLoadingState() {
  return (
    <div
      aria-hidden="true"
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '10px 2px 4px',
      }}
    >
      <style>
        {`
          @keyframes messenger-chat-loading-shimmer {
            0% { background-position: 200% 0; opacity: 0.72; }
            50% { opacity: 1; }
            100% { background-position: -200% 0; opacity: 0.72; }
          }
          @keyframes messenger-chat-loading-float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-2px); }
            100% { transform: translateY(0px); }
          }
        `}
      </style>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <div
          style={{
            height: 26,
            minWidth: 92,
            padding: '0 14px',
            borderRadius: 999,
            border: `1px solid ${C.borderLight}`,
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 8px 18px rgba(10,22,40,0.05)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 58,
              height: 8,
              borderRadius: 999,
              background: 'linear-gradient(90deg, rgba(121,146,182,0.12) 0%, rgba(121,146,182,0.26) 50%, rgba(121,146,182,0.12) 100%)',
              backgroundSize: '200% 100%',
              animation: 'messenger-chat-loading-shimmer 1.8s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {MESSAGE_BUBBLES.map((bubble) => {
          const isRight = bubble.side === 'right'
          const isAccent = bubble.tint === 'accent'

          return (
            <div
              key={bubble.id}
              style={{
                display: 'flex',
                justifyContent: isRight ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: isRight ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 10,
                  maxWidth: '72%',
                  animation: 'messenger-chat-loading-float 2.8s ease-in-out infinite',
                }}
              >
                {bubble.withAvatar ? (
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: 'linear-gradient(135deg, rgba(71,129,233,0.30) 0%, rgba(102,184,255,0.20) 100%)',
                      boxShadow: '0 8px 18px rgba(66,117,194,0.12)',
                    }}
                  />
                ) : null}

                <div
                  style={{
                    width: bubble.width,
                    maxWidth: '100%',
                    borderRadius: isRight ? '18px 18px 8px 18px' : '18px 18px 18px 8px',
                    border: isAccent ? '1px solid rgba(46,137,255,0.10)' : `1px solid ${C.borderLight}`,
                    background: isAccent
                      ? 'linear-gradient(180deg, rgba(226,239,255,0.98) 0%, rgba(214,231,255,0.98) 100%)'
                      : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,255,0.98) 100%)',
                    boxShadow: isAccent
                      ? '0 12px 28px rgba(61,131,227,0.12)'
                      : '0 10px 24px rgba(10,22,40,0.06)',
                    padding: '14px 14px 12px',
                  }}
                >
                  <div style={{ display: 'grid', gap: 8 }}>
                    {bubble.lines.map((lineWidth, index) => (
                      <SkeletonLine key={`${bubble.id}-${index}`} width={lineWidth} tinted={isAccent} />
                    ))}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 8,
                        borderRadius: 999,
                        background: isAccent ? 'rgba(255,255,255,0.42)' : 'rgba(121,146,182,0.18)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            height: 34,
            padding: '0 14px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.82)',
            border: `1px solid ${C.borderLight}`,
            boxShadow: '0 10px 22px rgba(10,22,40,0.06)',
            color: C.inkMuted,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: C.blue,
              boxShadow: `0 0 0 4px ${C.blue}1A`,
            }}
          />
          Загружаем последние сообщения
        </div>
      </div>
    </div>
  )
}
