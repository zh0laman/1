import type { EducationListResponse } from '../../../domain/entities/profile-settings/ProfileSectionsModels'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

export class LoadMyEducationsUseCase {
  private readonly profileRepository: ProfileRepository

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async execute(): Promise<EducationListResponse> {
    return this.profileRepository.getMyEducations()
  }
}
