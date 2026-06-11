import { useState } from 'react'
import type { ChatGroupMember } from '../../../domain/entities/Chat'
import type { UserDirectoryUser } from '../../../infrastructure/repositories/HttpUserDirectoryRepository'
import MS from '../../../shared/ui/MaterialSymbol'
import { C } from '../../pages/dashboard/model/constants'
import MessengerAvatar from './MessengerAvatar'
import type { ChatListItem } from './types'
import { getInitials, getSeed } from './utils'

interface InfoPanelProps {
  activeChat: ChatListItem | null
  currentUserId: number | null
  activePeerId: number | null
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
  onClose: () => void
  isMobile?: boolean
  groupDescription?: string | null
  isMuted?: boolean
  muteBusy?: boolean
  onToggleMute?: () => void
}

export default function InfoPanel({
  activeChat,
  currentUserId,
  activePeerId,
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
  onClose,
  isMobile = false,
  groupDescription = null,
  isMuted = false,
  muteBusy = false,
  onToggleMute,
}: InfoPanelProps) {
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')

  if (!activeChat) {
    return null
  }

  const currentGroupMember = groupMembers.find((member) => member.id === currentUserId) ?? null
  const canManageGroupMembers = activeChat.chat.type === 'group' && (currentGroupMember?.role === 'owner' || currentGroupMember?.role === 'admin')
  const existingMemberIds = new Set(groupMembers.map((member) => member.id))
  const availableUsers = directoryUsers
    .filter((user) => !existingMemberIds.has(user.id))
    .filter((user) => {
      const query = memberSearch.trim().toLowerCase()
      if (!query) {
        return true
      }

      return [user.fullName, user.username, user.email].filter(Boolean).join(' ').toLowerCase().includes(query)
    })
    .slice(0, 8)

  return (
    <div
      style={{
        width: isMobile ? '100%' : 280,
        maxWidth: '100%',
        background: C.surface,
        borderLeft: isMobile ? 'none' : `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        minHeight: 0,
        height: '100%',
        position: 'relative',
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          borderBottom: `1px solid ${C.borderLight}`,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Информация</span>
        <button
          onClick={onClose}
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MS name="close" size={17} color={C.inkMuted} />
        </button>
      </div>

      <div style={{ padding: '24px 20px 18px', textAlign: 'center', borderBottom: `1px solid ${C.borderLight}` }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <MessengerAvatar initials={activeChat.avatar} imageUrl={activeChat.avatarUrl} size={64} seed={activeChat.seed} online={activeChat.online} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 4 }}>{activeChat.title}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: activeChat.online ? C.green : C.inkMuted }}>
          {activeChat.online ? 'В сети' : activeChat.chat.type === 'group' ? 'Группа' : 'Не в сети'}
        </div>
        {activeChat.chat.type === 'group' && groupDescription && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: C.ink,
              lineHeight: 1.5,
              background: C.canvas,
              padding: '10px 12px',
              borderRadius: 12,
              textAlign: 'left',
              border: `1px solid ${C.borderLight}`,
            }}
          >
            {groupDescription}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px', display: 'grid', gap: 12 }}>
        {onToggleMute ? (
          <button
            type="button"
            disabled={muteBusy}
            onClick={onToggleMute}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 12,
              border: `1px solid ${C.borderLight}`,
              background: '#FFFFFF',
              cursor: muteBusy ? 'default' : 'pointer',
              opacity: muteBusy ? 0.75 : 1,
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MS name={isMuted ? 'notifications_off' : 'notifications'} size={20} color={isMuted ? C.inkMuted : C.blue} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
                {isMuted ? 'Уведомления выкл.' : 'Уведомления вкл.'}
              </span>
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.inkMuted }}>{isMuted ? 'Вкл.' : 'Выкл.'}</span>
          </button>
        ) : null}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.inkMuted }}>
          Детали
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: C.inkMuted }}>Тип</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{activeChat.chat.type === 'group' ? 'Групповой чат' : 'Личный чат'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.inkMuted }}>ID</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, wordBreak: 'break-all' }}>{activeChat.chat.id}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.inkMuted }}>Упоминания</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{activeChat.chat.mentionCount}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.inkMuted }}>Сквозное шифрование</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>
              {activeChat.chat.type === 'personal' ? 'Поддерживается через linked device' : 'Для групп backend-контракт пока не завершен'}
            </div>
          </div>
          {activeChat.chat.type === 'personal' && activePeerId !== null ? (
            <button
              type="button"
              onClick={() => onOpenUserProfile(activePeerId)}
              style={{
                height: 38,
                borderRadius: 12,
                border: `1px solid ${C.borderLight}`,
                background: 'linear-gradient(135deg, #FFFFFF 0%, #F6FAFF 100%)',
                color: C.blue,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 8px 18px rgba(10,22,40,0.04)',
              }}
            >
              {activePeerId > 0 ? 'Открыть профиль пользователя' : 'Открыть профиль Smart AI'}
            </button>
          ) : null}
        </div>

        {activeChat.chat.type === 'group' ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.inkMuted, marginTop: 4 }}>
              Участники
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 12, color: C.inkMuted }}>{groupMembers.length > 0 ? `${groupMembers.length} в группе` : 'Список участников пуст'}</div>
                {canManageGroupMembers ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMembersOpen((prev) => {
                        const next = !prev
                        if (!prev && directoryUsers.length === 0) {
                          onLoadDirectoryUsers()
                        }
                        return next
                      })
                    }}
                    style={{
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: `1px solid ${C.borderLight}`,
                      background: '#FFFFFF',
                      color: C.blue,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Добавить
                  </button>
                ) : null}
              </div>

              {isAddMembersOpen ? (
                <div style={{ display: 'grid', gap: 8, padding: 10, borderRadius: 12, background: C.canvas, border: `1px solid ${C.borderLight}` }}>
                  <input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Поиск пользователя"
                    style={{
                      width: '100%',
                      height: 36,
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      background: '#FFFFFF',
                      padding: '0 12px',
                      outline: 'none',
                      fontSize: 12,
                      color: C.ink,
                      fontFamily: 'inherit',
                    }}
                  />
                  {isSearchingUsers ? <div style={{ fontSize: 12, color: C.inkMuted }}>Загрузка пользователей...</div> : null}
                  {!isSearchingUsers && userSearchError ? <div style={{ fontSize: 12, color: C.red }}>{userSearchError}</div> : null}
                  {!isSearchingUsers && !userSearchError && availableUsers.length === 0 ? <div style={{ fontSize: 12, color: C.inkMuted }}>Нет доступных пользователей для добавления.</div> : null}
                  {!isSearchingUsers && !userSearchError && availableUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      disabled={isGroupMembersUpdating}
                      onClick={() => onAddGroupMember(user.id)}
                      style={{
                        width: '100%',
                        border: `1px solid ${C.borderLight}`,
                        background: '#FFFFFF',
                        borderRadius: 10,
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        textAlign: 'left',
                        cursor: isGroupMembersUpdating ? 'default' : 'pointer',
                      }}
                    >
                      <MessengerAvatar initials={getInitials(user.fullName || user.username)} imageUrl={user.avatarUrl} size={32} seed={getSeed(user.fullName || user.username || String(user.id))} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user.fullName || user.username || `User ${user.id}`}
                        </div>
                        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user.username ? `@${user.username}` : user.email}
                        </div>
                      </div>
                      <MS name="person_add" size={16} color={C.blue} />
                    </button>
                  ))}
                </div>
              ) : null}

              {groupMembersError ? <div style={{ fontSize: 12, color: C.red }}>{groupMembersError}</div> : null}
              {groupMembersActionError ? <div style={{ fontSize: 12, color: C.red }}>{groupMembersActionError}</div> : null}

              {groupMembers.map((member) => {
                const isCurrentUser = member.id === currentUserId
                const canEditThisMember = canManageGroupMembers && !isCurrentUser && member.role !== 'owner'
                const title = member.fullName || member.username || `User ${member.id}`
                return (
                  <div
                    key={member.id}
                    style={{
                      display: 'grid',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${C.borderLight}`,
                      background: '#FFFFFF',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MessengerAvatar initials={getInitials(title)} imageUrl={null} size={34} seed={getSeed(title)} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {title}
                        </div>
                        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 2 }}>
                          {member.username ? `@${member.username}` : member.email || `ID: ${member.id}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: member.role === 'owner' ? C.blue : C.inkMuted }}>
                        {member.role}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile(member.id)}
                        style={{
                          height: 32,
                          padding: '0 12px',
                          borderRadius: 10,
                          border: `1px solid ${C.borderLight}`,
                          background: C.canvas,
                          color: C.blue,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Профиль
                      </button>

                    {canEditThisMember ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          disabled={isGroupMembersUpdating}
                          onClick={() => onUpdateGroupMemberRole(member.id, member.role === 'admin' ? 'member' : 'admin')}
                          style={{
                            flex: 1,
                            height: 32,
                            borderRadius: 10,
                            border: `1px solid ${C.borderLight}`,
                            background: C.canvas,
                            color: C.ink,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: isGroupMembersUpdating ? 'default' : 'pointer',
                          }}
                        >
                          {member.role === 'admin' ? 'Сделать участником' : 'Сделать админом'}
                        </button>
                        <button
                          type="button"
                          disabled={isGroupMembersUpdating}
                          onClick={() => onRemoveGroupMember(member.id)}
                          style={{
                            height: 32,
                            padding: '0 12px',
                            borderRadius: 10,
                            border: `1px solid ${C.borderLight}`,
                            background: '#FFFFFF',
                            color: C.red,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: isGroupMembersUpdating ? 'default' : 'pointer',
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    ) : isCurrentUser ? (
                      <button
                        type="button"
                        disabled={isGroupMembersUpdating}
                        onClick={onLeaveGroup}
                        style={{
                          height: 32,
                          borderRadius: 10,
                          border: `1px solid ${C.borderLight}`,
                          background: '#FFFFFF',
                          color: C.red,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: isGroupMembersUpdating ? 'default' : 'pointer',
                        }}
                      >
                        Выйти из группы
                      </button>
                    ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
