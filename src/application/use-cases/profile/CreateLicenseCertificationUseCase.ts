import type {
  CreateLicenseCertificationInput,
  UserLicenseCertificationItem,
} from '../../../domain/entities/profile-settings/ProfileSectionsModels'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class CreateLicenseCertificationUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(payload: CreateLicenseCertificationInput): Promise<UserLicenseCertificationItem> {
    return this.profileRepository.createLicenseCertification(payload)
  }
}
