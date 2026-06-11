export interface JwtPayload {
  email?: string
  name?: string
  preferred_username?: string
}

export const parseJwtPayload = (token: string): JwtPayload => {
  const parts = token.split('.')

  if (parts.length < 2) {
    return {}
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const json = atob(padded)
    return JSON.parse(json) as JwtPayload
  } catch {
    return {}
  }
}

export const getExpiresAtMs = (expiresAt: string): number => {
  const timestamp = Date.parse(expiresAt)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export const isExpired = (expiresAt: string, skewMs = 0): boolean => {
  const expiresAtMs = getExpiresAtMs(expiresAt)

  if (!expiresAtMs) {
    return true
  }

  return Date.now() + skewMs >= expiresAtMs
}

export const getRemainingSeconds = (expiresAt: string): number => {
  const expiresAtMs = getExpiresAtMs(expiresAt)

  if (!expiresAtMs) {
    return 0
  }

  return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
}
