import type { BoardTask, BoardGoal, BoardProject, BoardSprint } from '../../domain/entities/board/BoardModels'
import { KanbanAdvancedUseCase } from '../../application/use-cases/board/KanbanAdvancedUseCase'
import { LoadBoardDetailsUseCase } from '../../application/use-cases/board/LoadBoardDetailsUseCase'
import { LoadBoardUsersUseCase } from '../../application/use-cases/board/LoadBoardUsersUseCase'
import { LoadBoardsUseCase } from '../../application/use-cases/board/LoadBoardsUseCase'
import { LoadTaskActivityUseCase } from '../../application/use-cases/board/LoadTaskActivityUseCase'
import { ManageBoardStructureUseCase } from '../../application/use-cases/board/ManageBoardStructureUseCase'
import { ManageBoardTasksUseCase } from '../../application/use-cases/board/ManageBoardTasksUseCase'
import type {
  BoardActivityViewModel,
  BoardCommentViewModel,
  BoardDetailsViewModel,
  BoardLabelViewModel,
  BoardOptionViewModel,
  BoardTaskViewModel,
  BoardUserViewModel,
  BoardStatsViewModel,
  OrgAccessUserViewModel,
  OrgStatsViewModel,
} from '../view-models/BoardViewModel'
import {
  toBoardActivityViewModel,
  toBoardCommentsViewModel,
  toBoardDetailsViewModel,
  toBoardLabelsViewModel,
  toBoardOptionsViewModel,
  toBoardTaskListViewModel,
  toBoardUsersViewModel,
  toBoardStatsViewModel,
  toOrgAccessUsersViewModel,
  toOrgStatsViewModel,
} from '../view-models/BoardViewModel'

interface CachedBoard {
  atMs: number
  value: BoardDetailsViewModel
}

interface BoardBootstrapResult {
  boards: BoardOptionViewModel[]
  users: BoardUserViewModel[]
}


export class BoardController {
  private static readonly boardCacheTtlMs = 15_000
  private static readonly boardCache = new Map<string, CachedBoard>()
  private static readonly boardInFlight = new Map<string, Promise<BoardDetailsViewModel>>()

  private static bootstrapCache: BoardBootstrapResult | null = null
  private static bootstrapAtMs = 0
  private static bootstrapInFlight: Promise<BoardBootstrapResult> | null = null

  private readonly loadBoardsUseCase: LoadBoardsUseCase
  private readonly loadBoardDetailsUseCase: LoadBoardDetailsUseCase
  private readonly manageBoardStructureUseCase: ManageBoardStructureUseCase
  private readonly manageBoardTasksUseCase: ManageBoardTasksUseCase
  private readonly loadTaskActivityUseCase: LoadTaskActivityUseCase
  private readonly loadBoardUsersUseCase: LoadBoardUsersUseCase
  private readonly kanbanAdvancedUseCase: KanbanAdvancedUseCase

  constructor(
    loadBoardsUseCase: LoadBoardsUseCase,
    loadBoardDetailsUseCase: LoadBoardDetailsUseCase,
    manageBoardStructureUseCase: ManageBoardStructureUseCase,
    manageBoardTasksUseCase: ManageBoardTasksUseCase,
    loadTaskActivityUseCase: LoadTaskActivityUseCase,
    loadBoardUsersUseCase: LoadBoardUsersUseCase,
    kanbanAdvancedUseCase: KanbanAdvancedUseCase,
  ) {
    this.loadBoardsUseCase = loadBoardsUseCase
    this.loadBoardDetailsUseCase = loadBoardDetailsUseCase
    this.manageBoardStructureUseCase = manageBoardStructureUseCase
    this.manageBoardTasksUseCase = manageBoardTasksUseCase
    this.loadTaskActivityUseCase = loadTaskActivityUseCase
    this.loadBoardUsersUseCase = loadBoardUsersUseCase
    this.kanbanAdvancedUseCase = kanbanAdvancedUseCase
  }

