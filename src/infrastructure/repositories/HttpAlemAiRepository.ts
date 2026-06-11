import { HttpError } from '../http/HttpError'
import { authorizedFetch } from '../http/authorizedFetch'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import type { AskApiResponse, AskRequest, ChatToolInfo } from '../../presentation/pages/alemai/chat/api/types'
import type { SmartAgentChatRequest, SmartAgentChatResponse, SmartAgentTaskItem } from '../../presentation/pages/alemai/smart-agent/types'
import type { TzAiAnalyzeResponse, TzAiCreateTasksResponse, TzAiTaskItem, TzAiToolInfo } from '../../presentation/pages/alemai/tzai/types'
import type {
  MeetingAiAnalyzeJob,
  MeetingAiAnalyzeJobCreated,
  MeetingAiLanguage,
  MeetingAiMeetingAnalyzeResponse,
  MeetingAiSpeechToTextReportResponse,
  MeetingAiTextAnalysisResult,
  MeetingAiTranscriptionResponse,
} from '../../presentation/pages/alemai/meeting-ai/types'
import type {
  KanbanAssigneeAdviceResponse,
  KanbanBoardStatsResponse,
  NotesAiProofreadResponse,
  NotesAiSummarizeResponse,
  TzAiTaskAssistResponse,
} from '../../domain/entities/AiTools'

const RETRYABLE_STATUSES = new Set([502, 503, 504])
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRetryableTransportError = (error: unknown): boolean => {
  if (error instanceof HttpError) {
    return RETRYABLE_STATUSES.has(error.status)
  }

  if (error instanceof TypeError) {
    return true
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('timeout') || message.includes('network')
  }

  return false
}

export interface AlemAiCurrentUser {
  id: number
  email: string
  username: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  role: string | null
  is_active: boolean
}

export interface AlemAiProfile {
  assistant_name: string
  response_style: string
  persona_preset: string
  chat_accent_color: string
  chat_background_type: string
  chat_background_value: string
}

export interface AlemAiReminder {
  id: string
  text: string
  due_at: string
  status?: string
}

interface AskQuestionResult {
  answer: string
  convId: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  fullResponse: AskApiResponse
}

interface AskQuestionWithAttachmentParams {
  question: string
  chatId?: string | null
  file?: File | null
  image?: File | null
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

interface ChatConversationSummaryDto {
  conv_id?: string
  id?: string
  name?: string
  title?: string
  updated_at?: string | null
  last_message_at?: string | null
  preview?: string | null
  last_message?: string | null
}

const KANBAN_TASK_PATHS = (taskId: string): string[] => [
  `/api/v1/kanban/tasks/${encodeURIComponent(taskId)}`,
  `/auth/api/v1/kanban/tasks/${encodeURIComponent(taskId)}`,
]
const ATTACHMENT_CHAT_PATH = '/v1/chat/attachments'
const ADAPTIVE_CHAT_PATH = '/v1/chat/ask_adaptive'
const CHATS_PATH = '/v1/chats'

const normalizeConversationSummary = (input: ChatConversationSummaryDto) => ({
  conv_id: input.conv_id || input.id || '',
  name: input.name || input.title || 'Новый чат',
  updated_at: input.updated_at ?? null,
  last_message_at: input.last_message_at ?? null,
  preview: input.preview ?? null,
  last_message: input.last_message ?? null,
})

const toAskApiResponse = (
  data: Partial<AskApiResponse> & Record<string, unknown>,
  chatId: string,
  baseHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  question: string,
): AskApiResponse => {
  const answer = typeof data.answer === 'string' ? data.answer : ''
  const rawConfidence =
    data.confidence && typeof data.confidence === 'object'
      ? (data.confidence as unknown as {
          score?: unknown
          label?: unknown
          reason?: unknown
          heuristic?: unknown
        })
      : null
  const route =
    typeof data.route === 'string' && data.route.trim()
      ? data.route
      : data.search_backend === 'searxng'
        ? 'web'
        : 'ask_adaptive'
  const sources = Array.isArray(data.sources) ? data.sources : []
  const kbHits = Array.isArray(data.kb_hits) ? data.kb_hits : []
  const conversationHistory = [
    ...baseHistory,
    { role: 'user' as const, content: question },
    { role: 'assistant' as const, content: answer },
  ]

  return {
    answer,
    route,
    learned: Boolean(data.learned),
    rationale: typeof data.rationale === 'string' ? data.rationale : '',
    confidence: rawConfidence
      ? {
          score: Number(rawConfidence.score ?? 0) || 0,
          label: String(rawConfidence.label ?? ''),
          reason: String(rawConfidence.reason ?? ''),
          heuristic: Boolean(rawConfidence.heuristic),
        }
      : {
          score: 0,
          label: '',
          reason: '',
          heuristic: true,
        },
    sources,
    kb_hits: kbHits,
    conversation_history: conversationHistory,
    conv_id: chatId,
    session_id: typeof data.session_id === 'string' ? data.session_id : chatId,
  }
}

export class HttpAlemAiRepository {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  async getCurrentUser(): Promise<AlemAiCurrentUser> {
    return this.requestJson<AlemAiCurrentUser>(['/api/v1/auth/me', '/auth/api/v1/auth/me'])
  }

