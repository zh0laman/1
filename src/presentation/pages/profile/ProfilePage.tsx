import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { AvailabilityStatus } from '../../../domain/entities/profile-settings/ProfileSettingsModels'
import { availabilityStatuses } from '../../../domain/entities/profile-settings/ProfileSettingsModels'
import type {
  CreateEducationInput,
  CreateLicenseCertificationInput,
  UpdateEducationInput,
  UpdateLicenseCertificationInput,
} from '../../../domain/entities/profile-settings/ProfileSectionsModels'
import { HttpError } from '../../../infrastructure/http/HttpError'
import AppToast from '../../../shared/ui/AppToast'
import CardShell from '../../../shared/ui/CardShell'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import { getErrorMessage } from '../../../shared/utils/getErrorMessage'
import { dispatchProfileUpdated } from '../../../shared/auth/authSessionEvents'
import ProfileAnalyticsSection from '../../components/profile/ProfileAnalyticsSection'
import ProfileExperienceSection from '../../components/profile/ProfileExperienceSection'
import ProfileSettingsSection from '../../components/profile/ProfileSettingsSection'
import ProfileSkeletons from '../../components/profile/ProfileSkeletons'
import ProfileUserCard from '../../components/profile/ProfileUserCard'
import { createProfileController } from '../../profile/createProfileController'
import type { CurrentProfileViewModel, ProfilePageViewModel } from '../../view-models/ProfileViewModel'
import MustChangePasswordModal from '../../components/profile/MustChangePasswordModal'

const emptyProfileViewModel: ProfilePageViewModel = {
  user: null,
  hrProfile: null,
  stats: null,
  sections: null,
}

const isAvailabilityStatus = (value: string): value is AvailabilityStatus =>
  availabilityStatuses.includes(value as AvailabilityStatus)

const isUnauthorizedError = (error: unknown): boolean =>
  error instanceof HttpError && (error.status === 401 || error.status === 403 || error.code === 'UNAUTHORIZED')

const getPasswordErrorMessage = (error: unknown): string => {
  if (error instanceof HttpError) {
    if (error.code === 'UNAUTHORIZED' || error.status === 401) {
      return 'Старый пароль указан неверно.'
    }

    if (error.code === 'INTERNAL_ERROR' || error.status >= 500) {
      return 'Не удалось изменить пароль. Попробуйте позже.'
    }
  }

  return getErrorMessage(error, 'Не удалось изменить пароль. Попробуйте еще раз.')
}