  async bootstrap(force = false): Promise<BoardBootstrapResult> {
    const now = Date.now()

    if (!force && BoardController.bootstrapCache && now - BoardController.bootstrapAtMs < BoardController.boardCacheTtlMs) {
      return BoardController.bootstrapCache
    }

    if (!force && BoardController.bootstrapInFlight) {
      return BoardController.bootstrapInFlight
    }

    const request = Promise.all([
      this.loadBoardsUseCase.execute(),
      this.loadBoardUsersUseCase.listUsers(),
    ])
      .then(([boards, users]) => ({
        boards: toBoardOptionsViewModel(boards),
        users: toBoardUsersViewModel(users),
      }))
      .then((result) => {
        BoardController.bootstrapCache = result
        BoardController.bootstrapAtMs = Date.now()
        return result
      })
      .finally(() => {
        BoardController.bootstrapInFlight = null
      })

    BoardController.bootstrapInFlight = request
    return request
  }


  async loadBoard(boardId: string, force = false): Promise<BoardDetailsViewModel> {

    const now = Date.now()

    if (!force) {
      const cached = BoardController.boardCache.get(boardId)
      if (cached && now - cached.atMs < BoardController.boardCacheTtlMs) {
        return cached.value
      }

      const inflight = BoardController.boardInFlight.get(boardId)
      if (inflight) {
        return inflight
      }
    }

    const request = this.loadBoardDetailsUseCase.execute(boardId)
      .then((details) => toBoardDetailsViewModel(details))
      .then((result) => {
        BoardController.boardCache.set(boardId, {
          atMs: Date.now(),
          value: result,
        })
        return result
      })
      .finally(() => {
        BoardController.boardInFlight.delete(boardId)
      })

    BoardController.boardInFlight.set(boardId, request)
    return request
  }

  async loadFilteredBoard(params: {
    userId?: number
    status?: string
    date?: string
    name?: string
    labelId?: string
  }): Promise<BoardDetailsViewModel> {
    const details = await this.kanbanAdvancedUseCase.getFilteredBoard(params)
    return toBoardDetailsViewModel(details)
  }

  async createBoard(name: string): Promise<void> {
    await this.manageBoardStructureUseCase.createBoard(name)
    this.invalidateAll()
  }

  async updateBoard(boardId: string, name: string): Promise<void> {
    await this.kanbanAdvancedUseCase.updateBoard(boardId, name)
    this.invalidateBoard(boardId)
    this.invalidateBootstrap()
  }

  async deleteBoard(boardId: string): Promise<void> {
    await this.kanbanAdvancedUseCase.deleteBoard(boardId)
    this.invalidateBoard(boardId)
    this.invalidateBootstrap()
  }

  async createColumn(boardId: string, name: string, key?: string): Promise<void> {
    await this.manageBoardStructureUseCase.createColumn(boardId, name, key)
    this.invalidateBoard(boardId)
  }

  async updateColumn(boardId: string, columnId: string, name: string, key?: string): Promise<void> {
    await this.manageBoardStructureUseCase.updateColumn(columnId, name, key)
    this.invalidateBoard(boardId)
  }

  async deleteColumn(boardId: string, columnId: string): Promise<void> {
    await this.manageBoardStructureUseCase.deleteColumn(columnId)
    this.invalidateBoard(boardId)
  }

  async moveColumn(boardId: string, columnId: string, newPosition: number): Promise<void> {
    await this.manageBoardStructureUseCase.moveColumn(columnId, newPosition)
    this.invalidateBoard(boardId)
  }

  async createTask(boardId: string, payload: {
    title: string
    description?: string
    priority?: 'low' | 'medium' | 'high' | 'critical'
    sprintId?: string
    goalId?: string
    projectId?: string
    assigneeIds?: number[]
    dueAt?: string
    columnId?: string
    status?: string
    originalEstimateSec?: number
    parentId?: string | null
    attachmentFileIds?: string[]
  }): Promise<BoardTask> {
    const created = await this.manageBoardTasksUseCase.createTask({
      boardId,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      status: payload.status,
      sprintId: payload.sprintId,
      goalId: payload.goalId,
      projectId: payload.projectId,
      assigneeIds: payload.assigneeIds,
      dueAt: payload.dueAt,
      originalEstimateSec: payload.originalEstimateSec,
      parentId: payload.parentId,
      attachmentFileIds: payload.attachmentFileIds,
    })

    if (payload.columnId && payload.columnId !== created.columnId) {
      await this.manageBoardTasksUseCase.moveTask(created.id, payload.columnId)
    }

    this.invalidateBoard(boardId)
    return created
  }


  async searchTasks(params: import('../../domain/entities/board/BoardModels').KanbanTaskSearchParams): Promise<BoardTaskViewModel[]> {
    const tasks = await this.kanbanAdvancedUseCase.searchTasks(params)
    return toBoardTaskListViewModel(tasks)
  }

