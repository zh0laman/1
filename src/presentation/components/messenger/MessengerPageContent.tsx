import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ChangeEvent, CSSProperties, FormEvent, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react'
import { useLayoutEffect } from 'react'
import type { AuthTokens } from '../../../domain/entities/AuthTokens'
import type { CurrentUser } from '../../../domain/entities/CurrentUser'
import type { ChatTheme, ChatThemeConfigInput } from '../../../domain/entities/ChatTheme'
import type { ChatFolder, ChatGroupDetails, ChatGroupMember, ChatMessage, MessageType, MessageViewer, PinnedMessage, ReplyToView, UnifiedChat, ChatType } from '../../../domain/entities/Chat'
import { HttpAuthRepository } from '../../../infrastructure/repositories/HttpAuthRepository'
import { HttpChatRepository, toChatMessage } from '../../../infrastructure/repositories/HttpChatRepository'
import { HttpChatThemeRepository } from '../../../infrastructure/repositories/HttpChatThemeRepository'
import { HttpChannelRepository, toChannelPost } from '../../../infrastructure/repositories/HttpChannelRepository'
import type { ChannelPostViewDto } from '../../../infrastructure/repositories/HttpChannelRepository'
import type { ChannelView, UpdateChannelInput, ChannelPostView } from '../../../domain/entities/Channel'
import {
  HttpUserDirectoryRepository,
  type CreateUserReviewInput,
  type UserDirectoryUser,
  type UserDirectoryUserDetails,
} from '../../../infrastructure/repositories/HttpUserDirectoryRepository'
import { IndexedDbKeyStore } from '../../../infrastructure/storage/IndexedDbKeyStore'
import { LocalStorageAuthSessionStore } from '../../../infrastructure/storage/LocalStorageAuthSessionStore'
import { WebDeviceSessionStore } from '../../../infrastructure/storage/WebDeviceSessionStore'
import { normalizeBackendAssetUrl } from '../../../infrastructure/http/normalizeBackendAssetUrl'
import { dispatchAuthSessionExpired } from '../../../shared/auth/authSessionEvents'
import { refreshSessionWithLock } from '../../../infrastructure/http/authorizedFetch'
import { playOutgoingMessageSound } from '../../../shared/audio/messageNotificationSound'
import { ALEM_MESSENGER_MUTE_MAP_EVENT } from '../../../shared/messenger/muteMapEvents'
import { normalizeConversationIdKey } from '../../../shared/messenger/realtimeConversationId'
import { shouldReloadMessengerChatList } from '../../../shared/messenger/messengerWsEventsWithoutChatReload'
import { getErrorMessage } from '../../../shared/utils/getErrorMessage'
import { encryptChatContent } from '../../../shared/utils/chatCrypto'
import { HttpSmartAgentRepository } from '../../../infrastructure/repositories/HttpSmartAgentRepository'
import { HttpAlemAiRepository } from '../../../infrastructure/repositories/HttpAlemAiRepository'
import MS from '../../../shared/ui/MaterialSymbol'
import { C } from '../../pages/dashboard/model/constants'
import ChatSearchPanel from './ChatSearchPanel'
import ContactItem from './ContactItem'
import ChatHistoryLoadingState from './ChatHistoryLoadingState'
import EmojiPicker from './EmojiPicker'
import InfoPanel from './InfoPanel'
import GroupProfileModal from './GroupProfileModal'
import ChannelProfileModal from './ChannelProfileModal'
import type { ChannelMember, ChannelRole } from '../../../domain/entities/Channel'
import MessageBubble from './MessageBubble'
import MessengerAvatar from './MessengerAvatar'
import MessengerThemePanel from './MessengerThemePanel'
import PinnedIcon from './PinnedIcon'
import UserProfileModal from './UserProfileModal'
import VideoMessageRecordingPreview from './VideoMessageRecordingPreview'
import DriveFilePickerModal from './DriveFilePickerModal'
// @ts-expect-error: drive-src uses internal legacy logic
import { grantPermission } from '../../pages/alemdrive/drive-src/api/files'
import { useCallManager } from '../../calls/useCallManager'
import { useQrLogin } from '../../hooks/useQrLogin'
import { MESSENGER_VIDEO_CALLS_ENABLED } from './featureFlags'
import type {
  ChatListItem,
  ChatListContextMenuState,
  ChatSearchResultItem,
  CryptoState,
  CurrentUserState,
  MessageContextMenuState,
  MessageView,
  SelectedMessageActionState,
  TypingIndicatorState,
} from './types'
import { SsoE2eeRecoveryUseCase } from '../../../application/use-cases/auth/SsoE2eeRecoveryUseCase'
import {
  formatDaySeparatorLabel,
  formatMessageTime,
  formatRecordingDuration,
  formatTimeLabel,
  getInitials,
  getMentionContext,
  getSeed,
  isSameCalendarDate,
  readFolderChatAssignments,
  resolveMessageText,
  resolveMessageTypeFromAttachment,
  toMessageView,
  writeFolderChatAssignments,
  parseJsonRecord,
} from './utils'

const getFriendlyMessageText = (text: string | null | undefined, type: string): string => {
  if (!text) return 'Сообщение'
  const normalized = text.toLowerCase()
  const isUrl = normalized.startsWith('http') || normalized.startsWith('/api/') || normalized.includes('object_name=')
  if (isUrl) {
    switch (type) {
      case 'image':
        return 'Изображение'
      case 'video':
        return 'Видео'
      case 'video_message':
        return 'Видеосообщение'
      case 'voice':
        return 'Голосовое сообщение'
      case 'audio':
        return 'Аудиосообщение'
      case 'file':
        return 'Файл'
      default:
        return 'Сообщение'
    }
  }
  return text
}

const CHAT_FOLDERS_RAIL_WIDTH = 76
const DEFAULT_CHAT_LIST_PANEL_WIDTH = 420
const MIN_CHAT_LIST_PANEL_WIDTH = 340
const MAX_CHAT_LIST_PANEL_WIDTH = 580
const RECORD_LOCK_THRESHOLD = 84
const CHAT_HISTORY_PAGE_SIZE = 50
const CHAT_HISTORY_TOP_THRESHOLD = 120
const CHAT_HISTORY_BOTTOM_THRESHOLD = 40
const MESSENGER_UNREAD_COUNT_EVENT = 'messenger:unread-count-changed'
const CHANNEL_VIEWED_AT_STORAGE_KEY = 'messenger:channel-viewed-at'
const MOBILE_MESSENGER_BREAKPOINT = 960
const CHAT_SEARCH_MIN_QUERY_LENGTH = 2
const CHAT_SEARCH_DEBOUNCE_MS = 320
const CHAT_SEARCH_PANEL_LIMIT = 20
const IMAGE_ATTACHMENT_LIMIT_BYTES = 50 * 1024 * 1024
const VIDEO_ATTACHMENT_LIMIT_BYTES = 1024 * 1024 * 1024
const DOCUMENT_ATTACHMENT_LIMIT_BYTES = 100 * 1024 * 1024
const GENERIC_ATTACHMENT_LIMIT_BYTES = 500 * 1024 * 1024
const IMAGE_ATTACHMENT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const VIDEO_ATTACHMENT_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv'])
const AUDIO_ATTACHMENT_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus'])
const DOCUMENT_ATTACHMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'])

const shouldSkipServerReadReceipt = (messageId: string): boolean =>
  !messageId || messageId.startsWith('sa-history-') || messageId.startsWith('draft-')

const EMPTY_CHAT_STATE_MESSAGES = [
  'Добрый день, {name}. С чего начнем общение?',
  'Рады видеть вас, {name}. Выберите собеседника из списка слева.',
  '{name}, ваши коллеги на связи. Кому отправим сообщение?',
  'Добро пожаловать в рабочее пространство. Выберите чат для начала работы.',
  'Напишите коллегам прямо сейчас — просто выберите чат слева.',
  'Все обсуждения под рукой. Кликните на чат, чтобы продолжить.',
  'С кем хотите связаться сегодня?',
]

const SMART_ASSISTANT_PROFILE_ID = -1

const isVirtualProfileId = (userId: number | null | undefined): userId is number =>
  typeof userId === 'number' && userId <= 0

const buildSmartAssistantProfile = (): UserDirectoryUserDetails => ({
  id: SMART_ASSISTANT_PROFILE_ID,
  email: 'smart.ai@alem.local',
  username: 'smart_agent',
  firstName: 'Smart',
  lastName: 'AI',
  fullName: 'Smart AI',
  avatarUrl: null,
  isActive: true,
  lastSeenAt: null,
  keycloakId: 'smart-agent',
  iin: '',
  ministryId: null,
  stateBodyId: null,
  role: 'assistant',
  availabilityStatus: 'online',
  createdAt: null,
  lastLoginAt: null,
  isFirstLogin: false,
  isSupport: true,
  ministryName: '',
  stateBodyName: 'Alem Workspace',
  bossId: null,
  bossName: '',
  reviewStats: null,
  hasReviewedThisMonth: true,
  educations: [],
  licenses: [],
})

const pickRandomItem = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

type MessengerAttachmentUploadType = 'image' | 'video' | 'document' | 'file'

interface MessengerAttachmentSelection {
  uploadType: MessengerAttachmentUploadType
  messageType: MessageType
  ext: string
  mime: string
  maxSizeBytes: number
  limitLabel: string
}

const readChannelViewedAtMap = (): Record<string, string> => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(CHANNEL_VIEWED_AT_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, string> | null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeChannelViewedAtMap = (next: Record<string, string>): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(CHANNEL_VIEWED_AT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage failures and keep runtime behavior intact.
  }
}

const getAttachmentExtension = (filename: string): string => {
  const trimmed = filename.trim()
  const dotIndex = trimmed.lastIndexOf('.')
  return dotIndex >= 0 ? trimmed.slice(dotIndex).toLowerCase() : ''
}

const formatAttachmentLimit = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`
  }

  return `${Math.round(bytes / (1024 * 1024))} MB`
}

const classifyAttachmentFile = (file: File): MessengerAttachmentSelection => {
  const ext = getAttachmentExtension(file.name)
  const mime = file.type.toLowerCase()

  if (IMAGE_ATTACHMENT_EXTENSIONS.has(ext) || (mime.startsWith('image/') && (!ext || IMAGE_ATTACHMENT_EXTENSIONS.has(ext)))) {
    return {
      uploadType: 'image',
      messageType: 'image',
      ext,
      mime: mime || 'image/*',
      maxSizeBytes: IMAGE_ATTACHMENT_LIMIT_BYTES,
      limitLabel: formatAttachmentLimit(IMAGE_ATTACHMENT_LIMIT_BYTES),
    }
  }

  if (VIDEO_ATTACHMENT_EXTENSIONS.has(ext)) {
    return {
      uploadType: 'video',
      messageType: 'video',
      ext,
      mime: mime || 'video/*',
      maxSizeBytes: VIDEO_ATTACHMENT_LIMIT_BYTES,
      limitLabel: formatAttachmentLimit(VIDEO_ATTACHMENT_LIMIT_BYTES),
    }
  }

  if (AUDIO_ATTACHMENT_EXTENSIONS.has(ext) || mime.startsWith('audio/')) {
    return {
      uploadType: 'file',
      messageType: 'audio',
      ext,
      mime: mime || 'audio/*',
      maxSizeBytes: GENERIC_ATTACHMENT_LIMIT_BYTES,
      limitLabel: formatAttachmentLimit(GENERIC_ATTACHMENT_LIMIT_BYTES),
    }
  }

  if (DOCUMENT_ATTACHMENT_EXTENSIONS.has(ext)) {
    return {
      uploadType: 'document',
      messageType: 'file',
      ext,
      mime: mime || 'application/octet-stream',
      maxSizeBytes: DOCUMENT_ATTACHMENT_LIMIT_BYTES,
      limitLabel: formatAttachmentLimit(DOCUMENT_ATTACHMENT_LIMIT_BYTES),
    }
  }

  return {
    uploadType: 'file',
    messageType: 'file',
    ext,
    mime: mime || 'application/octet-stream',
    maxSizeBytes: GENERIC_ATTACHMENT_LIMIT_BYTES,
    limitLabel: formatAttachmentLimit(GENERIC_ATTACHMENT_LIMIT_BYTES),
  }
}

const clampChatListPanelWidth = (value: number): number => {
  const viewportCap = typeof window === 'undefined' ? MAX_CHAT_LIST_PANEL_WIDTH : Math.max(MIN_CHAT_LIST_PANEL_WIDTH, window.innerWidth - 420)
  return Math.min(Math.max(value, MIN_CHAT_LIST_PANEL_WIDTH), Math.min(MAX_CHAT_LIST_PANEL_WIDTH, viewportCap))
}

const DEFAULT_CHAT_THEME_CONFIG: ChatThemeConfigInput = {
  messageColorHex: '#2E78F6',
  backgroundType: 'default',
  backgroundColorHex: '#F3F7FD',
  backgroundImageUrl: null,
}

const normalizeThemeHex = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }

  return null
}

const toChatThemeDraft = (theme: ChatTheme | null): ChatThemeConfigInput => ({
  messageColorHex: normalizeThemeHex(theme?.messageColorHex) ?? DEFAULT_CHAT_THEME_CONFIG.messageColorHex,
  backgroundType: theme?.backgroundType ?? DEFAULT_CHAT_THEME_CONFIG.backgroundType,
  backgroundColorHex: normalizeThemeHex(theme?.backgroundColorHex) ?? DEFAULT_CHAT_THEME_CONFIG.backgroundColorHex,
  backgroundImageUrl: theme?.backgroundImageUrl ?? DEFAULT_CHAT_THEME_CONFIG.backgroundImageUrl,
})

const normalizeThemeConfig = (draft: ChatThemeConfigInput): ChatThemeConfigInput => {
  const backgroundType = draft.backgroundType ?? 'default'
  const backgroundImageUrl = draft.backgroundImageUrl?.trim() ? draft.backgroundImageUrl.trim() : null

  return {
    messageColorHex: normalizeThemeHex(draft.messageColorHex) ?? DEFAULT_CHAT_THEME_CONFIG.messageColorHex,
    backgroundType,
    backgroundColorHex: normalizeThemeHex(draft.backgroundColorHex) ?? DEFAULT_CHAT_THEME_CONFIG.backgroundColorHex,
    backgroundImageUrl: backgroundType === 'image' ? backgroundImageUrl : null,
  }
}

const prependMessageViews = (existing: MessageView[], incoming: MessageView[]): MessageView[] => {
  const existingById = new Map(existing.map((message) => [message.raw.id, message] as const))
  const incomingById = new Map(incoming.map((message) => [message.raw.id, message] as const))
  const orderedIds = [...incoming.map((message) => message.raw.id), ...existing.map((message) => message.raw.id)]
  const uniqueIds = orderedIds.filter((messageId, index) => orderedIds.indexOf(messageId) === index)

  return uniqueIds.map((messageId) => existingById.get(messageId) ?? incomingById.get(messageId)!).filter(Boolean)
}

const appendMessageViews = (existing: MessageView[], incoming: MessageView[]): MessageView[] => {
  const existingById = new Map(existing.map((message) => [message.raw.id, message] as const))
  const incomingById = new Map(incoming.map((message) => [message.raw.id, message] as const))
  const orderedIds = [...existing.map((message) => message.raw.id), ...incoming.map((message) => message.raw.id)]
  const uniqueIds = orderedIds.filter((messageId, index) => orderedIds.indexOf(messageId) === index)

  return uniqueIds.map((messageId) => incomingById.get(messageId) ?? existingById.get(messageId)!).filter(Boolean)
}

const isScrolledNearBottom = (element: HTMLElement): boolean => {
  const remainingDistance = Math.ceil(element.scrollHeight - element.scrollTop - element.clientHeight)
  return remainingDistance <= CHAT_HISTORY_BOTTOM_THRESHOLD
}

const getChatSearchTypeLabel = (type: MessageType): string | null => {
  switch (type) {
    case 'text':
      return null
    case 'image':
      return 'Изображение'
    case 'video':
      return 'Видео'
    case 'file':
      return 'Файл'
    case 'audio':
      return 'Аудио'
    case 'voice':
      return 'Голосовое'
    case 'video_message':
      return 'Видеокружок'
    case 'share_task':
      return 'Задача'
    case 'share_event':
      return 'Событие'
    default:
      return 'Сообщение'
  }
}

const formatLastSeen = (value: string | null | undefined): string => {
  if (!value) return 'Не в сети'
  const date = new Date(value)
  if (isNaN(date.getTime())) return 'Не в сети'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'был(а) в сети только что'
  if (diffMins < 60) return `был(а) в сети ${diffMins} мин. назад`

  const dayLabel = formatDaySeparatorLabel(value)
  const timeLabel = formatMessageTime(value)

  if (dayLabel === 'Сегодня') {
    return `был(а) в сети сегодня в ${timeLabel}`
  }
  if (dayLabel === 'Вчера') {
    return `был(а) в сети вчера в ${timeLabel}`
  }

  return `был(а) в сети ${dayLabel} в ${timeLabel}`
}

function VideoMessageModeIcon({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2.35" y="2.35" width="13.3" height="13.3" rx="4.2" stroke={color} strokeWidth="1.7" />
      <circle cx="9" cy="9" r="2.45" stroke={color} strokeWidth="1.6" />
    </svg>
  )
}

function EmojiModeIcon({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="9" cy="9" r="6.7" stroke={color} strokeWidth="1.7" />
      <circle cx="6.5" cy="7.2" r="0.85" fill={color} />
      <circle cx="11.5" cy="7.2" r="0.85" fill={color} />
      <path d="M6 10.2C6.6 11.5 7.67 12.15 9 12.15C10.33 12.15 11.4 11.5 12 10.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ThemeSettingsIcon({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M2.25 5.25H10.25" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7.75 12.75H15.75" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12.75" cy="5.25" r="2" stroke={color} strokeWidth="1.7" />
      <circle cx="5.25" cy="12.75" r="2" stroke={color} strokeWidth="1.7" />
    </svg>
  )
}

const MESSAGE_COMPOSER_MAX_HEIGHT_PX = 168

export default function MessengerPageContent() {
  const authRepository = useMemo(() => new HttpAuthRepository(), [])
  const sessionStore = useMemo(() => new LocalStorageAuthSessionStore(), [])
  const chatRepository = useMemo(() => new HttpChatRepository(sessionStore), [sessionStore])
  const chatThemeRepository = useMemo(() => new HttpChatThemeRepository(sessionStore), [sessionStore])
  const userDirectoryRepository = useMemo(() => new HttpUserDirectoryRepository(sessionStore), [sessionStore])
  const channelRepository = useMemo(() => new HttpChannelRepository(sessionStore), [sessionStore])
  const smartAgentRepository = useMemo(() => new HttpSmartAgentRepository(sessionStore), [sessionStore])
  const keyStore = useMemo(() => new IndexedDbKeyStore(), [])
  const webDeviceStore = useMemo(() => new WebDeviceSessionStore(), [])
  const ssoE2eeRecoveryUseCase = useMemo(() => new SsoE2eeRecoveryUseCase(authRepository, sessionStore, keyStore, webDeviceStore), [authRepository, sessionStore, keyStore, webDeviceStore])
  const { busyLabel: callBusyLabel, isBusy: isCallBusy, startDirectCall, startGroupCall } = useCallManager()
  const { username } = useParams<{ username?: string }>()
  const navigate = useNavigate()

  const [currentUser, setCurrentUser] = useState<CurrentUserState | null>(null)
  const [cryptoState, setCryptoState] = useState<CryptoState>({ currentDeviceId: null, privateKey: null })
  const [chats, setChats] = useState<ChatListItem[]>([])
  const [resolvedChannel, setResolvedChannel] = useState<ChannelView | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageView[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'groups' | 'personal' | 'channels'>('all')
  const [showInfo, setShowInfo] = useState(false)
  const [input, setInput] = useState('')
  const [folders, setFolders] = useState<ChatFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folderChatAssignments, setFolderChatAssignments] = useState<Record<string, string[]>>({})
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderError, setFolderError] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [pendingFolderAssignmentTarget, setPendingFolderAssignmentTarget] = useState<{
    chatId: string
    chatType: ChatType
  } | null>(null)
  const [isDeletingFolder, setIsDeletingFolder] = useState(false)
  const [isFolderUpdating, setIsFolderUpdating] = useState(false)
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [pendingNewMessagesCount, setPendingNewMessagesCount] = useState(0)
  const [chatListPanelWidth, setChatListPanelWidth] = useState(DEFAULT_CHAT_LIST_PANEL_WIDTH)
  const [isMobileLayout, setIsMobileLayout] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth < MOBILE_MESSENGER_BREAKPOINT))
  const [isChatListPanelResizing, setIsChatListPanelResizing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0)
  const [isRecordingVideoMessage, setIsRecordingVideoMessage] = useState(false)
  const [videoRecordingDurationSeconds, setVideoRecordingDurationSeconds] = useState(0)
  const [isRecordingLocked, setIsRecordingLocked] = useState(false)
  const [isRecordGestureActive, setIsRecordGestureActive] = useState(false)
  const [isRecordLockHintVisible, setIsRecordLockHintVisible] = useState(false)
  const [attachmentToUpload, setAttachmentToUpload] = useState<File | null>(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null)
  const [attachmentsToUpload, setAttachmentsToUpload] = useState<File[]>([])
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<string[]>([])
  const [smartAgentMessages, setSmartAgentMessages] = useState<MessageView[]>([])
  const [smartAgentSessionId, setSmartAgentSessionId] = useState<string | null>(null)
  const [isSmartAgentLoading, setIsSmartAgentLoading] = useState(false)
  const [smartAgentHistory, setSmartAgentHistory] = useState<unknown[]>([])
  const [isE2eeRestoreModalOpen, setIsE2eeRestoreModalOpen] = useState(false)
  const [e2eeRestorePassword, setE2eeRestorePassword] = useState('')
  const [isE2eeRestoreLoading, setIsE2eeRestoreLoading] = useState(false)
  const [e2eeRestoreError, setE2eeRestoreError] = useState('')
  const [hasRemoteE2eeBackup, setHasRemoteE2eeBackup] = useState<boolean | null>(null)
  const channelViewedAtMapRef = useRef<Record<string, string>>(readChannelViewedAtMap())

  const toChatListItem = useCallback(
    async (chat: UnifiedChat, onlineUserIds: Set<number> = new Set<number>()): Promise<ChatListItem> => {
      const title =
        chat.type === 'group'
          ? chat.groupName || 'Без названия'
          : chat.type === 'channel'
            ? chat.channelName || 'Канал'
            : chat.peerFullName || chat.peerUsername || `User ${chat.peerId ?? ''}`.trim()
      const preview = chat.lastMessage
        ? await resolveMessageText(chat.lastMessage, cryptoRef.current, { compact: true })
        : { text: 'Нет сообщений', unavailable: false }

      return {
        chat,
        title,
        subtitle: preview.text,
        time: chat.lastMessage ? formatTimeLabel(chat.lastMessage.createdAt) : formatTimeLabel(chat.updatedAt),
        avatar: getInitials(title),
        avatarUrl:
          chat.type === 'group'
            ? chat.groupAvatar
            : chat.type === 'channel'
              ? chat.channelAvatar
              : chat.peerAvatar,
        seed: getSeed(title),
        online: chat.peerId ? onlineUserIds.has(chat.peerId) : false,
        unread: chat.unreadCount,
      }
    },
    [],
  )

  const toChannelListItem = useCallback(
    (channel: ChannelView): ChatListItem => {
      const title = channel.name
      const subtitle = channel.lastPost?.content || channel.description || 'Нет постов'

      return {
        chat: {
          id: channel.id,
          type: 'channel',
          peerId: null,
          peerUsername: channel.username,
          peerFullName: null,
          peerAvatar: null,
          lastSeenAt: null,
          groupId: null,
          groupName: null,
          groupAvatar: null,
          channelId: channel.id,
          channelName: channel.name,
          channelAvatar: channel.avatarUrl,
          aiModel: null,
          aiTitle: null,
          lastMessage: null,
          unreadCount: 0,
          mentionCount: 0,
          isPinned: false,
          isMuted: channel.isMuted,
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt,
        },
        title,
        subtitle,
        time: formatTimeLabel(channel.lastPost?.createdAt || channel.updatedAt),
        avatar: getInitials(title),
        avatarUrl: channel.avatarUrl,
        seed: getSeed(title),
        online: false,
        unread: 0,
      }
    },
    [],
  )
  const [recordLockProgress, setRecordLockProgress] = useState(0)
  const [selectedRecorderMode, setSelectedRecorderMode] = useState<'voice' | 'video_message'>('voice')
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [muteToggleBusy, setMuteToggleBusy] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [chatTheme, setChatTheme] = useState<ChatTheme | null>(null)
  const [chatThemeDraft, setChatThemeDraft] = useState<ChatThemeConfigInput>(DEFAULT_CHAT_THEME_CONFIG)
  const [chatThemeError, setChatThemeError] = useState('')
  const chatThemeRequestVersionRef = useRef(0)
  const [isThemeSaving, setIsThemeSaving] = useState(false)
  const [isThemeResetting, setIsThemeResetting] = useState(false)
  const [isAiProofreading, setIsAiProofreading] = useState(false)
  const alemAiRepository = useMemo(() => new HttpAlemAiRepository(sessionStore), [sessionStore])
  const [isThemeImageUploading, setIsThemeImageUploading] = useState(false)
  const [typingByChat, setTypingByChat] = useState<Record<string, TypingIndicatorState>>({})
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(() => new Set<number>())
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [chatCreationMode, setChatCreationMode] = useState<'personal' | 'group' | 'channel'>('personal')
  const [groupCreateName, setGroupCreateName] = useState('')
  const [groupCreateDescription, setGroupCreateDescription] = useState('')
  const [selectedNewGroupMemberIds, setSelectedNewGroupMemberIds] = useState<number[]>([])
  const [directoryUsers, setDirectoryUsers] = useState<UserDirectoryUser[]>([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [userSearchError, setUserSearchError] = useState('')
  const [groupCreateError, setGroupCreateError] = useState('')
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [channelCreateName, setChannelCreateName] = useState('')
  const [channelCreateDescription, setChannelCreateDescription] = useState('')
  const [channelCreateUsername, setChannelCreateUsername] = useState('')
  const [channelCreateType, setChannelCreateType] = useState<'public' | 'private'>('public')
  const [channelCreateError, setChannelCreateError] = useState('')
  const [isCreatingChannel, setIsCreatingChannel] = useState(false)
  const [channelCreationStep, setChannelCreationStep] = useState<1 | 2>(1)
  const [createdChannelId, setCreatedChannelId] = useState<string | null>(null)
  const [myChannels, setMyChannels] = useState<ChannelView[]>([])
  const [globalChannelResults, setGlobalChannelResults] = useState<ChatListItem[]>([])
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false)
  const [activeGroupMembers, setActiveGroupMembers] = useState<ChatGroupMember[]>([])
  const [activeGroupDetails, setActiveGroupDetails] = useState<ChatGroupDetails | null>(null)
  const [channelDetails, setChannelDetails] = useState<ChannelView | null>(null)
  const [channelAdmins, setChannelAdmins] = useState<ChannelMember[]>([])
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([])
  const [isLoadingChannelDetails, setIsLoadingChannelDetails] = useState(false)
  const [isLoadingChannelAdmins, setIsLoadingChannelAdmins] = useState(false)
  const [isLoadingChannelMembers, setIsLoadingChannelMembers] = useState(false)
  const [channelMembersError, setChannelMembersError] = useState('')
  const [groupMembersError, setGroupMembersError] = useState('')
  const [groupMembersActionError, setGroupMembersActionError] = useState('')
  const [isGroupMembersUpdating, setIsGroupMembersUpdating] = useState(false)
  const [mentionCaretIndex, setMentionCaretIndex] = useState(0)
  const [selectedMessages, setSelectedMessages] = useState<SelectedMessageActionState>({ ids: [], anchorId: null })
  const [messageActionError, setMessageActionError] = useState('')
  const [isMessageActionLoading, setIsMessageActionLoading] = useState(false)
  const [messageViewers, setMessageViewers] = useState<MessageViewer[]>([])
  const [isViewersModalOpen, setIsViewersModalOpen] = useState(false)
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false)
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false)
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false)
  const [isUserProfileLoading, setIsUserProfileLoading] = useState(false)
  const [userProfileError, setUserProfileError] = useState('')
  const [profileUserId, setProfileUserId] = useState<number | null>(null)
  const [profileUser, setProfileUser] = useState<UserDirectoryUserDetails | null>(null)
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([])
  const [resolvedPinnedMessageViews, setResolvedPinnedMessageViews] = useState<Record<string, MessageView>>({})
  const [activePinnedIndex, setActivePinnedIndex] = useState(0)
  const [isPinnedMessagesPanelOpen, setIsPinnedMessagesPanelOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editTargetMessageId, setEditTargetMessageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteTargetMessageIds, setDeleteTargetMessageIds] = useState<string[] | null>(null)
  const [messageContextMenu, setMessageContextMenu] = useState<MessageContextMenuState | null>(null)
  const [chatListContextMenu, setChatListContextMenu] = useState<ChatListContextMenuState | null>(null)
  const [chatListActionError, setChatListActionError] = useState('')
  const [isChatDeleteConfirmOpen, setIsChatDeleteConfirmOpen] = useState(false)
  const [chatDeleteTargetId, setChatDeleteTargetId] = useState<string | null>(null)
  const [isChatListActionLoading, setIsChatListActionLoading] = useState(false)
  const [isGroupEditModalOpen, setIsGroupEditModalOpen] = useState(false)
  const [groupEditTargetId, setGroupEditTargetId] = useState<string | null>(null)
  const [groupEditName, setGroupEditName] = useState('')
  const [groupEditDescription, setGroupEditDescription] = useState('')
  const [groupEditError, setGroupEditError] = useState('')
  const [isGroupEditLoading, setIsGroupEditLoading] = useState(false)
  const [isGroupEditSaving, setIsGroupEditSaving] = useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [chatSearchResults, setChatSearchResults] = useState<ChatSearchResultItem[]>([])
  const [isChatSearchLoading, setIsChatSearchLoading] = useState(false)
  const [chatSearchError, setChatSearchError] = useState('')
  const [chatSearchInfo, setChatSearchInfo] = useState('')
  const [selectedChatSearchResultId, setSelectedChatSearchResultId] = useState<string | null>(null)
  const [highlightedSearchMessageId, setHighlightedSearchMessageId] = useState<string | null>(null)
  const [openedImageMessageId, setOpenedImageMessageId] = useState<string | null>(null)
  const [openedVideoMessageId, setOpenedVideoMessageId] = useState<string | null>(null)
  const [replyTarget, setReplyTarget] = useState<ReplyToView | null>(null)
  const [isChatQrAuthorized, setIsChatQrAuthorized] = useState(true)
  const [emptyChatStateMessage] = useState(() => pickRandomItem(EMPTY_CHAT_STATE_MESSAGES))
  const [socketReconnectNonce, setSocketReconnectNonce] = useState(0)

  useEffect(() => {
    if (chats.length === 0 && myChannels.length === 0) {
      return
    }
    const map: Record<string, boolean> = {}
    for (const item of chats) {
      map[normalizeConversationIdKey(item.chat.id)] = item.chat.isMuted
      if (item.chat.type === 'personal' && typeof item.chat.peerId === 'number') {
        map[`peer:${item.chat.peerId}`] = item.chat.isMuted
      }
    }
    for (const ch of myChannels) {
      map[normalizeConversationIdKey(ch.id)] = ch.isMuted
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ALEM_MESSENGER_MUTE_MAP_EVENT, { detail: map }))
    }
  }, [chats, myChannels])

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const messagesScrollerRef = useRef<HTMLDivElement | null>(null)
  const messageItemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const chatListResizeStartXRef = useRef(0)
  const chatListResizeStartWidthRef = useRef(DEFAULT_CHAT_LIST_PANEL_WIDTH)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const attachMenuRef = useRef<HTMLDivElement | null>(null)
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null)
  /** Зеркало текста поля ввода; DOM — источник правды при наборе, state `input` подтягивается через startTransition. */
  const messageDraftRef = useRef('')
  /** Увеличивается при смене чата, чтобы отбрасывать отложенные startTransition от предыдущего диалога. */
  const composerSyncEpochRef = useRef(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoMessageRecorderRef = useRef<MediaRecorder | null>(null)
  const videoMessageStreamRef = useRef<MediaStream | null>(null)
  const videoMessageChunksRef = useRef<Blob[]>([])
  const videoMessageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatsRef = useRef<ChatListItem[]>([])
  const chatsHydratedRef = useRef(false)
  const previousActiveChatRef = useRef<ChatListItem | null>(null)
  const activeChatRef = useRef<string | null>(null)
  const currentUserRef = useRef<CurrentUserState | null>(null)
  const cryptoRef = useRef<CryptoState>({ currentDeviceId: null, privateKey: null })
  const hasAutoPromptedE2eeRestoreRef = useRef(false)
  const loadPinnedMessagesRef = useRef<((chatId: string, chatType: ChatType) => Promise<void>) | null>(null)
  const loadMessagesRef = useRef<((chatId: string, chatType: ChatType) => Promise<void>) | null>(null)
  const messagesRef = useRef<MessageView[]>([])
  const onlineUserIdsRef = useRef<Set<number>>(new Set<number>())
  const historyOffsetRef = useRef(0)
  const hasMoreHistoryRef = useRef(false)
  const isLoadingOlderMessagesRef = useRef(false)
  const isAtBottomRef = useRef(true)
  const historyRequestIdRef = useRef(0)
  const pendingPrependScrollRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)
  const pendingReadSyncFrameRef = useRef<number | null>(null)
  const lastMarkedReadMessageIdByChatRef = useRef<Record<string, string>>({})
  const socketRef = useRef<WebSocket | null>(null)
  const socketReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const socketReconnectAttemptsRef = useRef(0)
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const outgoingTypingChatRef = useRef<string | null>(null)
  const outgoingTypingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleTypingStopRafRef = useRef<number | null>(null)
  const recordHoldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordHoldResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordHoldTriggeredRef = useRef(false)
  const recordGestureStartYRef = useRef<number | null>(null)
  const recordShouldContinueRef = useRef(false)
  const isRecordingLockedRef = useRef(false)
  const pendingMessagesScrollBehaviorRef = useRef<ScrollBehavior | null>('auto')
  const chatSearchRequestIdRef = useRef(0)
  const highlightedSearchMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastResolvedUsernameRef = useRef<string | null>(null)

  const activeChat = useMemo(() => {
    if (activeChatId === 'smart-agent') {
      return {
        chat: {
          id: 'smart-agent',
          type: 'personal' as ChatType,
          peerId: SMART_ASSISTANT_PROFILE_ID,
          peerUsername: 'smart_agent',
          peerFullName: 'Smart Agent',
          peerAvatar: null,
          lastSeenAt: null,
          groupId: null,
          groupName: null,
          groupAvatar: null,
          channelId: null,
          channelName: null,
          channelAvatar: null,
          aiModel: 'gpt-4o',
          aiTitle: 'Smart Agent',
          lastMessage: null,
          unreadCount: 0,
          mentionCount: 0,
          isPinned: false,
          isMuted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        title: 'Smart Agent',
        subtitle: 'Офисный ассистент',
        time: '',
        avatar: 'SA',
        avatarUrl: null,
        seed: 777,
        online: true,
        unread: 0,
        isDraft: false,
      } as ChatListItem
    }
    const foundChat = chats.find((item) => item.chat.id === activeChatId)
    if (foundChat) return foundChat
    const foundChannel = myChannels.find((c) => c.id === activeChatId)
    if (foundChannel) return toChannelListItem(foundChannel)
    const foundGlobal = globalChannelResults.find((item) => item.chat.id === activeChatId)
    if (foundGlobal) return foundGlobal
    if (resolvedChannel && resolvedChannel.id === activeChatId) return toChannelListItem(resolvedChannel)
    return null
  }, [activeChatId, chats, myChannels, globalChannelResults, toChannelListItem, resolvedChannel])

  useEffect(() => {
    if (!activeChat || activeChat.chat.type !== 'personal' || activeChat.chat.peerId === SMART_ASSISTANT_PROFILE_ID) {
      setHasRemoteE2eeBackup(null)
      hasAutoPromptedE2eeRestoreRef.current = false
      return
    }
    if (cryptoState.privateKey) {
      setHasRemoteE2eeBackup(true)
      hasAutoPromptedE2eeRestoreRef.current = false
      return
    }

    let cancelled = false
    startTransition(() => {
      void authRepository
        .getE2eeBackup(sessionStore.getTokens()?.accessToken)
        .then((backup) => {
          if (!cancelled) {
            setHasRemoteE2eeBackup(Boolean(backup))
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHasRemoteE2eeBackup(false)
          }
        })
    })

    return () => {
      cancelled = true
    }
  }, [activeChat, authRepository, cryptoState.privateKey, sessionStore])

  useEffect(() => {
    if (
      activeChat?.chat.type === 'personal' &&
      activeChat.chat.peerId !== SMART_ASSISTANT_PROFILE_ID &&
      !cryptoState.privateKey &&
      hasRemoteE2eeBackup &&
      !isE2eeRestoreModalOpen &&
      !hasAutoPromptedE2eeRestoreRef.current
    ) {
      hasAutoPromptedE2eeRestoreRef.current = true
      setE2eeRestoreError('')
      setIsE2eeRestoreModalOpen(true)
    }
  }, [activeChat, cryptoState.privateKey, hasRemoteE2eeBackup, isE2eeRestoreModalOpen])

  const canManageChannelPosts = useMemo(() => {
    if (!activeChat || activeChat.chat.type !== 'channel') {
      return true
    }
    const role = channelDetails?.myRole
    return role === 'admin' || role === 'owner'
  }, [activeChat, channelDetails])


  const currentUserFirstName = useMemo(() => {
    const source = currentUser?.name?.trim()
    if (!source) {
      return ''
    }

    return source.split(/\s+/)[0] ?? ''
  }, [currentUser?.name])

  const emptyChatStateMessageText = useMemo(() => {
    if (!currentUserFirstName) {
      return emptyChatStateMessage.replace(/,?\s*\{name\}/g, '').replace(/\{name\}/g, '').replace(/\s{2,}/g, ' ').trim()
    }

    return emptyChatStateMessage.replace(/\{name\}/g, currentUserFirstName)
  }, [currentUserFirstName, emptyChatStateMessage])

  const activeTyping = useMemo(() => {
    if (activeChatId === 'smart-agent' && isSmartAgentLoading) {
      return { senderId: -1, label: 'Smart Agent' }
    }
    return activeChatId ? typingByChat[activeChatId] ?? null : null
  }, [activeChatId, typingByChat, isSmartAgentLoading])
  const showChatListPane = !isMobileLayout || !activeChat
  const showChatPane = !isMobileLayout || Boolean(activeChat)
  const showFoldersRail = !isMobileLayout
  const activePinnedMessage = useMemo(
    () => (pinnedMessages.length > 0 ? pinnedMessages[Math.min(activePinnedIndex, pinnedMessages.length - 1)] : null),
    [activePinnedIndex, pinnedMessages],
  )
  const chatListContextMenuTarget = useMemo(
    () => (chatListContextMenu ? chats.find((item) => item.chat.id === chatListContextMenu.chatId) ?? null : null),
    [chatListContextMenu, chats],
  )
  const chatDeleteTarget = useMemo(
    () => (chatDeleteTargetId ? chats.find((item) => item.chat.id === chatDeleteTargetId) ?? null : null),
    [chatDeleteTargetId, chats],
  )
  const activePeerId = useMemo(
    () => (activeChat?.chat.type === 'personal' ? activeChat.chat.peerId ?? null : null),
    [activeChat],
  )

  const applyMutedToChatId = useCallback((chatId: string, isMuted: boolean) => {
    setChats((prev) =>
      prev.map((item) => (item.chat.id === chatId ? { ...item, chat: { ...item.chat, isMuted } } : item)),
    )
    setMyChannels((prev) => prev.map((c) => (c.id === chatId ? { ...c, isMuted } : c)))
    setGlobalChannelResults((prev) =>
      prev.map((item) => (item.chat.id === chatId ? { ...item, chat: { ...item.chat, isMuted } } : item)),
    )
    setResolvedChannel((prev) => (prev && prev.id === chatId ? { ...prev, isMuted } : prev))
    setChannelDetails((prev) => (prev && prev.id === chatId ? { ...prev, isMuted } : prev))
  }, [])

  const toggleActiveChatMute = useCallback(async () => {
    if (!activeChat || activeChat.isDraft || activeChat.chat.type === 'support') {
      return
    }
    const { id, type } = activeChat.chat
    const nextMute = !activeChat.chat.isMuted
    setMuteToggleBusy(true)
    try {
      let resolved = nextMute
      if (type === 'personal') {
        resolved = await chatRepository.setConversationMute(id, nextMute)
      } else if (type === 'group') {
        resolved = await chatRepository.setGroupMute(id, nextMute)
      } else if (type === 'channel') {
        resolved = await channelRepository.setMute(id, nextMute)
      } else {
        return
      }
      applyMutedToChatId(id, resolved)
    } catch (err) {
      setSendError(getErrorMessage(err, 'Не удалось изменить уведомления'))
    } finally {
      setMuteToggleBusy(false)
    }
  }, [activeChat, applyMutedToChatId, chatRepository, channelRepository])

  const toggleMuteForPersonalPeerChat = useCallback(
    async (peerId: number) => {
      const item = chats.find((c) => c.chat.type === 'personal' && c.chat.peerId === peerId)
      if (!item) return
      const next = !item.chat.isMuted
      setMuteToggleBusy(true)
      try {
        const resolved = await chatRepository.setConversationMute(item.chat.id, next)
        applyMutedToChatId(item.chat.id, resolved)
      } catch (err) {
        setSendError(getErrorMessage(err, 'Не удалось изменить уведомления'))
      } finally {
        setMuteToggleBusy(false)
      }
    },
    [chats, chatRepository, applyMutedToChatId],
  )

  const profilePersonalMuteControls = useMemo(() => {
    if (profileUserId === null || isVirtualProfileId(profileUserId)) return null
    const item = chats.find((c) => c.chat.type === 'personal' && c.chat.peerId === profileUserId)
    if (!item) return null
    return {
      isMuted: item.chat.isMuted,
      busy: muteToggleBusy,
      onToggle: () => void toggleMuteForPersonalPeerChat(profileUserId),
    }
  }, [profileUserId, chats, muteToggleBusy, toggleMuteForPersonalPeerChat])

  const canSearchInActiveChat = Boolean(activeChat && !activeChat.isDraft)
  const canStartCallInActiveChat = Boolean(
    activeChat &&
      activeChat.chat.id !== 'smart-agent' &&
      (activeChat.chat.type === 'group' || (activePeerId !== null && activePeerId > 0)),
  )
  const isSmartAgentChat = activeChatId === 'smart-agent'
  const hasDraftMessage = input.trim().length > 0 || attachmentToUpload !== null
  const isRecordingAnyMedia = isRecordingVoice || isRecordingVideoMessage
  const isRecordingUiActive = isRecordingAnyMedia || isRecordingLocked
  const profileUserPresence = useMemo(
    () => (profileUserId !== null && profileUserId > 0 ? onlineUserIds.has(profileUserId) : false),
    [onlineUserIds, profileUserId],
  )

  useEffect(() => {
    if (!isSmartAgentChat) {
      return
    }

    setIsDrivePickerOpen(false)
    setAttachmentToUpload(null)
    setAttachmentPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [isSmartAgentChat])

  const totalUnreadCount = useMemo(
    () => chats.reduce((sum, item) => sum + Math.max(item.chat.unreadCount ?? item.unread ?? 0, 0), 0),
    [chats],
  )
  const chatSearchResultCount = useMemo(() => chatSearchResults.length, [chatSearchResults])
  const loadedMessageIds = useMemo(() => new Set(messages.map((message) => message.raw.id)), [messages])
  const activeThemeConfig = useMemo(
    () => normalizeThemeConfig(isThemePanelOpen ? chatThemeDraft : toChatThemeDraft(chatTheme)),
    [chatTheme, chatThemeDraft, isThemePanelOpen],
  )
  const hasSavedChatTheme = Boolean(chatTheme)
  const messageBubbleTheme = useMemo(
    () => ({ outgoingColorHex: activeThemeConfig.messageColorHex }),
    [activeThemeConfig.messageColorHex],
  )
  const handleStartActiveChatCall = useCallback(async () => {
    if (!activeChat) {
      return
    }

    try {
      setError('')

      if (activeChat.chat.type === 'group') {
        await startGroupCall({
          groupId: activeChat.chat.id,
          displayName: activeChat.title,
        })

        // send system message for group call
        try {
          await chatRepository.sendMessage({
            chatId: activeChat.chat.id,
            chatType: 'group',
            content: 'Видеозвонок',
            type: 'text',
            metadata: JSON.stringify({
              type: 'video_call',
              status: 'initiated',
              direction: 'outgoing',
              call_start_at: new Date().toISOString()
            })
          })
        } catch (msgError) {
          console.warn('Failed to send call message', msgError)
        }
        return
      }

      if (activePeerId === null) {
        throw new Error('Не удалось определить собеседника для звонка.')
      }

      await startDirectCall({
        calleeId: activePeerId,
        chatId: activeChat.isDraft ? undefined : activeChat.chat.id,
        displayName: activeChat.title,
      })

      // send system message for direct call
      if (!activeChat.isDraft) {
        try {
          await chatRepository.sendMessage({
            chatId: activeChat.chat.id,
            chatType: 'personal',
            content: 'Видеозвонок',
            type: 'text',
            metadata: JSON.stringify({
              type: 'video_call',
              status: 'initiated',
              direction: 'outgoing',
              call_start_at: new Date().toISOString()
            })
          })
        } catch (msgError) {
          console.warn('Failed to send call message', msgError)
        }
      }
    } catch (error) {
      setError(getErrorMessage(error, 'Не удалось начать звонок.'))
    }
  }, [activeChat, activePeerId, startDirectCall, startGroupCall, chatRepository])

  const startCallWithUser = useCallback(async (userId: number, fullName: string) => {
    try {
      setError('')
      await startDirectCall({
        calleeId: userId,
        displayName: fullName,
      })
    } catch (error) {
      setError(getErrorMessage(error, 'Не удалось начать звонок.'))
    }
  }, [startDirectCall])

  const themedChatSurfaceBackground = activeThemeConfig.backgroundType === 'default' ? C.surface : 'rgba(255,255,255,0.84)'
  const themedChatSurfaceBorder = activeThemeConfig.backgroundType === 'default' ? C.border : '#D7E3F4'
  const themedChatCanvasStyle = useMemo<CSSProperties>(() => {
    if (activeThemeConfig.backgroundType === 'image' && activeThemeConfig.backgroundImageUrl) {
      return {
        backgroundColor: '#EEF4FB',
        backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.56) 0%, rgba(255,255,255,0.8) 100%), url(${activeThemeConfig.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    }

    if (activeThemeConfig.backgroundType === 'color') {
      const color = activeThemeConfig.backgroundColorHex ?? DEFAULT_CHAT_THEME_CONFIG.backgroundColorHex ?? '#F3F7FD'
      return {
        backgroundColor: color,
        backgroundImage: `linear-gradient(180deg, ${color} 0%, #FFFFFF 180%)`,
      }
    }

    return {
      backgroundColor: '#F4F8FD',
      backgroundImage: 'linear-gradient(180deg, #F8FBFF 0%, #EEF3FA 100%)',
    }
  }, [activeThemeConfig.backgroundColorHex, activeThemeConfig.backgroundImageUrl, activeThemeConfig.backgroundType])
  const folderUnreadCountById = useMemo(() => {
    const unreadByChatId = new Map(
      chats.map((item) => [item.chat.id, Math.max(item.chat.unreadCount ?? item.unread ?? 0, 0)] as const),
    )

    return Object.fromEntries(
      Object.entries(folderChatAssignments).map(([folderId, chatIds]) => [
        folderId,
        chatIds.reduce((sum, chatId) => sum + (unreadByChatId.get(chatId) ?? 0), 0),
      ]),
    ) as Record<string, number>
  }, [chats, folderChatAssignments])
  const chatListContextMenuFolderId = useMemo(() => {
    if (!chatListContextMenuTarget) {
      return null
    }

    for (const [folderId, chatIds] of Object.entries(folderChatAssignments)) {
      if (chatIds.includes(chatListContextMenuTarget.chat.id)) {
        return folderId
      }
    }

    return null
  }, [chatListContextMenuTarget, folderChatAssignments])
  const activeMentionContext = useMemo(() => {
    if (activeChat?.chat.type !== 'group' || isRecordingUiActive) {
      return null
    }

    if (!input.includes('@')) {
      return null
    }

    return getMentionContext(input, mentionCaretIndex)
  }, [activeChat?.chat.type, input, isRecordingUiActive, mentionCaretIndex])
  const mentionSuggestions = useMemo(() => {
    if (!activeMentionContext) {
      return []
    }

    const query = activeMentionContext.query.trim().toLowerCase()
    const filtered = activeGroupMembers.filter((member) => {
      const username = member.username.toLowerCase()
      const fullName = member.fullName.toLowerCase()
      const email = member.email.toLowerCase()
      return !query || username.includes(query) || fullName.includes(query) || email.includes(query)
    })

    return filtered.slice(0, 6)
  }, [activeGroupMembers, activeMentionContext])
  const selectedMessageSet = useMemo(() => new Set(selectedMessages.ids), [selectedMessages.ids])
  const selectedMessageViews = useMemo(
    () => messages.filter((message) => selectedMessageSet.has(message.raw.id)),
    [messages, selectedMessageSet],
  )
  const selectedMessage = useMemo(
    () => selectedMessageViews.find((message) => message.raw.id === selectedMessages.anchorId) ?? selectedMessageViews[0] ?? null,
    [selectedMessageViews, selectedMessages.anchorId],
  )
  const editTargetMessage = useMemo(
    () => (editTargetMessageId ? messages.find((message) => message.raw.id === editTargetMessageId) ?? null : selectedMessage),
    [editTargetMessageId, messages, selectedMessage],
  )
  const pinnedMessageIds = useMemo(() => new Set(pinnedMessages.map((message) => message.messageId)), [pinnedMessages])
  const activePinnedMessageView = useMemo(
    () =>
      activePinnedMessage
        ? messages.find((message) => message.raw.id === activePinnedMessage.messageId) ??
          resolvedPinnedMessageViews[activePinnedMessage.messageId] ??
          null
        : null,
    [activePinnedMessage, messages, resolvedPinnedMessageViews],
  )
  const activeChatUnavailableSummary = useMemo(() => {
    const unavailableMessages = messages.filter((message) => message.unavailable)
    if (unavailableMessages.length === 0) {
      return null
    }

    const identityMismatchCount = unavailableMessages.filter((message) => message.unavailableKind === 'identity-mismatch').length
    const missingKeysCount = unavailableMessages.filter((message) => message.unavailableKind === 'missing-encrypted-keys').length

    if (identityMismatchCount > 0) {
      return {
        kind: 'identity-mismatch' as const,
        tone: {
          background: '#FFF7ED',
          border: '#FED7AA',
          text: '#9A3412',
        },
        title: 'Часть защищенной истории недоступна',
        description:
          'Эти сообщения были зашифрованы до синхронизации текущего ключа устройства. Для старой истории используйте доверенное устройство или QR-синхронизацию.',
      }
    }

    if (missingKeysCount > 0) {
      return {
        kind: 'missing-encrypted-keys' as const,
        tone: {
          background: '#FFF7ED',
          border: '#FED7AA',
          text: '#9A3412',
        },
        title: 'Часть защищенных сообщений недоступна',
        description: 'Для этих сообщений на устройстве нет подходящего ключа шифрования. Историю нужно повторно синхронизировать.',
      }
    }

    return {
      kind: 'decrypt-failed' as const,
      tone: {
        background: '#FEFCE8',
        border: '#FDE68A',
        text: '#854D0E',
      },
      title: 'Есть сообщения, которые не удалось открыть',
      description: 'Новые сообщения будут отображаться нормально, но часть старой истории на этом устройстве недоступна.',
      action: hasRemoteE2eeBackup
        ? {
            label: 'Введите пароль',
            onClick: () => setIsE2eeRestoreModalOpen(true),
          }
        : undefined,
    }
  }, [hasRemoteE2eeBackup, messages])
  const imageMessages = useMemo(() => {
    const list: MessageView[] = []
    messages.forEach((message) => {
      const metadata = parseJsonRecord(message.raw.metadata)
      if (metadata && Array.isArray(metadata.gallery) && metadata.gallery.length > 0) {
        metadata.gallery.forEach((file: any, index: number) => {
          list.push({
            ...message,
            raw: {
              ...message.raw,
              id: `${message.raw.id}_album_${index}`,
            },
            mediaUrl: file.url,
          })
        })
      } else if (message.kind === 'image' && Boolean(message.mediaUrl)) {
        list.push(message)
      }
    })
    return list
  }, [messages])
  const openedImageIndex = useMemo(
    () => (openedImageMessageId ? imageMessages.findIndex((message) => message.raw.id === openedImageMessageId) : -1),
    [imageMessages, openedImageMessageId],
  )
  const openedImageMessage = openedImageIndex >= 0 ? imageMessages[openedImageIndex] : null
  const openedVideoMessage = useMemo(
    () => (openedVideoMessageId ? messages.find((message) => message.raw.id === openedVideoMessageId && Boolean(message.videoUrl)) ?? null : null),
    [messages, openedVideoMessageId],
  )
  const contextMenuMessage = useMemo(
    () => (messageContextMenu ? messages.find((message) => message.raw.id === messageContextMenu.messageId) ?? null : null),
    [messageContextMenu, messages],
  )
  const openThemePanel = useCallback(() => {
    setChatThemeDraft(toChatThemeDraft(chatTheme))
    setChatThemeError('')
    setIsThemePanelOpen(true)
  }, [chatTheme])
  const closeThemePanel = useCallback(() => {
    setChatThemeDraft(toChatThemeDraft(chatTheme))
    setChatThemeError('')
    setIsThemePanelOpen(false)
  }, [chatTheme])
  const handleThemeDraftChange = useCallback((patch: Partial<ChatThemeConfigInput>) => {
    setChatThemeDraft((prev) => ({ ...prev, ...patch }))
  }, [])
  const handleThemeImageUpload = useCallback(async (file: File) => {
    const extension = getAttachmentExtension(file.name)
    const isImageFile = file.type.startsWith('image/') || IMAGE_ATTACHMENT_EXTENSIONS.has(extension)

    if (!isImageFile) {
      setChatThemeError('Для фона чата можно загрузить только изображение.')
      return
    }

    if (file.size > IMAGE_ATTACHMENT_LIMIT_BYTES) {
      setChatThemeError(`Изображение превышает лимит ${formatAttachmentLimit(IMAGE_ATTACHMENT_LIMIT_BYTES)}.`)
      return
    }

    setIsThemeImageUploading(true)
    setChatThemeError('')

    try {
      const uploaded = await chatRepository.uploadFile(file, 'image')
      setChatThemeDraft((prev) => ({
        ...prev,
        backgroundType: 'image',
        backgroundImageUrl: uploaded.url,
      }))
    } catch (uploadError) {
      setChatThemeError(getErrorMessage(uploadError, 'Не удалось загрузить изображение для фона чата.'))
    } finally {
      setIsThemeImageUploading(false)
    }
  }, [chatRepository])
  const handleSaveTheme = useCallback(async () => {
    setIsThemeSaving(true)
    setChatThemeError('')
    const requestVersion = ++chatThemeRequestVersionRef.current

    try {
      const savedTheme = await chatThemeRepository.setTheme(normalizeThemeConfig(chatThemeDraft))
      if (chatThemeRequestVersionRef.current !== requestVersion) {
        return
      }
      setChatTheme(savedTheme)
      setChatThemeDraft(toChatThemeDraft(savedTheme))
      setIsThemePanelOpen(false)
    } catch (saveError) {
      if (chatThemeRequestVersionRef.current !== requestVersion) {
        return
      }
      setChatThemeError(getErrorMessage(saveError, 'Не удалось сохранить оформление чатов.'))
    } finally {
      if (chatThemeRequestVersionRef.current === requestVersion) {
        setIsThemeSaving(false)
      }
    }
  }, [chatThemeDraft, chatThemeRepository])
  const handleResetTheme = useCallback(async () => {
    setIsThemeResetting(true)
    setChatThemeError('')
    const requestVersion = ++chatThemeRequestVersionRef.current

    try {
      await chatThemeRepository.deleteTheme()
      if (chatThemeRequestVersionRef.current !== requestVersion) {
        return
      }
      setChatTheme(null)
      setChatThemeDraft(DEFAULT_CHAT_THEME_CONFIG)
      setIsThemePanelOpen(false)
    } catch (resetError) {
      if (chatThemeRequestVersionRef.current !== requestVersion) {
        return
      }
      setChatThemeError(getErrorMessage(resetError, 'Не удалось сбросить оформление чатов.'))
    } finally {
      if (chatThemeRequestVersionRef.current === requestVersion) {
        setIsThemeResetting(false)
      }
    }
  }, [chatThemeRepository])

  useEffect(() => {
    if (typeof window === 'undefined' || isLoadingChats || error) {
      return
    }

    window.dispatchEvent(new CustomEvent<number>(MESSENGER_UNREAD_COUNT_EVENT, { detail: totalUnreadCount }))
  }, [error, isLoadingChats, totalUnreadCount])
  useEffect(() => {
    let cancelled = false
    const requestVersion = ++chatThemeRequestVersionRef.current

    const loadTheme = async () => {
      try {
        const savedTheme = await chatThemeRepository.getTheme()
        if (cancelled || chatThemeRequestVersionRef.current !== requestVersion) {
          return
        }

        setChatTheme(savedTheme)
        setChatThemeDraft(toChatThemeDraft(savedTheme))
      } catch (themeError) {
        if (!cancelled && chatThemeRequestVersionRef.current === requestVersion) {
          setChatTheme(null)
          setChatThemeDraft(DEFAULT_CHAT_THEME_CONFIG)
          setChatThemeError(getErrorMessage(themeError, 'Не удалось загрузить оформление чатов.'))
        }
      }
    }

    void loadTheme()

    return () => {
      cancelled = true
    }
  }, [chatThemeRepository])
  const filteredChats = useMemo(() => {
    const filtered = chats.filter((item) => {
      if (selectedFolderId) {
        const assignedChatIds = new Set(folderChatAssignments[selectedFolderId] ?? [])
        if (!assignedChatIds.has(item.chat.id)) {
          return false
        }
      } else {
        if (filter === 'groups' && item.chat.type !== 'group') {
          return false
        }

        if (filter === 'personal' && item.chat.type !== 'personal') {
          return false
        }

        if (filter === 'channels') {
          return false
        }
      }

      if (!search.trim()) {
        return true
      }

      const query = search.toLowerCase()
      return item.title.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query)
    })

    return filtered.sort((left, right) => {
      // Support chats always go to the absolute top
      const leftIsSupport = left.chat.type === 'support'
      const rightIsSupport = right.chat.type === 'support'
      if (leftIsSupport !== rightIsSupport) {
        return leftIsSupport ? -1 : 1
      }

      if (left.chat.isPinned !== right.chat.isPinned) {
        return left.chat.isPinned ? -1 : 1
      }

      const leftTime = left.chat.lastMessage?.createdAt
        ? new Date(left.chat.lastMessage.createdAt).getTime()
        : new Date(left.chat.updatedAt || left.chat.createdAt).getTime()

      const rightTime = right.chat.lastMessage?.createdAt
        ? new Date(right.chat.lastMessage.createdAt).getTime()
        : new Date(right.chat.updatedAt || right.chat.createdAt).getTime()

      return rightTime - leftTime
    })
  }, [chats, filter, folderChatAssignments, search, selectedFolderId])

  const filteredChannels = useMemo(() => {
    if (selectedFolderId) return []
    if (filter !== 'channels' && filter !== 'all') return []

    const mapped = myChannels.map(toChannelListItem)
    if (!search.trim()) {
      return mapped
    }

    const query = search.toLowerCase()
    return mapped.filter((item) => item.title.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query))
  }, [filter, myChannels, search, selectedFolderId, toChannelListItem])

  const allDisplayItems = useMemo(() => {
    if (filter === 'channels') {
      return [...filteredChannels, ...globalChannelResults]
    }
    if (search.trim().length >= 2 && filter === 'all') {
      // Deduplicate global results if they are already in filteredChannels
      const localIds = new Set(filteredChannels.map(c => c.chat.id))
      const uniqueGlobal = globalChannelResults.filter(g => !localIds.has(g.chat.id))
      return [...filteredChats, ...uniqueGlobal]
    }
    return filteredChats
  }, [filter, filteredChannels, filteredChats, globalChannelResults, search])


  const resetChatSearchState = useCallback(() => {
    chatSearchRequestIdRef.current += 1
    setChatSearchQuery('')
    setChatSearchResults([])
    setIsChatSearchLoading(false)
    setChatSearchError('')
    setChatSearchInfo('')
    setSelectedChatSearchResultId(null)
    setHighlightedSearchMessageId(null)
    if (highlightedSearchMessageTimeoutRef.current) {
      clearTimeout(highlightedSearchMessageTimeoutRef.current)
      highlightedSearchMessageTimeoutRef.current = null
    }
  }, [])

  const closeChatSearch = useCallback(() => {
    setIsChatSearchOpen(false)
    resetChatSearchState()
  }, [resetChatSearchState])

  const buildChatSearchResultItem = useCallback(
    async (message: ChatMessage): Promise<ChatSearchResultItem> => {
      const current = currentUserRef.current
      const view = await toMessageView(message, current?.id ?? 0, cryptoRef.current)
      const highlightedSnippet =
        typeof message.metadata === 'string' && message.metadata.includes('<mark>') ? message.metadata : null

      return {
        raw: message,
        view,
        senderLabel: message.senderFullName || message.senderUsername || 'Пользователь',
        snippetText: view.text,
        highlightedSnippet,
        timeLabel: formatTimeLabel(message.createdAt),
        typeLabel: getChatSearchTypeLabel(view.kind),
      }
    },
    [],
  )

  useEffect(() => {
    setActivePinnedIndex(0)
  }, [activeChatId])

  useEffect(() => {
    setIsPinnedMessagesPanelOpen(false)
  }, [activeChatId])

  useEffect(() => {
    setResolvedPinnedMessageViews({})
  }, [activeChatId])

  useEffect(() => {
    if (!activeChat) {
      setShowInfo(false)
    }
  }, [activeChat])

  useEffect(() => {
    if (!activeChat || pinnedMessages.length === 0 || !currentUserRef.current) {
      return
    }

    const loadedById = new Map(messages.map((message) => [message.raw.id, message] as const))
    const missingPinned = pinnedMessages.filter(
      (pinned) => !loadedById.has(pinned.messageId) && !resolvedPinnedMessageViews[pinned.messageId],
    )

    if (missingPinned.length === 0) {
      const hydratedFromLoaded = pinnedMessages.reduce<Record<string, MessageView>>((acc, pinned) => {
        const view = loadedById.get(pinned.messageId)
        if (view) {
          acc[pinned.messageId] = view
        }
        return acc
      }, {})

      if (Object.keys(hydratedFromLoaded).length > 0) {
        setResolvedPinnedMessageViews((prev) => {
          let changed = false
          const next = { ...prev }
          for (const [messageId, view] of Object.entries(hydratedFromLoaded)) {
            if (next[messageId] !== view) {
              next[messageId] = view
              changed = true
            }
          }
          return changed ? next : prev
        })
      }
      return
    }

    let isCancelled = false

    const toPinnedFallbackMessage = (pinned: PinnedMessage): ChatMessage => ({
      id: pinned.messageId,
      conversationId: pinned.chatId,
      senderId: pinned.pinnedBy,
      replyToId: null,
      replyTo: null,
      content: pinned.content,
      contentHash: '',
      encryptedKeys: {},
      type: pinned.type,
      attachmentUrl: null,
      attachmentType: null,
      attachmentSize: null,
      metadata: null,
      isEdited: false,
      isForwarded: false,
      originalSenderId: null,
      isDeleted: false,
      createdAt: pinned.createdAt,
      updatedAt: pinned.createdAt,
      editedAt: null,
      isEphemeral: false,
      ttlSeconds: null,
      expiresAt: null,
      senderUsername: '',
      senderFullName: '',
      senderAvatar: null,
      originalSenderFullName: null,
      readByCount: 0,
      deliveredCount: 0,
      isRead: true,
      reactions: [],
    })

    const toPinnedChannelMessage = (post: ChannelPostView): ChatMessage => ({
      id: post.id,
      conversationId: post.channelId,
      senderId: post.authorId,
      replyToId: null,
      replyTo: null,
      content: post.content || '',
      contentHash: '',
      encryptedKeys: {},
      type: resolveMessageTypeFromAttachment(post.attachmentType),
      attachmentUrl: post.attachmentUrl,
      attachmentType: post.attachmentType,
      attachmentSize: post.attachmentSize,
      metadata: post.metadata,
      isEdited: false,
      isForwarded: false,
      originalSenderId: null,
      isDeleted: false,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      editedAt: null,
      isEphemeral: false,
      ttlSeconds: null,
      expiresAt: null,
      senderUsername: '',
      senderFullName: post.authorName,
      senderAvatar: post.authorAvatar,
      originalSenderFullName: null,
      readByCount: 0,
      deliveredCount: 0,
      isRead: post.isViewed,
      reactions: (post.reactions || []).map((r) => ({
        reaction: r.reaction,
        count: r.count,
        reacted: r.reacted,
        users: (r.users || []).map((u) => ({
          id: u.id,
          fullName: u.fullName,
          avatar: u.avatar,
        })),
      })),
    })

    const hydratePinnedViews = async () => {
      const currentUserId = currentUserRef.current?.id ?? 0
      const pendingIds = new Set(missingPinned.map((pinned) => pinned.messageId))
      const resolvedBatch: Record<string, MessageView> = {}

      const resolveRawMessage = async (raw: ChatMessage) => {
        if (!pendingIds.has(raw.id)) {
          return
        }
        const view = await toMessageView(raw, currentUserId, cryptoRef.current)
        resolvedBatch[raw.id] = view
        pendingIds.delete(raw.id)
      }

      try {
        const maxPages = 8
        let offset = 0

        for (let pageIndex = 0; pageIndex < maxPages && pendingIds.size > 0; pageIndex += 1) {
          if (activeChat.chat.type === 'channel') {
            const posts = await channelRepository.getPosts(activeChat.chat.id, { limit: CHAT_HISTORY_PAGE_SIZE, offset })
            for (const post of posts) {
              await resolveRawMessage(toPinnedChannelMessage(post))
            }
            if (posts.length < CHAT_HISTORY_PAGE_SIZE) {
              break
            }
            offset += posts.length
            continue
          }

          const page =
            activeChat.chat.type === 'group'
              ? await chatRepository.getGroupMessages(activeChat.chat.id, { limit: CHAT_HISTORY_PAGE_SIZE, offset })
              : await chatRepository.getConversationMessages(activeChat.chat.id, { limit: CHAT_HISTORY_PAGE_SIZE, offset })

          for (const raw of page.messages) {
            await resolveRawMessage(raw)
          }

          if (page.count < CHAT_HISTORY_PAGE_SIZE) {
            break
          }
          offset += page.count
        }
      } catch {
        // fallback below
      }

      for (const pinned of missingPinned) {
        if (resolvedBatch[pinned.messageId]) {
          continue
        }
        resolvedBatch[pinned.messageId] = await toMessageView(toPinnedFallbackMessage(pinned), currentUserId, cryptoRef.current)
      }

      if (!isCancelled && Object.keys(resolvedBatch).length > 0) {
        setResolvedPinnedMessageViews((prev) => {
          let changed = false
          const next = { ...prev }
          for (const [messageId, view] of Object.entries(resolvedBatch)) {
            if (next[messageId] !== view) {
              next[messageId] = view
              changed = true
            }
          }
          return changed ? next : prev
        })
      }
    }

    void hydratePinnedViews()

    return () => {
      isCancelled = true
    }
  }, [activeChat, channelRepository, chatRepository, messages, pinnedMessages, resolvedPinnedMessageViews])

  useEffect(() => {
    setIsChatSearchOpen(false)
    setReplyTarget(null)
    resetChatSearchState()
  }, [activeChatId, resetChatSearchState])

  useEffect(() => {
    const query = search.trim().toLowerCase()
    if (query.length < 2) {
      setGlobalChannelResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingGlobal(true)
      try {
        const results = await channelRepository.searchChannels(query)
        const mapped = results.map((r) => ({ ...toChannelListItem(r), isGlobal: true }))
        setGlobalChannelResults(mapped)
      } catch (err) {
        console.error('Global channel search failed', err)
      } finally {
        setIsSearchingGlobal(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [search, channelRepository, toChannelListItem])

  useEffect(() => {
    setActivePinnedIndex((prev) => {
      if (pinnedMessages.length === 0) {
        return 0
      }

      return Math.min(prev, pinnedMessages.length - 1)
    })
  }, [pinnedMessages])

  const filteredDirectoryUsers = useMemo(() => {
    const availableUsers = directoryUsers.filter((user) => !currentUser || user.id !== currentUser.id)
    const query = userSearchQuery.trim().toLowerCase()

    const filtered = !query
      ? availableUsers
      : availableUsers.filter((user) => {
          const haystack = [user.fullName, user.username, user.email]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          return haystack.includes(query)
        })

    return filtered.sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1
      }

      return left.fullName.localeCompare(right.fullName, 'ru', { sensitivity: 'base' })
    })
  }, [currentUser, directoryUsers, userSearchQuery])

  useEffect(() => {
    setFolderChatAssignments(readFolderChatAssignments())
  }, [])



  useEffect(() => {
    if (selectedFolderId && !folders.some((folder) => folder.id === selectedFolderId)) {
      setSelectedFolderId(null)
    }
  }, [folders, selectedFolderId])

  const loadChats = useCallback(async (options?: { silent?: boolean }) => {
    const activeDeviceId = webDeviceStore.getOrCreateCurrentDeviceId()
    console.log('[Messenger DEBUG] Current Device ID:', activeDeviceId)

    const silent = options?.silent ?? chatsHydratedRef.current
    setIsChatQrAuthorized(true)
    if (!silent) {
      setIsLoadingChats(true)
    }
    setError('')

    try {
      const me = await authRepository.me(sessionStore.getTokens()?.accessToken)
      const storageKey = IndexedDbKeyStore.buildScopedStorageKey(me.id, activeDeviceId)
      const privateKey = await keyStore.getPrivateKey(storageKey)
      const nextCryptoState = { currentDeviceId: activeDeviceId, privateKey }
      setCryptoState(nextCryptoState)
      cryptoRef.current = nextCryptoState

      const [nextChats, nextFolders, pinnedChats] = await Promise.all([
        chatRepository.getUnifiedChats(),
        chatRepository.getFolders(),
        chatRepository.getPinnedChats(),
      ])
      const pinnedChatIds = new Set(pinnedChats.map((item) => item.chatId))

      setCurrentUser({
        id: me.id,
        name: me.fullName || me.username || me.email || 'User',
      })
      setFolders(nextFolders)

      // Sync folderChatAssignments from backend nextFolders
      const initialAssignments = { ...readFolderChatAssignments() }
      for (const folder of nextFolders) {
        if (folder.chatIds) {
          initialAssignments[folder.id] = folder.chatIds
        }
      }
      persistFolderAssignments(initialAssignments)

      const normalizedChats = nextChats.map((chat) => {
        if (chat.type !== 'channel') {
          return {
            ...chat,
            isPinned: pinnedChatIds.has(chat.id) || chat.isPinned,
          }
        }

        const lastViewedAt = channelViewedAtMapRef.current[chat.id]
        const lastActivityAt = chat.lastMessage?.createdAt ?? chat.updatedAt
        const shouldClearStaleUnread =
          Boolean(lastViewedAt) &&
          Boolean(lastActivityAt) &&
          new Date(lastViewedAt as string).getTime() >= new Date(lastActivityAt).getTime()

        return {
          ...chat,
          unreadCount: shouldClearStaleUnread ? 0 : chat.unreadCount,
          mentionCount: shouldClearStaleUnread ? 0 : chat.mentionCount,
          isPinned: pinnedChatIds.has(chat.id) || chat.isPinned,
        }
      })

      const mapped = await Promise.all(normalizedChats.map((chat) => toChatListItem(chat, onlineUserIdsRef.current)))
      setChats(mapped)
      setActiveChatId((prev) => {
        if (!prev) {
          return null
        }

        return mapped.some((item) => item.chat.id === prev) ? prev : null
      })
    } catch (loadError) {
      if (
        typeof loadError === 'object' &&
        loadError !== null &&
        'status' in loadError &&
        (loadError as { status?: unknown }).status === 401
      ) {
        dispatchAuthSessionExpired({
          reason: 'unauthorized',
          message: 'Сессия текущего web-устройства истекла. Войдите снова.',
        })
      }
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить чаты')
    } finally {
      setIsLoadingChats(false)
      chatsHydratedRef.current = true
    }

    try {
      const channels = await channelRepository.getMyChannels()
      setMyChannels(channels)
    } catch (channelErr) {
      console.error('Failed to load channels', channelErr)
    }
  }, [authRepository, channelRepository, chatRepository, keyStore, sessionStore, toChatListItem, webDeviceStore])

  const refreshCryptoState = useCallback(async () => {
    let currentId: number
    let me: CurrentUser | null = null
    if (currentUser) {
      currentId = currentUser.id
    } else {
      me = await authRepository.me(sessionStore.getTokens()?.accessToken)
      currentId = me.id
    }
    const activeDeviceId = webDeviceStore.getOrCreateCurrentDeviceId()
    const storageKey = IndexedDbKeyStore.buildScopedStorageKey(currentId, activeDeviceId)
    const privateKey = await keyStore.getPrivateKey(storageKey)
    const nextCryptoState = { currentDeviceId: activeDeviceId, privateKey }
    setCryptoState(nextCryptoState)
    cryptoRef.current = nextCryptoState
    if (!currentUser && me) {
      setCurrentUser({
        id: me.id,
        name: me.fullName || me.username || me.email || 'User',
      })
    }
    return nextCryptoState
  }, [authRepository, currentUser, keyStore, sessionStore, webDeviceStore])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleRefreshChats = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: unknown; from?: unknown; content?: unknown }>).detail
      const eventType = typeof detail?.type === 'string' ? detail.type : ''
      const senderId =
        typeof detail?.from === 'number'
          ? detail.from
          : typeof detail?.content === 'object' && detail.content && 'sender_id' in detail.content && typeof (detail.content as { sender_id?: unknown }).sender_id === 'number'
            ? ((detail.content as { sender_id: number }).sender_id)
            : null

      if (!shouldReloadMessengerChatList(eventType)) {
        return
      }

      if (senderId !== null && senderId === currentUserRef.current?.id) {
        return
      }

      console.log('[Messenger WS] Triggering loadChats due to messenger:refresh-chats event', eventType)
      void loadChats({ silent: true })
    }

    window.addEventListener('messenger:refresh-chats', handleRefreshChats as EventListener)
    return () => {
      window.removeEventListener('messenger:refresh-chats', handleRefreshChats as EventListener)
    }
  }, [loadChats])

  const loadChannels = useCallback(async () => {
    try {
      const channels = await channelRepository.getMyChannels()
      setMyChannels(channels)
    } catch (err) {
      console.error('Failed to load channels', err)
    }
  }, [channelRepository])

  const refreshActiveGroupMembers = useCallback(async (groupId: string) => {
    const group = await chatRepository.getGroupDetails(groupId)
    setActiveGroupMembers(group.members)
    setGroupMembersError('')
  }, [chatRepository])

  const loadChannelDetails = useCallback(async (channelId: string) => {
    setIsLoadingChannelDetails(true)
    try {
      const details = await channelRepository.getChannel(channelId)
      setChannelDetails(details)
    } catch (err) {
      setChannelMembersError(getErrorMessage(err, 'Не удалось загрузить данные канала.'))
    } finally {
      setIsLoadingChannelDetails(false)
    }
  }, [channelRepository])

  const handleUpdateChannel = useCallback(async (input: UpdateChannelInput) => {
    if (!activeChatId) return
    try {
      const updated = await channelRepository.updateChannel(activeChatId, input)
      setChannelDetails(updated)
      setChats(prev => prev.map(item => 
        item.chat.id === activeChatId 
          ? { 
              ...item, 
              title: updated.name, 
              avatar: getInitials(updated.name), 
              avatarUrl: updated.avatarUrl,
              chat: {
                ...item.chat,
                channelName: updated.name,
                channelAvatar: updated.avatarUrl,
                peerUsername: updated.username,
                updatedAt: updated.updatedAt,
              }
            } 
          : item
      ))
    } catch (err) {
      setChannelMembersError(getErrorMessage(err, 'Не удалось обновить данные канала.'))
    }
  }, [activeChatId, channelRepository])

  const handleUpdateChannelAvatar = useCallback(async (file: File) => {
    if (!activeChatId) return
    const uploaded = await chatRepository.uploadFile(file, 'image')
    await handleUpdateChannel({ avatarUrl: uploaded.url })
  }, [activeChatId, chatRepository, handleUpdateChannel])

  const handleJoinChannel = useCallback(async () => {
    if (!activeChatId) return
    try {
      setIsMessageActionLoading(true)
      await channelRepository.subscribe(activeChatId)
      const details = await channelRepository.getChannel(activeChatId)
      setChannelDetails(details)
      
      // Refresh my channels and unified chats to ensure full synchronization
      await Promise.all([
        loadChannels(),
        loadChats()
      ])
      await loadPinnedMessagesRef.current?.(activeChatId, 'channel')
      await loadMessagesRef.current?.(activeChatId, 'channel')
    } catch (err) {
      setMessageActionError(getErrorMessage(err, 'Не удалось подписаться на канал.'))
    } finally {
      setIsMessageActionLoading(false)
    }
  }, [activeChatId, channelRepository, loadChannels, loadChats])

  const loadChannelAdmins = useCallback(async (channelId: string) => {
    setIsLoadingChannelAdmins(true)
    try {
      const admins = await channelRepository.getAdmins(channelId)
      setChannelAdmins(admins)
    } catch (err) {
      setChannelMembersError(getErrorMessage(err, 'Не удалось загрузить список администраторов.'))
    } finally {
      setIsLoadingChannelAdmins(false)
    }
  }, [channelRepository])

  const loadChannelMembers = useCallback(async (channelId: string) => {
    setIsLoadingChannelMembers(true)
    try {
      const members = await channelRepository.getMembers(channelId)
      setChannelMembers(members)
    } catch (err) {
      setChannelMembersError(getErrorMessage(err, 'Не удалось загрузить список подписчиков.'))
    } finally {
      setIsLoadingChannelMembers(false)
    }
  }, [channelRepository])

  useEffect(() => {
    setMentionCaretIndex(0)
    setGroupMembersActionError('')

    const activeChatIdValue = activeChat?.chat.id
    const activeChatType = activeChat?.chat.type
    const isActiveChatDraft = activeChat?.isDraft

    if (!activeChatIdValue || activeChatType !== 'group' || isActiveChatDraft) {
      setActiveGroupMembers([])
      setGroupMembersError('')
      return
    }

    let cancelled = false
    setGroupMembersError('')

    void chatRepository
      .getGroupDetails(activeChatIdValue)
      .then((group) => {
        if (cancelled) {
          return
        }

        setActiveGroupMembers(group.members)
        setActiveGroupDetails(group)
      })
      .catch((loadError) => {
        if (cancelled) {
          return
        }

        setActiveGroupMembers([])
        setActiveGroupDetails(null)
        setGroupMembersError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить участников группы')
      })

    return () => {
      cancelled = true
    }
  }, [activeChat?.chat.id, activeChat?.chat.type, activeChat?.isDraft, chatRepository])

  useEffect(() => {
    const activeChatIdValue = activeChat?.chat.id
    const activeChatType = activeChat?.chat.type
    const isActiveChatDraft = activeChat?.isDraft

    if (!activeChatIdValue || activeChatType !== 'channel' || isActiveChatDraft) {
      setChannelDetails(null)
      setChannelAdmins([])
      setChannelMembers([])
      setChannelMembersError('')
      return
    }

    void loadChannelDetails(activeChatIdValue)
    void loadChannelAdmins(activeChatIdValue)
    void loadChannelMembers(activeChatIdValue)
  }, [activeChat?.chat.id, activeChat?.chat.type, activeChat?.isDraft, loadChannelDetails, loadChannelAdmins, loadChannelMembers])

  useEffect(() => {
    activeChatRef.current = activeChatId
    currentUserRef.current = currentUser
    cryptoRef.current = cryptoState
    chatsRef.current = chats
    messagesRef.current = messages
  }, [activeChatId, chats, cryptoState, currentUser, messages])

  useEffect(() => {
    onlineUserIdsRef.current = onlineUserIds
  }, [onlineUserIds])

  useEffect(() => {
    historyOffsetRef.current = historyOffset
  }, [historyOffset])

  useEffect(() => {
    hasMoreHistoryRef.current = hasMoreHistory
  }, [hasMoreHistory])

  useEffect(() => {
    isLoadingOlderMessagesRef.current = isLoadingOlderMessages
  }, [isLoadingOlderMessages])

  useEffect(() => {
    isAtBottomRef.current = isAtBottom
  }, [isAtBottom])

  useEffect(() => {
    return () => {
      if (pendingReadSyncFrameRef.current !== null) {
        cancelAnimationFrame(pendingReadSyncFrameRef.current)
      }
      if (highlightedSearchMessageTimeoutRef.current) {
        clearTimeout(highlightedSearchMessageTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isChatSearchOpen || !activeChatId || activeChat?.isDraft) {
      chatSearchRequestIdRef.current += 1
      setChatSearchResults([])
      setIsChatSearchLoading(false)
      setChatSearchError('')
      setChatSearchInfo('')
      setSelectedChatSearchResultId(null)
      return
    }

    const targetChatId = activeChatId
    const normalizedQuery = chatSearchQuery.trim()
    const requestId = chatSearchRequestIdRef.current + 1
    chatSearchRequestIdRef.current = requestId
    setChatSearchError('')
    setChatSearchInfo('')
    setSelectedChatSearchResultId(null)

    if (!normalizedQuery) {
      setChatSearchResults([])
      setIsChatSearchLoading(false)
      return
    }

    if (normalizedQuery.length < CHAT_SEARCH_MIN_QUERY_LENGTH) {
      setChatSearchResults([])
      setIsChatSearchLoading(false)
      return
    }

    const timeoutId = setTimeout(() => {
      setIsChatSearchLoading(true)

      void chatRepository
        .searchMessages(targetChatId, normalizedQuery, CHAT_SEARCH_PANEL_LIMIT)
        .then(async (result) => {
          if (chatSearchRequestIdRef.current !== requestId || activeChatRef.current !== targetChatId) {
            return
          }

          const nextResults = await Promise.all(result.messages.map((message) => buildChatSearchResultItem(message)))

          if (chatSearchRequestIdRef.current !== requestId || activeChatRef.current !== targetChatId) {
            return
          }

          setChatSearchResults(nextResults)
        })
        .catch((searchError) => {
          if (chatSearchRequestIdRef.current !== requestId || activeChatRef.current !== targetChatId) {
            return
          }

          setChatSearchResults([])
          setChatSearchError(searchError instanceof Error ? searchError.message : 'Не удалось выполнить поиск по чату')
        })
        .finally(() => {
          if (chatSearchRequestIdRef.current === requestId && activeChatRef.current === targetChatId) {
            setIsChatSearchLoading(false)
          }
        })
    }, CHAT_SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [activeChat?.isDraft, activeChatId, buildChatSearchResultItem, chatRepository, chatSearchQuery, isChatSearchOpen])

  useEffect(() => {
    if (!isChatSearchOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeChatSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeChatSearch, isChatSearchOpen])

  useEffect(() => {
    const syncWidth = () => {
      setChatListPanelWidth((prev) => clampChatListPanelWidth(prev))
      setIsMobileLayout(window.innerWidth < MOBILE_MESSENGER_BREAKPOINT)
    }

    syncWidth()
    window.addEventListener('resize', syncWidth)
    return () => window.removeEventListener('resize', syncWidth)
  }, [])

  useEffect(() => {
    if (!activeChatId) {
      if (window.location.pathname.startsWith('/messenger/')) {
        navigate('/messenger')
      }
      return
    }

    if (!activeChat) return

    // Standard behavior: channels sync to /messenger/@username or /messenger/ID
    if (activeChat.chat.type === 'channel') {
      const chatUsername = activeChat.chat.peerUsername
      const cleanUsername = chatUsername ? (chatUsername.startsWith('@') ? chatUsername.slice(1) : chatUsername) : null
      const isUuid = cleanUsername ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUsername) : false
      
      if (cleanUsername && !isUuid) {
        // Use @handle if available and NOT a UUID
        const targetPath = `/messenger/@${cleanUsername}`
        if (window.location.pathname !== targetPath && window.location.pathname !== `/${cleanUsername}` && window.location.pathname !== `/@${cleanUsername}`) {
          navigate(targetPath)
        }
      } else {
        // Fallback to ID-based path for channels without a public handle
        const targetPath = `/messenger/${activeChat.chat.id}`
        if (window.location.pathname !== targetPath && window.location.pathname !== `/${activeChat.chat.id}`) {
          navigate(targetPath)
        }
      }
    }
  }, [activeChatId, activeChat, navigate])

  useEffect(() => {
    if (!isMobileLayout) {
      return
    }

    setIsChatListPanelResizing(false)
  }, [isMobileLayout])

  useEffect(() => {
    if (!isChatListPanelResizing) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = clampChatListPanelWidth(chatListResizeStartWidthRef.current + (event.clientX - chatListResizeStartXRef.current))
      setChatListPanelWidth(nextWidth)
    }

    const handleMouseUp = () => {
      setIsChatListPanelResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isChatListPanelResizing])

  useEffect(() => {
    const previousActiveChat = previousActiveChatRef.current

    if (
      previousActiveChat?.isDraft &&
      previousActiveChat.chat.id !== activeChatId &&
      input.trim() === '' &&
      messagesRef.current.length === 0
    ) {
      setChats((prev) => prev.filter((item) => item.chat.id !== previousActiveChat.chat.id))
    }

    previousActiveChatRef.current = activeChat
  }, [activeChat, activeChatId, input])

  const syncScrollBottomState = useCallback(() => {
    const scroller = messagesScrollerRef.current
    if (!scroller) {
      return
    }

    const atBottom = isScrolledNearBottom(scroller)
    isAtBottomRef.current = atBottom
    setIsAtBottom(atBottom)
    if (atBottom) {
      setPendingNewMessagesCount(0)
    }
  }, [])

  const stickChatToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    pendingMessagesScrollBehaviorRef.current = behavior
    isAtBottomRef.current = true
    setIsAtBottom(true)
    setPendingNewMessagesCount(0)
  }, [])

  useLayoutEffect(() => {
    const scroller = messagesScrollerRef.current
    if (!scroller || isLoadingMessages) {
      return
    }

    if (pendingPrependScrollRef.current) {
      const { scrollHeight, scrollTop } = pendingPrependScrollRef.current
      pendingPrependScrollRef.current = null
      scroller.scrollTop = scrollTop + (scroller.scrollHeight - scrollHeight)
      return
    }

    const behavior = pendingMessagesScrollBehaviorRef.current
    if (!behavior) {
      return
    }

    pendingMessagesScrollBehaviorRef.current = null
    if (behavior === 'auto') {
      scroller.scrollTop = scroller.scrollHeight
    } else {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
    }

    requestAnimationFrame(() => {
      syncScrollBottomState()
    })
  }, [messages, isLoadingMessages, syncScrollBottomState])

  const handleQrAuthenticated = useCallback(
    async (tokens: AuthTokens): Promise<void> => {
      sessionStore.setTokens(tokens)
      setIsChatQrAuthorized(true)
      await loadChats()
    },
    [loadChats, sessionStore],
  )

  const {
    status: qrStatus,
    startQrLogin,
  } = useQrLogin({ onAuthenticated: handleQrAuthenticated })

  useEffect(() => {
    if (isChatQrAuthorized || qrStatus !== 'idle') return
    if (webDeviceStore.getCurrentDeviceId()) return
    void startQrLogin()
  }, [isChatQrAuthorized, qrStatus, startQrLogin, webDeviceStore])

  const createFolder = useCallback(async () => {
    const normalizedName = folderName.trim()
    if (!normalizedName) {
      setFolderError('Введите название папки')
      return
    }

    setIsCreatingFolder(true)
    setFolderError('')

    try {
      const nextFolder = await chatRepository.createFolder(normalizedName)
      setFolders((prev) => [nextFolder, ...prev])

      if (pendingFolderAssignmentTarget) {
        const folderApiChatType = pendingFolderAssignmentTarget.chatType === 'group' ? 'group' : 'conversation'
        const currentFolderIds = Object.entries(folderChatAssignments)
          .filter(([, chatIds]) => chatIds.includes(pendingFolderAssignmentTarget.chatId))
          .map(([folderId]) => folderId)

        try {
          await Promise.all(
            currentFolderIds.map((folderId) =>
              chatRepository.removeChatFromFolder(folderId, pendingFolderAssignmentTarget.chatId),
            ),
          )
          await chatRepository.addChatToFolder(nextFolder.id, pendingFolderAssignmentTarget.chatId, folderApiChatType)

          const nextAssignments = {
            ...Object.fromEntries(
              Object.entries(folderChatAssignments).map(([folderId, chatIds]) => [
                folderId,
                chatIds.filter((chatId) => chatId !== pendingFolderAssignmentTarget.chatId),
              ]),
            ),
            [nextFolder.id]: [pendingFolderAssignmentTarget.chatId],
          } as Record<string, string[]>

          setFolderChatAssignments(nextAssignments)
          writeFolderChatAssignments(nextAssignments)
        } catch (folderAssignError) {
          const message =
            folderAssignError instanceof Error
              ? folderAssignError.message
              : 'Папка создана, но не удалось добавить в неё чат'
          setChatListActionError(message)
        }
      }

      setFolderName('')
      setEditingFolderId(null)
      setPendingFolderAssignmentTarget(null)
      setIsFolderModalOpen(false)
    } catch (createFolderError) {
      setFolderError(createFolderError instanceof Error ? createFolderError.message : 'Не удалось создать папку')
    } finally {
      setIsCreatingFolder(false)
    }
  }, [chatRepository, folderChatAssignments, folderName, pendingFolderAssignmentTarget])

  const persistFolderAssignments = useCallback((nextValue: Record<string, string[]>) => {
    setFolderChatAssignments(nextValue)
    writeFolderChatAssignments(nextValue)
  }, [])

  const removeChatFromAllFolderAssignmentsLocally = useCallback(
    (chatId: string) => {
      const nextAssignments = Object.fromEntries(
        Object.entries(folderChatAssignments).map(([folderId, chatIds]) => [folderId, chatIds.filter((id) => id !== chatId)]),
      ) as Record<string, string[]>

      persistFolderAssignments(nextAssignments)
    },
    [folderChatAssignments, persistFolderAssignments],
  )

  const assignChatToFolderById = useCallback(
    async (chatId: string, chatType: ChatType, folderId: string) => {
      const folderApiChatType = chatType === 'group' ? 'group' : 'conversation'
      const currentFolderIds = Object.entries(folderChatAssignments)
        .filter(([, chatIds]) => chatIds.includes(chatId))
        .map(([currentFolderId]) => currentFolderId)

      setIsFolderUpdating(true)
      setIsFolderUpdating(true)
      setChatListActionError('')

      try {
        await Promise.all(
          currentFolderIds
            .filter((currentFolderId) => currentFolderId !== folderId)
            .map((currentFolderId) => chatRepository.removeChatFromFolder(currentFolderId, chatId)),
        )

        if (!currentFolderIds.includes(folderId)) {
          await chatRepository.addChatToFolder(folderId, chatId, folderApiChatType)
        }

        const nextAssignments = Object.fromEntries(
          Object.entries(folderChatAssignments).map(([currentFolderId, chatIds]) => [
            currentFolderId,
            currentFolderId === folderId ? [...new Set([...chatIds.filter((id) => id !== chatId), chatId])] : chatIds.filter((id) => id !== chatId),
          ]),
        ) as Record<string, string[]>

        persistFolderAssignments(nextAssignments)
      } catch (moveFolderError) {
        const message = moveFolderError instanceof Error ? moveFolderError.message : 'Не удалось переместить чат в папку'
        setChatListActionError(message)
        throw moveFolderError
      } finally {
        setIsFolderUpdating(false)
      }
    },
    [chatRepository, folderChatAssignments, persistFolderAssignments],
  )

  const removeChatFromFolderById = useCallback(
    async (chatId: string, folderId: string) => {
      setIsFolderUpdating(true)
      setIsFolderUpdating(true)
      setChatListActionError('')

      try {
        await chatRepository.removeChatFromFolder(folderId, chatId)
        const nextAssignments = {
          ...folderChatAssignments,
          [folderId]: (folderChatAssignments[folderId] ?? []).filter((id) => id !== chatId),
        }
        persistFolderAssignments(nextAssignments)
      } catch (removeFolderError) {
        const message = removeFolderError instanceof Error ? removeFolderError.message : 'Не удалось убрать чат из папки'
        setChatListActionError(message)
        throw removeFolderError
      } finally {
        setIsFolderUpdating(false)
      }
    },
    [chatRepository, folderChatAssignments, persistFolderAssignments],
  )

  const updateFolder = useCallback(async () => {
    const normalizedName = folderName.trim()
    if (!editingFolderId) {
      return
    }

    if (!normalizedName) {
      setFolderError('Введите название папки')
      return
    }

    setIsCreatingFolder(true)
    setFolderError('')

    try {
      await chatRepository.updateFolder(editingFolderId, normalizedName)
      setFolders((prev) =>
        prev.map((folder) => (folder.id === editingFolderId ? { ...folder, name: normalizedName } : folder)),
      )
      setFolderName('')
      setEditingFolderId(null)
      setPendingFolderAssignmentTarget(null)
      setIsFolderModalOpen(false)
    } catch (updateFolderError) {
      setFolderError(updateFolderError instanceof Error ? updateFolderError.message : 'Не удалось изменить папку')
    } finally {
      setIsCreatingFolder(false)
    }
  }, [chatRepository, editingFolderId, folderName])

  const deleteFolder = useCallback(
    async (folderId: string) => {
      setIsDeletingFolder(true)
      setFolderError('')

      try {
        await chatRepository.deleteFolder(folderId)
        setFolders((prev) => prev.filter((folder) => folder.id !== folderId))
        const nextAssignments = Object.fromEntries(
          Object.entries(folderChatAssignments).filter(([currentFolderId]) => currentFolderId !== folderId),
        )
        persistFolderAssignments(nextAssignments)

        if (selectedFolderId === folderId) {
          setSelectedFolderId(null)
          setFilter('all')
        }

        if (editingFolderId === folderId) {
          setEditingFolderId(null)
          setFolderName('')
        }
      } catch (deleteFolderError) {
        setFolderError(deleteFolderError instanceof Error ? deleteFolderError.message : 'Не удалось удалить папку')
      } finally {
        setIsDeletingFolder(false)
      }
    },
    [chatRepository, editingFolderId, folderChatAssignments, persistFolderAssignments, selectedFolderId],
  )

  const addGroupMember = useCallback(async (userId: number) => {
    if (!activeChat || activeChat.chat.type !== 'group') {
      return
    }

    setIsGroupMembersUpdating(true)
    setGroupMembersActionError('')

    try {
      await chatRepository.addGroupMembers(activeChat.chat.id, [userId])
      await refreshActiveGroupMembers(activeChat.chat.id)
    } catch (error) {
      setGroupMembersActionError(error instanceof Error ? error.message : 'Не удалось добавить участника')
    } finally {
      setIsGroupMembersUpdating(false)
    }
  }, [activeChat, chatRepository, refreshActiveGroupMembers])

  const removeGroupMember = useCallback(async (userId: number) => {
    if (!activeChat || activeChat.chat.type !== 'group') {
      return
    }

    setIsGroupMembersUpdating(true)
    setGroupMembersActionError('')

    try {
      await chatRepository.removeGroupMember(activeChat.chat.id, userId)
      await refreshActiveGroupMembers(activeChat.chat.id)
    } catch (error) {
      setGroupMembersActionError(error instanceof Error ? error.message : 'Не удалось удалить участника')
    } finally {
      setIsGroupMembersUpdating(false)
    }
  }, [activeChat, chatRepository, refreshActiveGroupMembers])

  const updateGroupMemberRole = useCallback(async (userId: number, role: 'member' | 'admin') => {
    if (!activeChat || activeChat.chat.type !== 'group') {
      return
    }

    setIsGroupMembersUpdating(true)
    setGroupMembersActionError('')

    try {
      await chatRepository.updateGroupMemberRole(activeChat.chat.id, userId, role)
      await refreshActiveGroupMembers(activeChat.chat.id)
    } catch (error) {
      setGroupMembersActionError(error instanceof Error ? error.message : 'Не удалось изменить роль участника')
    } finally {
      setIsGroupMembersUpdating(false)
    }
  }, [activeChat, chatRepository, refreshActiveGroupMembers])

  const leaveActiveGroup = useCallback(async () => {
    if (!activeChat || activeChat.chat.type !== 'group') {
      return
    }

    setIsGroupMembersUpdating(true)
    setGroupMembersActionError('')

    try {
      await chatRepository.leaveGroup(activeChat.chat.id)
      setShowInfo(false)
      await loadChats()
    } catch (error) {
      setGroupMembersActionError(error instanceof Error ? error.message : 'Не удалось выйти из группы')
    } finally {
      setIsGroupMembersUpdating(false)
    }
  }, [activeChat, chatRepository, loadChats])

  const subscribeToChannel = useCallback(async (channelId: string) => {
    try {
      await channelRepository.subscribe(channelId)
      await loadChannelDetails(channelId)
      await loadChats()
      await loadPinnedMessagesRef.current?.(channelId, 'channel')
      await loadMessagesRef.current?.(channelId, 'channel')
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось подписаться на канал.'))
    }
  }, [channelRepository, loadChannelDetails, loadChats])

  const unsubscribeFromChannel = useCallback(async (channelId: string) => {
    try {
      await channelRepository.unsubscribe(channelId)
      setShowInfo(false)
      setActiveChatId(null)
      await loadChats()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось отписаться от канала.'))
    }
  }, [channelRepository, loadChats])

  const handleRestoreE2ee = useCallback(async () => {
    const password = e2eeRestorePassword.trim()
    if (!password) {
      setE2eeRestoreError('Введите пароль')
      return
    }

    setIsE2eeRestoreLoading(true)
    setE2eeRestoreError('')

    try {
      await ssoE2eeRecoveryUseCase.execute(password)
      const nextCryptoState = await refreshCryptoState()
      setIsE2eeRestoreModalOpen(false)
      setE2eeRestorePassword('')
      setHasRemoteE2eeBackup(nextCryptoState.privateKey ? true : hasRemoteE2eeBackup)

      if (activeChatId) {
        await loadMessagesRef.current?.(activeChatId, activeChat?.chat.type ?? 'personal')
      }
    } catch (err) {
      setE2eeRestoreError(getErrorMessage(err, 'Не удалось восстановить ключи. Проверьте пароль.'))
    } finally {
      setIsE2eeRestoreLoading(false)
    }
  }, [activeChat?.chat.type, activeChatId, e2eeRestorePassword, hasRemoteE2eeBackup, refreshCryptoState, ssoE2eeRecoveryUseCase])

  const addChannelMembers = useCallback(async (channelId: string, userIds: number[]) => {
    setIsLoadingChannelMembers(true)
    try {
      await channelRepository.addMembers(channelId, userIds)
      await loadChannelMembers(channelId)
      await loadChannelDetails(channelId)
    } catch (err) {
      setChannelMembersError(getErrorMessage(err, 'Не удалось добавить участников.'))
    } finally {
      setIsLoadingChannelMembers(false)
    }
  }, [channelRepository, loadChannelDetails, loadChannelMembers])

  const removeChannelMember = useCallback(async (channelId: string, userId: number) => {
    setIsLoadingChannelMembers(true)
    try {
      await channelRepository.removeMember(channelId, userId)
      await loadChannelMembers(channelId)
      await loadChannelAdmins(channelId)
      await loadChannelDetails(channelId)
    } catch (err) {
      setChannelMembersError(getErrorMessage(err, 'Не удалось исключить участника.'))
    } finally {
      setIsLoadingChannelMembers(false)
    }
  }, [channelRepository, loadChannelAdmins, loadChannelDetails, loadChannelMembers])

  const updateChannelMemberRole = useCallback(async (channelId: string, userId: number, role: ChannelRole) => {
    setIsLoadingChannelMembers(true)
    try {
      await channelRepository.updateMemberRole(channelId, userId, role)
      await loadChannelMembers(channelId)
      await loadChannelAdmins(channelId)
    } catch (err) {
      setChannelMembersError(getErrorMessage(err, 'Не удалось обновить роль.'))
    } finally {
      setIsLoadingChannelMembers(false)
    }
  }, [channelRepository, loadChannelAdmins, loadChannelMembers])

  const closeChatListContextMenu = useCallback(() => {
    setChatListContextMenu(null)
  }, [])

  const openChatListContextMenu = useCallback((event: ReactMouseEvent<HTMLButtonElement>, chatId: string) => {
    if (chatId === 'smart-agent') {
      event.preventDefault()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const menuWidth = 236
    const menuHeight = 320
    setChatListActionError('')

    const x = Math.max(12, Math.min(event.clientX, window.innerWidth - menuWidth - 12))
    let y = event.clientY
    if (y + menuHeight > window.innerHeight - 12) {
      y = Math.max(12, event.clientY - menuHeight)
    }

    setChatListContextMenu({
      chatId,
      x,
      y,
      isFolderMenuOpen: false,
    })
  }, [])

  const toggleChatListFolderMenu = useCallback(() => {
    setChatListContextMenu((prev) => (prev ? { ...prev, isFolderMenuOpen: !prev.isFolderMenuOpen } : prev))
  }, [])

  const removeChatLocally = useCallback(
    (chatId: string) => {
      setChats((prev) => prev.filter((item) => item.chat.id !== chatId))
      removeChatFromAllFolderAssignmentsLocally(chatId)

      if (activeChatId === chatId) {
        setActiveChatId(null)
        setShowInfo(false)
        messageDraftRef.current = ''
        setInput('')
        setMentionCaretIndex(0)
        setMessages([])
        setHistoryOffset(0)
        setHasMoreHistory(false)
        setHistoryError('')
        setPendingNewMessagesCount(0)
        setSelectedMessages({ ids: [], anchorId: null })
        setMessageActionError('')
        setMessageContextMenu(null)
        setPinnedMessages([])
        setActivePinnedIndex(0)
        setIsPinnedMessagesPanelOpen(false)
        setChatSearchQuery('')
        setChatSearchResults([])
        setChatSearchError('')
        setChatSearchInfo('')
        setSelectedChatSearchResultId(null)
        setHighlightedSearchMessageId(null)
        setIsChatSearchOpen(false)
      }
    },
    [activeChatId, removeChatFromAllFolderAssignmentsLocally],
  )

  const handleToggleChatPin = useCallback(
    async (chatItem: ChatListItem) => {
      if (chatItem.isDraft) {
        return
      }

      closeChatListContextMenu()
      setIsChatListActionLoading(true)
      setChatListActionError('')

      try {
        if (chatItem.chat.isPinned) {
          await chatRepository.unpinChat(chatItem.chat.id, chatItem.chat.type)
        } else {
          await chatRepository.pinChat(chatItem.chat.id, chatItem.chat.type)
        }

        await loadChats()
      } catch (chatActionError) {
        setChatListActionError(chatActionError instanceof Error ? chatActionError.message : 'Не удалось обновить закреп чата')
      } finally {
        setIsChatListActionLoading(false)
      }
    },
    [chatRepository, closeChatListContextMenu, loadChats],
  )

  const handleToggleContextChatMute = useCallback(async () => {
    if (!chatListContextMenuTarget || chatListContextMenuTarget.isDraft) {
      return
    }

    const { id, type, isMuted } = chatListContextMenuTarget.chat
    const nextMute = !isMuted

    closeChatListContextMenu()
    setIsChatListActionLoading(true)
    setChatListActionError('')

    try {
      let resolved = nextMute
      if (type === 'personal') {
        resolved = await chatRepository.setConversationMute(id, nextMute)
      } else if (type === 'group') {
        resolved = await chatRepository.setGroupMute(id, nextMute)
      } else if (type === 'channel') {
        resolved = await chatRepository.setChannelMute(id, nextMute)
      } else {
        return
      }
      applyMutedToChatId(id, resolved)
    } catch (chatActionError) {
      setChatListActionError(chatActionError instanceof Error ? chatActionError.message : 'Не удалось обновить уведомления')
    } finally {
      setIsChatListActionLoading(false)
    }
  }, [chatListContextMenuTarget, chatRepository, closeChatListContextMenu, applyMutedToChatId])

  const handleAssignContextChatToFolder = useCallback(
    async (folderId: string) => {
      if (!chatListContextMenuTarget || chatListContextMenuTarget.isDraft) {
        return
      }

      closeChatListContextMenu()

      try {
        await assignChatToFolderById(chatListContextMenuTarget.chat.id, chatListContextMenuTarget.chat.type, folderId)
      } catch {
        return
      }
    },
    [assignChatToFolderById, chatListContextMenuTarget, closeChatListContextMenu],
  )

  const handleRemoveContextChatFromFolder = useCallback(async () => {
    if (!chatListContextMenuTarget || !chatListContextMenuFolderId) {
      return
    }

    closeChatListContextMenu()

    try {
      await removeChatFromFolderById(chatListContextMenuTarget.chat.id, chatListContextMenuFolderId)
    } catch {
      return
    }
  }, [chatListContextMenuFolderId, chatListContextMenuTarget, closeChatListContextMenu, removeChatFromFolderById])

  const handleRequestDeleteChat = useCallback((chatId: string) => {
    closeChatListContextMenu()
    setChatDeleteTargetId(chatId)
    setIsChatDeleteConfirmOpen(true)
    setChatListActionError('')
  }, [closeChatListContextMenu])

  const handleConfirmDeleteChat = useCallback(async () => {
    if (!chatDeleteTarget) {
      return
    }

    setIsChatListActionLoading(true)
    setChatListActionError('')

    try {
      if (chatDeleteTarget.chat.type === 'channel') {
        await channelRepository.unsubscribe(chatDeleteTarget.chat.id)
      } else if (chatDeleteTarget.chat.type === 'group') {
        await chatRepository.deleteGroup(chatDeleteTarget.chat.id)
      } else {
        await chatRepository.hideConversation(chatDeleteTarget.chat.id)
      }

      removeChatLocally(chatDeleteTarget.chat.id)
      setIsChatDeleteConfirmOpen(false)
      setChatDeleteTargetId(null)
      await loadChats()
    } catch (chatDeleteError) {
      setChatListActionError(
        chatDeleteError instanceof Error
          ? chatDeleteError.message
          : chatDeleteTarget.chat.type === 'group'
            ? 'Не удалось удалить группу'
            : 'Не удалось скрыть чат',
      )
    } finally {
      setIsChatListActionLoading(false)
    }
  }, [chatDeleteTarget, chatRepository, channelRepository, loadChats, removeChatLocally])

  const handleOpenGroupEditModal = useCallback(
    async (chatItem: ChatListItem) => {
      if (chatItem.chat.type !== 'group' || chatItem.isDraft) {
        return
      }

      closeChatListContextMenu()
      setIsChatListActionLoading(true)
      setChatListActionError('')
      setGroupEditTargetId(null)
      setGroupEditName('')
      setGroupEditDescription('')
      setGroupEditError('')
      setIsGroupEditLoading(true)

      try {
        const group = await chatRepository.getGroupDetails(chatItem.chat.id)
        const currentGroupMember = group.members.find((member) => member.id === currentUser?.id) ?? null
        const canEditGroup = currentGroupMember?.role === 'owner' || currentGroupMember?.role === 'admin'

        if (!canEditGroup) {
          setChatListActionError('У вас нет прав для изменения этой группы.')
          return
        }

        setGroupEditTargetId(chatItem.chat.id)
        setGroupEditName(group.name)
        setGroupEditDescription(group.description ?? '')
        setIsGroupEditModalOpen(true)
      } catch (groupEditLoadError) {
        setChatListActionError(groupEditLoadError instanceof Error ? groupEditLoadError.message : 'Не удалось загрузить параметры группы')
      } finally {
        setIsGroupEditLoading(false)
        setIsChatListActionLoading(false)
      }
    },
    [chatRepository, closeChatListContextMenu, currentUser?.id],
  )

  const handleSubmitGroupEdit = useCallback(async () => {
    const normalizedName = groupEditName.trim()
    if (!groupEditTargetId) {
      return
    }

    if (!normalizedName) {
      setGroupEditError('Введите название группы')
      return
    }

    setIsGroupEditSaving(true)
    setGroupEditError('')

    try {
      await chatRepository.updateGroup(groupEditTargetId, {
        name: normalizedName,
        description: groupEditDescription.trim() || null,
      })

      setIsGroupEditModalOpen(false)
      setGroupEditTargetId(null)
      setGroupEditName('')
      setGroupEditDescription('')
      await loadChats()
    } catch (groupEditSaveError) {
      setGroupEditError(groupEditSaveError instanceof Error ? groupEditSaveError.message : 'Не удалось изменить группу')
    } finally {
      setIsGroupEditSaving(false)
    }
  }, [chatRepository, groupEditDescription, groupEditName, groupEditTargetId, loadChats])

  const closeGroupEditModal = useCallback(() => {
    setIsGroupEditModalOpen(false)
    setGroupEditTargetId(null)
    setGroupEditName('')
    setGroupEditDescription('')
    setGroupEditError('')
    setIsGroupEditLoading(false)
    setIsGroupEditSaving(false)
  }, [])

  const updateChatBadgeLocally = useCallback(
    (
      chatId: string,
      nextBadge: {
        unreadCount?: number
        mentionCount?: number
      },
    ) => {
      setChats((prev) =>
        prev.map((item) =>
          item.chat.id === chatId
            ? {
                ...item,
                unread: nextBadge.unreadCount ?? item.unread,
                chat: {
                  ...item.chat,
                  unreadCount: nextBadge.unreadCount ?? item.chat.unreadCount,
                  mentionCount: nextBadge.mentionCount ?? item.chat.mentionCount,
                },
              }
            : item,
        ),
      )
    },
    [],
  )

  const clearChatBadges = useCallback((chatId: string) => {
    updateChatBadgeLocally(chatId, { unreadCount: 0, mentionCount: 0 })
  }, [updateChatBadgeLocally])

  const getChatBadgeState = useCallback((chatId: string) => {
    const targetChat = chatsRef.current.find((item) => item.chat.id === chatId)

    return {
      unreadCount: targetChat?.chat.unreadCount ?? targetChat?.unread ?? 0,
      mentionCount: targetChat?.chat.mentionCount ?? 0,
    }
  }, [])

  const isMessageVisibleInScroller = useCallback((node: HTMLDivElement, scroller: HTMLDivElement) => {
    const viewportTop = scroller.scrollTop
    const viewportBottom = viewportTop + scroller.clientHeight
    const messageTop = node.offsetTop
    const messageBottom = messageTop + node.offsetHeight

    return messageBottom > viewportTop + 4 && messageTop < viewportBottom - 4
  }, [])

  const findNewestVisibleIncomingMessage = useCallback((chatId: string, nextMessages: MessageView[]): MessageView | null => {
    const current = currentUserRef.current
    const scroller = messagesScrollerRef.current

    if (!current) {
      return null
    }

    if (!scroller) {
      for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
        const message = nextMessages[index]
        if (
          message.raw.conversationId === chatId &&
          message.raw.senderId !== current.id &&
          !message.raw.isRead
        ) {
          return message
        }
      }

      return null
    }

    for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
      const message = nextMessages[index]
      if (
        message.raw.conversationId !== chatId ||
        message.raw.senderId === current.id ||
        message.raw.isRead
      ) {
        continue
      }

      const node = messageItemRefs.current[message.raw.id]
      if (node && isMessageVisibleInScroller(node, scroller)) {
        return message
      }
    }

    return null
  }, [isMessageVisibleInScroller])

  const findNewestVisibleMessage = useCallback((chatId: string, nextMessages: MessageView[]): MessageView | null => {
    const scroller = messagesScrollerRef.current

    if (!scroller) {
      for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
        const message = nextMessages[index]
        if (message.raw.conversationId === chatId) {
          return message
        }
      }

      return null
    }

    for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
      const message = nextMessages[index]
      if (message.raw.conversationId !== chatId) {
        continue
      }

      const node = messageItemRefs.current[message.raw.id]
      if (node && isMessageVisibleInScroller(node, scroller)) {
        return message
      }
    }

    return null
  }, [isMessageVisibleInScroller])

  const applyLocalIncomingReadState = useCallback((anchorMessageId: string) => {
    const current = currentUserRef.current
    if (!current) {
      return
    }

    setMessages((prev) => {
      const boundaryIndex = prev.findIndex((message) => message.raw.id === anchorMessageId)
      if (boundaryIndex === -1) {
        return prev
      }

      return prev.map((message, index) =>
        index <= boundaryIndex && message.raw.senderId !== current.id
          ? {
              ...message,
              raw: {
                ...message.raw,
                isRead: true,
              },
            }
          : message,
      )
    })
  }, [])

  const rememberChannelViewedAt = useCallback((channelId: string, viewedAt: string) => {
    if (!channelId || !viewedAt) {
      return
    }

    const next = {
      ...channelViewedAtMapRef.current,
      [channelId]: viewedAt,
    }

    channelViewedAtMapRef.current = next
    writeChannelViewedAtMap(next)
  }, [])

  const markChatAnchorAsRead = useCallback(
    async (chatId: string, chatType: ChatType, anchorMessageId: string, anchorMessageCreatedAt: string) => {
      if (chatType !== 'channel' && shouldSkipServerReadReceipt(anchorMessageId)) {
        clearChatBadges(chatId)
        applyLocalIncomingReadState(anchorMessageId)
        return
      }

      const previousAnchorMessageId = lastMarkedReadMessageIdByChatRef.current[chatId] ?? ''

      if (previousAnchorMessageId === anchorMessageId) {
        return
      }

      lastMarkedReadMessageIdByChatRef.current[chatId] = anchorMessageId

      const isSuccess = await (chatType === 'channel'
        ? channelRepository.markPostViewed(anchorMessageId)
        : chatRepository.markAsRead(anchorMessageId))
        .then(() => true)
        .catch(() => false)

      if (!isSuccess) {
        if (lastMarkedReadMessageIdByChatRef.current[chatId] === anchorMessageId) {
          lastMarkedReadMessageIdByChatRef.current[chatId] = previousAnchorMessageId
        }
        return
      }

      if (chatType === 'channel') {
        rememberChannelViewedAt(chatId, anchorMessageCreatedAt)
      }

      clearChatBadges(chatId)
      applyLocalIncomingReadState(anchorMessageId)
    },
    [applyLocalIncomingReadState, channelRepository, chatRepository, clearChatBadges, rememberChannelViewedAt],
  )

  const markVisibleIncomingAsRead = useCallback(
    async (chatId: string, chatType: ChatType, nextMessages: MessageView[]) => {
      const current = currentUserRef.current
      if (!current || nextMessages.length === 0) {
        return
      }

      const { unreadCount, mentionCount } = getChatBadgeState(chatId)
      const unreadVisibleIncomingMessage = findNewestVisibleIncomingMessage(chatId, nextMessages)
      if (!unreadVisibleIncomingMessage && unreadCount <= 0 && mentionCount <= 0) {
        return
      }

      const anchorMessage =
        unreadVisibleIncomingMessage ??
        (unreadCount > 0 || mentionCount > 0 ? findNewestVisibleMessage(chatId, nextMessages) : null)

      if (!anchorMessage) {
        return
      }

      await markChatAnchorAsRead(chatId, chatType, anchorMessage.raw.id, anchorMessage.raw.createdAt)
    },
    [findNewestVisibleIncomingMessage, findNewestVisibleMessage, getChatBadgeState, markChatAnchorAsRead],
  )

  const scheduleVisibleReadSync = useCallback(
    (chatId: string, chatType: ChatType, nextMessages: MessageView[]) => {
      if (pendingReadSyncFrameRef.current !== null) {
        cancelAnimationFrame(pendingReadSyncFrameRef.current)
      }

      pendingReadSyncFrameRef.current = requestAnimationFrame(() => {
        pendingReadSyncFrameRef.current = null
        void markVisibleIncomingAsRead(chatId, chatType, nextMessages)
      })
    },
    [markVisibleIncomingAsRead],
  )

  const updateChatPreview = useCallback(async (rawMessage: ChatMessage) => {
    const preview = await resolveMessageText(rawMessage, cryptoRef.current, { compact: true })
    setChats((prev) => {
      const hasChat = prev.some((item) => item.chat.id === rawMessage.conversationId)
      if (!hasChat) {
        void loadChats({ silent: true })
        return prev
      }

      return prev.map((item) =>
        item.chat.id === rawMessage.conversationId
          ? {
              ...item,
              chat: {
                ...item.chat,
                lastMessage: rawMessage,
                updatedAt: rawMessage.updatedAt,
              },
              subtitle: preview.text,
              time: formatTimeLabel(rawMessage.createdAt),
            }
          : item,
      )
    })
  }, [loadChats])

  const updateChatPreviewForEditedMessage = useCallback((messageId: string, content: string, isEdited = true) => {
    setChats((prev) => {
      const targets = prev
        .filter((item) => item.chat.lastMessage?.id === messageId)
        .map((item) => {
          const updatedRaw: ChatMessage = {
            ...item.chat.lastMessage!,
            content,
            isEdited,
            editedAt: item.chat.lastMessage?.editedAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          return resolveMessageText(updatedRaw, cryptoRef.current, { compact: true }).then((preview) => ({
            chatId: item.chat.id,
            updatedRaw,
            previewText: preview.text,
          }))
        })

      if (!targets.length) {
        return prev
      }

      void Promise.all(targets).then((updates) => {
        setChats((current) =>
          current.map((item) => {
            const update = updates.find((candidate) => candidate.chatId === item.chat.id)
            if (!update || item.chat.lastMessage?.id !== messageId) {
              return item
            }

            return {
              ...item,
              chat: {
                ...item.chat,
                lastMessage: update.updatedRaw,
                updatedAt: update.updatedRaw.updatedAt,
              },
              subtitle: update.previewText,
              time: formatTimeLabel(update.updatedRaw.createdAt),
            }
          }),
        )
      })

      return prev
    })
  }, [])

  const clearSelectedMessages = useCallback(() => {
    setSelectedMessages({ ids: [], anchorId: null })
    setMessageActionError('')
    setMessageContextMenu(null)
  }, [])

  const closeMessageContextMenu = useCallback(() => {
    setMessageContextMenu(null)
  }, [])

  const handleAddReaction = useCallback(
    async (messageId: string, reaction: string) => {
      if (!currentUser) return
      // Оптимистичное обновление
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.raw.id !== messageId) return msg
          const existingReactions = msg.raw.reactions ?? []
          const existing = existingReactions.find((r) => r.reaction === reaction)
          const nextReactions = existing
            ? existingReactions.map((r) =>
                r.reaction === reaction
                  ? { ...r, count: r.count + 1, reacted: true, users: [...r.users, { id: currentUser.id, fullName: currentUser.name, avatar: null }] }
                  : r,
              )
            : [...existingReactions, { reaction, count: 1, reacted: true, users: [{ id: currentUser.id, fullName: currentUser.name, avatar: null }] }]
          return { ...msg, raw: { ...msg.raw, reactions: nextReactions } }
        }),
      )
      try {
        const serverReactions =
          activeChat?.chat.type === 'channel'
            ? await channelRepository.addReaction(messageId, reaction)
            : await chatRepository.addReaction(messageId, reaction)
        setMessages((prev) =>
          prev.map((msg) => (msg.raw.id === messageId ? { ...msg, raw: { ...msg.raw, reactions: serverReactions } } : msg)),
        )
      } catch {
        // При ошибке сервер пришлёт message_reactions_updated через WS
      }
    },
    [activeChat?.chat.type, channelRepository, chatRepository, currentUser],
  )

  const handleRemoveReaction = useCallback(
    async (messageId: string, reaction: string) => {
      if (!currentUser) return
      // Оптимистичное обновление
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.raw.id !== messageId) return msg
          const existingReactions = msg.raw.reactions ?? []
          const nextReactions = existingReactions
            .map((r) =>
              r.reaction === reaction
                ? { ...r, count: Math.max(0, r.count - 1), reacted: false, users: r.users.filter((u) => u.id !== currentUser.id) }
                : r,
            )
            .filter((r) => r.count > 0)
          return { ...msg, raw: { ...msg.raw, reactions: nextReactions } }
        }),
      )
      try {
        const serverReactions =
          activeChat?.chat.type === 'channel'
            ? await channelRepository.removeReaction(messageId, reaction)
            : await chatRepository.removeReaction(messageId, reaction)
        setMessages((prev) =>
          prev.map((msg) => (msg.raw.id === messageId ? { ...msg, raw: { ...msg.raw, reactions: serverReactions } } : msg)),
        )
      } catch {
        // При ошибке сервер пришлёт message_reactions_updated через WS
      }
    },
    [activeChat?.chat.type, channelRepository, chatRepository, currentUser],
  )

  const toggleMessageSelection = useCallback((messageId: string, additive = false) => {
    setSelectedMessages((prev) => {
      if (!additive) {
        if (prev.ids.length === 1 && prev.ids[0] === messageId) {
          return { ids: [], anchorId: null }
        }

        return { ids: [messageId], anchorId: messageId }
      }

      const exists = prev.ids.includes(messageId)
      const nextIds = exists ? prev.ids.filter((id) => id !== messageId) : [...prev.ids, messageId]
      return {
        ids: nextIds,
        anchorId: nextIds.length === 0 ? null : messageId,
      }
    })
    setMessageActionError('')
  }, [])

  const getMessageById = useCallback(
    (messageId: string) => messages.find((message) => message.raw.id === messageId) ?? null,
    [messages],
  )

  const openMessageContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>, messageId: string) => {
    if (activeChatId === 'smart-agent') {
      event.preventDefault()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setMessageActionError('')

    const targetMsg = getMessageById(messageId)
    const isOwner = targetMsg?.raw.senderId === currentUser?.id

    // Estimate menu height based on visible items
    let estimatedHeight = 160 // Base height (reactions + padding + select)
    if (canManageChannelPosts) {
      estimatedHeight += 42 * 3 // Admin actions (Pin, Reply, Delete)
      if (isOwner) {
        estimatedHeight += 42 * 2 // Owner actions (Viewers, Edit)
      }
    }
    if (targetMsg?.attachment?.url || targetMsg?.raw.attachmentUrl) {
      estimatedHeight += 42 // Download action
    }

    const menuWidth = 220
    const menuHeight = estimatedHeight

    const x = Math.max(12, Math.min(event.clientX, window.innerWidth - menuWidth - 12))
    let y = event.clientY
    if (y + menuHeight > window.innerHeight - 12) {
      y = Math.max(12, event.clientY - menuHeight)
    }

    setMessageContextMenu({
      messageId,
      x,
      y,
    })
  }, [activeChatId, canManageChannelPosts, currentUser?.id, getMessageById])

  const scrollToMessageById = useCallback((messageId: string) => {
    const targetNode = messageItemRefs.current[messageId]
    if (targetNode) {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return true
    }

    return false
  }, [])

  const flashSearchMessageHighlight = useCallback((messageId: string) => {
    if (highlightedSearchMessageTimeoutRef.current) {
      clearTimeout(highlightedSearchMessageTimeoutRef.current)
    }

    setHighlightedSearchMessageId(messageId)
    highlightedSearchMessageTimeoutRef.current = setTimeout(() => {
      setHighlightedSearchMessageId((current) => (current === messageId ? null : current))
      highlightedSearchMessageTimeoutRef.current = null
    }, 2200)
  }, [])

  const handleChatSearchResultClick = useCallback(
    (messageId: string) => {
      setSelectedChatSearchResultId(messageId)
      setChatSearchError('')

      if (loadedMessageIds.has(messageId) && scrollToMessageById(messageId)) {
        setChatSearchInfo('')
        flashSearchMessageHighlight(messageId)
        return
      }

      setChatSearchInfo('Точный переход к найденному сообщению текущий API пока не поддерживает, если оно еще не загружено в историю.')
    },
    [flashSearchMessageHighlight, loadedMessageIds, scrollToMessageById],
  )

  const handlePinnedMessageClick = useCallback(() => {
    if (!activePinnedMessage) {
      return
    }

    const targetMessageId = activePinnedMessage.messageId
    scrollToMessageById(targetMessageId)

    if (pinnedMessages.length > 1) {
      setActivePinnedIndex((prev) => (prev === pinnedMessages.length - 1 ? 0 : prev + 1))
    }
  }, [activePinnedMessage, pinnedMessages.length, scrollToMessageById])

  const handlePinnedListItemClick = useCallback(
    (messageId: string, index: number) => {
      setIsPinnedMessagesPanelOpen(false)
      setActivePinnedIndex(index)
      scrollToMessageById(messageId)
    },
    [scrollToMessageById],
  )

  const handleMessageLeftClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, messageId: string) => {
      if (selectedMessages.ids.length === 0) {
        return
      }

      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'button, a, input, textarea, video, audio, [role="button"], [data-no-message-select="true"]',
        )
      ) {
        return
      }

      toggleMessageSelection(messageId, true)
    },
    [selectedMessages.ids.length, toggleMessageSelection],
  )

  useEffect(() => {
    if (!messageContextMenu) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-message-context-menu="true"]')) {
        return
      }

      setMessageContextMenu(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMessageContextMenu(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [messageContextMenu])

  useEffect(() => {
    if (!chatListContextMenu) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-chat-list-context-menu="true"]')) {
        return
      }

      setChatListContextMenu(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChatListContextMenu(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [chatListContextMenu])

  const removeMessagesFromState = useCallback((messageIds: string[]) => {
    const removed = new Set(messageIds)
    setMessages((prev) => prev.filter((message) => !removed.has(message.raw.id)))
    setPinnedMessages((prev) => prev.filter((message) => !removed.has(message.messageId)))
    setResolvedPinnedMessageViews((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([messageId]) => !removed.has(messageId))),
    )
    setSelectedMessages((prev) => ({
      ids: prev.ids.filter((id) => !removed.has(id)),
      anchorId: prev.anchorId && removed.has(prev.anchorId) ? null : prev.anchorId,
    }))
  }, [])

  const loadPinnedMessages = useCallback(async (chatId: string, chatType: ChatType) => {
    try {
      const nextPinnedMessages = await chatRepository.getPinnedMessages(chatId, chatType)
      setPinnedMessages(nextPinnedMessages)
      setResolvedPinnedMessageViews({})
    } catch {
      setPinnedMessages([])
      setResolvedPinnedMessageViews({})
    }
  }, [chatRepository])

  const handleDeleteSelectedMessages = useCallback(async () => {
    const targetIds = deleteTargetMessageIds ?? selectedMessageViews.map((message) => message.raw.id)
    if (targetIds.length === 0) {
      return
    }

    setIsMessageActionLoading(true)
    setMessageActionError('')

    try {
      if (activeChat?.chat.type === 'channel') {
        await Promise.all(targetIds.map((id) => channelRepository.deletePost(id)))
      } else if (targetIds.length === 1) {
        await chatRepository.deleteMessage(targetIds[0])
      } else {
        await chatRepository.deleteMessages(targetIds)
      }

      removeMessagesFromState(targetIds)
      setIsDeleteConfirmOpen(false)
      setDeleteTargetMessageIds(null)
    } catch (actionError) {
      setMessageActionError(actionError instanceof Error ? actionError.message : 'Не удалось удалить сообщения')
    } finally {
      setIsMessageActionLoading(false)
    }
  }, [activeChat?.chat.type, channelRepository, chatRepository, deleteTargetMessageIds, removeMessagesFromState, selectedMessageViews])

  const handleEditSelectedMessage = useCallback((messageId?: string) => {
    const targetMessage = messageId ? getMessageById(messageId) : selectedMessage
    if (!targetMessage) {
      return
    }

    setEditTargetMessageId(targetMessage.raw.id)
    setEditDraft(targetMessage.text)
    setIsEditModalOpen(true)
  }, [getMessageById, selectedMessage])

  const confirmEditSelectedMessage = useCallback(async () => {
    if (!editTargetMessage) {
      return
    }

    if (!editDraft.trim() || editDraft.trim() === editTargetMessage.text.trim()) {
      setIsEditModalOpen(false)
      setEditTargetMessageId(null)
      return
    }

    setIsMessageActionLoading(true)
    setMessageActionError('')

    try {
      const editedContent = editDraft.trim()
      if (activeChat?.chat.type === 'channel') {
        await channelRepository.editPost(editTargetMessage.raw.id, editedContent)
      } else {
        await chatRepository.editMessage(editTargetMessage.raw.id, editedContent)
      }
      setMessages((prev) =>
        prev.map((message) =>
          message.raw.id === editTargetMessage.raw.id
            ? {
                ...message,
                text: editedContent,
                raw: {
                  ...message.raw,
                  content: editedContent,
                  isEdited: true,
                  editedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              }
            : message,
        ),
      )
      updateChatPreviewForEditedMessage(editTargetMessage.raw.id, editedContent, true)
      setIsEditModalOpen(false)
      setEditTargetMessageId(null)
    } catch (actionError) {
      setMessageActionError(actionError instanceof Error ? actionError.message : 'Не удалось изменить сообщение')
    } finally {
      setIsMessageActionLoading(false)
    }
  }, [activeChat?.chat.type, channelRepository, chatRepository, editDraft, editTargetMessage, updateChatPreviewForEditedMessage])
  const handleTogglePinMessage = useCallback(async (messageId?: string) => {
    const targetMessage = messageId ? getMessageById(messageId) : selectedMessage
    if (!activeChat || !targetMessage) {
      return
    }

    setIsMessageActionLoading(true)
    setMessageActionError('')

    try {
      if (activeChat.chat.type === 'channel') {
        await channelRepository.pinPost(targetMessage.raw.id, !pinnedMessageIds.has(targetMessage.raw.id))
      } else if (pinnedMessageIds.has(targetMessage.raw.id)) {
        await chatRepository.unpinMessage(activeChat.chat.id, activeChat.chat.type, targetMessage.raw.id)
      } else {
        await chatRepository.pinMessage(activeChat.chat.id, activeChat.chat.type, targetMessage.raw.id)
      }

      await loadPinnedMessages(activeChat.chat.id, activeChat.chat.type)
    } catch (actionError) {
      setMessageActionError(actionError instanceof Error ? actionError.message : 'Не удалось обновить закреп')
    } finally {
      setIsMessageActionLoading(false)
    }
  }, [activeChat, channelRepository, chatRepository, getMessageById, loadPinnedMessages, pinnedMessageIds, selectedMessage])

  const handleUnpinAllPinnedMessages = useCallback(async () => {
    if (!activeChat || pinnedMessages.length === 0) {
      return
    }

    setIsMessageActionLoading(true)
    setMessageActionError('')

    try {
      await Promise.all(
        pinnedMessages.map((pinned) =>
          chatRepository.unpinMessage(activeChat.chat.id, activeChat.chat.type, pinned.messageId),
        ),
      )

      await loadPinnedMessages(activeChat.chat.id, activeChat.chat.type)
      setIsPinnedMessagesPanelOpen(false)
    } catch (actionError) {
      setMessageActionError(actionError instanceof Error ? actionError.message : 'Не удалось открепить все сообщения')
    } finally {
      setIsMessageActionLoading(false)
    }
  }, [activeChat, chatRepository, loadPinnedMessages, pinnedMessages])

  const handleLoadMessageViewers = useCallback(async (messageId?: string) => {
    const targetMessage = messageId ? getMessageById(messageId) : selectedMessage
    if (!targetMessage) {
      return
    }

    setIsMessageActionLoading(true)
    setMessageActionError('')

    try {
      const viewers =
        activeChat?.chat.type === 'channel'
          ? await channelRepository.getPostViewers(targetMessage.raw.id)
          : await chatRepository.getMessageViewers(targetMessage.raw.id)
      setMessageViewers(viewers)
      setIsViewersModalOpen(true)
    } catch (actionError) {
      setMessageActionError(actionError instanceof Error ? actionError.message : 'Не удалось загрузить прочитавших')
    } finally {
      setIsMessageActionLoading(false)
    }
  }, [activeChat?.chat.type, channelRepository, chatRepository, getMessageById, selectedMessage])

  const downloadMessageAsset = useCallback((targetMessage: MessageView | null) => {
    if (!targetMessage) {
      return
    }

    const downloadUrl =
      targetMessage.attachment?.url ?? targetMessage.audioUrl ?? targetMessage.videoUrl ?? targetMessage.mediaUrl ?? targetMessage.raw.attachmentUrl
    if (!downloadUrl) {
      setMessageActionError('У сообщения нет файла для скачивания')
      return
    }

    const link = document.createElement('a')
    link.href = downloadUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.download = targetMessage.attachment?.filename ?? ''
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [])

  const handleDownloadSelectedMessage = useCallback((messageId?: string) => {
    const targetMessage = messageId ? getMessageById(messageId) : selectedMessage
    downloadMessageAsset(targetMessage)
  }, [downloadMessageAsset, getMessageById, selectedMessage])

  const openImageViewer = useCallback((message: MessageView) => {
    if (!message.mediaUrl) {
      return
    }

    setOpenedImageMessageId(message.raw.id)
  }, [])

  const closeImageViewer = useCallback(() => {
    setOpenedImageMessageId(null)
  }, [])

  const openVideoViewer = useCallback((message: MessageView) => {
    if (!message.videoUrl) {
      return
    }

    setOpenedVideoMessageId(message.raw.id)
  }, [])

  const closeVideoViewer = useCallback(() => {
    setOpenedVideoMessageId(null)
  }, [])

  const showPreviousImage = useCallback(() => {
    setOpenedImageMessageId((current) => {
      if (!current || imageMessages.length <= 1) {
        return current
      }

      const currentIndex = imageMessages.findIndex((message) => message.raw.id === current)
      if (currentIndex < 0) {
        return current
      }

      const nextIndex = currentIndex === 0 ? imageMessages.length - 1 : currentIndex - 1
      return imageMessages[nextIndex]?.raw.id ?? current
    })
  }, [imageMessages])

  const showNextImage = useCallback(() => {
    setOpenedImageMessageId((current) => {
      if (!current || imageMessages.length <= 1) {
        return current
      }

      const currentIndex = imageMessages.findIndex((message) => message.raw.id === current)
      if (currentIndex < 0) {
        return current
      }

      const nextIndex = currentIndex === imageMessages.length - 1 ? 0 : currentIndex + 1
      return imageMessages[nextIndex]?.raw.id ?? current
    })
  }, [imageMessages])

  useEffect(() => {
    if (!openedImageMessage && !openedVideoMessage) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeImageViewer()
        closeVideoViewer()
        return
      }

      if (!openedImageMessage) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        showPreviousImage()
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        showNextImage()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeImageViewer, closeVideoViewer, openedImageMessage, openedVideoMessage, showNextImage, showPreviousImage])

  const loadMessages = useCallback(
    async (chatId: string, chatType: ChatType) => {
      if (!currentUserRef.current) {
        return
      }

      const requestId = historyRequestIdRef.current + 1
      historyRequestIdRef.current = requestId
      setIsLoadingMessages(true)
      setIsLoadingOlderMessages(false)
      isLoadingOlderMessagesRef.current = false
      setSendError('')
      setHistoryError('')
      setPendingNewMessagesCount(0)
      setHistoryOffset(0)
      historyOffsetRef.current = 0
      setHasMoreHistory(false)
      hasMoreHistoryRef.current = false
      setIsAtBottom(true)
      isAtBottomRef.current = true
      lastMarkedReadMessageIdByChatRef.current[chatId] = ''

      try {
        let page: { messages: ChatMessage[]; count: number }
        if (chatType === 'channel') {
          const posts = await channelRepository.getPosts(chatId, { limit: CHAT_HISTORY_PAGE_SIZE, offset: 0 })
          page = {
            messages: posts.map(
              (post) =>
                 ({
                  id: post.id,
                  conversationId: post.channelId,
                  senderId: post.authorId,
                  replyToId: null,
                  content: post.content || '',
                  contentHash: '',
                  encryptedKeys: {},
                  type: resolveMessageTypeFromAttachment(post.attachmentType),
                  attachmentUrl: post.attachmentUrl,
                  attachmentType: post.attachmentType,
                  attachmentSize: post.attachmentSize,
                  metadata: post.metadata,
                  isEdited: false,
                  isForwarded: false,
                  originalSenderId: null,
                  isDeleted: false,
                  createdAt: post.createdAt,
                  updatedAt: post.updatedAt,
                  editedAt: null,
                  isEphemeral: false,
                  ttlSeconds: null,
                  expiresAt: null,
                  senderUsername: '',
                  senderFullName: post.authorName,
                  senderAvatar: null,
                  originalSenderFullName: null,
                  readByCount: 0,
                  deliveredCount: 0,
                  isRead: post.isViewed,
                  reactions: post.reactions || [],
                }) as ChatMessage,
            ),
            count: posts.length,
          }
        } else if (chatType === 'group') {
          page = await chatRepository.getGroupMessages(chatId, { limit: CHAT_HISTORY_PAGE_SIZE, offset: 0 })
        } else if (chatId === 'smart-agent') {
          setMessages(smartAgentMessages)
          setIsLoadingMessages(false)
          return
        } else {
          page = await chatRepository.getConversationMessages(chatId, { limit: CHAT_HISTORY_PAGE_SIZE, offset: 0 })
        }

        if (historyRequestIdRef.current !== requestId) {
          return
        }

        const ordered = page.messages.slice().reverse()
        const nextMessages = await Promise.all(
          ordered.map((message) => toMessageView(message, currentUserRef.current!.id, cryptoRef.current)),
        )

        if (historyRequestIdRef.current !== requestId) {
          return
        }

        const nextOffset = page.count
        const nextHasMoreHistory = page.count === CHAT_HISTORY_PAGE_SIZE
        pendingPrependScrollRef.current = null
        pendingMessagesScrollBehaviorRef.current = 'auto'
        setMessages(nextMessages)
        setHistoryOffset(nextOffset)
        historyOffsetRef.current = nextOffset
        setHasMoreHistory(nextHasMoreHistory)
        hasMoreHistoryRef.current = nextHasMoreHistory
        if (page.messages[0]) {
          await updateChatPreview(page.messages[0])
        }
      } catch (loadError) {
        if (historyRequestIdRef.current !== requestId) {
          return
        }

        setMessages([])
        setHistoryOffset(0)
        historyOffsetRef.current = 0
        setHasMoreHistory(false)
        hasMoreHistoryRef.current = false
        setSendError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить историю')
      } finally {
        if (historyRequestIdRef.current === requestId) {
          setIsLoadingMessages(false)
        }
      }
    },
    [channelRepository, chatRepository, updateChatPreview, smartAgentMessages],
  )

  useEffect(() => {
    loadPinnedMessagesRef.current = loadPinnedMessages
  }, [loadPinnedMessages])

  useEffect(() => {
    loadMessagesRef.current = loadMessages
  }, [loadMessages])

  const loadOlderMessages = useCallback(async () => {
    const activeChatIdValue = activeChatRef.current
    const current = currentUserRef.current
    const scroller = messagesScrollerRef.current
    if (
      !activeChatIdValue ||
      !current ||
      !scroller ||
      isLoadingMessages ||
      isLoadingOlderMessagesRef.current ||
      !hasMoreHistoryRef.current
    ) {
      return
    }

    const chat = chatsRef.current.find((item) => item.chat.id === activeChatIdValue)
    if (!chat || chat.isDraft) {
      return
    }

    const requestId = historyRequestIdRef.current
    const previousScrollHeight = scroller.scrollHeight
    const previousScrollTop = scroller.scrollTop

    setIsLoadingOlderMessages(true)
    isLoadingOlderMessagesRef.current = true
    setHistoryError('')

    try {
      let page: { messages: ChatMessage[]; count: number }
      if (chat.chat.type === 'channel') {
        const posts = await channelRepository.getPosts(chat.chat.id, {
          limit: CHAT_HISTORY_PAGE_SIZE,
          offset: historyOffsetRef.current,
        })
        page = {
          messages: posts.map(
            (post) =>
              ({
                id: post.id,
                conversationId: post.channelId,
                senderId: post.authorId,
                replyToId: null,
                content: post.content || '',
                contentHash: '',
                encryptedKeys: {},
                type: resolveMessageTypeFromAttachment(post.attachmentType),
                attachmentUrl: post.attachmentUrl,
                attachmentType: post.attachmentType,
                attachmentSize: post.attachmentSize,
                metadata: post.metadata,
                isEdited: false,
                isForwarded: false,
                originalSenderId: null,
                isDeleted: false,
                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
                editedAt: null,
                isEphemeral: false,
                ttlSeconds: null,
                expiresAt: null,
                senderUsername: '',
                senderFullName: post.authorName,
                senderAvatar: null,
                originalSenderFullName: null,
                readByCount: 0,
                deliveredCount: 0,
                isRead: post.isViewed,
                reactions: post.reactions || [],
              }) as ChatMessage,
          ),
          count: posts.length,
        }
      } else if (chat.chat.type === 'group') {
        page = await chatRepository.getGroupMessages(chat.chat.id, {
          limit: CHAT_HISTORY_PAGE_SIZE,
          offset: historyOffsetRef.current,
        })
      } else {
        page = await chatRepository.getConversationMessages(chat.chat.id, {
          limit: CHAT_HISTORY_PAGE_SIZE,
          offset: historyOffsetRef.current,
        })
      }

      if (historyRequestIdRef.current !== requestId || activeChatRef.current !== chat.chat.id) {
        return
      }

      const ordered = page.messages.slice().reverse()
      const olderMessages = await Promise.all(
        ordered.map((message) => toMessageView(message, current.id, cryptoRef.current)),
      )

      if (historyRequestIdRef.current !== requestId || activeChatRef.current !== chat.chat.id) {
        return
      }

      pendingPrependScrollRef.current = {
        scrollHeight: previousScrollHeight,
        scrollTop: previousScrollTop,
      }
      setMessages((prev) => prependMessageViews(prev, olderMessages))

      const nextOffset = historyOffsetRef.current + page.count
      const nextHasMoreHistory = page.count === CHAT_HISTORY_PAGE_SIZE
      setHistoryOffset(nextOffset)
      historyOffsetRef.current = nextOffset
      setHasMoreHistory(nextHasMoreHistory)
      hasMoreHistoryRef.current = nextHasMoreHistory
    } catch (loadError) {
      if (historyRequestIdRef.current !== requestId || activeChatRef.current !== chat.chat.id) {
        return
      }

      setHistoryError(loadError instanceof Error ? loadError.message : 'Не удалось догрузить историю')
    } finally {
      if (historyRequestIdRef.current === requestId && activeChatRef.current === chat.chat.id) {
        setIsLoadingOlderMessages(false)
        isLoadingOlderMessagesRef.current = false
      }
    }
  }, [channelRepository, chatRepository, isLoadingMessages])

  const handleMessagesScroll = useCallback(() => {
    const scroller = messagesScrollerRef.current
    const chatId = activeChatRef.current

    if (!scroller || !chatId) {
      return
    }

    const nextIsAtBottom = isScrolledNearBottom(scroller)
    if (nextIsAtBottom !== isAtBottomRef.current) {
      isAtBottomRef.current = nextIsAtBottom
      setIsAtBottom(nextIsAtBottom)
    }

    if (nextIsAtBottom) {
      setPendingNewMessagesCount(0)
    }

    if (scroller.scrollTop <= CHAT_HISTORY_TOP_THRESHOLD && hasMoreHistoryRef.current && !isLoadingOlderMessagesRef.current) {
      void loadOlderMessages()
    }

    scheduleVisibleReadSync(chatId, activeChat?.chat.type ?? 'personal', messagesRef.current)
  }, [activeChat?.chat.type, loadOlderMessages, scheduleVisibleReadSync])

  useEffect(() => {
    void loadChats()
  }, [loadChats])

  useEffect(() => {
    if (!activeChatId) {
      historyRequestIdRef.current += 1
      setMessages([])
      setPinnedMessages([])
      setHistoryOffset(0)
      historyOffsetRef.current = 0
      setHasMoreHistory(false)
      hasMoreHistoryRef.current = false
      setIsLoadingOlderMessages(false)
      isLoadingOlderMessagesRef.current = false
      setPendingNewMessagesCount(0)
      setHistoryError('')
      setIsAtBottom(true)
      isAtBottomRef.current = true
      clearSelectedMessages()
      return
    }

    if (activeChatId === 'smart-agent') {
      clearSelectedMessages()
      setPinnedMessages([])
      setHistoryOffset(0)
      historyOffsetRef.current = 0
      setHasMoreHistory(false)
      hasMoreHistoryRef.current = false
      setIsLoadingOlderMessages(false)
      isLoadingOlderMessagesRef.current = false
      setPendingNewMessagesCount(0)
      setHistoryError('')
      setIsAtBottom(true)
      isAtBottomRef.current = true
      void loadMessages('smart-agent', 'personal')
      return
    }

    const selectedChat =
      chatsRef.current.find((item) => item.chat.id === activeChatId) ??
      (activeChat?.chat.type === 'channel' && channelDetails?.isSubscribed ? activeChat : null)

    if (!selectedChat) {
      historyRequestIdRef.current += 1
      setMessages([])
      setPinnedMessages([])
      setHistoryOffset(0)
      historyOffsetRef.current = 0
      setHasMoreHistory(false)
      hasMoreHistoryRef.current = false
      setIsLoadingOlderMessages(false)
      isLoadingOlderMessagesRef.current = false
      setPendingNewMessagesCount(0)
      setHistoryError('')
      setIsAtBottom(true)
      isAtBottomRef.current = true
      clearSelectedMessages()
      return
    }

    if (selectedChat.isDraft) {
      historyRequestIdRef.current += 1
      setMessages([])
      setPinnedMessages([])
      setHistoryOffset(0)
      historyOffsetRef.current = 0
      setHasMoreHistory(false)
      hasMoreHistoryRef.current = false
      setIsLoadingOlderMessages(false)
      isLoadingOlderMessagesRef.current = false
      setPendingNewMessagesCount(0)
      setHistoryError('')
      setIsAtBottom(true)
      isAtBottomRef.current = true
      clearSelectedMessages()
      setIsLoadingMessages(false)
      return
    }

    clearSelectedMessages()
    void loadPinnedMessages(selectedChat.chat.id, selectedChat.chat.type)

    void loadMessages(selectedChat.chat.id, selectedChat.chat.type)
    // We purposely omit 'activeChat' from the dependency array because loadMessages 
    // updates the 'chats' state, which in turn recalculates 'activeChat' via useMemo.
    // Including it would create an infinite loop of message loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeChatId,
    channelDetails?.isSubscribed,
    clearSelectedMessages,
    loadMessages,
    loadPinnedMessages,
  ])

  useEffect(() => {
    if (!activeChatId || activeChat?.isDraft || messages.length === 0) {
      return
    }

    scheduleVisibleReadSync(activeChatId, activeChat?.chat.type ?? 'personal', messages)
  }, [activeChat?.chat.type, activeChat?.isDraft, activeChatId, messages, scheduleVisibleReadSync])

  const clearTypingIndicator = useCallback((chatId: string) => {
    const timeoutId = typingTimeoutsRef.current[chatId]
    if (timeoutId) {
      clearTimeout(timeoutId)
      delete typingTimeoutsRef.current[chatId]
    }

    setTypingByChat((prev) => {
      if (!prev[chatId]) {
        return prev
      }

      const next = { ...prev }
      delete next[chatId]
      return next
    })
  }, [])

  const resolveTypingLabel = useCallback((chatId: string, senderId: number): string => {
    const chat = chatsRef.current.find((item) => item.chat.id === chatId)

    if (chat?.chat.type === 'personal') {
      return chat.title
    }

    const knownSender = [...messagesRef.current].reverse().find((message) => message.raw.senderId === senderId)?.senderLabel
    if (knownSender) {
      return knownSender
    }

    if (chat?.chat.peerId === senderId) {
      return chat.title
    }

    return 'Кто-то'
  }, [])

  const setTypingIndicator = useCallback(
    (chatId: string, senderId: number) => {
      setTypingByChat((prev) => ({
        ...prev,
        [chatId]: {
          senderId,
          label: resolveTypingLabel(chatId, senderId),
        },
      }))

      const existingTimeout = typingTimeoutsRef.current[chatId]
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      typingTimeoutsRef.current[chatId] = setTimeout(() => {
        clearTypingIndicator(chatId)
      }, 3000)
    },
    [clearTypingIndicator, resolveTypingLabel],
  )

  const sendTypingState = useCallback((nextIsTyping: boolean) => {
    const socket = socketRef.current
    const current = currentUserRef.current
    const chatId = activeChatRef.current

    if (!socket || socket.readyState !== WebSocket.OPEN || !current || !chatId) {
      return
    }

    socket.send(
      JSON.stringify({
        type: 'typing',
        from: current.id,
        conversation_id: chatId,
        content: {
          is_typing: nextIsTyping,
        },
        timestamp: Date.now(),
      }),
    )
  }, [])

  const scheduleTypingStop = useCallback(() => {
    if (outgoingTypingStopTimeoutRef.current) {
      clearTimeout(outgoingTypingStopTimeoutRef.current)
    }

    outgoingTypingStopTimeoutRef.current = setTimeout(() => {
      if (outgoingTypingChatRef.current) {
        sendTypingState(false)
        outgoingTypingChatRef.current = null
      }
    }, 1500)
  }, [sendTypingState])

  const adjustMessageComposerHeight = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) {
      return
    }
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, MESSAGE_COMPOSER_MAX_HEIGHT_PX)}px`
  }, [])

  const clearMessageComposerField = useCallback(() => {
    messageDraftRef.current = ''
    const el = messageInputRef.current
    if (el) {
      el.value = ''
      adjustMessageComposerHeight(el)
    }
    setMentionCaretIndex(0)
    setInput('')
  }, [adjustMessageComposerHeight])

  const handleComposerInput = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      const el = event.currentTarget
      const v = el.value
      const c = el.selectionStart ?? v.length
      messageDraftRef.current = v
      adjustMessageComposerHeight(el)

      const epoch = composerSyncEpochRef.current

      const flushComposerState = () => {
        startTransition(() => {
          if (composerSyncEpochRef.current !== epoch) {
            return
          }
          setInput(v)
          setMentionCaretIndex(c)
        })
      }

      const chatId = activeChatRef.current
      if (!chatId) {
        flushComposerState()
        return
      }

      if (!v.trim()) {
        if (scheduleTypingStopRafRef.current !== null) {
          cancelAnimationFrame(scheduleTypingStopRafRef.current)
          scheduleTypingStopRafRef.current = null
        }

        if (outgoingTypingChatRef.current) {
          sendTypingState(false)
          outgoingTypingChatRef.current = null
        }

        if (outgoingTypingStopTimeoutRef.current) {
          clearTimeout(outgoingTypingStopTimeoutRef.current)
          outgoingTypingStopTimeoutRef.current = null
        }

        flushComposerState()
        return
      }

      if (outgoingTypingChatRef.current !== chatId) {
        sendTypingState(true)
        outgoingTypingChatRef.current = chatId
      }

      if (scheduleTypingStopRafRef.current !== null) {
        cancelAnimationFrame(scheduleTypingStopRafRef.current)
      }
      scheduleTypingStopRafRef.current = requestAnimationFrame(() => {
        scheduleTypingStopRafRef.current = null
        scheduleTypingStop()
      })

      flushComposerState()
    },
    [adjustMessageComposerHeight, scheduleTypingStop, sendTypingState],
  )

  const handleInputTyping = useCallback(
    (nextValue: string) => {
      const chatId = activeChatRef.current
      if (!chatId) {
        return
      }

      if (!nextValue.trim()) {
        if (scheduleTypingStopRafRef.current !== null) {
          cancelAnimationFrame(scheduleTypingStopRafRef.current)
          scheduleTypingStopRafRef.current = null
        }

        if (outgoingTypingChatRef.current) {
          sendTypingState(false)
          outgoingTypingChatRef.current = null
        }

        if (outgoingTypingStopTimeoutRef.current) {
          clearTimeout(outgoingTypingStopTimeoutRef.current)
          outgoingTypingStopTimeoutRef.current = null
        }

        return
      }

      if (outgoingTypingChatRef.current !== chatId) {
        sendTypingState(true)
        outgoingTypingChatRef.current = chatId
      }

      if (scheduleTypingStopRafRef.current !== null) {
        cancelAnimationFrame(scheduleTypingStopRafRef.current)
      }
      scheduleTypingStopRafRef.current = requestAnimationFrame(() => {
        scheduleTypingStopRafRef.current = null
        scheduleTypingStop()
      })
    },
    [scheduleTypingStop, sendTypingState],
  )

  const applyMentionSuggestion = useCallback(
    (member: ChatGroupMember) => {
      const el = messageInputRef.current
      if (!el) {
        return
      }

      const raw = el.value
      const mentionContext = getMentionContext(raw, mentionCaretIndex)
      if (!mentionContext) {
        return
      }

      const mentionName = member.username || `user${member.id}`
      const nextValue = `${raw.slice(0, mentionContext.start)}@${mentionName} ${raw.slice(mentionContext.end)}`
      const nextCaret = mentionContext.start + mentionName.length + 2

      el.value = nextValue
      messageDraftRef.current = nextValue
      adjustMessageComposerHeight(el)
      handleInputTyping(nextValue)
      const epoch = composerSyncEpochRef.current
      startTransition(() => {
        if (composerSyncEpochRef.current !== epoch) {
          return
        }
        setInput(nextValue)
        setMentionCaretIndex(nextCaret)
      })

      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(nextCaret, nextCaret)
      })
    },
    [adjustMessageComposerHeight, handleInputTyping, mentionCaretIndex],
  )

  const insertEmojiIntoInput = useCallback(
    (emoji: string) => {
      const el = messageInputRef.current
      if (!el) {
        return
      }

      const fallbackCaret = Math.min(mentionCaretIndex, el.value.length)
      const selectionStart = el.selectionStart
      const selectionEnd = el.selectionEnd
      const start = typeof selectionStart === 'number' ? selectionStart : fallbackCaret
      const end = typeof selectionEnd === 'number' ? selectionEnd : fallbackCaret
      const nextValue = `${el.value.slice(0, start)}${emoji}${el.value.slice(end)}`
      const nextCaret = start + emoji.length

      el.value = nextValue
      messageDraftRef.current = nextValue
      adjustMessageComposerHeight(el)
      handleInputTyping(nextValue)
      const epoch = composerSyncEpochRef.current
      startTransition(() => {
        if (composerSyncEpochRef.current !== epoch) {
          return
        }
        setInput(nextValue)
        setMentionCaretIndex(nextCaret)
      })

      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(nextCaret, nextCaret)
      })
    },
    [adjustMessageComposerHeight, handleInputTyping, mentionCaretIndex],
  )

  const stopOutgoingTyping = useCallback(() => {
    if (outgoingTypingStopTimeoutRef.current) {
      clearTimeout(outgoingTypingStopTimeoutRef.current)
      outgoingTypingStopTimeoutRef.current = null
    }

    if (outgoingTypingChatRef.current) {
      sendTypingState(false)
      outgoingTypingChatRef.current = null
    }
  }, [sendTypingState])

  const requestSocketReconnect = useCallback((immediate = false) => {
    if (socketReconnectTimerRef.current) {
      clearTimeout(socketReconnectTimerRef.current)
      socketReconnectTimerRef.current = null
    }

    const runReconnect = () => {
      socketReconnectTimerRef.current = null
      setSocketReconnectNonce((prev) => prev + 1)
    }

    if (immediate) {
      socketReconnectAttemptsRef.current = 0
      runReconnect()
      return
    }

    socketReconnectAttemptsRef.current += 1
    const exponent = Math.max(0, socketReconnectAttemptsRef.current - 1)
    const delayMs = Math.min(1000 * 2 ** exponent, 10000)
    socketReconnectTimerRef.current = setTimeout(runReconnect, delayMs)
  }, [])

  useEffect(() => {
    const recoverSocketIfNeeded = () => {
      const socket = socketRef.current
      const isAlive = socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)

      if (isAlive) {
        return
      }

      requestSocketReconnect(true)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recoverSocketIfNeeded()
      }
    }

    window.addEventListener('online', recoverSocketIfNeeded)
    window.addEventListener('focus', recoverSocketIfNeeded)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('online', recoverSocketIfNeeded)
      window.removeEventListener('focus', recoverSocketIfNeeded)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [requestSocketReconnect])

  useEffect(() => {
    const accessToken = sessionStore.getTokens()?.accessToken

    if (!accessToken || !currentUser) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const webDeviceId = webDeviceStore.getCurrentDeviceId()
    const socketQuery = new URLSearchParams({
      token: accessToken,
    })

    if (webDeviceId) {
      socketQuery.set('web_device_id', webDeviceId)
    }

    const socket = new WebSocket(`${protocol}://${window.location.host}/api/v1/ws?${socketQuery.toString()}`)
    socketRef.current = socket
    let disposed = false

    socket.onopen = () => {
      if (disposed) {
        socket.close()
        return
      }

      socketReconnectAttemptsRef.current = 0
      if (socketReconnectTimerRef.current) {
        clearTimeout(socketReconnectTimerRef.current)
        socketReconnectTimerRef.current = null
      }
    }

    socket.onerror = () => {
      // In case of connection error (potentially 401), try to refresh session
      if (socketReconnectAttemptsRef.current === 0) {
        void refreshSessionWithLock(sessionStore).catch(() => undefined)
      }
    }

    socket.onmessage = (event) => {
      void (async () => {
        try {
          const payload = JSON.parse(event.data) as {
            type?: string
            content?: unknown
            message_id?: string
            from?: number
            conversation_id?: string
          }

          console.log('[Messenger WS] Received payload:', payload)

          if (shouldReloadMessengerChatList(payload.type)) {
            console.log('[Messenger WS] Triggering loadChats from direct WS handler for event type:', payload.type)
            void loadChats({ silent: true })
          }

          if (payload.type === 'initial_online_list') {
            const nextOnlineUserIds = new Set<number>(
              (Array.isArray(payload.content) ? payload.content : []).filter((value): value is number => typeof value === 'number'),
            )
            setOnlineUserIds(nextOnlineUserIds)
            setChats((prev) =>
              prev.map((item) => ({
                ...item,
                online: item.chat.peerId ? nextOnlineUserIds.has(item.chat.peerId) : false,
              })),
            )
            return
          }

          if (payload.type === 'user_status') {
            const userStatus =
              typeof payload.content === 'object' && payload.content ? (payload.content as any) : null
            const userId =
              typeof userStatus?.user_id === 'number' ? userStatus.user_id : typeof payload.from === 'number' ? payload.from : null
            const nextStatus = userStatus?.status
            const lastSeenAt = userStatus?.last_seen_at

            if (userId !== null && (nextStatus === 'online' || nextStatus === 'offline')) {
              setOnlineUserIds((prev) => {
                const next = new Set(prev)
                if (nextStatus === 'online') {
                  next.add(userId)
                } else {
                  next.delete(userId)
                }
                return next
              })
              setChats((prev) =>
                prev.map((item) =>
                  item.chat.peerId === userId
                    ? {
                        ...item,
                        online: nextStatus === 'online',
                        chat: {
                          ...item.chat,
                          lastSeenAt: nextStatus === 'offline' && lastSeenAt ? lastSeenAt : item.chat.lastSeenAt,
                        },
                      }
                    : item,
                ),
              )
            }
            return
          }

          if (payload.type === 'read_receipt' && payload.message_id) {
            const current = currentUserRef.current
            if (!current) {
              return
            }

            setMessages((prev) => {
              const boundaryIndex = prev.findIndex((message) => message.raw.id === payload.message_id)
              if (boundaryIndex === -1) {
                return prev
              }

              return prev.map((message, index) =>
                index <= boundaryIndex && message.raw.senderId === current.id
                  ? {
                      ...message,
                      status: 'read',
                      raw: {
                        ...message.raw,
                        isRead: true,
                      },
                    }
                  : message,
              )
            })
            return
          }

          if (
            payload.type === 'typing' &&
            payload.conversation_id &&
            typeof payload.from === 'number' &&
            payload.from !== currentUserRef.current?.id &&
            typeof payload.content === 'object' &&
            payload.content
          ) {
            const typingContent = payload.content as { is_typing?: boolean }

            if (typingContent.is_typing) {
              setTypingIndicator(payload.conversation_id, payload.from)
            } else {
              clearTypingIndicator(payload.conversation_id)
            }
            return
          }

          if (payload.type === 'message_deleted' && payload.message_id) {
            setMessages((prev) =>
              prev.map((message) =>
                message.raw.id === payload.message_id
                  ? {
                      ...message,
                      text: 'Сообщение удалено',
                      raw: {
                        ...message.raw,
                        isDeleted: true,
                      },
                    }
                  : message,
              ),
            )
            return
          }

          if (payload.type === 'message_edited' && typeof payload.content === 'object' && payload.content) {
            const edited = payload.content as { id?: string; content?: string; is_edited?: boolean }

            if (edited.id && typeof edited.content === 'string') {
              const editedContent = edited.content
              setMessages((prev) => {
                void Promise.all(
                  prev.map(async (message) => {
                    if (message.raw.id !== edited.id) {
                      return message
                    }

                    const updatedRaw: ChatMessage = {
                      ...message.raw,
                      content: editedContent,
                      isEdited: edited.is_edited ?? true,
                      editedAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    }
                    const resolved = await resolveMessageText(updatedRaw, cryptoRef.current)

                    return {
                      ...message,
                      text: resolved.text,
                      unavailable: resolved.unavailable,
                      raw: updatedRaw,
                    }
                  }),
                ).then((next) => {
                  setMessages(next)
                })

                return prev
              })
              updateChatPreviewForEditedMessage(edited.id, editedContent, edited.is_edited ?? true)
            }
            return
          }

          if (payload.type === 'new_message' && payload.content && typeof payload.content === 'object') {
            const payloadContent = payload.content as Parameters<typeof toChatMessage>[0] & { is_mention?: boolean }
            const rawMessage = toChatMessage(payloadContent)
            const current = currentUserRef.current
            const isMention = Boolean(payloadContent.is_mention)

            if (!current) {
              return
            }

            const messageView = await toMessageView(rawMessage, current.id, cryptoRef.current)
            clearTypingIndicator(rawMessage.conversationId)
            await updateChatPreview(rawMessage)

            setChats((prev) =>
              prev.map((item) =>
                item.chat.id === rawMessage.conversationId
                  ? {
                      ...item,
                      unread:
                        activeChatRef.current === item.chat.id
                          ? 0
                          : rawMessage.senderId === current.id
                            ? item.unread
                            : item.unread + 1,
                      chat: {
                        ...item.chat,
                        unreadCount:
                          activeChatRef.current === item.chat.id
                            ? 0
                            : rawMessage.senderId === current.id
                              ? item.chat.unreadCount
                              : item.chat.unreadCount + 1,
                        mentionCount:
                          activeChatRef.current === item.chat.id
                            ? 0
                            : rawMessage.senderId === current.id
                              ? item.chat.mentionCount
                              : item.chat.mentionCount + (isMention ? 1 : 0),
                      },
                    }
                  : item,
              ),
            )

            if (activeChatRef.current === rawMessage.conversationId) {
              const shouldStickToBottom = isAtBottomRef.current
              if (shouldStickToBottom) {
                stickChatToBottom(rawMessage.senderId === current.id ? 'auto' : 'smooth')
              }

              setMessages((prev) => appendMessageViews(prev, [messageView]))

              if (rawMessage.senderId !== current.id) {
                if (shouldStickToBottom) {
                  setPendingNewMessagesCount(0)
                } else {
                  setPendingNewMessagesCount((prev) => prev + 1)
                }
              }
            }
          }

          if (payload.type === 'new_channel_post' && payload.content && typeof payload.content === 'object') {
            const socketData = payload.content as { channel_id: string; payload: ChannelPostViewDto }
            const post = socketData.payload
            
            const current = currentUserRef.current
            if (!current) return

            // If it's our own post, we already faked it in sendChatPayload
            // or we might want to prioritize the server's version for ID/timestamp
            // We use appendMessageViews which deduplicates by ID.

            const rawMessage: ChatMessage = {
              id: post.id,
              conversationId: post.channel_id,
              senderId: post.author_id,
              replyToId: null,
              content: post.content || '',
              contentHash: '',
              encryptedKeys: {},
              type: resolveMessageTypeFromAttachment(post.attachment_type || null),
              attachmentUrl: post.attachment_url || null,
              attachmentType: post.attachment_type || null,
              attachmentSize: post.attachment_size || null,
              metadata: post.metadata || null,
              isEdited: false,
              isForwarded: false,
              originalSenderId: null,
              isDeleted: false,
              createdAt: post.created_at,
              updatedAt: post.updated_at,
              editedAt: null,
              isEphemeral: false,
              ttlSeconds: null,
              expiresAt: null,
              senderUsername: '',
              senderFullName: post.author_name,
              senderAvatar: post.author_avatar || null,
              originalSenderFullName: null,
              readByCount: 0,
              deliveredCount: 0,
              isRead: post.is_viewed,
              reactions: (post.reactions ?? []).map((r) => ({
                reaction: r.reaction,
                count: r.count,
                users: (r.users ?? []).map((u) => ({
                  id: u.id,
                  fullName: u.full_name,
                  avatar: normalizeBackendAssetUrl(u.avatar) ?? u.avatar ?? null,
                })),
                reacted: r.reacted,
              })),
            }

             const messageView = await toMessageView(rawMessage, current.id, cryptoRef.current)

            // Update myChannels state
            setMyChannels((prev) =>
              prev.map((ch) =>
                ch.id === post.channel_id ? { ...ch, lastPost: toChannelPost(post), updatedAt: post.created_at } : ch
              )
            )

            setChats((prev) =>
              prev.map((item) =>
                item.chat.id === post.channel_id
                  ? {
                      ...item,
                      unread:
                        activeChatRef.current === item.chat.id
                          ? 0
                          : post.author_id === current.id
                            ? item.unread
                            : item.unread + 1,
                      chat: {
                        ...item.chat,
                        unreadCount:
                          activeChatRef.current === item.chat.id
                            ? 0
                            : post.author_id === current.id
                              ? item.chat.unreadCount
                              : item.chat.unreadCount + 1,
                      },
                    }
                  : item,
              ),
            )

            // Update unified chats list
            await updateChatPreview(rawMessage)

            if (activeChatRef.current === post.channel_id) {
              const shouldStickToBottom = isAtBottomRef.current
              if (shouldStickToBottom) {
                stickChatToBottom(post.author_id === current.id ? 'auto' : 'smooth')
              }
              setMessages((prev) => appendMessageViews(prev, [messageView]))
              if (post.author_id !== current.id) {
                if (shouldStickToBottom) {
                  setPendingNewMessagesCount(0)
                } else {
                  setPendingNewMessagesCount((prev) => prev + 1)
                }
              }
            }
          }

          // Реакции: полностью заменяем локальный массив реакций данными с сервера
          if (payload.type === 'message_reactions_updated' && typeof payload.content === 'object' && payload.content) {
            const reactionUpdate = payload.content as {
              message_id?: string
              reactions?: Array<{
                reaction: string
                count: number
                users: Array<{ id: number; full_name: string; avatar?: string | null }>
                reacted: boolean
              }>
            }

            if (reactionUpdate.message_id && Array.isArray(reactionUpdate.reactions)) {
              const updatedReactions = reactionUpdate.reactions.map((r) => ({
                reaction: r.reaction,
                count: r.count,
                users: (r.users ?? []).map((u) => ({
                  id: u.id,
                  fullName: u.full_name,
                  avatar: u.avatar ?? null,
                })),
                reacted: r.reacted,
              }))

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.raw.id === reactionUpdate.message_id
                    ? { ...msg, raw: { ...msg.raw, reactions: updatedReactions } }
                    : msg,
                ),
              )
            }
            return
          }

          if (payload.type === 'pinned_messages_updated' && payload.conversation_id) {
            const chatId = payload.conversation_id
            const chatContent = typeof payload.content === 'object' && payload.content ? (payload.content as any) : null
            const chatType = chatContent?.chat_type

            if (activeChatRef.current === chatId && chatType) {
              void loadPinnedMessagesRef.current?.(chatId, chatType)
            }
            return
          }
        } catch {
          return
        }
      })()
    }

    socket.onclose = (event) => {
      if (disposed) {
        return
      }

      const reason = (event.reason ?? '').toLowerCase()
      const authLikeCode = [1008, 4001, 4003, 4401, 4403].includes(event.code)
      const authLikeReason =
        reason.includes('unauthor') || reason.includes('token') || reason.includes('session') || reason.includes('forbidden')

      if (authLikeCode || authLikeReason) {
        dispatchAuthSessionExpired({
          reason: 'device_rotation',
          message: 'Текущая web-сессия была завершена или вытеснена другим входом. Войдите снова.',
        })
        return
      }

      requestSocketReconnect(document.visibilityState === 'visible')
    }

    return () => {
      disposed = true
      if (socketRef.current === socket) {
        socketRef.current = null
      }
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null

      if (socket.readyState === WebSocket.OPEN) {
        socket.close()
      }
    }
  }, [
    clearTypingIndicator,
    currentUser,
    requestSocketReconnect,
    sessionStore,
    setTypingIndicator,
    socketReconnectNonce,
    updateChatPreview,
    updateChatPreviewForEditedMessage,
    stickChatToBottom,
    webDeviceStore,
  ])

  useEffect(() => {
    return () => {
      if (socketReconnectTimerRef.current) {
        clearTimeout(socketReconnectTimerRef.current)
        socketReconnectTimerRef.current = null
      }
      if (scheduleTypingStopRafRef.current !== null) {
        cancelAnimationFrame(scheduleTypingStopRafRef.current)
        scheduleTypingStopRafRef.current = null
      }
    }
  }, [])

  useLayoutEffect(() => {
    composerSyncEpochRef.current += 1
    messageDraftRef.current = ''
    setInput('')
    setMentionCaretIndex(0)
    const el = messageInputRef.current
    if (el) {
      el.value = ''
      adjustMessageComposerHeight(el)
    }
  }, [activeChatId, adjustMessageComposerHeight])

  useEffect(() => {
    stopOutgoingTyping()
  }, [activeChatId, stopOutgoingTyping])

  useEffect(() => {
    setIsEmojiPickerOpen(false)
  }, [activeChatId, isRecordingAnyMedia])

  useEffect(() => {
    if (activeMentionContext) {
      setIsEmojiPickerOpen(false)
    }
  }, [activeMentionContext])

  const sendChatPayload = useCallback(async (payload: { 
    content: string; 
    type: MessageType; 
    clearInput?: boolean; 
    metadata?: string | null;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
    attachmentSize?: number | null;
    replyToId?: string | null;
    contentHash?: string | null;
    keys?: Record<string, string>;
  }) => {
    if (!activeChat || !currentUser || isSending) {
      return
    }

    setIsSending(true)
    setSendError('')

    try {
      let targetChatId = activeChat.chat.id
      let payloadContent = payload.content
      let payloadHash: string | undefined
      let payloadKeys: Record<string, string> | undefined

      if (activeChat.isDraft) {
        if (!activeChat.chat.peerId) {
          throw new Error('РЈ draft-чата не найден peer_id.')
        }

        const createdConversation = await chatRepository.createConversation(activeChat.chat.peerId)
        targetChatId = createdConversation.id
        setActiveChatId(createdConversation.id)
        setChats((prev) =>
          prev.map((item) =>
            item.chat.id === activeChat.chat.id
              ? {
                  ...item,
                  isDraft: false,
                  chat: {
                    ...item.chat,
                    id: createdConversation.id,
                  },
                }
              : item,
          ),
        )
      }

      if (activeChat.chat.type === 'personal') {
        if (cryptoRef.current?.privateKey && activeChat.chat.peerId) {
          try {
            // Fetch public keys for both peer and ourselves
            const [peerKeys, ownKeys] = await Promise.all([
              chatRepository.getUserPublicKeys(activeChat.chat.peerId),
              chatRepository.getUserPublicKeys(currentUser?.id ?? 0),
            ])

            const allRecipientKeys = {
              ...(peerKeys.keys || {}),
              ...(ownKeys.keys || {}),
            }

            if (Object.keys(allRecipientKeys).length > 0) {
              console.log(
                '[Messenger E2EE] Encrypting for devices:',
                Object.keys(allRecipientKeys),
              )
              const encrypted = await encryptChatContent(payload.content, allRecipientKeys)
              payloadContent = encrypted.content
              payloadHash = encrypted.contentHash
              payloadKeys = encrypted.keys
            } else {
              console.warn('[Messenger E2EE] No public keys found for E2EE, sending plaintext fallback')
            }
          } catch (err) {
            console.error('[Messenger] Failed to encrypt personal chat content:', err)
            // Fallback to unencrypted if encryption fails (or handle as error)
          }
        }
      }

      if (activeChat.chat.type === 'channel') {
        const sent = await channelRepository.createPost({
          channelId: targetChatId,
          content: payload.attachmentUrl ? payload.content : (payload.type === 'text' ? payload.content : undefined),
          attachmentUrl: payload.attachmentUrl || (payload.type !== 'text' ? payload.content : undefined),
          attachmentType: payload.attachmentType || (payload.type !== 'text' ? payload.type : undefined),
          attachmentSize: payload.attachmentSize || undefined,
          metadata: payload.metadata ?? null,
        })

        // Fake the message result for UI update if needed, or better, use the post data
        const fakeSent: ChatMessage = {
          id: sent.id,
          conversationId: targetChatId,
          senderId: currentUser.id,
          replyToId: null,
          content: sent.content || '',
          contentHash: '',
          encryptedKeys: {},
          type: resolveMessageTypeFromAttachment(sent.attachmentType),
          attachmentUrl: sent.attachmentUrl,
          attachmentType: sent.attachmentType,
          attachmentSize: sent.attachmentSize,
          metadata: sent.metadata,
          isEdited: false,
          isForwarded: false,
          originalSenderId: null,
          isDeleted: false,
          createdAt: sent.createdAt,
          updatedAt: sent.updatedAt,
          editedAt: null,
          isEphemeral: false,
          ttlSeconds: null,
          expiresAt: null,
          senderUsername: '',
          senderFullName: currentUser.name,
          senderAvatar: null,
          originalSenderFullName: null,
          readByCount: 0,
          deliveredCount: 0,
          isRead: true,
          reactions: [],
        }

        stopOutgoingTyping()
        if (payload.clearInput) {
          clearMessageComposerField()
        }
        setReplyTarget(null)

        const view = await toMessageView(fakeSent, currentUser.id, cryptoRef.current)
        stickChatToBottom('auto')
        setMessages((prev) => appendMessageViews(prev, [view]))
        await updateChatPreview(fakeSent)
        playOutgoingMessageSound()
        setIsSending(false)
        return
      }

      const sent = await chatRepository.sendMessage({
        chatId: targetChatId,
        chatType: activeChat.chat.type,
        content: payloadContent,
        contentHash: payloadHash,
        keys: payloadKeys,
        type: payload.type,
        metadata: payload.metadata ?? null,
        attachmentUrl: payload.attachmentUrl,
        attachmentType: payload.attachmentType,
        attachmentSize: payload.attachmentSize,
        replyToId: payload.replyToId ?? replyTarget?.id ?? null,
      })

      stopOutgoingTyping()
      clearTypingIndicator(targetChatId)
      const nextMessage = await toMessageView(sent, currentUser.id, cryptoState)
      stickChatToBottom('auto')
      setMessages((prev) => appendMessageViews(prev, [nextMessage]))
      if (payload.clearInput ?? false) {
        clearMessageComposerField()
      }
      setReplyTarget(null)
      await updateChatPreview(sent)
      clearChatBadges(targetChatId)
      playOutgoingMessageSound()
    } catch (sendMessageError) {
      setSendError(sendMessageError instanceof Error ? sendMessageError.message : 'Не удалось отправить сообщение')
    } finally {
      setIsSending(false)
    }
  }, [activeChat, channelRepository, chatRepository, clearChatBadges, clearMessageComposerField, clearTypingIndicator, cryptoState, currentUser, isSending, replyTarget, stopOutgoingTyping, stickChatToBottom, updateChatPreview])


  const sendSmartAgentMessage = useCallback(async (messageText?: string, displayText?: string) => {
    const composerRaw = messageText ?? (messageInputRef.current?.value ?? messageDraftRef.current ?? '')
    const userMessageText = composerRaw.trim()
    if (!userMessageText || isSmartAgentLoading) return

    if (!messageText) {
      clearMessageComposerField()
    }

    const formatTime = (iso: string) => {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const textToShow = displayText ?? userMessageText

    const userMsg: MessageView = {
      raw: toChatMessage({
        id: `sa-user-${Date.now()}`,
        sender_id: currentUser?.id || 0,
        content: textToShow,
        type: 'text',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        conversation_id: 'smart-agent',
      }),
      from: 'me',
      text: textToShow,
      time: formatTime(new Date().toISOString()),
      kind: 'text',
      senderLabel: 'Вы',
      isCall: false,
      status: 'read',
      unavailable: false,
    }

    stickChatToBottom('auto')
    setSmartAgentMessages(prev => [...prev, userMsg])
    setMessages(prev => [...prev, userMsg])
    setIsSmartAgentLoading(true)

    try {
      const response = await smartAgentRepository.chat({
        message: userMessageText,
        session_id: smartAgentSessionId,
        conversation_history: smartAgentHistory,
      })

      if (response.session_id) {
        setSmartAgentSessionId(response.session_id)
      }

      if (Array.isArray(response.conversation_history)) {
        setSmartAgentHistory(response.conversation_history)
      }

      const historyEntries = Array.isArray(response.conversation_history)
        ? response.conversation_history
            .map((entry) => {
              if (!entry || typeof entry !== 'object') {
                return null
              }

              const role = typeof (entry as { role?: unknown }).role === 'string'
                ? (entry as { role: string }).role.trim().toLowerCase()
                : ''
              const content = typeof (entry as { content?: unknown }).content === 'string'
                ? (entry as { content: string }).content
                : ''
              const createdAt = typeof (entry as { created_at?: unknown }).created_at === 'string'
                ? (entry as { created_at: string }).created_at
                : new Date().toISOString()

              if (!content.trim() || (role !== 'user' && role !== 'assistant')) {
                return null
              }

              return { role, content, createdAt }
            })
            .filter((entry): entry is { role: 'user' | 'assistant'; content: string; createdAt: string } => Boolean(entry))
        : []

      if (historyEntries.length > 0) {
        const lastAssistantIndex = (() => {
          for (let index = historyEntries.length - 1; index >= 0; index -= 1) {
            if (historyEntries[index].role === 'assistant') {
              return index
            }
          }

          return -1
        })()

        const nextMessages = historyEntries.map((entry, index): MessageView => {
          const isUserEntry = entry.role === 'user'
          const metadata =
            !isUserEntry && index === lastAssistantIndex && response.widget
              ? JSON.stringify(response.widget)
              : null

          return {
            raw: toChatMessage({
              id: `sa-history-${Date.now()}-${index}`,
              sender_id: isUserEntry ? (currentUser?.id || 0) : -1,
              content: entry.content,
              type: 'text',
              created_at: entry.createdAt,
              updated_at: entry.createdAt,
              conversation_id: 'smart-agent',
              metadata,
            }),
            from: isUserEntry ? 'me' : 'them',
            text: entry.content,
            time: formatTime(entry.createdAt),
            kind: 'text',
            senderLabel: isUserEntry ? 'Вы' : 'Smart Agent',
            isCall: false,
            status: 'read',
            unavailable: false,
          }
        })

        stickChatToBottom('auto')
        setSmartAgentMessages(nextMessages)
        setMessages(nextMessages)
        return
      }

      const aiMsg: MessageView = {
        raw: toChatMessage({
          id: `sa-ai-${Date.now()}`,
          sender_id: -1,
          content: response.reply,
          type: 'text',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          conversation_id: 'smart-agent',
          metadata: response.widget ? JSON.stringify(response.widget) : null,
        }),
        from: 'them',
        text: response.reply,
        time: formatTime(new Date().toISOString()),
        kind: 'text',
        senderLabel: 'Smart Agent',
        isCall: false,
        status: 'read',
        unavailable: false,
      }

      stickChatToBottom('auto')
      setSmartAgentMessages(prev => [...prev, aiMsg])
      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      setSendError(getErrorMessage(err, 'Ошибка Smart Agent'))
    } finally {
      setIsSmartAgentLoading(false)
    }
  }, [clearMessageComposerField, isSmartAgentLoading, smartAgentRepository, smartAgentSessionId, smartAgentHistory, setSmartAgentHistory, currentUser, setMessages, setSmartAgentMessages, stickChatToBottom])

  const sendMessage = useCallback(async () => {
    const composerRaw = messageInputRef.current?.value ?? messageDraftRef.current ?? ''
    if (!composerRaw.trim() && !attachmentToUpload && attachmentsToUpload.length === 0) {
      return
    }

    if (activeChatId === 'smart-agent') {
      await sendSmartAgentMessage()
      return
    }

    setIsSending(true)

    try {
      let attachmentParams: {
        attachmentUrl?: string
        attachmentType?: string
        attachmentSize?: number
        type?: MessageType
      } = {}

      let extraMetadata: Record<string, any> = {}

      if (attachmentsToUpload.length > 0) {
        if (attachmentsToUpload.length === 1) {
          const file = attachmentsToUpload[0]
          const selection = classifyAttachmentFile(file)
          const uploaded = await chatRepository.uploadFile(file, selection.uploadType)
          attachmentParams = {
            attachmentUrl: uploaded.url,
            attachmentType: selection.mime,
            attachmentSize: file.size,
            type: selection.messageType,
          }
        } else {
          const uploadPromises = attachmentsToUpload.map(async (file) => {
            const selection = classifyAttachmentFile(file)
            const uploaded = await chatRepository.uploadFile(file, selection.uploadType)
            return {
              url: uploaded.url,
              type: selection.mime,
              size: file.size,
              name: file.name,
            }
          })
          const uploadedFiles = await Promise.all(uploadPromises)

          const first = uploadedFiles[0]
          attachmentParams = {
            attachmentUrl: first.url,
            attachmentType: first.type,
            attachmentSize: first.size,
            type: 'image',
          }
          extraMetadata.gallery = uploadedFiles
        }
      } else if (attachmentToUpload) {
        const selection = classifyAttachmentFile(attachmentToUpload)
        const uploaded = await chatRepository.uploadFile(attachmentToUpload, selection.uploadType)
        attachmentParams = {
          attachmentUrl: uploaded.url,
          attachmentType: selection.mime,
          attachmentSize: attachmentToUpload.size,
          type: selection.messageType,
        }
      }

      let metadata: string | null = null
      if (activeChat?.chat.type === 'group') {
        const memberUsernames = new Set(activeGroupMembers.map((member) => member.username).filter(Boolean))
        const mentions = Array.from(
          new Set(
            [...composerRaw.matchAll(/(^|\s)@([a-zA-Z0-9._-]+)/g)]
              .map((match) => match[2])
              .filter((username): username is string => Boolean(username) && memberUsernames.has(username)),
          ),
        )

        if (mentions.length > 0) {
          metadata = JSON.stringify({ mentions, ...extraMetadata })
        } else if (Object.keys(extraMetadata).length > 0) {
          metadata = JSON.stringify(extraMetadata)
        }
      } else if (activeChat?.chat.type === 'personal' && activeChat.chat.peerUsername) {
        const peer = activeChat.chat.peerUsername
        const escaped = peer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        let mentions: string[] = []
        if (new RegExp(`(^|\\s)@${escaped}(?=[\\s,.!?;:]|$)`, 'i').test(composerRaw)) {
          mentions = [peer]
        }
        if (mentions.length > 0) {
          metadata = JSON.stringify({ mentions, ...extraMetadata })
        } else if (Object.keys(extraMetadata).length > 0) {
          metadata = JSON.stringify(extraMetadata)
        }
      } else if (Object.keys(extraMetadata).length > 0) {
        metadata = JSON.stringify(extraMetadata)
      }

      await sendChatPayload({
        content: composerRaw.trim(),
        type: attachmentParams.type || 'text',
        clearInput: true,
        metadata,
        ...attachmentParams,
      })

      // Clear pending attachments after successful send
      setAttachmentToUpload(null)
      setAttachmentPreviewUrl(null)
      setAttachmentsToUpload([])
      setAttachmentPreviewUrls([])
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Не удалось отправить сообщение')
    } finally {
      setIsSending(false)
    }
  }, [activeChat, activeChatId, activeGroupMembers, attachmentToUpload, attachmentsToUpload, chatRepository, sendChatPayload, sendSmartAgentMessage])

  const handleAiProofreadMessage = useCallback(async () => {
    const text = messageInputRef.current?.value || ''
    if (!text.trim()) return
    setIsAiProofreading(true)
    try {
      const res = await alemAiRepository.proofreadNote({ content: text })
      if (res.corrected_text && messageInputRef.current) {
        messageInputRef.current.value = res.corrected_text
        handleComposerInput({ currentTarget: messageInputRef.current } as any)
      }
    } catch (e) {
      console.error('AI Proofread failed', e)
    } finally {
      setIsAiProofreading(false)
    }
  }, [alemAiRepository, handleComposerInput])

  const handleDriveFileSelect = useCallback(async (file: { id: string; name: string; size?: number; mime_type?: string; download_url?: string }) => {
    if (activeChatId === 'smart-agent') {
      setIsDrivePickerOpen(false)
      setSendError('Для Smart Agent отправка файлов из Drive недоступна')
      return
    }

    setIsDrivePickerOpen(false)
    setIsSending(true)
    try {
      // 1. Grant public access (consistent with SendToMessengerModal.jsx logic)
      try {
        await grantPermission(file.id, 'public', 'viewer')
      } catch (permErr) {
        console.warn('Failed to grant public access to drive file', permErr)
      }

      // 2. Prepare metadata and content
      const metadata = JSON.stringify({
        type: 'drive_file',
        fileId: file.id,
        fileName: file.name,
        fileSize: file.size,
        fileMime: file.mime_type,
        fileDownloadUrl: normalizeBackendAssetUrl(file.download_url) ?? file.download_url,
        sharedVia: 'messenger'
      })
      
      const content = `📄 Alem Drive: ${file.name}`

      // 3. Send message payload with metadata
      await sendChatPayload({
        content,
        type: 'text',
        clearInput: false,
        metadata
      })
    } catch (err) {
      console.error('Failed to share drive file', err)
      setSendError('Не удалось отправить файл из Alem Drive')
    } finally {
      setIsSending(false)
    }
  }, [activeChatId, sendChatPayload])

  const handleOpenDriveFile = useCallback((file: { fileId: string; fileName?: string; fileSize?: number; fileMime?: string; fileDownloadUrl?: string }) => {
    const fileId = file.fileId
    const fileName = file.fileName || 'Документ'
    const fileMime = file.fileMime || ''
    const fileDownloadUrl = normalizeBackendAssetUrl(file.fileDownloadUrl) ?? file.fileDownloadUrl
    const lowerName = fileName.toLowerCase()
    const isPreviewable = fileMime.startsWith('image/')
      || fileMime === 'application/pdf'
      || fileMime.startsWith('video/')
      || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|pdf|mp4|mov|webm|avi|mkv|3gp)$/i.test(lowerName)

    if (isPreviewable) {
      navigate(`/drive/editor/${fileId}`, {
        state: {
          file: {
            id: fileId,
            name: fileName,
            mime_type: fileMime,
            size: file.fileSize,
            download_url: fileDownloadUrl,
            downloadUrl: fileDownloadUrl,
          },
          mode: 'view',
        },
      })
      return
    }

    navigate(`/drive/editor/${fileId}`)
  }, [navigate])

  const handleOpenNote = useCallback((noteId: string) => {
    navigate(`/notes?noteId=${noteId}`)
  }, [navigate])



  const handleAttachmentSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || [])
      if (files.length === 0) {
        return
      }

      if (activeChatId === 'smart-agent') {
        setSendError('Для Smart Agent отправка вложений недоступна')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      const validFiles: File[] = []
      const validUrls: string[] = []

      for (const file of files) {
        const selection = classifyAttachmentFile(file)
        if (file.size > selection.maxSizeBytes) {
          setSendError(`Файл "${file.name}" превышает лимит ${selection.limitLabel}.`)
          continue
        }
        validFiles.push(file)
        validUrls.push(URL.createObjectURL(file))
      }

      if (validFiles.length > 0) {
        setAttachmentsToUpload((prev) => [...prev, ...validFiles])
        setAttachmentPreviewUrls((prev) => [...prev, ...validUrls])
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [activeChatId],
  )

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (activeChatId === 'smart-agent') {
        return
      }

      const items = event.clipboardData?.items
      if (!items) return

      const pastedFiles: File[] = []
      const pastedUrls: string[] = []

      for (const item of Array.from(items)) {
        if (item.type.indexOf('image/') !== -1) {
          event.preventDefault()
          const file = item.getAsFile()
          if (!file) continue

          const selection = classifyAttachmentFile(file)
          if (file.size > selection.maxSizeBytes) {
            setSendError(`Файл "${file.name}" превышает лимит ${selection.limitLabel}.`)
            continue
          }

          pastedFiles.push(file)
          pastedUrls.push(URL.createObjectURL(file))
        }
      }

      if (pastedFiles.length > 0) {
        setAttachmentsToUpload((prev) => [...prev, ...pastedFiles])
        setAttachmentPreviewUrls((prev) => [...prev, ...pastedUrls])
      }
    },
    [activeChatId],
  )


  const resetRecordGestureState = useCallback(() => {
    if (recordHoldTimeoutRef.current) {
      clearTimeout(recordHoldTimeoutRef.current)
      recordHoldTimeoutRef.current = null
    }

    if (recordHoldResetTimeoutRef.current) {
      clearTimeout(recordHoldResetTimeoutRef.current)
      recordHoldResetTimeoutRef.current = null
    }

    recordHoldTriggeredRef.current = false
    recordGestureStartYRef.current = null
    recordShouldContinueRef.current = false
    isRecordingLockedRef.current = false
    setIsRecordGestureActive(false)
    setIsRecordLockHintVisible(false)
    setIsRecordingLocked(false)
    setRecordLockProgress(0)
  }, [])

  const cleanupRecordingResources = useCallback(() => {
    resetRecordGestureState()

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    mediaRecorderRef.current = null
    recordedChunksRef.current = []
    setIsRecordingVoice(false)
    setRecordingDurationSeconds(0)
  }, [resetRecordGestureState])

  /* const unusedSendSmartAgentMessage = useCallback(async (overrideText?: string) => {
    const userMessageText = (overrideText ?? input).trim()
    if (!userMessageText || isSmartAgentLoading) return

    if (!overrideText) {
      setInput('')
    }

    const formatTime = (iso: string) => {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const userMsg: MessageView = {
      raw: toChatMessage({
        id: `sa-user-${Date.now()}`,
        sender_id: currentUser?.id || 0,
        content: userMessageText,
        type: 'text',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        conversation_id: 'smart-agent',
      }),
      from: 'me',
      text: userMessageText,
      time: formatTime(new Date().toISOString()),
      kind: 'text',
      senderLabel: 'Вы',
      isCall: false,
      status: 'read',
      unavailable: false,
    }

    setSmartAgentMessages(prev => [...prev, userMsg])
    setMessages(prev => [...prev, userMsg])
    setIsSmartAgentLoading(true)

    try {
      const response = await smartAgentRepository.chat({
        message: userMessageText,
        session_id: smartAgentSessionId,
        conversation_history: [],
      })

      if (response.session_id) {
        setSmartAgentSessionId(response.session_id)
      }

      const aiMsg: MessageView = {
        raw: toChatMessage({
          id: `sa-ai-${Date.now()}`,
          sender_id: -1,
          content: response.reply,
          type: 'text',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          conversation_id: 'smart-agent',
          metadata: response.widget ? JSON.stringify(response.widget) : null,
        }),
        from: 'them',
        text: response.reply,
        time: formatTime(new Date().toISOString()),
        kind: 'text',
        senderLabel: 'Smart Agent',
        isCall: false,
        status: 'read',
        unavailable: false,
      }

      setSmartAgentMessages(prev => [...prev, aiMsg])
      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      setSendError(getErrorMessage(err, 'Ошибка Smart Agent'))
    } finally {
      setIsSmartAgentLoading(false)
    }
  }, [input, isSmartAgentLoading, smartAgentRepository, smartAgentSessionId, currentUser, setMessages, setSmartAgentMessages]) */

  void 0

  const cleanupVideoRecordingResources = useCallback(() => {
    resetRecordGestureState()

    if (videoMessageTimerRef.current) {
      clearInterval(videoMessageTimerRef.current)
      videoMessageTimerRef.current = null
    }

    if (videoMessageStreamRef.current) {
      videoMessageStreamRef.current.getTracks().forEach((track) => track.stop())
      videoMessageStreamRef.current = null
    }

    videoMessageRecorderRef.current = null
    videoMessageChunksRef.current = []
    setIsRecordingVideoMessage(false)
    setVideoRecordingDurationSeconds(0)
  }, [resetRecordGestureState])

  useEffect(() => {
    return () => {
      stopOutgoingTyping()
      Object.values(typingTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId))
      typingTimeoutsRef.current = {}
      if (recordHoldTimeoutRef.current) {
        clearTimeout(recordHoldTimeoutRef.current)
        recordHoldTimeoutRef.current = null
      }
      cleanupRecordingResources()
      cleanupVideoRecordingResources()
    }
  }, [cleanupRecordingResources, cleanupVideoRecordingResources, stopOutgoingTyping])

  const sendVoiceFile = useCallback(
    async (file: File) => {
      if (!activeChat) {
        return
      }

      setSendError('')

      try {
        const uploaded = await chatRepository.uploadFile(file, 'file')
        await sendChatPayload({
          content: uploaded.url,
          type: 'voice',
        })
      } catch (sendVoiceError) {
        setSendError(sendVoiceError instanceof Error ? sendVoiceError.message : 'Не удалось отправить голосовое сообщение')
      }
    },
    [activeChat, chatRepository, sendChatPayload],
  )

  const stopVoiceRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current

    if (!recorder) {
      cleanupRecordingResources()
      return
    }

    if (recorder.state === 'inactive') {
      cleanupRecordingResources()
      return
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type || 'audio/webm' })
        cleanupRecordingResources()
        void sendVoiceFile(file).finally(() => resolve())
      }

      recorder.stop()
    })
  }, [cleanupRecordingResources, sendVoiceFile])

  const startVoiceRecording = useCallback(async () => {
    if (isRecordingVoice || isRecordingVideoMessage || isSending) {
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      if (!recordShouldContinueRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      mediaStreamRef.current = stream

      const preferredMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : ''

      const recorder = preferredMimeType ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recordedChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      recorder.start()
      setIsRecordingVoice(true)
      setRecordingDurationSeconds(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingDurationSeconds((prev) => prev + 1)
      }, 1000)
    } catch (recordingError) {
      cleanupRecordingResources()
      setSendError(recordingError instanceof Error ? recordingError.message : 'Не удалось получить доступ Рє микрофону')
    }
  }, [cleanupRecordingResources, isRecordingVideoMessage, isRecordingVoice, isSending])

  const cancelVoiceRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current

    if (!recorder || recorder.state === 'inactive') {
      cleanupRecordingResources()
      return
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        cleanupRecordingResources()
        resolve()
      }

      recorder.stop()
    })
  }, [cleanupRecordingResources])

  const sendVideoMessageFile = useCallback(
    async (file: File) => {
      setSendError('')

      try {
        const uploaded = await chatRepository.uploadFile(file, 'video_message')
        await sendChatPayload({
          content: uploaded.url,
          type: 'video_message',
        })
      } catch (sendVideoError) {
        setSendError(sendVideoError instanceof Error ? sendVideoError.message : 'Не удалось отправить видеосообщение')
      }
    },
    [chatRepository, sendChatPayload],
  )

  const stopVideoMessageRecording = useCallback(async () => {
    const recorder = videoMessageRecorderRef.current

    if (!recorder) {
      cleanupVideoRecordingResources()
      return
    }

    if (recorder.state === 'inactive') {
      cleanupVideoRecordingResources()
      return
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const fallbackType = recorder.mimeType || 'video/webm'
        const blob = new Blob(videoMessageChunksRef.current, { type: fallbackType })
        const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
        const file = new File([blob], `video-message-${Date.now()}.${extension}`, { type: blob.type || fallbackType })
        cleanupVideoRecordingResources()
        void sendVideoMessageFile(file).finally(() => resolve())
      }

      recorder.stop()
    })
  }, [cleanupVideoRecordingResources, sendVideoMessageFile])

  const startVideoMessageRecording = useCallback(async () => {
    if (isRecordingVideoMessage || isRecordingVoice || isSending) {
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
      })

      if (!recordShouldContinueRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      videoMessageStreamRef.current = stream

      const preferredMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : ''

      const recorder = preferredMimeType ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream)
      videoMessageRecorderRef.current = recorder
      videoMessageChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoMessageChunksRef.current.push(event.data)
        }
      }

      recorder.start()
      setIsRecordingVideoMessage(true)
      setVideoRecordingDurationSeconds(0)
      videoMessageTimerRef.current = setInterval(() => {
        setVideoRecordingDurationSeconds((prev) => prev + 1)
      }, 1000)
    } catch (recordingError) {
      cleanupVideoRecordingResources()
      setSendError(recordingError instanceof Error ? recordingError.message : 'Не удалось получить доступ Рє камере')
    }
  }, [cleanupVideoRecordingResources, isRecordingVideoMessage, isRecordingVoice, isSending])

  const cancelVideoMessageRecording = useCallback(async () => {
    const recorder = videoMessageRecorderRef.current

    if (!recorder || recorder.state === 'inactive') {
      cleanupVideoRecordingResources()
      return
    }

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        cleanupVideoRecordingResources()
        resolve()
      }

      recorder.stop()
    })
  }, [cleanupVideoRecordingResources])

  const startSelectedRecording = useCallback(async () => {
    if (selectedRecorderMode === 'video_message') {
      await startVideoMessageRecording()
      return
    }

    await startVoiceRecording()
  }, [selectedRecorderMode, startVideoMessageRecording, startVoiceRecording])

  const stopActiveRecording = useCallback(async () => {
    if (mediaRecorderRef.current) {
      await stopVoiceRecording()
      return
    }

    if (videoMessageRecorderRef.current) {
      await stopVideoMessageRecording()
      return
    }

    recordShouldContinueRef.current = false
    if (isRecordingLockedRef.current || isRecordGestureActive) {
      resetRecordGestureState()
    }
  }, [isRecordGestureActive, resetRecordGestureState, stopVideoMessageRecording, stopVoiceRecording])

  const cancelActiveRecording = useCallback(async () => {
    if (mediaRecorderRef.current) {
      await cancelVoiceRecording()
      return
    }

    if (videoMessageRecorderRef.current) {
      await cancelVideoMessageRecording()
      return
    }

    recordShouldContinueRef.current = false
    if (isRecordingLockedRef.current || isRecordGestureActive) {
      resetRecordGestureState()
    }
  }, [cancelVideoMessageRecording, cancelVoiceRecording, isRecordGestureActive, resetRecordGestureState])

  const clearRecordHoldTimeout = useCallback(() => {
    if (recordHoldTimeoutRef.current) {
      clearTimeout(recordHoldTimeoutRef.current)
      recordHoldTimeoutRef.current = null
    }
  }, [])

  const scheduleRecordHoldFlagReset = useCallback(() => {
    if (recordHoldResetTimeoutRef.current) {
      clearTimeout(recordHoldResetTimeoutRef.current)
    }

    recordHoldResetTimeoutRef.current = setTimeout(() => {
      recordHoldTriggeredRef.current = false
      recordHoldResetTimeoutRef.current = null
    }, 320)
  }, [])

  const handleRecordGestureMove = useCallback(
    (clientY: number | null) => {
      const startY = recordGestureStartYRef.current
      if (clientY === null || startY === null || isRecordingLockedRef.current) {
        return
      }

      const upwardDistance = Math.max(0, startY - clientY)
      const nextProgress = Math.min(upwardDistance / RECORD_LOCK_THRESHOLD, 1)
      setRecordLockProgress(nextProgress)

      if (upwardDistance >= RECORD_LOCK_THRESHOLD && (recordHoldTriggeredRef.current || isRecordingAnyMedia)) {
        setIsRecordLockHintVisible(true)
        isRecordingLockedRef.current = true
        setIsRecordingLocked(true)
        setIsRecordGestureActive(false)
        recordShouldContinueRef.current = true
        clearRecordHoldTimeout()
      }
    },
    [clearRecordHoldTimeout, isRecordingAnyMedia],
  )

  const handleRecordButtonPressStart = useCallback((clientY: number | null) => {
    if (hasDraftMessage || isSending || isRecordingAnyMedia || isRecordingLockedRef.current) {
      return
    }

    clearRecordHoldTimeout()
    if (recordHoldResetTimeoutRef.current) {
      clearTimeout(recordHoldResetTimeoutRef.current)
      recordHoldResetTimeoutRef.current = null
    }
    recordGestureStartYRef.current = clientY
    recordShouldContinueRef.current = false
    recordHoldTriggeredRef.current = false
    setIsRecordGestureActive(true)
    setRecordLockProgress(0)
    recordHoldTimeoutRef.current = setTimeout(() => {
      recordHoldTriggeredRef.current = true
      recordShouldContinueRef.current = true
      setIsRecordLockHintVisible(true)
      void startSelectedRecording()
    }, 220)
  }, [clearRecordHoldTimeout, hasDraftMessage, isRecordingAnyMedia, isSending, startSelectedRecording])

  const handleRecordButtonPressEnd = useCallback(async () => {
    clearRecordHoldTimeout()
    recordGestureStartYRef.current = null
    const isLockedNow = isRecordingLockedRef.current
    const hasActiveRecorder =
      (mediaRecorderRef.current !== null && mediaRecorderRef.current.state !== 'inactive')
      || (videoMessageRecorderRef.current !== null && videoMessageRecorderRef.current.state !== 'inactive')

    if (!recordHoldTriggeredRef.current) {
      setIsRecordGestureActive(false)
      setRecordLockProgress(0)
      return
    }

    if (isLockedNow) {
      setIsRecordGestureActive(false)
      setRecordLockProgress(1)
      scheduleRecordHoldFlagReset()
      return
    }

    recordShouldContinueRef.current = false
    setIsRecordGestureActive(false)
    setRecordLockProgress(0)

    if (hasActiveRecorder || isRecordingAnyMedia) {
      await stopActiveRecording()
    }
    scheduleRecordHoldFlagReset()
  }, [clearRecordHoldTimeout, isRecordingAnyMedia, scheduleRecordHoldFlagReset, stopActiveRecording])

  useEffect(() => {
    if (!isRecordGestureActive) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      handleRecordGestureMove(event.clientY)
    }

    const handleTouchMove = (event: TouchEvent) => {
      handleRecordGestureMove(event.touches[0]?.clientY ?? null)
    }

    const handleMouseUp = () => {
      void handleRecordButtonPressEnd()
    }

    const handleTouchEnd = () => {
      void handleRecordButtonPressEnd()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [handleRecordButtonPressEnd, handleRecordGestureMove, isRecordGestureActive])

  const createDraftChat = useCallback(
    (user: UserDirectoryUser) => {
      const peerId = user.id

      if (currentUser && peerId === currentUser.id) {
        setSendError('Нельзя создать диалог с самим собой.')
        return
      }

      const existingChat = chats.find((item) => item.chat.type === 'personal' && item.chat.peerId === peerId)

      if (existingChat) {
        setActiveChatId(existingChat.chat.id)
        setShowInfo(false)
        setSendError('')
        setIsUserPickerOpen(false)
        return
      }

      const displayName = user.fullName || user.username || `User ${peerId}`
      const draftId = `draft-${peerId}-${Date.now()}`

      const draftChat: ChatListItem = {
        chat: {
          id: draftId,
          type: 'personal',
          peerId,
          peerUsername: user.username || null,
          peerFullName: displayName,
          peerAvatar: user.avatarUrl,
          lastSeenAt: null,
          groupId: null,
          groupName: null,
          groupAvatar: null,
          channelId: null,
          channelName: null,
          channelAvatar: null,
          aiModel: null,
          aiTitle: null,
          lastMessage: null,
          unreadCount: 0,
          mentionCount: 0,
          isPinned: false,
          isMuted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        title: displayName,
        subtitle: 'Напишите первое сообщение, чтобы создать чат',
        time: '',
        avatar: getInitials(displayName),
        avatarUrl: user.avatarUrl,
        seed: getSeed(displayName),
        online: false,
        unread: 0,
        isDraft: true,
      }

      setChats((prev) => [draftChat, ...prev])
      setMessages([])
      setActiveChatId(draftId)
      setShowInfo(false)
      setSendError('')
      setIsUserPickerOpen(false)
    },
    [chats, currentUser],
  )

  useEffect(() => {
    if (!username || !currentUser) {
      lastResolvedUsernameRef.current = null
      return
    }

    if (username === lastResolvedUsernameRef.current) {
      return
    }

    const resolveIdentifier = async () => {
      lastResolvedUsernameRef.current = username
      const isHandle = username.startsWith('@')
      const cleanIdentifier = isHandle ? username.slice(1) : username
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanIdentifier)
      
      // If it's neither a handle nor a UUID, it's not a valid channel identifier
      if (!isHandle && !isUuid) {
        if (window.location.pathname.startsWith('/messenger/')) {
          navigate('/messenger')
        }
        return
      }

      try {
        if (!isUuid) {
          const directoryUsersList = await userDirectoryRepository.getUsers()
          const matchedUser = directoryUsersList.find(
            (u) => u.username && u.username.toLowerCase() === cleanIdentifier.toLowerCase()
          )

          if (matchedUser) {
            createDraftChat(matchedUser)
            return
          }
        }
      } catch (userErr) {
        console.error('Failed to lookup user in directory', userErr)
      }

      try {
        let channel: ChannelView
        if (isUuid) {
          channel = await channelRepository.getChannel(cleanIdentifier)
        } else {
          channel = await channelRepository.getChannelByUsername(cleanIdentifier)
        }

        setResolvedChannel(channel)
        setActiveChatId(channel.id)
        setFilter((prev) => (prev !== 'all' ? 'channels' : prev))
        setError('')
      } catch (err) {
        console.error('Failed to resolve channel identifier', err)
        setError('Канал не найден или недоступен')
        
        // If resolution fails and we are on a channel-like path, go back to main view
        if (window.location.pathname.startsWith('/messenger/') || window.location.pathname.includes(username)) {
          navigate('/messenger')
        }
      }
    }

    void resolveIdentifier()
  }, [username, currentUser, channelRepository, userDirectoryRepository, createDraftChat, navigate])

  const resetChatCreationModal = useCallback(() => {
    setChatCreationMode('personal')
    setUserSearchQuery('')
    setUserSearchError('')
    setGroupCreateName('')
    setGroupCreateDescription('')
    setSelectedNewGroupMemberIds([])
    setGroupCreateError('')
    setChannelCreateName('')
    setChannelCreateDescription('')
    setChannelCreateUsername('')
    setChannelCreateType('public')
    setChannelCreateError('')
    setChannelCreationStep(1)
    setCreatedChannelId(null)
  }, [])

  const createGroupFromPicker = useCallback(async () => {
    const normalizedName = groupCreateName.trim()
    if (!normalizedName) {
      setGroupCreateError('Введите название группы')
      return
    }

    setIsCreatingGroup(true)
    setGroupCreateError('')

    try {
      const createdGroup = await chatRepository.createGroup({
        name: normalizedName,
        description: groupCreateDescription.trim(),
        type: 'private',
        maxMembers: 200,
      })

      if (selectedNewGroupMemberIds.length > 0) {
        await chatRepository.addGroupMembers(createdGroup.id, selectedNewGroupMemberIds)
      }

      setActiveChatId(createdGroup.id)
      setShowInfo(false)
      setMessages([])
      setIsUserPickerOpen(false)
      resetChatCreationModal()
      await loadChats()
    } catch (error) {
      setGroupCreateError(error instanceof Error ? error.message : 'Не удалось создать группу')
    } finally {
      setIsCreatingGroup(false)
    }
  }, [chatRepository, groupCreateDescription, groupCreateName, loadChats, resetChatCreationModal, selectedNewGroupMemberIds])

  const createChannelFromPicker = useCallback(async () => {
    const normalizedName = channelCreateName.trim()
    if (!normalizedName) {
      setChannelCreateError('Введите название канала')
      return
    }

    if (channelCreateType === 'public') {
      const normalizedUsername = channelCreateUsername.trim()
      if (!normalizedUsername) {
        setChannelCreateError('Введите публичную ссылку для канала')
        return
      }
      if (normalizedUsername.length < 4) {
        setChannelCreateError('Ссылка должна содержать не менее 4 символов')
        return
      }
    }

    setIsCreatingChannel(true)
    setChannelCreateError('')

    try {
      const createdChannel = await channelRepository.createChannel({
        name: normalizedName,
        description: channelCreateDescription.trim(),
        username: channelCreateType === 'public' ? channelCreateUsername.trim() : undefined,
        type: channelCreateType,
      })

      setCreatedChannelId(createdChannel.id)
      setChannelCreationStep(2)
      setSelectedNewGroupMemberIds([]) // Инициализируем пустой список для участников
    } catch (createErr) {
      setChannelCreateError(createErr instanceof Error ? createErr.message : 'Не удалось создать канал')
    } finally {
      setIsCreatingChannel(false)
    }
  }, [channelCreateDescription, channelCreateName, channelCreateType, channelCreateUsername, channelRepository])

  const handleChannelUsernameKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()

    const input = event.currentTarget
    const selectionStart = input.selectionStart ?? channelCreateUsername.length
    const selectionEnd = input.selectionEnd ?? channelCreateUsername.length
    const nextValue = `${channelCreateUsername.slice(0, selectionStart)}_${channelCreateUsername.slice(selectionEnd)}`

    setChannelCreateUsername(nextValue)

    requestAnimationFrame(() => {
      const caretPosition = selectionStart + 1
      input.setSelectionRange(caretPosition, caretPosition)
    })
  }, [channelCreateUsername])

  const finishChannelCreationWithMembers = useCallback(async () => {
    if (!createdChannelId) return

    setIsCreatingChannel(true)
    try {
      if (selectedNewGroupMemberIds.length > 0) {
        await channelRepository.addMembers(createdChannelId, selectedNewGroupMemberIds)
      }

      setActiveChatId(createdChannelId)
      setShowInfo(false)
      setMessages([])
      setIsUserPickerOpen(false)
      resetChatCreationModal()
      await loadChats()
    } catch (err) {
      setChannelCreateError(err instanceof Error ? err.message : 'Ошибка при добавлении участников')
    } finally {
      setIsCreatingChannel(false)
    }
  }, [channelRepository, createdChannelId, loadChats, resetChatCreationModal, selectedNewGroupMemberIds])

  const loadDirectoryUsers = useCallback(
    async () => {
      setIsSearchingUsers(true)
      setUserSearchError('')

      try {
        setDirectoryUsers(await userDirectoryRepository.getUsers())
      } catch (searchError) {
        setDirectoryUsers([])
        setUserSearchError(searchError instanceof Error ? searchError.message : 'Не удалось загрузить пользователей')
      } finally {
        setIsSearchingUsers(false)
      }
    },
    [userDirectoryRepository],
  )

  useEffect(() => {
    if (!isUserPickerOpen) {
      return
    }

    if (directoryUsers.length > 0) {
      return
    }

    void loadDirectoryUsers()
  }, [directoryUsers.length, isUserPickerOpen, loadDirectoryUsers])

  useEffect(() => {
    if (!isAttachMenuOpen) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setIsAttachMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isAttachMenuOpen])


  const openUserProfile = useCallback(
    async (userId: number) => {
      setProfileUserId(userId)
      setProfileUser(null)
      setUserProfileError('')
      setIsUserProfileLoading(false)
      setIsUserProfileModalOpen(true)

      if (isVirtualProfileId(userId)) {
        setProfileUser(buildSmartAssistantProfile())
        setIsUserProfileLoading(false)
        return
      }

      setIsUserProfileLoading(true)

      try {
        const user = await userDirectoryRepository.getUserDetails(userId)
        setProfileUser(user)
      } catch (profileError) {
        setUserProfileError(profileError instanceof Error ? profileError.message : 'Не удалось загрузить профиль пользователя')
      } finally {
        setIsUserProfileLoading(false)
      }
    },
    [userDirectoryRepository],
  )

  const retryOpenUserProfile = useCallback(() => {
    if (profileUserId === null) {
      return
    }

    void openUserProfile(profileUserId)
  }, [openUserProfile, profileUserId])

  const openChatFromProfile = useCallback(() => {
    if (!profileUser) {
      return
    }

    if (profileUser.id <= 0) {
      setActiveChatId('smart-agent')
      setShowInfo(false)
      setIsUserProfileModalOpen(false)
      return
    }

    createDraftChat(profileUser)
    setIsUserProfileModalOpen(false)
  }, [createDraftChat, profileUser])

  const handleSubmitProfileReview = useCallback(async (input: CreateUserReviewInput) => {
    await userDirectoryRepository.submitReview(input)

    if (profileUserId !== input.targetUserId) {
      return
    }

    const refreshedProfile = await userDirectoryRepository.getUserDetails(input.targetUserId)
    setProfileUser(refreshedProfile)
  }, [profileUserId, userDirectoryRepository])

  const startChatListPanelResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isMobileLayout) {
        return
      }

      event.preventDefault()
      chatListResizeStartXRef.current = event.clientX
      chatListResizeStartWidthRef.current = chatListPanelWidth
      setIsChatListPanelResizing(true)
    },
    [chatListPanelWidth, isMobileLayout],
  )

  const handleSelectChat = useCallback((chatId: string) => {
    setActiveChatId(chatId)
    setShowInfo(false)
    setChatListContextMenu(null)
    setChatListActionError('')
  }, [])

  const handleBackToChatList = useCallback(() => {
    setActiveChatId(null)
    setShowInfo(false)
    setIsEmojiPickerOpen(false)
    setMessageContextMenu(null)
    setSelectedMessages({ ids: [], anchorId: null })
    closeChatSearch()
  }, [closeChatSearch])

  if (isLoadingChats) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkMuted }}>
        Загрузка чатов...
      </div>
    )
  }



  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {showChatListPane ? (
      <div
        style={{
          width: showFoldersRail ? chatListPanelWidth : '100%',
          background: '#FFFFFF',
          borderRight: !isMobileLayout ? `1px solid ${C.border}` : 'none',
          display: 'flex',
          flexShrink: 0,
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: showFoldersRail ? CHAT_FOLDERS_RAIL_WIDTH : 0,
            background: '#FFFFFF',
            borderRight: showFoldersRail ? `1px solid ${C.borderLight}` : 'none',
            display: showFoldersRail ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            padding: showFoldersRail ? '12px 10px' : 0,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSelectedFolderId(null)
              setFilter('all')
            }}
            style={{
              width: '100%',
              border: `1px solid ${selectedFolderId === null && filter === 'all' ? '#CFE0F8' : '#E3EAF4'}`,
              background: selectedFolderId === null && filter === 'all' ? '#EEF5FF' : '#FFFFFF',
              borderRadius: 12,
              color: selectedFolderId === null && filter === 'all' ? '#1F6FD1' : '#6D819F',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              padding: '8px 6px 7px',
              boxShadow: 'none',
              transition: 'background 0.14s ease, border-color 0.14s ease, color 0.14s ease',
            }}
          >
            <div style={{ position: 'relative', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MS name="forum" size={28} color={selectedFolderId === null && filter === 'all' ? C.blue : C.inkMuted} />
              {totalUnreadCount > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -10,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    background: C.blue,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 5px',
                    boxShadow: `0 6px 14px ${C.blue}35`,
                  }}
                >
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </span>
              ) : null}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>Все</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedFolderId(null)
              setFilter('groups')
            }}
            style={{
              width: '100%',
              border: `1px solid ${selectedFolderId === null && filter === 'groups' ? '#CFE0F8' : '#E3EAF4'}`,
              background: selectedFolderId === null && filter === 'groups' ? '#EEF5FF' : '#FFFFFF',
              borderRadius: 12,
              color: selectedFolderId === null && filter === 'groups' ? '#1F6FD1' : '#6D819F',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              padding: '8px 6px 7px',
              boxShadow: 'none',
              transition: 'background 0.14s ease, border-color 0.14s ease, color 0.14s ease',
            }}
          >
            <MS name="group" size={28} color={selectedFolderId === null && filter === 'groups' ? C.blue : C.inkMuted} />
            <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>Группы</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilter('channels')
              setSelectedFolderId(null)
            }}
            style={{
              width: '100%',
              border: `1px solid ${selectedFolderId === null && filter === 'channels' ? '#CFE0F8' : '#E3EAF4'}`,
              background: selectedFolderId === null && filter === 'channels' ? '#EEF5FF' : '#FFFFFF',
              borderRadius: 12,
              color: selectedFolderId === null && filter === 'channels' ? '#1F6FD1' : '#6D819F',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              padding: '8px 6px 7px',
              boxShadow: 'none',
              transition: 'background 0.14s ease, border-color 0.14s ease, color 0.14s ease',
            }}
          >
            <MS name="campaign" size={28} color={selectedFolderId === null && filter === 'channels' ? C.blue : C.inkMuted} />
            <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>Каналы</span>
          </button>

          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              setActiveChatId('smart-agent')
              setSelectedFolderId(null)
              setFilter('all')
            }}
            style={{
              width: '100%',
              border: `1px solid ${activeChatId === 'smart-agent' ? `${C.blue}22` : 'transparent'}`,
              background: activeChatId === 'smart-agent' ? '#FFFFFF' : 'transparent',
              borderRadius: 18,
              color: activeChatId === 'smart-agent' ? C.blue : C.inkMuted,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              padding: '10px 6px 8px',
              boxShadow: activeChatId === 'smart-agent' ? '0 8px 20px rgba(10,22,40,0.06)' : 'none',
              transition: 'background 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, color 0.16s ease',
            }}
          >
            <div style={{ position: 'relative', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MS name="smart_toy" size={28} color={activeChatId === 'smart-agent' ? C.blue : '#FF8C00'} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>Smart AI</span>
          </button>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, overflowY: 'auto', paddingTop: 2 }}>
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id
              const folderUnreadCount = folderUnreadCountById[folder.id] ?? 0
              return (
                <div
                  key={folder.id}
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0,
                    padding: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    style={{
                      width: '100%',
                      border: `1px solid ${isSelected ? `${C.blue}22` : 'transparent'}`,
                      background: isSelected ? '#FFFFFF' : 'transparent',
                      borderRadius: 18,
                      color: isSelected ? C.blue : C.inkMuted,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      padding: '10px 6px 8px',
                      boxShadow: isSelected ? '0 8px 20px rgba(10,22,40,0.06)' : 'none',
                      transition: 'background 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, color 0.16s ease',
                    }}
                    title={folder.name}
                  >
                    <div style={{ position: 'relative', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MS name="folder" size={28} color={isSelected ? C.blue : C.inkMuted} />
                      {folderUnreadCount > 0 ? (
                        <span
                          style={{
                            position: 'absolute',
                            top: -6,
                            right: -10,
                            minWidth: 20,
                            height: 20,
                            borderRadius: 10,
                            background: isSelected ? '#2E78F6' : C.blue,
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 5px',
                            boxShadow: `0 6px 14px ${C.blue}35`,
                          }}
                        >
                          {folderUnreadCount > 99 ? '99+' : folderUnreadCount}
                        </span>
                      ) : null}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: 'center',
                        lineHeight: 1.2,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {folder.name}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 'auto', display: 'grid', gap: 10, justifyItems: 'center' }}>
            <button
              type="button"
              onClick={openThemePanel}
              style={{
                width: '100%',
                minHeight: 58,
                borderRadius: 18,
                border: `1px solid ${isThemePanelOpen || hasSavedChatTheme ? `${C.blue}33` : C.border}`,
                background: isThemePanelOpen || hasSavedChatTheme ? '#EEF5FF' : '#FFFFFF',
                color: isThemePanelOpen || hasSavedChatTheme ? C.blue : C.inkMuted,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                cursor: 'pointer',
                boxShadow: isThemePanelOpen || hasSavedChatTheme ? '0 10px 22px rgba(46,120,246,0.12)' : 'none',
                padding: '8px 6px',
                transition: 'background 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, color 0.16s ease',
              }}
              title="Оформление чатов"
            >
              <ThemeSettingsIcon color={isThemePanelOpen || hasSavedChatTheme ? C.blue : C.inkMuted} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  textAlign: 'center',
                }}
              >
                Настройки
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsFolderModalOpen(true)
                setEditingFolderId(null)
                setFolderName('')
                setFolderError('')
                setPendingFolderAssignmentTarget(null)
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                border: `1px dashed ${C.border}`,
                background: '#FFFFFF',
                color: C.inkMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Создать папку"
            >
              <MS name="add" size={18} color={C.inkMuted} />
            </button>
          </div>
        </div>

        <div
          style={{
            width: showFoldersRail ? Math.max(chatListPanelWidth - CHAT_FOLDERS_RAIL_WIDTH, 0) : '100%',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            flexShrink: 0,
            fontFamily: '"Roboto", sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          }}
        >
        <div
          style={{
            padding: isMobileLayout ? '14px 12px 12px' : '18px 16px 14px',
            borderBottom: `1px solid ${C.borderLight}`,
            flexShrink: 0,
            background: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: C.ink, letterSpacing: '-0.018em', lineHeight: 1.15 }}>Сообщения</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  border: `1px solid ${C.borderLight}`,
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxShadow: 'none',
                }}
                onClick={() => {
                  resetChatCreationModal()
                  setIsUserPickerOpen(true)
                }}
                title="Новый чат"
              >
                <MS name="add" size={18} color={C.blue} style={{ transform: 'translateY(0.5px)' }} />
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'linear-gradient(180deg, #F3F7FD 0%, #EEF3FA 100%)',
              border: `1px solid #D7E2F0`,
              borderRadius: 14,
              padding: '0 14px',
              height: 40,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
            }}
          >
            <MS name="search" size={16} color={C.inkMuted} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск чатов"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                fontWeight: 400,
                lineHeight: 1.2,
                letterSpacing: '-0.005em',
                color: C.ink,
                fontFamily: '"Roboto", sans-serif',
              }}
            />
          </div>

          <div style={{ display: isMobileLayout ? 'flex' : 'none', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, flex: 1, minWidth: 0 }}>
              {[
                { key: 'all', label: 'Все' },
                { key: 'personal', label: 'Личные' },
                { key: 'groups', label: 'Группы' },
                { key: 'channels', label: 'Каналы' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setSelectedFolderId(null)
                    setFilter(tab.key as 'all' | 'groups' | 'personal' | 'channels')
                  }}
                  style={{
                    fontSize: 12,
                    fontWeight: selectedFolderId === null && filter === tab.key ? 700 : 600,
                    color: selectedFolderId === null && filter === tab.key ? '#1F6FD1' : '#6D819F',
                    background: selectedFolderId === null && filter === tab.key ? '#EEF5FF' : '#FFFFFF',
                    border: `1px solid ${selectedFolderId === null && filter === tab.key ? '#CFE0F8' : '#E3EAF4'}`,
                    borderRadius: 999,
                    padding: '7px 13px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {tab.label}
                </button>
              ))}

              {folders.map((folder) => {
                const isSelected = selectedFolderId === folder.id
                const folderUnreadCount = folderUnreadCountById[folder.id] ?? 0

                return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    setSelectedFolderId(isSelected ? null : folder.id)
                    if (!isSelected) {
                      setFilter('all')
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: isSelected ? '#EAF3FF' : '#F4F8FF',
                    border: `1px solid ${isSelected ? `${C.blue}44` : C.borderLight}`,
                    color: isSelected ? C.blue : C.ink,
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  <MS name="folder" size={13} color={C.blue} />
                  <span>{folder.name}</span>
                  {folderUnreadCount > 0 ? (
                    <span
                      style={{
                        minWidth: 18,
                        height: 18,
                        padding: '0 5px',
                        borderRadius: 999,
                        background: C.blue,
                        color: '#FFFFFF',
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {folderUnreadCount > 99 ? '99+' : folderUnreadCount}
                    </span>
                  ) : null}
                </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsFolderModalOpen(true)
                setEditingFolderId(null)
                setFolderName('')
                setFolderError('')
                setPendingFolderAssignmentTarget(null)
              }}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: `1px dashed ${C.border}`,
                background: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                color: C.inkMuted,
              }}
              title="Создать папку"
            >
              <MS name="add" size={16} color={C.inkMuted} />
            </button>
          </div>
        </div>

        {error ? (
          <div style={{ padding: 12, fontSize: 12, color: C.red, borderBottom: `1px solid ${C.borderLight}` }}>{error}</div>
        ) : null}
        {chatListActionError ? (
          <div style={{ padding: 12, fontSize: 12, color: C.red, borderBottom: `1px solid ${C.borderLight}`, background: '#FFF8F8' }}>
            {chatListActionError}
          </div>
        ) : null}

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 0, scrollbarGutter: 'stable' }}>
          {isSearchingGlobal && (
            <div style={{ padding: '8px 16px', fontSize: 11, color: C.blue, fontWeight: 700, opacity: 0.8 }}>Поиск в Alem...</div>
          )}
          {allDisplayItems.length === 0 ? (
            <div style={{ padding: 18, fontSize: 12, color: C.inkMuted }}>{selectedFolderId ? 'В этой папке пока нет чатов.' : 'Чаты не найдены.'}</div>
          ) : allDisplayItems.map((item, index) => {
            const previousItem = index > 0 ? allDisplayItems[index - 1] : null
            const showGlobalHeader = item.isGlobal && !previousItem?.isGlobal

            return (
              <React.Fragment key={item.chat.id}>
                {showGlobalHeader ? (
                  <div style={{ padding: '14px 16px 8px', fontSize: 11, fontWeight: 800, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Глобальный поиск
                  </div>
                ) : null}
                <ContactItem
                  item={item}
                  isActive={activeChat?.chat.id === item.chat.id}
                  typingLabel={typingByChat[item.chat.id] ? `${typingByChat[item.chat.id].label} печатает...` : undefined}
                  onClick={() => {
                    handleSelectChat(item.chat.id)
                  }}
                  onContextMenu={item.isDraft ? undefined : (event) => openChatListContextMenu(event, item.chat.id)}
                />
              </React.Fragment>
            )
          })}
        </div>
        </div>
      </div>
      ) : null}

      {!isMobileLayout ? (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину списка чатов"
        onMouseDown={startChatListPanelResize}
        onDoubleClick={() => setChatListPanelWidth(DEFAULT_CHAT_LIST_PANEL_WIDTH)}
        style={{
          width: 10,
          flexShrink: 0,
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          background: isChatListPanelResizing ? 'rgba(36, 117, 255, 0.08)' : 'transparent',
        }}
        title="Потяните, чтобы изменить ширину списка чатов"
      >
        <div
          style={{
            width: 2,
            borderRadius: 999,
            margin: '10px 0',
            background: isChatListPanelResizing ? C.blue : 'rgba(130, 149, 184, 0.38)',
            transition: 'background 0.16s ease',
          }}
        />
      </div>
      ) : null}

      {isUserPickerOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 22, 40, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 400,
          }}
          onClick={() => {
            setIsUserPickerOpen(false)
            resetChatCreationModal()
          }}
        >
          <div
            style={{
              width: 480,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'min(72vh, 640px)',
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              boxShadow: '0 20px 60px rgba(10,22,40,0.18)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>
                    {chatCreationMode === 'channel' && channelCreationStep === 2 ? 'Добавить участников' : 'Новый чат'}
                  </div>
                  <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4 }}>
                    {chatCreationMode === 'channel' && channelCreationStep === 2
                      ? `Канал «${channelCreateName}» создан. Вы можете добавить подписчиков.`
                      : 'Выберите пользователя. Диалог создастся после первого сообщения.'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsUserPickerOpen(false)
                    resetChatCreationModal()
                  }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: `1px solid ${C.borderLight}`,
                    background: C.canvas,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <MS name="close" size={16} color={C.inkMuted} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 20px' }}>
              {chatCreationMode === 'channel' && channelCreationStep === 2 ? null : (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[
                    { key: 'personal', label: 'Личный чат' },
                    { key: 'group', label: 'Группа' },
                    { key: 'channel', label: 'Канал' },
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => {
                        setChatCreationMode(mode.key as 'personal' | 'group' | 'channel')
                        setGroupCreateError('')
                        setChannelCreateError('')
                      }}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 12,
                        border: `1px solid ${chatCreationMode === mode.key ? `${C.blue}33` : C.borderLight}`,
                        background: chatCreationMode === mode.key ? C.blueSoft : C.canvas,
                        color: chatCreationMode === mode.key ? C.blue : C.inkMuted,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              )}

              {chatCreationMode !== 'channel' || channelCreationStep === 2 ? (
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <MS
                    name="search"
                    size={18}
                    color={C.inkMuted}
                    style={{ position: 'absolute', left: 12, top: 12 }}
                  />
                  <input
                    value={userSearchQuery}
                    onChange={(event) => setUserSearchQuery(event.target.value)}
                    placeholder="Поиск людей..."
                    style={{
                      width: '100%',
                      height: 42,
                      borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      background: C.canvas,
                      padding: '0 12px 0 40px',
                      outline: 'none',
                      fontSize: 13,
                      color: C.ink,
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              ) : null}

              {chatCreationMode === 'group' ? (
                <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                  <input
                    value={groupCreateName}
                    onChange={(event) => setGroupCreateName(event.target.value)}
                    placeholder="Название группы"
                    style={{
                      width: '100%',
                      height: 42,
                      borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      background: C.canvas,
                      padding: '0 12px',
                      outline: 'none',
                      fontSize: 13,
                      color: C.ink,
                      fontFamily: 'inherit',
                    }}
                  />
                  <input
                    value={groupCreateDescription}
                    onChange={(event) => setGroupCreateDescription(event.target.value)}
                    placeholder="Описание группы (необязательно)"
                    style={{
                      width: '100%',
                      height: 42,
                      borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      background: C.canvas,
                      padding: '0 12px',
                      outline: 'none',
                      fontSize: 13,
                      color: C.ink,
                      fontFamily: 'inherit',
                    }}
                  />
                  {groupCreateError ? <div style={{ fontSize: 12, color: C.red }}>{groupCreateError}</div> : null}
                </div>
              ) : null}

              {chatCreationMode === 'channel' && channelCreationStep === 1 ? (
                <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { key: 'public', label: 'Публичный', icon: 'public' },
                      { key: 'private', label: 'Закрытый', icon: 'lock' },
                    ].map((type) => (
                      <button
                        key={type.key}
                        type="button"
                        onClick={() => {
                          setChannelCreateType(type.key as 'public' | 'private')
                          if (type.key === 'private') {
                            setChannelCreateUsername('')
                          }
                        }}
                        style={{
                          flex: 1,
                          height: 38,
                          borderRadius: 10,
                          border: `1px solid ${channelCreateType === type.key ? `${C.blue}33` : C.borderLight}`,
                          background: channelCreateType === type.key ? C.blueSoft : C.canvas,
                          color: channelCreateType === type.key ? C.blue : C.inkMuted,
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <MS name={type.icon} size={16} color={channelCreateType === type.key ? C.blue : C.inkMuted} />
                        {type.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: C.inkMuted, lineHeight: 1.4, padding: '0 4px' }}>
                    {channelCreateType === 'public'
                      ? 'Публичные каналы можно найти через поиск, подписаться на них может любой пользователь.'
                      : 'На частные каналы можно подписаться только по ссылке-приглашению.'}
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMuted, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px' }}>Инфо</div>
                    <input
                      value={channelCreateName}
                      onChange={(event) => setChannelCreateName(event.target.value)}
                      placeholder="Название канала"
                      style={{
                        width: '100%',
                        height: 42,
                        borderRadius: 12,
                        border: `1px solid ${C.border}`,
                        background: C.canvas,
                        padding: '0 12px',
                        outline: 'none',
                        fontSize: 13,
                        color: C.ink,
                        fontFamily: 'inherit',
                      }}
                    />
                    <input
                      value={channelCreateDescription}
                      onChange={(event) => setChannelCreateDescription(event.target.value)}
                      placeholder="Описание канала (необязательно)"
                      style={{
                        width: '100%',
                        height: 42,
                        borderRadius: 12,
                        border: `1px solid ${C.border}`,
                        background: C.canvas,
                        padding: '0 12px',
                        outline: 'none',
                        fontSize: 13,
                        color: C.ink,
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMuted, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px' }}>Ссылка</div>
                    {channelCreateType === 'public' ? (
                      <div>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 12, top: 12, color: C.inkMuted, fontSize: 13 }}>alem.me/</span>
                          <input
                            value={channelCreateUsername}
                            onChange={(event) => setChannelCreateUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            onKeyDown={handleChannelUsernameKeyDown}
                            placeholder="ссылка"
                            style={{
                              width: '100%',
                              height: 42,
                              borderRadius: 12,
                              border: `1px solid ${C.border}`,
                              background: C.canvas,
                              padding: '0 12px 0 72px',
                              outline: 'none',
                              fontSize: 13,
                              color: C.ink,
                              fontFamily: 'inherit',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 6, lineHeight: 1.4, padding: '0 4px' }}>
                          Вы можете выбрать публичное имя для вашего канала. Так его смогут найти в поиске.
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: C.canvas, padding: '12px', borderRadius: 12, border: `1px solid ${C.borderLight}`, borderStyle: 'dashed' }}>
                        <div style={{ fontSize: 13, color: C.blue, fontWeight: 600 }}>
                          alem.me/+...
                        </div>
                        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 4, lineHeight: 1.4 }}>
                          Ссылка-приглашение будет сгенерирована автоматически после создания закрытого канала.
                        </div>
                      </div>
                    )}
                  </div>

                  {channelCreateError ? <div style={{ fontSize: 12, color: C.red, padding: '0 4px' }}>{channelCreateError}</div> : null}
                </div>
              ) : null}

              {chatCreationMode === 'channel' && channelCreationStep === 1 ? (
                <div style={{ padding: '8px 10px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 18,
                      background: C.blueSoft,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <MS name="campaign" size={28} color={C.blue} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Создание канала</div>
                  <div style={{ fontSize: 13, color: C.inkMuted, lineHeight: 1.5, maxWidth: 320 }}>
                    Каналы — это инструмент для трансляции ваших сообщений неограниченной аудитории.
                  </div>
                </div>
              ) : null}

              {(chatCreationMode !== 'channel' || channelCreationStep === 2) && isSearchingUsers ? (
                <div style={{ padding: 20, fontSize: 13, color: C.inkMuted }}>Загрузка пользователей...</div>
              ) : null}

              {(chatCreationMode !== 'channel' || channelCreationStep === 2) && !isSearchingUsers && userSearchError ? (
                <div style={{ padding: 20, fontSize: 13, color: C.red }}>{userSearchError}</div>
              ) : null}

              {(chatCreationMode !== 'channel' || channelCreationStep === 2) && !isSearchingUsers && !userSearchError && filteredDirectoryUsers.length === 0 ? (
                <div style={{ padding: 20, fontSize: 13, color: C.inkMuted }}>Пользователи не найдены.</div>
              ) : null}

              {(chatCreationMode !== 'channel' || channelCreationStep === 2) && !isSearchingUsers &&
                !userSearchError &&
                filteredDirectoryUsers.map((user) => {
                  const title = user.fullName || user.username || `User ${user.id}`
                  const isMultiSelect = chatCreationMode === 'group' || (chatCreationMode === 'channel' && channelCreationStep === 2)

                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        if (isMultiSelect) {
                          setSelectedNewGroupMemberIds((prev) => (prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id]))
                          return
                        }

                        createDraftChat(user)
                      }}
                      style={{
                        width: '100%',
                        border: isMultiSelect ? `1px solid ${selectedNewGroupMemberIds.includes(user.id) ? `${C.blue}33` : C.borderLight}` : 'none',
                        background: isMultiSelect && selectedNewGroupMemberIds.includes(user.id) ? C.blueSoft : 'transparent',
                        textAlign: 'left',
                        padding: '12px',
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(event) => {
                        if (!isMultiSelect || !selectedNewGroupMemberIds.includes(user.id)) {
                          event.currentTarget.style.background = C.blueSoft
                        }
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = isMultiSelect && selectedNewGroupMemberIds.includes(user.id) ? C.blueSoft : 'transparent'
                      }}
                    >
                      <MessengerAvatar initials={getInitials(title)} imageUrl={user.avatarUrl} size={40} seed={getSeed(title)} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {title}
                        </div>
                      </div>
                      <MS
                        name={isMultiSelect ? (selectedNewGroupMemberIds.includes(user.id) ? 'check_circle' : 'radio_button_unchecked') : 'chevron_right'}
                        size={18}
                        color={isMultiSelect && selectedNewGroupMemberIds.includes(user.id) ? C.blue : C.inkMuted}
                      />
                    </button>
                  )
                })}
            </div>
              {chatCreationMode === 'group' || chatCreationMode === 'channel' ? (
                <div style={{ padding: '12px 20px 18px', borderTop: `1px solid ${C.borderLight}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserPickerOpen(false)
                      resetChatCreationModal()
                    }}
                    disabled={isCreatingGroup || isCreatingChannel}
                    style={{
                      height: 38,
                      padding: '0 14px',
                      borderRadius: 10,
                      border: `1px solid ${C.borderLight}`,
                      background: '#FFFFFF',
                      color: C.inkMuted,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: (isCreatingGroup || isCreatingChannel) ? 'default' : 'pointer',
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (chatCreationMode === 'group') {
                        void createGroupFromPicker()
                      } else {
                        if (channelCreationStep === 1) {
                          void createChannelFromPicker()
                        } else {
                          void finishChannelCreationWithMembers()
                        }
                      }
                    }}
                    disabled={isCreatingGroup || isCreatingChannel}
                    style={{
                      height: 38,
                      padding: '0 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: `linear-gradient(135deg, ${C.blue} 0%, #4EA1FF 100%)`,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: (isCreatingGroup || isCreatingChannel) ? 'default' : 'pointer',
                      opacity: (isCreatingGroup || isCreatingChannel) ? 0.7 : 1,
                      boxShadow: `0 10px 22px ${C.blue}2B`,
                    }}
                  >
                    {chatCreationMode === 'group'
                      ? (isCreatingGroup ? 'Создание...' : 'Создать группу')
                      : (channelCreationStep === 1
                          ? (isCreatingChannel ? 'Создание...' : 'Далее')
                          : (isCreatingChannel ? 'Добавление...' : 'Готово')
                        )}
                  </button>
                </div>
              ) : null}
          </div>
        </div>
      ) : null}

      {showChatPane ? (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF', minWidth: 0, minHeight: 0, position: 'relative' }}>
        {!activeChat ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 28,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 420,
                borderRadius: 28,
                border: `1px solid ${C.borderLight}`,
                background: 'rgba(255,255,255,0.68)',
                boxShadow: '0 20px 48px rgba(10,22,40,0.08)',
                padding: '34px 28px',
                display: 'grid',
                justifyItems: 'center',
                gap: 14,
                textAlign: 'center',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 24,
                  background: 'linear-gradient(135deg, #EEF5FF 0%, #E2EEFF 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
                }}
              >
                <MS name="forum" size={30} color={C.blue} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>
                {chats.length === 0 ? 'У вас пока нет чатов' : 'Выберите чат'}
              </div>
              {chats.length > 0 ? (
                <div style={{ fontSize: 14, lineHeight: 1.6, color: C.inkMuted, maxWidth: 320 }}>
                  {emptyChatStateMessageText}
                </div>
              ) : null}
              <div style={{ display: chats.length === 0 ? 'block' : 'none', fontSize: 14, lineHeight: 1.6, color: C.inkMuted, maxWidth: 320 }}>
                {chats.length === 0
                  ? 'Создайте новый диалог или группу, чтобы начать общение.'
                  : 'Выберите чат слева, чтобы начать переписку и отправить сообщение.'}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                height: isMobileLayout ? 60 : 64,
                background: themedChatSurfaceBackground,
                borderBottom: `1px solid ${themedChatSurfaceBorder}`,
                display: 'flex',
                alignItems: 'center',
                padding: isMobileLayout ? '0 12px' : '0 22px',
                gap: isMobileLayout ? 10 : 12,
                flexShrink: 0,
                fontFamily: '"Roboto", sans-serif',
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
                backdropFilter: activeThemeConfig.backgroundType === 'default' ? undefined : 'blur(14px)',
              }}
            >
              <button
                type="button"
                onClick={handleBackToChatList}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: `1px solid ${C.borderLight}`,
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                }}
                className="hover:scale-105 active:scale-95 hover:bg-slate-50"
                title="Закрыть чат"
              >
                <MS name="arrow_back" size={18} color={C.inkMuted} />
              </button>
              {activePeerId !== null ? (
                <button
                  type="button"
                  onContextMenu={(e) => {
                    if (activeChatId === 'smart-agent') e.preventDefault()
                  }}
                  onClick={() => void openUserProfile(activePeerId)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  title={activePeerId > 0 ? 'Открыть профиль пользователя' : 'Открыть профиль Smart AI'}
                >
                  <MessengerAvatar initials={activeChat.avatar} imageUrl={activeChat.avatarUrl} size={38} seed={activeChat.seed} online={activeChat.online} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.ink, letterSpacing: '-0.012em', lineHeight: 1.2 }}>
                      {activeChat.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: activeChat.online ? C.green : C.inkMuted,
                        marginTop: 2,
                        fontWeight: 400,
                        lineHeight: 1.2,
                        letterSpacing: '-0.004em',
                      }}
                    >
                      {activeChat.online ? 'В сети' : activeChat.chat.type === 'group' ? 'Группа' : formatLastSeen(activeChat.chat.lastSeenAt)}
                    </div>
                  </div>
                </button>
              ) : (
                <>
                <button
                  type="button"
                  onClick={() => setShowInfo(prev => !prev)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  title={activeChat.chat.type === 'channel' ? "Инфо канала" : "Параметры группы"}
                >
                  <MessengerAvatar initials={activeChat.avatar} imageUrl={activeChat.avatarUrl} size={38} seed={activeChat.seed} online={activeChat.online} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: C.ink, letterSpacing: '-0.012em', lineHeight: 1.2 }}>
                      {activeChat.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: activeChat.online ? C.green : C.inkMuted,
                        marginTop: 2,
                        fontWeight: 400,
                        lineHeight: 1.2,
                        letterSpacing: '-0.004em',
                      }}
                    >
                      {activeChat.online
                        ? 'В сети'
                        : activeChat.chat.type === 'group'
                          ? 'Группа'
                          : activeChat.chat.type === 'channel'
                            ? 'Канал'
                            : formatLastSeen(activeChat.chat.lastSeenAt)}
                    </div>
                  </div>
                </button>
                </>
              )}
              {MESSENGER_VIDEO_CALLS_ENABLED && canStartCallInActiveChat ? (
                <button
                  type="button"
                  onClick={() => void handleStartActiveChatCall()}
                  disabled={isCallBusy}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: isCallBusy ? '#F4F7FB' : '#EEF5FF',
                    border: `1px solid ${isCallBusy ? C.borderLight : `${C.blue}22`}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isCallBusy ? 'default' : 'pointer',
                    boxShadow: isCallBusy ? 'none' : '0 8px 18px rgba(30,136,229,0.12)',
                    opacity: isCallBusy ? 0.7 : 1,
                  }}
                  title={
                    isCallBusy
                      ? callBusyLabel
                      : activeChat.chat.type === 'group'
                        ? 'Начать групповой видеозвонок'
                        : 'Начать видеозвонок'
                  }
                >
                  <MS name="videocam" size={18} color={isCallBusy ? C.inkMuted : C.blue} />
                </button>
              ) : null}
              {canSearchInActiveChat ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isChatSearchOpen) {
                      closeChatSearch()
                      return
                    }

                    setIsChatSearchOpen(true)
                    setChatSearchError('')
                    setChatSearchInfo('')
                    setSelectedChatSearchResultId(null)
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: isChatSearchOpen ? '#EEF5FF' : 'transparent',
                    border: `1px solid ${isChatSearchOpen ? `${C.blue}22` : C.borderLight}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: isChatSearchOpen ? '0 8px 18px rgba(30,136,229,0.12)' : 'none',
                  }}
                  title={isChatSearchOpen ? 'Закрыть поиск' : 'Поиск по сообщениям'}
                >
                  <MS name="search" size={17} color={isChatSearchOpen ? C.blue : C.inkSub} />
                </button>
              ) : null}
            </div>

            {activeChat.chat.type === 'personal' && (!cryptoState.currentDeviceId || !cryptoState.privateKey) ? (
              <div
                style={{
                  padding: '10px 18px',
                  fontSize: 12,
                  color: '#92400E',
                  background: '#FFF7ED',
                  borderBottom: `1px solid ${C.borderLight}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span>
                  Для доступа к старой E2EE-истории на этом устройстве нужен локальный ключ. Если на аккаунте есть recovery backup, введите пароль прямо в разделе сообщений.
                </span>
                {hasRemoteE2eeBackup ? (
                  <button
                    type="button"
                    onClick={() => {
                      setE2eeRestoreError('')
                      setIsE2eeRestoreModalOpen(true)
                    }}
                    style={{
                      flexShrink: 0,
                      background: '#FFFFFF',
                      color: '#9A3412',
                      border: '1px solid #FED7AA',
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Ввести пароль
                  </button>
                ) : null}
              </div>
            ) : null}

            {activeChatUnavailableSummary ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 18px',
                  background: activeChatUnavailableSummary.tone.background,
                  borderBottom: `1px solid ${activeChatUnavailableSummary.tone.border}`,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    background: '#FFFFFFB8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <MS name="lock" size={14} color={activeChatUnavailableSummary.tone.text} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: activeChatUnavailableSummary.tone.text, lineHeight: 1.25 }}>
                    {activeChatUnavailableSummary.title}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 12, color: activeChatUnavailableSummary.tone.text, lineHeight: 1.45 }}>
                    {activeChatUnavailableSummary.description}
                  </div>
                </div>
                {activeChatUnavailableSummary.action ? (
                  <button
                    type="button"
                    onClick={activeChatUnavailableSummary.action.onClick}
                    style={{
                      background: '#FFFFFF',
                      border: `1px solid ${activeChatUnavailableSummary.tone.border}`,
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: activeChatUnavailableSummary.tone.text,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      flexShrink: 0,
                    }}
                  >
                    {activeChatUnavailableSummary.action.label}
                  </button>
                ) : null}
              </div>
            ) : null}

            {messageActionError ? (
              <div style={{ padding: '10px 18px', fontSize: 12, color: C.red, background: '#FFF6F6', borderBottom: `1px solid ${C.borderLight}` }}>
                {messageActionError}
              </div>
            ) : null}

            {selectedMessageViews.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '8px 14px',
                  background: '#E7F0FC',
                  borderBottom: `1px solid ${C.borderLight}`,
                }}
              >
                <button
                  type="button"
                  onClick={clearSelectedMessages}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    border: 'none',
                    background: 'rgba(255,255,255,0.78)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(10,22,40,0.04)',
                  }}
                  title="Снять выделение"
                >
                  <MS name="close" size={16} color={C.inkMuted} />
                </button>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 90 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{selectedMessageViews.length}</div>
                  <div style={{ fontSize: 13, color: C.inkMuted, fontWeight: 700, lineHeight: 1 }}>выбрано</div>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {canManageChannelPosts && (
                    <button type="button" onClick={() => setIsDeleteConfirmOpen(true)} disabled={isMessageActionLoading} style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Удалить"><MS name="delete" size={18} color={C.red} /></button>
                  )}
                  {selectedMessageViews.length === 1 ? (
                    <>
                      {canManageChannelPosts && (
                        <button type="button" onClick={() => void handleTogglePinMessage()} disabled={isMessageActionLoading} style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: selectedMessage && pinnedMessageIds.has(selectedMessage.raw.id) ? 'rgba(255,255,255,0.72)' : 'transparent', color: selectedMessage && pinnedMessageIds.has(selectedMessage.raw.id) ? C.blue : C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={selectedMessage && pinnedMessageIds.has(selectedMessage.raw.id) ? 'Открепить' : 'Закрепить'}><PinnedIcon size={18} color={selectedMessage && pinnedMessageIds.has(selectedMessage.raw.id) ? C.blue : C.ink} /></button>
                      )}
                      {canManageChannelPosts && (
                        <button type="button" onClick={() => void handleLoadMessageViewers()} disabled={isMessageActionLoading} style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Прочитали"><MS name="visibility" size={18} color={C.ink} /></button>
                      )}
                      {canManageChannelPosts && selectedMessage?.raw.senderId === currentUser?.id && selectedMessage?.kind === 'text' ? (
                        <button type="button" onClick={() => void handleEditSelectedMessage()} disabled={isMessageActionLoading} style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Изменить"><MS name="edit" size={18} color={C.ink} /></button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {pinnedMessages.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '10px 18px',
                  background: '#FFFFFF',
                  borderBottom: `1px solid ${C.borderLight}`,
                  boxShadow: '0 1px 0 rgba(10,22,40,0.02)',
                }}
              >
                <div
                  style={{
                    width: 3,
                    alignSelf: 'stretch',
                    borderRadius: 999,
                    background: `linear-gradient(180deg, ${C.blue} 0%, #64B5F6 100%)`,
                    boxShadow: `0 0 0 1px ${C.blue}22`,
                    flexShrink: 0,
                  }}
                />
                <button
                  type="button"
                  onClick={handlePinnedMessageClick}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.blue, lineHeight: 1.2 }}>
                    {`Pinned message #${activePinnedIndex + 1}`}
                    {pinnedMessages.length > 1 ? (
                      <span style={{ color: C.inkMuted }}>{` of ${pinnedMessages.length}`}</span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 13,
                      lineHeight: 1.35,
                      color: C.ink,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {getFriendlyMessageText(
                      activePinnedMessageView?.text?.trim() || activePinnedMessage?.content?.trim(),
                      activePinnedMessage?.type || activePinnedMessageView?.kind || 'text'
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setIsPinnedMessagesPanelOpen(true)
                  }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="Все закрепленные сообщения"
                >
                  <MS name="format_list_bulleted" size={18} color={C.inkMuted} />
                </button>
              </div>
            ) : null}

            <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative', ...themedChatCanvasStyle }}>
              <div
                ref={messagesScrollerRef}
                onScroll={handleMessagesScroll}
                style={{
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  height: '100%',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  paddingTop: isMobileLayout ? 14 : 20,
                  paddingBottom: isMobileLayout ? 14 : 20,
                  paddingLeft: isMobileLayout ? 12 : 24,
                  paddingRight: isChatSearchOpen
                    ? isMobileLayout
                      ? 12
                      : 'min(392px, calc(100% - 36px))'
                    : isMobileLayout
                      ? 12
                      : 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  transition: 'padding-right 0.18s ease',
                }}
              >
              <div
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  margin: 0,
                }}
              >
              {isLoadingOlderMessages ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.inkMuted,
                      background: 'rgba(255,255,255,0.84)',
                      border: `1px solid ${C.borderLight}`,
                      borderRadius: 999,
                      padding: '5px 10px',
                    }}
                  >
                    Загружаем старые сообщения...
                  </div>
                </div>
              ) : null}
              {historyError ? (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: C.red,
                      background: '#FFFFFF',
                      border: `1px solid ${C.borderLight}`,
                      borderRadius: 12,
                      padding: '8px 12px',
                      boxShadow: '0 2px 10px rgba(10,22,40,0.06)',
                    }}
                  >
                    {historyError}
                  </div>
                </div>
              ) : null}
              {isLoadingMessages ? (
                <ChatHistoryLoadingState />
              ) : (
                messages.map((msg, index) => {
                  const previousMessage = index > 0 ? messages[index - 1] : null
                  const shouldShowDaySeparator =
                    !previousMessage || !isSameCalendarDate(previousMessage.raw.createdAt, msg.raw.createdAt)

                  return (
                    <div
                      key={msg.raw.id}
                      ref={(node) => {
                        messageItemRefs.current[msg.raw.id] = node
                      }}
                      data-message-id={msg.raw.id}
                    >
                      {shouldShowDaySeparator ? (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            margin: '14px 0 10px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: C.inkMuted,
                              background: 'rgba(255,255,255,0.72)',
                              border: `1px solid ${C.borderLight}`,
                              borderRadius: 999,
                              padding: '4px 10px',
                              boxShadow: '0 1px 2px rgba(10,22,40,0.04)',
                            }}
                          >
                            {formatDaySeparatorLabel(msg.raw.createdAt)}
                          </div>
                        </div>
                      ) : null}
                      <div
                        onClick={(event) => handleMessageLeftClick(event, msg.raw.id)}
                        onContextMenu={(event) => openMessageContextMenu(event, msg.raw.id)}
                        style={{
                          padding: selectedMessageSet.has(msg.raw.id) || highlightedSearchMessageId === msg.raw.id ? 6 : 0,
                          borderRadius: 16,
                          background: selectedMessageSet.has(msg.raw.id)
                            ? 'rgba(76,158,255,0.08)'
                            : highlightedSearchMessageId === msg.raw.id
                              ? 'rgba(30,136,229,0.08)'
                              : 'transparent',
                          border: selectedMessageSet.has(msg.raw.id)
                            ? `1px solid ${C.blue}22`
                            : highlightedSearchMessageId === msg.raw.id
                              ? `1px solid ${C.blue}44`
                              : '1px solid transparent',
                          boxShadow: highlightedSearchMessageId === msg.raw.id ? '0 14px 34px rgba(30,136,229,0.12)' : 'none',
                          transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                          cursor: 'pointer',
                        }}
                      >
                        {pinnedMessageIds.has(msg.raw.id) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, color: C.blue, fontSize: 11, fontWeight: 700 }}>
                            <PinnedIcon size={12} color={C.blue} />
                            Pinned
                          </div>
                        ) : null}
                        <MessageBubble 
                          msg={msg} 
                          showSenderLabel={activeChat.chat.type === 'group'} 
                          onOpenImage={openImageViewer} 
                          onOpenVideo={openVideoViewer} 
                          theme={messageBubbleTheme} 
                          isSmartAgentSending={isSmartAgentLoading}
                          onReact={handleAddReaction} 
                          onUnreact={handleRemoveReaction} 
                          onReply={!canManageChannelPosts || isSmartAgentChat ? undefined : () => {
                            setReplyTarget({
                              id: msg.raw.id,
                              senderId: msg.raw.senderId,
                              senderFullName: msg.senderLabel,
                              content: msg.text,
                              type: msg.raw.type,
                              attachmentUrl: msg.raw.attachmentUrl,
                              attachmentType: msg.raw.attachmentType,
                            })
                          }}
                          onConfirm={() => {
                            void sendSmartAgentMessage('yes', 'Подтвердить')
                          }}
                          onCancel={() => {
                            void sendSmartAgentMessage('no', 'Отменить')
                          }}
                          onSelect={(val, label) => {
                            void sendSmartAgentMessage(val, label)
                          }}
                          onOpenDriveFile={handleOpenDriveFile}
                          onOpenNote={handleOpenNote}
                        />
                      </div>
                    </div>
                  )
                })
              )}
              {activeTyping ? <div style={{ fontSize: 12, color: C.inkMuted }}>{activeTyping.label} печатает...</div> : null}
              <div ref={bottomRef} />
              </div>
              </div>

              {!isAtBottom && messages.length > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 16,
                    display: 'flex',
                    justifyContent: 'center',
                    zIndex: 4,
                    pointerEvents: 'none',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      stickChatToBottom('smooth')
                      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
                      if (activeChatId) {
                        scheduleVisibleReadSync(activeChatId, activeChat?.chat.type ?? 'personal', messages)
                      }
                    }}
                    style={{
                      pointerEvents: 'auto',
                      border: 'none',
                      borderRadius: 999,
                      background: '#FFFFFF',
                      color: C.blue,
                      height: 38,
                      padding: '0 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      boxShadow: '0 10px 24px rgba(10,22,40,0.12)',
                      cursor: 'pointer',
                    }}
                  >
                    <MS name="south" size={16} color={C.blue} />
                    {pendingNewMessagesCount > 0 ? `${pendingNewMessagesCount} новых сообщений` : 'Вниз'}
                  </button>
                </div>
              ) : null}

              {isChatSearchOpen ? (
                <ChatSearchPanel
                  query={chatSearchQuery}
                  resultCount={chatSearchResultCount}
                  results={chatSearchResults}
                  isLoading={isChatSearchLoading}
                  error={chatSearchError}
                  info={chatSearchInfo}
                  selectedResultId={selectedChatSearchResultId}
                  onChangeQuery={setChatSearchQuery}
                  onClose={closeChatSearch}
                  onSelectResult={handleChatSearchResultClick}
                />
              ) : null}
            </div>

            {isRecordingVideoMessage ? (
              <VideoMessageRecordingPreview
                stream={videoMessageStreamRef.current}
                durationSeconds={videoRecordingDurationSeconds}
                isLocked={isRecordingLocked}
              />
            ) : null}

            {sendError ? <div style={{ padding: '0 20px 8px', fontSize: 12, color: C.red }}>{sendError}</div> : null}

            <div
              style={{
                position: 'relative',
                background: themedChatSurfaceBackground,
                borderTop: `1px solid ${themedChatSurfaceBorder}`,
                padding: isRecordingUiActive
                  ? isMobileLayout
                    ? '10px 12px'
                    : '12px 20px 12px'
                  : isMobileLayout
                    ? '10px 12px 12px'
                    : '14px 20px 12px',
                flexShrink: 0,
                boxShadow: isRecordingUiActive ? '0 -10px 26px rgba(10,22,40,0.05)' : '0 -8px 24px rgba(10,22,40,0.03)',
                backdropFilter: activeThemeConfig.backgroundType === 'default' ? undefined : 'blur(14px)',
              }}
            >
              {activeMentionContext && (mentionSuggestions.length > 0 || Boolean(groupMembersError)) ? (
                <div
                  style={{
                    position: 'absolute',
                    left: isMobileLayout ? 12 : 20,
                    right: isMobileLayout ? 12 : 20,
                    bottom: 'calc(100% + 8px)',
                    background: '#FFFFFF',
                    border: `1px solid ${C.borderLight}`,
                    borderRadius: 16,
                    boxShadow: '0 16px 40px rgba(10,22,40,0.12)',
                    padding: 8,
                    zIndex: 5,
                  }}
                >
                  {groupMembersError ? (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: C.red }}>{groupMembersError}</div>
                  ) : null}
                  {mentionSuggestions.map((member) => {
                    const title = member.fullName || member.username || `User ${member.id}`

                    return (
                      <button
                        key={member.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applyMentionSuggestion(member)}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <MessengerAvatar initials={getInitials(title)} imageUrl={null} size={34} seed={getSeed(title)} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {title}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {!hasDraftMessage && (isRecordLockHintVisible || isRecordingAnyMedia || isRecordingLocked) ? (
                <div
                  style={{
                    position: 'absolute',
                    right: 20,
                    bottom: 'calc(100% + 14px)',
                    zIndex: 6,
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 10,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 16,
                      background: isRecordingLocked ? '#EEF6FF' : 'rgba(255,255,255,0.98)',
                      border: `1px solid ${isRecordingLocked ? '#D7E8FF' : C.borderLight}`,
                      boxShadow: isRecordingLocked ? '0 12px 28px rgba(46,135,255,0.14)' : '0 10px 26px rgba(10,22,40,0.09)',
                      minWidth: 196,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: isRecordingLocked ? C.blue : C.ink }}>
                      {isRecordingLocked ? 'Запись зафиксирована' : 'Потяните вверх для фиксации'}
                    </div>
                    <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 3 }}>
                      {isRecordingLocked
                        ? 'Теперь можно отпустить кнопку и завершить запись позже.'
                        : `Отпустите кнопку, чтобы отправить ${selectedRecorderMode === 'video_message' ? 'кружок' : 'голосовое сообщение'}.`}
                    </div>
                  </div>

                  <div
                    style={{
                      position: 'relative',
                      width: 42,
                      height: 122,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 12,
                        width: 6,
                        height: 92,
                        borderRadius: 999,
                        background: '#E6EEF9',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: `${Math.max(12, Math.round(recordLockProgress * 100))}%`,
                          borderRadius: 999,
                          background: isRecordingLocked ? C.blue : '#8EC1FF',
                          transition: 'height 0.12s ease, background 0.12s ease',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        top: isRecordingLocked ? 2 : `${14 + (1 - recordLockProgress) * 50}px`,
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        background: isRecordingLocked ? `linear-gradient(135deg, ${C.blue} 0%, #66B2FF 100%)` : '#FFFFFF',
                        border: `1px solid ${isRecordingLocked ? `${C.blue}30` : C.borderLight}`,
                        boxShadow: isRecordingLocked ? '0 10px 24px rgba(46,135,255,0.24)' : '0 6px 16px rgba(10,22,40,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'top 0.12s ease, background 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
                      }}
                    >
                      <MS name="lock" size={16} color={isRecordingLocked ? '#FFFFFF' : C.inkMuted} />
                    </div>
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isRecordingUiActive ? 0 : 12,
                  background: isRecordingUiActive ? 'transparent' : '#FFFFFF',
                  border: isRecordingUiActive ? 'none' : `1px solid ${C.borderLight}`,
                  borderRadius: isRecordingUiActive ? 0 : 14,
                  padding: isRecordingUiActive ? 0 : '10px 12px 10px 16px',
                  boxShadow: 'none',
                  position: 'relative',
                }}
              >
                {activeChat?.chat.type === 'channel' && !channelDetails?.isSubscribed ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42 }}>
                    {isLoadingChannelDetails ? (
                      <div style={{ fontSize: 13, color: C.inkMuted, fontWeight: 600 }}>Загрузка...</div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleJoinChannel}
                        disabled={isMessageActionLoading}
                        style={{
                          flex: 1,
                          height: 42,
                          background: C.blue,
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 12,
                          fontSize: 14,
                          fontWeight: 800,
                          cursor: isMessageActionLoading ? 'default' : 'pointer',
                          boxShadow: `0 8px 20px ${C.blue}33`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          transition: 'opacity 0.2s ease',
                          opacity: isMessageActionLoading ? 0.7 : 1,
                        }}
                      >
                        {isMessageActionLoading ? (
                          'Вступление...'
                        ) : (
                          <>
                            <MS name="add_circle" size={18} color="#FFFFFF" />
                            <span>ПОДПИСАТЬСЯ</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : activeChat?.chat.type === 'channel' && channelDetails?.myRole !== 'admin' && channelDetails?.myRole !== 'owner' ? (
                  <div 
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: 48, 
                      color: C.inkSub, 
                      fontSize: 13, 
                      fontWeight: 800,
                      background: '#F8FAFC',
                      borderRadius: 16,
                      border: `1px solid ${C.borderLight}`,
                      letterSpacing: '0.04em',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.02)'
                    }}
                  >
                    <MS name="campaign" size={18} color={C.inkSub} style={{ marginRight: 10, opacity: 0.8 }} />
                    <span style={{ transform: 'translateY(0.5px)' }}>ВЫ ПОДПИСАНЫ НА КАНАЛ</span>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={(event) => void handleAttachmentSelection(event)}
                      style={{ display: 'none' }}
                    />
                    {isRecordingUiActive ? (
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          minHeight: 58,
                          borderRadius: 22,
                          background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F8FF 100%)',
                          border: '1px solid #DCE8F8',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.86), 0 12px 28px rgba(46,135,255,0.08)',
                          display: 'grid',
                          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                          alignItems: 'center',
                          gap: 16,
                          padding: '6px 8px 6px 18px',
                          color: C.ink,
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexShrink: 0 }}>
                          <span
                            style={{
                              width: 11,
                              height: 11,
                              borderRadius: '50%',
                              background: '#E25555',
                              boxShadow: '0 0 0 5px rgba(226,85,85,0.14)',
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ display: 'grid', gap: 2 }}>
                            <span
                              style={{
                                fontSize: 15,
                                fontWeight: 700,
                                lineHeight: 1,
                                fontFamily: 'Roboto, "Segoe UI", sans-serif',
                                fontVariantNumeric: 'tabular-nums',
                                letterSpacing: '-0.015em',
                                color: C.ink,
                              }}
                            >
                              {isRecordingVideoMessage
                                ? formatRecordingDuration(videoRecordingDurationSeconds)
                                : formatRecordingDuration(recordingDurationSeconds)}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                lineHeight: 1.1,
                                color: C.inkMuted,
                                fontFamily: 'Roboto, "Segoe UI", sans-serif',
                              }}
                            >
                              {isRecordingLocked
                                ? 'Запись зафиксирована'
                                : isRecordingVideoMessage
                                  ? 'Видеокружок'
                                  : 'Голосовое сообщение'}
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            flex: 1,
                            minWidth: 28,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 46,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => void cancelActiveRecording()}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: C.blue,
                              fontSize: 15,
                              lineHeight: 1,
                              fontWeight: 500,
                              fontFamily: 'Roboto, "Segoe UI", sans-serif',
                              cursor: 'pointer',
                              padding: '0 12px',
                            }}
                          >
                            Отмена
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => void stopActiveRecording()}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            border: '1px solid rgba(72,153,255,0.24)',
                            background: 'linear-gradient(135deg, #5FAEFF 0%, #318DFF 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 12px 24px rgba(49,141,255,0.24)',
                            cursor: 'pointer',
                            flexShrink: 0,
                            justifySelf: 'end',
                          }}
                          title={isRecordingLocked ? 'Отправить запись' : 'Завершить и отправить запись'}
                        >
                          <MS name="send" size={19} color="#FFFFFF" style={{ transform: 'translateX(1px)' }} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {replyTarget && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 12px)',
                              left: 0,
                              right: 0,
                              padding: '10px 14px',
                              background: '#FFFFFF',
                              borderRadius: 16,
                              border: `1px solid ${C.borderLight}`,
                              boxShadow: '0 8px 30px rgba(10,22,40,0.12)',
                              zIndex: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'rgba(46,120,246,0.08)', flexShrink: 0 }}>
                              <MS name="reply" size={18} color={C.blue} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 2, fontFamily: '"Roboto", sans-serif' }}>
                                {replyTarget.senderFullName}
                              </div>
                              <div
                                style={{
                                  fontSize: 13,
                                  color: C.inkSub,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontFamily: '"Roboto", sans-serif',
                                }}
                              >
                                {replyTarget.attachmentUrl
                                  ? `📎 ${replyTarget.attachmentType ?? 'Файл'}`
                                  : replyTarget.content}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setReplyTarget(null)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                border: 'none',
                                background: '#F1F5F9',
                                color: C.inkSub,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <MS name="close" size={18} />
                            </button>
                          </div>
                        )}
                        {(attachmentPreviewUrl || attachmentsToUpload.length > 0) && (
                          <div style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 12px)',
                            left: 0,
                            right: 0,
                            padding: '12px',
                            background: '#FFFFFF',
                            borderRadius: '16px',
                            border: `1px solid ${C.borderLight}`,
                            boxShadow: '0 8px 30px rgba(10,22,40,0.12)',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0', flex: 1 }}>
                              {attachmentPreviewUrl && !attachmentsToUpload.length && (
                                <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: '#F4F7FB', border: '1px solid #E0E7F2', flexShrink: 0 }}>
                                  {attachmentToUpload?.type.startsWith('image/') ? (
                                    <img src={attachmentPreviewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.blue }}>
                                      <MS name="description" size={24} />
                                    </div>
                                  )}
                                </div>
                              )}

                              {attachmentsToUpload.map((file, idx) => (
                                <div key={idx} style={{ position: 'relative', width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: '#F4F7FB', border: '1px solid #E0E7F2', flexShrink: 0 }}>
                                  {file.type.startsWith('image/') ? (
                                    <img src={attachmentPreviewUrls[idx]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.blue }}>
                                      <MS name="description" size={24} />
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newFiles = [...attachmentsToUpload]
                                      const newUrls = [...attachmentPreviewUrls]
                                      newFiles.splice(idx, 1)
                                      newUrls.splice(idx, 1)
                                      setAttachmentsToUpload(newFiles)
                                      setAttachmentPreviewUrls(newUrls)
                                    }}
                                    style={{
                                      position: 'absolute',
                                      top: 2,
                                      right: 2,
                                      width: 16,
                                      height: 16,
                                      borderRadius: 8,
                                      border: 'none',
                                      background: 'rgba(15, 23, 42, 0.7)',
                                      color: '#FFFFFF',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      fontSize: 9,
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div style={{ flexShrink: 0, paddingRight: 8, textAlign: 'right' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
                                {attachmentsToUpload.length > 0 
                                  ? (attachmentsToUpload.length === 1 ? attachmentsToUpload[0].name : `${attachmentsToUpload.length} файлов`)
                                  : (attachmentToUpload?.name || 'Вложение')}
                              </div>
                              <div style={{ fontSize: 11, color: C.inkFaint }}>
                                {formatAttachmentLimit(
                                  attachmentsToUpload.length > 0 
                                    ? attachmentsToUpload.reduce((acc, f) => acc + f.size, 0)
                                    : (attachmentToUpload?.size || 0)
                                )}
                              </div>
                            </div>

                            <button 
                              type="button"
                              onClick={() => {
                                setAttachmentToUpload(null)
                                setAttachmentPreviewUrl(null)
                                setAttachmentsToUpload([])
                                setAttachmentPreviewUrls([])
                              }}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                border: 'none',
                                background: '#F1F5F9',
                                color: C.inkSub,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <MS name="close" size={18} />
                            </button>
                          </div>
                        )}
                        {!isSmartAgentChat ? (
                          <div ref={attachMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isSending && !isRecordingAnyMedia) {
                                  setIsAttachMenuOpen((prev) => !prev)
                                }
                              }}
                              disabled={isSending || isRecordingAnyMedia}
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 21,
                                border: `1px solid ${isAttachMenuOpen ? C.blue : C.borderLight}`,
                                background: isAttachMenuOpen ? '#EFF6FF' : '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isAttachMenuOpen ? C.blue : C.inkMuted,
                                cursor: isSending || isRecordingAnyMedia ? 'default' : 'pointer',
                                flexShrink: 0,
                                opacity: isSending || isRecordingAnyMedia ? 0.6 : 1,
                                boxShadow: '0 2px 10px rgba(10,22,40,0.05)',
                                transition: 'all 0.15s ease',
                              }}
                              title="Прикрепить файл"
                            >
                              <MS name="attach_file" size={18} color={isAttachMenuOpen ? C.blue : C.inkMuted} style={{ transform: 'translateY(-2px)' }} />
                            </button>

                            {isAttachMenuOpen && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 'calc(100% + 8px)',
                                  left: 0,
                                  background: '#FFFFFF',
                                  border: `1px solid ${C.borderLight}`,
                                  borderRadius: 16,
                                  boxShadow: '0 8px 32px rgba(10,22,40,0.14)',
                                  padding: '6px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 2,
                                  minWidth: 190,
                                  zIndex: 100,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAttachMenuOpen(false)
                                    fileInputRef.current?.click()
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 14px',
                                    borderRadius: 12,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#1E293B',
                                    fontSize: 14,
                                    fontWeight: 500,
                                    textAlign: 'left',
                                    width: '100%',
                                  }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F1F5F9' }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                                >
                                  <MS name="insert_drive_file" size={18} color={C.inkMuted} />
                                  С устройства
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAttachMenuOpen(false)
                                    setIsDrivePickerOpen(true)
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 14px',
                                    borderRadius: 12,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#1E293B',
                                    fontSize: 14,
                                    fontWeight: 500,
                                    textAlign: 'left',
                                    width: '100%',
                                  }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF' }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                                >
                                  <MS name="cloud" size={18} color={C.blue} />
                                  Из Alem Drive
                                </button>
                              </div>
                            )}
                          </div>
                        ) : null}
                        <textarea
                          key={activeChatId ? `composer-${activeChatId}` : 'composer-none'}
                          ref={messageInputRef}
                          defaultValue=""
                          onInput={handleComposerInput}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault()
                              void sendMessage()
                            }
                          }}
                          onClick={(event) => {
                            const c = event.currentTarget.selectionStart ?? event.currentTarget.value.length
                            const epoch = composerSyncEpochRef.current
                            startTransition(() => {
                              if (composerSyncEpochRef.current !== epoch) {
                                return
                              }
                              setMentionCaretIndex(c)
                            })
                          }}
                          onKeyUp={(event) => {
                            const c = event.currentTarget.selectionStart ?? event.currentTarget.value.length
                            const epoch = composerSyncEpochRef.current
                            startTransition(() => {
                              if (composerSyncEpochRef.current !== epoch) {
                                return
                              }
                              setMentionCaretIndex(c)
                            })
                          }}
                          onSelect={(event) => {
                            const c = event.currentTarget.selectionStart ?? event.currentTarget.value.length
                            const epoch = composerSyncEpochRef.current
                            startTransition(() => {
                              if (composerSyncEpochRef.current !== epoch) {
                                return
                              }
                              setMentionCaretIndex(c)
                            })
                          }}
                          onBlur={() => stopOutgoingTyping()}
                          onPaste={handlePaste}
                          placeholder={attachmentToUpload ? "Добавить подпись..." : "Написать сообщение..."}
                          disabled={isRecordingAnyMedia}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 42,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: 14,
                            color: C.ink,
                            fontFamily: 'inherit',
                            resize: 'none',
                            lineHeight: '22px',
                            paddingTop: 12,
                            paddingBottom: 8,
                            boxSizing: 'border-box',
                            maxHeight: MESSAGE_COMPOSER_MAX_HEIGHT_PX,
                            overflowY: 'auto',
                            opacity: isRecordingAnyMedia ? 0.55 : 1,
                          }}
                        />
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={handleAiProofreadMessage}
                            disabled={isAiProofreading || isRecordingAnyMedia}
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 21,
                              border: `1px solid ${C.borderLight}`,
                              background: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: C.blue,
                              cursor: isAiProofreading || isRecordingAnyMedia ? 'default' : 'pointer',
                              flexShrink: 0,
                              opacity: isAiProofreading || isRecordingAnyMedia ? 0.6 : 1,
                              boxShadow: '0 2px 10px rgba(10,22,40,0.05)',
                              transition: 'all 0.15s ease',
                            }}
                            title="Исправить текст (ИИ)"
                          >
                            {isAiProofreading ? (
                              <MS name="progress_activity" size={18} className="animate-spin" />
                            ) : (
                              <MS name="auto_fix" size={18} />
                            )}
                          </button>
                        </div>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                            disabled={isRecordingAnyMedia}
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 21,
                              border: `1px solid ${isEmojiPickerOpen ? '#D7E8FF' : C.borderLight}`,
                              background: isEmojiPickerOpen ? '#EDF5FF' : '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: isRecordingAnyMedia ? 'default' : 'pointer',
                              flexShrink: 0,
                              opacity: isRecordingAnyMedia ? 0.6 : 1,
                              boxShadow: '0 2px 10px rgba(10,22,40,0.05)',
                              fontSize: 18,
                              lineHeight: 1,
                            }}
                            title="Открыть эмодзи"
                          >
                            <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <EmojiModeIcon color={isEmojiPickerOpen ? C.blue : '#7B8DA7'} />
                            </span>
                          </button>

                          {isEmojiPickerOpen ? (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                bottom: 'calc(100% + 12px)',
                                zIndex: 7,
                              }}
                            >
                              <EmojiPicker
                                onClose={() => setIsEmojiPickerOpen(false)}
                                onSelect={insertEmojiIntoInput}
                              />
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (recordHoldTriggeredRef.current) {
                              recordHoldTriggeredRef.current = false
                              return
                            }

                            if (hasDraftMessage) {
                              void sendMessage()
                              return
                            }

                            if (isSmartAgentChat) {
                              return
                            }

                            setSelectedRecorderMode((prev) => (prev === 'voice' ? 'video_message' : 'voice'))
                          }}
                          onMouseDown={(event) => {
                            if (isSmartAgentChat && !hasDraftMessage) return
                            handleRecordButtonPressStart(event.clientY)
                          }}
                          onTouchStart={(event: ReactTouchEvent<HTMLButtonElement>) => {
                            if (isSmartAgentChat && !hasDraftMessage) return
                            handleRecordButtonPressStart(event.touches[0]?.clientY ?? null)
                          }}
                          disabled={isSending || (isSmartAgentChat && !hasDraftMessage)}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            background: hasDraftMessage
                              ? `linear-gradient(135deg, ${C.blue} 0%, #4EA1FF 100%)`
                              : selectedRecorderMode === 'video_message'
                                ? '#EDF5FF'
                                : '#FFFFFF',
                            border: `1px solid ${hasDraftMessage ? `${C.blue}20` : selectedRecorderMode === 'video_message' ? '#D7E8FF' : C.borderLight}`,
                            cursor: isSending ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: hasDraftMessage
                              ? `0 8px 18px ${C.blue}33`
                              : selectedRecorderMode === 'video_message'
                                ? '0 6px 16px rgba(46,135,255,0.16)'
                                : '0 2px 10px rgba(10,22,40,0.05)',
                            flexShrink: 0,
                            opacity: isSending ? 0.6 : 1,
                            transition: 'background 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, transform 0.16s ease',
                          }}
                          title={
                            hasDraftMessage
                              ? 'Отправить сообщение'
                              : selectedRecorderMode === 'video_message'
                                ? 'Нажмите, чтобы переключить на голосовое сообщение. Удерживайте, чтобы записать видеокружок'
                                : 'Нажмите, чтобы переключить на видеокружок. Удерживайте, чтобы записать голосовое сообщение'
                          }
                        >
                          <MS
                            name={hasDraftMessage || isSmartAgentChat ? 'send' : 'mic'}
                            size={18}
                            color={hasDraftMessage ? '#fff' : C.inkMuted}
                            style={{
                              display: selectedRecorderMode === 'video_message' && !hasDraftMessage && !isSmartAgentChat ? 'none' : undefined,
                              marginLeft: hasDraftMessage || isSmartAgentChat ? 2 : 0,
                            }}
                          />
                          {selectedRecorderMode === 'video_message' && !hasDraftMessage && !isSmartAgentChat ? (
                            <VideoMessageModeIcon color="#7B8DA7" />
                          ) : null}
                        </button>
                      </>
                    )}

                  </>
                )}
              </div>


            </div>
          </>
        )}
      </div>
      ) : null}

      {showInfo && activeChat && activeChat.chat.type === 'personal' ? (
        isMobileLayout ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 250,
              background: 'rgba(10,22,40,0.24)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
            onClick={() => setShowInfo(false)}
          >
            <div
              style={{ width: 'min(100%, 420px)', height: '100%' }}
              onClick={(event) => event.stopPropagation()}
            >
              <InfoPanel
                activeChat={activeChat}
                currentUserId={currentUser?.id ?? null}
                activePeerId={activePeerId}
                groupMembers={activeGroupMembers}
                groupMembersError={groupMembersError}
                groupMembersActionError={groupMembersActionError}
                isGroupMembersUpdating={isGroupMembersUpdating}
                directoryUsers={directoryUsers}
                isSearchingUsers={isSearchingUsers}
                userSearchError={userSearchError}
                onLoadDirectoryUsers={() => void loadDirectoryUsers()}
                onAddGroupMember={(userId) => void addGroupMember(userId)}
                onRemoveGroupMember={(userId) => void removeGroupMember(userId)}
                onUpdateGroupMemberRole={(userId, role) => void updateGroupMemberRole(userId, role)}
                onLeaveGroup={() => void leaveActiveGroup()}
                onOpenUserProfile={(userId) => void openUserProfile(userId)}
                groupDescription={activeGroupDetails?.description ?? null}
                onClose={() => setShowInfo(false)}
                isMobile
                isMuted={activeChat?.chat?.isMuted ?? false}
                muteBusy={muteToggleBusy}
                onToggleMute={() => void toggleActiveChatMute()}
              />
            </div>
          </div>
        ) : (
          <InfoPanel
            activeChat={activeChat}
            currentUserId={currentUser?.id ?? null}
            activePeerId={activePeerId}
            groupMembers={activeGroupMembers}
            groupMembersError={groupMembersError}
            groupMembersActionError={groupMembersActionError}
            isGroupMembersUpdating={isGroupMembersUpdating}
            directoryUsers={directoryUsers}
            isSearchingUsers={isSearchingUsers}
            userSearchError={userSearchError}
            onLoadDirectoryUsers={() => void loadDirectoryUsers()}
            onAddGroupMember={(userId) => void addGroupMember(userId)}
            onRemoveGroupMember={(userId) => void removeGroupMember(userId)}
            onUpdateGroupMemberRole={(userId, role) => void updateGroupMemberRole(userId, role)}
            onLeaveGroup={() => void leaveActiveGroup()}
            onOpenUserProfile={(userId) => void openUserProfile(userId)}
            groupDescription={activeGroupDetails?.description ?? null}
            onClose={() => setShowInfo(false)}
            isMuted={activeChat?.chat?.isMuted ?? false}
            muteBusy={muteToggleBusy}
            onToggleMute={() => void toggleActiveChatMute()}
          />
        )
      ) : null}

      <GroupProfileModal
        isOpen={showInfo && !!activeChat && activeChat.chat.type === 'group'}
        onClose={() => setShowInfo(false)}
        activeChat={activeChat}
        currentUserId={currentUser?.id ?? null}
        groupDetails={activeGroupDetails}
        groupMembers={activeGroupMembers}
        groupMembersError={groupMembersError}
        groupMembersActionError={groupMembersActionError}
        isGroupMembersUpdating={isGroupMembersUpdating}
        directoryUsers={directoryUsers}
        isSearchingUsers={isSearchingUsers}
        userSearchError={userSearchError}
        onLoadDirectoryUsers={loadDirectoryUsers}
        onAddGroupMember={(userId) => void addGroupMember(userId)}
        onRemoveGroupMember={(userId) => void removeGroupMember(userId)}
        onUpdateGroupMemberRole={(userId, role) => void updateGroupMemberRole(userId, role)}
        onLeaveGroup={() => void leaveActiveGroup()}
        onOpenUserProfile={(userId) => void openUserProfile(userId)}
        isMuted={activeChat?.chat?.isMuted ?? false}
        muteBusy={muteToggleBusy}
        onToggleMute={() => void toggleActiveChatMute()}
        onCall={() => void handleStartActiveChatCall()}
      />

      <ChannelProfileModal
        isOpen={Boolean(showInfo && activeChat?.chat?.type === 'channel')}
        onClose={() => setShowInfo(false)}
        activeChat={activeChat}
        currentUserId={currentUser?.id ?? null}
        channelView={channelDetails}
        channelAdmins={channelAdmins}
        channelMembers={channelMembers}
        memberCount={channelDetails?.memberCount ?? 0}
        isAdmin={channelDetails?.myRole === 'admin' || channelDetails?.myRole === 'owner'}
        isOwner={channelDetails?.myRole === 'owner'}
        isSubscribed={channelDetails?.isSubscribed ?? false}
        onSubscribe={() => activeChatId && void subscribeToChannel(activeChatId)}
        onUnsubscribe={() => activeChatId && void unsubscribeFromChannel(activeChatId)}
        directoryUsers={directoryUsers}
        isSearchingUsers={isSearchingUsers}
        userSearchError={userSearchError}
        onLoadDirectoryUsers={loadDirectoryUsers}
        onAddMembers={(userIds) => activeChatId && void addChannelMembers(activeChatId, userIds)}
        membersError={channelMembersError}
        onRemoveMember={(userId) => activeChatId && void removeChannelMember(activeChatId, userId)}
        onUpdateMemberRole={(userId, role) => activeChatId && void updateChannelMemberRole(activeChatId, userId, role)}
        onOpenUserProfile={(userId) => void openUserProfile(userId)}
        onLoadMoreMembers={() => activeChatId && void loadChannelMembers(activeChatId)}
        isLoadingMembers={isLoadingChannelMembers}
        isLoadingAdmins={isLoadingChannelAdmins}
        onUpdateChannel={handleUpdateChannel}
        onUpdateAvatar={handleUpdateChannelAvatar || (async () => { console.error('handleUpdateChannelAvatar is undefined'); })}
        isMuted={channelDetails?.isMuted ?? activeChat?.chat?.isMuted ?? false}
        muteBusy={muteToggleBusy}
        onToggleMute={() => void toggleActiveChatMute()}
      />


      {openedImageMessage ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(7,11,18,0.92)',
            backdropFilter: 'blur(18px)',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={closeImageViewer}
        >
          <div
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              top: 18,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              color: '#F8FBFF',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                {openedImageMessage.from === 'me' ? 'Вы' : openedImageMessage.senderLabel}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(248,251,255,0.72)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>{openedImageMessage.time}</span>
                {imageMessages.length > 1 ? <span>{`${openedImageIndex + 1} из ${imageMessages.length}`}</span> : null}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => downloadMessageAsset(openedImageMessage)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Скачать"
              >
                <MS name="download" size={20} color="#F8FBFF" />
              </button>
              <button
                type="button"
                onClick={closeImageViewer}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Закрыть"
              >
                <MS name="close" size={20} color="#F8FBFF" />
              </button>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '86px 24px 28px',
            }}
          >
            {imageMessages.length > 1 ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  showPreviousImage()
                }}
                style={{
                  position: 'absolute',
                  left: 24,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 14px 32px rgba(0,0,0,0.18)',
                }}
                title="Предыдущее фото"
              >
                <MS name="chevron_left" size={28} color="#F8FBFF" />
              </button>
            ) : null}

            <div
              style={{
                maxWidth: 'min(92vw, 1320px)',
                maxHeight: 'calc(100vh - 140px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 28px 90px rgba(0,0,0,0.42)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={openedImageMessage.mediaUrl}
                alt="Открытое изображение"
                style={{
                  display: 'block',
                  maxWidth: 'min(92vw, 1320px)',
                  maxHeight: 'calc(100vh - 140px)',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  background: 'rgba(255,255,255,0.02)',
                }}
              />
            </div>

            {imageMessages.length > 1 ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  showNextImage()
                }}
                style={{
                  position: 'absolute',
                  right: 24,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 14px 32px rgba(0,0,0,0.18)',
                }}
                title="Следующее фото"
              >
                <MS name="chevron_right" size={28} color="#F8FBFF" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {openedVideoMessage ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(7,11,18,0.94)',
            backdropFilter: 'blur(18px)',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={closeVideoViewer}
        >
          <div
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              top: 18,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              color: '#F8FBFF',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                {openedVideoMessage.from === 'me' ? 'Вы' : openedVideoMessage.senderLabel}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(248,251,255,0.72)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>{openedVideoMessage.time}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => downloadMessageAsset(openedVideoMessage)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Скачать"
              >
                <MS name="download" size={20} color="#F8FBFF" />
              </button>
              <button
                type="button"
                onClick={closeVideoViewer}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Закрыть"
              >
                <MS name="close" size={20} color="#F8FBFF" />
              </button>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '86px 24px 28px',
            }}
          >
            <div
              style={{
                width: 'min(92vw, 1320px)',
                maxHeight: 'calc(100vh - 140px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 28px 90px rgba(0,0,0,0.42)',
                background: 'rgba(255,255,255,0.02)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <video
                src={openedVideoMessage.videoUrl || undefined}
                controls
                autoPlay
                playsInline
                preload="metadata"
                style={{
                  display: 'block',
                  width: '100%',
                  maxHeight: 'calc(100vh - 140px)',
                  background: '#000000',
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {isPinnedMessagesPanelOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(242,245,250,0.72)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            padding: '52px 24px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
          onClick={() => setIsPinnedMessagesPanelOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 920,
              height: 'auto',
              maxHeight: 'calc(100% - 76px)',
              background: C.surface,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              borderRadius: 28,
              overflow: 'hidden',
              boxShadow: '0 28px 90px rgba(10,22,40,0.16)',
              border: `1px solid ${C.borderLight}`,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: 82,
                padding: '20px 22px 18px',
                borderBottom: `1px solid ${C.borderLight}`,
                background: 'linear-gradient(180deg, #FFFFFF 0%, #F9FBFF 100%)',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setIsPinnedMessagesPanelOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  border: `1px solid ${C.borderLight}`,
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="Закрыть"
              >
                <MS name="arrow_back" size={18} color={C.inkMuted} />
              </button>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.25, color: C.ink }}>
                  Закрепленные сообщения
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: C.inkMuted }}>
                  {pinnedMessages.length} сообщений
                </div>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '30px 28px 104px',
                background: 'linear-gradient(180deg, #F8FBFF 0%, #F2F6FC 100%)',
              }}
            >
              <div style={{ width: '100%', maxWidth: 760, margin: '0 auto', display: 'grid', gap: 16 }}>
                {pinnedMessages.map((pinned, index) => {
                  const message =
                    messages.find((item) => item.raw.id === pinned.messageId) ??
                    resolvedPinnedMessageViews[pinned.messageId] ??
                    null
                  const previousPinned = index > 0 ? pinnedMessages[index - 1] : null
                  const previousDate = previousPinned
                    ? messages.find((item) => item.raw.id === previousPinned.messageId)?.raw.createdAt ??
                      resolvedPinnedMessageViews[previousPinned.messageId]?.raw.createdAt ??
                      previousPinned.createdAt
                    : null
                  const senderName =
                    message?.senderLabel ??
                    (pinned.pinnedBy === currentUser?.id ? currentUser?.name : `Пользователь #${pinned.pinnedBy}`)
                  const messageDate = message?.raw.createdAt ?? pinned.createdAt
                  const rawPreview = message?.text?.trim() || pinned.content?.trim() || `Сообщение #${pinned.messageId}`
                  const preview = getFriendlyMessageText(rawPreview, pinned.type || message?.kind || 'text')
                  const shouldShowDateChip = !previousDate || !isSameCalendarDate(previousDate, messageDate)
                  const isMine = message?.from === 'me'

                  return (
                    <div key={pinned.id} style={{ display: 'grid', gap: 10 }}>
                      {shouldShowDateChip ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <div
                            style={{
                              padding: '7px 15px',
                              borderRadius: 999,
                              background: 'rgba(221,233,248,0.96)',
                              color: C.inkSub,
                              fontSize: 12,
                              fontWeight: 800,
                              boxShadow: '0 6px 16px rgba(10,22,40,0.05)',
                            }}
                          >
                            {formatDaySeparatorLabel(messageDate)}
                          </div>
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 10, alignItems: 'flex-end' }}>
                        {!isMine ? (
                          <MessengerAvatar
                            initials={getInitials(senderName)}
                            size={36}
                            seed={getSeed(senderName)}
                          />
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handlePinnedListItemClick(pinned.messageId, index)}
                          style={{
                            width: '100%',
                            maxWidth: 430,
                            border: `1px solid ${index === activePinnedIndex ? `${C.blue}33` : 'transparent'}`,
                            borderRadius: isMine ? '22px 22px 10px 22px' : '22px 22px 22px 10px',
                            background: isMine ? '#DCEEFF' : '#FFFFFF',
                            padding: '14px 16px 14px 18px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'grid',
                            gap: 10,
                            boxShadow: isMine ? '0 12px 28px rgba(30,136,229,0.14)' : '0 8px 24px rgba(10,22,40,0.08)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: isMine ? C.blueDark : C.ink }}>
                                {senderName}
                              </div>
                              <div style={{ marginTop: 3, fontSize: 12, color: C.inkMuted }}>
                                {isSameCalendarDate(messageDate, new Date().toISOString()) ? 'Сегодня' : formatDaySeparatorLabel(messageDate)}
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: C.inkMuted, flexShrink: 0 }}>
                              {formatMessageTime(messageDate)}
                            </div>
                          </div>

                          <div
                            style={{
                              borderLeft: `3px solid ${C.blue}`,
                              paddingLeft: 12,
                              fontSize: 14,
                              lineHeight: 1.45,
                              color: C.ink,
                              display: '-webkit-box',
                              WebkitLineClamp: 4,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {preview}
                          </div>
                        </button>

                        {isMine ? (
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 19,
                              background: '#FFFFFF',
                              border: `1px solid ${C.borderLight}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 12px rgba(10,22,40,0.06)',
                              flexShrink: 0,
                            }}
                          >
                            <MS name="arrow_outward" size={18} color={C.blue} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 64,
                borderTop: `1px solid ${C.borderLight}`,
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 18px',
              }}
            >
              <button
                type="button"
                onClick={() => void handleUnpinAllPinnedMessages()}
                disabled={isMessageActionLoading || pinnedMessages.length === 0}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: C.blue,
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  cursor: isMessageActionLoading || pinnedMessages.length === 0 ? 'default' : 'pointer',
                  opacity: isMessageActionLoading || pinnedMessages.length === 0 ? 0.5 : 1,
                }}
              >
                {isMessageActionLoading ? 'Открепляем...' : `UNPIN ALL ${pinnedMessages.length} MESSAGES`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {chatListContextMenu && chatListContextMenuTarget ? (
        <>
          <div
            data-chat-list-context-menu="true"
            style={{
              position: 'fixed',
              left: chatListContextMenu.x,
              top: chatListContextMenu.y,
              width: 236,
              background: '#242428',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.28)',
              padding: 8,
              zIndex: 1100,
              maxHeight: 'calc(100vh - 24px)',
              overflowY: 'auto',
            }}
          >
            <button
              type="button"
              onClick={() => void handleToggleContextChatMute()}
              disabled={isChatListActionLoading}
              style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: isChatListActionLoading ? 'default' : 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, opacity: isChatListActionLoading ? 0.6 : 1 }}
            >
              <MS name={chatListContextMenuTarget.chat.isMuted ? 'notifications' : 'notifications_off'} size={18} color="#F4F6FB" />
              {chatListContextMenuTarget.chat.isMuted ? 'Включить уведомления' : 'Без звука'}
            </button>

            {MESSENGER_VIDEO_CALLS_ENABLED && chatListContextMenuTarget.chat.id !== 'smart-agent' && (chatListContextMenuTarget.chat.type === 'group' || chatListContextMenuTarget.chat.type === 'personal') ? (
              <button
                type="button"
                onClick={() => {
                  const target = chatListContextMenuTarget
                  setChatListContextMenu(null)
                  void (async () => {
                    try {
                      setIsChatListActionLoading(true)
                      if (target.chat.type === 'group') {
                        await startGroupCall({
                          groupId: target.chat.id,
                          displayName: target.title,
                        })
                        try {
                          await chatRepository.sendMessage({
                            chatId: target.chat.id,
                            chatType: 'group',
                            content: 'Видеозвонок',
                            type: 'text',
                            metadata: JSON.stringify({
                              type: 'video_call',
                              status: 'initiated',
                              direction: 'outgoing',
                              call_start_at: new Date().toISOString()
                            })
                          })
                        } catch {}
                      } else {
                        const peerId = Number(target.chat.id)
                        if (peerId > 0) {
                          await startDirectCall({
                            calleeId: peerId,
                            chatId: target.chat.id,
                            displayName: target.title,
                          })

                          // send system message for direct call from context menu
                          try {
                            await chatRepository.sendMessage({
                              chatId: target.chat.id,
                              chatType: 'personal',
                              content: 'Видеозвонок',
                              type: 'text',
                              metadata: JSON.stringify({
                                type: 'video_call',
                                status: 'initiated',
                                direction: 'outgoing',
                                call_start_at: new Date().toISOString()
                              })
                            })
                          } catch {}
                        }
                      }
                    } catch (e) {
                      setError(getErrorMessage(e, 'Не удалось начать видеозвонок.'))
                    } finally {
                      setIsChatListActionLoading(false)
                    }
                  })()
                }}
                disabled={isChatListActionLoading || isCallBusy}
                style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: isChatListActionLoading || isCallBusy ? 'default' : 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, opacity: isChatListActionLoading || isCallBusy ? 0.6 : 1 }}
              >
                <MS name="videocam" size={18} color="#F4F6FB" />
                Видеозвонок
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void handleToggleChatPin(chatListContextMenuTarget)}
              disabled={isChatListActionLoading}
              style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: isChatListActionLoading ? 'default' : 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, opacity: isChatListActionLoading ? 0.6 : 1 }}
            >
              <PinnedIcon size={18} color="#F4F6FB" />
              {chatListContextMenuTarget.chat.type === 'group'
                ? chatListContextMenuTarget.chat.isPinned
                  ? 'Открепить группу'
                  : 'Закрепить группу'
                : chatListContextMenuTarget.chat.isPinned
                  ? 'Открепить чат'
                  : 'Закрепить чат'}
            </button>

            <button
              type="button"
              onClick={toggleChatListFolderMenu}
              disabled={isChatListActionLoading}
              style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: chatListContextMenu.isFolderMenuOpen ? 'rgba(255,255,255,0.08)' : 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: isChatListActionLoading ? 'default' : 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, opacity: isChatListActionLoading ? 0.5 : 1 }}
            >
              <MS name="folder" size={18} color="#F4F6FB" />
              <span style={{ flex: 1 }}>
                {chatListContextMenuFolderId ? 'Изменить папку' : 'Добавить в папку'}
              </span>
              <MS name="chevron_right" size={16} color="#AEBBCE" />
            </button>

            {chatListContextMenuTarget.chat.type === 'group' ? (
              <button
                type="button"
                onClick={() => void handleOpenGroupEditModal(chatListContextMenuTarget)}
                disabled={isChatListActionLoading}
                style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: isChatListActionLoading ? 'default' : 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, opacity: isChatListActionLoading ? 0.6 : 1 }}
              >
                <MS name="edit" size={18} color="#F4F6FB" />
                Изменить группу
              </button>
            ) : null}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 4px' }} />

            <button
              type="button"
              onClick={() => handleRequestDeleteChat(chatListContextMenuTarget.chat.id)}
              disabled={isChatListActionLoading}
              style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#FF6767', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: isChatListActionLoading ? 'default' : 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, opacity: isChatListActionLoading ? 0.6 : 1 }}
            >
              <MS name={chatListContextMenuTarget.chat.type === 'channel' ? 'logout' : 'delete'} size={18} color="#FF6767" />
              {chatListContextMenuTarget.chat.type === 'group' ? 'Удалить группу' : chatListContextMenuTarget.chat.type === 'channel' ? 'Покинуть канал' : 'Удалить чат'}
            </button>
          </div>

          {chatListContextMenu.isFolderMenuOpen ? (
            <div
              data-chat-list-context-menu="true"
              style={{
                position: 'fixed',
                left:
                  typeof window === 'undefined'
                    ? chatListContextMenu.x + 244
                    : Math.max(12, Math.min(chatListContextMenu.x + 244, window.innerWidth - 236 - 12)),
                top:
                  typeof window === 'undefined'
                    ? chatListContextMenu.y + 44
                    : Math.max(12, Math.min(chatListContextMenu.y + 44, window.innerHeight - 320 - 12)),
                width: 236,
                boxShadow: '0 20px 40px rgba(0,0,0,0.28)',
                background: '#242428',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 8,
                zIndex: 1110,
                maxHeight: 'min(320px, calc(100vh - 24px))',
                overflowY: 'auto',
              }}
            >
              {folders.length === 0 ? (
                <div
                  style={{
                    padding: '10px 12px 12px',
                    fontSize: 12,
                    lineHeight: 1.45,
                    color: '#AEBBCE',
                  }}
                >
                  Папок пока нет. Создайте новую папку и сразу переместите в неё этот чат.
                </div>
              ) : null}

              {chatListContextMenuFolderId ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleRemoveContextChatFromFolder()}
                    disabled={isFolderUpdating}
                    style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: isFolderUpdating ? 'default' : 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, opacity: isFolderUpdating ? 0.6 : 1 }}
                  >
                    <MS name="close" size={18} color="#F4F6FB" />
                    Убрать из папки
                  </button>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 4px' }} />
                </>
              ) : null}

              {folders.map((folder) => {
                const isAssigned = chatListContextMenuFolderId === folder.id

                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => void handleAssignContextChatToFolder(folder.id)}
                    disabled={isFolderUpdating}
                    style={{ width: '100%', minHeight: 42, borderRadius: 12, border: 'none', background: isAssigned ? 'rgba(255,255,255,0.08)' : 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', cursor: isFolderUpdating ? 'default' : 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, opacity: isFolderUpdating ? 0.6 : 1 }}
                  >
                    <MS name={isAssigned ? 'check_circle' : 'folder'} size={18} color={isAssigned ? '#67B4FF' : '#F4F6FB'} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {folder.name}
                    </span>
                  </button>
                )
              })}

              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 4px' }} />
              <button
                type="button"
                onClick={() => {
                  closeChatListContextMenu()
                  setIsFolderModalOpen(true)
                  setPendingFolderAssignmentTarget({
                    chatId: chatListContextMenuTarget.chat.id,
                    chatType: chatListContextMenuTarget.chat.type,
                  })
                  setEditingFolderId(null)
                  setFolderName('')
                  setFolderError('')
                }}
                style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#67B4FF', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600 }}
              >
                <MS name="add" size={18} color="#67B4FF" />
                Новая папка
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {messageContextMenu && contextMenuMessage ? (
        <div
          data-message-context-menu="true"
          style={{
            position: 'fixed',
            left: messageContextMenu.x,
            top: messageContextMenu.y,
            width: 220,
            background: '#242428',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            boxShadow: '0 20px 40px rgba(0,0,0,0.28)',
            padding: 8,
            zIndex: 1100,
            maxHeight: 'calc(100vh - 24px)',
            overflowY: 'auto',
          }}
        >
          {/* Быстрые реакции */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '4px 4px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 4 }}>
            {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((emoji) => {
              const alreadyReacted = (contextMenuMessage.raw.reactions ?? []).some((r) => r.reaction === emoji && r.reacted)
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    closeMessageContextMenu()
                    if (alreadyReacted) {
                      void handleRemoveReaction(contextMenuMessage.raw.id, emoji)
                    } else {
                      void handleAddReaction(contextMenuMessage.raw.id, emoji)
                    }
                  }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: alreadyReacted ? '1.5px solid #4C9EFF' : '1.5px solid transparent',
                    background: alreadyReacted ? 'rgba(76,158,255,0.18)' : 'rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    transition: 'background 0.14s ease, border-color 0.14s ease, transform 0.1s ease',
                    padding: 0,
                  }}
                  title={alreadyReacted ? `Убрать ${emoji}` : `Реагировать ${emoji}`}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
          {canManageChannelPosts && (
            <>
              <button type="button" onClick={() => { closeMessageContextMenu(); void handleTogglePinMessage(contextMenuMessage.raw.id) }} style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600 }}>
                <PinnedIcon size={18} color="#F4F6FB" />
                {pinnedMessageIds.has(contextMenuMessage.raw.id) ? 'Открепить' : 'Закрепить'}
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMessageContextMenu()
                  setReplyTarget({
                    id: contextMenuMessage.raw.id,
                    senderId: contextMenuMessage.raw.senderId,
                    senderFullName: contextMenuMessage.senderLabel,
                    content: contextMenuMessage.text,
                    type: contextMenuMessage.raw.type,
                    attachmentUrl: contextMenuMessage.raw.attachmentUrl,
                    attachmentType: contextMenuMessage.raw.attachmentType,
                  })
                  messageInputRef.current?.focus()
                }}
                style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600 }}
              >
                <MS name="arrow_back" size={18} color="#F4F6FB" />
                Ответить
              </button>
            </>
          )}
          {canManageChannelPosts && contextMenuMessage.raw.senderId === currentUser?.id && (
            <button type="button" onClick={() => { closeMessageContextMenu(); void handleLoadMessageViewers(contextMenuMessage.raw.id) }} style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600 }}>
              <MS name="visibility" size={18} color="#F4F6FB" />
              Прочитали
            </button>
          )}
          {(contextMenuMessage.attachment?.url ?? contextMenuMessage.audioUrl ?? contextMenuMessage.videoUrl ?? contextMenuMessage.mediaUrl ?? contextMenuMessage.raw.attachmentUrl) ? (
            <button type="button" onClick={() => { closeMessageContextMenu(); handleDownloadSelectedMessage(contextMenuMessage.raw.id) }} style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600 }}>
              <MS name="download" size={18} color="#F4F6FB" />
              Скачать
            </button>
          ) : null}
          {canManageChannelPosts && contextMenuMessage.raw.senderId === currentUser?.id && contextMenuMessage.kind === 'text' ? (
            <button type="button" onClick={() => { closeMessageContextMenu(); handleEditSelectedMessage(contextMenuMessage.raw.id) }} style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600 }}>
              <MS name="edit" size={18} color="#F4F6FB" />
              Изменить
            </button>
          ) : null}
          {canManageChannelPosts && (
            <>
              <button type="button" onClick={() => { closeMessageContextMenu(); toggleMessageSelection(contextMenuMessage.raw.id, true) }} style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#F4F6FB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600 }}>
                <MS name="check" size={18} color="#F4F6FB" />
                Выбрать
              </button>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 4px' }} />
              <button type="button" onClick={() => { setDeleteTargetMessageIds([contextMenuMessage.raw.id]); closeMessageContextMenu(); setIsDeleteConfirmOpen(true) }} style={{ width: '100%', height: 42, borderRadius: 12, border: 'none', background: 'transparent', color: '#FF6767', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600 }}>
                <MS name="delete" size={18} color="#FF6767" />
                Удалить
              </button>
            </>
          )}
        </div>
      ) : null}

      {isChatDeleteConfirmOpen && chatDeleteTarget ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,22,40,0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 70,
            padding: 16,
          }}
          onClick={() => {
            setIsChatDeleteConfirmOpen(false)
            setChatDeleteTargetId(null)
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 400,
              background: C.surface,
              borderRadius: 20,
              border: `1px solid ${C.borderLight}`,
              boxShadow: '0 24px 60px rgba(10,22,40,0.16)',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '18px 20px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>
                {chatDeleteTarget.chat.type === 'group' ? 'Удалить группу' : chatDeleteTarget.chat.type === 'channel' ? 'Покинуть канал' : 'Удалить чат'}
              </div>
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4, lineHeight: 1.5 }}>
                {chatDeleteTarget.chat.type === 'group'
                  ? 'Группа будет удалена. Это действие нельзя отменить.'
                  : chatDeleteTarget.chat.type === 'channel'
                    ? 'Вы отпишетесь от этого канала и он будет скрыт из списка.'
                    : 'Чат будет скрыт из списка. При новом сообщении он снова появится.'}
              </div>
            </div>
            <div style={{ padding: '18px 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setIsChatDeleteConfirmOpen(false)
                  setChatDeleteTargetId(null)
                }}
                style={{ height: 38, padding: '0 14px', borderRadius: 10, border: `1px solid ${C.borderLight}`, background: '#FFFFFF', color: C.inkMuted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteChat()}
                disabled={isChatListActionLoading}
                style={{ height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: C.red, color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: isChatListActionLoading ? 'default' : 'pointer', opacity: isChatListActionLoading ? 0.6 : 1 }}
              >
                {chatDeleteTarget.chat.type === 'group' ? 'Удалить группу' : chatDeleteTarget.chat.type === 'channel' ? 'Покинуть канал' : 'Удалить чат'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isGroupEditModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,22,40,0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 70,
            padding: 16,
          }}
          onClick={closeGroupEditModal}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              background: C.surface,
              borderRadius: 20,
              border: `1px solid ${C.borderLight}`,
              boxShadow: '0 24px 60px rgba(10,22,40,0.16)',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '18px 20px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Изменить группу</div>
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4 }}>Обновите название и описание группы.</div>
            </div>
            <div style={{ padding: '18px 20px 20px', display: 'grid', gap: 12 }}>
              {isGroupEditLoading ? (
                <div style={{ fontSize: 13, color: C.inkMuted }}>Загрузка параметров группы...</div>
              ) : (
                <>
                  <input
                    value={groupEditName}
                    onChange={(event) => setGroupEditName(event.target.value)}
                    placeholder="Название группы"
                    style={{
                      width: '100%',
                      height: 42,
                      borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      background: C.canvas,
                      padding: '0 12px',
                      outline: 'none',
                      fontSize: 13,
                      color: C.ink,
                      fontFamily: 'inherit',
                    }}
                  />
                  <textarea
                    value={groupEditDescription}
                    onChange={(event) => setGroupEditDescription(event.target.value)}
                    placeholder="Описание группы"
                    rows={4}
                    style={{
                      width: '100%',
                      borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      background: C.canvas,
                      padding: '10px 12px',
                      outline: 'none',
                      fontSize: 13,
                      color: C.ink,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </>
              )}
              {groupEditError ? <div style={{ fontSize: 12, color: C.red }}>{groupEditError}</div> : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={closeGroupEditModal}
                  disabled={isGroupEditSaving}
                  style={{ height: 38, padding: '0 14px', borderRadius: 10, border: `1px solid ${C.borderLight}`, background: '#FFFFFF', color: C.inkMuted, fontSize: 13, fontWeight: 700, cursor: isGroupEditSaving ? 'default' : 'pointer', opacity: isGroupEditSaving ? 0.6 : 1 }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitGroupEdit()}
                  disabled={isGroupEditLoading || isGroupEditSaving || !groupEditTargetId || !groupEditName.trim()}
                  style={{ height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.blue} 0%, #4EA1FF 100%)`, color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: isGroupEditLoading || isGroupEditSaving || !groupEditTargetId || !groupEditName.trim() ? 'default' : 'pointer', opacity: isGroupEditLoading || isGroupEditSaving || !groupEditTargetId || !groupEditName.trim() ? 0.7 : 1 }}
                >
                  {isGroupEditSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteConfirmOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,22,40,0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: 16,
          }}
          onClick={() => {
            setIsDeleteConfirmOpen(false)
            setDeleteTargetMessageIds(null)
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 380,
              background: C.surface,
              borderRadius: 20,
              border: `1px solid ${C.borderLight}`,
              boxShadow: '0 24px 60px rgba(10,22,40,0.16)',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '18px 20px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Удалить сообщения</div>
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4 }}>Это действие нельзя отменить.</div>
            </div>
            <div style={{ padding: '18px 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => { setIsDeleteConfirmOpen(false); setDeleteTargetMessageIds(null) }} style={{ height: 38, padding: '0 14px', borderRadius: 10, border: `1px solid ${C.borderLight}`, background: '#FFFFFF', color: C.inkMuted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
              <button type="button" onClick={() => void handleDeleteSelectedMessages()} disabled={isMessageActionLoading} style={{ height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: C.red, color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: isMessageActionLoading ? 0.6 : 1 }}>Удалить</button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,22,40,0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: 16,
          }}
          onClick={() => { setIsEditModalOpen(false); setEditTargetMessageId(null) }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              background: C.surface,
              borderRadius: 20,
              border: `1px solid ${C.borderLight}`,
              boxShadow: '0 24px 60px rgba(10,22,40,0.16)',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '18px 20px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Изменить сообщение</div>
            </div>
            <div style={{ padding: 16 }}>
              <textarea
                value={editDraft}
                onChange={(event) => setEditDraft(event.target.value)}
                rows={5}
                style={{
                  width: '100%',
                  borderRadius: 14,
                  border: `1px solid ${C.borderLight}`,
                  background: '#FFFFFF',
                  padding: '12px 14px',
                  outline: 'none',
                  fontSize: 14,
                  color: C.ink,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => { setIsEditModalOpen(false); setEditTargetMessageId(null) }} style={{ height: 38, padding: '0 14px', borderRadius: 10, border: `1px solid ${C.borderLight}`, background: '#FFFFFF', color: C.inkMuted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отмена</button>
              <button type="button" onClick={() => void confirmEditSelectedMessage()} disabled={!editDraft.trim() || isMessageActionLoading} style={{ height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: C.blue, color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !editDraft.trim() || isMessageActionLoading ? 0.6 : 1 }}>Сохранить</button>
            </div>
          </div>
        </div>
      ) : null}

      {isViewersModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,22,40,0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: 16,
          }}
          onClick={() => setIsViewersModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: C.surface,
              borderRadius: 20,
              border: `1px solid ${C.borderLight}`,
              boxShadow: '0 24px 60px rgba(10,22,40,0.16)',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '18px 20px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>Прочитали</div>
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4 }}>{messageViewers.length} пользователей</div>
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto', padding: 16, display: 'grid', gap: 10 }}>
              {messageViewers.length === 0 ? (
                <div style={{ fontSize: 13, color: C.inkMuted }}>Пока данных нет.</div>
              ) : (
                messageViewers.map((viewer) => (
                  <div
                    key={`${viewer.userId}-${viewer.readAt}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${C.borderLight}`,
                      background: '#FFFFFF',
                    }}
                  >
                    <MessengerAvatar initials={getInitials(viewer.fullName)} imageUrl={viewer.avatarUrl} size={36} seed={getSeed(viewer.fullName)} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{viewer.fullName}</div>
                      <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2 }}>{formatTimeLabel(viewer.readAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsViewersModalOpen(false)}
                style={{
                  height: 38,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: `1px solid ${C.borderLight}`,
                  background: '#FFFFFF',
                  color: C.inkMuted,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <UserProfileModal
        isOpen={isUserProfileModalOpen}
        user={profileUser}
        currentUserId={currentUser?.id ?? null}
        isOnline={profileUserPresence}
        isLoading={isUserProfileLoading}
        error={userProfileError}
        onRetry={retryOpenUserProfile}
        onClose={() => setIsUserProfileModalOpen(false)}
        onOpenChat={openChatFromProfile}
        onOpenUserProfile={(userId) => void openUserProfile(userId)}
        onSubmitReview={handleSubmitProfileReview}
        onCall={profileUser && profileUser.id > 0 ? () => {
          void startCallWithUser(profileUser.id, profileUser.fullName || profileUser.username || `User ${profileUser.id}`)
        } : undefined}
        personalChatMute={profilePersonalMuteControls}
      />

      <MessengerThemePanel
        open={isThemePanelOpen}
        isMobile={isMobileLayout}
        draft={chatThemeDraft}
        hasSavedTheme={hasSavedChatTheme}
        isSaving={isThemeSaving}
        isResetting={isThemeResetting}
        isUploadingImage={isThemeImageUploading}
        error={chatThemeError}
        onClose={closeThemePanel}
        onChange={handleThemeDraftChange}
        onUploadImage={(file) => void handleThemeImageUpload(file)}
        onSave={() => void handleSaveTheme()}
        onReset={() => void handleResetTheme()}
      />

      {isFolderModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,22,40,0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => {
            if (isCreatingFolder) {
              return
            }

            setIsFolderModalOpen(false)
            setPendingFolderAssignmentTarget(null)
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 380,
              background: C.surface,
              borderRadius: 20,
              border: `1px solid ${C.borderLight}`,
              boxShadow: '0 24px 60px rgba(10,22,40,0.16)',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '18px 20px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>{editingFolderId ? 'Изменить папку' : 'Новая папка'}</div>
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4 }}>
                {editingFolderId
                  ? 'Обновите название папки или удалите её.'
                  : pendingFolderAssignmentTarget
                    ? 'Создайте папку, и выбранный чат сразу будет добавлен в неё.'
                    : 'Создайте папку для группировки чатов.'}
              </div>
            </div>

            <div style={{ padding: 20 }}>
              {folders.length > 0 ? (
                <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                  {folders.map((folder) => {
                    const isEditing = editingFolderId === folder.id
                    return (
                      <div
                        key={folder.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: `1px solid ${isEditing ? `${C.blue}44` : C.borderLight}`,
                          background: isEditing ? C.blueSoft : '#FFFFFF',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <MS name="folder" size={16} color={isEditing ? C.blue : C.inkMuted} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {folder.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFolderId(folder.id)
                              setFolderName(folder.name)
                              setFolderError('')
                            }}
                            disabled={isCreatingFolder || isDeletingFolder}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              border: `1px solid ${C.borderLight}`,
                              background: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: isCreatingFolder || isDeletingFolder ? 'default' : 'pointer',
                            }}
                            title="Изменить"
                          >
                            <MS name="edit" size={15} color={C.inkMuted} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteFolder(folder.id)}
                            disabled={isCreatingFolder || isDeletingFolder}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              border: `1px solid ${C.borderLight}`,
                              background: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: isCreatingFolder || isDeletingFolder ? 'default' : 'pointer',
                              opacity: isCreatingFolder || isDeletingFolder ? 0.6 : 1,
                            }}
                            title="Удалить"
                          >
                            <MS name="delete" size={15} color={C.red} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              <input
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="Например, Работа"
                autoFocus
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: C.canvas,
                  padding: '0 14px',
                  outline: 'none',
                  fontSize: 14,
                  color: C.ink,
                  fontFamily: 'inherit',
                }}
              />
              {folderError ? <div style={{ marginTop: 10, fontSize: 12, color: C.red }}>{folderError}</div> : null}
            </div>

            <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setIsFolderModalOpen(false)
                  setEditingFolderId(null)
                  setFolderName('')
                  setFolderError('')
                  setPendingFolderAssignmentTarget(null)
                }}
                disabled={isCreatingFolder || isDeletingFolder}
                style={{
                  height: 38,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: `1px solid ${C.borderLight}`,
                  background: '#FFFFFF',
                  color: C.inkMuted,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isCreatingFolder || isDeletingFolder ? 'default' : 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void (editingFolderId ? updateFolder() : createFolder())}
                disabled={isCreatingFolder || isDeletingFolder}
                style={{
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: `linear-gradient(135deg, ${C.blue} 0%, #4EA1FF 100%)`,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isCreatingFolder || isDeletingFolder ? 'default' : 'pointer',
                  opacity: isCreatingFolder || isDeletingFolder ? 0.7 : 1,
                  boxShadow: `0 10px 22px ${C.blue}2B`,
                }}
              >
                {isCreatingFolder
                  ? editingFolderId
                    ? 'Сохранение...'
                    : pendingFolderAssignmentTarget
                      ? 'Создание...'
                      : 'Создание...'
                  : editingFolderId
                    ? 'Сохранить'
                    : pendingFolderAssignmentTarget
                      ? 'Создать и добавить'
                      : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DriveFilePickerModal 
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelect={handleDriveFileSelect}
      />

      {isE2eeRestoreModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,22,40,0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => {
            if (isE2eeRestoreLoading) return
            setIsE2eeRestoreModalOpen(false)
            setE2eeRestorePassword('')
            setE2eeRestoreError('')
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 400,
              background: C.surface,
              borderRadius: 24,
              border: `1px solid ${C.borderLight}`,
              boxShadow: '0 24px 60px rgba(10,22,40,0.16)',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '24px 24px 16px', borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>Восстановление истории</div>
              <div style={{ fontSize: 13, color: C.inkMuted, marginTop: 6, lineHeight: 1.5 }}>
                Введите ваш пароль для восстановления ключей сквозного шифрования и доступа к старым сообщениям.
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.inkSub, marginLeft: 4 }}>Пароль Alem</label>
                  <input
                    type="password"
                    value={e2eeRestorePassword}
                    onChange={(e) => setE2eeRestorePassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e2eeRestorePassword.trim() && !isE2eeRestoreLoading) {
                        void handleRestoreE2ee()
                      }
                    }}
                    placeholder="Введите ваш пароль"
                    autoFocus
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 14,
                      border: `1px solid ${e2eeRestoreError ? C.red : C.border}`,
                      background: C.canvas,
                      padding: '0 16px',
                      outline: 'none',
                      fontSize: 15,
                      color: C.ink,
                      fontFamily: 'inherit',
                      transition: 'border-color 0.2s ease',
                    }}
                  />
                  {e2eeRestoreError ? (
                    <div style={{ fontSize: 12, color: C.red, marginLeft: 4, marginTop: 2 }}>{e2eeRestoreError}</div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsE2eeRestoreModalOpen(false)
                      setE2eeRestorePassword('')
                      setE2eeRestoreError('')
                    }}
                    disabled={isE2eeRestoreLoading}
                    style={{
                      height: 42,
                      padding: '0 18px',
                      borderRadius: 12,
                      border: `1px solid ${C.borderLight}`,
                      background: '#FFFFFF',
                      color: C.inkMuted,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: isE2eeRestoreLoading ? 'default' : 'pointer',
                      opacity: isE2eeRestoreLoading ? 0.6 : 1,
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRestoreE2ee()}
                    disabled={isE2eeRestoreLoading || !e2eeRestorePassword.trim()}
                    style={{
                      height: 42,
                      padding: '0 20px',
                      borderRadius: 12,
                      border: 'none',
                      background: `linear-gradient(135deg, ${C.blue} 0%, #4EA1FF 100%)`,
                      color: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: isE2eeRestoreLoading || !e2eeRestorePassword.trim() ? 'default' : 'pointer',
                      opacity: isE2eeRestoreLoading || !e2eeRestorePassword.trim() ? 0.7 : 1,
                      boxShadow: `0 8px 20px ${C.blue}2B`,
                    }}
                  >
                    {isE2eeRestoreLoading ? 'Восстановление...' : 'Восстановить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
