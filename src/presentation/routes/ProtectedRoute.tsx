import { type ReactNode, useEffect, useMemo, useState, useRef } from 'react'

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import { createAuthController } from '../auth/createAuthController'

interface ProtectedRouteProps {
  children?: ReactNode
}

interface AuthResponseDto {
  access_token: string
  refresh_token: string
  token_type?: string
  expires_in?: number
  expires_at?: string
  must_change_password?: boolean
}

async function restoreSessionFromAuthCookies(sessionStore: AuthSessionStore): Promise<void> {
  if (sessionStore.getTokens()) {
    return
  }

  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    return
  }

  const data = (await response.json()) as AuthResponseDto
  if (!data.access_token) {
    return
  }

  const expiresIn = data.expires_in && data.expires_in > 0 ? data.expires_in : 86400
  sessionStore.setTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    tokenType: data.token_type || 'Bearer',
    expiresIn,
    expiresAt: data.expires_at || new Date(Date.now() + expiresIn * 1000).toISOString(),
    mustChangePassword: data.must_change_password,
  })
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const { authController, sessionStore } = useMemo(() => createAuthController(), [])
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const hasInjectedRef = useRef(false)


  useEffect(() => {
    let isCancelled = false

    // Check for token in URL (for mobile/embedded integration)
    const searchParams = new URLSearchParams(location.search)
    const tokenFromUrl = searchParams.get('token') || searchParams.get('accessToken')
    const refreshTokenFromUrl = searchParams.get('refreshToken') || searchParams.get('refresh_token') || ''
    const tokenTypeFromUrl = searchParams.get('tokenType') || searchParams.get('token_type') || 'Bearer'
    const expiresInFromUrl = Number(searchParams.get('expiresIn') || searchParams.get('expires_in') || 86400)
    const expiresAtFromUrl = searchParams.get('expiresAt') || searchParams.get('expires_at') || ''

    const hasInjectedTokens = !!tokenFromUrl && !hasInjectedRef.current
    
    if (hasInjectedTokens) {
      hasInjectedRef.current = true
      try {
        const expiresIn = Number.isFinite(expiresInFromUrl) && expiresInFromUrl > 0 ? expiresInFromUrl : 86400
        const tokens = {
          accessToken: tokenFromUrl,
          refreshToken: refreshTokenFromUrl,
          tokenType: tokenTypeFromUrl,
          expiresIn,
          expiresAt: expiresAtFromUrl || new Date(Date.now() + expiresIn * 1000).toISOString(),
        }

        sessionStore.setTokens(tokens)

        // Clean up URL
        const params = new URLSearchParams(window.location.search)
        params.delete('token')
        params.delete('accessToken')
        params.delete('refreshToken')
        params.delete('refresh_token')
        params.delete('tokenType')
        params.delete('token_type')
        params.delete('expiresIn')
        params.delete('expires_in')
        params.delete('expiresAt')
        params.delete('expires_at')
        const newSearch = params.toString()
        const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '')
        window.history.replaceState({}, '', newUrl)
      } catch (e) {
        console.error('Failed to inject token from URL', e)
      }
    }
    
    // Only try to restore from cookies if we don't have injected tokens
    const restorePromise = hasInjectedTokens 
      ? Promise.resolve() 
      : restoreSessionFromAuthCookies(sessionStore)

    restorePromise
      .catch((error: unknown) => {
        console.warn('Failed to restore session from auth cookies', error)
      })
      .then(() => authController.bootstrap(hasInjectedTokens))
      .then((model) => {
        if (!isCancelled) {
          const authenticated = hasInjectedTokens || model.isAuthenticated
          setIsAuthenticated(authenticated)
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsChecking(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [authController, sessionStore, location.pathname])

  if (isChecking) {
    return (
      <main className="min-h-screen w-full grid place-items-center px-4 py-6">
        <section className="w-full max-w-115 rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_8px_20px_rgba(17,24,39,0.06)]">
          <h1 className="m-0 text-[28px] font-bold text-[#1c1c1e]">Загрузка...</h1>
        </section>
      </main>
    )
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" replace state={{ from: returnTo }} />
  }

  const tokens = sessionStore.getTokens()
  if (tokens?.mustChangePassword && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace state={{ mustChangePassword: true }} />
  }

  return children ?? <Outlet />
}
