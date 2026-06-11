import type { ChatMessage, MessageType, ReplyToView } from '../../../domain/entities/Chat'
import { normalizeBackendAssetUrl } from '../../../infrastructure/http/normalizeBackendAssetUrl'
import { decryptChatContentWithAnyWrappedKey, isEncryptedChatPayload } from '../../../shared/utils/chatCrypto'
import type { ChatAttachmentViewModel, CryptoState, MentionContext, MessageView, UnavailableMessageKind } from './types'

const FOLDER_CHAT_ASSIGNMENTS_STORAGE_KEY = 'messenger_folder_chat_assignments_v1'
const voiceMarkers = ['/voice/', 'object_name=voice%2f', 'object_name=voice/']
const backendFileUrlMarkers = [
  '/api/v1/files/download',
  '/api/v1/files/url',
  '92.38.48.9',
  '100.72.193.178',
  'alem-superapp.qaztech.gov.kz',
  'alem-workspace.gov.kz'
]

const normalizeMessageAssetUrl = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined
  }

  const normalized = value.toLowerCase()
  if (!backendFileUrlMarkers.some((marker) => normalized.includes(marker))) {
    return value
  }

  return normalizeBackendAssetUrl(value) ?? value
}

export const readFolderChatAssignments = (): Record<string, string[]> => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(FOLDER_CHAT_ASSIGNMENTS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, string[]>
    return Object.fromEntries(
      Object.entries(parsed).map(([folderId, chatIds]) => [folderId, Array.isArray(chatIds) ? chatIds : []]),
    )
  } catch {
    return {}
  }
}

export const writeFolderChatAssignments = (value: Record<string, string[]>) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(FOLDER_CHAT_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(value))
}

export const getMentionContext = (value: string, caretIndex: number): MentionContext | null => {
  const safeCaret = Math.max(0, Math.min(caretIndex, value.length))
  const beforeCaret = value.slice(0, safeCaret)
  const match = beforeCaret.match(/(^|\s)@([^\s@]*)$/)

  if (!match) {
    return null
  }

  const query = match[2] ?? ''
  const start = beforeCaret.lastIndexOf('@')
  if (start < 0) {
    return null
  }

  return {
    start,
    end: safeCaret,
    query,
  }
}