  async fetchTools(): Promise<ChatToolInfo[]> {
    const payload = await this.requestJson<unknown>(['/api/tools'])
    if (!Array.isArray(payload)) return []

    return payload.filter((item): item is ChatToolInfo => {
      if (!item || typeof item !== 'object') return false
      const row = item as Record<string, unknown>
      return typeof row.id === 'string' && typeof row.label === 'string'
    })
  }

  async askQuestion(payload: AskRequest): Promise<AskQuestionResult> {
    const chatId = payload.conv_id?.trim() || (await this.createChatConversation('Новый чат')).conv_id
    const question = payload.question.trim()
    const baseHistory = Array.isArray(payload.conversation_history) ? payload.conversation_history : []
    const data = await this.requestJson<Partial<AskApiResponse> & Record<string, unknown>>([ADAPTIVE_CHAT_PATH], {
      method: 'POST',
      body: JSON.stringify({
        question,
        chat_id: chatId,
        top_k: 20,
        temperature: 0.15,
        learn: true,
        web_cache_project: null,
        include_web_cache_in_rag: true,
        fast: true,
      }),
    })
    const fullResponse = toAskApiResponse(data || {}, chatId, baseHistory, question)

    return {
      answer: fullResponse.answer,
      convId: chatId,
      conversationHistory: fullResponse.conversation_history,
      fullResponse,
    }
  }

  async askQuestionWithAttachment(params: AskQuestionWithAttachmentParams): Promise<AskQuestionResult> {
    const form = new FormData()
    form.append('question', params.question)

    const chatId = params.chatId?.trim() || (await this.createChatConversation('Новый чат')).conv_id
    form.append('chat_id', chatId)

    if (params.file) {
      form.append('file', params.file)
    }

    if (params.image) {
      form.append('image', params.image)
    }

    const data = await this.requestJson<{ answer?: string; route?: string; vision_model?: string }>([ATTACHMENT_CHAT_PATH], {
      method: 'POST',
      body: form,
    })

    const baseHistory = Array.isArray(params.conversationHistory) ? params.conversationHistory : []
    const nextHistory = [
      ...baseHistory,
      { role: 'user' as const, content: params.question },
      { role: 'assistant' as const, content: data?.answer || '' },
    ]

    const fullResponse: AskApiResponse = {
      answer: data?.answer || '',
      route: data?.route || 'attachments',
      learned: false,
      rationale: '',
      confidence: {
        score: 1,
        label: 'attachment',
        reason: '',
        heuristic: true,
      },
      sources: [],
      kb_hits: [],
      conversation_history: nextHistory,
      conv_id: chatId,
      session_id: chatId,
    }

    return {
      answer: fullResponse.answer,
      convId: chatId,
      conversationHistory: nextHistory,
      fullResponse,
    }
  }

  async listChatConversations(): Promise<
    Array<{
      conv_id: string
      name: string
      updated_at: string | null
      last_message_at: string | null
      preview: string | null
      last_message: string | null
    }>
  > {
    const data = await this.requestJson<{ chats?: unknown[] }>([CHATS_PATH])
    const items = Array.isArray(data?.chats) ? data.chats : []
    return items
      .map((item) => normalizeConversationSummary((item as ChatConversationSummaryDto) || {}))
      .filter((item) => !!item.conv_id)
  }