  async updateTask(boardId: string, taskId: string, payload: {
    title?: string
    description?: string
    priority?: string
    dueAt?: string
    sprintId?: string
    assigneeIds?: number[]
    originalEstimateSec?: number
    parentId?: string | null
    clearParentId?: boolean
    addAttachmentFileIds?: string[]
    status?: string
    labelIds?: string[]
  }): Promise<void> {
    await this.manageBoardTasksUseCase.updateTask(taskId, payload)
    this.invalidateBoard(boardId)
  }

  async updateTaskStatus(boardId: string, taskId: string, status: string): Promise<void> {
    await this.kanbanAdvancedUseCase.updateTaskStatus(taskId, status)
    this.invalidateBoard(boardId)
  }

  async deleteTask(boardId: string, taskId: string): Promise<void> {
    await this.manageBoardTasksUseCase.deleteTask(taskId)
    this.invalidateBoard(boardId)
  }

  async moveTask(boardId: string, taskId: string, toColumnId: string): Promise<void> {
    await this.manageBoardTasksUseCase.moveTask(taskId, toColumnId)
    this.invalidateBoard(boardId)
  }

  async createSprint(boardId: string, payload: { name: string; goalId?: string; projectId?: string; status?: string; startDate?: string; endDate?: string }): Promise<BoardSprint> {
    const created = await this.manageBoardStructureUseCase.createSprint(boardId, payload)
    this.invalidateBoard(boardId)
    return created
  }

  async updateSprint(boardId: string, sprintId: string, payload: { name: string; goalId?: string; projectId?: string; status?: string; startDate?: string; endDate?: string }): Promise<BoardSprint> {
    const updated = await this.manageBoardStructureUseCase.updateSprint(boardId, sprintId, payload)
    this.invalidateBoard(boardId)
    return updated
  }

  async deleteSprint(boardId: string, sprintId: string): Promise<void> {
    await this.manageBoardStructureUseCase.deleteSprint(boardId, sprintId)
    this.invalidateBoard(boardId)
  }

  async createGoal(boardId: string, payload: { name: string; description?: string }): Promise<BoardGoal> {
    const created = await this.manageBoardStructureUseCase.createGoal(boardId, payload)
    this.invalidateBoard(boardId)
    return created
  }

  async updateGoal(boardId: string, goalId: string, payload: { name: string; description?: string }): Promise<BoardGoal> {
    const updated = await this.manageBoardStructureUseCase.updateGoal(boardId, goalId, payload)
    this.invalidateBoard(boardId)
    return updated
  }

  async deleteGoal(boardId: string, goalId: string): Promise<void> {
    await this.manageBoardStructureUseCase.deleteGoal(boardId, goalId)
    this.invalidateBoard(boardId)
  }

  async createProject(boardId: string, payload: { name: string; description?: string; goalId?: string; status?: string }): Promise<BoardProject> {
    const created = await this.manageBoardStructureUseCase.createProject(boardId, payload)
    this.invalidateBoard(boardId)
    return created
  }

  async updateProject(boardId: string, projectId: string, payload: { name: string; description?: string; goalId?: string; status?: string }): Promise<BoardProject> {
    const updated = await this.manageBoardStructureUseCase.updateProject(boardId, projectId, payload)
    this.invalidateBoard(boardId)
    return updated
  }

  async deleteProject(boardId: string, projectId: string): Promise<void> {
    await this.manageBoardStructureUseCase.deleteProject(boardId, projectId)
    this.invalidateBoard(boardId)
  }

  async addMembers(boardId: string, members: Array<{ userId: number; role?: string; teamRole?: string }>): Promise<void> {
    await this.manageBoardStructureUseCase.addMembers(boardId, members)
    this.invalidateBoard(boardId)
  }

  async removeMember(boardId: string, userId: number): Promise<void> {
    await this.manageBoardStructureUseCase.removeMember(boardId, userId)
    this.invalidateBoard(boardId)
  }

  async updateMemberRole(boardId: string, userId: number, role: string): Promise<void> {
    await this.kanbanAdvancedUseCase.updateMemberRole(boardId, userId, role)
    this.invalidateBoard(boardId)
  }