export const formatTimeLabel = (value: string): string => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()

  if (sameDay) {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

export const formatMessageTime = (value: string): string => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const formatRecordingDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const isSameCalendarDate = (leftValue: string, rightValue: string): boolean => {
  const left = new Date(leftValue)
  const right = new Date(rightValue)

  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) {
    return false
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export const formatDaySeparatorLabel = (value: string): string => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (isSameCalendarDate(date.toISOString(), today.toISOString())) {
    return 'Сегодня'
  }

  if (isSameCalendarDate(date.toISOString(), yesterday.toISOString())) {
    return 'Вчера'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

export const getInitials = (value: string): string => {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return 'CH'
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export const getSeed = (value: string): number =>
  Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0)

const getSpecialMessageText = (type: MessageType): string => {
  switch (type) {
    case 'image':
      return 'Изображение'
    case 'video':
      return 'Видео'
    case 'file':
      return 'Файл'
    case 'audio':
      return 'Аудиосообщение'
    case 'voice':
      return 'Голосовое сообщение'
    case 'video_message':
      return 'Видеосообщение'
    case 'share_task':
      return 'Поделились задачей'
    case 'share_event':
      return 'Поделились событием'
    default:
      return 'Сообщение'
  }
}

const buildUnavailableMessageCopy = (
  kind: UnavailableMessageKind,
): { messageText: string; previewText: string } => {
  switch (kind) {
    case 'identity-mismatch':
      return {
        messageText: 'Это защищенное сообщение из старой истории недоступно.',
        previewText: 'Защищенное сообщение недоступно',
      }
    case 'missing-encrypted-keys':
      return {
        messageText: 'Это защищенное сообщение недоступно на этом устройстве.',
        previewText: 'Защищенное сообщение недоступно',
      }
    case 'missing-session':
    case 'missing-private-key':
    case 'decrypt-failed':
    default:
      return {
        messageText: 'Не удалось открыть защищенное сообщение на этом устройстве.',
        previewText: 'Защищенное сообщение недоступно',
      }
  }
}

const classifyUnavailableDecryptFailure = (
  error: unknown,
  exactEntryMissing: boolean,
): UnavailableMessageKind => {
  if (exactEntryMissing) {
    return 'identity-mismatch'
  }

  if (!(error instanceof Error)) {
    return 'decrypt-failed'
  }

  const normalized = error.message.toLowerCase()
  if (normalized.includes('wrapped key decrypt failed') || normalized.includes('no wrapped key matched')) {
    return 'identity-mismatch'
  }

  return 'decrypt-failed'
}

export const hasVoiceMarker = (...values: Array<string | null | undefined>): boolean =>
  values.some((value) => {
    const normalized = (value ?? '').toLowerCase()
    return voiceMarkers.some((marker) => normalized.includes(marker))
  })

export const resolveMessageTypeFromAttachment = (type: string | null | undefined): MessageType => {
  if (!type) {
    return 'text'
  }

  const normalized = type.toLowerCase()
  if (normalized === 'image' || normalized.startsWith('image/')) {
    return 'image'
  }
  if (normalized === 'video' || normalized.startsWith('video/')) {
    return 'video'
  }
  if (normalized === 'audio' || normalized.startsWith('audio/')) {
    return 'audio'
  }
  if (normalized === 'voice' || normalized === 'audio/opus' || normalized.includes('voice')) {
    return 'voice'
  }
  if (normalized === 'video_message' || normalized === 'video_note' || normalized.includes('video_message')) {
    return 'video_message'
  }
  if (normalized === 'file' || normalized === 'document' || normalized.includes('/')) {
     return 'file'
  }

  return 'text'
}

export const parseJsonRecord = (value: string | null | undefined): Record<string, unknown> | null => {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const getFileExtension = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined
  }

  const cleanValue = value.split('?')[0]?.trim()
  if (!cleanValue) {
    return undefined
  }

  const lastDotIndex = cleanValue.lastIndexOf('.')
  if (lastDotIndex < 0) {
    return undefined
  }

  const ext = cleanValue.slice(lastDotIndex).toLowerCase()
  return ext || undefined
}

const normalizeAttachmentFilename = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  return trimmed.replace(/^\d{10,}_/, '')
}

const getObjectNameFromUrl = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined
  }

  try {
    const parsed = new URL(value, window.location.origin)
    const objectName = parsed.searchParams.get('object_name')
    return objectName ? decodeURIComponent(objectName) : undefined
  } catch {
    return undefined
  }
}

const getFilenameFromUrl = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined
  }

  const objectName = getObjectNameFromUrl(value)
  if (objectName) {
    const fromObjectName = normalizeAttachmentFilename(objectName.split('/').pop())
    if (fromObjectName) {
      return fromObjectName
    }
  }

  try {
    const parsed = new URL(value, window.location.origin)
    const pathnameFilename = normalizeAttachmentFilename(parsed.pathname.split('/').pop())
    if (pathnameFilename) {
      return pathnameFilename
    }
  } catch {
    const pathnameFilename = normalizeAttachmentFilename(value.split('/').pop())
    if (pathnameFilename) {
      return pathnameFilename
    }
  }

  return undefined
}

export const iconByExtension = (ext?: string): ChatAttachmentViewModel['icon'] => {
  switch (ext) {
    case '.pdf':
      return 'pdf'
    case '.doc':
    case '.docx':
      return 'word'
    case '.xls':
    case '.xlsx':
    case '.csv':
      return 'excel'
    case '.ppt':
    case '.pptx':
      return 'presentation'
    case '.txt':
      return 'text'
    case '.zip':
    case '.rar':
    case '.7z':
      return 'archive'
    default:
      return 'file'
  }
}

