export type ChatThemeBackgroundType = 'default' | 'color' | 'image'

export interface ChatTheme {
  id: string
  userId: number
  messageColorHex: string | null
  backgroundType: ChatThemeBackgroundType
  backgroundColorHex: string | null
  backgroundImageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface ChatThemeConfigInput {
  messageColorHex: string | null
  backgroundType: ChatThemeBackgroundType
  backgroundColorHex: string | null
  backgroundImageUrl: string | null
}
