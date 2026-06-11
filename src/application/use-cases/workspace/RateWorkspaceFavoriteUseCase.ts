import type { FavoriteApp } from '../../../domain/entities/HomeDashboard'
import type { HomeRepository } from '../../../domain/repositories/HomeRepository'

export class RateWorkspaceFavoriteUseCase {
  private readonly homeRepository: HomeRepository

  constructor(homeRepository: HomeRepository) {
    this.homeRepository = homeRepository
  }

  async execute(appId: number, rating: number): Promise<FavoriteApp> {
    return this.homeRepository.ratePublicApp(appId, rating)
  }
}
