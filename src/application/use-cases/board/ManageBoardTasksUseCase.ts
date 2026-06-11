import type { BoardTask, CreateBoardTaskPayload, UpdateBoardTaskPayload } from '../../../domain/entities/board/BoardModels'
import type { BoardRepository } from '../../../domain/repositories/BoardRepository'

export class ManageBoardTasksUseCase {
  private readonly boardRepository: BoardRepository

  constructor(boardRepository: BoardRepository) {
    this.boardRepository = boardRepository
  }

  async createTask(payload: CreateBoardTaskPayload): Promise<BoardTask> {
    return this.boardRepository.createTask(payload)
  }

  async getTask(taskId: string): Promise<BoardTask> {
    return this.boardRepository.getTask(taskId)
  }

  async updateTask(taskId: string, payload: UpdateBoardTaskPayload): Promise<void> {
    await this.boardRepository.updateTask(taskId, payload)
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.boardRepository.deleteTask(taskId)
  }

  async moveTask(taskId: string, toColumnId: string): Promise<void> {
    await this.boardRepository.moveTask(taskId, toColumnId)
  }

  async uploadTaskFile(taskId: string, file: File): Promise<void> {
    await this.boardRepository.uploadTaskFile(taskId, file)
  }
}
