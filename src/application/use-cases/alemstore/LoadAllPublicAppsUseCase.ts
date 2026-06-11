import type { FavoriteApp } from '../../../domain/entities/HomeDashboard'
import type { HomeRepository } from '../../../domain/repositories/HomeRepository'

export class LoadAllPublicAppsUseCase {
  private readonly homeRepository: HomeRepository

  constructor(homeRepository: HomeRepository) {
    this.homeRepository = homeRepository
  }

  async execute(options?: {
    sort?: 'position' | 'rating'
    name?: string
    downloaded?: boolean
    category?: string
  }): Promise<FavoriteApp[]> {
    return this.homeRepository.getPublicApps(options)
  }
}
