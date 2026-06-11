import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import type { AvailabilityStatus } from '../../../domain/entities/profile-settings/ProfileSettingsModels'
import { availabilityStatuses } from '../../../domain/entities/profile-settings/ProfileSettingsModels'
import GradientAvatar from '../../../shared/ui/GradientAvatar'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type { ProfileUserViewModel } from '../../view-models/ProfileViewModel'

interface ProfileUserCardProps {
  user: ProfileUserViewModel
  statusValue: AvailabilityStatus
  statusError: string
  avatarError: string
  isStatusSaving: boolean
  isAvatarSaving: boolean
  onStatusSubmit: (status: AvailabilityStatus) => void
  onAvatarSubmit: (file: File) => void
}

const toReadableDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}


export default function ProfileUserCard({
  user,
  statusValue,
  statusError,
  avatarError,
  isStatusSaving,
  isAvatarSaving,
  onStatusSubmit,
  onAvatarSubmit,
}: ProfileUserCardProps) {
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false)
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const initials = useMemo(() => {
    const base = user.fullName || `${user.firstName} ${user.lastName}`.trim() || user.username
    return (
      base
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'П'
    )
  }, [user.firstName, user.fullName, user.lastName, user.username])

  const hasAvatar = Boolean(user.avatarUrl) && !avatarBroken
  const statusTone: Record<AvailabilityStatus, string> = {
    online: 'text-[#059669] bg-[#ECFDF5] border-[#059669]/20',
    offline: 'text-[#64748B] bg-[#F1F5F9] border-[#64748B]/20',
    sick: 'text-[#D97706] bg-[#FFFBEB] border-[#D97706]/20',
    vacation: 'text-[#2563EB] bg-[#EFF6FF] border-[#2563EB]/20',
  }
  const statusLabel: Record<AvailabilityStatus, string> = {
    online: 'В сети',
    offline: 'Не в сети',
    sick: 'Болею',
    vacation: 'В отпуске',
  }

  const handleOpenAvatarPicker = () => {
    if (isAvatarSaving) return
    setIsAvatarEditorOpen(true)
    avatarInputRef.current?.click()
  }

  const handleOpenAvatarPreview = () => {
    setIsAvatarPreviewOpen(true)
  }

  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    event.target.value = ''
  }

  const avatarPreviewModal = isAvatarPreviewOpen ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A1628]/80 p-4 backdrop-blur-sm"
      onClick={() => setIsAvatarPreviewOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр аватара"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-[640px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setIsAvatarPreviewOpen(false)}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65"
          aria-label="Закрыть просмотр аватара"
        >
          <MaterialSymbol name="close" size={18} color="currentColor" />
        </button>

        <div className="flex items-center justify-center bg-[#0F172A] p-4">
          {hasAvatar ? (
            <img
              src={user.avatarUrl}
              alt={user.fullName || user.username}
              className="max-h-[76vh] w-auto max-w-full rounded-xl object-contain"
            />
          ) : (
            <div className="flex items-center justify-center rounded-xl bg-white/10 p-6">
              <GradientAvatar initials={initials} size={260} seed={0} borderRadius="16px" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setIsAvatarPreviewOpen(false)
              handleOpenAvatarPicker()
            }}
            disabled={isAvatarSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1E88E5] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1565C0] disabled:opacity-60"
          >
            <MaterialSymbol name="upload" size={14} color="#fff" />
            Загрузить новый
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileChange}
      />

      <div className="relative h-24 bg-[linear-gradient(135deg,#3B82F6_0%,#60A5FA_45%,#93C5FD_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.2),transparent_40%)]" />
        <div className="absolute -bottom-10 left-5">
          <div
            role="button"
            tabIndex={0}
            onClick={handleOpenAvatarPreview}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleOpenAvatarPreview()
              }
            }}
            className={`relative block rounded-2xl border-[3px] border-white bg-white shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition hover:shadow-lg ${
              isAvatarSaving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
            }`}
            aria-label="Изменить фото профиля"
            title="Открыть фото"
          >
            {hasAvatar ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName || user.username}
                className="h-20 w-20 rounded-xl object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <GradientAvatar initials={initials} size={80} seed={0} borderRadius="12px" />
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setIsAvatarEditorOpen((prev) => !prev)
              }}
              disabled={isAvatarSaving}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#1E88E5] text-white shadow-md transition-all hover:bg-[#1565C0] active:scale-90 disabled:opacity-50"
            >
              <MaterialSymbol name={isAvatarEditorOpen ? 'close' : 'edit'} size={14} color="#fff" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 pt-12">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[18px] font-semibold text-[#111827]">{user.fullName || user.username}</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[#6B7280]">@{user.username}</p>
            <p className="truncate text-[12px] text-[#9CA3AF]">{user.email}</p>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone[statusValue]}`}>
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusValue === 'online' ? 'bg-[#059669]' : statusValue === 'offline' ? 'bg-[#9CA3AF]' : statusValue === 'sick' ? 'bg-[#D97706]' : 'bg-[#2563EB]'}`}
            />
            {statusLabel[statusValue]}
          </div>
        </div>

        {isAvatarEditorOpen && (
          <div className="mt-4 space-y-3 rounded-xl bg-[#F8FBFF] p-4 ring-1 ring-[#DDE3EE]">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">Загрузить фото</label>
              <button 
                type="button" 
                onClick={() => setIsAvatarEditorOpen(false)}
                className="text-[#94A3B8] hover:text-[#64748B]"
              >
                <MaterialSymbol name="close" size={14} color="currentColor" />
              </button>
            </div>
            
            <div 
              className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#CBD5E1] bg-white p-6 transition-all hover:border-[#3B82F6] hover:bg-[#F0F7FF]"
              onClick={() => avatarInputRef.current?.click()}
            >
              {previewUrl ? (
                <div className="relative mb-3 h-16 w-16">
                  <img src={previewUrl} className="h-16 w-16 rounded-xl object-cover shadow-sm" alt="Preview" />
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#3B82F6] text-white">
                    <MaterialSymbol name="check" size={10} color="#fff" />
                  </div>
                </div>
              ) : (
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">
                  <MaterialSymbol name="upload" size={20} color="currentColor" />
                </div>
              )}
              
              <p className="text-center text-xs font-medium text-[#475569]">
                {selectedFile ? selectedFile.name : 'Нажмите, чтобы выбрать файл'}
              </p>
              <p className="mt-1 text-center text-[10px] text-[#94A3B8]">PNG, JPG до 5MB</p>
            </div>

            {selectedFile && (
              <button
                type="button"
                onClick={() => {
                  if (selectedFile) onAvatarSubmit(selectedFile)
                  setIsAvatarEditorOpen(false)
                  setSelectedFile(null)
                  setPreviewUrl(null)
                }}
                disabled={isAvatarSaving}
                className="w-full rounded-lg bg-[#3B82F6] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1D4ED8] hover:shadow-md disabled:opacity-50"
              >
                {isAvatarSaving ? 'Загрузка...' : 'Сохранить изменения'}
              </button>
            )}
            
            {avatarError && <p className="text-[10px] font-medium text-[#DC2626]">{avatarError}</p>}
          </div>
        )}

        <div className="mt-5 border-t border-[#F3F4F6] pt-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">Текущий статус</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {availabilityStatuses.map((status) => {
              const active = statusValue === status
              const inactiveClass =
                status === 'sick'
                  ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
                  : status === 'vacation'
                    ? 'border-[#BFDBFE] bg-white text-[#2563EB]'
                    : 'border-[#E5E7EB] bg-white text-[#6B7280]'

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onSelectStatusWrapper(status)}
                  disabled={isStatusSaving}
                  className={[
                    'rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
                    active ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm' : inactiveClass,
                  ].join(' ')}
                >
                  {statusLabel[status]}
                </button>
              )
            })}
          </div>
          {statusError ? <p className="mt-2 text-xs font-medium text-[#DC2626]">{statusError}</p> : null}
        </div>

        <div className="mt-5 space-y-3">
          {[
            { icon: 'badge', label: 'ИИН', value: user.iin || '-' },
            { icon: 'calendar_today', label: 'Регистрация', value: toReadableDate(user.createdAt) },
            { icon: 'login', label: 'Последний вход', value: toReadableDate(user.lastLoginAt) },
            {
              icon: 'person',
              label: 'Статус аккаунта',
              value: user.isActive ? 'Активен' : 'Отключен',
              valueClass: user.isActive ? 'text-[#059669]' : 'text-[#DC2626]',
            },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 text-[12px]">
              <span className="inline-flex items-center gap-2 font-medium text-[#6B7280]">
                <MaterialSymbol name={row.icon} size={15} color="#9CA3AF" />
                {row.label}
              </span>
              <span className={`font-medium text-[#111827] ${row.valueClass ?? ''}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {typeof document !== 'undefined' && avatarPreviewModal
        ? createPortal(avatarPreviewModal, document.body)
        : null}
    </section>
  )

  function onSelectStatusWrapper(status: AvailabilityStatus) {
    onStatusSubmit(status)
  }
}
