import { useState } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'

interface ProfileSettingsSectionProps {
  oldPasswordValue: string
  newPasswordValue: string
  confirmPasswordValue: string
  backupPasswordValue: string
  passwordError: string
  backupSyncError: string
  isPasswordSaving: boolean
  isBackupSyncing: boolean
  onOldPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onBackupPasswordChange: (value: string) => void
  onPasswordSubmit: () => void
  onBackupSyncSubmit: () => void
}

function PasswordField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  placeholder: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-[#6B7280]">{label}</span>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 pr-10 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] transition hover:text-[#6B7280]"
          aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        >
          <MaterialSymbol name={visible ? 'visibility_off' : 'visibility'} size={18} color="currentColor" />
        </button>
      </div>
    </label>
  )
}

export default function ProfileSettingsSection({
  oldPasswordValue,
  newPasswordValue,
  confirmPasswordValue,
  backupPasswordValue,
  passwordError,
  backupSyncError,
  isPasswordSaving,
  isBackupSyncing,
  onOldPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onBackupPasswordChange,
  onPasswordSubmit,
  onBackupSyncSubmit,
}: ProfileSettingsSectionProps) {
  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-5 flex items-center gap-2">
        <MaterialSymbol name="lock" size={18} color="#2563EB" />
        <h3 className="text-[15px] font-semibold text-[#111827]">Безопасность и доступ</h3>
      </div>

      <div className="space-y-4">
        <h4 className="text-[13px] font-semibold text-[#374151]">Смена пароля</h4>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
            <PasswordField
              label="Текущий пароль"
              value={oldPasswordValue}
              onChange={onOldPasswordChange}
              disabled={isPasswordSaving}
              placeholder="Введите текущий пароль"
            />
            <PasswordField
              label="Новый пароль"
              value={newPasswordValue}
              onChange={onNewPasswordChange}
              disabled={isPasswordSaving}
              placeholder="Минимум 8 символов"
            />
            <PasswordField
              label="Подтвердите пароль"
              value={confirmPasswordValue}
              onChange={onConfirmPasswordChange}
              disabled={isPasswordSaving}
              placeholder="Повторите новый пароль"
            />
          </div>

          <button
            type="button"
            onClick={onPasswordSubmit}
            disabled={isPasswordSaving}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] px-5 text-[13px] font-medium text-white transition hover:bg-[#1D4ED8] disabled:opacity-50 xl:min-w-[160px]"
          >
            {isPasswordSaving ? 'Обновление...' : 'Обновить пароль'}
          </button>
        </div>

        {passwordError ? <p className="text-[12px] font-medium text-[#DC2626]">{passwordError}</p> : null}
      </div>

      <div className="mt-6 border-t border-[#F3F4F6] pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-[13px] font-semibold text-[#374151]">Резервная копия ключа</h4>
            <p className="mt-1 max-w-md text-[12px] leading-relaxed text-[#6B7280]">
              Создайте или обновите резервную копию ключа для восстановления доступа к зашифрованным данным.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackupSyncSubmit}
            disabled={isBackupSyncing}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-medium text-[#374151] transition hover:bg-[#F9FAFB] disabled:opacity-50"
          >
            <MaterialSymbol name="download" size={18} color="#2563EB" />
            {isBackupSyncing ? 'Создание...' : 'Создать резервную копию'}
          </button>
        </div>

        <div className="mt-3 max-w-md">
          <PasswordField
            label="Пароль для резервной копии"
            value={backupPasswordValue}
            onChange={onBackupPasswordChange}
            disabled={isBackupSyncing}
            placeholder="Введите пароль"
          />
        </div>

        {backupSyncError ? <p className="mt-2 text-[12px] font-medium text-[#DC2626]">{backupSyncError}</p> : null}
      </div>
    </section>
  )
}
