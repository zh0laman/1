import type {
  Board,
  BoardAttachment,
  BoardBackground,
  BoardColumn,
  BoardComment,
  BoardDetails,
  BoardHistory,
  BoardLabel,
  BoardMember,
  BoardSprint,
  BoardTask,
  BoardUser,
  BoardWorklog,
  CreateBoardTaskPayload,
  KanbanFilteredBoardParams,
  KanbanTaskSearchParams,
  OrgAccessCheck,
  OrgAccessUser,
  OrgKanbanStats,
  UpdateBoardTaskPayload,
  BoardStats,
  BoardGoal,
  BoardProject,
} from '../../domain/entities/board/BoardModels'
import type { BoardRepository } from '../../domain/repositories/BoardRepository'
import type { AuthSessionStore } from '../../domain/services/AuthSessionStore'
import { authorizedFetch } from '../http/authorizedFetch'
import { normalizeBackendAssetUrl } from '../http/normalizeBackendAssetUrl'

interface BoardDto {
  id: string
  name: string
  owner_id: number
  created_at?: string
  progress?: {
    total_tasks?: number
    completed_tasks?: number
    completion_percent?: number
  }
}

interface BackgroundDto {
  image_url?: string
  mode?: string
  preset_hex?: string
  preset_id?: string
}

interface ColumnDto {
  id: string
  board_id: string
  name: string
  key: string
  position: number
}

interface SprintDto {
  id: string
  board_id: string
  goal_id?: string
  project_id?: string
  name: string
  status: string
  start_date?: string
  end_date?: string
}

interface GoalDto {
  id: string
  board_id: string
  name: string
  description?: string
  task_count?: number
  completed_tasks?: number
  active_tasks?: number
  overdue_tasks?: number
  project_count?: number
  sprint_count?: number
  completion_percent?: number
  top_project_name?: string
  prediction_label?: string
  next_action_label?: string
  created_by: number
  created_at: string
  updated_at: string
}

interface ProjectDto {
  id: string
  board_id: string
  goal_id?: string
  name: string
  description?: string
  status: string
  created_by: number
  created_at: string
  updated_at: string
}


interface LabelDto {
  id: string
  board_id: string
  name: string
  color: string
  created_at?: string
}

interface UserDto {
  id: number
  email?: string
  first_name?: string
  last_name?: string
  full_name?: string
  username?: string
  avatar_url?: string
  role?: string
  availability_status?: string
}

interface AttachmentDto {
  id: string
  task_id: string
  file_name: string
  object_name?: string
  file_size: number
  mime_type: string
  download_url?: string
  created_at: string
}

interface TaskDto {
  id: string
  board_id: string
  column_id: string
  sprint_id?: string
  goal_id?: string
  project_id?: string
  task_number?: number
  task_key?: string
  link?: string
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  status?: string
  assignee_ids?: number[]
  original_estimate_sec?: number
  time_spent_sec?: number
  due_at?: string
  created_by?: number
  created_at?: string
  updated_at?: string
  attachments?: AttachmentDto[]
  labels?: LabelDto[]
  parent_id?: string | null
  subtasks?: TaskDto[]
}

interface MemberDto {
  board_id: string
  user_id: number
  role?: string
  team_role?: string | null
  user?: UserDto | null
  full_name?: string
  joined_at?: string
}

interface WorklogDto {
  id: string
  task_id: string
  user_id: number
  time_spent_sec: number
  comment?: string
  started_at?: string
  created_at: string
}

interface HistoryDto {
  id: string
  task_id: string
  user_id: number
  action: string
  field_name?: string
  old_value?: string
  new_value?: string
  details?: string
  created_at: string
  user?: UserDto | null
}

interface CommentDto {
  id: string
  task_id: string
  user_id: number
  content?: string
  attachment_url?: string
  created_at: string
  updated_at?: string
  author?: UserDto | null
}

interface BoardDetailsDto {
  background?: BackgroundDto | null
  board?: BoardDto | null
  columns: Array<{
    column: ColumnDto
    tasks: TaskDto[]
    total_tasks: number
  }>
  sprints?: SprintDto[]
  goals?: GoalDto[]
  projects?: ProjectDto[]
  members?: MemberDto[]
}

interface OrgStatsDto {
  state_body_id: number
  summary?: Array<{ status: string; count: number }>
  projects?: Array<{
    board_id: string
    board_name: string
    total_tasks: number
    statuses: Array<{ status: string; count: number }>
  }>
  closed_by?: Array<{
    user_id: number
    full_name: string
    closed_count: number
    tasks: Array<{
      task_id: string
      title: string
      board_id: string
      board_name: string
      closed_at: string
    }>
  }>
}

