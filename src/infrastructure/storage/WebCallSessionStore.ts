import type { StoredCallSnapshot } from '../../domain/entities/Call'

const CURRENT_CALL_SESSION_KEY = 'superapp.calls.sessionId'
const CURRENT_CALL_SNAPSHOT_KEY = 'superapp.calls.snapshot'

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

const generateId = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export class WebCallSessionStore {
  getCurrentSessionId(): string | null {
    return getSessionStorage()?.getItem(CURRENT_CALL_SESSION_KEY) ?? null
  }

  getOrCreateSessionId(): string {
    const storage = getSessionStorage()
    const existing = storage?.getItem(CURRENT_CALL_SESSION_KEY)
    if (existing) {
      return existing
    }

    const nextId = generateId()
    storage?.setItem(CURRENT_CALL_SESSION_KEY, nextId)
    return nextId
  }

  getCurrentCallSnapshot(): StoredCallSnapshot | null {
    const raw = getSessionStorage()?.getItem(CURRENT_CALL_SNAPSHOT_KEY)
    if (!raw) {
      return null
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoredCallSnapshot>
      if (!parsed.callId || !parsed.roomName) {
        return null
      }

      return {
        callId: String(parsed.callId),
        roomName: String(parsed.roomName),
        chatId: String(parsed.chatId ?? ''),
        kind: parsed.kind === 'group' ? 'group' : 'direct',
        direction: parsed.direction === 'incoming' ? 'incoming' : 'outgoing',
        displayName: String(parsed.displayName ?? ''),
        fromName: String(parsed.fromName ?? ''),
        fromUserId: Number(parsed.fromUserId ?? 0),
        groupId: String(parsed.groupId ?? ''),
        groupName: String(parsed.groupName ?? ''),
        createdAt: String(parsed.createdAt ?? ''),
      }
    } catch {
      return null
    }
  }

  setCurrentCallSnapshot(snapshot: StoredCallSnapshot): void {
    getSessionStorage()?.setItem(CURRENT_CALL_SNAPSHOT_KEY, JSON.stringify(snapshot))
  }

  clearCurrentCallSnapshot(): void {
    getSessionStorage()?.removeItem(CURRENT_CALL_SNAPSHOT_KEY)
  }
}
