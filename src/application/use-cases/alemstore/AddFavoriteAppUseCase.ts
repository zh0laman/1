import type { HomeRepository } from '../../../domain/repositories/HomeRepository'

export class AddFavoriteAppUseCase {
  private readonly homeRepository: HomeRepository

  constructor(homeRepository: HomeRepository) {
    this.homeRepository = homeRepository
  }

  async execute(appId: number): Promise<void> {
    await this.homeRepository.addFavoriteApp(appId)
  }
}