const readFirstString = (records: Array<Record<string, unknown> | null>, keys: string[]): string | null => {
  for (const record of records) {
    if (!record) {
      continue
    }

    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  }

  return null
}

const isVideoCallLikeMessage = (
  message: ChatMessage,
  resolvedContent: { content: string; unavailable: boolean },
): boolean => {
  if (message.type === 'video_message') {
    return true
  }

  if (message.type !== 'text') {
    return false
  }

  const payloads = [parseJsonRecord(message.metadata), parseJsonRecord(message.content)]
  const direction = readFirstString(payloads, ['direction', 'call_direction', 'callDirection', 'kind'])
  const status = readFirstString(payloads, ['status', 'call_status', 'callStatus', 'state'])
  const type = readFirstString(payloads, ['type', 'message_type', 'messageType', 'event'])

  if (direction || status || type) {
    const jsonBlob = `${direction ?? ''} ${status ?? ''} ${type ?? ''}`.toLowerCase()
    if (
      jsonBlob.includes('call') ||
      jsonBlob.includes('video') ||
      jsonBlob.includes('звон') ||
      jsonBlob.includes('видео')
    ) {
      return true
    }
  }

  const rawBlob = `${resolvedContent.unavailable ? '' : resolvedContent.content} ${message.metadata ?? ''}`.toLowerCase().trim()
  const normalizedRawBlob = rawBlob.replace(/\s+/g, ' ')
  if (!rawBlob) {
    return false
  }

  return (
    normalizedRawBlob === 'видеозвонок' ||
    normalizedRawBlob === 'video call' ||
    normalizedRawBlob === 'исходящий видеозвонок' ||
    normalizedRawBlob === 'входящий видеозвонок' ||
    rawBlob.includes('incoming_call') ||
    rawBlob.includes('outgoing_call') ||
    rawBlob.includes('call_status') ||
    rawBlob.includes('call_direction')
  )
}

const resolveRenderableMessageType = (
  message: ChatMessage,
  resolvedContent: { content: string; unavailable: boolean },
): MessageType => {
  if (message.type === 'text' && message.metadata) {
    try {
      const meta = JSON.parse(message.metadata)
      if (meta && (meta.is_service === true || meta.system_type)) {
        return 'service'
      }
    } catch (_) {}
  }

  if (message.type !== 'video_message') {
    return message.type
  }

  const attachmentType = (message.attachmentType ?? '').toLowerCase()
  if (attachmentType.startsWith('audio/')) {
    return 'voice'
  }

  const content = resolvedContent.unavailable ? '' : resolvedContent.content.toLowerCase()
  const attachmentUrl = (message.attachmentUrl ?? '').toLowerCase()

  if (hasVoiceMarker(content, attachmentUrl)) {
    return 'voice'
  }

  return message.type
}