  async createChatConversation(name: string): Promise<{
    conv_id: string
    name: string
    updated_at: string | null
    last_message_at: string | null
    preview: string | null
    last_message: string | null
  }> {
    const data = await this.requestJson<ChatConversationSummaryDto>([CHATS_PATH], {
      method: 'POST',
      body: JSON.stringify({ title: name || 'Новый чат' }),
    })

    return normalizeConversationSummary(data || {})
  }

  async getChatConversation(convId: string): Promise<{
    conv_id: string
    name: string
    updated_at: string | null
    messages: Array<{ role: 'user' | 'assistant'; content: string; created_at?: string }>
  }> {
    const data = await this.requestJson<{
      name?: string
      title?: string
      messages?: Array<{ role?: string; content?: string; created_at?: string }>
    }>([
      `${CHATS_PATH}/${encodeURIComponent(convId)}/messages`,
    ])

    const messagesSource = Array.isArray(data?.messages) ? data.messages : []

    const messages = messagesSource
      .map((item) => ({
        role: (item?.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: item?.content || '',
        created_at: item?.created_at,
      }))
      .filter((item) => !!item.content)

    return {
      conv_id: convId,
      name: data?.name || data?.title || 'Новый чат',
      updated_at: null,
      messages,
    }
  }

  async smartAgentChat(payload: SmartAgentChatRequest): Promise<SmartAgentChatResponse> {
    return this.requestJson<SmartAgentChatResponse>(['/api/tools/smart-agent/chat'], {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getSmartAgentTask(taskId: string): Promise<SmartAgentTaskItem> {
    return this.requestJson<SmartAgentTaskItem>(KANBAN_TASK_PATHS(taskId))
  }

  async fetchTzTools(): Promise<TzAiToolInfo[]> {
    return this.requestJson<TzAiToolInfo[]>(['/api/tools'])
  }

  async fetchTzModels(): Promise<unknown> {
    return this.requestJson<unknown>(['/api/tools/tzai/models'])
  }

  async fetchTzBoards(): Promise<unknown> {
    return this.requestJson<unknown>(['/api/tools/tzai/boards'])
  }

  async fetchTzBoardDetails(boardId: string): Promise<unknown> {
    return this.requestJson<unknown>([`/api/tools/tzai/boards/${encodeURIComponent(boardId)}`])
  }

  async analyzeTzText(text: string, model?: string): Promise<TzAiAnalyzeResponse> {
    return this.requestJson<TzAiAnalyzeResponse>(['/api/tools/tzai/analyze-text'], {
      method: 'POST',
      body: JSON.stringify({ text, ...(model ? { model } : {}) }),
    })
  }

  async analyzeTzMultipart(params: { text?: string; file?: File; model?: string }): Promise<TzAiAnalyzeResponse> {
    const form = new FormData()

    if (params.text?.trim()) form.append('text', params.text.trim())
    if (params.file) form.append('file', params.file)
    if (params.model?.trim()) form.append('model', params.model.trim())

    return this.requestJson<TzAiAnalyzeResponse>(['/api/tools/tzai/analyze'], {
      method: 'POST',
      body: form,
    })
  }

  async analyzeTzViaLocalApi(file: File, model: string = 'openai/gpt-oss-120b'): Promise<TzAiAnalyzeResponse> {
    const form = new FormData()
    form.append('file', file)
    form.append('model', model)

    const url = '/api/tools/tzai/analyze'

    return this.requestJson<TzAiAnalyzeResponse>([url], {
      method: 'POST',
      body: form,
    })
  }

  async createTzTasks(tasks: TzAiTaskItem[]): Promise<TzAiCreateTasksResponse> {
    const url = '/api/tools/tzai/create-tasks'

    return this.requestJson<TzAiCreateTasksResponse>([url], {
      method: 'POST',
      body: JSON.stringify({ tasks }),
    })
  }

  async proofreadNote(params: { content?: string; content_doc?: any; model?: string }): Promise<NotesAiProofreadResponse> {
    return this.requestJson<NotesAiProofreadResponse>(['/api/tools/notes-ai/proofread'], {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async summarizeNote(params: { content?: string; content_doc?: any }): Promise<NotesAiSummarizeResponse> {
    return this.requestJson<NotesAiSummarizeResponse>(['/api/tools/notes-ai/summarize'], {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async getTaskAssist(params: {
    text: string
    title?: string
    board_id?: string
    current_priority?: 'low' | 'medium' | 'high' | 'critical'
    current_sprint_id?: string
    current_assignee_id?: number
    current_due_at?: string
    model?: string
    file_ids?: string[]
  }): Promise<TzAiTaskAssistResponse> {
    return this.requestJson<TzAiTaskAssistResponse>(['/api/tools/tzai/task-assist'], {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  async getBoardStats(boardId: string): Promise<KanbanBoardStatsResponse> {
    return this.requestJson<KanbanBoardStatsResponse>([`/api/tools/kanban/boards/${encodeURIComponent(boardId)}/stats`])
  }

  async getKanbanAssigneeAdvice(
    boardId: string,
    payload: {
      title: string
      description: string
      user_id: number
      team_role: string
    },
  ): Promise<KanbanAssigneeAdviceResponse> {
    return this.requestJson<KanbanAssigneeAdviceResponse>(
      [`/api/tools/kanban/boards/${encodeURIComponent(boardId)}/assignee-advice`],
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  }

  async speechToText(file: File, options: { model?: string; reportLanguage?: MeetingAiLanguage }): Promise<MeetingAiTranscriptionResponse> {
    return this.postMeetingForm('/api/tools/meeting-ai/speech-to-text', file, options)
  }

  async speechToTextReport(
    file: File,
    options: { model?: string; reportLanguage?: MeetingAiLanguage },
  ): Promise<MeetingAiSpeechToTextReportResponse> {
    return this.postMeetingForm('/api/tools/meeting-ai/speech-to-text/report', file, options)
  }

  async meetingAnalyze(
    file: File,
    options: { model?: string; reportLanguage?: MeetingAiLanguage },
  ): Promise<MeetingAiMeetingAnalyzeResponse> {
    return this.postMeetingForm('/api/tools/meeting-ai/meeting/analyze', file, options)
  }

  async startMeetingAnalyzeAsync(
    file: File,
    options: { model?: string; reportLanguage?: MeetingAiLanguage },
  ): Promise<MeetingAiAnalyzeJobCreated> {
    return this.postMeetingForm<MeetingAiAnalyzeJobCreated>(
      '/api/tools/meeting-ai/meeting/analyze/async',
      file,
      options,
    )
  }

  async listMeetingAnalyzeJobs(): Promise<MeetingAiAnalyzeJob[]> {
    const payload = await this.requestJson<unknown>(['/api/tools/meeting-ai/meeting/analyze'])
    return this.parseMeetingAnalyzeJobs(payload)
  }

  async getMeetingAnalyzeJob(jobId: string): Promise<MeetingAiAnalyzeJob> {
    const payload = await this.requestJson<unknown>([
      `/api/tools/meeting-ai/meeting/analyze/${encodeURIComponent(jobId)}`,
    ])
    return this.normalizeMeetingAnalyzeJob(payload)
  }

  private parseMeetingAnalyzeJobs(payload: unknown): MeetingAiAnalyzeJob[] {
    if (Array.isArray(payload)) {
      return payload.map((item) => this.normalizeMeetingAnalyzeJob(item))
    }
    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>
      const list = obj.data ?? obj.jobs ?? obj.items
      if (Array.isArray(list)) {
        return list.map((item) => this.normalizeMeetingAnalyzeJob(item))
      }
    }
    return []
  }

  private normalizeMeetingAnalyzeJob(payload: unknown): MeetingAiAnalyzeJob {
    if (!payload || typeof payload !== 'object') {
      throw new HttpError('Некорректный ответ Meeting AI', 500)
    }
    const obj = payload as Record<string, unknown>
    const nested = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj
    const jobId = String(nested.job_id ?? nested.jobId ?? '')
    if (!jobId) {
      throw new HttpError('Некорректный ответ Meeting AI', 500)
    }
    return {
      job_id: jobId,
      status: (nested.status as MeetingAiAnalyzeJob['status']) ?? 'queued',
      created_at: typeof nested.created_at === 'string' ? nested.created_at : undefined,
      updated_at: typeof nested.updated_at === 'string' ? nested.updated_at : undefined,
      filename: typeof nested.filename === 'string' ? nested.filename : undefined,
      result:
        nested.result && typeof nested.result === 'object'
          ? (nested.result as MeetingAiAnalyzeJob['result'])
          : null,
      error: typeof nested.error === 'string' ? nested.error : null,
    }
  }

  async analyzeText(text: string, reportLanguage: MeetingAiLanguage): Promise<MeetingAiTextAnalysisResult> {
    return this.requestJson<MeetingAiTextAnalysisResult>(['/api/tools/meeting-ai/text-analysis'], {
      method: 'POST',
      body: JSON.stringify({ text, report_language: reportLanguage }),
    })
  }

  async getProfile(): Promise<AlemAiProfile> {
    return this.requestJson<AlemAiProfile>(['/api/v1/profile'])
  }

  async updateProfile(profile: AlemAiProfile): Promise<AlemAiProfile> {
    return this.requestJson<AlemAiProfile>(['/api/v1/profile'], {
      method: 'PUT',
      body: JSON.stringify(profile),
    })
  }

  async listReminders(): Promise<AlemAiReminder[]> {
    const data = await this.requestJson<{ reminders?: AlemAiReminder[] }>(['/api/v1/reminders?status=pending'])
    return Array.isArray(data?.reminders) ? data.reminders : []
  }

  async createReminder(text: string, dueAt: string): Promise<AlemAiReminder> {
    return this.requestJson<AlemAiReminder>(['/api/v1/reminders'], {
      method: 'POST',
      body: JSON.stringify({ text, due_at: dueAt }),
    })
  }

  async markReminderDone(reminderId: string): Promise<void> {
    await this.requestJson<unknown>([`/api/v1/reminders/${encodeURIComponent(reminderId)}`], {
      method: 'PATCH',
      body: JSON.stringify({ status: 'done' }),
    })
  }

  async deleteReminder(reminderId: string): Promise<void> {
    await this.request([`/api/v1/reminders/${encodeURIComponent(reminderId)}`], {
      method: 'DELETE',
    })
  }

  async pollDueReminders(): Promise<AlemAiReminder[]> {
    const data = await this.requestJson<{ reminders?: AlemAiReminder[] }>(['/api/v1/reminders/due'])
    return Array.isArray(data?.reminders) ? data.reminders : []
  }

  private async postMeetingForm<T>(
    path: string,
    file: File,
    options: { model?: string; reportLanguage?: MeetingAiLanguage },
  ): Promise<T> {
    const form = new FormData()
    form.append('file', file)
    if (options.model?.trim()) form.append('model', options.model.trim())
    if (options.reportLanguage) form.append('report_language', options.reportLanguage)

    return this.requestJson<T>([path], { method: 'POST', body: form })
  }

  private async requestJson<T>(paths: string[], init: RequestInit = {}): Promise<T> {
    const response = await this.request(paths, init)

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return null as T
    }

    return (await response.json()) as T
  }

  private async request(paths: string[], init: RequestInit = {}): Promise<Response> {
    let lastError: unknown = null

    for (let index = 0; index < paths.length; index += 1) {
      const path = paths[index]
      const isMeetingAiPath = path.includes('/api/tools/meeting-ai/')
      const isAttachmentPath = path === ATTACHMENT_CHAT_PATH
      const maxAttempts = isMeetingAiPath || isAttachmentPath ? 2 : 1

      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            return await authorizedFetch(this.sessionStore, path, init)
          } catch (error) {
            lastError = error
            const shouldRetry = attempt < maxAttempts && isRetryableTransportError(error)
            if (!shouldRetry) {
              throw error
            }
            await sleep(600 * attempt)
          }
        }
      } catch (error) {
        lastError = error

        const isLast = index === paths.length - 1
        const isHttp404 = error instanceof HttpError && error.status === 404
        if (!isLast && isHttp404) {
          continue
        }

        throw error
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Не удалось выполнить запрос AlemAI')
  }
}
