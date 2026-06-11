import type { BoardDetails } from '../../../domain/entities/board/BoardModels'
import type { BoardRepository } from '../../../domain/repositories/BoardRepository'

export class LoadBoardDetailsUseCase {
  private readonly boardRepository: BoardRepository

  constructor(boardRepository: BoardRepository) {
    this.boardRepository = boardRepository
  }

  async execute(boardId: string): Promise<BoardDetails> {
    return this.boardRepository.getBoard(boardId)
  }
}
