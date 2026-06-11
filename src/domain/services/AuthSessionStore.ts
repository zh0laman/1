import type { AuthTokens } from '../entities/AuthTokens'

export interface AuthSessionStore {
  getTokens(): AuthTokens | null
  setTokens(tokens: AuthTokens): void
  clearTokens(): void
}
