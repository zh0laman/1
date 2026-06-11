import { KanbanAdvancedUseCase } from '../../application/use-cases/board/KanbanAdvancedUseCase'
import { LoadBoardDetailsUseCase } from '../../application/use-cases/board/LoadBoardDetailsUseCase'
import { LoadBoardUsersUseCase } from '../../application/use-cases/board/LoadBoardUsersUseCase'
import { LoadBoardsUseCase } from '../../application/use-cases/board/LoadBoardsUseCase'
import { LoadTaskActivityUseCase } from '../../application/use-cases/board/LoadTaskActivityUseCase'
import { ManageBoardStructureUseCase } from '../../application/use-cases/board/ManageBoardStructureUseCase'
import { ManageBoardTasksUseCase } from '../../application/use-cases/board/ManageBoardTasksUseCase'
import { HttpBoardRepository } from '../../infrastructure/repositories/HttpBoardRepository'
import { LocalStorageAuthSessionStore } from '../../infrastructure/storage/LocalStorageAuthSessionStore'
import { BoardController } from '../controllers/BoardController'

export const createBoardController = () => {
  const sessionStore = new LocalStorageAuthSessionStore()
  const boardRepository = new HttpBoardRepository(sessionStore)

  const boardController = new BoardController(
    new LoadBoardsUseCase(boardRepository),
    new LoadBoardDetailsUseCase(boardRepository),
    new ManageBoardStructureUseCase(boardRepository),
    new ManageBoardTasksUseCase(boardRepository),
    new LoadTaskActivityUseCase(boardRepository),
    new LoadBoardUsersUseCase(boardRepository),
    new KanbanAdvancedUseCase(boardRepository),
  )

  return {
    boardController,
  }
}
