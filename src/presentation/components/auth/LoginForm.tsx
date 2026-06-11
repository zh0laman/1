import { useState, type FormEvent } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'

export interface PasswordLoginSubmitOptions {
  restoreHistory: boolean
}

interface LoginFormProps {
  loading: boolean
  loadingLabel?: string
  error: string
  onSubmit: (login: string, password: string, options: PasswordLoginSubmitOptions) => Promise<void>
  onKeycloakLogin?: (loginHint?: string) => void
  onUseFreshKeyFallback?: () => void
  onUseQrFallback?: () => void
}

const IIN_PATTERN = /^\d{12}$/

const isValidLoginValue = (value: string) => IIN_PATTERN.test(value) || value.includes('@')

export function LoginForm({
  loading,
  loadingLabel,
  error,
  onSubmit,
  onKeycloakLogin,
}: LoginFormProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [restoreHistory] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedLogin = login.trim()

    if (!isValidLoginValue(normalizedLogin)) {
      setLoginError('Введите ИИН из 12 цифр или email с символом @.')
      return
    }

    setLoginError('')
    await onSubmit(normalizedLogin, password, {
      restoreHistory,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login" className="text-xs font-semibold uppercase tracking-widest text-[#6b7280]">
          ИИН или email
        </label>
        <input
          id="login"
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="12 цифр ИИН или name@company.com"
          value={login}
          onChange={(event) => {
            setLogin(event.target.value)
            if (loginError) {
              setLoginError('')
            }
          }}
          required
          className="w-full h-12 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 text-sm text-[#1c1c1e] placeholder-[#9ca3af] outline-none transition-all duration-150 focus:border-[#1E88E5] focus:bg-white focus:ring-[3px] focus:ring-[#1E88E5]/10"
        />
        {loginError ? <p className="text-xs text-red-600">{loginError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-semibold uppercase tracking-widest text-[#6b7280]">
          Пароль
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full h-12 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 pr-11 text-sm text-[#1c1c1e] placeholder-[#9ca3af] outline-none transition-all duration-150 focus:border-[#1E88E5] focus:bg-white focus:ring-[3px] focus:ring-[#1E88E5]/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors hover:text-[#6b7280]"
            aria-label="Показать или скрыть пароль"
          >
            <MaterialSymbol name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
          </button>
        </div>
      </div>

      {restoreHistory ? null : (
        <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4">
          <div className="flex items-start gap-3">
            <MaterialSymbol name="info" size={18} color="#1E88E5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1c1c1e]">Fresh-key flow</p>
              <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                Браузер зарегистрируется как новое web-устройство и сразу получит доступ к новым сообщениям. Старую
                E2EE-историю потом можно подключить через QR linked-device flow.
              </p>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <MaterialSymbol name="error" size={18} color="#ef4444" />
            <p className="text-sm leading-relaxed text-red-600">{error}</p>
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 h-12 w-full cursor-pointer rounded-lg bg-[#1E88E5] text-sm font-semibold tracking-wide text-white shadow-sm transition-all duration-150 hover:bg-[#082EA8] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {loadingLabel ?? 'Входим...'}
          </span>
        ) : (
          'Войти'
        )}
      </button>

      {onKeycloakLogin ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => onKeycloakLogin(login.trim() || undefined)}
          className="h-11 w-full rounded-lg border border-[#d8e2f0] bg-white text-sm font-semibold text-[#254463] transition-colors hover:bg-[#f6f9ff] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex items-center justify-center gap-2">
            <MaterialSymbol name="shield" size={18} color="currentColor" />
            Войти через Keycloak
          </span>
        </button>
      ) : null}
    </form>
  )
}
