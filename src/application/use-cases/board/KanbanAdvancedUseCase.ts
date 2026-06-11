import type {
  Board,
  BoardBackground,
  BoardComment,
  BoardDetails,
  BoardLabel,
  BoardTask,
  KanbanFilteredBoardParams,
  KanbanTaskSearchParams,
  OrgAccessCheck,
  OrgAccessUser,
  OrgKanbanStats,
  BoardStats,
} from '../../../domain/entities/board/BoardModels'
import type { BoardRepository } from '../../../domain/repositories/BoardRepository'

export class KanbanAdvancedUseCase {
  private readonly boardRepository: BoardRepository

  constructor(boardRepository: BoardRepository) {
    this.boardRepository = boardRepository
  }

  getFilteredBoard(params: KanbanFilteredBoardParams): Promise<BoardDetails> {
    return this.boardRepository.getFilteredBoard(params)
  }

  updateMemberRole(boardId: string, userId: number, role: string): Promise<void> {
    return this.boardRepository.updateMemberRole(boardId, userId, role)
  }

  updateMemberTeamRole(boardId: string, userId: number, teamRole: string): Promise<void> {
    return this.boardRepository.updateMemberTeamRole(boardId, userId, teamRole)
  }

  updateBoard(boardId: string, name: string): Promise<Board> {
    return this.boardRepository.updateBoard(boardId, name)
  }

  deleteBoard(boardId: string): Promise<void> {
    return this.boardRepository.deleteBoard(boardId)
  }

  uploadBoardBackgroundImage(boardId: string, file: File): Promise<BoardBackground> {
    return this.boardRepository.uploadBoardBackgroundImage(boardId, file)
  }

  deleteBoardBackgroundImage(boardId: string): Promise<BoardBackground> {
    return this.boardRepository.deleteBoardBackgroundImage(boardId)
  }

  setBoardBackgroundPreset(boardId: string, presetId: string): Promise<BoardBackground> {
    return this.boardRepository.setBoardBackgroundPreset(boardId, presetId)
  }

  getBoardBackgroundImageDownloadUrl(boardId: string): string {
    return this.boardRepository.getBoardBackgroundImageDownloadUrl(boardId)
  }

  downloadBoardBackgroundImage(boardId: string): Promise<Blob> {
    return this.boardRepository.downloadBoardBackgroundImage(boardId)
  }

  listBoardLabels(boardId: string): Promise<BoardLabel[]> {
    return this.boardRepository.listBoardLabels(boardId)
  }

  createBoardLabel(boardId: string, payload: { name: string; color: string }): Promise<BoardLabel> {
    return this.boardRepository.createBoardLabel(boardId, payload)
  }

  deleteBoardLabel(labelId: string): Promise<void> {
    return this.boardRepository.deleteBoardLabel(labelId)
  }

  listMyTodoTasks(): Promise<BoardTask[]> {
    return this.boardRepository.listMyTodoTasks()
  }

  searchTasks(params: KanbanTaskSearchParams): Promise<BoardTask[]> {
    return this.boardRepository.searchTasks(params)
  }

  updateTaskStatus(taskId: string, status: string): Promise<BoardTask> {
    return this.boardRepository.updateTaskStatus(taskId, status)
  }

  uploadKanbanFile(file: File): Promise<{ fileId: string; downloadUrl: string; fileName: string }> {
    return this.boardRepository.uploadKanbanFile(file)
  }

  attachExistingFile(taskId: string, fileId: string): Promise<void> {
    return this.boardRepository.attachExistingFile(taskId, fileId)
  }

  deleteTaskFile(taskId: string, fileId: string): Promise<void> {
    return this.boardRepository.deleteTaskFile(taskId, fileId)
  }

  getTaskFileDownloadUrl(taskId: string, fileId: string): string {
    return this.boardRepository.getTaskFileDownloadUrl(taskId, fileId)
  }

  listTaskComments(taskId: string): Promise<BoardComment[]> {
    return this.boardRepository.listTaskComments(taskId)
  }

  createTaskComment(taskId: string, payload: { content: string; attachmentUrl?: string }): Promise<BoardComment> {
    return this.boardRepository.createTaskComment(taskId, payload)
  }

  createTaskCommentPhoto(taskId: string, payload: { file: File; content?: string }): Promise<BoardComment> {
    return this.boardRepository.createTaskCommentPhoto(taskId, payload)
  }

  downloadAttachmentByUrl(url: string): Promise<Blob> {
    return this.boardRepository.downloadAttachmentByUrl(url)
  }

  updateComment(commentId: string, content: string): Promise<void> {
    return this.boardRepository.updateComment(commentId, content)
  }

  deleteComment(commentId: string): Promise<void> {
    return this.boardRepository.deleteComment(commentId)
  }

  addTaskLabel(taskId: string, labelId: string): Promise<void> {
    return this.boardRepository.addTaskLabel(taskId, labelId)
  }

  removeTaskLabel(taskId: string, labelId: string): Promise<void> {
    return this.boardRepository.removeTaskLabel(taskId, labelId)
  }

  getOrgStats(stateBodyId: number): Promise<OrgKanbanStats> {
    return this.boardRepository.getOrgStats(stateBodyId)
  }

  getOrgStatsAccessCheck(stateBodyId: number): Promise<OrgAccessCheck> {
    return this.boardRepository.getOrgStatsAccessCheck(stateBodyId)
  }

  listOrgStatsAccessUsers(stateBodyId: number): Promise<OrgAccessUser[]> {
    return this.boardRepository.listOrgStatsAccessUsers(stateBodyId)
  }

  grantOrgStatsAccess(stateBodyId: number, userId: number): Promise<void> {
    return this.boardRepository.grantOrgStatsAccess(stateBodyId, userId)
  }

  revokeOrgStatsAccess(stateBodyId: number, userId: number): Promise<void> {
    return this.boardRepository.revokeOrgStatsAccess(stateBodyId, userId)
  }

  listOrgKanbanAccessUsers(stateBodyId: number): Promise<OrgAccessUser[]> {
    return this.boardRepository.listOrgKanbanAccessUsers(stateBodyId)
  }

  grantOrgKanbanAccess(stateBodyId: number, userId: number): Promise<void> {
    return this.boardRepository.grantOrgKanbanAccess(stateBodyId, userId)
  }

  revokeOrgKanbanAccess(stateBodyId: number, userId: number): Promise<void> {
    return this.boardRepository.revokeOrgKanbanAccess(stateBodyId, userId)
  }

  getBoardStats(boardId: string, params?: { dateFrom?: string; dateTo?: string }): Promise<BoardStats> {
    return this.boardRepository.getBoardStats(boardId, params)
  }

  getMultiBoardStats(boardIds?: string[], params?: { dateFrom?: string; dateTo?: string }): Promise<BoardStats> {
    return this.boardRepository.getMultiBoardStats(boardIds, params)
  }
}
