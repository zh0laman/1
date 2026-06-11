export type ChannelType = 'public' | 'private'
export type ChannelRole = 'owner' | 'admin' | 'subscriber'

export interface Channel {
  id: string
  name: string
  description: string | null
  username: string | null
  avatarUrl: string | null
  type: ChannelType
  createdBy: number
  isActive: boolean
  memberCount: number
  createdAt: string
  updatedAt: string
}

export interface ChannelView extends Channel {
  myRole: ChannelRole | null
  isSubscribed: boolean
  isMuted: boolean
  lastPost: ChannelPost | null
}

export interface ChannelMember {
  channelId: string
  userId: number
  role: ChannelRole
  isMuted: boolean
  joinedAt: string
  leftAt: string | null
  createdAt: string
  userFullName?: string
  userUsername?: string
  userAvatar?: string | null
}

export interface ChannelPost {
  id: string
  channelId: string
  authorId: number
  content: string | null
  attachmentUrl: string | null
  attachmentType: string | null
  attachmentSize: number | null
  isPinned: boolean
  isDeleted: boolean
  isEdited: boolean
  isForwarded: boolean
  originalChannelId: string | null
  originalPostId: string | null
  viewsCount: number
  commentsCount: number
  linkedGroupId: string | null
  metadata: string | null
  editedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ChannelPostReactionSummary {
  reaction: string
  count: number
  users: Array<{ id: number; fullName: string; avatar: string | null }>
  reacted: boolean
}

export interface ChannelPostView extends ChannelPost {
  authorName: string
  authorAvatar: string | null
  channelName: string
  channelAvatar: string | null
  reactions: ChannelPostReactionSummary[]
  isViewed: boolean
}

export interface CreateChannelInput {
  name: string
  description?: string
  username?: string
  type: ChannelType
}

export interface CreateChannelPostInput {
  channelId: string
  content?: string
  attachmentUrl?: string
  attachmentType?: string
  attachmentSize?: number
  metadata?: string | null
}

export interface UpdateChannelInput {
  name?: string
  description?: string
  username?: string
  type?: ChannelType
  avatarUrl?: string
}
