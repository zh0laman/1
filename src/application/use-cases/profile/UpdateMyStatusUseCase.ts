import type {
  AvailabilityStatus,
  UpdateStatusResponse,
} from '../../../domain/entities/profile-settings/ProfileSettingsModels'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class UpdateMyStatusUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(status: AvailabilityStatus): Promise<UpdateStatusResponse> {
    return this.profileRepository.updateStatus({ status })
  }
}
