import type {
  BroadcastResponse,
  ChatFolder,
  ChatGroupDetails,
  ChatCommandDefinition,
  ChatCommandExecuteInput,
  ChatCommandExecuteResponse,
  ChatCommandForm,
  ChatCommandKanbanContext,
  ChatMessagesPage,
  ChatSearchMessagesResult,
  ChatGroupMember,
  ChatMessage,
  MessageType,
  ChatType,
  DriveFile,
  E2eePublicKeys,
  MessageViewer,
  PinnedChat,
  PinnedMessage,
  SendChatMessageInput,
  UnifiedChat,
  UploadedChatFile,
} from '../../domain/entities/Chat'
import type { ChatRepository } from '../../domain/repositories/ChatRepository'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import { authorizedFetch } from '../http/authorizedFetch'
import { normalizeBackendAssetUrl } from '../http/normalizeBackendAssetUrl'

interface ReactionUserDto {
  id: number
  full_name: string
  avatar?: string | null
}

interface ReactionSummaryDto {
  reaction: string
  count: number
  users: ReactionUserDto[]
  reacted: boolean
}

interface MessageDto {
  id: string
  conversation_id: string
  sender_id: number
  reply_to_id?: string | null
  reply_to?: {
    id: string
    sender_id: number
    sender_full_name: string
    content: string
    type: string
    attachment_url?: string | null
    attachment_type?: string | null
    encrypted_keys?: Record<string, string>
    content_hash?: string
  } | null
  content: string
  content_hash?: string
  encrypted_keys?: Record<string, string>
  type: ChatMessage['type']
  attachment_url?: string | null
  attachment_type?: string | null
  attachment_size?: number | null
  metadata?: string | null
  is_edited?: boolean
  is_forwarded?: boolean
  original_sender_id?: number | null
  is_deleted?: boolean
  created_at: string
  updated_at: string
  edited_at?: string | null
  is_ephemeral?: boolean
  ttl_seconds?: number | null
  expires_at?: string | null
  sender_username?: string
  sender_full_name?: string
  sender_avatar?: string | null
  original_sender_full_name?: string | null
  read_by_count?: number
  delivered_count?: number
  is_read?: boolean
  reactions?: ReactionSummaryDto[]
}

interface UnifiedChatDto {
  id: string
  type: UnifiedChat['type']
  peer_id?: number | null
  peer_username?: string | null
  peer_full_name?: string | null
  peer_avatar?: string | null
  last_seen_at?: string | null
  group_id?: string | null
  group_name?: string | null
  group_avatar?: string | null
  channel_id?: string | null
  channel_name?: string | null
  channel_avatar?: string | null
  ai_model?: string | null
  ai_title?: string | null
  last_message?: MessageDto | null
  unread_count?: number
  mention_count?: number
  is_pinned?: boolean
  is_muted?: boolean
  created_at: string
  updated_at: string
}

interface MessagesResponseDto {
  messages: MessageDto[] | null
  count?: number
}

interface SearchMessagesResponseDto {
  query?: string
  messages: MessageDto[] | null
  count?: number
}

interface E2eePublicKeysDto {
  user_id: number
  keys: Record<string, string>
}

interface ConversationDto {
  id: string
}

interface CreateGroupDto {
  id: string
}

interface FolderDto {
  id: string
  name: string
  user_id: number
  created_at: string
  updated_at: string
  chats?: Array<{ id: string }>
}

interface GroupMemberDto {
  id: number
  email?: string | null
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  avatar_url?: string | null
  availability_status?: string | null
  role?: string | null
}

interface GroupDetailsDto {
  id: string
  name: string
  description?: string | null
  avatar_url?: string | null
  type: string
  max_members: number
  created_by: number
  is_active: boolean
  created_at: string
  updated_at: string
  members?: GroupMemberDto[] | null
  member_count?: number
}

interface UploadedFileDto {
  object_name: string
  url: string
  filename: string
  size: number
  type: string
}

interface DriveFileDto {
  id: string
  owner_id?: number
  folder_id?: string | null
  real_name?: string
  download_url?: string
  size?: number
  mime_type?: string
  version?: number
  created_at?: string
  updated_at?: string
}

