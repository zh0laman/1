import type { CurrentProfile } from '../../../domain/entities/profile-settings/ProfileSettingsModels'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class GetCurrentProfileUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(): Promise<CurrentProfile> {
    return this.profileRepository.getMe()
  }
}
