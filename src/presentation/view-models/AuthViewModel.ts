import type { AuthTokens } from '../../domain/entities/AuthTokens'
import type { CurrentUser } from '../../domain/entities/CurrentUser'
import { getRemainingSeconds, parseJwtPayload } from '../../shared/utils/token'

export interface AuthViewModel {
  isAuthenticated: boolean
  userId: number | null
  email: string
  name: string
  expiresInSeconds: number
  role: string
  avatarUrl: string
}

export const toAuthViewModel = (tokens: AuthTokens | null, currentUser?: CurrentUser | null): AuthViewModel => {
  if (!tokens) {
    return {
      isAuthenticated: false,
      userId: null,
      email: '',
      name: '',
      expiresInSeconds: 0,
      role: '',
      avatarUrl: '',
    }
  }

  const payload = parseJwtPayload(tokens.accessToken)
  const nameFromApi = currentUser?.fullName || currentUser?.fullNameLocal
  const emailFromApi = currentUser?.email
  const roleFromApi = currentUser?.role
  const avatarFromApi = currentUser?.avatarUrl

  return {
    isAuthenticated: true,
    userId: currentUser?.id ?? null,
    email: emailFromApi ?? payload.email ?? '',
    name: nameFromApi ?? payload.name ?? payload.preferred_username ?? 'User',
    expiresInSeconds: getRemainingSeconds(tokens.expiresAt),
    role: roleFromApi ?? '',
    avatarUrl: avatarFromApi ?? '',
  }
}
