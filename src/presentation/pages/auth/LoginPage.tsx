import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AuthTokens } from '../../../domain/entities/AuthTokens'
import { PasswordLoginWithE2eeBootstrapUseCase } from '../../../application/use-cases/auth/PasswordLoginWithE2eeBootstrapUseCase'
import { HttpAuthRepository } from '../../../infrastructure/repositories/HttpAuthRepository'
import { IndexedDbKeyStore } from '../../../infrastructure/storage/IndexedDbKeyStore'
import { WebDeviceSessionStore } from '../../../infrastructure/storage/WebDeviceSessionStore'
import { LoginForm, type PasswordLoginSubmitOptions } from '../../components/auth/LoginForm'
import { QrLoginPanel } from '../../components/auth/QrLoginPanel'
import { createAuthController } from '../../auth/createAuthController'
import { useQrLogin } from '../../hooks/useQrLogin'
import type { AuthViewModel } from '../../view-models/AuthViewModel'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import loginHero from '../../../assets/loginHero.jpg'
import aiDigLogo from '../../../assets/ai_dig.svg'
import { getErrorMessage } from '../../../shared/utils/getErrorMessage'
import { consumeAuthFlashNotice, storeAuthFlashNotice, type AuthFlashNotice } from '../../../shared/auth/authFlashNotice'

const emptyModel: AuthViewModel = {
  isAuthenticated: false,
  userId: null,
  email: '',
  name: '',
  expiresInSeconds: 0,
  role: '',
  avatarUrl: '',
}

