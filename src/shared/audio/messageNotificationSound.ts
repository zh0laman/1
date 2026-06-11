const STORAGE_KEY = 'alem.workspace.messageNotificationSoundEnabled'

/** Файлы из `public/` с учётом `base` в vite.config (например `/web/`). */
function getPublicSoundUrl(fileName: string): string {
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/'
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}${fileName}`
}

function getMessageSoundUrl(): string {
  return getPublicSoundUrl('sound_17216.mp3')
}

export function isMessageNotificationSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value === null) return true
    return value !== 'false' && value !== '0'
  } catch {
    return true
  }
}

export function setMessageNotificationSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Browsers block audio until there is a user gesture. Call once from the app shell;
 * first click/keydown runs a silent play so later notification sounds are allowed.
 */
export function attachMessageNotificationAudioUnlockListeners(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const onFirstGesture = () => {
    try {
      const audio = new Audio(getMessageSoundUrl())
      audio.muted = true
      void audio
        .play()
        .then(() => {
          audio.pause()
        })
        .catch(() => {})
    } catch {
      // ignore
    }
    window.removeEventListener('pointerdown', onFirstGesture)
    window.removeEventListener('keydown', onFirstGesture)
  }

  window.addEventListener('pointerdown', onFirstGesture, { passive: true })
  window.addEventListener('keydown', onFirstGesture)

  return () => {
    window.removeEventListener('pointerdown', onFirstGesture)
    window.removeEventListener('keydown', onFirstGesture)
  }
}

/** Plays bundled notification mp3 for incoming chat messages. */
export function playMessageNotificationSound(): void {
  if (!isMessageNotificationSoundEnabled()) return
  if (typeof window === 'undefined') return

  try {
    const audio = new Audio(getMessageSoundUrl())
    audio.preload = 'auto'
    audio.volume = 1
    void audio.play().catch(() => {
      // autoplay policy or decode error
    })
  } catch {
    // ignore
  }
}

/** Звук при успешной отправке сообщения (`public/telegram_soundin.mp3`). Вызывается по жесту пользователя — автоплей не блокируется. */
export function playOutgoingMessageSound(): void {
  if (typeof window === 'undefined') return

  try {
    const audio = new Audio(getPublicSoundUrl('telegram_soundin.mp3'))
    audio.preload = 'auto'
    audio.volume = 1
    void audio.play().catch(() => {})
  } catch {
    // ignore
  }
}