  async updateMemberTeamRole(boardId: string, userId: number, teamRole: string): Promise<void> {
    await this.kanbanAdvancedUseCase.updateMemberTeamRole(boardId, userId, teamRole)
    this.invalidateBoard(boardId)
  }

  async loadBoardLabels(boardId: string): Promise<BoardLabelViewModel[]> {
    const labels = await this.kanbanAdvancedUseCase.listBoardLabels(boardId)
    return toBoardLabelsViewModel(labels)
  }

  async createBoardLabel(boardId: string, payload: { name: string; color: string }): Promise<void> {
    await this.kanbanAdvancedUseCase.createBoardLabel(boardId, payload)
    this.invalidateBoard(boardId)
  }

  async deleteBoardLabel(boardId: string, labelId: string): Promise<void> {
    await this.kanbanAdvancedUseCase.deleteBoardLabel(labelId)
    this.invalidateBoard(boardId)
  }

  async addTaskLabel(boardId: string, taskId: string, labelId: string): Promise<void> {
    await this.kanbanAdvancedUseCase.addTaskLabel(taskId, labelId)
    this.invalidateBoard(boardId)
  }

  async removeTaskLabel(boardId: string, taskId: string, labelId: string): Promise<void> {
    await this.kanbanAdvancedUseCase.removeTaskLabel(taskId, labelId)
    this.invalidateBoard(boardId)
  }

  async loadTaskComments(taskId: string): Promise<BoardCommentViewModel[]> {
    const comments = await this.kanbanAdvancedUseCase.listTaskComments(taskId)
    return toBoardCommentsViewModel(comments)
  }

  async createTaskComment(boardId: string, taskId: string, payload: { content: string; attachmentUrl?: string }): Promise<void> {
    await this.kanbanAdvancedUseCase.createTaskComment(taskId, payload)
    this.invalidateBoard(boardId)
  }

  async createTaskCommentPhoto(boardId: string, taskId: string, payload: { file: File; content?: string }): Promise<void> {
    await this.kanbanAdvancedUseCase.createTaskCommentPhoto(taskId, payload)
    this.invalidateBoard(boardId)
  }

  async downloadAttachmentByUrl(url: string): Promise<Blob> {
    return this.kanbanAdvancedUseCase.downloadAttachmentByUrl(url)
  }

  async updateComment(boardId: string, commentId: string, content: string): Promise<void> {
    await this.kanbanAdvancedUseCase.updateComment(commentId, content)
    this.invalidateBoard(boardId)
  }

  async deleteComment(boardId: string, commentId: string): Promise<void> {
    await this.kanbanAdvancedUseCase.deleteComment(commentId)
    this.invalidateBoard(boardId)
  }

  async uploadKanbanFile(file: File): Promise<{ fileId: string; downloadUrl: string; fileName: string }> {
    return this.kanbanAdvancedUseCase.uploadKanbanFile(file)
  }

  async attachExistingFile(boardId: string, taskId: string, fileId: string): Promise<void> {
    await this.kanbanAdvancedUseCase.attachExistingFile(taskId, fileId)
    this.invalidateBoard(boardId)
  }

  async loadTaskActivity(taskId: string): Promise<BoardActivityViewModel> {
    const [worklogs, history, bootstrap] = await Promise.all([
      this.loadTaskActivityUseCase.listWorklogs(taskId),
      this.loadTaskActivityUseCase.getHistory(taskId),
      this.bootstrap(),
    ])

    // Load all users to be sure we can resolve any ID in history
    const users = bootstrap.users.length > 0 ? bootstrap.users : await this.loadBoardUsersUseCase.listUsers()
    const userNamesById = new Map<number, string>(users.map((u) => [u.id, u.fullName]))

    return toBoardActivityViewModel(worklogs, history, userNamesById)
  }

  async addWorklog(boardId: string, taskId: string, payload: { timeSpentSec: number; comment?: string; startedAt?: string }): Promise<void> {
    await this.loadTaskActivityUseCase.addWorklog(taskId, payload)
    this.invalidateBoard(boardId)
  }

  async uploadTaskFile(boardId: string, taskId: string, file: File): Promise<void> {
    await this.manageBoardTasksUseCase.uploadTaskFile(taskId, file)
    this.invalidateBoard(boardId)
  }

  async deleteTaskFile(boardId: string, taskId: string, fileId: string): Promise<void> {
    await this.kanbanAdvancedUseCase.deleteTaskFile(taskId, fileId)
    this.invalidateBoard(boardId)
  }

