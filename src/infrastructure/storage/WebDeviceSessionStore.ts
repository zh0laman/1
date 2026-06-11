const CURRENT_DEVICE_KEY = 'superapp.chat.currentWebDeviceId'

export class WebDeviceSessionStore {
  getCurrentDeviceId(): string | null {
    return localStorage.getItem(CURRENT_DEVICE_KEY)
  }

  getOrCreateCurrentDeviceId(): string {
    const existing = this.getCurrentDeviceId()
    if (existing) {
      return existing
    }

    const nextDeviceId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    this.setCurrentDeviceId(nextDeviceId)
    return nextDeviceId
  }

  setCurrentDeviceId(deviceId: string): void {
    localStorage.setItem(CURRENT_DEVICE_KEY, deviceId)
  }

  clearCurrentDeviceId(): void {
    localStorage.removeItem(CURRENT_DEVICE_KEY)
  }
}
