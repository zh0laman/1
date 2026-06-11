import React, { useState } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'

interface MustChangePasswordModalProps {
  onConfirm: (oldPassword: string, newPassword: string) => Promise<void>
  isSaving: boolean
  error: string
  onLogout: () => void
  onSkip?: () => void
}

export default function MustChangePasswordModal({
  onConfirm,
  isSaving,
  error,
  onLogout,
  onSkip,
}: MustChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (!oldPassword) {
      setLocalError('Введите текущий (временный) пароль')
      return
    }

    if (newPassword.length < 8) {
      setLocalError('Новый пароль должен содержать не менее 8 символов')
      return
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Пароли не совпадают')
      return
    }

    if (newPassword === oldPassword) {
      setLocalError('Новый пароль не должен совпадать с текущим')
      return
    }

    await onConfirm(oldPassword, newPassword)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/80 p-4 backdrop-blur-xl animate-in fade-in duration-500 overflow-y-auto">
      <div className="w-full max-w-[540px] animate-in fade-in zoom-in duration-500 overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-[0_32px_120px_rgba(0,0,0,0.6)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1E88E5] to-[#1565C0] px-8 py-10 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/5" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <MaterialSymbol name="lock_reset" size={36} color="#fff" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Добро пожаловать!</h2>
            <p className="mt-2 text-sm text-white/80">
              Это ваш первый вход в систему. Вы можете сменить временный пароль на постоянный сейчас или сделать это позже в настройках профиля.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {(error || localError) && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
              <MaterialSymbol name="error" size={20} color="currentColor" />
              <span>{error || localError}</span>
            </div>
          )}

          <div className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Текущий (временный) пароль
              </label>
              <div className="relative">
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => {
                    setOldPassword(e.target.value)
                    setLocalError('')
                  }}
                  className="h-12 w-full rounded-xl border border-[#DDE3EE] bg-[#F8FAFC] px-4 pr-12 text-sm text-[#0A1628] transition focus:border-[#1E88E5] focus:bg-white focus:ring-4 focus:ring-[#1E88E5]/10 outline-none"
                  placeholder="Введите временный пароль"
                  disabled={isSaving}
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8497B4] hover:text-[#1E88E5] transition"
                >
                  <MaterialSymbol name={showOldPassword ? 'visibility_off' : 'visibility'} size={20} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Новый пароль
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    setLocalError('')
                  }}
                  className="h-12 w-full rounded-xl border border-[#DDE3EE] bg-[#F8FAFC] px-4 pr-12 text-sm text-[#0A1628] transition focus:border-[#1E88E5] focus:bg-white focus:ring-4 focus:ring-[#1E88E5]/10 outline-none"
                  placeholder="Придумайте надежный пароль"
                  disabled={isSaving}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8497B4] hover:text-[#1E88E5] transition"
                >
                  <MaterialSymbol name={showNewPassword ? 'visibility_off' : 'visibility'} size={20} />
                </button>
              </div>
              <p className="text-[11px] text-[#8497B4]">Минимум 8 символов</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Подтверждение пароля
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setLocalError('')
                }}
                className="h-12 w-full rounded-xl border border-[#DDE3EE] bg-[#F8FAFC] px-4 text-sm text-[#0A1628] transition focus:border-[#1E88E5] focus:bg-white focus:ring-4 focus:ring-[#1E88E5]/10 outline-none"
                placeholder="Повторите новый пароль"
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E88E5] font-bold text-white shadow-lg shadow-[#1E88E5]/20 transition hover:bg-[#1565C0] hover:shadow-xl active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Сохранение...
                </>
              ) : (
                'Обновить пароль'
              )}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="h-12 w-full rounded-xl border border-[#DDE3EE] text-sm font-semibold text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0A1628]"
            >
              Выйти из аккаунта
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="mt-2 text-sm font-medium text-[#1E88E5] hover:underline"
              >
                Изменить позже
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
