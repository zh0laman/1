import MS from '../../../shared/ui/MaterialSymbol'
import { C } from '../../pages/dashboard/model/constants'
import MessengerAvatar from './MessengerAvatar'

export default function MessengerHeader() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 64,
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        gap: 16,
        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: C.inkMuted, fontWeight: 500 }}>Alem Platform</span>
        <MS name="chevron_right" size={14} color={C.inkFaint} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>Сообщения</span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: C.canvas,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '0 13px',
          height: 38,
          width: 280,
        }}
      >
        <MS name="search" size={15} color={C.inkMuted} />
        <input
          placeholder="Поиск задач, документов, событий…"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: C.ink,
            fontFamily: 'inherit',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: C.surface,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 5,
            padding: '2px 6px',
          }}
        >
          <span style={{ fontSize: 10, color: C.inkMuted, fontWeight: 700 }}>⌘</span>
          <span style={{ fontSize: 10, color: C.inkMuted, fontWeight: 700 }}>K</span>
        </div>
      </div>
      <button
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: C.canvas,
          border: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <MS name="notifications" size={18} color={C.inkSub} />
        <span
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 8,
            height: 8,
            borderRadius: 4,
            background: C.red,
            border: '2px solid #fff',
          }}
        />
      </button>
      <MessengerAvatar initials="АИ" size={36} seed={0} online />
    </header>
  )
}