export interface MessageViewerDto {
  user_id: number
  full_name: string
  avatar_url?: string | null
  read_at: string
}

interface ReactionMutationDto {
  message?: string
  reactions?: ReactionSummaryDto[]
}

interface BroadcastResultDto {
  user_id: number
  conversation_id: string
  message_id: string
  success: boolean
}

interface BroadcastResponseDto {
  success_count: number
  failure_count: number
  results: BroadcastResultDto[] | null
}

interface PinnedChatDto {
  id: string
  user_id: number
  chat_id: string
  chat_type: ChatType
  position: number
  created_at: string
  updated_at: string
}

interface PinnedChatsResponseDto {
  pinned_chats: PinnedChatDto[] | null
}

interface PinnedMessageDto {
  id: string
  chat_id: string
  chat_type: ChatType
  message_id: string
  pinned_by: number
  position: number
  content: string
  type: string
  created_at: string
}

interface PinnedMessagesResponseDto {
  pinned_messages: PinnedMessageDto[] | null
}

interface FileUrlDto {
  url: string
  expires_in: string
}

interface ChatCommandListDto {
  commands?: ChatCommandDefinition[] | null
}

interface ChatCommandFormDto {
  title?: string
  description?: string
  fields?: ChatCommandForm['fields'] | null
}

interface ChatCommandExecuteResponseDto {
  status?: string
  command_id?: string
  missing_fields?: string[] | null
  form?: ChatCommandFormDto | null
  result?: unknown
  chat_message?: MessageDto | null
}

const BACKEND_FILE_URL_MARKERS = ['/api/v1/files/download', '/api/v1/files/url', '92.38.48.9:18080', 'alem-superapp.qaztech.gov.kz:18080']

const normalizeChatAssetUrl = (value: string | null | undefined): string | null =>
  normalizeBackendAssetUrl(value) ?? value ?? null

const isConversationChatType = (chatType: ChatType): boolean => chatType !== 'group'

const toPinnedChatType = (chatType: ChatType): 'personal' | 'group' | 'channel' =>
  chatType === 'group' ? 'group' : chatType === 'channel' ? 'channel' : 'personal'

const toChatCommandResponse = (dto: ChatCommandExecuteResponseDto): ChatCommandExecuteResponse => ({
  status: dto.status ?? 'executed',
  commandId: dto.command_id ?? '',
  missingFields: dto.missing_fields ?? undefined,
  form: dto.form
    ? {
        title: dto.form.title ?? '',
        description: dto.form.description,
        fields: dto.form.fields ?? [],
      }
    : undefined,
  result: dto.result,
  chatMessage: dto.chat_message ? toChatMessage(dto.chat_message) : null,
})

const toDriveFile = (dto: DriveFileDto): DriveFile => ({
  id: dto.id,
  ownerId: dto.owner_id,
  folderId: dto.folder_id ?? null,
  realName: dto.real_name ?? '',
  downloadUrl: normalizeBackendAssetUrl(dto.download_url) ?? dto.download_url ?? '',
  size: dto.size ?? 0,
  mimeType: dto.mime_type ?? 'application/octet-stream',
  version: dto.version,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
})

const normalizeMessageType = (dto: MessageDto): ChatMessage['type'] => {
  if (dto.type !== 'video_message') {
    return dto.type
  }

  const attachmentType = (dto.attachment_type ?? '').toLowerCase()
  if (attachmentType.startsWith('audio/')) {
    return 'voice'
  }

  const attachmentUrl = (dto.attachment_url ?? '').toLowerCase()
  const content = (dto.content ?? '').toLowerCase()
  const voiceMarkers = ['/voice/', 'object_name=voice%2f', 'object_name=voice/']

  if (voiceMarkers.some((marker) => attachmentUrl.includes(marker) || content.includes(marker))) {
    return 'voice'
  }

  return dto.type
}