const resolveMessageAttachment = (
  message: ChatMessage,
  renderableType: MessageType,
  resolvedContent: { content: string; unavailable: boolean },
): ChatAttachmentViewModel | undefined => {
  if (resolvedContent.unavailable) {
    return undefined
  }

  if (!['image', 'video', 'video_message', 'audio', 'voice', 'file'].includes(renderableType)) {
    return undefined
  }

  const metadata = parseJsonRecord(message.metadata)
  const attachmentMetadata = metadata?.attachment && typeof metadata.attachment === 'object' && !Array.isArray(metadata.attachment)
    ? (metadata.attachment as Record<string, unknown>)
    : null

  const metadataFilename =
    typeof attachmentMetadata?.filename === 'string'
      ? attachmentMetadata.filename
      : typeof metadata?.title === 'string'
        ? metadata.title
        : typeof metadata?.file_name === 'string'
          ? metadata.file_name
        : null
  const metadataObjectName = typeof attachmentMetadata?.object_name === 'string' ? attachmentMetadata.object_name : null
  const url =
    normalizeMessageAssetUrl(message.attachmentUrl) ??
    normalizeMessageAssetUrl(resolvedContent.content) ??
    normalizeMessageAssetUrl(typeof metadata?.download_url === 'string' ? metadata.download_url : null) ??
    (metadataObjectName ? normalizeMessageAssetUrl(`/api/v1/files/download?object_name=${encodeURIComponent(metadataObjectName)}`) : undefined)
  if (!url) {
    return undefined
  }
  const metadataMime =
    typeof attachmentMetadata?.mime === 'string'
      ? attachmentMetadata.mime
      : typeof metadata?.mime_type === 'string'
        ? metadata.mime_type
        : null
  const metadataExt = typeof attachmentMetadata?.ext === 'string' ? attachmentMetadata.ext.toLowerCase() : null
  const metadataSize =
    typeof attachmentMetadata?.size === 'number'
      ? attachmentMetadata.size
      : typeof attachmentMetadata?.size === 'string'
        ? Number(attachmentMetadata.size)
        : typeof metadata?.size === 'number'
          ? metadata.size
          : typeof metadata?.size === 'string'
            ? Number(metadata.size)
        : null

  const objectName = metadataObjectName ?? getObjectNameFromUrl(url)
  const filename =
    normalizeAttachmentFilename(metadataFilename) ??
    normalizeAttachmentFilename(message.attachmentUrl?.split('/').pop()) ??
    normalizeAttachmentFilename(objectName?.split('/').pop()) ??
    getFilenameFromUrl(url) ??
    'file'
  const ext = metadataExt ?? getFileExtension(filename) ?? getFileExtension(objectName) ?? getFileExtension(url)
  const mime = message.attachmentType ?? metadataMime ?? undefined
  const size = message.attachmentSize ?? (Number.isFinite(metadataSize) && metadataSize !== null ? metadataSize : undefined)

  if (renderableType === 'image') {
    return { kind: 'image', url, objectName: objectName ?? undefined, filename, size, mime, ext, icon: 'image' }
  }

  if (renderableType === 'video') {
    return { kind: 'video', url, objectName: objectName ?? undefined, filename, size, mime, ext, icon: 'video' }
  }

  if (renderableType === 'video_message') {
    return { kind: 'video_message', url, objectName: objectName ?? undefined, filename, size, mime, ext, icon: 'video' }
  }

  if (renderableType === 'audio' || renderableType === 'voice') {
    return { kind: renderableType, url, objectName: objectName ?? undefined, filename, size, mime, ext, icon: 'audio' }
  }

  return {
    kind: 'file',
    url,
    objectName: objectName ?? undefined,
    filename,
    size,
    mime,
    ext,
    icon: iconByExtension(ext),
  }
}

const resolveDecryptedValue = async (
  content: string,
  encryptedKeys: Record<string, string>,
  cryptoState: CryptoState,
): Promise<{
  content: string
  previewText?: string
  unavailable: boolean
  unavailableKind?: UnavailableMessageKind
  unavailableReason?: string
}> => {
  if (!isEncryptedChatPayload(content)) {
    return { content, unavailable: false }
  }

  if (!cryptoState.currentDeviceId) {
    const reason = 'Current web_device_id is missing in session.'
    const copy = buildUnavailableMessageCopy('missing-session')
    return {
      content: copy.messageText,
      previewText: copy.previewText,
      unavailable: true,
      unavailableKind: 'missing-session',
      unavailableReason: reason,
    }
  }

  if (!cryptoState.privateKey) {
    const reason = `Private key for device ${cryptoState.currentDeviceId} is missing in IndexedDB.`
    const copy = buildUnavailableMessageCopy('missing-private-key')
    return {
      content: copy.messageText,
      previewText: copy.previewText,
      unavailable: true,
      unavailableKind: 'missing-private-key',
      unavailableReason: reason,
    }
  }

  const wrappedKeyEntries = Object.entries(encryptedKeys)

  if (wrappedKeyEntries.length === 0) {
    const reason = 'encrypted_keys is empty for this message.'
    const copy = buildUnavailableMessageCopy('missing-encrypted-keys')
    return {
      content: copy.messageText,
      previewText: copy.previewText,
      unavailable: true,
      unavailableKind: 'missing-encrypted-keys',
      unavailableReason: reason,
    }
  }

  try {
    const { plaintext } = await decryptChatContentWithAnyWrappedKey(
      content,
      encryptedKeys,
      cryptoState.privateKey,
      cryptoState.currentDeviceId,
    )
    return { content: plaintext, unavailable: false }
  } catch (error) {
    const exactEntryMissing = !(cryptoState.currentDeviceId in encryptedKeys)
    const unavailableKind = classifyUnavailableDecryptFailure(error, exactEntryMissing)
    const reason = exactEntryMissing
      ? `encrypted_keys has no entry for device ${cryptoState.currentDeviceId}, and none of the other wrapped keys matched the current identity key.`
      : error instanceof Error
        ? `Decrypt failed: ${error.message}`
        : 'Decrypt failed for an unknown reason.'
    const copy = buildUnavailableMessageCopy(unavailableKind)
    return {
      content: copy.messageText,
      previewText: copy.previewText,
      unavailable: true,
      unavailableKind,
      unavailableReason: reason,
    }
  }
}

