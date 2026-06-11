export type ChatRole = 'assistant' | 'user'

export interface ChatMessage {
  id: number
  role: ChatRole
  text: string
  time?: string
  meta?: {
    route?: string
    learned?: boolean
    rationale?: string
    confidenceScore?: number
    confidenceLabel?: string
    noLiveSources?: boolean
    sources?: Array<{
      title: string
      url: string
    }>
  }
}