interface AccessCheckDto {
  allowed: boolean
  reason?: string
  state_body_id: number
}

interface AccessUserDto {
  user_id: number
  full_name: string
  granted_by: number
  created_at: string
}

interface UploadedFileDto {
  id: string
  download_url?: string
  real_name?: string
  file_name?: string
}

interface BoardStatsDto {
  board_id: string
  board_name: string
  period: {
    date_from: string
    date_to: string
  }
  summary: {
    total_tasks: number
    completed_tasks: number
    active_tasks: number
    overdue_tasks: number
    unassigned_tasks: number
    completion_percent: number
    total_estimate_seconds: number
    total_spent_seconds: number
    avg_completion_seconds: number
  }
  by_status: Array<{ key: string; name: string; count: number; percent: number }>
  by_column: Array<{ column_id: string; key: string; name: string; position: number; count: number; percent: number }>
  by_priority: Array<{ key: string; name: string; count: number; percent: number }>
  by_deadline: Array<{ key: string; name: string; count: number; percent: number }>
  employees: Array<{
    user_id: number
    full_name: string
    assigned_tasks: number
    created_tasks: number
    completed_tasks: number
    active_tasks: number
    overdue_tasks: number
    completion_percent: number
    overdue_percent: number
    total_estimate_seconds: number
    total_spent_seconds: number
    worklog_seconds: number
    productivity_score: number
  }>
  activity: Array<{ action: string; count: number }>
  worklogs: Array<{ date: string; total_seconds: number }>
}

const ALLOWED_COMMENT_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png'])
const ALLOWED_COMMENT_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png']

const isSupportedCommentPhotoFile = (file: File): boolean => {
  const mime = file.type?.toLowerCase() ?? ''
  if (mime && ALLOWED_COMMENT_PHOTO_MIME_TYPES.has(mime)) {
    return true
  }

  const lowerName = file.name.toLowerCase()
  return ALLOWED_COMMENT_PHOTO_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}

const mapBoard = (value: BoardDto): Board => ({
  id: value.id,
  name: value.name,
  ownerId: value.owner_id,
  createdAt: value.created_at ?? '',
  progress: value.progress
    ? {
        totalTasks: Number(value.progress.total_tasks ?? 0),
        completedTasks: Number(value.progress.completed_tasks ?? 0),
        completionPercent: Math.max(0, Math.min(100, Math.round(Number(value.progress.completion_percent ?? 0)))),
      }
    : undefined,
})

const mapBackground = (value?: BackgroundDto | null): BoardBackground | null => {
  if (!value) return null
  return {
    imageUrl: normalizeBackendAssetUrl(value.image_url) ?? '',
    mode: value.mode ?? '',
    presetHex: value.preset_hex ?? '',
    presetId: value.preset_id ?? '',
  }
}

const mapUser = (value: UserDto): BoardUser => ({
  id: value.id,
  email: value.email ?? '',
  firstName: value.first_name ?? '',
  lastName: value.last_name ?? '',
  fullName: value.full_name?.trim() || [value.first_name ?? '', value.last_name ?? ''].join(' ').trim() || 'Пользователь',
  username: value.username ?? '',
  avatarUrl: normalizeBackendAssetUrl(value.avatar_url) ?? '',
  role: value.role ?? '',
  availabilityStatus: value.availability_status ?? '',
})

const mapLabel = (value: LabelDto): BoardLabel => ({
  id: value.id,
  boardId: value.board_id,
  name: value.name,
  color: value.color,
  createdAt: value.created_at ?? '',
})

const mapAttachment = (value: AttachmentDto): BoardAttachment => ({
  id: value.id,
  taskId: value.task_id,
  fileName: value.file_name,
  objectName: value.object_name ?? '',
  fileSize: Number(value.file_size ?? 0),
  mimeType: value.mime_type,
  downloadUrl: normalizeBackendAssetUrl(value.download_url) ?? '',
  createdAt: value.created_at,
})

const buildTaskLink = (value: TaskDto): string => {
  if (value.link?.trim()) {
    return value.link
  }

  const taskRef = value.task_key?.trim() || value.id
  return `/kanban?task=${encodeURIComponent(taskRef)}`
}

