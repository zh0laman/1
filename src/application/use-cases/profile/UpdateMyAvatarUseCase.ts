import type { CurrentProfile } from '../../../domain/entities/profile-settings/ProfileSettingsModels'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class UpdateMyAvatarUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(avatarUrl?: string, avatarFile?: File): Promise<CurrentProfile> {
    return this.profileRepository.updateAvatar({ avatarUrl, avatarFile })
  }
}
