import type { BoardHistory, BoardSprint, BoardWorklog } from '../../../domain/entities/board/BoardModels'
import type { BoardRepository } from '../../../domain/repositories/BoardRepository'

export class LoadTaskActivityUseCase {
  private readonly boardRepository: BoardRepository

  constructor(boardRepository: BoardRepository) {
    this.boardRepository = boardRepository
  }

  async listSprints(): Promise<BoardSprint[]> {
    return this.boardRepository.listSprints()
  }

  async listWorklogs(taskId: string): Promise<BoardWorklog[]> {
    return this.boardRepository.listWorklogs(taskId)
  }

  async getHistory(taskId: string): Promise<BoardHistory[]> {
    return this.boardRepository.getTaskHistory(taskId)
  }

  async addWorklog(taskId: string, payload: { timeSpentSec: number; comment?: string; startedAt?: string }): Promise<void> {
    await this.boardRepository.addWorklog(taskId, payload)
  }
}