const mergeSettingsIntoProfileVm = (
  prev: ProfilePageViewModel,
  profile: CurrentProfileViewModel,
): ProfilePageViewModel => {
  if (!prev.user) {
    return prev
  }

  return {
    ...prev,
    user: {
      ...prev.user,
      email: profile.email || prev.user.email,
      username: profile.username || prev.user.username,
      firstName: profile.firstName || prev.user.firstName,
      lastName: profile.lastName || prev.user.lastName,
      fullName: profile.fullName || prev.user.fullName,
      avatarUrl: profile.avatarUrl,
      isActive: profile.isActive,
      lastLoginAt: profile.lastLoginAt || prev.user.lastLoginAt,
      createdAt: profile.createdAt || prev.user.createdAt,
      isFirstLogin: profile.isFirstLogin,
      availabilityStatus: profile.availabilityStatus ?? '',
    },
  }
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profileController, profileSettingsController, sessionStore } = useMemo(() => createProfileController(), [])

  const [viewModel, setViewModel] = useState<ProfilePageViewModel>(emptyProfileViewModel)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSettingsLoading, setIsSettingsLoading] = useState(true)
  const [isStatusSaving, setIsStatusSaving] = useState(false)
  const [isAvatarSaving, setIsAvatarSaving] = useState(false)
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const [isBackupSyncing, setIsBackupSyncing] = useState(false)
  const [isEducationSaving, setIsEducationSaving] = useState(false)
  const [isLicenseSaving, setIsLicenseSaving] = useState(false)
  const [deletingEducationId, setDeletingEducationId] = useState<number | null>(null)
  const [deletingLicenseId, setDeletingLicenseId] = useState<number | null>(null)
  const [userError, setUserError] = useState('')
  const [statsError, setStatsError] = useState('')
  const [sectionsError, setSectionsError] = useState('')
  const [statusError, setStatusError] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [backupSyncError, setBackupSyncError] = useState('')
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState('')
  const [toastWarning, setToastWarning] = useState('')
  const [statusValue, setStatusValue] = useState<AvailabilityStatus>('online')
  const [oldPasswordValue, setOldPasswordValue] = useState('')
  const [newPasswordValue, setNewPasswordValue] = useState('')
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('')
  const [backupPasswordValue, setBackupPasswordValue] = useState('')
  const [mustChangePasswordNotice, setMustChangePasswordNotice] = useState(() => {
    const fromState = (location.state as { mustChangePassword?: boolean })?.mustChangePassword
    if (fromState !== undefined) return fromState

    return sessionStore.getTokens()?.mustChangePassword ?? false
  })

  const handleSessionExpired = useCallback(() => {
    sessionStore.clearTokens()
    const basename = (import.meta.env.BASE_URL || '/web/').replace(/\/$/, '');
    navigate(`${basename}/login`, { replace: true, state: { from: '/profile' } });
  }, [navigate, sessionStore])

  const handleLogout = useCallback(async () => {
    try {
      await profileSettingsController.logout()
    } catch (e) {
      console.warn('Logout failed', e)
    } finally {
      handleSessionExpired()
    }
  }, [handleSessionExpired, profileSettingsController])

  const handleSkipMustChangePassword = useCallback(async () => {
    try {
      await profileSettingsController.completeOnboarding()
      setMustChangePasswordNotice(false)
    } catch (e) {
      setToastError(getErrorMessage(e, 'Не удалось пропустить смену пароля'))
    }
  }, [profileSettingsController])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!toastError) return
    const timeout = window.setTimeout(() => setToastError(''), 5200)
    return () => window.clearTimeout(timeout)
  }, [toastError])

  useEffect(() => {
    if (!toastWarning) return
    const timeout = window.setTimeout(() => setToastWarning(''), 5600)
    return () => window.clearTimeout(timeout)
  }, [toastWarning])

  const loadPage = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      try {
        const result = await profileController.loadPage()
        if (result.isUnauthorized) {
          handleSessionExpired()
          return
        }

        setViewModel(result.viewModel)
        setUserError(result.userError)
        setStatsError(result.statsError)
        setSectionsError(result.sectionsError)

        if (result.viewModel.user) {
          dispatchProfileUpdated({
            avatarUrl: result.viewModel.user.avatarUrl,
            fullName: result.viewModel.user.fullName,
            firstName: result.viewModel.user.firstName,
            lastName: result.viewModel.user.lastName,
          })
        }
      } catch (error) {
        if (isUnauthorizedError(error)) {
          handleSessionExpired()
          return
        }

        setUserError(getErrorMessage(error, 'Не удалось загрузить данные профиля.'))
        setStatsError(getErrorMessage(error, 'Не удалось загрузить статистику профиля.'))
        setSectionsError(getErrorMessage(error, 'Не удалось загрузить разделы профиля.'))
      } finally {
        if (refresh) {
          setIsRefreshing(false)
        } else {
          setIsLoading(false)
        }
      }
    },
    [handleSessionExpired, profileController],
  )

  const loadSettingsProfile = useCallback(async () => {
    setIsSettingsLoading(true)
    try {
      const profile = await profileSettingsController.loadProfile()
      setStatusValue(profile.availabilityStatus ?? 'offline')
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      setToastError(getErrorMessage(error, 'Не удалось загрузить настройки профиля.'))
    } finally {
      setIsSettingsLoading(false)
    }
  }, [handleSessionExpired, profileSettingsController])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadPage()
      void loadSettingsProfile()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [loadPage, loadSettingsProfile])

  const handleStatusSubmit = useCallback(async (nextStatus?: AvailabilityStatus) => {
    setStatusError('')
    setToastError('')

    const targetStatus = nextStatus ?? statusValue

    if (!isAvailabilityStatus(targetStatus)) {
      setStatusError('Допустимые значения: online, offline, sick, vacation.')
      return
    }

    setIsStatusSaving(true)
    try {
      setStatusValue(targetStatus)
      const profile = await profileSettingsController.updateStatus(targetStatus)
      setStatusValue(profile.availabilityStatus ?? targetStatus)
      setViewModel((prev) => mergeSettingsIntoProfileVm(prev, profile))
      setToast('Статус обновлен.')
      dispatchProfileUpdated({
        avatarUrl: profile.avatarUrl,
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: profile.fullName,
      })
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      const message = getErrorMessage(error, 'Не удалось обновить статус.')
      setStatusError(message)
      setToastError(message)
    } finally {
      setIsStatusSaving(false)
    }
  }, [handleSessionExpired, profileSettingsController, statusValue])

  const handleAvatarSubmit = useCallback(async (file: File) => {
    setAvatarError('')
    setToastError('')

    setIsAvatarSaving(true)
    try {
      const profile = await profileSettingsController.updateAvatar(undefined, file)
      setViewModel((prev) => mergeSettingsIntoProfileVm(prev, profile))
      setToast('Аватар обновлен.')
      dispatchProfileUpdated({
        avatarUrl: profile.avatarUrl,
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: profile.fullName,
      })
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      const message = getErrorMessage(error, 'Не удалось обновить аватар.')
      setAvatarError(message)
      setToastError(message)
    } finally {
      setIsAvatarSaving(false)
    }
  }, [handleSessionExpired, profileSettingsController])

  const handlePasswordSubmit = useCallback(async (customOld?: string, customNew?: string) => {
    setPasswordError('')
    setToastError('')
    setToastWarning('')

    const oldPass = customOld ?? oldPasswordValue
    const newPass = customNew ?? newPasswordValue

    if (!oldPass) {
      setPasswordError('Введите текущий пароль.')
      return
    }

    if (newPass.length < 8) {
      setPasswordError('Новый пароль должен содержать минимум 8 символов.')
      return
    }

    if (customOld === undefined && customNew === undefined && newPass !== confirmPasswordValue) {
      setPasswordError('Новый пароль и подтверждение не совпадают.')
      return
    }

    setIsPasswordSaving(true)
    try {
      const result = await profileSettingsController.changePassword(oldPass, newPass)
      
      const tokens = sessionStore.getTokens()
      if (tokens) {
        sessionStore.setTokens({ ...tokens, mustChangePassword: false })
      }
      setMustChangePasswordNotice(false)

      if (!customOld) setOldPasswordValue('')
      if (!customNew) {
        setNewPasswordValue('')
        setConfirmPasswordValue('')
      }

      if (!result.backupRotated) {
        setToastWarning(
          result.backupRotationWarning ??
            'Пароль изменен, но резервную копию ключа не удалось обновить новым паролем.',
        )
        return
      }

      setToast('Пароль успешно изменен.')
      setMustChangePasswordNotice(false)
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      const message = getPasswordErrorMessage(error)
      setPasswordError(message)
      setToastError(message)
      throw error // Re-throw for modal handling if needed
    } finally {
      setIsPasswordSaving(false)
    }
  }, [confirmPasswordValue, handleSessionExpired, newPasswordValue, oldPasswordValue, profileSettingsController, sessionStore])

  const handleBackupSyncSubmit = useCallback(async () => {
    setBackupSyncError('')
    setToastError('')

    if (!backupPasswordValue.trim()) {
      setBackupSyncError('Введите пароль резервной копии.')
      return
    }

    setIsBackupSyncing(true)
    try {
      const result = await profileSettingsController.syncE2eeBackup(backupPasswordValue)
      setBackupPasswordValue('')

      if (result.keySource === 'local') {
        setToast(result.hadExistingBackup ? 'Резервная копия обновлена.' : 'Резервная копия создана.')
        return
      }

      setToast('Резервная копия восстановлена и обновлена.')
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      const message = getErrorMessage(error, 'Не удалось обновить резервную копию.')
      setBackupSyncError(message)
      setToastError(message)
    } finally {
      setIsBackupSyncing(false)
    }
  }, [backupPasswordValue, handleSessionExpired, profileSettingsController])

  const handleEducationCreate = useCallback(async (payload: CreateEducationInput) => {
    setSectionsError('')
    setToastError('')
    setIsEducationSaving(true)

    try {
      const createdEducation = await profileController.createEducation(payload)
      setViewModel((prev) => ({
        ...prev,
        sections: {
          educations: [createdEducation, ...(prev.sections?.educations ?? [])],
          licenses: prev.sections?.licenses ?? [],
        },
      }))
      setToast('Образование добавлено.')
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      setToastError(getErrorMessage(error, 'Не удалось добавить образование.'))
    } finally {
      setIsEducationSaving(false)
    }
  }, [handleSessionExpired, profileController])

  const handleLicenseCreate = useCallback(async (payload: CreateLicenseCertificationInput) => {
    setSectionsError('')
    setToastError('')
    setIsLicenseSaving(true)

    try {
      const createdLicense = await profileController.createLicenseCertification(payload)
      setViewModel((prev) => ({
        ...prev,
        sections: {
          educations: prev.sections?.educations ?? [],
          licenses: [createdLicense, ...(prev.sections?.licenses ?? [])],
        },
      }))
      setToast('Сертификат добавлен.')
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      setToastError(getErrorMessage(error, 'Не удалось добавить сертификат.'))
    } finally {
      setIsLicenseSaving(false)
    }
  }, [handleSessionExpired, profileController])

  const handleEducationUpdate = useCallback(async (id: number, payload: UpdateEducationInput) => {
    setSectionsError('')
    setToastError('')
    setIsEducationSaving(true)

    try {
      const updatedEducation = await profileController.updateEducation(id, payload)
      setViewModel((prev) => ({
        ...prev,
        sections: prev.sections
          ? {
              ...prev.sections,
              educations: prev.sections.educations.map((item) =>
                item.id === id ? updatedEducation : item,
              ),
            }
          : prev.sections,
      }))
      setToast('Образование обновлено.')
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      setToastError(getErrorMessage(error, 'Не удалось обновить образование.'))
    } finally {
      setIsEducationSaving(false)
    }
  }, [handleSessionExpired, profileController])

  const handleLicenseUpdate = useCallback(async (id: number, payload: UpdateLicenseCertificationInput) => {
    setSectionsError('')
    setToastError('')
    setIsLicenseSaving(true)

    try {
      const updatedLicense = await profileController.updateLicenseCertification(id, payload)
      setViewModel((prev) => ({
        ...prev,
        sections: prev.sections
          ? {
              ...prev.sections,
              licenses: prev.sections.licenses.map((item) =>
                item.id === id ? updatedLicense : item,
              ),
            }
          : prev.sections,
      }))
      setToast('Сертификат обновлен.')
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      setToastError(getErrorMessage(error, 'Не удалось обновить сертификат.'))
    } finally {
      setIsLicenseSaving(false)
    }
  }, [handleSessionExpired, profileController])

  const handleEducationDelete = useCallback(async (id: number) => {
    setSectionsError('')
    setToastError('')
    setDeletingEducationId(id)

    try {
      await profileController.deleteEducation(id)
      setViewModel((prev) => ({
        ...prev,
        sections: prev.sections
          ? {
              ...prev.sections,
              educations: prev.sections.educations.filter((item) => item.id !== id),
            }
          : prev.sections,
      }))
      setToast('Образование удалено.')
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      setToastError(getErrorMessage(error, 'Не удалось удалить образование.'))
    } finally {
      setDeletingEducationId(null)
    }
  }, [handleSessionExpired, profileController])

  const handleLicenseDelete = useCallback(async (id: number) => {
    setSectionsError('')
    setToastError('')
    setDeletingLicenseId(id)

    try {
      await profileController.deleteLicenseCertification(id)
      setViewModel((prev) => ({
        ...prev,
        sections: prev.sections
          ? {
              ...prev.sections,
              licenses: prev.sections.licenses.filter((item) => item.id !== id),
            }
          : prev.sections,
      }))
      setToast('Сертификат удален.')
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleSessionExpired()
        return
      }

      setToastError(getErrorMessage(error, 'Не удалось удалить сертификат.'))
    } finally {
      setDeletingLicenseId(null)
    }
  }, [handleSessionExpired, profileController])

  const hasFullError = !viewModel.user && !viewModel.stats && (userError || statsError)

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-[#F8F9FA]">
      <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 xl:px-8">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <nav className="mb-2 flex items-center gap-1.5 text-[12px] text-[#9CA3AF]">
                <span>Личный кабинет</span>
                <MaterialSymbol name="chevron_right" size={14} color="currentColor" />
                <span className="font-medium text-[#2563EB]">Профиль</span>
              </nav>
              <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#111827] sm:text-[32px]">
                Профессиональный профиль
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#6B7280]">
                Управляйте личными данными, достижениями, рейтингом и безопасностью аккаунта в едином пространстве.
              </p>
              {viewModel.hrProfile ? (
                <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-[#BFE4C7] bg-[#EAF8EE] px-3 py-1 text-[11px] font-semibold text-[#1E7A34]">
                  <MaterialSymbol name="verified" size={14} color="currentColor" />
                  Верифицирован с Eqyzmet
                </div>
              ) : null}
            </div>
            <button
              type="button"
              disabled={isLoading || isRefreshing}
              onClick={() => void loadPage(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-medium text-[#374151] transition hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              <MaterialSymbol name="refresh" size={18} color="currentColor" />
              {isRefreshing ? 'Обновление...' : 'Обновить данные'}
            </button>
          </div>
        </header>

        {isLoading ? <ProfileSkeletons /> : null}

        {!isLoading && hasFullError ? (
          <CardShell className="border-[#F4C8C8] bg-[#FFF6F6] p-5">
            <div className="mb-3 flex items-center gap-2 text-[#C53030]">
              <MaterialSymbol name="error" size={18} color="#C53030" />
              <span className="text-sm font-semibold">Не удалось загрузить профиль.</span>
            </div>
            <p className="mb-4 text-sm text-[#B44A4A]">{userError || statsError}</p>
            <button
              type="button"
              onClick={() => void loadPage()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E88E5] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1565C0]"
            >
              <MaterialSymbol name="refresh" size={14} color="#fff" />
              Повторить
            </button>
          </CardShell>
        ) : null}

        {!isLoading && !hasFullError ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-4 xl:sticky xl:top-5 xl:self-start">
              {viewModel.user ? (
                <ProfileUserCard
                  user={viewModel.user}
                  statusValue={statusValue}
                  statusError={statusError}
                  avatarError={avatarError}
                  isStatusSaving={isStatusSaving || isSettingsLoading}
                  isAvatarSaving={isAvatarSaving || isSettingsLoading}
                  onStatusSubmit={(nextStatus) => {
                    void handleStatusSubmit(nextStatus)
                  }}
                  onAvatarSubmit={(file) => {
                    void handleAvatarSubmit(file)
                  }}
                />
              ) : (
                <CardShell className="border-[#F4C8C8] bg-[#FFF6F6] p-4 text-sm text-[#C53030]">
                  {userError || 'Нет данных профиля.'}
                </CardShell>
              )}
            </div>

            <div className="space-y-5 xl:col-span-8">
              {viewModel.hrProfile ? (
                <CardShell className="border-[#E0E8F4] bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#0A1628]">
                    <MaterialSymbol name="badge" size={17} color="#1E88E5" />
                    HR-профиль
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#F8FBFF] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">ГО</p>
                      <p className="mt-1 text-sm font-semibold text-[#0A1628]">{viewModel.hrProfile.nameGo || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-[#F8FBFF] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Тип документа</p>
                      <p className="mt-1 text-sm font-semibold text-[#0A1628]">{viewModel.hrProfile.docType || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-[#F8FBFF] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Должность</p>
                      <p className="mt-1 text-sm font-semibold text-[#0A1628]">{viewModel.hrProfile.jobName || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-[#F8FBFF] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Подразделение</p>
                      <p className="mt-1 text-sm font-semibold text-[#0A1628]">{viewModel.hrProfile.subName || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-[#F8FBFF] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Дата приказа</p>
                      <p className="mt-1 text-sm font-semibold text-[#0A1628]">{viewModel.hrProfile.lastOrderDate || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-[#F8FBFF] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Номер приказа</p>
                      <p className="mt-1 text-sm font-semibold text-[#0A1628]">{viewModel.hrProfile.lastOrderNumber || '-'}</p>
                    </div>
                  </div>
                </CardShell>
              ) : null}

              {viewModel.stats ? (
                <>
                  <ProfileAnalyticsSection stats={viewModel.stats} />
                  <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <div className="mb-5 flex items-center gap-2">
                      <MaterialSymbol name="school" size={18} color="#2563EB" />
                      <h3 className="text-[15px] font-semibold text-[#111827]">Опыт, образование и подтверждения</h3>
                    </div>
                  {viewModel.sections ? (
                    <ProfileExperienceSection
                      educations={viewModel.sections.educations}
                      licenses={viewModel.sections.licenses}
                      isEducationSaving={isEducationSaving}
                      isLicenseSaving={isLicenseSaving}
                      deletingEducationId={deletingEducationId}
                      deletingLicenseId={deletingLicenseId}
                      onCreateEducation={(payload) => {
                        void handleEducationCreate(payload)
                      }}
                      onUpdateEducation={(id, payload) => {
                        void handleEducationUpdate(id, payload)
                      }}
                      onDeleteEducation={(id) => {
                        void handleEducationDelete(id)
                      }}
                      onCreateLicense={(payload) => {
                        void handleLicenseCreate(payload)
                      }}
                      onUpdateLicense={(id, payload) => {
                        void handleLicenseUpdate(id, payload)
                      }}
                      onDeleteLicense={(id) => {
                        void handleLicenseDelete(id)
                      }}
                    />
                  ) : sectionsError ? (
                    <CardShell className="border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#DC2626]">
                      {sectionsError}
                    </CardShell>
                  ) : null}
                  </section>
                </>
              ) : (
                <CardShell className="border-[#F4C8C8] bg-[#FFF6F6] p-4 text-sm text-[#C53030]">
                  {statsError || 'Нет статистики профиля.'}
                </CardShell>
              )}

              {isSettingsLoading ? (
                <CardShell className="border-[#DDE3EE] bg-white p-5 text-sm text-[#6B7280]">
                  Загрузка настроек профиля...
                </CardShell>
              ) : (
                <>
                  <ProfileSettingsSection
                    oldPasswordValue={oldPasswordValue}
                    newPasswordValue={newPasswordValue}
                    confirmPasswordValue={confirmPasswordValue}
                    backupPasswordValue={backupPasswordValue}
                    passwordError={passwordError}
                    backupSyncError={backupSyncError}
                    isPasswordSaving={isPasswordSaving}
                    isBackupSyncing={isBackupSyncing}
                    onOldPasswordChange={(value) => {
                      setPasswordError('')
                      setOldPasswordValue(value)
                    }}
                    onNewPasswordChange={(value) => {
                      setPasswordError('')
                      setNewPasswordValue(value)
                    }}
                    onConfirmPasswordChange={(value) => {
                      setPasswordError('')
                      setConfirmPasswordValue(value)
                    }}
                    onBackupPasswordChange={(value) => {
                      setBackupSyncError('')
                      setBackupPasswordValue(value)
                    }}
                    onPasswordSubmit={() => {
                      void handlePasswordSubmit()
                    }}
                    onBackupSyncSubmit={() => {
                      void handleBackupSyncSubmit()
                    }}
                  />
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {mustChangePasswordNotice ? (
        <MustChangePasswordModal
          isSaving={isPasswordSaving}
          error={passwordError}
          onConfirm={async (oldPass, newPass) => {
            await handlePasswordSubmit(oldPass, newPass)
          }}
          onLogout={handleLogout}
          onSkip={handleSkipMustChangePassword}
        />
      ) : null}

      {toast ? <AppToast variant="success" message={toast} onClose={() => setToast('')} /> : null}
      {toastError ? <AppToast variant="error" message={toastError} onClose={() => setToastError('')} /> : null}
      {toastWarning ? <AppToast variant="warning" message={toastWarning} onClose={() => setToastWarning('')} /> : null}
    </main>
  )
}
