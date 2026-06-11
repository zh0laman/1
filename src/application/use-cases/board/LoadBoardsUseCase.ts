import type { Board } from '../../../domain/entities/board/BoardModels'
import type { BoardRepository } from '../../../domain/repositories/BoardRepository'

export class LoadBoardsUseCase {
  private readonly boardRepository: BoardRepository

  constructor(boardRepository: BoardRepository) {
    this.boardRepository = boardRepository
  }

  async execute(): Promise<Board[]> {
    return this.boardRepository.listBoards()
  }
}