const normalizeChatMessageContent = (dto: MessageDto): string => {
  const normalizedType = normalizeMessageType(dto)
  const normalizedContent = (dto.content ?? '').toLowerCase()
  const shouldNormalizeContent =
    normalizedType === 'image' ||
    normalizedType === 'video' ||
    normalizedType === 'file' ||
    normalizedType === 'audio' ||
    normalizedType === 'voice' ||
    normalizedType === 'video_message' ||
    BACKEND_FILE_URL_MARKERS.some((marker) => normalizedContent.includes(marker))

  if (!shouldNormalizeContent) {
    return dto.content
  }

  return normalizeBackendAssetUrl(dto.content) ?? dto.content
}

export const toChatMessage = (dto: MessageDto): ChatMessage => ({
  id: dto.id,
  conversationId: dto.conversation_id,
  senderId: dto.sender_id,
  replyToId: dto.reply_to_id ?? null,
  replyTo: dto.reply_to
    ? {
        id: dto.reply_to.id,
        senderId: dto.reply_to.sender_id,
        senderFullName: dto.reply_to.sender_full_name,
        content: dto.reply_to.content,
        contentHash: dto.reply_to.content_hash ?? '',
        encryptedKeys: dto.reply_to.encrypted_keys ?? {},
        type: dto.reply_to.type as MessageType,
        attachmentUrl: dto.reply_to.attachment_url ?? null,
        attachmentType: dto.reply_to.attachment_type ?? null,
      }
    : null,
  content: normalizeChatMessageContent(dto),
  contentHash: dto.content_hash ?? '',
  encryptedKeys: dto.encrypted_keys ?? {},
  type: normalizeMessageType(dto),
  attachmentUrl: normalizeChatAssetUrl(dto.attachment_url),
  attachmentType: dto.attachment_type ?? null,
  attachmentSize: dto.attachment_size ?? null,
  metadata: dto.metadata ?? null,
  isEdited: dto.is_edited ?? false,
  isForwarded: dto.is_forwarded ?? false,
  originalSenderId: dto.original_sender_id ?? null,
  isDeleted: dto.is_deleted ?? false,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
  editedAt: dto.edited_at ?? null,
  isEphemeral: dto.is_ephemeral ?? false,
  ttlSeconds: dto.ttl_seconds ?? null,
  expiresAt: dto.expires_at ?? null,
  senderUsername: dto.sender_username ?? '',
  senderFullName: dto.sender_full_name ?? '',
  senderAvatar: normalizeChatAssetUrl(dto.sender_avatar),
  originalSenderFullName: dto.original_sender_full_name ?? null,
  readByCount: dto.read_by_count ?? 0,
  deliveredCount: dto.delivered_count ?? 0,
  isRead: dto.is_read ?? false,
  reactions: (dto.reactions ?? []).map((r) => ({
    reaction: r.reaction,
    count: r.count,
    users: (r.users ?? []).map((u) => ({
      id: u.id,
      fullName: u.full_name,
      avatar: normalizeChatAssetUrl(u.avatar),
    })),
    reacted: r.reacted,
  })),
})

export const toUnifiedChat = (dto: UnifiedChatDto): UnifiedChat => ({
  id: dto.id,
  type: dto.type,
  peerId: dto.peer_id ?? null,
  peerUsername: dto.peer_username ?? null,
  peerFullName: dto.peer_full_name ?? null,
  peerAvatar: normalizeChatAssetUrl(dto.peer_avatar),
  lastSeenAt: dto.last_seen_at ?? null,
  groupId: dto.group_id ?? null,
  groupName: dto.group_name ?? null,
  groupAvatar: normalizeChatAssetUrl(dto.group_avatar),
  channelId: dto.channel_id ?? null,
  channelName: dto.channel_name ?? null,
  channelAvatar: normalizeChatAssetUrl(dto.channel_avatar),
  aiModel: dto.ai_model ?? null,
  aiTitle: dto.ai_title ?? null,
  lastMessage: dto.last_message ? toChatMessage(dto.last_message) : null,
  unreadCount: dto.unread_count ?? 0,
  mentionCount: dto.mention_count ?? 0,
  isPinned: dto.is_pinned ?? false,
  isMuted: dto.is_muted ?? false,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
})

export const toChatFolder = (dto: FolderDto): ChatFolder => ({
  id: dto.id,
  name: dto.name,
  userId: dto.user_id,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
  chatIds: dto.chats?.map((c) => c.id) ?? [],
})

