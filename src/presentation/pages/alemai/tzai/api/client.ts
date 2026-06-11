import { getAlemAiApi } from '../../runtime'
import type {
  AssigneeOption,
  BoardDetails,
  BoardOption,
  ColumnOption,
  SprintOption,
  TzAiAnalyzeResponse,
  TzAiCreateTasksResponse,
  TzAiTaskItem,
  TzAiToolInfo,
} from '../types'

export class TzAiApiError extends Error {
  status: number
  errors: string[]

  constructor(message: string, status: number, errors: string[] = []) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

const extractErrorParts = (error: unknown, fallback: string): { message: string; errors: string[]; status: number } => {
  if (error instanceof Error) {
    const maybe = error as Error & { status?: number; details?: unknown }
    const details = Array.isArray(maybe.details)
      ? maybe.details.filter((item): item is string => typeof item === 'string')
      : []
    return {
      message: maybe.message || fallback,
      errors: details,
      status: typeof maybe.status === 'number' ? maybe.status : 500,
    }
  }

  return { message: fallback, errors: [], status: 500 }
}

const extractArray = (payload: unknown, keys: string[]): unknown[] => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  for (const key of keys) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

const toStringArray = (payload: unknown): string[] => {
  const rows = extractArray(payload, ['models', 'items', 'data', 'results'])
  return rows
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>
        if (typeof row.id === 'string') return row.id
        if (typeof row.name === 'string') return row.name
        if (typeof row.model === 'string') return row.model
      }
      return null
    })
    .filter((item): item is string => item !== null)
}

const toBoardOptions = (payload: unknown): BoardOption[] => {
  const rows = extractArray(payload, ['boards', 'items', 'data', 'results'])
  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return null

      const row = item as Record<string, unknown>
      const id = row.id
      const name = row.name ?? row.title ?? row.label ?? row.id

      if (typeof id !== 'string' || typeof name !== 'string') return null

      return { id, name } satisfies BoardOption
    })
    .filter((item): item is BoardOption => item !== null)
}

const mapToNamedOptions = <T,>(payload: unknown[], mapper: (row: Record<string, unknown>) => T | null): T[] =>
  payload
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      return mapper(item as Record<string, unknown>)
    })
    .filter((item): item is T => item !== null)

const toColumnOptions = (payload: unknown[]): ColumnOption[] =>
  mapToNamedOptions<ColumnOption>(payload, (column) => {
    const source =
      column.column && typeof column.column === 'object'
        ? (column.column as Record<string, unknown>)
        : column

    const id = source.id
    const name = source.name ?? source.title ?? source.label ?? source.id

    if (typeof id !== 'string' || typeof name !== 'string') return null

    return { id, name }
  })

const toSprintOptions = (payload: unknown[]): SprintOption[] =>
  mapToNamedOptions<SprintOption>(payload, (sprint) => {
    const id = sprint.id
    const name = sprint.name ?? sprint.title ?? sprint.label ?? sprint.id

    if (typeof id !== 'string' || typeof name !== 'string') return null

    return { id, name }
  })

const toAssigneeOptions = (payload: unknown[]): AssigneeOption[] =>
  mapToNamedOptions<AssigneeOption>(payload, (assignee) => {
    const idRaw = assignee.id ?? assignee.user_id
    const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
    if (!Number.isFinite(id)) return null

    const nameCandidates = [
      assignee.full_name,
      assignee.name,
      assignee.username,
      assignee.email,
      `${assignee.first_name ?? ''} ${assignee.last_name ?? ''}`.trim(),
    ]
    const name = nameCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim()) as string | undefined

    return { id, name: name ?? `User #${id}` }
  })

export const fetchTools = async (_token: string): Promise<TzAiToolInfo[]> => {
  void _token
  try {
    const api = getAlemAiApi()
    return await api.fetchTzTools()
  } catch (error) {
    const normalized = extractErrorParts(error, 'Не удалось получить список инструментов')
    throw new TzAiApiError(normalized.message, normalized.status, normalized.errors)
  }
}

export const fetchModels = async (_token: string): Promise<string[]> => {
  void _token
  try {
    const api = getAlemAiApi()
    const payload = await api.fetchTzModels()
    return toStringArray(payload)
  } catch (error) {
    const normalized = extractErrorParts(error, 'Не удалось получить список моделей')
    throw new TzAiApiError(normalized.message, normalized.status, normalized.errors)
  }
}

export const fetchBoards = async (_token: string): Promise<BoardOption[]> => {
  void _token
  try {
    const api = getAlemAiApi()
    const payload = await api.fetchTzBoards()
    return toBoardOptions(payload)
  } catch (error) {
    const normalized = extractErrorParts(error, 'Не удалось получить доски')
    throw new TzAiApiError(normalized.message, normalized.status, normalized.errors)
  }
}

export const fetchBoardColumns = async (_token: string, boardId: string): Promise<ColumnOption[]> => {
  const details = await fetchBoardDetails(_token, boardId)
  return details.columns
}

export const fetchBoardDetails = async (_token: string, boardId: string): Promise<BoardDetails> => {
  try {
    const api = getAlemAiApi()
    const payload = await api.fetchTzBoardDetails(boardId)

    const columns = toColumnOptions(extractArray(payload, ['columns', 'kanban_columns', 'board_columns']))
    const sprints = toSprintOptions(extractArray(payload, ['sprints', 'board_sprints', 'iterations']))
    const assignees = toAssigneeOptions(extractArray(payload, ['members', 'assignees', 'participants', 'users']))

    return {
      columns,
      sprints,
      assignees,
    }
  } catch (error) {
    const normalized = extractErrorParts(error, 'Не удалось получить данные доски')
    throw new TzAiApiError(normalized.message, normalized.status, normalized.errors)
  }
}

export const analyzeTzText = async (_token: string, text: string, model?: string): Promise<TzAiAnalyzeResponse> => {
  void _token
  try {
    const api = getAlemAiApi()
    return await api.analyzeTzText(text, model)
  } catch (error) {
    const normalized = extractErrorParts(error, 'Не удалось проанализировать ТЗ')
    throw new TzAiApiError(normalized.message, normalized.status, normalized.errors)
  }
}

export const analyzeTzMultipart = async (
  _token: string,
  params: { text?: string; file?: File; model?: string },
): Promise<TzAiAnalyzeResponse> => {
  void _token
  try {
    const api = getAlemAiApi()
    return await api.analyzeTzMultipart(params)
  } catch (error) {
    const normalized = extractErrorParts(error, 'Не удалось проанализировать файл/текст')
    throw new TzAiApiError(normalized.message, normalized.status, normalized.errors)
  }
}

export const createTzTasks = async (_token: string, tasks: TzAiTaskItem[]): Promise<TzAiCreateTasksResponse> => {
  void _token
  try {
    const api = getAlemAiApi()
    return await api.createTzTasks(tasks)
  } catch (error) {
    const normalized = extractErrorParts(error, 'Не удалось создать задачи в Kanban')
    throw new TzAiApiError(normalized.message, normalized.status, normalized.errors)
  }
}
