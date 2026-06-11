import type { ProfileStats } from '../../../domain/entities/ProfileStats'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class LoadProfileStatsUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(): Promise<ProfileStats> {
    return this.profileRepository.getMyStats()
  }
}
