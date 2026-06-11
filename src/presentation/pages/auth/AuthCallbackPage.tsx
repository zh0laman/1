import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createAuthController } from '../../auth/createAuthController'
import type { AuthSessionStore } from '../../../domain/services/AuthSessionStore'
import { SsoE2eeBootstrapUseCase } from '../../../application/use-cases/auth/SsoE2eeBootstrapUseCase'
import { HttpAuthRepository } from '../../../infrastructure/repositories/HttpAuthRepository'
import { IndexedDbKeyStore } from '../../../infrastructure/storage/IndexedDbKeyStore'
import { WebDeviceSessionStore } from '../../../infrastructure/storage/WebDeviceSessionStore'

const fallbackRedirect = '/'

interface AuthResponseDto {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  expires_at?: string
}

/**
 * Hydrates sessionStore by calling /api/v1/auth/refresh with HttpOnly cookie credentials.
 * This is needed after Keycloak sets cookies: localStorage is empty, but the browser
 * has the HttpOnly refresh_token cookie that the backend can use to issue new tokens.
 */
async function hydrateSessionFromCookies(
  sessionStore: AuthSessionStore,
): Promise<void> {
  // If localStorage already has tokens, nothing to do
  if (sessionStore.getTokens()) return

  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include', // send HttpOnly cookie
  })

  if (!response.ok) return

  const data = (await response.json()) as AuthResponseDto
  if (!data.access_token) return

  const expiresIn = data.expires_in && data.expires_in > 0 ? data.expires_in : 86400
  sessionStore.setTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    tokenType: data.token_type || 'Bearer',
    expiresIn,
    expiresAt: data.expires_at || new Date(Date.now() + expiresIn * 1000).toISOString(),
  })
}



function toRouterRedirect(value: string | null): string {
  const redirect = (value || '').trim()
  if (!redirect || redirect.startsWith('//')) {
    return fallbackRedirect
  }

  try {
    const parsed = redirect.startsWith('http')
      ? new URL(redirect)
      : new URL(redirect, window.location.origin)

    if (parsed.origin !== window.location.origin) {
      return fallbackRedirect
    }

    const path = parsed.pathname === '/web' ? '/web/' : parsed.pathname
    if (path === '/' || path === '/web/') {
      return fallbackRedirect
    }
    if (path.startsWith('/web/')) {
      return path.slice('/web'.length) + parsed.search + parsed.hash
    }
    if (path.startsWith('/')) {
      return path + parsed.search + parsed.hash
    }
  } catch {
    return fallbackRedirect
  }

  return fallbackRedirect
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { authController, sessionStore } = useMemo(() => createAuthController(), [])
  const [error, setError] = useState('')

  useEffect(() => {
    let isCancelled = false
    const redirectTo = toRouterRedirect(searchParams.get('redirect'))

    // First hydrate localStorage from HttpOnly cookies (set by Keycloak callback),
    // THEN bootstrap the auth model — this prevents the "No refresh token" error.
    hydrateSessionFromCookies(sessionStore)
      .catch(() => {/* ignore, bootstrap will handle unauthenticated state */})
      .then(() => authController.bootstrap(true))
      .then(async (model) => {
        if (isCancelled) return
        if (model.isAuthenticated) {
          // Perform E2EE bootstrap for SSO session
          const e2eeBootstrap = new SsoE2eeBootstrapUseCase(
            new HttpAuthRepository(),
            sessionStore,
            new IndexedDbKeyStore(),
            new WebDeviceSessionStore(),
          )
          await e2eeBootstrap.execute()
          
          const tokens = sessionStore.getTokens()
          if (tokens?.mustChangePassword) {
            navigate('/profile', { replace: true, state: { mustChangePassword: true } })
          } else {
            navigate(redirectTo, { replace: true })
          }
          return
        }
        navigate('/login', { replace: true })
      })
      .catch(() => {
        if (isCancelled) return
        setError('Не удалось завершить вход. Попробуйте войти снова.')
        navigate('/login', { replace: true })
      })

    return () => {
      isCancelled = true
    }
  }, [authController, sessionStore, navigate, searchParams])

  return (
    <main className="min-h-screen w-full grid place-items-center px-4 py-6">
      <section className="w-full max-w-115 rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_8px_20px_rgba(17,24,39,0.06)]">
        <h1 className="m-0 text-[28px] font-bold text-[#1c1c1e]">{error || 'Завершаем вход...'}</h1>
      </section>
    </main>
  )
}