export const toMessageViewer = (dto: MessageViewerDto): MessageViewer => ({
  userId: dto.user_id,
  fullName: dto.full_name,
  avatarUrl: normalizeChatAssetUrl(dto.avatar_url),
  readAt: dto.read_at,
})

export const toPinnedChat = (dto: PinnedChatDto): PinnedChat => ({
  id: dto.id,
  userId: dto.user_id,
  chatId: dto.chat_id,
  chatType: dto.chat_type,
  position: dto.position,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
})

export const toPinnedMessage = (dto: PinnedMessageDto): PinnedMessage => ({
  id: dto.id,
  chatId: dto.chat_id,
  chatType: dto.chat_type,
  messageId: dto.message_id,
  pinnedBy: dto.pinned_by,
  position: dto.position,
  content: dto.content,
  type: dto.type as MessageType,
  createdAt: dto.created_at,
})

export const toBroadcastResponse = (dto: BroadcastResponseDto): BroadcastResponse => ({
  successCount: dto.success_count,
  failureCount: dto.failure_count,
  results: (dto.results ?? []).map((result) => ({
    userId: result.user_id,
    conversationId: result.conversation_id,
    messageId: result.message_id,
    success: result.success,
  })),
})

export const toChatGroupMember = (dto: GroupMemberDto): ChatGroupMember => ({
  id: dto.id,
  email: dto.email ?? '',
  username: dto.username ?? '',
  firstName: dto.first_name ?? '',
  lastName: dto.last_name ?? '',
  fullName: dto.full_name ?? '',
  avatarUrl: normalizeChatAssetUrl(dto.avatar_url),
  availabilityStatus: dto.availability_status ?? '',
  role: dto.role ?? '',
})

export const toChatGroupDetails = (dto: GroupDetailsDto): ChatGroupDetails => ({
  id: dto.id,
  name: dto.name,
  description: dto.description ?? null,
  avatarUrl: normalizeChatAssetUrl(dto.avatar_url),
  type: dto.type,
  maxMembers: dto.max_members,
  createdBy: dto.created_by,
  isActive: dto.is_active,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
  members: (dto.members ?? []).map(toChatGroupMember),
  memberCount: dto.member_count ?? (dto.members ?? []).length,
})

