import type { ChatTheme, ChatThemeBackgroundType, ChatThemeConfigInput } from '../../domain/entities/ChatTheme'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import { HttpError } from '../http/HttpError'
import { authorizedFetch } from '../http/authorizedFetch'
import { normalizeBackendAssetUrl } from '../http/normalizeBackendAssetUrl'

interface ChatThemeDto {
  id: string
  user_id: number
  message_color_hex?: string | null
  background_type?: string | null
  background_color_hex?: string | null
  background_image_url?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const normalizeBackgroundType = (value: string | null | undefined): ChatThemeBackgroundType => {
  if (value === 'color' || value === 'image' || value === 'default') {
    return value
  }

  return 'default'
}

const mapThemeDto = (value: ChatThemeDto): ChatTheme => ({
  id: value.id,
  userId: value.user_id,
  messageColorHex: value.message_color_hex ?? null,
  backgroundType: normalizeBackgroundType(value.background_type),
  backgroundColorHex: value.background_color_hex ?? null,
  backgroundImageUrl: normalizeBackendAssetUrl(value.background_image_url) ?? value.background_image_url ?? null,
  createdAt: value.created_at ?? '',
  updatedAt: value.updated_at ?? '',
})

export class HttpChatThemeRepository {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  async getTheme(): Promise<ChatTheme | null> {
    try {
      const response = await authorizedFetch(this.sessionStore, '/api/v1/chat-themes')
      const payload = (await response.json()) as ChatThemeDto
      return mapThemeDto(payload)
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return null
      }

      throw error
    }
  }

  async setTheme(theme: ChatThemeConfigInput): Promise<ChatTheme> {
    const response = await authorizedFetch(this.sessionStore, '/api/v1/chat-themes', {
      method: 'POST',
      body: JSON.stringify({
        chatTheme: {
          messageColorHex: theme.messageColorHex,
          backgroundType: theme.backgroundType,
          backgroundColorHex: theme.backgroundColorHex,
          backgroundImageUrl: theme.backgroundImageUrl,
        },
      }),
    })

    const payload = (await response.json()) as ChatThemeDto
    return mapThemeDto(payload)
  }

  async deleteTheme(): Promise<void> {
    await authorizedFetch(this.sessionStore, '/api/v1/chat-themes', {
      method: 'DELETE',
    })
  }
}