const noticeStyles: Record<AuthFlashNotice['kind'], { border: string; bg: string; text: string }> = {
  info: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
  error: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700' },
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [, setModel] = useState<AuthViewModel>(emptyModel)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoadingLogin, setIsLoadingLogin] = useState(false)
  const [loginProgressLabel, setLoginProgressLabel] = useState('Входим...')
  const [error, setError] = useState('')
  const [authMode, setAuthMode] = useState<'password' | 'qr'>('password')
  const [notice, setNotice] = useState<AuthFlashNotice | null>(() => consumeAuthFlashNotice())
  const requestedRedirectTo = (location.state as { from?: string } | null)?.from
  const redirectTo = requestedRedirectTo ?? '/main/dashboard'
  const qrRedirectTo = requestedRedirectTo ?? '/messenger'

  const { authController, sessionStore } = useMemo(() => createAuthController(), [])
  const keyStore = useMemo(() => new IndexedDbKeyStore(), [])
  const webDeviceSessionStore = useMemo(() => new WebDeviceSessionStore(), [])
  const passwordLoginBootstrapUseCase = useMemo(
    () =>
      new PasswordLoginWithE2eeBootstrapUseCase(
        new HttpAuthRepository(),
        sessionStore,
        keyStore,
        webDeviceSessionStore,
      ),
    [keyStore, sessionStore, webDeviceSessionStore],
  )

  useEffect(() => {
    let isCancelled = false

    authController
      .bootstrap()
      .then((nextModel) => {
        if (!isCancelled) {
          setModel(nextModel)
          if (nextModel.isAuthenticated) {
            navigate(redirectTo, { replace: true })
          }
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsBootstrapping(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [authController, navigate, redirectTo])

  const handleQrAuthenticated = useCallback(
    async (tokens: AuthTokens): Promise<void> => {
      sessionStore.setTokens(tokens)
      const nextModel = await authController.bootstrap()
      setModel(nextModel)
      navigate(qrRedirectTo, { replace: true })
    },
    [authController, navigate, qrRedirectTo, sessionStore],
  )

  const { status, statusMessage, qrValue, error: qrError, isBusy, startQrLogin, resetQrLogin } = useQrLogin({
    onAuthenticated: handleQrAuthenticated,
  })

  useEffect(() => {
    if (isBootstrapping || authMode !== 'qr' || (status !== 'idle' && status !== 'expired')) {
      return
    }

    void startQrLogin()
  }, [authMode, isBootstrapping, startQrLogin, status])

  useEffect(() => {
    if (authMode === 'qr') {
      return
    }

    resetQrLogin()
  }, [authMode, resetQrLogin])

  const persistPostLoginNotice = useCallback(
    (
      result: Awaited<ReturnType<PasswordLoginWithE2eeBootstrapUseCase['execute']>>,
    ) => {
      if (!result.backupCreationError) {
        return
      }

      const messages: string[] = []
      const backupPasswordLabel = 'паролю входа'

      if (result.registration.revokedDeviceIds.length > 0) {
        messages.push('Мы завершили предыдущие web-сессии для вашей безопасности.')
      }

      if (result.deviceKeySource === 'backup') {
        messages.push(
          `Браузер зарегистрирован с identity key, восстановленным из recovery backup по ${backupPasswordLabel}. Если public key совпадает с исторической identity, старая E2EE-история может открыться без отдельного QR onboarding.`,
        )
      } else if (result.backupCreated && result.deviceKeySource === 'stored') {
        messages.push(
          `В этом браузере уже был локальный identity key, но recovery backup отсутствовал. Мы сохранили новый canonical recovery backup по ${backupPasswordLabel}, чтобы следующий браузер мог восстановить ту же identity без ручного экспорта.`,
        )
      } else if (result.backupCreated) {
        messages.push(
          `Recovery backup на аккаунте отсутствовал, поэтому браузер зарегистрирован как новое web-устройство и сразу сохранил новый canonical recovery backup по ${backupPasswordLabel}. Следующий браузер сможет использовать password-based restore без отдельного шага настройки.`,
        )
      } else if (result.backupMissingFallback) {
        messages.push(
          'На аккаунте нет recovery backup, поэтому браузер автоматически зарегистрирован как новое web-устройство. Новые сообщения будут доступны сразу; старая E2EE-история при необходимости подключается через QR linked-device flow.',
        )
      } else if (result.deviceKeySource === 'stored') {
        messages.push(
          'В этом браузере уже были локальные E2EE-ключи, поэтому вход выполнен без повторного восстановления из recovery backup.',
        )
      } else if (result.registration.hasBackup || result.backup) {
        messages.push(
          'На аккаунте уже есть recovery backup. По умолчанию web использует пароль входа как пароль backup; если recovery backup не удастся расшифровать, используйте QR linked-device flow.',
        )
      } else {
        messages.push(
          'Текущий браузер зарегистрирован как новое web-устройство. Новые сообщения будут доступны сразу. Если позже понадобится старая E2EE-история, используйте password-based restore при наличии backup или отдельный QR linked-device flow.',
        )
      }

      const currentLoginDetails = [result.currentLogin?.city, result.currentLogin?.country, result.currentLogin?.ip]
        .filter(Boolean)
        .join(' · ')

      if (currentLoginDetails) {
        messages.push(`Текущий вход: ${currentLoginDetails}.`)
      }

      if (result.backupCreationError) {
        messages.push(`Recovery backup не удалось сохранить: ${result.backupCreationError}`)
      }

      if (messages.length === 0) {
        return
      }

      storeAuthFlashNotice({
        kind: result.backupCreationError
          ? 'warning'
          : result.registration.revokedDeviceIds.length > 0
            ? 'warning'
            : 'info',
        title: 'Безопасность входа',
        message: messages.join(' '),
      })
    },
    [],
  )

  const handlePasswordLogin = useCallback(
    async (login: string, password: string, options: PasswordLoginSubmitOptions) => {
      resetQrLogin()
      setError('')
      setNotice(null)

      if (!login || !password) {
        setError('Введите ИИН или email, и пароль.')
        return
      }

      try {
        setIsLoadingLogin(true)
        setLoginProgressLabel('Проверяем учетные данные...')
        const result = await passwordLoginBootstrapUseCase.execute({
          identifier: login,
          password,
          restoreHistory: options.restoreHistory,
          onProgress: setLoginProgressLabel,
        })
        persistPostLoginNotice(result)
        const nextModel = await authController.bootstrap()
        setModel(nextModel)

        if (result.mustChangePassword) {
          navigate('/profile', { replace: true, state: { mustChangePassword: true } })
        } else {
          navigate(redirectTo, { replace: true })
        }
      } catch (loginError) {
        setError(getErrorMessage(loginError, 'Не удалось выполнить вход.'))
      } finally {
        setIsLoadingLogin(false)
        setLoginProgressLabel('Входим...')
      }
    },
    [authController, navigate, passwordLoginBootstrapUseCase, persistPostLoginNotice, redirectTo, resetQrLogin],
  )

  const handleUseFreshKeyFallback = useCallback(() => {
    setError('')
    setNotice({
      kind: 'warning',
      title: 'Fresh-key вход',
      message:
        'Восстановление из recovery backup пропущено. Браузер будет зарегистрирован как новое web-устройство, а старая E2EE-история при необходимости останется доступной через QR linked-device flow.',
    })
  }, [])

  const handleUseQrFallback = useCallback(() => {
    setError('')
    setNotice({
      kind: 'info',
      title: 'QR linked-device',
      message:
        'Password-based restore остановлен. Подтвердите вход на доверенном устройстве, чтобы подключить старую E2EE-историю через QR approve и history sync.',
    })
    resetQrLogin()
    setAuthMode('qr')
  }, [resetQrLogin])

  const handleKeycloakLogin = useCallback((loginHint?: string) => {
    const redirectPath = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/'
    const redirect = redirectPath === '/' || redirectPath === '/web'
      ? '/web/'
      : redirectPath.startsWith('/web/')
        ? redirectPath
        : `/web${redirectPath}`
    const params = new URLSearchParams({ redirect })
    const normalizedLoginHint = loginHint?.trim()
    if (normalizedLoginHint) {
      params.set('login_hint', normalizedLoginHint)
    }
    window.location.href = `/api/v1/auth/keycloak/login?${params.toString()}`
  }, [redirectTo])

  return (
    <div className="min-h-screen flex bg-[#f3f4f6]">
      <div className="hidden lg:flex lg:w-[52%] xl:w-[58%] relative flex-col justify-between overflow-hidden px-14 py-12">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${loginHero})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-[#082EA8]/40" />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-120 h-120 rounded-full bg-white/3" />
          <div className="absolute -bottom-40 -right-24 w-135 h-135 rounded-full bg-white/4" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-175 rounded-full border border-white/4" />
        </div>

        <div className="relative z-10">
          <img src={aiDigLogo} alt="AI Digital" className="h-10 w-auto object-contain" />
        </div>

        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Государственная цифровая платформа
            </div>
            <h1 className="text-[40px] xl:text-[48px] font-bold text-white leading-[1.15] tracking-tight">
              Единый центр управления
              <br />
              и взаимодействия
            </h1>
            <p className="hidden text-base text-white/60 leading-relaxed max-w-105">
              Защищенное рабочее пространство для сотрудников. Web password-login по умолчанию ведет себя как mobile:
              сначала пытается использовать локальный identity key или recovery backup по паролю входа, а при отсутствии
              backup создает новый canonical backup для следующих устройств.
            </p>
            <p className="text-base text-white/60 leading-relaxed max-w-105">
              Защищенное рабочее пространство для сотрудников. Войдите в аккаунт и продолжайте работу на своих доверенных
              устройствах.
            </p>
          </div>
        </div>

        <div className="relative z-10 text-white/30 text-xs">
          © {new Date().getFullYear()} Alem Digital. Все права защищены.
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-8 py-5 border-b border-[#e5e7eb] bg-white lg:bg-transparent lg:border-0">
          <div className="flex items-center lg:hidden">
            <img src={aiDigLogo} alt="AI Digital" className="h-8 w-auto object-contain" />
          </div>
        </div>

        <div className="flex-1 flex flex-col p-6 lg:p-10 overflow-y-auto">
          <div className="m-auto w-full max-w-110">
            {isBootstrapping ? (
              <div className="bg-white rounded-2xl border border-[#e5e7eb] shadow-sm p-8 flex flex-col items-center gap-4">
                <svg className="animate-spin h-7 w-7 text-[#1E88E5]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <p className="text-sm text-[#6b7280]">Проверяем активную сессию...</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#e5e7eb] shadow-[0_4px_24px_rgba(8,46,168,0.07)] overflow-hidden">
                <div className="px-8 pt-8 pb-6 border-b border-[#f3f4f6]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1E88E5] mb-2">
                    Безопасный доступ
                  </p>
                  <h2 className="text-2xl font-bold text-[#1c1c1e] tracking-tight">Вход в аккаунт</h2>
                  <p className="hidden mt-1.5 text-sm text-[#6b7280]">
                    По умолчанию ordinary login пытается сохранить ту же E2EE identity, что и mobile: сначала берет
                    локальный browser key, потом recovery backup по паролю входа, и только если этого нет — регистрирует
                    fresh web key. Если recovery backup не удастся расшифровать паролем входа, используйте QR linked-device flow.
                  </p>
                </div>

                <div className="flex border-b border-[#f3f4f6]">
                  {(['password', 'qr'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAuthMode(mode)}
                      className={[
                        'flex-1 h-11 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                        authMode === mode
                          ? 'text-[#1E88E5] border-b-2 border-[#1E88E5] bg-[#f0f7ff]'
                          : 'text-[#9ca3af] hover:text-[#6b7280] hover:bg-[#f9fafb]',
                      ].join(' ')}
                    >
                      <MaterialSymbol name={mode === 'password' ? 'lock' : 'qr_code_scanner'} size={16} />
                      {mode === 'password' ? 'Пароль' : 'QR-код'}
                    </button>
                  ))}
                </div>

                <div className="px-8 py-7">
                  {notice ? (
                    <div
                      className={[
                        'mb-5 rounded-xl border px-4 py-3',
                        noticeStyles[notice.kind].border,
                        noticeStyles[notice.kind].bg,
                        noticeStyles[notice.kind].text,
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        <MaterialSymbol
                          name={notice.kind === 'error' ? 'error' : notice.kind === 'warning' ? 'warning' : 'info'}
                          size={18}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{notice.title}</p>
                          <p className="mt-1 text-sm leading-relaxed">{notice.message}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {authMode === 'password' ? (
                    <div className="space-y-4">
                      <LoginForm
                        loading={isLoadingLogin}
                        loadingLabel={loginProgressLabel}
                        error={error}
                        onSubmit={handlePasswordLogin}
                        onKeycloakLogin={handleKeycloakLogin}
                        onUseFreshKeyFallback={handleUseFreshKeyFallback}
                        onUseQrFallback={handleUseQrFallback}
                      />
                    </div>
                  ) : (
                    <QrLoginPanel
                      status={status}
                      statusMessage={statusMessage}
                      qrValue={qrValue}
                      error={qrError}
                      isBusy={isBusy}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