export class HttpChatRepository implements ChatRepository {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  private async getMessagesPage(
    endpoint: string,
    params?: { limit?: number; offset?: number },
  ): Promise<ChatMessagesPage> {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 100)
    const offset = Math.max(params?.offset ?? 0, 0)
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    }).toString()
    const response = await authorizedFetch(this.sessionStore, `${endpoint}?${query}`)
    const data = (await response.json()) as MessagesResponseDto
    const messages = (data.messages ?? []).map(toChatMessage)

    return {
      messages,
      count: data.count ?? messages.length,
    }
  }

  async createConversation(peerId: number): Promise<{ id: string }> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/conversations', {
      method: 'POST',
      body: JSON.stringify({
        peer_id: peerId,
      }),
    })
    const data = (await response.json()) as ConversationDto
    return {
      id: data.id,
    }
  }

  async createGroup(input: { name: string; description?: string; type?: 'private' | 'public'; maxMembers?: number }): Promise<{ id: string }> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/groups', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        description: input.description ?? '',
        type: input.type ?? 'private',
        max_members: input.maxMembers ?? 200,
      }),
    })
    const data = (await response.json()) as CreateGroupDto
    return {
      id: data.id,
    }
  }

  async getUnifiedChats(): Promise<UnifiedChat[]> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/chats/unified')
    const data = (await response.json()) as UnifiedChatDto[] | null
    return (data ?? []).map(toUnifiedChat)
  }

  async getFolders(): Promise<ChatFolder[]> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/folders')
    const data = (await response.json()) as FolderDto[] | null
    return (data ?? []).map(toChatFolder)
  }

  async getFolder(folderId: string): Promise<ChatFolder> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/folders/${folderId}`)
    return toChatFolder((await response.json()) as FolderDto)
  }

  async createFolder(name: string): Promise<ChatFolder> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })

    return toChatFolder((await response.json()) as FolderDto)
  }

  async updateFolder(folderId: string, name: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
  }

  async deleteFolder(folderId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/folders/${folderId}`, {
      method: 'DELETE',
    })
  }

  async addChatToFolder(folderId: string, chatId: string, chatType: ChatType | 'conversation'): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/folders/${folderId}/chats`, {
      method: 'POST',
      body: JSON.stringify({
        chat_id: chatId,
        chat_type: chatType,
      }),
    })
  }

  async removeChatFromFolder(folderId: string, chatId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/folders/${folderId}/chats/${chatId}`, {
      method: 'DELETE',
    })
  }

  async getConversationMessages(
    conversationId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<ChatMessagesPage> {
    return this.getMessagesPage(`/api/v1/conversations/${conversationId}/messages`, params)
  }

  async getGroupMessages(groupId: string, params?: { limit?: number; offset?: number }): Promise<ChatMessagesPage> {
    return this.getMessagesPage(`/api/v1/groups/${groupId}/messages`, params)
  }

  async searchMessages(conversationId: string, query: string, limit = 20): Promise<ChatSearchMessagesResult> {
    const normalizedLimit = Math.min(Math.max(limit, 1), 100)
    const params = new URLSearchParams({
      conversation_id: conversationId,
      q: query,
      limit: String(normalizedLimit),
    }).toString()
    const response = await authorizedFetch(this.sessionStore, `/api/v1/search/messages?${params}`)
    const data = (await response.json()) as SearchMessagesResponseDto
    const messages = (data.messages ?? []).map(toChatMessage)

    return {
      query: data.query ?? query,
      messages,
      count: data.count ?? messages.length,
    }
  }

  async getGroupDetails(groupId: string): Promise<ChatGroupDetails> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/groups/${groupId}`)
    return toChatGroupDetails((await response.json()) as GroupDetailsDto)
  }

  async hideConversation(conversationId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/conversations/${conversationId}`, {
      method: 'DELETE',
    })
  }

  async updateGroup(groupId: string, input: { name: string; description?: string | null }): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        description: input.description ?? '',
      }),
    })
  }

  async deleteGroup(groupId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/groups/${groupId}`, {
      method: 'DELETE',
    })
  }

  async addGroupMembers(groupId: string, userIds: number[]): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({
        user_ids: userIds,
      }),
    })
  }

  async removeGroupMember(groupId: string, userId: number): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    })
  }

  async updateGroupMemberRole(groupId: string, userId: number, role: 'member' | 'admin'): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/groups/${groupId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })
  }

  async leaveGroup(groupId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/groups/${groupId}/leave`, {
      method: 'POST',
    })
  }

  async setConversationMute(conversationId: string, mute: boolean): Promise<boolean> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/conversations/${conversationId}/mute`, {
      method: 'PUT',
      body: JSON.stringify({ mute }),
    })
    const data = (await response.json()) as { is_muted?: boolean }
    return Boolean(data.is_muted)
  }

  async setGroupMute(groupId: string, mute: boolean): Promise<boolean> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/groups/${groupId}/mute`, {
      method: 'PUT',
      body: JSON.stringify({ mute }),
    })
    const data = (await response.json()) as { is_muted?: boolean }
    return Boolean(data.is_muted)
  }

  async setChannelMute(channelId: string, mute: boolean): Promise<boolean> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}/mute`, {
      method: 'PUT',
      body: JSON.stringify({ mute }),
    })
    const data = (await response.json()) as { is_muted?: boolean }
    return Boolean(data.is_muted)
  }

  async listChatCommands(): Promise<ChatCommandDefinition[]> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/chat-commands')
    const data = (await response.json()) as ChatCommandListDto
    return data.commands ?? []
  }

  async getChatCommandKanbanContext(boardId?: string): Promise<ChatCommandKanbanContext> {
    const query = boardId ? `?board_id=${encodeURIComponent(boardId)}` : ''
    const response = await authorizedFetch(this.sessionStore, `/api/v1/chat-commands/kanban/context${query}`)
    const data = (await response.json()) as {
      commands?: ChatCommandDefinition[] | null
      boards?: Array<Record<string, unknown>> | null
      selected_board?: ChatCommandKanbanContext['selectedBoard']
    }

    return {
      commands: data.commands ?? [],
      boards: data.boards ?? [],
      selectedBoard: data.selected_board ?? null,
    }
  }

  async executeChatCommand(input: ChatCommandExecuteInput): Promise<ChatCommandExecuteResponse> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/chat-commands/execute', {
      method: 'POST',
      body: JSON.stringify({
        command_id: input.commandId,
        raw_text: input.rawText,
        chat_id: input.chatId,
        chat_type: input.chatType,
        send_result_to_chat: input.sendResultToChat,
        args: input.args ?? {},
      }),
    })

    return toChatCommandResponse((await response.json()) as ChatCommandExecuteResponseDto)
  }

  async sendMessage(input: SendChatMessageInput): Promise<ChatMessage> {
    const endpoint = isConversationChatType(input.chatType)
        ? `/api/v1/conversations/${input.chatId}/messages`
        : `/api/v1/groups/${input.chatId}/messages`

    const response = await authorizedFetch(this.sessionStore, endpoint, {
      method: 'POST',
      body: JSON.stringify({
        content: input.content,
        content_hash: input.contentHash,
        keys: input.keys,
        type: input.type,
        metadata: input.metadata,
        attachment_url: input.attachmentUrl,
        attachment_type: input.attachmentType,
        attachment_size: input.attachmentSize,
        reply_to_id: input.replyToId,
      }),
    })

    return toChatMessage((await response.json()) as MessageDto)
  }

  async editMessage(messageId: string, content: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
  }

  async deleteMessage(messageId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/messages/${messageId}`, {
      method: 'DELETE',
    })
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    await authorizedFetch(this.sessionStore, '/api/v1/messages', {
      method: 'DELETE',
      body: JSON.stringify({ message_ids: messageIds }),
    })
  }

  async getMessageViewers(messageId: string): Promise<MessageViewer[]> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/messages/${messageId}/viewers`)
    const data = (await response.json()) as MessageViewerDto[] | null
    return (data ?? []).map(toMessageViewer)
  }

  async forwardMessages(messageIds: string[], targetChatIds: string[]): Promise<ChatMessage[]> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/messages/forward', {
      method: 'POST',
      body: JSON.stringify({
        message_ids: messageIds,
        target_chat_ids: targetChatIds,
      }),
    })

    const data = (await response.json()) as MessageDto[] | null
    return (data ?? []).map(toChatMessage)
  }

  async addReaction(messageId: string, reaction: string): Promise<ChatMessage['reactions']> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ reaction }),
    })
    const data = (await response.json()) as ReactionMutationDto
    return (data.reactions ?? []).map((r) => ({
      reaction: r.reaction,
      count: r.count,
      users: (r.users ?? []).map((u) => ({
        id: u.id,
        fullName: u.full_name,
        avatar: normalizeChatAssetUrl(u.avatar),
      })),
      reacted: r.reacted,
    }))
  }

  async removeReaction(messageId: string, reaction: string): Promise<ChatMessage['reactions']> {
    const encoded = encodeURIComponent(reaction)
    const response = await authorizedFetch(this.sessionStore, `/api/v1/messages/${messageId}/reactions/${encoded}`, {
      method: 'DELETE',
    })
    const data = (await response.json()) as ReactionMutationDto
    return (data.reactions ?? []).map((r) => ({
      reaction: r.reaction,
      count: r.count,
      users: (r.users ?? []).map((u) => ({
        id: u.id,
        fullName: u.full_name,
        avatar: normalizeChatAssetUrl(u.avatar),
      })),
      reacted: r.reacted,
    }))
  }

  async broadcastMessage(recipientUserIds: number[], content: string, messageType: ChatMessage['type']): Promise<BroadcastResponse> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/conversations/broadcast', {
      method: 'POST',
      body: JSON.stringify({
        recipient_user_ids: recipientUserIds,
        content,
        message_type: messageType,
      }),
    })
    return toBroadcastResponse((await response.json()) as BroadcastResponseDto)
  }

  async shareItem(targetChatId: string, itemType: 'task' | 'event', itemId: string, comment = ''): Promise<ChatMessage> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/chats/share', {
      method: 'POST',
      body: JSON.stringify({
        target_chat_id: targetChatId,
        item_type: itemType,
        item_id: itemId,
        comment,
      }),
    })
    return toChatMessage((await response.json()) as MessageDto)
  }

  async pinChat(chatId: string, chatType: ChatType): Promise<void> {
    await authorizedFetch(this.sessionStore, '/api/v1/chats/pin', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, chat_type: toPinnedChatType(chatType) }),
    })
  }

  async unpinChat(chatId: string, chatType: ChatType): Promise<void> {
    await authorizedFetch(this.sessionStore, '/api/v1/chats/unpin', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, chat_type: toPinnedChatType(chatType) }),
    })
  }

  async getPinnedChats(): Promise<PinnedChat[]> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/chats/pinned')
    const data = (await response.json()) as PinnedChatsResponseDto
    return (data.pinned_chats ?? []).map(toPinnedChat)
  }

  async pinMessage(chatId: string, chatType: ChatType, messageId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, '/api/v1/messages/pin', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, chat_type: toPinnedChatType(chatType), message_id: messageId }),
    })
  }

  async unpinMessage(chatId: string, chatType: ChatType, messageId: string): Promise<void> {
    const query = new URLSearchParams({ chat_id: chatId, chat_type: toPinnedChatType(chatType) }).toString()
    await authorizedFetch(this.sessionStore, `/api/v1/messages/${messageId}/unpin?${query}`, {
      method: 'POST',
    })
  }

  async getPinnedMessages(chatId: string, chatType: ChatType): Promise<PinnedMessage[]> {
    const query = new URLSearchParams({ chat_id: chatId, chat_type: chatType }).toString()
    const response = await authorizedFetch(this.sessionStore, `/api/v1/messages/pinned?${query}`)
    const data = (await response.json()) as PinnedMessagesResponseDto
    return (data.pinned_messages ?? []).map(toPinnedMessage)
  }

  async uploadFile(file: File, type: 'image' | 'video' | 'document' | 'file' | 'audio' | 'voice' | 'video_message'): Promise<UploadedChatFile> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const response = await authorizedFetch(this.sessionStore, '/api/v1/files/upload', {
      method: 'POST',
      body: formData,
    })

    const data = (await response.json()) as UploadedFileDto
    return {
      objectName: data.object_name,
      url: normalizeBackendAssetUrl(data.url) ?? data.url,
      filename: data.filename,
      size: data.size,
      type: data.type,
    }
  }

    async uploadDriveFile(file: File, folderId?: string | null): Promise<DriveFile> {
    const formData = new FormData()
    formData.append('file', file)
    if (folderId) {
      formData.append('folder_id', folderId)
    }

    const response = await authorizedFetch(this.sessionStore, '/api/v1/drive/files', {
      method: 'POST',
      body: formData,
    })

    const data = (await response.json()) as DriveFileDto
    return toDriveFile(data)
  }

  async getFileUrl(objectName: string): Promise<{ url: string; expiresIn: string }> {
    const query = new URLSearchParams({ object_name: objectName }).toString()
    const response = await authorizedFetch(this.sessionStore, `/api/v1/files/url?${query}`)
    const data = (await response.json()) as FileUrlDto
    return {
      url: normalizeBackendAssetUrl(data.url) ?? data.url,
      expiresIn: data.expires_in,
    }
  }

  async deleteFile(objectName: string): Promise<void> {
    const query = new URLSearchParams({ object_name: objectName }).toString()
    await authorizedFetch(this.sessionStore, `/api/v1/files?${query}`, {
      method: 'DELETE',
    })
  }

  async markAsRead(messageId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/messages/${messageId}/read`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async getUserPublicKeys(userId: number): Promise<E2eePublicKeys> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/e2ee/keys/${userId}`)
    const data = (await response.json()) as E2eePublicKeysDto
    return {
      userId: data.user_id,
      keys: data.keys ?? {},
    }
  }
}
