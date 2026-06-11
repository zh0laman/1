import type { BoardUser } from '../../../domain/entities/board/BoardModels'
import type { BoardRepository } from '../../../domain/repositories/BoardRepository'

export class LoadBoardUsersUseCase {
  private readonly boardRepository: BoardRepository

  constructor(boardRepository: BoardRepository) {
    this.boardRepository = boardRepository
  }

  async listUsers(): Promise<BoardUser[]> {
    return this.boardRepository.listUsers()
  }

  async getUserDetails(userId: number): Promise<BoardUser> {
    return this.boardRepository.getUserDetails(userId)
  }
}
