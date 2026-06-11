import type {
  BroadcastResponse,
  ChatFolder,
  ChatGroupDetails,
  ChatCommandDefinition,
  ChatCommandExecuteInput,
  ChatCommandExecuteResponse,
  ChatCommandKanbanContext,
  ChatMessage,
  ChatMessagesPage,
  ChatSearchMessagesResult,
  ChatType,
  DriveFile,
  E2eePublicKeys,
  MessageType,
  MessageViewer,
  PinnedChat,
  PinnedMessage,
  SendChatMessageInput,
  UnifiedChat,
  UploadedChatFile,
} from '../entities/Chat'

export interface ChatRepository {
  createConversation(peerId: number): Promise<{ id: string }>
  createGroup(input: { name: string; description?: string; type?: 'private' | 'public'; maxMembers?: number }): Promise<{ id: string }>
  getUnifiedChats(): Promise<UnifiedChat[]>
  getFolders(): Promise<ChatFolder[]>
  createFolder(name: string): Promise<ChatFolder>
  updateFolder(folderId: string, name: string): Promise<void>
  deleteFolder(folderId: string): Promise<void>
  addChatToFolder(folderId: string, chatId: string, chatType: 'conversation' | 'group'): Promise<void>
  removeChatFromFolder(folderId: string, chatId: string): Promise<void>
  getFolder(folderId: string): Promise<ChatFolder>
  getConversationMessages(conversationId: string, params?: { limit?: number; offset?: number }): Promise<ChatMessagesPage>
  getGroupMessages(groupId: string, params?: { limit?: number; offset?: number }): Promise<ChatMessagesPage>
  searchMessages(conversationId: string, query: string, limit?: number): Promise<ChatSearchMessagesResult>
  getGroupDetails(groupId: string): Promise<ChatGroupDetails>
  hideConversation(conversationId: string): Promise<void>
  updateGroup(groupId: string, input: { name: string; description?: string | null }): Promise<void>
  deleteGroup(groupId: string): Promise<void>
  addGroupMembers(groupId: string, userIds: number[]): Promise<void>
  removeGroupMember(groupId: string, userId: number): Promise<void>
  updateGroupMemberRole(groupId: string, userId: number, role: 'member' | 'admin'): Promise<void>
  leaveGroup(groupId: string): Promise<void>
  sendMessage(input: SendChatMessageInput): Promise<ChatMessage>
  editMessage(messageId: string, content: string): Promise<void>
  deleteMessage(messageId: string): Promise<void>
  deleteMessages(messageIds: string[]): Promise<void>
  getMessageViewers(messageId: string): Promise<MessageViewer[]>
  forwardMessages(messageIds: string[], targetChatIds: string[]): Promise<ChatMessage[]>
  addReaction(messageId: string, reaction: string): Promise<ChatMessage['reactions']>
  removeReaction(messageId: string, reaction: string): Promise<ChatMessage['reactions']>
  broadcastMessage(recipientUserIds: number[], content: string, messageType: MessageType): Promise<BroadcastResponse>
  shareItem(targetChatId: string, itemType: 'task' | 'event', itemId: string, comment?: string): Promise<ChatMessage>
  pinChat(chatId: string, chatType: ChatType): Promise<void>
  unpinChat(chatId: string, chatType: ChatType): Promise<void>
  getPinnedChats(): Promise<PinnedChat[]>
  pinMessage(chatId: string, chatType: ChatType, messageId: string): Promise<void>
  unpinMessage(chatId: string, chatType: ChatType, messageId: string): Promise<void>
  getPinnedMessages(chatId: string, chatType: ChatType): Promise<PinnedMessage[]>
  uploadFile(file: File, type: 'image' | 'video' | 'document' | 'file' | 'audio' | 'voice' | 'video_message'): Promise<UploadedChatFile>
  uploadDriveFile(file: File, folderId?: string | null): Promise<DriveFile>
  getFileUrl(objectName: string): Promise<{ url: string; expiresIn: string }>
  deleteFile(objectName: string): Promise<void>
  markAsRead(messageId: string): Promise<void>
  getUserPublicKeys(userId: number): Promise<E2eePublicKeys>
  listChatCommands(): Promise<ChatCommandDefinition[]>
  getChatCommandKanbanContext(boardId?: string): Promise<ChatCommandKanbanContext>
  executeChatCommand(input: ChatCommandExecuteInput): Promise<ChatCommandExecuteResponse>
  setConversationMute(conversationId: string, mute: boolean): Promise<boolean>
  setGroupMute(groupId: string, mute: boolean): Promise<boolean>
  setChannelMute(channelId: string, mute: boolean): Promise<boolean>
}
