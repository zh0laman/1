export type AskHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export type AskRequest = {
  question: string
  conv_id?: string | null
  conversation_history?: AskHistoryMessage[]
  force_new_session?: boolean
  tool?: string
}

export interface AskConfidence {
  score: number
  label: string
  reason: string
  heuristic: boolean
}

export interface AskSource {
  title: string
  url: string
  content: string
  score?: number | null
}

export interface AskResponse {
  answer: string
  route: string
  learned: boolean
  rationale: string
  confidence: AskConfidence
  sources: AskSource[]
  kb_hits: unknown[]
  conversation_history: AskHistoryMessage[]
  conv_id?: string
  session_id?: string
}

export interface ChatConversationSummary {
  conv_id: string
  name: string
  updated_at?: string | null
  last_message_at?: string | null
  preview?: string | null
  last_message?: string | null
}

export interface ChatConversationDetail {
  conv_id: string
  name: string
  messages: AskHistoryMessage[]
  updated_at?: string | null
}

export interface ChatToolInfo {
  id: string
  label: string
  description: string
  endpoint: string
  method: string
  accepts_text: boolean
  accepts_file: boolean
  file_endpoint?: string
}

export type AskApiResponse = AskResponse
