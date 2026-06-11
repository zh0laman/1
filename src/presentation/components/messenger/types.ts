import type { ChatMessage, MessageType, UnifiedChat, ReplyToView } from '../../../domain/entities/Chat'

export interface CurrentUserState {
  id: number
  name: string
}

export interface CryptoState {
  currentDeviceId: string | null
  privateKey: string | null
}

export type UnavailableMessageKind =
  | 'missing-session'
  | 'missing-private-key'
  | 'missing-encrypted-keys'
  | 'identity-mismatch'
  | 'decrypt-failed'

export interface ChatListItem {
  chat: UnifiedChat
  title: string
  subtitle: string
  time: string
  avatar: string
  avatarUrl: string | null
  seed: number
  online: boolean
  unread: number
  isDraft?: boolean
  isGlobal?: boolean
}

export interface MessageView {
  raw: ChatMessage
  replyTo?: ReplyToView | null
  kind: MessageType
  from: 'me' | 'them'
  senderLabel: string
  text: string
  attachment?: ChatAttachmentViewModel
  mediaUrl?: string
  audioUrl?: string
  videoUrl?: string
  time: string
  status: 'read' | 'delivered'
  unavailable: boolean
  unavailableKind?: UnavailableMessageKind
  unavailableReason?: string
  isCall: boolean
}

export interface ChatAttachmentViewModel {
  kind: 'image' | 'video' | 'video_message' | 'audio' | 'voice' | 'file'
  url: string
  objectName?: string
  filename: string
  size?: number
  mime?: string
  ext?: string
  icon: 'image' | 'video' | 'audio' | 'pdf' | 'word' | 'excel' | 'presentation' | 'text' | 'archive' | 'file'
}

export interface ChatSearchResultItem {
  raw: ChatMessage
  view: MessageView
  senderLabel: string
  snippetText: string
  highlightedSnippet: string | null
  timeLabel: string
  typeLabel: string | null
}

export interface TypingIndicatorState {
  senderId: number
  label: string
}

export interface MentionContext {
  start: number
  end: number
  query: string
}

export interface SelectedMessageActionState {
  ids: string[]
  anchorId: string | null
}

export interface MessageContextMenuState {
  messageId: string
  x: number
  y: number
}

export interface ChatListContextMenuState {
  chatId: string
  x: number
  y: number
  isFolderMenuOpen: boolean
}
