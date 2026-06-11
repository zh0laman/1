export interface BoardUser {
  id: number
  email: string
  firstName: string
  lastName: string
  fullName: string
  username: string
  avatarUrl: string
  role: string
  availabilityStatus: string
}

export interface Board {
  id: string
  name: string
  ownerId: number
  createdAt: string
  progress?: {
    totalTasks: number
    completedTasks: number
    completionPercent: number
  }
}

export interface BoardBackground {
  imageUrl: string
  mode: string
  presetHex: string
  presetId: string
}

export interface BoardColumn {
  id: string
  boardId: string
  name: string
  key: string
  position: number
}

export interface BoardSprint {
  id: string
  boardId: string
  goalId?: string
  projectId?: string
  name: string
  status: string
  startDate: string
  endDate: string
}

export interface BoardLabel {
  id: string
  boardId: string
  name: string
  color: string
  createdAt: string
}

export interface BoardGoal {
  id: string
  boardId: string
  name: string
  description?: string
  taskCount: number
  completedTasks: number
  activeTasks: number
  overdueTasks: number
  projectCount: number
  sprintCount: number
  completionPercent: number
  topProjectName?: string
  predictionLabel?: string
  nextActionLabel?: string
  createdBy: number
  createdAt: string
  updatedAt: string
}

export interface BoardProject {
  id: string
  boardId: string
  goalId?: string
  name: string
  description?: string
  status: string
  createdBy: number
  createdAt: string
  updatedAt: string
}


export interface BoardAttachment {
  id: string
  taskId: string
  fileName: string
  objectName: string
  fileSize: number
  mimeType: string
  downloadUrl: string
  createdAt: string
}

export interface BoardTask {
  id: string
  boardId: string
  columnId: string
  sprintId: string
  goalId?: string
  projectId?: string
  taskNumber: number
  taskKey: string
  link: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  assigneeIds: number[]
  originalEstimateSec: number
  timeSpentSec: number
  dueAt: string
  status?: string
  createdBy: number
  createdAt: string
  updatedAt: string
  attachments: BoardAttachment[]
  labels?: BoardLabel[]
  parentId?: string
  subtasks?: BoardTask[]
}

export interface BoardMember {
  boardId: string
  userId: number
  role: string
  teamRole?: string
  user: BoardUser | null
}

export interface BoardComment {
  id: string
  taskId: string
  userId: number
  content: string
  attachmentUrl: string
  createdAt: string
  updatedAt: string
  author: BoardUser | null
}

export interface BoardWorklog {
  id: string
  taskId: string
  userId: number
  timeSpentSec: number
  comment: string
  startedAt?: string
  createdAt: string
}

export interface BoardHistory {
  id: string
  taskId: string
  userId: number
  action: string
  fieldName?: string
  oldValue?: string
  newValue?: string
  details: string
  createdAt: string
  user: BoardUser | null
}

export interface OrgTaskSummary {
  taskId: string
  title: string
  boardId: string
  boardName: string
  closedAt: string
}

export interface OrgClosedBy {
  userId: number
  fullName: string
  closedCount: number
  tasks: OrgTaskSummary[]
}

export interface OrgProjectStatus {
  status: string
  count: number
}

export interface OrgProjectStats {
  boardId: string
  boardName: string
  totalTasks: number
  statuses: OrgProjectStatus[]
}

export interface OrgSummaryStatus {
  status: string
  count: number
}

export interface OrgKanbanStats {
  stateBodyId: number
  summary: OrgSummaryStatus[]
  projects: OrgProjectStats[]
  closedBy: OrgClosedBy[]
}

export interface OrgAccessCheck {
  allowed: boolean
  reason: string
  stateBodyId: number
}

export interface OrgAccessUser {
  userId: number
  fullName: string
  grantedBy: number
  createdAt: string
}

export interface BoardDetails {
  board: Board
  background: BoardBackground | null
  columns: Array<{
    column: BoardColumn
    tasks: BoardTask[]
    totalTasks: number
  }>
  sprints: BoardSprint[]
  goals: BoardGoal[]
  projects: BoardProject[]
  members: BoardMember[]
}

export interface KanbanFilteredBoardParams {
  userId?: number
  status?: string
  date?: string
  name?: string
  labelId?: string
}

export interface KanbanTaskSearchParams {
  q?: string
  priorities?: string[]
  assigneeIds?: number[]
  columnIds?: string[]
  columnKeys?: string[]
  labelIds?: string[]
  boardId?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

export interface CreateBoardTaskPayload {
  boardId: string
  sprintId?: string
  goalId?: string
  projectId?: string
  title: string
  description?: string
  assigneeIds?: number[]
  priority?: string
  status?: string
  originalEstimateSec?: number
  dueAt?: string
  parentId?: string | null
  attachmentFileIds?: string[]
}

export interface UpdateBoardTaskPayload {
  title?: string
  description?: string
  priority?: string
  dueAt?: string
  sprintId?: string
  goalId?: string
  projectId?: string
  assigneeIds?: number[]
  originalEstimateSec?: number
  parentId?: string | null
  clearParentId?: boolean
  addAttachmentFileIds?: string[]
  status?: string
  labelIds?: string[]
}

export interface BoardStatsSummary {
  totalTasks: number
  completedTasks: number
  activeTasks: number
  overdueTasks: number
  unassignedTasks: number
  completionPercent: number
  totalEstimateSeconds: number
  totalSpentSeconds: number
  avgCompletionSeconds: number
}

export interface BoardStatsDistribution {
  key: string
  name: string
  count: number
  percent: number
}

export interface BoardStatsColumnDistribution extends BoardStatsDistribution {
  columnId: string
  position: number
}

export interface BoardStatsEmployee {
  userId: number
  fullName: string
  assignedTasks: number
  createdTasks: number
  completedTasks: number
  activeTasks: number
  overdueTasks: number
  completionPercent: number
  overduePercent: number
  totalEstimateSeconds: number
  totalSpentSeconds: number
  worklogSeconds: number
  productivityScore: number
}

export interface BoardStatsActivity {
  action: string
  count: number
}

export interface BoardStatsWorklog {
  date: string
  totalSeconds: number
}

export interface BoardStats {
  boardId: string
  boardName: string
  period: {
    dateFrom: string
    dateTo: string
  }
  summary: BoardStatsSummary
  byStatus: BoardStatsDistribution[]
  byColumn: BoardStatsColumnDistribution[]
  byPriority: BoardStatsDistribution[]
  byDeadline: BoardStatsDistribution[]
  employees: BoardStatsEmployee[]
  activity: BoardStatsActivity[]
  worklogs: BoardStatsWorklog[]
}
