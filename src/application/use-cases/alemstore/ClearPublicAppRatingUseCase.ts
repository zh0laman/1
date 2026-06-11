import type { FavoriteApp } from '../../../domain/entities/HomeDashboard'
import type { HomeRepository } from '../../../domain/repositories/HomeRepository'

export class ClearPublicAppRatingUseCase {
  private readonly homeRepository: HomeRepository

  constructor(homeRepository: HomeRepository) {
    this.homeRepository = homeRepository
  }

  async execute(appId: number): Promise<FavoriteApp> {
    return this.homeRepository.removePublicAppRating(appId)
  }
}
