const LOCAL_AUTH_KEYS = ['superapp.auth.tokens', 'access_token', 'refresh_token', 'recentRealms', 'pageSize'] as const
const SESSION_AUTH_KEYS = ['rag_api_token', 'rag_token_auto'] as const
const LOCAL_AUTH_KEY_PREFIXES = ['kc-callback-'] as const

const safeRemove = (storage: Storage | undefined, key: string): void => {
  try {
    storage?.removeItem(key)
  } catch {
    // Storage may be unavailable in private or embedded contexts.
  }
}

export function clearLegacyAuthStorage(): void {
  if (typeof window === 'undefined') {
    return
  }

  for (const key of LOCAL_AUTH_KEYS) {
    safeRemove(window.localStorage, key)
  }
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (LOCAL_AUTH_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        safeRemove(window.localStorage, key)
      }
    }
  } catch {
    // Ignore storage enumeration errors.
  }
  for (const key of SESSION_AUTH_KEYS) {
    safeRemove(window.sessionStorage, key)
  }

  try {
    const raw = window.sessionStorage.getItem('rag_auth_payload')
    if (!raw) {
      return
    }

    const payload = JSON.parse(raw) as Record<string, unknown>
    delete payload.access_token
    delete payload.accessToken
    delete payload.refresh_token
    delete payload.refreshToken
    delete payload.token
    window.sessionStorage.setItem('rag_auth_payload', JSON.stringify(payload))
  } catch {
    safeRemove(window.sessionStorage, 'rag_auth_payload')
  }
}
