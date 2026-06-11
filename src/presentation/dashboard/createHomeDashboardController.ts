import { LoadHomeDashboardUseCase } from '../../application/use-cases/dashboard/LoadHomeDashboardUseCase'
import { HttpHomeRepository } from '../../infrastructure/repositories/HttpHomeRepository'
import { LocalStorageAuthSessionStore } from '../../infrastructure/storage/LocalStorageAuthSessionStore'
import { HomeDashboardController } from '../controllers/HomeDashboardController'

export const createHomeDashboardController = () => {
  const sessionStore = new LocalStorageAuthSessionStore()
  const homeRepository = new HttpHomeRepository(sessionStore)
  const loadHomeDashboardUseCase = new LoadHomeDashboardUseCase(homeRepository)
  const homeDashboardController = new HomeDashboardController(loadHomeDashboardUseCase)

  return {
    homeDashboardController,
  }
}
