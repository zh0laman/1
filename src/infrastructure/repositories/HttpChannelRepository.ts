import type {
  Channel,
  ChannelMember,
  ChannelPost,
  ChannelPostReactionSummary,
  ChannelPostView,
  ChannelRole,
  ChannelView,
  CreateChannelInput,
  CreateChannelPostInput,
  UpdateChannelInput,
} from '../../domain/entities/Channel'
import type { MessageViewer } from '../../domain/entities/Chat'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import { authorizedFetch } from '../http/authorizedFetch'
import { normalizeBackendAssetUrl } from '../http/normalizeBackendAssetUrl'
import { type MessageViewerDto, toMessageViewer } from './HttpChatRepository'

// ─── DTO shapes ──────────────────────────────────────────────────────────────

export interface ChannelPostDto {
  id: string
  channel_id: string
  author_id: number
  content?: string | null
  attachment_url?: string | null
  attachment_type?: string | null
  attachment_size?: number | null
  is_pinned: boolean
  is_deleted: boolean
  is_edited: boolean
  is_forwarded: boolean
  original_channel_id?: string | null
  original_post_id?: string | null
  views_count: number
  comments_count: number
  linked_group_id?: string | null
  metadata?: string | null
  edited_at?: string | null
  created_at: string
  updated_at: string
}

interface ReactionDto {
  reaction: string
  count: number
  reacted: boolean
  users: Array<{ id: number; full_name: string; avatar: string | null }>
}

export interface ChannelPostViewDto extends ChannelPostDto {
  author_name: string
  author_avatar?: string | null
  channel_name: string
  channel_avatar?: string | null
  reactions?: ReactionDto[]
  is_viewed: boolean
}

interface ChannelDto {
  id: string
  name: string
  description?: string | null
  username?: string | null
  avatar_url?: string | null
  type: 'public' | 'private'
  created_by: number
  is_active: boolean
  member_count: number
  created_at: string
  updated_at: string
}

interface ChannelViewDto extends ChannelDto {
  my_role?: string | null
  is_subscribed: boolean
  is_muted: boolean
  last_post?: ChannelPostDto | null
}