  getTaskFileDownloadUrl(taskId: string, fileId: string): string {
    return this.kanbanAdvancedUseCase.getTaskFileDownloadUrl(taskId, fileId)
  }

  async uploadBoardBackgroundImage(boardId: string, file: File): Promise<void> {
    await this.kanbanAdvancedUseCase.uploadBoardBackgroundImage(boardId, file)
    this.invalidateBoard(boardId)
  }

  async deleteBoardBackgroundImage(boardId: string): Promise<void> {
    await this.kanbanAdvancedUseCase.deleteBoardBackgroundImage(boardId)
    this.invalidateBoard(boardId)
  }

  async setBoardBackgroundPreset(boardId: string, presetId: string): Promise<void> {
    await this.kanbanAdvancedUseCase.setBoardBackgroundPreset(boardId, presetId)
    this.invalidateBoard(boardId)
  }

  getBoardBackgroundImageDownloadUrl(boardId: string): string {
    return this.kanbanAdvancedUseCase.getBoardBackgroundImageDownloadUrl(boardId)
  }

  async downloadBoardBackgroundImage(boardId: string): Promise<Blob> {
    return this.kanbanAdvancedUseCase.downloadBoardBackgroundImage(boardId)
  }

  async getOrgStats(stateBodyId: number): Promise<OrgStatsViewModel> {
    const stats = await this.kanbanAdvancedUseCase.getOrgStats(stateBodyId)
    return toOrgStatsViewModel(stats)
  }

  async getOrgStatsAccessCheck(stateBodyId: number): Promise<{ allowed: boolean; reason: string }> {
    const result = await this.kanbanAdvancedUseCase.getOrgStatsAccessCheck(stateBodyId)
    return {
      allowed: result.allowed,
      reason: result.reason,
    }
  }

  async listOrgStatsAccessUsers(stateBodyId: number): Promise<OrgAccessUserViewModel[]> {
    const users = await this.kanbanAdvancedUseCase.listOrgStatsAccessUsers(stateBodyId)
    return toOrgAccessUsersViewModel(users)
  }

  async grantOrgStatsAccess(stateBodyId: number, userId: number): Promise<void> {
    await this.kanbanAdvancedUseCase.grantOrgStatsAccess(stateBodyId, userId)
  }

  async revokeOrgStatsAccess(stateBodyId: number, userId: number): Promise<void> {
    await this.kanbanAdvancedUseCase.revokeOrgStatsAccess(stateBodyId, userId)
  }

  async listOrgKanbanAccessUsers(stateBodyId: number): Promise<OrgAccessUserViewModel[]> {
    const users = await this.kanbanAdvancedUseCase.listOrgKanbanAccessUsers(stateBodyId)
    return toOrgAccessUsersViewModel(users)
  }

  async grantOrgKanbanAccess(stateBodyId: number, userId: number): Promise<void> {
    await this.kanbanAdvancedUseCase.grantOrgKanbanAccess(stateBodyId, userId)
  }

  async revokeOrgKanbanAccess(stateBodyId: number, userId: number): Promise<void> {
    await this.kanbanAdvancedUseCase.revokeOrgKanbanAccess(stateBodyId, userId)
  }

  async loadBoardStats(boardId: string, params?: { dateFrom?: string; dateTo?: string }): Promise<BoardStatsViewModel> {
    const stats = await this.kanbanAdvancedUseCase.getBoardStats(boardId, params)
    return toBoardStatsViewModel(stats)
  }

  async loadMultiBoardStats(boardIds?: string[], params?: { dateFrom?: string; dateTo?: string }): Promise<BoardStatsViewModel> {
    const stats = await this.kanbanAdvancedUseCase.getMultiBoardStats(boardIds, params)
    return toBoardStatsViewModel(stats)
  }

  async loadTask(taskId: string) {
    return this.manageBoardTasksUseCase.getTask(taskId)
  }

  invalidateBoard(boardId: string): void {
    BoardController.boardCache.delete(boardId)
    BoardController.boardInFlight.delete(boardId)
  }

  private invalidateBootstrap(): void {
    BoardController.bootstrapCache = null
    BoardController.bootstrapAtMs = 0
    BoardController.bootstrapInFlight = null
  }

  invalidateAll(): void {
    this.invalidateBootstrap()
    BoardController.boardCache.clear()
    BoardController.boardInFlight.clear()
  }
}
