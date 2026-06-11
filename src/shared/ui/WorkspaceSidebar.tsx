/* eslint-disable */
// @ts-nocheck
import { useNavigate } from 'react-router-dom'
import { SIDEBAR_THEME as C, WORKSPACE_NAV_GROUPS } from '../config/workspaceSidebar'
import MaterialSymbol from './MaterialSymbol'
import GradientAvatar from './GradientAvatar'

interface WorkspaceSidebarProps {
  active: string
  setActive: (value: string) => void
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  onLogout: () => Promise<void>
  isLoggingOut: boolean
}

export default function WorkspaceSidebar({
  active,
  setActive,
  collapsed,
  setCollapsed,
  onLogout,
  isLoggingOut,
}: WorkspaceSidebarProps) {
  const navigate = useNavigate()
  const width = collapsed ? 68 : 248

  return (
    <aside
      style={{
        width,
        minHeight: '100vh',
        background: C.sb,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 200,
        borderRight: `1px solid ${C.sbBorder}`,
        transition: 'width 0.24s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0 18px' : '0 22px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 12,
          borderBottom: `1px solid ${C.sbBorder}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            flexShrink: 0,
            background: `linear-gradient(145deg, ${C.blue} 0%, ${C.blueDark} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 14px ${C.blueGlow}`,
          }}
        >
          <MaterialSymbol name="hub" size={18} color="#fff" />
        </div>
        {!collapsed ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>ALEM</div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: C.sbText,
                letterSpacing: '0.14em',
                marginTop: 3,
                textTransform: 'uppercase',
              }}
            >
              Digital Platform
            </div>
          </div>
        ) : null}
      </div>

      <nav style={{ flex: 1, padding: '16px 10px', overflowY: 'auto', overflowX: 'hidden' }}>
        {WORKSPACE_NAV_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} style={{ marginBottom: 24 }}>
            {!collapsed ? (
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: C.sbText,
                  padding: '0 12px',
                  marginBottom: 6,
                  opacity: 0.7,
                }}
              >
                {group.label}
              </div>
            ) : null}
            {group.items.map((item) => {
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActive(item.id)
                    if (item.id === 'home') {
                      navigate('/dashboard')
                    }
                    if (item.id === 'workspace') {
                      navigate('/workspace')
                    }
                    if (item.id === 'calendar') {
                      navigate('/calendar')
                    }
                    if (item.id === 'alemstore') {
                      navigate('/alemstore')
                    }
                    if (item.id === 'profile') {
                      navigate('/profile')
                    }
                    if (item.id === 'board') {
                      navigate('/board')
                    }
                    if (item.id === 'chat') {
                      navigate('/messenger')
                    }
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: collapsed ? '10px 0' : '9px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive ? C.sbActive : 'transparent',
                    color: isActive ? C.sbActiveText : C.sbText,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    marginBottom: 2,
                    borderLeft: isActive ? `2px solid ${C.blue}` : '2px solid transparent',
                    transition: 'background 0.14s, color 0.14s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(event) => {
                    if (!isActive) {
                      event.currentTarget.style.background = C.sbHover
                      event.currentTarget.style.color = C.sbTextHover
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (!isActive) {
                      event.currentTarget.style.background = 'transparent'
                      event.currentTarget.style.color = C.sbText
                    }
                  }}
                >
                  <MaterialSymbol name={item.icon} size={17} color={isActive ? C.blue : 'inherit'} />
                  {!collapsed ? <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span> : null}
                  {!collapsed && item.badge ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: '16px',
                        background: isActive ? C.blue : 'rgba(255,255,255,0.09)',
                        color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                        borderRadius: 8,
                        padding: '0 7px',
                        minWidth: 20,
                        textAlign: 'center',
                      }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div style={{ padding: '0 10px 16px' }}>
          <div
            style={{
              background: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blueDark} 100%)`,
              borderRadius: 12,
              padding: '14px 14px',
              border: '1px solid rgba(30,136,229,0.25)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: -16,
                top: -16,
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'rgba(30,136,229,0.12)',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(30,136,229,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialSymbol name="auto_awesome" size={14} color="#60ADFF" />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>AI-ассистент</span>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, margin: 0 }}>
              Задайте вопрос по задачам, встречам или документам
            </p>
            <div style={{ marginTop: 10, fontSize: 10, fontWeight: 700, color: C.blue, display: 'flex', alignItems: 'center', gap: 4 }}>
              Открыть чат <MaterialSymbol name="arrow_forward" size={12} color={C.blue} />
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ borderTop: `1px solid ${C.sbBorder}`, padding: '12px 10px', flexShrink: 0 }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: C.sbText,
            fontFamily: 'inherit',
            fontSize: 12,
            marginBottom: 8,
            transition: 'background 0.14s',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = C.sbHover
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent'
          }}
        >
          <MaterialSymbol name={collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'} size={16} color={C.sbText} />
          {!collapsed ? <span>Свернуть панель</span> : null}
        </button>

        {!collapsed ? (
          <div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 9, cursor: 'pointer', transition: 'background 0.14s' }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = C.sbHover
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent'
              }}
            >
              <GradientAvatar initials="АИ" size={32} seed={0} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Айдана Ибраева
                </div>
                <div style={{ fontSize: 10, color: C.sbText, marginTop: 1 }}>Администратор</div>
              </div>
              <MaterialSymbol name="more_vert" size={16} color={C.sbText} />
            </div>
            <button
              onClick={() => {
                void onLogout()
              }}
              disabled={isLoggingOut}
              style={{
                width: '100%',
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                cursor: isLoggingOut ? 'default' : 'pointer',
                background: isLoggingOut ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: isLoggingOut ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.8)',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <MaterialSymbol name="logout" size={14} color="inherit" />
              {isLoggingOut ? 'Выход...' : 'Выйти'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GradientAvatar initials="АИ" size={32} seed={0} />
          </div>
        )}
      </div>
    </aside>
  )
}