const mapTask = (value: TaskDto): BoardTask => ({
  id: value.id,
  boardId: value.board_id,
  columnId: value.column_id,
  sprintId: value.sprint_id ?? '',
  goalId: value.goal_id ?? undefined,
  projectId: value.project_id ?? undefined,
  taskNumber: Number(value.task_number ?? 0),
  taskKey: value.task_key ?? '',
  link: buildTaskLink(value),
  title: value.title,
  description: value.description ?? '',
  priority: value.priority ?? 'medium',
  status: value.status ?? '',
  assigneeIds: Array.isArray(value.assignee_ids) ? value.assignee_ids : [],
  originalEstimateSec: Number(value.original_estimate_sec ?? 0),
  timeSpentSec: Number(value.time_spent_sec ?? 0),
  dueAt: value.due_at ?? '',
  createdBy: Number(value.created_by ?? 0),
  createdAt: value.created_at ?? '',
  updatedAt: value.updated_at ?? '',
  attachments: Array.isArray(value.attachments) ? value.attachments.map(mapAttachment) : [],
  labels: Array.isArray(value.labels) ? value.labels.map(mapLabel) : [],
  parentId: value.parent_id ?? undefined,
  subtasks: Array.isArray(value.subtasks) ? value.subtasks.map(mapTask) : [],
})

const mapColumn = (value: ColumnDto): BoardColumn => ({
  id: value.id,
  boardId: value.board_id,
  name: value.name,
  key: value.key,
  position: Number(value.position ?? 0),
})

const mapSprint = (value: SprintDto): BoardSprint => ({
  id: value.id,
  boardId: value.board_id,
  goalId: value.goal_id ?? undefined,
  projectId: value.project_id ?? undefined,
  name: value.name,
  status: value.status,
  startDate: value.start_date ?? '',
  endDate: value.end_date ?? '',
})

const mapGoal = (value: GoalDto): BoardGoal => ({
  id: value.id,
  boardId: value.board_id,
  name: value.name,
  description: value.description ?? undefined,
  taskCount: Number(value.task_count ?? 0),
  completedTasks: Number(value.completed_tasks ?? 0),
  activeTasks: Number(value.active_tasks ?? 0),
  overdueTasks: Number(value.overdue_tasks ?? 0),
  projectCount: Number(value.project_count ?? 0),
  sprintCount: Number(value.sprint_count ?? 0),
  completionPercent: Number(value.completion_percent ?? 0),
  topProjectName: value.top_project_name ?? undefined,
  predictionLabel: value.prediction_label ?? undefined,
  nextActionLabel: value.next_action_label ?? undefined,
  createdBy: Number(value.created_by ?? 0),
  createdAt: value.created_at ?? '',
  updatedAt: value.updated_at ?? '',
})

const mapProject = (value: ProjectDto): BoardProject => ({
  id: value.id,
  boardId: value.board_id,
  goalId: value.goal_id ?? undefined,
  name: value.name,
  description: value.description ?? undefined,
  status: value.status ?? '',
  createdBy: Number(value.created_by ?? 0),
  createdAt: value.created_at ?? '',
  updatedAt: value.updated_at ?? '',
})

const mapMember = (value: MemberDto): BoardMember => ({
  boardId: value.board_id,
  userId: value.user_id,
  role: value.role ?? 'member',
  teamRole: value.team_role ?? undefined,
  user: value.user
    ? mapUser(value.user)
    : value.full_name
      ? {
          id: value.user_id,
          email: '',
          firstName: '',
          lastName: '',
          fullName: value.full_name,
          username: '',
          avatarUrl: '',
          role: value.role ?? 'member',
          availabilityStatus: '',
        }
      : null,
})

const mapBoardDetails = (data: BoardDetailsDto): BoardDetails => ({
  board: data.board
    ? mapBoard(data.board)
    : {
        id: '',
        name: 'Фильтрованные задачи',
        ownerId: 0,
        createdAt: '',
      },
  background: mapBackground(data.background),
  columns: (data.columns ?? [])
    .map((value) => ({
      column: mapColumn(value.column),
      tasks: (value.tasks ?? []).map(mapTask),
      totalTasks: Number(value.total_tasks ?? 0),
    }))
    .sort((a, b) => a.column.position - b.column.position),
  sprints: (data.sprints ?? []).map(mapSprint),
  goals: (data.goals ?? []).map(mapGoal),
  projects: (data.projects ?? []).map(mapProject),
  members: (data.members ?? []).map(mapMember),
})

