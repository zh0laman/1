import type { FavoriteApp } from '../../../domain/entities/HomeDashboard'
import type { HomeRepository } from '../../../domain/repositories/HomeRepository'

export class LoadWorkspaceFavoritesUseCase {
  private readonly homeRepository: HomeRepository

  constructor(homeRepository: HomeRepository) {
    this.homeRepository = homeRepository
  }

  async execute(): Promise<FavoriteApp[]> {
    return this.homeRepository.getFavorites()
  }
}