const resolveMessageContentValue = (message: ChatMessage, cryptoState: CryptoState) =>
  resolveDecryptedValue(message.content, message.encryptedKeys, cryptoState)

const resolveReplyToView = async (replyTo: ReplyToView, cryptoState: CryptoState): Promise<ReplyToView> => {
  const resolved = await resolveDecryptedValue(replyTo.content, replyTo.encryptedKeys ?? {}, cryptoState)
  return {
    ...replyTo,
    content: resolved.content,
  }
}

export const resolveMessageText = async (
  message: ChatMessage,
  cryptoState: CryptoState,
  options?: { compact?: boolean },
): Promise<{ text: string; unavailable: boolean; unavailableKind?: UnavailableMessageKind; unavailableReason?: string }> => {
  if (message.isDeleted) {
    return { text: 'Сообщение удалено', unavailable: false }
  }

  const resolved = await resolveMessageContentValue(message, cryptoState)

  if (message.type !== 'text') {
    return { text: getSpecialMessageText(message.type), unavailable: false }
  }

  return {
    text: resolved.unavailable && options?.compact ? resolved.previewText ?? resolved.content : resolved.content,
    unavailable: resolved.unavailable,
    unavailableKind: resolved.unavailableKind,
    unavailableReason: resolved.unavailableReason,
  }
}

export const toMessageView = async (
  message: ChatMessage,
  currentUserId: number,
  cryptoState: CryptoState,
): Promise<MessageView> => {
  const resolved = await resolveMessageText(message, cryptoState)
  const resolvedContent = await resolveMessageContentValue(message, cryptoState)
  const senderLabel = message.senderFullName || message.senderUsername || 'Unknown'
  const renderableType = resolveRenderableMessageType(message, resolvedContent)
  const isCall = isVideoCallLikeMessage(message, resolvedContent)
  const attachment = resolveMessageAttachment(message, renderableType, resolvedContent)

  return {
    raw: message,
    replyTo: message.replyTo ? await resolveReplyToView(message.replyTo, cryptoState) : null,
    kind: renderableType,
    from: message.senderId === currentUserId ? 'me' : 'them',
    senderLabel,
    text: resolved.text,
    attachment,
    mediaUrl: attachment?.kind === 'image' ? attachment.url : undefined,
    audioUrl: attachment?.kind === 'voice' || attachment?.kind === 'audio' ? attachment.url : undefined,
    videoUrl: attachment?.kind === 'video' || attachment?.kind === 'video_message' ? attachment.url : undefined,
    time: formatMessageTime(message.createdAt),
    status: message.isRead ? 'read' : 'delivered',
    unavailable: resolved.unavailable,
    unavailableKind: resolved.unavailableKind,
    unavailableReason: resolved.unavailableReason,
    isCall,
  }
}
