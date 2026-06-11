import type {
  UpdateLicenseCertificationInput,
  UserLicenseCertificationItem,
} from '../../../domain/entities/profile-settings/ProfileSectionsModels'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class UpdateLicenseCertificationUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(id: number, payload: UpdateLicenseCertificationInput): Promise<UserLicenseCertificationItem> {
    return this.profileRepository.updateLicenseCertification(id, payload)
  }
}
