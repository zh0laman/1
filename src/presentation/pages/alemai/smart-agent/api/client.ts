import { HttpError } from '../../../../../infrastructure/http/HttpError'
import { getAlemAiApi } from '../../runtime'
import type { SmartAgentChatRequest, SmartAgentChatResponse, SmartAgentTaskItem } from '../types'

export class SmartAgentApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const fallbackByStatus = (status: number): string => {
  if (status === 401) return 'Сессия истекла. Пожалуйста, войдите снова.'
  if (status === 502) return 'Сервис временно недоступен. Попробуйте еще раз.'
  return 'Не удалось выполнить действие. Попробуйте ещё раз.'
}

const RFC3339_WITH_TIMEZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const ISO_WITHOUT_TIMEZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/

const normalizeDueAt = (value: unknown): unknown => {
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed || RFC3339_WITH_TIMEZONE_RE.test(trimmed) || !ISO_WITHOUT_TIMEZONE_RE.test(trimmed)) return value

  const localDate = new Date(trimmed)
  if (Number.isNaN(localDate.getTime())) return value

  const offsetMinutes = -localDate.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0')
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0')
  return `${trimmed}${sign}${hours}:${minutes}`
}

const normalizeToolArguments = (name: unknown, rawArguments: unknown): unknown => {
  if (name !== 'create_kanban_task' || typeof rawArguments !== 'string') return rawArguments

  try {
    const parsed = JSON.parse(rawArguments) as Record<string, unknown>
    return JSON.stringify({ ...parsed, due_at: normalizeDueAt(parsed.due_at) })
  } catch {
    return rawArguments
  }
}

const normalizeConversationHistory = (history: unknown[]): unknown[] =>
  history.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry

    const item = entry as Record<string, unknown>
    if (!Array.isArray(item.tool_calls)) return entry

    return {
      ...item,
      tool_calls: item.tool_calls.map((toolCall) => {
        if (!toolCall || typeof toolCall !== 'object' || Array.isArray(toolCall)) return toolCall

        const typedToolCall = toolCall as Record<string, unknown>
        const fn =
          typedToolCall.function && typeof typedToolCall.function === 'object' && !Array.isArray(typedToolCall.function)
            ? (typedToolCall.function as Record<string, unknown>)
            : null

        if (!fn) return toolCall

        return {
          ...typedToolCall,
          function: {
            ...fn,
            arguments: normalizeToolArguments(fn.name, fn.arguments),
          },
        }
      }),
    }
  })

const toApiError = (error: unknown): SmartAgentApiError => {
  if (error instanceof HttpError) {
    return new SmartAgentApiError(error.message || fallbackByStatus(error.status), error.status)
  }

  if (error instanceof Error) {
    return new SmartAgentApiError(error.message, 500)
  }

  return new SmartAgentApiError('Не удалось выполнить действие. Попробуйте ещё раз.', 500)
}

export const smartAgentChat = async (
  _token: string,
  payload: SmartAgentChatRequest,
): Promise<SmartAgentChatResponse> => {
  try {
    const normalizedPayload: SmartAgentChatRequest = {
      ...payload,
      conversation_history: normalizeConversationHistory(payload.conversation_history),
    }
    const api = getAlemAiApi()
    return await api.smartAgentChat(normalizedPayload)
  } catch (error) {
    throw toApiError(error)
  }
}

export const getSmartAgentTask = async (_token: string, taskId: string): Promise<SmartAgentTaskItem> => {
  try {
    const api = getAlemAiApi()
    return await api.getSmartAgentTask(taskId)
  } catch (error) {
    throw toApiError(error)
  }
}