interface ChannelMemberDto {
  channel_id: string
  user_id: number
  role: string
  is_muted: boolean
  joined_at: string
  left_at?: string | null
  created_at: string
  user_full_name?: string
  user_username?: string
  user_avatar?: string | null
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

const normalizeAsset = (value: string | null | undefined): string | null =>
  normalizeBackendAssetUrl(value) ?? value ?? null

export const toChannelPost = (dto: ChannelPostDto): ChannelPost => ({
  id: dto.id,
  channelId: dto.channel_id,
  authorId: dto.author_id,
  content: dto.content ?? null,
  attachmentUrl: normalizeAsset(dto.attachment_url),
  attachmentType: dto.attachment_type ?? null,
  attachmentSize: dto.attachment_size ?? null,
  isPinned: dto.is_pinned,
  isDeleted: dto.is_deleted,
  isEdited: dto.is_edited,
  isForwarded: dto.is_forwarded,
  originalChannelId: dto.original_channel_id ?? null,
  originalPostId: dto.original_post_id ?? null,
  viewsCount: dto.views_count,
  commentsCount: dto.comments_count,
  linkedGroupId: dto.linked_group_id ?? null,
  metadata: dto.metadata ?? null,
  editedAt: dto.edited_at ?? null,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
})

const toChannelPostView = (dto: ChannelPostViewDto): ChannelPostView => ({
  ...toChannelPost(dto),
  authorName: dto.author_name,
  authorAvatar: normalizeAsset(dto.author_avatar),
  channelName: dto.channel_name,
  channelAvatar: normalizeAsset(dto.channel_avatar),
  reactions: (dto.reactions ?? []).map((r): ChannelPostReactionSummary => ({
    reaction: r.reaction,
    count: r.count,
    reacted: r.reacted,
    users: (r.users ?? []).map((u) => ({
      id: u.id,
      fullName: u.full_name,
      avatar: normalizeAsset(u.avatar),
    })),
  })),
  isViewed: dto.is_viewed,
})

const toChannel = (dto: ChannelDto): Channel => ({
  id: dto.id,
  name: dto.name,
  description: dto.description ?? null,
  username: dto.username ?? null,
  avatarUrl: normalizeAsset(dto.avatar_url),
  type: dto.type,
  createdBy: dto.created_by,
  isActive: dto.is_active,
  memberCount: dto.member_count,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
})

const toChannelView = (dto: ChannelViewDto): ChannelView => ({
  ...toChannel(dto),
  myRole: (dto.my_role as ChannelView['myRole']) ?? null,
  isSubscribed: dto.is_subscribed,
  isMuted: dto.is_muted,
  lastPost: dto.last_post ? toChannelPost(dto.last_post) : null,
})

const toChannelMember = (dto: ChannelMemberDto): ChannelMember => ({
  channelId: dto.channel_id,
  userId: dto.user_id,
  role: dto.role as ChannelRole,
  isMuted: dto.is_muted,
  joinedAt: dto.joined_at,
  leftAt: dto.left_at ?? null,
  createdAt: dto.created_at,
  userFullName: dto.user_full_name,
  userUsername: dto.user_username,
  userAvatar: normalizeAsset(dto.user_avatar),
})

// ─── Repository ──────────────────────────────────────────────────────────────

export class HttpChannelRepository {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  async createChannel(input: CreateChannelInput): Promise<ChannelView> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/channels', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        description: input.description ?? '',
        username: input.username ?? undefined,
        type: input.type,
      }),
    })
    return toChannelView((await response.json()) as ChannelViewDto)
  }

  async getMyChannels(): Promise<ChannelView[]> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/channels')
    const data = (await response.json()) as { channels: ChannelViewDto[] } | ChannelViewDto[]
    const list = Array.isArray(data) ? data : (data.channels ?? [])
    return list.map(toChannelView)
  }

  async getChannel(channelId: string): Promise<ChannelView> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}`)
    return toChannelView((await response.json()) as ChannelViewDto)
  }

  async searchChannels(query: string): Promise<ChannelView[]> {
    const params = new URLSearchParams({ q: query }).toString()
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/search?${params}`)
    const data = (await response.json()) as { channels: ChannelViewDto[] } | ChannelViewDto[]
    const list = Array.isArray(data) ? data : (data.channels ?? [])
    return list.map(toChannelView)
  }

  async getChannelByUsername(username: string): Promise<ChannelView> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/username/${username}`)
    return toChannelView((await response.json()) as ChannelViewDto)
  }

  async subscribe(channelId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}/subscribe`, {
      method: 'POST',
    })
  }

  async unsubscribe(channelId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}/subscribe`, {
      method: 'DELETE',
    })
  }

  async setMute(channelId: string, mute: boolean): Promise<boolean> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}/mute`, {
      method: 'PUT',
      body: JSON.stringify({ mute }),
    })
    const data = (await response.json()) as { muted?: boolean; is_muted?: boolean }
    return Boolean(data.muted ?? data.is_muted)
  }

  async getPosts(channelId: string, params?: { limit?: number; offset?: number }): Promise<ChannelPostView[]> {
    const limit = params?.limit ?? 30
    const offset = params?.offset ?? 0
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) }).toString()
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}/posts?${query}`)
    const data = (await response.json()) as { posts: ChannelPostViewDto[] } | ChannelPostViewDto[]
    const list = Array.isArray(data) ? data : (data.posts ?? [])
    return list.map(toChannelPostView)
  }

  async createPost(input: CreateChannelPostInput): Promise<ChannelPostView> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/${input.channelId}/posts`, {
      method: 'POST',
      body: JSON.stringify({
        content: input.content ?? null,
        attachment_url: input.attachmentUrl ?? null,
        attachment_type: input.attachmentType ?? null,
        attachment_size: input.attachmentSize ?? null,
        metadata: input.metadata ?? null,
      }),
    })
    return toChannelPostView((await response.json()) as ChannelPostViewDto)
  }

  async markPostViewed(postId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/channels/posts/${postId}/view`, {
      method: 'POST',
    })
  }

  async pinPost(postId: string, pinned: boolean): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/channels/posts/${postId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ pinned }),
    })
  }

  async deletePost(postId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/channels/posts/${postId}`, {
      method: 'DELETE',
    })
  }

  async editPost(postId: string, content: string): Promise<ChannelPostView> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
    return toChannelPostView((await response.json()) as ChannelPostViewDto)
  }

  async getPostViewers(postId: string): Promise<MessageViewer[]> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/posts/${postId}/viewers`)
    const data = (await response.json()) as MessageViewerDto[] | null
    return (data ?? []).map(toMessageViewer)
  }

  async addReaction(postId: string, reaction: string): Promise<ChannelPostReactionSummary[]> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/posts/${postId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ reaction }),
    })
    const data = (await response.json()) as { reactions: ReactionDto[] }
    return (data.reactions ?? []).map((r): ChannelPostReactionSummary => ({
      reaction: r.reaction,
      count: r.count,
      reacted: r.reacted,
      users: (r.users ?? []).map((u) => ({
        id: u.id,
        fullName: u.full_name,
        avatar: normalizeAsset(u.avatar),
      })),
    }))
  }

  async removeReaction(postId: string, reaction: string): Promise<ChannelPostReactionSummary[]> {
    const encoded = encodeURIComponent(reaction)
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/posts/${postId}/reactions/${encoded}`, {
      method: 'DELETE',
    })
    const data = (await response.json()) as { reactions: ReactionDto[] }
    return (data.reactions ?? []).map((r): ChannelPostReactionSummary => ({
      reaction: r.reaction,
      count: r.count,
      reacted: r.reacted,
      users: (r.users ?? []).map((u) => ({
        id: u.id,
        fullName: u.full_name,
        avatar: normalizeAsset(u.avatar),
      })),
    }))
  }

  async deleteChannel(channelId: string): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}`, {
      method: 'DELETE',
    })
  }

  async addMembers(channelId: string, userIds: number[]): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds }),
    })
  }

  async getAdmins(channelId: string): Promise<ChannelMember[]> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}/admins`)
    const data = (await response.json()) as { members: ChannelMemberDto[] }
    return (data.members ?? []).map(toChannelMember)
  }

  async getMembers(channelId: string, role?: string, limit?: number, offset?: number): Promise<ChannelMember[]> {
    const params = new URLSearchParams()
    if (role) params.append('role', role)
    if (limit) params.append('limit', String(limit))
    if (offset) params.append('offset', String(offset))
    const query = params.toString()
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}/members?${query}`)
    const data = (await response.json()) as { members: ChannelMemberDto[] }
    return (data.members ?? []).map(toChannelMember)
  }

  async updateChannel(channelId: string, input: UpdateChannelInput): Promise<ChannelView> {
    const response = await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        username: input.username,
        type: input.type,
        avatar_url: input.avatarUrl,
      }),
    })
    return toChannelView((await response.json()) as ChannelViewDto)
  }

  async removeMember(channelId: string, userId: number): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}/members/${userId}`, {
      method: 'DELETE',
    })
  }

  async updateMemberRole(channelId: string, userId: number, role: ChannelRole): Promise<void> {
    await authorizedFetch(this.sessionStore, `/api/v1/channels/${channelId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })
  }
}