const mapBoardStats = (data: BoardStatsDto): BoardStats => ({
  boardId: data.board_id,
  boardName: data.board_name,
  period: {
    dateFrom: data.period.date_from,
    dateTo: data.period.date_to,
  },
  summary: {
    totalTasks: data.summary.total_tasks,
    completedTasks: data.summary.completed_tasks,
    activeTasks: data.summary.active_tasks,
    overdueTasks: data.summary.overdue_tasks,
    unassignedTasks: data.summary.unassigned_tasks,
    completionPercent: data.summary.completion_percent,
    totalEstimateSeconds: data.summary.total_estimate_seconds,
    totalSpentSeconds: data.summary.total_spent_seconds,
    avgCompletionSeconds: data.summary.avg_completion_seconds,
  },
  byStatus: (data.by_status ?? []).map((item) => ({ ...item })),
  byColumn: (data.by_column ?? []).map((item) => ({
    columnId: item.column_id,
    key: item.key,
    name: item.name,
    position: item.position,
    count: item.count,
    percent: item.percent,
  })),
  byPriority: (data.by_priority ?? []).map((item) => ({ ...item })),
  byDeadline: (data.by_deadline ?? []).map((item) => ({ ...item })),
  employees: (data.employees ?? []).map((item) => ({
    userId: item.user_id,
    fullName: item.full_name,
    assignedTasks: item.assigned_tasks,
    createdTasks: item.created_tasks,
    completedTasks: item.completed_tasks,
    activeTasks: item.active_tasks,
    overdueTasks: item.overdue_tasks,
    completionPercent: item.completion_percent,
    overduePercent: item.overdue_percent,
    totalEstimateSeconds: item.total_estimate_seconds,
    totalSpentSeconds: item.total_spent_seconds,
    worklogSeconds: item.worklog_seconds,
    productivityScore: item.productivity_score,
  })),
  activity: (data.activity ?? []).map((item) => ({ action: item.action, count: item.count })),
  worklogs: (data.worklogs ?? []).map((item) => ({ date: item.date, totalSeconds: item.total_seconds })),
})

const appendArrayParam = (params: URLSearchParams, key: string, values: Array<string | number> | undefined) => {
  if (!values?.length) return
  values.forEach((value) => params.append(key, String(value)))
}

const toRequestPath = (url: string): string => {
  try {
    const resolved = new URL(url, window.location.origin)
    if (resolved.origin === window.location.origin) {
      return `${resolved.pathname}${resolved.search}`
    }
  } catch {
    // ignore and fallback to raw url
  }
  return url
}

export class HttpBoardRepository implements BoardRepository {
  private readonly sessionStore: AuthSessionStore

  constructor(sessionStore: AuthSessionStore) {
    this.sessionStore = sessionStore
  }

  async listBoards(): Promise<Board[]> {
    const response = await this.fetchAuthorized('/api/v1/kanban/boards')
    const data = (await response.json()) as BoardDto[]
    return (data ?? []).map(mapBoard)
  }

