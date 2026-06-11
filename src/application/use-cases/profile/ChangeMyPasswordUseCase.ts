import type { ChangePasswordResponse } from '../../../domain/entities/profile-settings/ProfileSettingsModels'
import type { SaveE2eeKeyBackupInput } from '../../../domain/entities/WebE2eeBootstrap'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class ChangeMyPasswordUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(
    oldPassword: string,
    newPassword: string,
    e2eeBackup: SaveE2eeKeyBackupInput,
  ): Promise<ChangePasswordResponse> {
    return this.profileRepository.changePassword({ oldPassword, newPassword, e2eeBackup })
  }
}
