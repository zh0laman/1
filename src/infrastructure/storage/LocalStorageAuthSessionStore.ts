import type { AuthTokens } from '../../domain/entities/AuthTokens'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'


let memoryTokens: AuthTokens | null = null

export class LocalStorageAuthSessionStore implements AuthSessionStore {
  getTokens(): AuthTokens | null {
    if (memoryTokens) return memoryTokens

    try {
      const raw = window.localStorage.getItem('superapp.auth.tokens')
      if (raw) {
        memoryTokens = JSON.parse(raw)
      }
    } catch (e) {
      console.warn('Failed to read tokens from localStorage', e)
    }

    return memoryTokens
  }

  setTokens(tokens: AuthTokens): void {
    memoryTokens = tokens
    try {
      window.localStorage.setItem('superapp.auth.tokens', JSON.stringify(tokens))
      // Also set for legacy apps that expect 'access_token' directly
      window.localStorage.setItem('access_token', tokens.accessToken)
      if (tokens.refreshToken) {
        window.localStorage.setItem('refresh_token', tokens.refreshToken)
      }
    } catch (e) {
      console.warn('Failed to save tokens to localStorage', e)
    }
  }

  clearTokens(): void {
    memoryTokens = null
    try {
      window.localStorage.removeItem('superapp.auth.tokens')
      window.localStorage.removeItem('access_token')
      window.localStorage.removeItem('refresh_token')
    } catch (e) {
      // ignore
    }
  }
}