  async getBoard(boardId: string): Promise<BoardDetails> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}`)
    const data = (await response.json()) as BoardDetailsDto
    return mapBoardDetails(data)
  }

  async getFilteredBoard(params: KanbanFilteredBoardParams): Promise<BoardDetails> {
    const query = new URLSearchParams()
    if (params.userId) query.set('user_id', String(params.userId))
    if (params.status) query.set('status', params.status)
    if (params.date) query.set('date', params.date)
    if (params.name) query.set('name', params.name)
    if (params.labelId) query.set('label_id', params.labelId)

    const response = await this.fetchAuthorized(`/api/v1/kanban/board/filtered?${query.toString()}`)
    const data = (await response.json()) as BoardDetailsDto
    return mapBoardDetails(data)
  }

  async createBoard(name: string): Promise<Board> {
    const response = await this.fetchAuthorized('/api/v1/kanban/boards', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    const data = (await response.json()) as BoardDto
    return mapBoard(data)
  }

  async updateBoard(boardId: string, name: string): Promise<Board> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
    const data = (await response.json()) as BoardDto
    return mapBoard(data)
  }

  async deleteBoard(boardId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}`, { method: 'DELETE' })
  }

  async uploadBoardBackgroundImage(boardId: string, file: File): Promise<BoardBackground> {
    const form = new FormData()
    form.append('file', file)
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/background/image`, {
      method: 'POST',
      body: form,
    })
    const data = (await response.json()) as BackgroundDto
    return mapBackground(data) ?? { imageUrl: '', mode: '', presetHex: '', presetId: '' }
  }

  async deleteBoardBackgroundImage(boardId: string): Promise<BoardBackground> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/background/image`, {
      method: 'DELETE',
    })
    const data = (await response.json()) as BackgroundDto
    return mapBackground(data) ?? { imageUrl: '', mode: '', presetHex: '', presetId: '' }
  }

  async setBoardBackgroundPreset(boardId: string, presetId: string): Promise<BoardBackground> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/background/preset`, {
      method: 'PUT',
      body: JSON.stringify({ preset_id: presetId }),
    })
    const data = (await response.json()) as BackgroundDto
    return mapBackground(data) ?? { imageUrl: '', mode: '', presetHex: '', presetId: '' }
  }

  getBoardBackgroundImageDownloadUrl(boardId: string): string {
    return `/api/v1/kanban/boards/${boardId}/background/image/download`
  }

  async downloadBoardBackgroundImage(boardId: string): Promise<Blob> {
    const response = await this.fetchAuthorized(this.getBoardBackgroundImageDownloadUrl(boardId), {
      headers: {
        Accept: 'image/*',
      },
    })

    return response.blob()
  }

  async listBoardLabels(boardId: string): Promise<BoardLabel[]> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/labels`)
    const data = (await response.json()) as LabelDto[]
    return (data ?? []).map(mapLabel)
  }

  async createBoardLabel(boardId: string, payload: { name: string; color: string }): Promise<BoardLabel> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name: payload.name, color: payload.color }),
    })
    const data = (await response.json()) as LabelDto
    return mapLabel(data)
  }

  async deleteBoardLabel(labelId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/labels/${labelId}`, {
      method: 'DELETE',
    })
  }

  async createColumn(boardId: string, name: string, key?: string): Promise<void> {
    await this.fetchAuthorized('/api/v1/kanban/columns', {
      method: 'POST',
      body: JSON.stringify({ board_id: boardId, name, key }),
    })
  }

  async updateColumn(columnId: string, name: string, key?: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/columns/${columnId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, key }),
    })
  }

  async deleteColumn(columnId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/columns/${columnId}`, {
      method: 'DELETE',
    })
  }

  async moveColumn(columnId: string, newPosition: number): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/columns/${columnId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ new_position: newPosition }),
    })
  }

  async createTask(payload: CreateBoardTaskPayload): Promise<BoardTask> {
    const response = await this.fetchAuthorized('/api/v1/kanban/tasks', {
      method: 'POST',
      body: JSON.stringify({
        board_id: payload.boardId,
        sprint_id: payload.sprintId || undefined,
        goal_id: payload.goalId || undefined,
        project_id: payload.projectId || undefined,
        title: payload.title,
        description: payload.description || undefined,
        assignee_ids: payload.assigneeIds,
        priority: payload.priority,
        status: payload.status,
        original_estimate_sec: payload.originalEstimateSec,
        due_at: payload.dueAt || undefined,
        parent_id: payload.parentId || undefined,
        attachment_file_ids: payload.attachmentFileIds?.length ? payload.attachmentFileIds : undefined,
      }),
    })

    const data = (await response.json()) as TaskDto
    return mapTask(data)
  }

  async listMyTodoTasks(): Promise<BoardTask[]> {
    const response = await this.fetchAuthorized('/api/v1/kanban/tasks/my-todo')
    const data = (await response.json()) as TaskDto[]
    return (data ?? []).map(mapTask)
  }

  async searchTasks(params: KanbanTaskSearchParams): Promise<BoardTask[]> {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.boardId) query.set('board_id', params.boardId)
    if (params.dateFrom) query.set('date_from', params.dateFrom)
    if (params.dateTo) query.set('date_to', params.dateTo)
    if (params.limit) query.set('limit', String(params.limit))
    if (params.offset) query.set('offset', String(params.offset))
    appendArrayParam(query, 'priorities', params.priorities)
    appendArrayParam(query, 'assignee_ids', params.assigneeIds)
    appendArrayParam(query, 'column_ids', params.columnIds)
    appendArrayParam(query, 'column_keys', params.columnKeys)
    appendArrayParam(query, 'label_ids', params.labelIds)

    const response = await this.fetchAuthorized(`/api/v1/kanban/tasks/search?${query.toString()}`)
    const data = (await response.json()) as TaskDto[]
    return (data ?? []).map(mapTask)
  }

  async getTask(taskId: string): Promise<BoardTask> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}`)
    const data = (await response.json()) as TaskDto
    return mapTask(data)
  }

  async updateTask(taskId: string, payload: UpdateBoardTaskPayload): Promise<void> {
    const dueAt = payload.dueAt?.trim()
    const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

    await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        due_at: dueAt || undefined,
        sprint_id: payload.sprintId !== undefined ? (payload.sprintId || ZERO_UUID) : undefined,
        goal_id: payload.goalId !== undefined ? (payload.goalId || ZERO_UUID) : undefined,
        project_id: payload.projectId !== undefined ? (payload.projectId || ZERO_UUID) : undefined,
        assignee_ids: payload.assigneeIds,
        original_estimate_sec: payload.originalEstimateSec,
        parent_id: payload.parentId ?? undefined,
        clear_parent_id: payload.clearParentId || undefined,
        add_attachment_file_ids: payload.addAttachmentFileIds,
        status: payload.status,
        label_ids: payload.labelIds,
      }),
    })
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}`, {
      method: 'DELETE',
    })
  }

  async moveTask(taskId: string, toColumnId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ to_column_id: toColumnId }),
    })
  }

  async updateTaskStatus(taskId: string, status: string): Promise<BoardTask> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    const data = (await response.json()) as TaskDto
    return mapTask(data)
  }

  async uploadKanbanFile(file: File): Promise<{ fileId: string; downloadUrl: string; fileName: string }> {
    const form = new FormData()
    form.append('file', file)
    const response = await this.fetchAuthorized('/api/v1/kanban/tasks/upload', {
      method: 'POST',
      body: form,
    })
    const data = (await response.json()) as UploadedFileDto
    return {
      fileId: data.id,
      downloadUrl: normalizeBackendAssetUrl(data.download_url) ?? '',
      fileName: data.real_name ?? data.file_name ?? '',
    }
  }

  async attachExistingFile(taskId: string, fileId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId }),
    })
  }

  async createSprint(boardId: string, payload: { name: string; goalId?: string; projectId?: string; status?: string; startDate?: string; endDate?: string }): Promise<BoardSprint> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/sprints`, {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        goal_id: payload.goalId || undefined,
        project_id: payload.projectId || undefined,
        status: payload.status || undefined,
        start_date: payload.startDate || undefined,
        end_date: payload.endDate || undefined,
      }),
    })

    const data = (await response.json()) as SprintDto
    return mapSprint(data)
  }

  async updateSprint(boardId: string, sprintId: string, payload: { name: string; goalId?: string; projectId?: string; status?: string; startDate?: string; endDate?: string }): Promise<BoardSprint> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/sprints/${sprintId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: payload.name,
        goal_id: payload.goalId || undefined,
        project_id: payload.projectId || undefined,
        status: payload.status || undefined,
        start_date: payload.startDate || undefined,
        end_date: payload.endDate || undefined,
      }),
    })

    const data = (await response.json()) as SprintDto
    return mapSprint(data)
  }

  async deleteSprint(boardId: string, sprintId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/sprints/${sprintId}`, {
      method: 'DELETE',
    })
  }

  async listSprints(): Promise<BoardSprint[]> {
    const response = await this.fetchAuthorized('/api/v1/kanban/sprints')
    const data = (await response.json()) as SprintDto[]
    return (data ?? []).map(mapSprint)
  }

  async createGoal(boardId: string, payload: { name: string; description?: string }): Promise<BoardGoal> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/goals`, {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description || undefined,
      }),
    })
    const data = (await response.json()) as GoalDto
    return mapGoal(data)
  }

  async updateGoal(boardId: string, goalId: string, payload: { name: string; description?: string }): Promise<BoardGoal> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/goals/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description || undefined,
      }),
    })
    const data = (await response.json()) as GoalDto
    return mapGoal(data)
  }

  async deleteGoal(boardId: string, goalId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/goals/${goalId}`, {
      method: 'DELETE',
    })
  }

  async createProject(boardId: string, payload: { name: string; description?: string; goalId?: string; status?: string }): Promise<BoardProject> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/projects`, {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description || undefined,
        goal_id: payload.goalId || undefined,
        status: payload.status || 'active',
      }),
    })
    const data = (await response.json()) as ProjectDto
    return mapProject(data)
  }

  async updateProject(boardId: string, projectId: string, payload: { name: string; description?: string; goalId?: string; status?: string }): Promise<BoardProject> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description || undefined,
        goal_id: payload.goalId || undefined,
        status: payload.status || 'active',
      }),
    })
    const data = (await response.json()) as ProjectDto
    return mapProject(data)
  }

  async deleteProject(boardId: string, projectId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/projects/${projectId}`, {
      method: 'DELETE',
    })
  }

  async listUsers(): Promise<BoardUser[]> {
    const response = await this.fetchAuthorized('/api/v1/users')
    const data = (await response.json()) as UserDto[]
    return (data ?? []).map(mapUser)
  }

  async getUserDetails(userId: number): Promise<BoardUser> {
    const response = await this.fetchAuthorized(`/api/v1/users/${userId}/details`)
    const data = (await response.json()) as UserDto
    return mapUser(data)
  }

  async addMembers(boardId: string, members: Array<{ userId: number; role?: string; teamRole?: string }>): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/members`, {
      method: 'POST',
      body: JSON.stringify({
        members: members.map((member) => ({
          user_id: member.userId,
          role: member.role,
          team_role: member.teamRole,
        })),
      }),
    })
  }

  async removeMember(boardId: string, userId: number): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/members/${userId}`, {
      method: 'DELETE',
    })
  }

  async updateMemberRole(boardId: string, userId: number, role: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })
  }

  async updateMemberTeamRole(boardId: string, userId: number, teamRole: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/members/${userId}/team-role`, {
      method: 'PUT',
      body: JSON.stringify({ team_role: teamRole }),
    })
  }

  async uploadTaskFile(taskId: string, file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)

    await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/files`, {
      method: 'POST',
      body: formData,
    })
  }

  async deleteTaskFile(taskId: string, fileId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/files/${fileId}`, {
      method: 'DELETE',
    })
  }

  getTaskFileDownloadUrl(taskId: string, fileId: string): string {
    return `/api/v1/kanban/tasks/${taskId}/files/${fileId}/download`
  }

  async listTaskComments(taskId: string): Promise<BoardComment[]> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/comments`)
    const data = (await response.json()) as CommentDto[]
    return (data ?? []).map((value) => ({
      id: value.id,
      taskId: value.task_id,
      userId: value.user_id,
      content: value.content ?? '',
      attachmentUrl: normalizeBackendAssetUrl(value.attachment_url) ?? '',
      createdAt: value.created_at,
      updatedAt: value.updated_at ?? value.created_at,
      author: value.author ? mapUser(value.author) : null,
    }))
  }

  async createTaskComment(taskId: string, payload: { content: string; attachmentUrl?: string }): Promise<BoardComment> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: payload.content, attachment_url: payload.attachmentUrl || undefined }),
    })
    const data = (await response.json()) as CommentDto
    return {
      id: data.id,
      taskId: data.task_id,
      userId: data.user_id,
      content: data.content ?? '',
      attachmentUrl: normalizeBackendAssetUrl(data.attachment_url) ?? '',
      createdAt: data.created_at,
      updatedAt: data.updated_at ?? data.created_at,
      author: data.author ? mapUser(data.author) : null,
    }
  }

  async createTaskCommentPhoto(taskId: string, payload: { file: File; content?: string }): Promise<BoardComment> {
    if (!isSupportedCommentPhotoFile(payload.file)) {
      throw new Error('Допустимы только изображения JPG и PNG.')
    }

    const form = new FormData()
    form.append('file', payload.file)
    if (payload.content) form.append('content', payload.content)

    const response = await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/comments/photo`, {
      method: 'POST',
      body: form,
    })
    const data = (await response.json()) as CommentDto
    return {
      id: data.id,
      taskId: data.task_id,
      userId: data.user_id,
      content: data.content ?? '',
      attachmentUrl: normalizeBackendAssetUrl(data.attachment_url) ?? '',
      createdAt: data.created_at,
      updatedAt: data.updated_at ?? data.created_at,
      author: data.author ? mapUser(data.author) : null,
    }
  }

  async downloadAttachmentByUrl(url: string): Promise<Blob> {
    const requestPath = toRequestPath(url)
    const response = await this.fetchAuthorized(requestPath, {
      headers: {
        Accept: '*/*',
      },
    })
    return response.blob()
  }

  async updateComment(commentId: string, content: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/comments/${commentId}`, {
      method: 'DELETE',
    })
  }

  async addTaskLabel(taskId: string, labelId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ label_id: labelId }),
    })
  }

  async removeTaskLabel(taskId: string, labelId: string): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/labels/${labelId}`, {
      method: 'DELETE',
    })
  }

  async addWorklog(taskId: string, payload: { timeSpentSec: number; comment?: string; startedAt?: string }): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/worklogs`, {
      method: 'POST',
      body: JSON.stringify({
        time_spent_sec: payload.timeSpentSec,
        comment: payload.comment,
        started_at: payload.startedAt ?? new Date().toISOString(),
      }),
    })
  }

  async listWorklogs(taskId: string): Promise<BoardWorklog[]> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/worklogs`)
    const data = (await response.json()) as WorklogDto[]

    return (data ?? []).map((value) => ({
      id: value.id,
      taskId: value.task_id,
      userId: value.user_id,
      timeSpentSec: Number(value.time_spent_sec ?? 0),
      comment: value.comment ?? '',
      startedAt: value.started_at ?? '',
      createdAt: value.created_at,
    }))
  }

  async getTaskHistory(taskId: string): Promise<BoardHistory[]> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/tasks/${taskId}/history`)
    const data = (await response.json()) as HistoryDto[]

    return (data ?? []).map((value) => ({
      id: value.id,
      taskId: value.task_id,
      userId: value.user_id,
      action: value.action,
      fieldName: value.field_name,
      oldValue: value.old_value,
      newValue: value.new_value,
      details: value.details ?? '',
      createdAt: value.created_at,
      user: value.user ? mapUser(value.user) : null,
    }))
  }

  async getOrgStats(stateBodyId: number): Promise<OrgKanbanStats> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/org/stats?state_body_id=${stateBodyId}`)
    const data = (await response.json()) as OrgStatsDto

    return {
      stateBodyId: data.state_body_id,
      summary: (data.summary ?? []).map((item) => ({ status: item.status, count: item.count })),
      projects: (data.projects ?? []).map((project) => ({
        boardId: project.board_id,
        boardName: project.board_name,
        totalTasks: project.total_tasks,
        statuses: (project.statuses ?? []).map((status) => ({ status: status.status, count: status.count })),
      })),
      closedBy: (data.closed_by ?? []).map((person) => ({
        userId: person.user_id,
        fullName: person.full_name,
        closedCount: person.closed_count,
        tasks: (person.tasks ?? []).map((task) => ({
          taskId: task.task_id,
          title: task.title,
          boardId: task.board_id,
          boardName: task.board_name,
          closedAt: task.closed_at,
        })),
      })),
    }
  }

  async getOrgStatsAccessCheck(stateBodyId: number): Promise<OrgAccessCheck> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/org/stats/access-check?state_body_id=${stateBodyId}`)
    const data = (await response.json()) as AccessCheckDto
    return {
      allowed: Boolean(data.allowed),
      reason: data.reason ?? '',
      stateBodyId: data.state_body_id,
    }
  }

  async listOrgStatsAccessUsers(stateBodyId: number): Promise<OrgAccessUser[]> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/org/stats/${stateBodyId}/access`)
    const data = (await response.json()) as AccessUserDto[]
    return (data ?? []).map((item) => ({
      userId: item.user_id,
      fullName: item.full_name,
      grantedBy: item.granted_by,
      createdAt: item.created_at,
    }))
  }

  async grantOrgStatsAccess(stateBodyId: number, userId: number): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/org/stats/${stateBodyId}/access`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    })
  }

  async revokeOrgStatsAccess(stateBodyId: number, userId: number): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/org/stats/${stateBodyId}/access/${userId}`, {
      method: 'DELETE',
    })
  }

  async listOrgKanbanAccessUsers(stateBodyId: number): Promise<OrgAccessUser[]> {
    const response = await this.fetchAuthorized(`/api/v1/kanban/org/${stateBodyId}/access`)
    const data = (await response.json()) as AccessUserDto[]
    return (data ?? []).map((item) => ({
      userId: item.user_id,
      fullName: item.full_name,
      grantedBy: item.granted_by,
      createdAt: item.created_at,
    }))
  }

  async grantOrgKanbanAccess(stateBodyId: number, userId: number): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/org/${stateBodyId}/access`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    })
  }

  async revokeOrgKanbanAccess(stateBodyId: number, userId: number): Promise<void> {
    await this.fetchAuthorized(`/api/v1/kanban/org/${stateBodyId}/access/${userId}`, {
      method: 'DELETE',
    })
  }

  async getBoardStats(boardId: string, params?: { dateFrom?: string; dateTo?: string }): Promise<BoardStats> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('date_from', params.dateFrom)
    if (params?.dateTo) query.set('date_to', params.dateTo)

    const response = await this.fetchAuthorized(`/api/v1/kanban/boards/${boardId}/stats?${query.toString()}`)
    const data = (await response.json()) as BoardStatsDto
    return mapBoardStats(data)
  }

  async getMultiBoardStats(boardIds?: string[], params?: { dateFrom?: string; dateTo?: string }): Promise<BoardStats> {
    const query = new URLSearchParams()
    if (boardIds && boardIds.length > 0) {
      boardIds.forEach(id => query.append('board_ids', id))
    }
    if (params?.dateFrom) query.set('date_from', params.dateFrom)
    if (params?.dateTo) query.set('date_to', params.dateTo)

    const response = await this.fetchAuthorized(`/api/v1/kanban/stats?${query.toString()}`)
    const data = (await response.json()) as BoardStatsDto
    return mapBoardStats(data)
  }

  private async fetchAuthorized(path: string, init: RequestInit = {}): Promise<Response> {
    return authorizedFetch(this.sessionStore, path, init)
  }
}
