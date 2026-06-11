export interface AuthFlashNotice {
  kind: 'info' | 'warning' | 'error'
  title: string
  message: string
}

const AUTH_FLASH_NOTICE_KEY = 'superapp.auth.flashNotice'

export const storeAuthFlashNotice = (notice: AuthFlashNotice): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(AUTH_FLASH_NOTICE_KEY, JSON.stringify(notice))
}

export const consumeAuthFlashNotice = (): AuthFlashNotice | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.sessionStorage.getItem(AUTH_FLASH_NOTICE_KEY)
  if (!raw) {
    return null
  }

  window.sessionStorage.removeItem(AUTH_FLASH_NOTICE_KEY)

  try {
    return JSON.parse(raw) as AuthFlashNotice
  } catch {
    return null
  }
}
