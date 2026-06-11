export type ChatType = 'personal' | 'group' | 'channel' | 'support'

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'audio'
  | 'voice'
  | 'video_message'
  | 'share_task'
  | 'share_event'
  | 'service'

export interface ChatReactionUser {
  id: number
  fullName: string
  avatar: string | null
}

export interface ChatReaction {
  reaction: string
  count: number
  users: ChatReactionUser[]
  reacted: boolean
}

export interface ReplyToView {
  id: string
  senderId: number
  senderFullName: string
  content: string
  contentHash?: string
  encryptedKeys?: Record<string, string>
  type: MessageType
  attachmentUrl: string | null
  attachmentType: string | null
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: number
  replyToId: string | null
  replyTo?: ReplyToView | null
  content: string
  contentHash: string
  encryptedKeys: Record<string, string>
  type: MessageType
  attachmentUrl: string | null
  attachmentType: string | null
  attachmentSize: number | null
  metadata: string | null
  isEdited: boolean
  isForwarded: boolean
  originalSenderId: number | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  editedAt: string | null
  isEphemeral: boolean
  ttlSeconds: number | null
  expiresAt: string | null
  senderUsername: string
  senderFullName: string
  senderAvatar: string | null
  originalSenderFullName: string | null
  readByCount: number
  deliveredCount: number
  isRead: boolean
  reactions: ChatReaction[]
}

export interface ChatMessagesPage {
  messages: ChatMessage[]
  count: number
}

export interface ChatSearchMessagesResult {
  query: string
  messages: ChatMessage[]
  count: number
}

export interface UnifiedChat {
  id: string
  type: ChatType
  peerId: number | null
  peerUsername: string | null
  peerFullName: string | null
  peerAvatar: string | null
  lastSeenAt: string | null
  groupId: string | null
  groupName: string | null
  groupAvatar: string | null
  channelId: string | null
  channelName: string | null
  channelAvatar: string | null
  aiModel: string | null
  aiTitle: string | null
  lastMessage: ChatMessage | null
  unreadCount: number
  mentionCount: number
  isPinned: boolean
  isMuted: boolean
  createdAt: string
  updatedAt: string
}

export interface E2eePublicKeys {
  userId: number
  keys: Record<string, string>
}

export interface ChatFolder {
  id: string
  name: string
  userId: number
  createdAt: string
  updatedAt: string
  chatIds?: string[]
}

export interface MessageViewer {
  userId: number
  fullName: string
  avatarUrl: string | null
  readAt: string
}

export interface BroadcastResult {
  userId: number
  conversationId: string
  messageId: string
  success: boolean
}

export interface BroadcastResponse {
  successCount: number
  failureCount: number
  results: BroadcastResult[]
}

export interface PinnedChat {
  id: string
  userId: number
  chatId: string
  chatType: ChatType
  position: number
  createdAt: string
  updatedAt: string
}

export interface PinnedMessage {
  id: string
  chatId: string
  chatType: ChatType
  messageId: string
  pinnedBy: number
  position: number
  content: string
  type: MessageType
  createdAt: string
}

export interface ChatGroupMember {
  id: number
  email: string
  username: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl: string | null
  availabilityStatus: string
  role: string
}

export interface ChatGroupDetails {
  id: string
  name: string
  description: string | null
  avatarUrl: string | null
  type: string
  maxMembers: number
  createdBy: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  members: ChatGroupMember[]
  memberCount: number
}

export interface SendChatMessageInput {
  chatId: string
  chatType: ChatType
  content: string
  type: MessageType
  contentHash?: string
  keys?: Record<string, string>
  metadata?: string | null
  attachmentUrl?: string | null
  attachmentType?: string | null
  attachmentSize?: number | null
  replyToId?: string | null
}

export interface UploadedChatFile {
  objectName: string
  url: string
  filename: string
  size: number
  type: string
}

export interface DriveFile {
  id: string
  ownerId?: number
  folderId?: string | null
  realName: string
  downloadUrl: string
  size: number
  mimeType: string
  version?: number
  createdAt?: string
  updatedAt?: string
}

export interface ChatCommandArgument {
  name: string
  type: string
  label: string
  required?: boolean
  values?: string[]
  source?: string
}

export interface ChatCommandDefinition {
  id: string
  title: string
  description: string
  aliases: string[]
  scopes: Array<'conversation' | 'group' | string>
  arguments: ChatCommandArgument[]
  examples?: string[]
}

export interface ChatCommandFormField {
  name: string
  type: string
  label: string
  required?: boolean
  source?: string
  options?: unknown
}

export interface ChatCommandForm {
  title: string
  description?: string
  fields: ChatCommandFormField[]
}

export interface ChatCommandExecuteInput {
  commandId?: string
  rawText?: string
  chatId?: string
  chatType?: 'conversation' | 'group'
  sendResultToChat?: boolean
  args?: Record<string, unknown>
}

export interface ChatCommandExecuteResponse {
  status: 'needs_input' | 'executed' | string
  commandId: string
  missingFields?: string[]
  form?: ChatCommandForm
  result?: unknown
  chatMessage?: ChatMessage | null
}

export interface ChatCommandKanbanContext {
  commands: ChatCommandDefinition[]
  boards: Array<Record<string, unknown>>
  selectedBoard?: {
    board?: Record<string, unknown> | null
    sprints?: Array<Record<string, unknown>> | null
    members?: Array<Record<string, unknown>> | null
    columns?: Array<Record<string, unknown>> | null
  } | null
}

export interface WebSocketEnvelope {
  type: string
  from?: number
  to?: number
  conversation_id?: string
  message_id?: string
  content?: unknown
  timestamp?: number
}
