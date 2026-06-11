import type { HomeRepository } from '../../../domain/repositories/HomeRepository'

export class RemoveWorkspaceFavoriteUseCase {
  private readonly homeRepository: HomeRepository

  constructor(homeRepository: HomeRepository) {
    this.homeRepository = homeRepository
  }

  async execute(appId: number): Promise<void> {
    await this.homeRepository.removeFavoriteApp(appId)
  }
}
