import { useEffect, useState } from 'react'
import type { BoardMemberViewModel, BoardUserViewModel } from '../../view-models/BoardViewModel'
import AppSelect from '../../../shared/ui/AppSelect'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'

interface BoardMembersModalProps {
  open: boolean
  members: BoardMemberViewModel[]
  users: BoardUserViewModel[]
  selectedUserId: string
  selectedRole: string
  selectedTeamRole: string
  isSubmitting: boolean
  onClose: () => void
  onSelectedUserIdChange: (value: string) => void
  onSelectedRoleChange: (value: string) => void
  onSelectedTeamRoleChange: (value: string) => void
  onAdd: () => void
  onRemove: (userId: number) => void
  onUpdateRole: (userId: number, role: string) => void
  onUpdateTeamRole: (userId: number, teamRole: string) => void
  boardOwnerId: number
  currentUserId: number | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  editor: 'Редактор',
  member: 'Участник',
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
]

function UserAvatar({ name, userId }: { name: string; userId: number }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const colorIndex = userId % AVATAR_COLORS.length
  const bgColor = AVATAR_COLORS[colorIndex]

  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white shadow-sm ${bgColor}`}>
      {initials}
    </div>
  )
}

export default function BoardMembersModal({
  open,
  members,
  users,
  selectedUserId,
  selectedRole,
  selectedTeamRole,
  isSubmitting,
  onClose,
  onSelectedUserIdChange,
  onSelectedRoleChange,
  onSelectedTeamRoleChange,
  onAdd,
  onRemove,
  onUpdateRole,
  onUpdateTeamRole,
  boardOwnerId,
  currentUserId,
}: BoardMembersModalProps) {
  const [teamRoleDrafts, setTeamRoleDrafts] = useState<Record<number, string>>({})

  useEffect(() => {
    const nextDrafts: Record<number, string> = {}
    for (const member of members) {
      nextDrafts[member.userId] = member.teamRole ?? ''
    }
    setTeamRoleDrafts(nextDrafts)
  }, [members])

  if (!open) return null

  const memberIds = new Set(members.map((member) => member.userId))
  const available = users.filter((user) => !memberIds.has(user.id))
  const isOwner = currentUserId !== null && Number(currentUserId) === Number(boardOwnerId)

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0A1628]/45 p-4 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[#DCE4F1] bg-white shadow-[0_24px_70px_rgba(10,22,40,0.35)] animate-in zoom-in-95 duration-200">
        <header className="flex items-center justify-between border-b border-[#F0F4FA] bg-white px-8 py-5">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#10233F]">Участники доски</h2>
            <p className="text-xs text-[#6F86A8]">Управление доступом и ролями пользователей</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE5F2] bg-white text-[#4D6486] transition hover:bg-[#F3F7FE] hover:text-[#1E88E5]"
          >
            <MaterialSymbol name="close" size={20} color="currentColor" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-8">
          {isOwner && (
            <div className="mb-8 grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)] md:items-end">
              <div className="min-w-0 md:col-span-2">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Добавить пользователя</span>
                <AppSelect
                  value={selectedUserId}
                  options={[
                    { value: '', label: 'Выбрать из списка...' },
                    ...available.map((user) => ({ value: String(user.id), label: user.fullName })),
                  ]}
                  onChange={onSelectedUserIdChange}
                  searchable
                  searchPlaceholder="Поиск по имени..."
                  className="w-full"
                  ariaLabel="Выбор участника"
                />
              </div>
              <div className="w-full">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Роль</span>
                <AppSelect
                  value={selectedRole}
                  options={[
                    { value: 'member', label: 'Участник' },
                    { value: 'editor', label: 'Редактор' },
                  ]}
                  onChange={onSelectedRoleChange}
                  className="w-full"
                  showButtonAvatar={false}
                />
              </div>
              <label className="w-full">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Роль в команде</span>
                <input
                  type="text"
                  value={selectedTeamRole}
                  onChange={(event) => onSelectedTeamRoleChange(event.target.value)}
                  placeholder="Frontend, Backend..."
                  className="h-11 w-full rounded-xl border border-[#DDE3EE] bg-white px-3 text-sm text-[#10233F] outline-none transition placeholder:text-[#9AA9BF] focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/15"
                />
              </label>
              <button
                type="button"
                disabled={isSubmitting || !selectedUserId}
                onClick={onAdd}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E88E5] px-5 text-sm font-bold text-white shadow-md transition hover:bg-[#1878CA] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] md:col-span-2 md:w-auto md:justify-self-end"
              >
                <MaterialSymbol name="person_add" size={18} color="white" />
                Добавить
              </button>
            </div>
          )}

          <div className="space-y-3 pr-2 custom-scrollbar">
            {members.length ? (
              members.map((member) => {
                const isMemberOwner = member.userId === boardOwnerId

                return (
                  <div
                    key={member.userId}
                    className="group flex items-start justify-between rounded-2xl border border-[#F0F4FA] bg-white px-4 py-4 transition hover:border-[#DDE5F2] hover:bg-[#F9FBFE] hover:shadow-sm"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <UserAvatar name={member.name} userId={member.userId} />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="truncate text-sm font-bold text-[#0A1628]">{member.name}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {isMemberOwner ? (
                            <span className="inline-flex h-6 items-center rounded-full bg-[#EBF4FE] px-2.5 text-[10px] font-bold text-[#1E88E5]">
                              Владелец
                            </span>
                          ) : isOwner ? (
                            <label className="inline-flex h-7 items-center rounded-full border border-[#D8E2F0] bg-[#F8FBFF] px-2.5">
                              <select
                                value={member.role}
                                onChange={(e) => onUpdateRole(member.userId, e.target.value)}
                                disabled={isSubmitting}
                                className="cursor-pointer bg-transparent pr-4 text-[11px] font-semibold text-[#5E7699] outline-none"
                              >
                                <option value="member">Участник</option>
                                <option value="editor">Редактор</option>
                              </select>
                            </label>
                          ) : (
                            <span className="inline-flex h-6 items-center rounded-full border border-[#E3EAF5] bg-[#F8FAFD] px-2.5 text-[10px] font-semibold text-[#6F86A8]">
                              {ROLE_LABELS[member.role] || 'Участник'}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex min-h-[32px] items-center">
                          {isOwner ? (
                            <label className="block w-full max-w-[280px]">
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8AA0BD]">
                                Роль в команде
                              </span>
                              <input
                                type="text"
                                value={teamRoleDrafts[member.userId] ?? ''}
                                onChange={(event) =>
                                  setTeamRoleDrafts((prev) => ({
                                    ...prev,
                                    [member.userId]: event.target.value,
                                  }))
                                }
                                onBlur={() => {
                                  const initialValue = member.teamRole ?? ''
                                  const draftValue = (teamRoleDrafts[member.userId] ?? '').trim()
                                  if (draftValue === initialValue) return
                                  onUpdateTeamRole(member.userId, draftValue)
                                }}
                                disabled={isSubmitting}
                                placeholder="Например: Frontend"
                                className="h-9 w-full rounded-xl border border-[#E4EBF5] bg-[#FCFDFF] px-3 text-[12px] font-medium text-[#506B90] outline-none transition placeholder:text-[#A4B2C7] focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/10"
                              />
                            </label>
                          ) : member.teamRole ? (
                            <span className="inline-flex h-7 items-center rounded-full border border-[#DCE7F6] bg-[#F4F8FF] px-3 text-[11px] font-semibold text-[#5778A3]">
                              {member.teamRole}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#9AA9BF]">Роль в команде не указана</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isOwner && !isMemberOwner ? (
                      <button
                        type="button"
                        onClick={() => onRemove(member.userId)}
                        className="ml-3 mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8497B4] transition hover:bg-[#FFF2F2] hover:text-[#C53030]"
                        title="Удалить участника"
                      >
                        <MaterialSymbol name="delete" size={18} color="currentColor" />
                      </button>
                    ) : null}
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F0F4FA]">
                  <MaterialSymbol name="group" size={24} color="#8497B4" />
                </div>
                <p className="text-sm font-medium text-[#8497B4]">Участников пока нет</p>
              </div>
            )}
          </div>
        </div>

        <footer className="flex justify-end border-t border-[#F0F4FA] bg-[#F9FBFE] px-8 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[#DDE3EE] bg-white px-6 text-sm font-semibold text-[#374C6B] hover:bg-[#F3F7FE]"
          >
            Закрыть
          </button>
        </footer>
      </div>
    </div>
  )
}
