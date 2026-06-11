import type { LicenseCertificationListResponse } from '../../../domain/entities/profile-settings/ProfileSectionsModels'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class LoadMyLicenseCertificationsUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(): Promise<LicenseCertificationListResponse> {
    return this.profileRepository.getMyLicenseCertifications()
  }
}
