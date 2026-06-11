import type { HomeRepository } from '../../../domain/repositories/HomeRepository'

export class ReorderWorkspaceFavoriteUseCase {
  private readonly homeRepository: HomeRepository

  constructor(homeRepository: HomeRepository) {
    this.homeRepository = homeRepository
  }

  async execute(appId: number, newPosition: number): Promise<void> {
    await this.homeRepository.reorderFavoriteApp(appId, newPosition)
  }
}
