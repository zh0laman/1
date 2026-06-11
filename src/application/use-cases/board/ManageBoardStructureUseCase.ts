import type { Board, BoardSprint, BoardGoal, BoardProject } from '../../../domain/entities/board/BoardModels'
import type { BoardRepository } from '../../../domain/repositories/BoardRepository'

export class ManageBoardStructureUseCase {
  private readonly boardRepository: BoardRepository

  constructor(boardRepository: BoardRepository) {
    this.boardRepository = boardRepository
  }

  async createBoard(name: string): Promise<Board> {
    return this.boardRepository.createBoard(name)
  }

  async createColumn(boardId: string, name: string, key?: string): Promise<void> {
    await this.boardRepository.createColumn(boardId, name, key)
  }

  async updateColumn(columnId: string, name: string, key?: string): Promise<void> {
    await this.boardRepository.updateColumn(columnId, name, key)
  }

  async deleteColumn(columnId: string): Promise<void> {
    await this.boardRepository.deleteColumn(columnId)
  }

  async moveColumn(columnId: string, newPosition: number): Promise<void> {
    await this.boardRepository.moveColumn(columnId, newPosition)
  }

  async createSprint(boardId: string, payload: { name: string; goalId?: string; projectId?: string; status?: string; startDate?: string; endDate?: string }): Promise<BoardSprint> {
    return this.boardRepository.createSprint(boardId, payload)
  }

  async updateSprint(boardId: string, sprintId: string, payload: { name: string; goalId?: string; projectId?: string; status?: string; startDate?: string; endDate?: string }): Promise<BoardSprint> {
    return this.boardRepository.updateSprint(boardId, sprintId, payload)
  }

  async deleteSprint(boardId: string, sprintId: string): Promise<void> {
    await this.boardRepository.deleteSprint(boardId, sprintId)
  }

  async createGoal(boardId: string, payload: { name: string; description?: string }): Promise<BoardGoal> {
    return this.boardRepository.createGoal(boardId, payload)
  }

  async updateGoal(boardId: string, goalId: string, payload: { name: string; description?: string }): Promise<BoardGoal> {
    return this.boardRepository.updateGoal(boardId, goalId, payload)
  }

  async deleteGoal(boardId: string, goalId: string): Promise<void> {
    await this.boardRepository.deleteGoal(boardId, goalId)
  }

  async createProject(boardId: string, payload: { name: string; description?: string; goalId?: string; status?: string }): Promise<BoardProject> {
    return this.boardRepository.createProject(boardId, payload)
  }

  async updateProject(boardId: string, projectId: string, payload: { name: string; description?: string; goalId?: string; status?: string }): Promise<BoardProject> {
    return this.boardRepository.updateProject(boardId, projectId, payload)
  }

  async deleteProject(boardId: string, projectId: string): Promise<void> {
    await this.boardRepository.deleteProject(boardId, projectId)
  }

  async addMembers(boardId: string, members: Array<{ userId: number; role?: string; teamRole?: string }>): Promise<void> {
    await this.boardRepository.addMembers(boardId, members)
  }

  async removeMember(boardId: string, userId: number): Promise<void> {
    await this.boardRepository.removeMember(boardId, userId)
  }
}
