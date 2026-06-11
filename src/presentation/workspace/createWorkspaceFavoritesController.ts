import { ClearWorkspaceFavoriteRatingUseCase } from '../../application/use-cases/workspace/ClearWorkspaceFavoriteRatingUseCase'
import { LoadWorkspaceFavoritesUseCase } from '../../application/use-cases/workspace/LoadWorkspaceFavoritesUseCase'
import { RateWorkspaceFavoriteUseCase } from '../../application/use-cases/workspace/RateWorkspaceFavoriteUseCase'
import { RemoveWorkspaceFavoriteUseCase } from '../../application/use-cases/workspace/RemoveWorkspaceFavoriteUseCase'
import { ReorderWorkspaceFavoriteUseCase } from '../../application/use-cases/workspace/ReorderWorkspaceFavoriteUseCase'
import { HttpHomeRepository } from '../../infrastructure/repositories/HttpHomeRepository'
import { LocalStorageAuthSessionStore } from '../../infrastructure/storage/LocalStorageAuthSessionStore'
import { WorkspaceFavoritesController } from '../controllers/WorkspaceFavoritesController'

export const createWorkspaceFavoritesController = () => {
  const sessionStore = new LocalStorageAuthSessionStore()
  const homeRepository = new HttpHomeRepository(sessionStore)

  const loadWorkspaceFavoritesUseCase = new LoadWorkspaceFavoritesUseCase(homeRepository)
  const reorderWorkspaceFavoriteUseCase = new ReorderWorkspaceFavoriteUseCase(homeRepository)
  const removeWorkspaceFavoriteUseCase = new RemoveWorkspaceFavoriteUseCase(homeRepository)
  const rateWorkspaceFavoriteUseCase = new RateWorkspaceFavoriteUseCase(homeRepository)
  const clearWorkspaceFavoriteRatingUseCase = new ClearWorkspaceFavoriteRatingUseCase(homeRepository)

  const workspaceFavoritesController = new WorkspaceFavoritesController(
    loadWorkspaceFavoritesUseCase,
    reorderWorkspaceFavoriteUseCase,
    removeWorkspaceFavoriteUseCase,
    rateWorkspaceFavoriteUseCase,
    clearWorkspaceFavoriteRatingUseCase,
  )

  return {
    workspaceFavoritesController,
  }
}
