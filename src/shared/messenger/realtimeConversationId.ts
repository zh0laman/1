/** UUID v4 — приводим к нижнему регистру, чтобы mute-карта совпадала с WS payload. */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeConversationIdKey(id: string): string {
  const t = id.trim()
  if (t && UUID_V4_RE.test(t)) {
    return t.toLowerCase()
  }
  return t
}

function firstNonEmptyString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string') {
      const s = v.trim()
      if (s) return s
    }
  }
  return ''
}

const CHAT_ID_KEYS = [
  'conversation_id',
  'conversationId',
  'chat_id',
  'chatId',
  'group_id',
  'groupId',
  'channel_id',
  'channelId',
  'room_id',
  'roomId',
] as const

/**
 * `event.content` иногда приходит JSON-строкой (не объектом) — без парса id не извлечь.
 */
export function getRealtimeContentRecord(event: Record<string, unknown>): Record<string, unknown> | null {
  const raw = event.content
  if (raw && typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw.trim()) as unknown
      if (parsed && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }
  return null
}

/**
 * Достаёт идентификатор чата из плоского или вложенного объекта WS payload.
 */
function conversationIdFromMetadata(obj: Record<string, unknown>): string {
  const meta = obj.metadata
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return pickConversationIdFromRecord(meta as Record<string, unknown>)
  }
  if (typeof meta === 'string' && meta.trim()) {
    try {
      const parsed = JSON.parse(meta.trim()) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return pickConversationIdFromRecord(parsed as Record<string, unknown>)
      }
    } catch {
      return ''
    }
  }
  return ''
}

export function pickConversationIdFromRecord(obj: Record<string, unknown> | null | undefined): string {
  if (!obj) return ''

  const direct = firstNonEmptyString(obj, [...CHAT_ID_KEYS])
  if (direct) return direct

  const fromMeta = conversationIdFromMetadata(obj)
  if (fromMeta) return fromMeta

  const nestedKeys = ['content', 'message', 'chat_message', 'data'] as const
  for (const nk of nestedKeys) {
    const nested = obj[nk]
    if (nested && typeof nested === 'object') {
      const inner = pickConversationIdFromRecord(nested as Record<string, unknown>)
      if (inner) return inner
    }
  }

  return ''
}

function pickSenderIdForMute(event: Record<string, unknown>, content: Record<string, unknown> | null): number | null {
  const candidates: unknown[] = [
    event.from,
    content?.sender_id,
    content?.senderId,
    content?.user_id,
    content?.userId,
    content?.author_id,
    content?.authorId,
  ]
  for (const v of candidates) {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v.trim())
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function resolveChatType(event: Record<string, unknown>, content: Record<string, unknown> | null): string {
  return (
    firstNonEmptyString(event, ['chat_type', 'chatType']) ||
    (content ? firstNonEmptyString(content, ['chat_type', 'chatType']) : '')
  ).toLowerCase()
}

/**
 * Единая точка: извлекает conversation/group/channel id из события (включая content-json-string).
 */
export function resolveRealtimeConversationId(event: Record<string, unknown>): string {
  const fromEvent = pickConversationIdFromRecord(event)
  if (fromEvent) return fromEvent
  const parsed = getRealtimeContentRecord(event)
  return pickConversationIdFromRecord(parsed)
}

const PERSONAL_CHAT_TYPES = new Set(['personal', 'direct', 'private', 'dm', 'dialog', 'one_to_one', '1:1'])

/**
 * Учитывает карту mute из WorkspaceLayout: uuid-чаты и резерв `peer:<userId>` для личных переписок,
 * если сервер не прислал conversation_id, но прислал chat_type + sender.
 */
export function isIncomingChatMuted(
  event: Record<string, unknown>,
  muteMap: Record<string, boolean>,
): boolean {
  const convIdRaw = resolveRealtimeConversationId(event)
  const convId = convIdRaw ? normalizeConversationIdKey(convIdRaw) : ''
  if (convId && muteMap[convId]) {
    return true
  }

  const content = getRealtimeContentRecord(event)
  const chatType = resolveChatType(event, content)
  if (!chatType || !PERSONAL_CHAT_TYPES.has(chatType)) {
    return false
  }

  const senderId = pickSenderIdForMute(event, content)
  if (senderId === null) {
    return false
  }

  return Boolean(muteMap[`peer:${senderId}`])
}
