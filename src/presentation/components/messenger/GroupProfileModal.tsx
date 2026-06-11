import { useState, useEffect } from 'react'
import type { ChatGroupDetails, ChatGroupMember } from '../../../domain/entities/Chat'
import type { UserDirectoryUser } from '../../../infrastructure/repositories/HttpUserDirectoryRepository'
import MS from '../../../shared/ui/MaterialSymbol'
import { C } from '../../pages/dashboard/model/constants'
import MessengerAvatar from './MessengerAvatar'
import type { ChatListItem } from './types'
import { getInitials, getSeed } from './utils'
import AvatarLightbox from './AvatarLightbox'
import { MESSENGER_VIDEO_CALLS_ENABLED } from './featureFlags'

interface GroupProfileModalProps {
  isOpen: boolean
  onClose: () => void
  activeChat: ChatListItem | null
  currentUserId: number | null
  groupDetails: ChatGroupDetails | null
  groupMembers: ChatGroupMember[]
  groupMembersError: string
  groupMembersActionError: string
  isGroupMembersUpdating: boolean
  directoryUsers: UserDirectoryUser[]
  isSearchingUsers: boolean
  userSearchError: string
  onLoadDirectoryUsers: () => void
  onAddGroupMember: (userId: number) => void
  onRemoveGroupMember: (userId: number) => void
  onUpdateGroupMemberRole: (userId: number, role: 'member' | 'admin') => void
  onLeaveGroup: () => void
  onOpenUserProfile: (userId: number) => void
  isMuted?: boolean
  muteBusy?: boolean
  onToggleMute?: () => void
  onCall?: () => void
}

