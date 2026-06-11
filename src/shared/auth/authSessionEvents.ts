export interface AuthSessionExpiredDetail {
  message?: string
  reason?: 'unauthorized' | 'device_rotation' | 'websocket'
}

export interface ProfileUpdatedDetail {
  avatarUrl?: string
  firstName?: string
  lastName?: string
  fullName?: string
}

export const AUTH_SESSION_EXPIRED_EVENT = 'superapp:auth-session-expired'
export const PROFILE_UPDATED_EVENT = 'superapp:profile-updated'

export const dispatchAuthSessionExpired = (detail: AuthSessionExpiredDetail = {}): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<AuthSessionExpiredDetail>(AUTH_SESSION_EXPIRED_EVENT, { detail }))
}

export const dispatchProfileUpdated = (detail: ProfileUpdatedDetail): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, { detail }))
}
