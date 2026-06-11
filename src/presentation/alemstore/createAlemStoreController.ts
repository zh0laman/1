import { AddFavoriteAppUseCase } from '../../application/use-cases/alemstore/AddFavoriteAppUseCase'
import { ClearPublicAppRatingUseCase } from '../../application/use-cases/alemstore/ClearPublicAppRatingUseCase'
import { LoadAllPublicAppsUseCase } from '../../application/use-cases/alemstore/LoadAllPublicAppsUseCase'
import { LoadFavoritePublicAppsUseCase } from '../../application/use-cases/alemstore/LoadFavoritePublicAppsUseCase'
import { RatePublicAppUseCase } from '../../application/use-cases/alemstore/RatePublicAppUseCase'
import { RemoveFavoriteAppUseCase } from '../../application/use-cases/alemstore/RemoveFavoriteAppUseCase'
import { HttpHomeRepository } from '../../infrastructure/repositories/HttpHomeRepository'
import { LocalStorageAuthSessionStore } from '../../infrastructure/storage/LocalStorageAuthSessionStore'
import { AlemStoreController } from '../controllers/AlemStoreController'

export const createAlemStoreController = () => {
  const sessionStore = new LocalStorageAuthSessionStore()
  const homeRepository = new HttpHomeRepository(sessionStore)

  const loadAllPublicAppsUseCase = new LoadAllPublicAppsUseCase(homeRepository)
  const loadFavoritePublicAppsUseCase = new LoadFavoritePublicAppsUseCase(homeRepository)
  const addFavoriteAppUseCase = new AddFavoriteAppUseCase(homeRepository)
  const removeFavoriteAppUseCase = new RemoveFavoriteAppUseCase(homeRepository)
  const ratePublicAppUseCase = new RatePublicAppUseCase(homeRepository)
  const clearPublicAppRatingUseCase = new ClearPublicAppRatingUseCase(homeRepository)

  const alemStoreController = new AlemStoreController(
    loadAllPublicAppsUseCase,
    loadFavoritePublicAppsUseCase,
    addFavoriteAppUseCase,
    removeFavoriteAppUseCase,
    ratePublicAppUseCase,
    clearPublicAppRatingUseCase,
  )

  return {
    alemStoreController,
  }
}