export default function GroupProfileModal({
  isOpen,
  onClose,
  activeChat,
  currentUserId,
  groupDetails,
  groupMembers,
  groupMembersError,
  groupMembersActionError,
  isGroupMembersUpdating,
  directoryUsers,
  isSearchingUsers,
  userSearchError,
  onLoadDirectoryUsers,
  onAddGroupMember,
  onRemoveGroupMember,
  onUpdateGroupMemberRole,
  onLeaveGroup,
  onOpenUserProfile,
  isMuted = false,
  muteBusy = false,
  onToggleMute,
  onCall,
}: GroupProfileModalProps) {
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [zoomedAvatar, setZoomedAvatar] = useState<{
    imageUrl?: string | null
    initials: string
    seed: number
    title: string
  } | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setZoomedAvatar(null)
      setIsAddMembersOpen(false)
      setMemberSearch('')
    }
  }, [isOpen])

  if (!isOpen || !activeChat) {
    return null
  }

  const currentGroupMember = groupMembers.find((member) => member.id === currentUserId) ?? null
  const canManageGroupMembers = activeChat.chat.type === 'group' && (currentGroupMember?.role === 'owner' || currentGroupMember?.role === 'admin')
  
  const existingMemberIds = new Set(groupMembers.map((member) => member.id))
  const filteredAvailableUsers = directoryUsers
    .filter((user) => !existingMemberIds.has(user.id))
    .filter((user) => {
      const query = memberSearch.trim().toLowerCase()
      if (!query) return true
      return [user.fullName, user.username, user.email].filter(Boolean).join(' ').toLowerCase().includes(query)
    })
    .slice(0, 10)

  return (
    <>
      <style>{`
        @keyframes scaleUp {
          from {
            transform: scale(0.96);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-up {
          animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .custom-profile-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-profile-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-profile-scroll::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 99px;
        }
        .custom-profile-scroll::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 560,
          background: 'rgba(10,22,40,0.18)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
        onClick={onClose}
      >
        {/* Modal Main Panel */}
        <div
          style={{
            width: 580,
            maxWidth: 'calc(100vw - 24px)',
            height: 'min(90vh, 840px)',
            background: '#F1F3F6',
            borderRadius: 24,
            boxShadow: '0 28px 80px rgba(10,22,40,0.16)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
          className="animate-scale-up"
          onClick={(event) => event.stopPropagation()}
        >
          {/* 1. Header Navigation Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 100px',
              alignItems: 'center',
              padding: '14px 18px',
              background: '#F1F3F6',
              borderBottom: '1px solid #E8EDF2',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: C.ink,
                cursor: 'pointer',
                padding: 0,
                outline: 'none',
              }}
            >
              <MS name="close" size={20} color={C.ink} />
            </button>
            <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: C.ink }}>Группа</div>
            <div />
          </div>

          {/* 2. Scrollable Body Content */}
          <div style={{ flex: 1, overflowY: 'auto' }} className="custom-profile-scroll">
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            {/* Profile Header Block */}
            <div style={{ display: 'grid', justifyItems: 'center', padding: '24px 24px 16px', background: '#F1F3F6' }}>
              <button
                type="button"
                onClick={() => {
                  setZoomedAvatar({
                    imageUrl: activeChat.avatarUrl,
                    initials: activeChat.avatar,
                    seed: activeChat.seed,
                    title: activeChat.title,
                  })
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  borderRadius: '50%',
                  outline: 'none',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                <MessengerAvatar initials={activeChat.avatar} imageUrl={activeChat.avatarUrl} size={96} seed={activeChat.seed} />
              </button>

              <h2 style={{ marginTop: 16, fontSize: 20, fontWeight: 700, color: C.ink, textAlign: 'center' }}>{activeChat.title}</h2>
              <p style={{ marginTop: 4, fontSize: 13, color: C.inkMuted, fontWeight: 500 }}>
                {groupMembers.length} участников
              </p>
            </div>

            {/* Description Row (White Card) */}
            {groupDetails?.description && (
              <div
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  background: '#FFFFFF',
                  margin: '0 16px 16px',
                  padding: 16,
                  border: `1px solid ${C.borderLight}`,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: C.ink,
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 11, color: C.inkMuted, fontWeight: 600, textTransform: 'lowercase', marginBottom: 4 }}>описание</div>
                <div style={{ fontWeight: 500 }}>{groupDetails.description}</div>
              </div>
            )}

            {/* Notifications switch Row (White Card) */}
            {onToggleMute ? (
              <div
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  background: '#FFFFFF',
                  margin: '0 16px 16px',
                  boxShadow: '0 2px 8px rgba(10,22,40,0.01)',
                  border: `1px solid ${C.borderLight}`,
                }}
              >
                <button
                  type="button"
                  disabled={muteBusy}
                  onClick={onToggleMute}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: muteBusy ? 'default' : 'pointer',
                    outline: 'none',
                    opacity: muteBusy ? 0.75 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <MS name={isMuted ? 'notifications_off' : 'notifications'} size={20} color={isMuted ? C.inkMuted : C.blue} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>
                      {isMuted ? 'Уведомления выключены' : 'Уведомления включены'}
                    </span>
                  </div>
                  <span style={{ fontSize: 14, color: isMuted ? C.blue : C.inkMuted, fontWeight: 500 }}>
                    {isMuted ? 'Включить' : 'Отключить'}
                  </span>
                </button>
              </div>
            ) : null}

            {/* Video Call Row (White Card) */}
            {MESSENGER_VIDEO_CALLS_ENABLED && onCall ? (
              <div
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  background: '#FFFFFF',
                  margin: '0 16px 16px',
                  boxShadow: '0 2px 8px rgba(10,22,40,0.01)',
                  border: `1px solid ${C.borderLight}`,
                }}
              >
                <button
                  type="button"
                  onClick={onCall}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <MS name="videocam" size={20} color={C.blue} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>
                      Видеозвонок
                    </span>
                  </div>
                  <span style={{ fontSize: 14, color: C.blue, fontWeight: 700 }}>
                    Начать
                  </span>
                </button>
              </div>
            ) : null}

            {/* 3. Members section */}
            <div>
              {/* Member Search / Add Block */}
              {isAddMembersOpen && (
                <div 
                  style={{ 
                    borderRadius: 20, 
                    overflow: 'hidden',
                    background: '#FFFFFF', 
                    margin: '0 16px 16px', 
                    padding: 16, 
                    border: `1px solid ${C.borderLight}`,
                    boxShadow: '0 4px 12px rgba(10,22,40,0.01)',
                  }}
                >
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      background: '#F1F3F6', 
                      borderRadius: 12, 
                      padding: '6px 12px', 
                      marginBottom: 12,
                      border: `1px solid ${C.borderLight}`
                    }}
                  >
                    <MS name="search" size={18} color={C.inkMuted} />
                    <input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Поиск по имени или почте..."
                      style={{
                        flex: 1,
                        height: 32,
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: 14,
                        color: C.ink,
                      }}
                    />
                  </div>
                  
                  {userSearchError && <div style={{ fontSize: 12, color: C.red, marginBottom: 12, paddingLeft: 4 }}>{userSearchError}</div>}
                  
                  <div style={{ display: 'grid', gap: 8, maxHeight: 200, overflowY: 'auto' }} className="custom-profile-scroll">
                    {isSearchingUsers ? <div style={{ textAlign: 'center', padding: 14, color: C.inkMuted, fontSize: 13 }}>Загрузка...</div> : null}
                    {!isSearchingUsers && filteredAvailableUsers.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 14, color: C.inkMuted, fontSize: 13 }}>Пользователи не найдены</div>
                    )}
                    {filteredAvailableUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => onAddGroupMember(user.id)}
                        disabled={isGroupMembersUpdating}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '8px 12px',
                          borderRadius: 14,
                          border: `1px solid ${C.borderLight}`,
                          background: '#F8FAFC',
                          width: '100%',
                          textAlign: 'left',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <MessengerAvatar initials={getInitials(user.fullName)} imageUrl={user.avatarUrl} size={36} seed={getSeed(user.fullName)} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.fullName}
                          </div>
                        </div>
                        <MS name="add_circle" size={20} color={C.blue} style={{ flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Members Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 24px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: '0.04em' }}>
                  УЧАСТНИКИ ({groupMembers.length})
                </span>
                {canManageGroupMembers && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMembersOpen(!isAddMembersOpen)
                      if (!isAddMembersOpen && directoryUsers.length === 0) onLoadDirectoryUsers()
                    }}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.blue,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      outline: 'none',
                    }}
                  >
                    {isAddMembersOpen ? 'Скрыть поиск' : 'Добавить участника'}
                  </button>
                )}
              </div>

              {/* Members list inside Telegram-style white card wrapper */}
              <div 
                style={{ 
                  background: '#FFFFFF', 
                  borderRadius: 20, 
                  overflow: 'hidden', 
                  margin: '0 16px 16px',
                  border: `1px solid ${C.borderLight}` 
                }}
              >
                {groupMembersError ? <div style={{ padding: 14, color: C.red, fontSize: 13 }}>{groupMembersError}</div> : null}
                {groupMembers.map((member, idx) => {
                  const isCurrentUser = member.id === currentUserId
                  const canManageThis = canManageGroupMembers && !isCurrentUser && member.role !== 'owner'
                  const memberTitle = member.fullName || member.username || `User ${member.id}`
                  
                  return (
                    <div key={member.id}>
                      {idx > 0 && <div style={{ height: 1, background: C.borderLight, margin: '0 16px' }} />}
                      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setZoomedAvatar({
                              imageUrl: member.avatarUrl,
                              initials: getInitials(memberTitle),
                              seed: getSeed(memberTitle),
                              title: memberTitle,
                            })
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            borderRadius: '50%',
                            outline: 'none',
                            transition: 'transform 0.2s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                        >
                          <MessengerAvatar initials={getInitials(memberTitle)} imageUrl={member.avatarUrl} size={38} seed={getSeed(memberTitle)} />
                        </button>
                        
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{memberTitle}</span>
                            <span 
                              style={{ 
                                fontSize: 9, 
                                fontWeight: 800, 
                                color: member.role === 'owner' ? '#B45309' : member.role === 'admin' ? C.blue : C.inkMuted,
                                background: member.role === 'owner' ? '#FFFBEB' : member.role === 'admin' ? C.blueSoft : '#F1F5F9',
                                padding: '1px 6px',
                                borderRadius: 4,
                                textTransform: 'uppercase'
                              }}
                            >
                              {member.role === 'owner' ? 'Владелец' : member.role === 'admin' ? 'Админ' : 'Участник'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Member item controls */}
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => onOpenUserProfile(member.id)}
                            style={{ 
                              width: 32, 
                              height: 32, 
                              borderRadius: 10, 
                              border: 'none', 
                              background: '#F1F3F6', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                            title="Профиль"
                          >
                            <MS name="person" size={16} color={C.blue} />
                          </button>
                          
                          {canManageThis && (
                            <>
                              <button
                                type="button"
                                onClick={() => onUpdateGroupMemberRole(member.id, member.role === 'admin' ? 'member' : 'admin')}
                                style={{ 
                                  width: 32, 
                                  height: 32, 
                                  borderRadius: 10, 
                                  border: 'none', 
                                  background: '#F1F3F6', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  cursor: 'pointer',
                                  outline: 'none',
                                }}
                                title={member.role === 'admin' ? "Назначить участником" : "Назначить админом"}
                              >
                                <MS name={member.role === 'admin' ? "arrow_downward" : "arrow_upward"} size={16} color={C.blue} />
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => onRemoveGroupMember(member.id)}
                                style={{ 
                                  width: 32, 
                                  height: 32, 
                                  borderRadius: 10, 
                                  border: 'none', 
                                  background: '#FFF1F2', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  cursor: 'pointer',
                                  outline: 'none',
                                }}
                                title="Удалить из группы"
                              >
                                <MS name="delete" size={16} color={C.red} />
                              </button>
                            </>
                          )}
                          
                          {isCurrentUser && member.role !== 'owner' && (
                            <button
                              type="button"
                              onClick={onLeaveGroup}
                              style={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: 10, 
                                border: 'none', 
                                background: '#FFF1F2', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                              title="Выйти из группы"
                            >
                              <MS name="logout" size={16} color={C.red} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {groupMembersActionError ? <div style={{ marginTop: 4, color: C.red, fontSize: 11, paddingLeft: 24, marginBottom: 12 }}>{groupMembersActionError}</div> : null}
            </div>

            {/* 4. Leave Group Footer button inside scroll */}
            {currentGroupMember && currentGroupMember.role !== 'owner' && (
              <div style={{ margin: 'auto 16px 32px 16px' }}>
                <button
                  type="button"
                  onClick={onLeaveGroup}
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 20,
                    background: '#FFFFFF',
                    color: '#FF3B30',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(10,22,40,0.02)',
                    border: `1px solid ${C.borderLight}`,
                    transition: 'transform 0.15s ease',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <MS name="logout" size={18} color="#FF3B30" />
                  <span>Выйти из группы</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      <AvatarLightbox
        isOpen={zoomedAvatar !== null}
        imageUrl={zoomedAvatar?.imageUrl}
        initials={zoomedAvatar?.initials ?? ''}
        seed={zoomedAvatar?.seed ?? 0}
        title={zoomedAvatar?.title ?? ''}
        onClose={() => setZoomedAvatar(null)}
      />
    </>
  )
}
